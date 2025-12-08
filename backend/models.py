from pydantic import BaseModel

class ChatMessageInput(BaseModel):
    content: str
    # Later we will add projectId, sceneId, etc.

class ChatMessageOutput(BaseModel):
    id: str
    role: str # "agent"
    content: str
    timestamp: str
