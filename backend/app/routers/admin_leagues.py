"""
Admin-only league management routes.
All routes require admin role.
"""
import uuid
import random
import string
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.league import League
from app.models.league_member import LeagueMember
from app.models.match import Match
from app.models.standing import Standing
from app.models.user import User
from app.models.result_claim import ResultClaim
from app.schemas.league import LeagueCreate, LeagueUpdate, LeagueResponse, MemberResponse
from app.schemas.match import MatchResponse, MatchAdminCreate, MatchAdminUpdate
from app.schemas.result_claim import ClaimResponse, ClaimReview
from app.schemas.user import UserResponse, UserUpdate
from app.routers.auth import require_admin, get_current_user
from app.services.calendar import generate_league_calendar
from app.services.scoring import resolve_champion, get_player_form
from app.config import get_settings
import shutil
import os
from fastapi import File, UploadFile

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _generate_join_code(db: Session, length: int = 6) -> str:
    while True:
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=length))
        if not db.query(League).filter(League.join_code == code).first():
            return code


def _league_response(league: League, db: Session) -> LeagueResponse:
    count = db.query(LeagueMember).filter(LeagueMember.league_id == league.id).count()
    r = LeagueResponse.model_validate(league)
    r.member_count = count
    return r


def _match_response(m: Match, db: Session) -> MatchResponse:
    home = db.query(User).filter(User.id == m.home_player_id).first()
    away = db.query(User).filter(User.id == m.away_player_id).first()
    data = MatchResponse.model_validate(m)
    data.home_player_name = home.username if home else "?"
    data.away_player_name = away.username if away else "?"
    return data


def _claim_response(claim: ResultClaim, db: Session) -> ClaimResponse:
    claimant = db.query(User).filter(User.id == claim.claimant_id).first()
    match = db.query(Match).filter(Match.id == claim.match_id).first()
    home = db.query(User).filter(User.id == match.home_player_id).first() if match else None
    away = db.query(User).filter(User.id == match.away_player_id).first() if match else None
    
    data = ClaimResponse.model_validate(claim)
    data.claimant_username = claimant.username if claimant else "?"
    data.home_player_name = home.username if home else "?"
    data.away_player_name = away.username if away else "?"
    return data


# ── League CRUD ────────────────────────────────────────────────────────────────

@router.post("/leagues", response_model=LeagueResponse)
def create_league(data: LeagueCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    join_code = _generate_join_code(db)
    league = League(
        id=str(uuid.uuid4()),
        name=data.name,
        description=data.description,
        join_code=join_code,
        max_members=data.max_members,
        created_by=admin.id,
        status="pending",
    )
    db.add(league)
    # Admin automatically joins the league they create
    db.flush()
    db.add(LeagueMember(id=str(uuid.uuid4()), league_id=league.id, user_id=admin.id))
    db.add(Standing(id=str(uuid.uuid4()), league_id=league.id, user_id=admin.id))
    db.commit()
    db.refresh(league)
    return _league_response(league, db)


@router.get("/leagues", response_model=list[LeagueResponse])
def list_leagues(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    leagues = db.query(League).order_by(League.created_at.desc()).all()
    return [_league_response(l, db) for l in leagues]


@router.get("/leagues/{league_id}", response_model=LeagueResponse)
def get_league(league_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    return _league_response(league, db)


@router.put("/leagues/{league_id}", response_model=LeagueResponse)
def update_league(league_id: str, data: LeagueUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    if data.name is not None:
        league.name = data.name
    if data.description is not None:
        league.description = data.description
    if data.status is not None:
        old_status = league.status
        league.status = data.status
        
        # Automatic match generation when activating
        if old_status == "pending" and data.status == "active":
            league.started_at = datetime.utcnow()
            members = db.query(LeagueMember).filter(LeagueMember.league_id == league.id).all()
            if len(members) >= 2:
                generate_league_calendar(db, league, members)
        
        # Reset league if reactivated from completed (New Session)
        if old_status == "completed" and data.status == "active":
            league.champion_id = None
            # Reset standings
            db.query(Standing).filter(Standing.league_id == league.id).update({
                "points": 0, "played": 0, "wins": 0, "draws": 0, "losses": 0,
                "goals_for": 0, "goals_against": 0, "goal_difference": 0
            }, synchronize_session=False)
            # Reset matches
            db.query(Match).filter(Match.league_id == league.id).update({
                "status": "pending", "home_score": 0, "away_score": 0
            }, synchronize_session=False)
            # Delete previous claims
            db.query(ResultClaim).filter(ResultClaim.league_id == league.id).delete(synchronize_session=False)
            
    if data.champion_id is not None:
        league.champion_id = data.champion_id
    db.commit()
    db.refresh(league)
    return _league_response(league, db)


@router.delete("/leagues/{league_id}")
def delete_league(league_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    db.delete(league)
    db.commit()
    return {"message": "League deleted"}


# ── League lifecycle ───────────────────────────────────────────────────────────

@router.post("/leagues/{league_id}/start", response_model=LeagueResponse)
def start_league(league_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    if league.status != "pending":
        raise HTTPException(status_code=400, detail="League is not pending")

    members = db.query(LeagueMember).filter(LeagueMember.league_id == league_id).all()
    if len(members) < 2:
        raise HTTPException(status_code=400, detail=f"Need at least 2 members to start, found {len(members)}")

    league.status = "active"
    league.started_at = datetime.utcnow()
    db.commit()

    generate_league_calendar(db, league, members)
    db.refresh(league)
    return _league_response(league, db)


@router.post("/leagues/{league_id}/complete", response_model=LeagueResponse)
def complete_league(league_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    if league.status != "active":
        raise HTTPException(status_code=400, detail="League is not active")
    resolve_champion(db, league)
    db.refresh(league)
    return _league_response(league, db)


# ── League members ─────────────────────────────────────────────────────────────

@router.get("/leagues/{league_id}/members", response_model=list[MemberResponse])
def list_members(league_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    memberships = db.query(LeagueMember).filter(LeagueMember.league_id == league_id).all()
    result = []
    for m in memberships:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            result.append(MemberResponse(
                id=m.id, user_id=user.id, username=user.username,
                avatar_url=user.avatar_url, joined_at=m.joined_at,
                is_lord=user.is_lord, total_trophies=user.total_trophies,
            ))
    return result


@router.delete("/leagues/{league_id}/members/{user_id}")
def remove_member(league_id: str, user_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    member = db.query(LeagueMember).filter(
        LeagueMember.league_id == league_id, LeagueMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()
    return {"message": "Member removed"}


# ── League matches ─────────────────────────────────────────────────────────────

@router.get("/leagues/{league_id}/matches", response_model=list[MatchResponse])
def list_matches(league_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    matches = db.query(Match).filter(Match.league_id == league_id).order_by(Match.match_day).all()
    return [_match_response(m, db) for m in matches]


@router.get("/matches", response_model=list[MatchResponse])
def list_all_matches(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    matches = db.query(Match).order_by(Match.created_at.desc()).all()
    return [_match_response(m, db) for m in matches]


@router.post("/matches", response_model=MatchResponse)
def create_match(data: MatchAdminCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    match = Match(id=str(uuid.uuid4()), league_id=data.league_id,
                  home_player_id=data.home_player_id, away_player_id=data.away_player_id,
                  match_day=data.match_day)
    db.add(match)
    db.commit()
    db.refresh(match)
    return _match_response(match, db)


@router.put("/matches/{match_id}", response_model=MatchResponse)
def update_match(match_id: str, data: MatchAdminUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    if data.home_player_id is not None:
        match.home_player_id = data.home_player_id
    if data.away_player_id is not None:
        match.away_player_id = data.away_player_id
    if data.home_score is not None:
        match.home_score = data.home_score
    if data.away_score is not None:
        match.away_score = data.away_score
    if data.match_day is not None:
        match.match_day = data.match_day
    if data.status is not None:
        match.status = data.status
    db.commit()
    db.refresh(match)
    return _match_response(match, db)


@router.delete("/matches/{match_id}")
def delete_match(match_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    db.delete(match)
    db.commit()
    return {"message": "Match deleted"}


# ── Claims management ──────────────────────────────────────────────────────────

@router.get("/claims", response_model=list[ClaimResponse])
def list_claims(
    status_filter: Optional[str] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(ResultClaim)
    if status_filter:
        q = q.filter(ResultClaim.status == status_filter)
    claims = q.order_by(ResultClaim.created_at.desc()).all()
    return [_claim_response(c, db) for c in claims]


@router.put("/claims/{claim_id}/approve", response_model=ClaimResponse)
async def approve_claim(
    claim_id: str,
    review: ClaimReview,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    claim = db.query(ResultClaim).filter(ResultClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.status != "pending":
        raise HTTPException(status_code=400, detail="Claim already reviewed")

    claim.status = "approved"
    claim.admin_note = review.admin_note
    claim.reviewed_at = datetime.utcnow()
    claim.reviewed_by = admin.id
    db.commit()
    
    # Create notification for user
    from app.models.notification import Notification
    notif = Notification(
        id=str(uuid.uuid4()),
        user_id=claim.claimant_id,
        title="Claim Approved ✅",
        message=f"Your claim for Match Day {claim.match.match_day} has been approved. +{claim.points_awarded} pts have been added."
    )
    db.add(notif)
    db.commit()

    # Award points
    from app.services.scoring import award_points_from_claim
    award_points_from_claim(db, claim)

    # Award badges
    from app.services.badges import check_and_award_badges
    check_and_award_badges(db, claim.claimant_id, claim.league_id)

    # Check for league completion
    from app.services.league_lifecycle import check_league_completion
    await check_league_completion(db, claim.league_id)

    # AI advice for this player (fire-and-forget)
    try:
        from app.services.chatbot import get_ai_advice_for_user
        await get_ai_advice_for_user(db, claim.claimant_id, claim.league_id)
    except Exception:
        pass

    db.refresh(claim)
    return _claim_response(claim, db)


@router.put("/claims/{claim_id}/reject", response_model=ClaimResponse)
def reject_claim(
    claim_id: str,
    review: ClaimReview,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    claim = db.query(ResultClaim).filter(ResultClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.status != "pending":
        raise HTTPException(status_code=400, detail="Claim already reviewed")

    claim.status = "rejected"
    claim.admin_note = review.admin_note
    claim.reviewed_at = datetime.utcnow()
    claim.reviewed_by = admin.id
    db.commit()
    
    # Create notification for user
    from app.models.notification import Notification
    notif = Notification(
        id=str(uuid.uuid4()),
        user_id=claim.claimant_id,
        title="Claim Rejected ❌",
        message=f"Your claim for Match Day {claim.match.match_day} has been rejected. Note: {review.admin_note or 'No reason specified'}"
    )
    db.add(notif)
    db.commit()
    
    db.refresh(claim)
    return _claim_response(claim, db)


# ── User management ────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserResponse])
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return [UserResponse.model_validate(u) for u in db.query(User).all()]


@router.post("/users", response_model=UserResponse)
def create_user(data: UserUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    # UserUpdate schema might not be perfect for creation (needs password)
    # But let's assume we use it or a similar one. 
    # Actually UserUpdate has Optional fields.
    from app.routers.auth import pwd_context
    user = User(
        id=str(uuid.uuid4()),
        username=data.username,
        email=data.email,
        hashed_password=pwd_context.hash("efootball2024"), # Default password
        role=data.role or "user",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse.model_validate(user)


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(user_id: str, data: UserUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if data.username is not None:
        user.username = data.username
    if data.email is not None:
        user.email = data.email
    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("/users/{user_id}")
def delete_user(user_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin account")
    
    # Delete related records first to avoid FK errors
    db.query(LeagueMember).filter(LeagueMember.user_id == user_id).delete()
    db.query(Standing).filter(Standing.user_id == user_id).delete()
    
    db.delete(user)
    db.commit()
    return {"message": "User deleted completely from database"}


@router.post("/users/{user_id}/avatar")
async def update_user_avatar(
    user_id: str,
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    settings = get_settings()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"avatar_{user.id}_{uuid.uuid4().hex[:8]}.{file_ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    user.avatar_url = f"/uploads/{filename}"
    db.commit()
    
    return {"avatar_url": user.avatar_url}


# ── League standings (admin view) ──────────────────────────────────────────────

@router.get("/leagues/{league_id}/standings")
def get_standings(league_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.schemas.standing import StandingResponse
    standings = (
        db.query(Standing)
        .filter(Standing.league_id == league_id)
        .order_by(Standing.points.desc(), Standing.wins.desc())
        .all()
    )
    result = []
    for s in standings:
        user = db.query(User).filter(User.id == s.user_id).first()
        form = get_player_form(db, s.user_id, league_id)
        data = StandingResponse.model_validate(s)
        data.username = user.username if user else "?"
        data.avatar_url = user.avatar_url if user else ""
        data.form = form
        result.append(data)
    return result
