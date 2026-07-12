"""
Routes pour gerer les abonnements aux notifications push (navigateur).
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.push_subscription import PushSubscription
from app.routers.auth import get_current_user
from app.config import get_settings

router = APIRouter(prefix="/api/push", tags=["push"])
settings = get_settings()


class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeRequest(BaseModel):
    endpoint: str
    keys: SubscriptionKeys


@router.get("/vapid-public-key")
def get_vapid_public_key():
    return {"publicKey": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe")
def subscribe(
    data: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Reserve aux admins")

    existing = db.query(PushSubscription).filter(PushSubscription.endpoint == data.endpoint).first()
    if existing:
        existing.p256dh = data.keys.p256dh
        existing.auth = data.keys.auth
        existing.user_id = current_user.id
    else:
        sub = PushSubscription(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            endpoint=data.endpoint,
            p256dh=data.keys.p256dh,
            auth=data.keys.auth,
        )
        db.add(sub)

    db.commit()
    return {"status": "subscribed"}


@router.post("/unsubscribe")
def unsubscribe(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    endpoint = data.get("endpoint")
    db.query(PushSubscription).filter(
        PushSubscription.endpoint == endpoint,
        PushSubscription.user_id == current_user.id,
    ).delete()
    db.commit()
    return {"status": "unsubscribed"}
