"""
Routes reserved for the WhatsApp bot.

The bot does not know player passwords or JWTs. It authenticates with a shared
secret and resolves the player account from User.whatsapp_phone.
"""
import os
import secrets
import uuid
from typing import List, Optional
from app.utils.push import send_push_to_admins

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from sqlalchemy.orm import Session
from supabase import Client, create_client

from app.config import get_settings
from app.database import get_db
from app.models.match import Match
from app.models.result_claim import ResultClaim
from app.models.user import User
from app.schemas.match import MatchResponse
from app.schemas.result_claim import ClaimResponse

router = APIRouter(prefix="/api/bot", tags=["bot"])
settings = get_settings()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024


def verify_bot_secret(x_bot_secret: Optional[str] = Header(None)):
    configured_secret = settings.BOT_SHARED_SECRET
    if not configured_secret or not x_bot_secret:
        raise HTTPException(status_code=401, detail="Invalid bot secret")
    if not secrets.compare_digest(x_bot_secret, configured_secret):
        raise HTTPException(status_code=401, detail="Invalid bot secret")


def _get_user_by_phone(phone: str, db: Session) -> User:
    clean_phone = phone.strip()
    user = db.query(User).filter(User.whatsapp_phone == clean_phone).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="WhatsApp number is not linked to an account",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return user


def _match_response(match: Match, db: Session) -> MatchResponse:
    home = db.query(User).filter(User.id == match.home_player_id).first()
    away = db.query(User).filter(User.id == match.away_player_id).first()
    data = MatchResponse.model_validate(match)
    data.home_player_name = home.username if home else "?"
    data.away_player_name = away.username if away else "?"
    data.home_player_avatar = home.avatar_url if home else ""
    data.away_player_avatar = away.avatar_url if away else ""
    return data


def _claim_response(claim: ResultClaim, user: User) -> ClaimResponse:
    data = ClaimResponse.model_validate(claim)
    data.claimant_username = user.username
    return data


async def _store_screenshot(screenshot: UploadFile, user_id: str, match_id: str) -> str:
    if not screenshot or not screenshot.filename:
        raise HTTPException(status_code=400, detail="Screenshot is required as proof")

    ext = os.path.splitext(screenshot.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Screenshot must be JPG, PNG, GIF, or WebP")

    content = await screenshot.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Screenshot must be under 10 MB")

    try:
        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
            filename = f"{user_id}_{match_id}_{uuid.uuid4().hex[:8]}{ext}"
            supabase.storage.from_("claims").upload(
                path=filename,
                file=content,
                file_options={"content-type": screenshot.content_type},
            )
            return f"{settings.SUPABASE_URL}/storage/v1/object/public/claims/{filename}"

        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        filename = f"claim_{user_id}_{match_id}_{uuid.uuid4().hex[:8]}{ext}"
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
        with open(file_path, "wb") as f:
            f.write(content)
        return f"/uploads/{filename}"
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to upload screenshot: {exc}")


@router.get("/matches", response_model=List[MatchResponse])
def bot_get_pending_matches(
    phone: str,
    league_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _: None = Depends(verify_bot_secret),
):
    user = _get_user_by_phone(phone, db)

    query = db.query(Match).filter(
        (Match.home_player_id == user.id) | (Match.away_player_id == user.id),
        Match.status != "played",
    )
    if league_id:
        query = query.filter(Match.league_id == league_id)

    matches = query.order_by(Match.match_day).all()
    return [_match_response(match, db) for match in matches]


@router.post("/claims", response_model=ClaimResponse)
async def bot_submit_claim(
    phone: str = Form(...),
    match_id: str = Form(...),
    home_score: int = Form(...),
    away_score: int = Form(...),
    screenshot: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: None = Depends(verify_bot_secret),
):
    user = _get_user_by_phone(phone, db)

    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if user.id not in (match.home_player_id, match.away_player_id):
        raise HTTPException(status_code=403, detail="This player is not part of this match")

    if match.status == "played":
        raise HTTPException(status_code=400, detail="Match already completed")

    existing = db.query(ResultClaim).filter(
        ResultClaim.match_id == match_id,
        ResultClaim.claimant_id == user.id,
        ResultClaim.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A pending claim already exists for this match")

    screenshot_url = await _store_screenshot(screenshot, user.id, match_id)

    is_home = user.id == match.home_player_id
    my_score = home_score if is_home else away_score
    opp_score = away_score if is_home else home_score

    if my_score > opp_score:
        claim_type = "win"
        points = 3
    elif my_score == opp_score:
        claim_type = "draw"
        points = 1
    else:
        claim_type = "loss"
        points = 0

    claim = ResultClaim(
        match_id=match_id,
        league_id=match.league_id,
        claimant_id=user.id,
        claim_type=claim_type,
        screenshot_url=screenshot_url,
        home_score=home_score,
        away_score=away_score,
        points_awarded=points,
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)
    send_push_to_admins(
        db,
        title="Nouveau claim a valider (WhatsApp)",
        body=f"{user.username} a soumis un resultat via WhatsApp",
        url="/admin/claims",
    )
    return _claim_response(claim, user)
