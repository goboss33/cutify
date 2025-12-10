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
from database import SessionLocal
from models import ProjectDB, Project, SceneDB, Scene, ShotDB, Shot
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

@app.post("/api/projects/{project_id}/generate-scenes", response_model=list[Scene])
async def generate_scenes_endpoint(project_id: int, db: Session = Depends(get_db)):
    # 1. Fetch Project
    project = db.query(ProjectDB).filter(ProjectDB.id == project_id).first()
    if not project:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 2. Call Screenwriter AI
    project_data = {
        "title": project.title,
        "genre": project.genre,
        "pitch": project.pitch,
        "visual_style": project.visual_style
    }
    
    scenes_data = await generate_scenes_breakdown(project_data)
    
    # 3. Save to DB
    new_scenes = []
    for i, scene_item in enumerate(scenes_data):
        new_scene = SceneDB(
            project_id=project.id,
            sequence_order=i + 1,
            title=scene_item.get("title", f"Scene {i+1}"),
            summary=scene_item.get("summary", ""),
            estimated_duration=scene_item.get("estimated_duration", ""),
            status="pending"
        )
        db.add(new_scene)
        new_scenes.append(new_scene)
        
    db.commit()
    
    # Refresh to get IDs
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

@app.get("/")
async def root():
    return {"message": "Cutify Backend v0.5 is running"}
