from typing import Optional, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.chat import ChatMessage
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("")
async def chat(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = body.get("message", "")
    league_id = body.get("league_id")

    from app.services.chatbot import chat_with_ai
    reply = await chat_with_ai(db, message, current_user.id, league_id)
    return {"reply": reply}


@router.get("/history", response_model=List[dict])
def get_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(50)
        .all()
    )
    return [{"id": m.id, "role": m.role, "content": m.content, "created_at": str(m.created_at)} for m in messages]


@router.delete("/history")
def clear_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).delete()
    db.commit()
    return {"message": "History cleared"}
