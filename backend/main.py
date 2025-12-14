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
from models import ProjectDB, Project, SceneDB, Scene, ShotDB, Shot, CharacterDB, LocationDB, scene_characters, Character, Location, CharacterBase, LocationBase, CategoryPresetDB
from fastapi.staticfiles import StaticFiles

# Mount static directory
# Ensure directory exists first
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


# --- Category Preset Pydantic Schema ---
class CategoryPreset(BaseModel):
    id: int
    slug: str
    name: str
    icon: str
    description: str | None = None
    thumbnail_url: str | None = None
    default_aspect_ratio: str = "16:9"
    default_duration: int = 60
    default_language: str = "French"
    default_visual_style: str | None = None
    is_active: bool = True

    class Config:
        from_attributes = True

# --- Category Presets Endpoint ---
@app.get("/api/category-presets", response_model=list[CategoryPreset])
async def get_category_presets(db: Session = Depends(get_db)):
    """Get all active category presets."""
    presets = db.query(CategoryPresetDB).filter(CategoryPresetDB.is_active == True).all()
    return presets


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
    title: str = "Untitled Project"
    genre: str | None = None
    pitch: str | None = ""
    visual_style: str | None = ""
    target_audience: str | None = ""
    language: str = "French"
    target_duration: str = "60s"
    aspect_ratio: str = "16:9"
    category_preset_id: int | None = None
    detected_tags: list[str] = []
    ai_answers: dict = {}

@app.post("/api/projects", response_model=Project)
async def create_project_endpoint(project_data: ProjectCreate, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    # If category_preset_id is provided, fetch defaults from preset
    preset = None
    if project_data.category_preset_id:
        preset = db.query(CategoryPresetDB).filter(CategoryPresetDB.id == project_data.category_preset_id).first()
    
    # Use preset defaults if available, otherwise use provided values
    language = project_data.language
    aspect_ratio = project_data.aspect_ratio
    target_duration = project_data.target_duration
    visual_style = project_data.visual_style
    genre = project_data.genre
    
    if preset:
        language = language or preset.default_language
        aspect_ratio = aspect_ratio or preset.default_aspect_ratio
        target_duration = target_duration or f"{preset.default_duration}s"
        visual_style = visual_style or preset.default_visual_style
        genre = genre or preset.name  # Use preset name as genre if not provided
    
    # Build onboarding context JSON
    import json
    onboarding_context = None
    if project_data.detected_tags or project_data.ai_answers:
        onboarding_context = json.dumps({
            "detected_tags": project_data.detected_tags,
            "ai_answers": project_data.ai_answers
        })
    
    new_project = ProjectDB(
        title=project_data.title,
        genre=genre,
        pitch=project_data.pitch,
        visual_style=visual_style,
        target_audience=project_data.target_audience,
        language=language,
        target_duration=target_duration,
        aspect_ratio=aspect_ratio,
        status="concept",
        user_id=user_id,
        category_preset_id=project_data.category_preset_id,
        onboarding_context=onboarding_context,
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

# V5 Pipeline import
from services.pipeline_v5 import run_pipeline_v5

@app.post("/api/projects/{project_id}/generate-scenes", response_model=list[Scene])
async def generate_scenes_endpoint(project_id: int, db: Session = Depends(get_db)):
    """
    V5 Pipeline: Dynamic templates based on video type
    """
    # 1. Fetch Project
    project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 2. Determine video type from preset
    video_type = "cinematic"  # Default
    if project.category_preset:
        video_type = project.category_preset.slug or "cinematic"
    
    # 3. Parse onboarding context
    onboarding_context = {}
    if project.onboarding_context:
        try:
            onboarding_context = json_lib.loads(project.onboarding_context)
        except:
            pass
    
    # 4. Parse target duration
    target_duration_seconds = 60
    if project.target_duration:
        try:
            duration_str = project.target_duration.lower().strip()
            if "min" in duration_str:
                minutes = int(duration_str.replace("mins", "").replace("min", "").strip())
                target_duration_seconds = minutes * 60
            elif "s" in duration_str:
                target_duration_seconds = int(duration_str.replace("s", "").strip())
            else:
                target_duration_seconds = int(duration_str)
        except:
            pass
    
    # 5. Build inputs for pipeline
    inputs = {
        "title": project.title or "Untitled",
        "pitch": project.pitch or "",
        "visual_style": project.visual_style or "",
        "duration_seconds": target_duration_seconds,
        "language": project.language or "French",
        "detected_tags": onboarding_context.get("detected_tags", []),
        "user_answers": onboarding_context.get("ai_answers", {})
    }
    
    # 6. Get existing assets
    existing_assets = []
    for char in project.characters:
        existing_assets.append({
            "id": char.id, 
            "type": "character", 
            "name": char.name, 
            "description": char.description or ""
        })
    for loc in project.locations:
        existing_assets.append({
            "id": loc.id, 
            "type": "location", 
            "name": loc.name, 
            "description": loc.description or ""
        })
    
    # ═══════════════════════════════════════════════════
    # RUN V5 PIPELINE
    # ═══════════════════════════════════════════════════
    result = await run_pipeline_v5(
        project_id=project_id,
        video_type=video_type,
        inputs=inputs,
        existing_assets=existing_assets,
        db=db
    )
    
    scenes_data = result.get("scenes", [])
    validation = result.get("validation", {})
    
    if not validation.get("valid", True):
        print(f"Validation errors: {validation.get('errors', [])}")
    
    # ═══════════════════════════════════════════════════
    # SAVE SCENES TO DB
    # ═══════════════════════════════════════════════════
    # Refresh project to get newly created assets
    db.refresh(project)
    
    # Build maps for associations
    location_map = {loc.name.lower(): loc for loc in project.locations}
    character_map = {char.name.lower(): char for char in project.characters}
    
    new_scenes = []
    for i, scene_item in enumerate(scenes_data):
        # Get location
        scene_location_name = scene_item.get("location_name", "")
        scene_location = location_map.get(scene_location_name.lower()) if scene_location_name else None
        
        # Get duration
        duration_seconds = scene_item.get("duration_seconds", 15)
        estimated_duration = f"~{duration_seconds}s"
        
        new_scene = SceneDB(
            project_id=project.id,
            sequence_order=scene_item.get("index", i + 1),
            title=scene_item.get("title", f"Scene {i+1}"),
            summary=scene_item.get("summary", ""),
            estimated_duration=estimated_duration,
            status="pending",
            location_id=scene_location.id if scene_location else None
        )
        db.add(new_scene)
        db.flush()
        
        # Associate characters
        for char_name in scene_item.get("character_names", []):
            char = character_map.get(char_name.lower())
            if char:
                from sqlalchemy import insert
                db.execute(
                    insert(scene_characters).values(
                        scene_id=new_scene.id,
                        character_id=char.id
                    )
                )
        
        new_scenes.append(new_scene)
    
    db.commit()
    
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
    script_content = await generate_scene_script(scene.title, scene.summary, project_context, project_id=project.id)
    
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

    # 2. Gather Assets (Images)
    assets = []
    
    # Location
    if scene.location and scene.location.image_url:
        path = scene.location.image_url
        if path.startswith("/"):
            path = path[1:] # Remove leading slash
            
        if os.path.exists(path):
            assets.append({
                "type": "location",
                "name": scene.location.name,
                "image_path": path
            })
            
    # Characters
    if scene.characters:
        for char in scene.characters:
            if char.image_url:
                path = char.image_url
                if path.startswith("/"):
                    path = path[1:]
                
                if os.path.exists(path):
                    assets.append({
                        "type": "character",
                        "name": char.name,
                        "image_path": path
                    })

    # 3. Generate Storyboard (Director Agent)
    # Use script if available, else summary
    base_text = scene.script if scene.script else scene.summary
    
    print(f"Generating storyboard for scene {scene_id} with {len(assets)} reference assets...")
    master_image_bytes, log_id = await generate_storyboard(base_text, project_context, assets, project_id=project.id)
    
    if not master_image_bytes:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Failed to generate storyboard image")
        
    # 3. Slice Image into Shots
    print("Slicing master grid...")
    shot_urls, master_url = slice_grid_image(master_image_bytes, output_dir="static/shots", scene_id=scene_id)
    
    # Log Success with Image
    if log_id:
        AILogger.update_interaction(
            log_id=log_id,
            response="Storyboard grid generated and sliced.",
            images=[master_url]
        )
    
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
    project_id: int | None = None

@app.post("/api/generate-asset-image")
async def generate_asset_image_endpoint(data: GenerateAssetImageInput):
    """Generate an image for a character or location using Gemini."""
    image_url = await generate_asset_image(data.prompt, data.type, data.name, data.style, project_id=data.project_id)
    
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

# ========================================
# ONBOARDING AI ENDPOINTS
# ========================================
from services.onboarding_ai import analyze_pitch, generate_questions

class AnalyzePitchInput(BaseModel):
    pitch: str
    category_slug: str

@app.post("/api/onboarding/analyze-pitch")
async def analyze_pitch_endpoint(data: AnalyzePitchInput):
    """Analyze pitch and extract tags in real-time."""
    result = await analyze_pitch(data.pitch, data.category_slug)
    return result

# ========================================
# CASTING CALL ENDPOINT
# ========================================
from services.casting_director import run_casting_call, auto_create_missing_assets
import json as json_lib

@app.post("/api/projects/{project_id}/casting-call")
async def casting_call_endpoint(
    project_id: int,
    auto_create: bool = False,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user)
):
    """Run casting call to match assets to narrative roles."""
    # Get project
    project = db.query(ProjectDB).filter(ProjectDB.id == project_id, ProjectDB.user_id == user_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get category slug
    category_slug = "general"
    if project.category_preset:
        category_slug = project.category_preset.slug
    
    # Parse onboarding context
    onboarding_context = {}
    if project.onboarding_context:
        try:
            onboarding_context = json_lib.loads(project.onboarding_context)
        except:
            pass
    
    # Get existing assets
    existing_assets = []
    for char in project.characters:
        existing_assets.append({
            "id": char.id,
            "type": "character",
            "name": char.name,
            "description": char.description or ""
        })
    for loc in project.locations:
        existing_assets.append({
            "id": loc.id,
            "type": "location", 
            "name": loc.name,
            "description": loc.description or ""
        })
    
    # Run casting call
    result = await run_casting_call(
        project_id=project_id,
        pitch=project.pitch or "",
        category_slug=category_slug,
        onboarding_context=onboarding_context,
        existing_assets=existing_assets
    )
    
    # Auto-create missing assets if requested
    if auto_create and result.get("missing_roles"):
        created = await auto_create_missing_assets(project_id, result["missing_roles"], db)
        result["created_assets"] = created
    
    return result
class GenerateQuestionsInput(BaseModel):
    title: str = ""
    pitch: str
    category_slug: str
    detected_tags: list[str] = []
    existing_answers: dict = {}

@app.post("/api/onboarding/generate-questions")
async def generate_questions_endpoint(data: GenerateQuestionsInput):
    """Generate dynamic follow-up questions based on pitch and category."""
    result = await generate_questions(
        data.title,
        data.pitch,
        data.category_slug,
        data.detected_tags,
        data.existing_answers
    )
    return result

# --- Debug Endpoints ---
from services.ai_logger import AILogger

@app.get("/api/debug/ai-logs")
async def get_ai_logs(project_id: int = None, limit: int = 50):
    """Get AI logs, optionally filtered by project_id."""
    return AILogger.get_logs(project_id=project_id, limit=limit)

@app.delete("/api/debug/ai-logs")
async def clear_ai_logs(project_id: int = None):
    """Clear AI logs, optionally only for a specific project."""
    AILogger.clear_logs(project_id=project_id)
    return {"status": "cleared"}

# --- Template Editor Endpoints ---
from services.template_loader import get_all_templates, save_template, delete_template, create_template

@app.get("/api/templates")
async def list_templates():
    """List all available prompt templates."""
    return get_all_templates()

@app.get("/api/templates/{slug}")
async def get_template(slug: str):
    """Get a specific template by slug."""
    from services.template_loader import load_template
    template = load_template(slug)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"slug": slug, "full_template": template}

class TemplateUpdate(BaseModel):
    template: dict

@app.put("/api/templates/{slug}")
async def update_template(slug: str, data: TemplateUpdate):
    """Update a template."""
    success = save_template(slug, data.template)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save template")
    return {"status": "updated", "slug": slug}

class TemplateCreate(BaseModel):
    slug: str
    template: dict

@app.post("/api/templates")
async def create_new_template(data: TemplateCreate):
    """Create a new template."""
    success = create_template(data.slug, data.template)
    if not success:
        raise HTTPException(status_code=400, detail="Template already exists or invalid")
    return {"status": "created", "slug": data.slug}

@app.delete("/api/templates/{slug}")
async def remove_template(slug: str):
    """Delete a template (protected templates cannot be deleted)."""
    success = delete_template(slug)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot delete protected template or template not found")
    return {"status": "deleted", "slug": slug}

@app.get("/api/templates/variables/all")
async def get_all_variables():
    """Get all available variables for templates."""
    return {
        "context_analyzer": [
            {"name": "title", "description": "Titre du projet", "example": "La Cigale et la Fourmi"},
            {"name": "pitch", "description": "Description/pitch du projet", "example": "Un dessin animé pour enfants..."},
            {"name": "visual_style", "description": "Style visuel demandé", "example": "Cinematic"},
            {"name": "duration", "description": "Durée en secondes", "example": "180"},
            {"name": "tags_str", "description": "Tags détectés", "example": "Fable, Enfant, Animation"},
            {"name": "answers_str", "description": "Réponses utilisateur", "example": "Leçon morale, 10 ans"},
        ],
        "scene_planner": [
            {"name": "visual_style", "description": "Style fusionné", "example": "Ghibli + Cinematic"},
            {"name": "tone", "description": "Ton déduit", "example": "Conte moral"},
            {"name": "target_duration", "description": "Durée cible", "example": "180"},
            {"name": "suggested_count", "description": "Nombre de scènes suggéré", "example": "12"},
            {"name": "characters", "description": "Personnages détectés", "example": "La Cigale, La Fourmi"},
            {"name": "locations", "description": "Lieux détectés", "example": "Champ, Fourmilière"},
            {"name": "narrative_arc", "description": "Type d'arc narratif", "example": "fable"},
        ],
        "asset_reconciler": [
            {"name": "visual_style", "description": "Style fusionné", "example": "Ghibli + Cinematic"},
            {"name": "characters", "description": "Personnages à gérer", "example": "La Cigale, La Fourmi"},
            {"name": "locations", "description": "Lieux à gérer", "example": "Champ, Fourmilière"},
            {"name": "existing_assets", "description": "Assets existants formatés", "example": "ID:1 [character] \"La Cigale\""},
        ],
        "screenwriter": [
            {"name": "title", "description": "Titre", "example": "La Cigale et la Fourmi"},
            {"name": "pitch", "description": "Pitch", "example": "Un dessin animé..."},
            {"name": "visual_style", "description": "Style fusionné", "example": "Ghibli + Cinematic"},
            {"name": "tone", "description": "Ton", "example": "Conte moral"},
            {"name": "target_duration", "description": "Durée cible", "example": "180"},
            {"name": "scene_plan", "description": "Plan de scènes formaté", "example": "Scène 1: setup (15s)..."},
            {"name": "characters", "description": "Personnages disponibles", "example": "La Cigale, La Fourmi"},
            {"name": "locations", "description": "Lieux disponibles", "example": "Champ, Fourmilière"},
        ]
    }

@app.get("/")
async def root():
    return {"message": "Cutify Backend v0.8 - Template Editor"}

