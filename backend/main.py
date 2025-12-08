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
from models import ChatMessageInput, ChatMessageOutput

print("DEBUG: Creating FastAPI app...")
# Create Tables if not exist
from database import engine, Base
Base.metadata.create_all(bind=engine)

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

# In-Memory Chat History
chat_history = []

@app.post("/api/chat", response_model=ChatMessageOutput)
async def chat_endpoint(message: ChatMessageInput):
    # Pass history to AI Service
    # Note: We append the new user message *after* context is established? 
    # Actually, Gemini start_chat expects history of PREVIOUS turns.
    # So we pass current `chat_history`.
    
    response_content = await generate_showrunner_response(message.content, chat_history)
    
    # Update History
    chat_history.append({"role": "user", "parts": [message.content]})
    chat_history.append({"role": "model", "parts": [response_content]})
    
    return ChatMessageOutput(
        id=str(uuid.uuid4()),
        role="agent",
        content=response_content,
        timestamp=datetime.now().isoformat()
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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from fastapi import Depends
from sqlalchemy.orm import Session

from models import ExtractConceptInput

@app.post("/api/extract-concept", response_model=Project)
async def extract_concept_endpoint(payload: ExtractConceptInput, db: Session = Depends(get_db)):
    print(f"DEBUG: extract_concept called with {len(payload.messages)} messages")
    # Convert history from payload to string
    history_str = ""
    # Payload messages are likely from frontend: {senderId, text, ...}
    # We need to map them. frontend "senderId"='user' or 'agent'
    
    for msg in payload.messages:
        role = "USER" if msg.get("senderId") != "agent" else "AGENT"
        text = msg.get("text", "")
        history_str += f"{role}: {text}\n"
    
    concept_dict = await extract_concept_from_chat(history_str)
    
    # Save to DB
    # Note: concept_dict might not match ProjectDB exactly if keys differ. 
    # concept_extractor usually returns dict with keys like 'title', 'pitch', etc.
    # We should map them safely.
    
    new_project = ProjectDB(
        title=concept_dict.get("title", "Untitled Project"),
        genre=concept_dict.get("genre"),
        pitch=concept_dict.get("pitch"),
        visual_style=concept_dict.get("visual_style"),
        target_audience=concept_dict.get("target_audience"),
        status="concept"
    )
    
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    
    return new_project

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

@app.get("/")
async def root():
    return {"message": "Cutify Backend v0.5 is running"}
