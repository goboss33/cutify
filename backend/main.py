print("DEBUG: Starting main.py...")
import asyncio
import uuid
import os
from dotenv import load_dotenv
from datetime import datetime
from fastapi import FastAPI

print("DEBUG: Loading .env...")
load_dotenv()

from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from models import ChatMessageInput, ChatMessageOutput, ChatMessageDB, ProjectDB

# Create Tables if not exist
from database import engine, Base, SessionLocal
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI()

# Configure CORS to allow requests from the frontend
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    print(f"VALIDATION ERROR: {exc.errors()}")
    # print(f"BODY: {await request.body()}") # Consuming body might break things if not careful
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

print("DEBUG: Importing ai_service...")
from services.ai_service import generate_showrunner_response
print("DEBUG: ai_service imported.")

# Global chat_history removed in favor of DB persistence per project

@app.get("/api/projects/{project_id}/chat", response_model=list[ChatMessageOutput])
async def get_chat_history_endpoint(project_id: int, db: Session = Depends(get_db)):
    # Fetch History from DB
    history_records = db.query(ChatMessageDB).filter(ChatMessageDB.project_id == project_id).order_by(ChatMessageDB.created_at.asc()).limit(100).all()
    
    output = []
    for record in history_records:
        output.append(ChatMessageOutput(
            id=str(record.id),
            role="agent" if record.role != "user" else "user", # map 'model'/'agent' -> 'agent', 'user'->'user'
            content=record.content,
            timestamp=record.created_at.isoformat()
        ))
    return output

@app.post("/api/projects/{project_id}/chat", response_model=ChatMessageOutput)
async def chat_project_endpoint(project_id: int, message: ChatMessageInput, db: Session = Depends(get_db)):
    # 1. Verify Project
    project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
    if not project:
         from fastapi import HTTPException
         raise HTTPException(status_code=404, detail="Project not found")

    # 2. Fetch History from DB (Last 50 messages to keep context manageable)
    # Order by created_at ascending for the AI
    history_records = db.query(ChatMessageDB).filter(ChatMessageDB.project_id == project_id).order_by(ChatMessageDB.created_at.asc()).limit(50).all()
    
    # Convert to format expected by Gemini (list of dicts with 'role' and 'parts')
    # Our DB stores role as 'user'/'agent', Gemini expects 'user'/'model'
    formatted_history = []
    for record in history_records:
        gemini_role = "user" if record.role == "user" else "model"
        formatted_history.append({"role": gemini_role, "parts": [record.content]})

    # 3. Call AI Service
    # Pass DB and ProjectID to allow Tool Use
    response_content, action_taken = await generate_showrunner_response(message.content, formatted_history, db=db, project_id=project_id)
    
    # 4. Save User Message
    user_msg_db = ChatMessageDB(
        project_id=project_id,
        role="user",
        content=message.content
    )
    db.add(user_msg_db)
    
    # 5. Save Agent Response
    agent_msg_db = ChatMessageDB(
        project_id=project_id,
        role="agent",
        content=response_content
    )
    db.add(agent_msg_db)
    
    db.commit()
    db.refresh(agent_msg_db)
    db.refresh(agent_msg_db) # Double refresh safety not really needed but ok
    
    return ChatMessageOutput(
        id=str(agent_msg_db.id),
        role="agent",
        content=response_content,
        timestamp=agent_msg_db.created_at.isoformat(),
        action_taken=action_taken
    )

class HeadlessChatInput(BaseModel):
    messages: list[dict] # [{"role": "user", "content": "..."}]
    newMessage: str

@app.post("/api/chat/headless", response_model=ChatMessageOutput)
async def chat_headless_endpoint(input_data: HeadlessChatInput):
    # Prepare history for Gemini
    formatted_history = []
    for msg in input_data.messages:
        # Front sends 'senderId'='user'/'agent', we map to 'user'/'model'
        role = "user" if msg.get("senderId") != "agent" else "model"
        formatted_history.append({"role": role, "parts": [msg.get("text", "")]})
    
    # Call AI (No DB context for headless)
    response_content, _ = await generate_showrunner_response(input_data.newMessage, formatted_history)
    
    return ChatMessageOutput(
        id=str(uuid.uuid4()), # ephemeral ID
        role="agent",
        content=response_content,
        timestamp=datetime.utcnow().isoformat(),
        action_taken=False
    )

from services.concept_extractor import extract_concept_from_chat
from services.screenwriter import generate_scenes_breakdown
from services.scriptwriter import generate_scene_script
from services.director import generate_storyboard
from services.image_processor import slice_grid_image
from services.asset_generator import generate_asset_image
from database import SessionLocal
from models import ProjectDB, Project, SceneDB, Scene, ShotDB, Shot, CharacterDB, LocationDB, scene_characters, Character, Location, CharacterBase, LocationBase
from fastapi.staticfiles import StaticFiles

# Mount static directory
# Ensure directory exists first
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")






from models import ExtractConceptInput

from fastapi import Depends, HTTPException, Header
import jwt

# Simple JWT decoding (Verify signature in production with Supabase Public Key)
async def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization Header")
    
    try:
        token = authorization.split(" ")[1]
        # Decode without verification for speed/simplicity in this step, 
        # trusting Supabase (Frontend) sent a valid one. 
        # in prod: use jose.jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"])
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid Token: No sub")
        return user_id
    except Exception as e:
        print(f"Auth Error: {e}")
        raise HTTPException(status_code=401, detail="Invalid Token")

@app.post("/api/extract-concept", response_model=Project)
async def extract_concept_endpoint(payload: ExtractConceptInput, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    print(f"DEBUG: extract_concept called by {user_id} with {len(payload.messages)} messages")
    # Convert history from payload to string
    history_str = ""
    # Payload messages are likely from frontend: {senderId, text, ...}
    for msg in payload.messages:
        role = "USER" if msg.get("senderId") != "agent" else "AGENT"
        text = msg.get("text", "")
        history_str += f"{role}: {text}\n"
    
    concept_dict = await extract_concept_from_chat(history_str)
    
    new_project = ProjectDB(
        title=concept_dict.get("title", "Untitled Project"),
        genre=concept_dict.get("genre"),
        pitch=concept_dict.get("pitch"),
        visual_style=concept_dict.get("visual_style"),
        target_audience=concept_dict.get("target_audience"),
        status="concept",
        user_id=user_id # Bind to user
    )
    
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    
    return new_project



class ProjectCreate(BaseModel):
    title: str
    genre: str
    pitch: str | None = ""
    visual_style: str | None = ""
    target_audience: str | None = ""
    language: str = "French"
    target_duration: str = "60s"
    aspect_ratio: str = "16:9"

@app.post("/api/projects", response_model=Project)
async def create_project_endpoint(project_data: ProjectCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    new_project = ProjectDB(
        title=project_data.title,
        genre=project_data.genre,
        pitch=project_data.pitch,
        visual_style=project_data.visual_style,
        target_audience=project_data.target_audience,
        language=project_data.language,
        target_duration=project_data.target_duration,
        aspect_ratio=project_data.aspect_ratio,
        status="concept",
        user_id=user_id,
        created_at=datetime.utcnow()
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return new_project

@app.post("/api/projects/create_default", response_model=Project)
async def create_default_project(db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    # Create a blank project immediately
    new_project = ProjectDB(
        title="Untitled Project",
        genre="",
        pitch="",
        visual_style="",
        target_audience="",
        status="concept",
        user_id=user_id,
        created_at=datetime.utcnow()
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return new_project

@app.get("/api/projects", response_model=list[Project])
async def get_projects_endpoint(db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    print(f"DEBUG: Fetching projects for user {user_id}")
    # Filter by User ID
    projects = db.query(ProjectDB).filter(ProjectDB.user_id == user_id).order_by(ProjectDB.created_at.desc()).all()
    return projects

@app.get("/api/projects/{project_id}", response_model=Project)
async def get_project_endpoint(project_id: int, db: Session = Depends(get_db)):
    # Verify owner if needed, but for now simple fetch
    project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
    if not project:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.delete("/api/projects/{project_id}")
async def delete_project_endpoint(project_id: int, db: Session = Depends(get_db)):
    # 1. Fetch Project
    project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
    if not project:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Project not found")
        
    # 2. Delete (Cascade should handle relations if configured, otherwise manual)
    # For now assuming we just delete the project row
    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}


class ProjectUpdate(BaseModel):
    title: str | None = None
    genre: str | None = None
    pitch: str | None = None
    visual_style: str | None = None
    target_audience: str | None = None

@app.patch("/api/projects/{project_id}", response_model=Project)
async def update_project_endpoint(project_id: int, update_data: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
    if not project:
         from fastapi import HTTPException
         raise HTTPException(status_code=404, detail="Project not found")
    
    if update_data.title:
        project.title = update_data.title
    if update_data.genre:
        project.genre = update_data.genre
    if update_data.pitch:
        project.pitch = update_data.pitch
    if update_data.visual_style:
        project.visual_style = update_data.visual_style
    if update_data.target_audience:
        project.target_audience = update_data.target_audience
        
    db.commit()
    db.refresh(project)
    return project

class CreateSceneInput(BaseModel):
    title: str
    summary: str = ""

@app.post("/api/projects/{project_id}/scenes/simple", response_model=Scene)
async def create_simple_scene_endpoint(project_id: int, input_data: CreateSceneInput, db: Session = Depends(get_db)):
    # Verify Project
    project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
    if not project:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Project not found")

    # Find last sequence order
    last_scene = db.query(SceneDB).filter(SceneDB.project_id == project_id).order_by(SceneDB.sequence_order.desc()).first()
    new_order = (last_scene.sequence_order + 1) if last_scene else 1
    
    new_scene = SceneDB(
        project_id=project_id,
        sequence_order=new_order,
        title=input_data.title,
        summary=input_data.summary,
        status="pending"
    )
    db.add(new_scene)
    db.commit()
    db.refresh(new_scene)
    return new_scene

from services.screenwriter import generate_scenes_with_assets

@app.post("/api/projects/{project_id}/generate-scenes", response_model=list[Scene])
async def generate_scenes_endpoint(project_id: int, db: Session = Depends(get_db)):
    # 1. Fetch Project
    project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
    if not project:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 2. Call Screenwriter AI with assets extraction
    project_data = {
        "title": project.title,
        "genre": project.genre,
        "pitch": project.pitch,
        "visual_style": project.visual_style
    }
    
    result = await generate_scenes_with_assets(project_data)
    
    # 3. Create Characters in DB
    character_map = {}  # name -> CharacterDB
    for char_data in result.get("characters", []):
        char_name = char_data.get("name", "")
        if char_name and char_name not in character_map:
            new_char = CharacterDB(
                project_id=project.id,
                name=char_name,
                description=char_data.get("description", ""),
                traits=char_data.get("traits", ""),
                image_url=None  # Can be generated later
            )
            db.add(new_char)
            db.flush()  # Get ID without committing
            character_map[char_name] = new_char
    
    # 4. Create Locations in DB
    location_map = {}  # name -> LocationDB
    for loc_data in result.get("locations", []):
        loc_name = loc_data.get("name", "")
        if loc_name and loc_name not in location_map:
            new_loc = LocationDB(
                project_id=project.id,
                name=loc_name,
                description=loc_data.get("description", ""),
                ambiance=loc_data.get("ambiance", ""),
                image_url=None  # Can be generated later
            )
            db.add(new_loc)
            db.flush()  # Get ID without committing
            location_map[loc_name] = new_loc
    
    # 5. Create Scenes with associations
    new_scenes = []
    for i, scene_item in enumerate(result.get("scenes", [])):
        # Get location for this scene
        scene_location_name = scene_item.get("location_name", "")
        scene_location = location_map.get(scene_location_name)
        
        new_scene = SceneDB(
            project_id=project.id,
            sequence_order=i + 1,
            title=scene_item.get("title", f"Scene {i+1}"),
            summary=scene_item.get("summary", ""),
            estimated_duration=scene_item.get("estimated_duration", ""),
            status="pending",
            location_id=scene_location.id if scene_location else None
        )
        db.add(new_scene)
        db.flush()  # Get scene ID
        
        # Associate characters to this scene
        scene_char_names = scene_item.get("character_names", [])
        for char_name in scene_char_names:
            char = character_map.get(char_name)
            if char:
                # Insert into scene_characters association table
                from sqlalchemy import insert
                db.execute(
                    insert(scene_characters).values(
                        scene_id=new_scene.id,
                        character_id=char.id
                    )
                )
        
        new_scenes.append(new_scene)
    
    db.commit()
    
    # Refresh to get IDs and relations
    for s in new_scenes:
        db.refresh(s)
        
    return new_scenes

@app.post("/api/scenes/{scene_id}/generate-script", response_model=Scene)
async def generate_script_endpoint(scene_id: int, db: Session = Depends(get_db)):
    # 1. Fetch Scene and Project
    scene = db.query(SceneDB).filter(SceneDB.id == scene_id).first()
    if not scene:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Scene not found")
        
    project = db.query(ProjectDB).filter(ProjectDB.id == scene.project_id).first()
    
    # 2. Prepare Context
    project_context = {
        "title": project.title,
        "genre": project.genre,
        "visual_style": project.visual_style
    }
    
    # 3. Call Scriptwriter AI
    script_content = await generate_scene_script(scene.title, scene.summary, project_context)
    
    # 4. Update DB
    scene.script = script_content
    scene.status = "scripted"
    db.commit()
    db.refresh(scene)
    
    return scene

@app.post("/api/scenes/{scene_id}/generate-storyboard", response_model=Scene)
async def generate_storyboard_endpoint(scene_id: int, db: Session = Depends(get_db)):
    # 1. Fetch Scene
    scene = db.query(SceneDB).filter(SceneDB.id == scene_id).first()
    if not scene:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Scene not found")
        
    project = db.query(ProjectDB).filter(ProjectDB.id == scene.project_id).first()
    project_context = {
        "title": project.title,
        "genre": project.genre,
        "visual_style": project.visual_style
    }

    # 2. Generate Storyboard (Director Agent)
    # Use script if available, else summary
    base_text = scene.script if scene.script else scene.summary
    
    print(f"Generating storyboard for scene {scene_id}...")
    master_image_bytes = await generate_storyboard(base_text, project_context)
    
    if not master_image_bytes:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Failed to generate storyboard image")
        
    # 3. Slice Image into Shots
    print("Slicing master grid...")
    shot_urls, master_url = slice_grid_image(master_image_bytes, output_dir="static/shots", scene_id=scene_id)
    
    if not shot_urls:
         from fastapi import HTTPException
         raise HTTPException(status_code=500, detail="Failed to slice storyboard image")

    # Update Scene with master grid URL
    scene.master_image_url = master_url # will be saved on commit
    
    # 4. Update DB
    # Clear old shots
    db.query(ShotDB).filter(ShotDB.scene_id == scene_id).delete()
    
    new_shots = []
    for i, url in enumerate(shot_urls):
        shot = ShotDB(
            scene_id=scene_id,
            shot_number=i+1,
            visual_prompt=f"Shot {i+1} (Auto-generated from grid)",
            image_url=url, # URL is relative /static/shots/...
            status="done"
        )
        db.add(shot)
        new_shots.append(shot)
    
    scene.status = "storyboarded"
    db.commit()
    db.refresh(scene)
    
    return scene

@app.delete("/api/scenes/{scene_id}")
async def delete_scene_endpoint(scene_id: int, db: Session = Depends(get_db)):
    # Fetch Scene
    scene = db.query(SceneDB).filter(SceneDB.id == scene_id).first()
    if not scene:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Scene not found")
        
    db.delete(scene)
    db.commit()
    return {"message": "Scene deleted successfully"}

class ReorderScenesInput(BaseModel):
    ordered_ids: list[int]

@app.put("/api/projects/{project_id}/scenes/reorder")
async def reorder_scenes_endpoint(project_id: int, input_data: ReorderScenesInput, db: Session = Depends(get_db)):
    # Fetch all scenes for project
    scenes = db.query(SceneDB).filter(SceneDB.project_id == project_id).all()
    scene_map = {s.id: s for s in scenes}
    
    # Update sequence_order based on input list
    for index, scene_id in enumerate(input_data.ordered_ids):
        if scene_id in scene_map:
            scene_map[scene_id].sequence_order = index + 1
            
    db.commit()
    return {"message": "Scenes reordered successfully"}

# ========================================
# ASSET IMAGE GENERATION
# ========================================

class GenerateAssetImageInput(BaseModel):
    prompt: str
    type: str  # "character" or "location"
    name: str
    style: str | None = None

@app.post("/api/generate-asset-image")
async def generate_asset_image_endpoint(data: GenerateAssetImageInput):
    """Generate an image for a character or location using Gemini."""
    image_url = await generate_asset_image(data.prompt, data.type, data.name, data.style)
    
    if not image_url:
        raise HTTPException(status_code=500, detail="Image generation failed")
    
    return {"image_url": image_url}

# ========================================
# ASSET ENDPOINTS: Characters & Locations
# ========================================

# --- Characters CRUD ---
@app.get("/api/projects/{project_id}/characters", response_model=list[Character])
async def get_project_characters(project_id: int, db: Session = Depends(get_db)):
    characters = db.query(CharacterDB).filter(CharacterDB.project_id == project_id).all()
    return characters

@app.post("/api/projects/{project_id}/characters", response_model=Character)
async def create_character(project_id: int, data: CharacterBase, db: Session = Depends(get_db)):
    # Verify Project
    project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    new_char = CharacterDB(
        project_id=project_id,
        name=data.name,
        image_url=data.image_url
    )
    db.add(new_char)
    db.commit()
    db.refresh(new_char)
    return new_char

@app.delete("/api/characters/{character_id}")
async def delete_character(character_id: int, db: Session = Depends(get_db)):
    char = db.query(CharacterDB).filter(CharacterDB.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    db.delete(char)
    db.commit()
    return {"message": "Character deleted successfully"}

@app.put("/api/characters/{character_id}", response_model=Character)
async def update_character(character_id: int, data: CharacterBase, db: Session = Depends(get_db)):
    char = db.query(CharacterDB).filter(CharacterDB.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    
    if data.name is not None:
        char.name = data.name
    if data.image_url is not None:
        char.image_url = data.image_url
    if data.description is not None:
        char.description = data.description
    if data.traits is not None:
        char.traits = data.traits
    
    db.commit()
    db.refresh(char)
    return char

# --- Locations CRUD ---
@app.get("/api/projects/{project_id}/locations", response_model=list[Location])
async def get_project_locations(project_id: int, db: Session = Depends(get_db)):
    locations = db.query(LocationDB).filter(LocationDB.project_id == project_id).all()
    return locations

@app.post("/api/projects/{project_id}/locations", response_model=Location)
async def create_location(project_id: int, data: LocationBase, db: Session = Depends(get_db)):
    # Verify Project
    project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    new_loc = LocationDB(
        project_id=project_id,
        name=data.name,
        image_url=data.image_url
    )
    db.add(new_loc)
    db.commit()
    db.refresh(new_loc)
    return new_loc

@app.delete("/api/locations/{location_id}")
async def delete_location(location_id: int, db: Session = Depends(get_db)):
    loc = db.query(LocationDB).filter(LocationDB.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    db.delete(loc)
    db.commit()
    return {"message": "Location deleted successfully"}

@app.put("/api/locations/{location_id}", response_model=Location)
async def update_location(location_id: int, data: LocationBase, db: Session = Depends(get_db)):
    loc = db.query(LocationDB).filter(LocationDB.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    
    if data.name is not None:
        loc.name = data.name
    if data.image_url is not None:
        loc.image_url = data.image_url
    if data.description is not None:
        loc.description = data.description
    if data.ambiance is not None:
        loc.ambiance = data.ambiance
    
    db.commit()
    db.refresh(loc)
    return loc

# --- Scene-Character Association (Toggle) ---
@app.post("/api/scenes/{scene_id}/characters/{character_id}")
async def toggle_scene_character(scene_id: int, character_id: int, db: Session = Depends(get_db)):
    """Toggle character association with scene. If already linked, unlink. If not, link."""
    # Verify scene and character exist
    scene = db.query(SceneDB).filter(SceneDB.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    
    char = db.query(CharacterDB).filter(CharacterDB.id == character_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Check existing association using the Table
    from sqlalchemy import select, delete, insert
    existing = db.execute(
        select(scene_characters).where(
            scene_characters.c.scene_id == scene_id,
            scene_characters.c.character_id == character_id
        )
    ).first()
    
    if existing:
        # Unlink
        db.execute(
            delete(scene_characters).where(
                scene_characters.c.scene_id == scene_id,
                scene_characters.c.character_id == character_id
            )
        )
        db.commit()
        return {"action": "unlinked", "scene_id": scene_id, "character_id": character_id}
    else:
        # Link
        db.execute(
            insert(scene_characters).values(scene_id=scene_id, character_id=character_id)
        )
        db.commit()
        return {"action": "linked", "scene_id": scene_id, "character_id": character_id}

# --- Scene-Location Association (Set/Unset) ---
@app.post("/api/scenes/{scene_id}/location/{location_id}")
async def set_scene_location(scene_id: int, location_id: int, db: Session = Depends(get_db)):
    """Set scene location. If same location, unset it (toggle)."""
    scene = db.query(SceneDB).filter(SceneDB.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    
    loc = db.query(LocationDB).filter(LocationDB.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    
    if scene.location_id == location_id:
        # Toggle off
        scene.location_id = None
        db.commit()
        return {"action": "unset", "scene_id": scene_id, "location_id": None}
    else:
        # Set new location
        scene.location_id = location_id
        db.commit()
        return {"action": "set", "scene_id": scene_id, "location_id": location_id}

@app.delete("/api/scenes/{scene_id}/location")
async def unset_scene_location(scene_id: int, db: Session = Depends(get_db)):
    """Remove location from scene."""
    scene = db.query(SceneDB).filter(SceneDB.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    
    scene.location_id = None
    db.commit()
    return {"message": "Location removed from scene"}

@app.get("/")
async def root():
    return {"message": "Cutify Backend v0.6 is running"}

