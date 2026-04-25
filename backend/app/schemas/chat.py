from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    auto_generated: bool = False


class ChatMessageResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True
