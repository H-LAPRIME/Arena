from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.standing import Standing
from app.models.result_claim import ResultClaim
from app.models.league_member import LeagueMember
from app.schemas.user import UserResponse
from app.routers.auth import get_current_user
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse
import shutil
import os
import uuid
from fastapi import File, UploadFile
from app.config import get_settings
import bcrypt

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me/profile")
def get_my_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Full profile: user info + all-league stats + badges."""
    memberships = db.query(LeagueMember).filter(LeagueMember.user_id == current_user.id).all()
    all_standings = db.query(Standing).filter(Standing.user_id == current_user.id).all()

    total_points = sum(s.points for s in all_standings)
    total_wins = sum(s.wins for s in all_standings)
    total_draws = sum(s.draws for s in all_standings)
    total_losses = sum(s.losses for s in all_standings)
    total_played = sum(s.played for s in all_standings)

    badges = [{"name": b.badge_name, "description": b.description, "earned_at": str(b.earned_at)}
              for b in current_user.badges]

    return {
        "user": UserResponse.model_validate(current_user),
        "leagues_joined": len(memberships),
        "career_stats": {
            "total_played": total_played,
            "total_wins": total_wins,
            "total_draws": total_draws,
            "total_losses": total_losses,
            "total_points": total_points,
            "total_trophies": current_user.total_trophies,
            "is_lord": current_user.is_lord,
        },
        "badges": badges,
    }


@router.get("", response_model=List[UserResponse])
def list_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List active users. Admins see all; regular users only see those in their leagues."""
    if current_user.role == "admin":
        users = db.query(User).filter(User.is_active == True).all()
    else:
        # Get IDs of all leagues the current user is in
        my_league_ids = db.query(LeagueMember.league_id).filter(LeagueMember.user_id == current_user.id).all()
        my_league_ids = [lid for (lid,) in my_league_ids]
        
        # Get all users who share at least one of those leagues
        users = (
            db.query(User)
            .join(LeagueMember, User.id == LeagueMember.user_id)
            .filter(LeagueMember.league_id.in_(my_league_ids), User.is_active == True)
            .distinct()
            .all()
        )
    return [UserResponse.model_validate(u) for u in users]


@router.get("/grouped-by-league")
def get_users_grouped_by_league(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns a list of leagues, each with its members. Admins see all; users see only theirs."""
    from app.models.league import League
    
    if current_user.role == "admin":
        leagues = db.query(League).all()
    else:
        # Get all leagues the current user is a member of
        leagues = (
            db.query(League)
            .join(LeagueMember, League.id == LeagueMember.league_id)
            .filter(LeagueMember.user_id == current_user.id)
            .all()
        )
    
    result = []
    for league in leagues:
        members = (
            db.query(User)
            .join(LeagueMember, User.id == LeagueMember.user_id)
            .filter(LeagueMember.league_id == league.id)
            .all()
        )
        result.append({
            "league_id": league.id,
            "league_name": league.name,
            "status": league.status,
            "created_by": league.created_by,
            "members": [UserResponse.model_validate(m) for m in members]
        })
    
    return result


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse.model_validate(user)


@router.get("/me/notifications", response_model=List[NotificationResponse])
def get_my_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notifs = db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).limit(20).all()
    return [NotificationResponse.model_validate(n) for n in notifs]


@router.put("/me/notifications/{notif_id}/read")
def mark_notification_read(notif_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notif_id, Notification.user_id == current_user.id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"message": "Marked as read"}


@router.put("/me/notifications/read-all")
def mark_all_notifications_read(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).update({Notification.is_read: True})
    db.commit()
    return {"message": "All marked as read"}


@router.delete("/me/notifications/{notif_id}")
def delete_notification(notif_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notif_id, Notification.user_id == current_user.id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(notif)
    db.commit()
    return {"message": "Notification deleted"}


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    settings = get_settings()
    
    # 1. Prepare filename
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"avatar_{current_user.id}_{uuid.uuid4().hex[:8]}.{file_ext}"
    
    # 2. Upload to Supabase
    try:
        from supabase import create_client, Client
        supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
        
        # Read file content
        file_content = await file.read()
        
        # Upload
        supabase.storage.from_("avatars").upload(
            path=filename,
            file=file_content,
            file_options={"content-type": file.content_type}
        )
        
        # 3. Get Public URL
        # Format: https://[ref].supabase.co/storage/v1/object/public/avatars/[filename]
        public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/avatars/{filename}"
        
        current_user.avatar_url = public_url
        db.commit()
        
        return {"avatar_url": current_user.avatar_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to Cloud: {str(e)}")


@router.put("/me")
def update_my_profile(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if "username" in data and data["username"]:
        existing = db.query(User).filter(User.username == data["username"]).first()
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = data["username"]
    
    if "password" in data and data["password"]:
        # Verify old password
        old_password = data.get("old_password")
        if not old_password:
            raise HTTPException(status_code=400, detail="Ancien mot de passe requis pour changer le mot de passe")
        
        if not bcrypt.checkpw(old_password.encode("utf-8"), current_user.password_hash.encode("utf-8")):
            raise HTTPException(status_code=400, detail="L'ancien mot de passe est incorrect")

        if len(data["password"]) < 6:
            raise HTTPException(status_code=400, detail="Le nouveau mot de passe est trop court (min 6)")
            
        current_user.password_hash = bcrypt.hashpw(data["password"].encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    
    db.commit()
    return UserResponse.model_validate(current_user)
