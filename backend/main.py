import asyncio
import uuid
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.models import ChatMessageInput, ChatMessageOutput

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

from backend.services.ai_service import generate_showrunner_response

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

from backend.services.concept_extractor import extract_concept_from_chat

@app.post("/api/extract-concept")
async def extract_concept_endpoint():
    # Convert history to string
    history_str = ""
    for msg in chat_history:
        role = msg.get("role", "unknown")
        text = msg.get("parts", [""])[0]
        history_str += f"{role.upper()}: {text}\n"
    
    concept = await extract_concept_from_chat(history_str)
    return concept

@app.get("/")
async def root():
    return {"message": "Cutify Backend v0.4 is running"}
