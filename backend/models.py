from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime
from database import Base

# --- SQLAlchemy Models ---
class ProjectDB(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    genre = Column(String)
    pitch = Column(Text)
    visual_style = Column(Text)
    target_audience = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="concept")

# --- Pydantic Schemas ---
class ChatMessageInput(BaseModel):
    content: str
    # Later we will add projectId, sceneId, etc.

class ChatMessageOutput(BaseModel):
    id: str
    role: str # "agent"
    content: str
    timestamp: str

class ProjectBase(BaseModel):
    title: str
    genre: str | None = None
    pitch: str | None = None
    visual_style: str | None = None
    target_audience: str | None = None
    status: str = "concept"

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
