"""
User-facing claims routes.
Users can submit claims and view their own claims only.
Admin claim management is in admin_leagues.py.
"""
import os
import uuid
from datetime import datetime
from typing import Optional, List
from supabase import create_client, Client

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.result_claim import ResultClaim
from app.models.match import Match
from app.models.user import User
from app.schemas.result_claim import ClaimResponse
from app.routers.auth import get_current_user
from app.config import get_settings

router = APIRouter(prefix="/api/claims", tags=["claims"])
settings = get_settings()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _build_response(claim: ResultClaim, db: Session) -> ClaimResponse:
    claimant = db.query(User).filter(User.id == claim.claimant_id).first()
    data = ClaimResponse.model_validate(claim)
    data.claimant_username = claimant.username if claimant else "?"
    return data


@router.post("", response_model=ClaimResponse)
async def submit_claim(
    match_id: str = Form(...),
    home_score: int = Form(0),
    away_score: int = Form(0),
    screenshot: UploadFile = File(...),  # required
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a claim. Result and points are calculated automatically from scores."""

    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Only players in the match can claim
    if current_user.id not in (match.home_player_id, match.away_player_id):
        raise HTTPException(status_code=403, detail="You are not a player in this match")

    if match.status == "played":
        raise HTTPException(status_code=400, detail="Match already completed")

    # Prevent duplicate pending claim
    existing = db.query(ResultClaim).filter(
        ResultClaim.match_id == match_id,
        ResultClaim.claimant_id == current_user.id,
        ResultClaim.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending claim for this match")

    # Validate + save screenshot (required)
    if not screenshot or not screenshot.filename:
        raise HTTPException(status_code=400, detail="Screenshot is required as proof")

    ext = os.path.splitext(screenshot.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Screenshot must be JPG, PNG, GIF, or WebP")

    content = await screenshot.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Screenshot must be under 10 MB")

    # Upload to Supabase
    try:
        supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
        filename = f"{current_user.id}_{match_id}_{uuid.uuid4().hex[:8]}{ext}"
        
        # Upload
        supabase.storage.from_("claims").upload(
            path=filename,
            file=content,
            file_options={"content-type": screenshot.content_type}
        )
        
        # Public URL
        screenshot_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/claims/{filename}"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to Cloud: {str(e)}")

    # Determine result and points automatically
    is_home = (current_user.id == match.home_player_id)
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
        claimant_id=current_user.id,
        claim_type=claim_type,
        screenshot_url=screenshot_url,
        home_score=home_score,
        away_score=away_score,
        points_awarded=points,
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return _build_response(claim, db)


@router.get("/my", response_model=List[ClaimResponse])
def my_claims(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """View only my own claims."""
    claims = (
        db.query(ResultClaim)
        .filter(ResultClaim.claimant_id == current_user.id)
        .order_by(ResultClaim.created_at.desc())
        .all()
    )
    return [_build_response(c, db) for c in claims]


@router.delete("/{claim_id}")
def delete_claim(
    claim_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a claim history entry."""
    claim = db.query(ResultClaim).filter(ResultClaim.id == claim_id, ResultClaim.claimant_id == current_user.id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    db.delete(claim)
    db.commit()
    return {"message": "Claim deleted"}


@router.patch("/{claim_id}/image", response_model=ClaimResponse)
async def update_claim_image(
    claim_id: str,
    screenshot: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the screenshot of a pending claim."""
    claim = db.query(ResultClaim).filter(ResultClaim.id == claim_id, ResultClaim.claimant_id == current_user.id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if claim.status != "pending":
        raise HTTPException(status_code=400, detail="Cannot change image of a processed claim")

    if not screenshot or not screenshot.filename:
        raise HTTPException(status_code=400, detail="Screenshot is required")

    ext = os.path.splitext(screenshot.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Screenshot must be JPG, PNG, GIF, or WebP")

    content = await screenshot.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Screenshot must be under 10 MB")

    # Upload to Supabase
    try:
        supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
        filename = f"{current_user.id}_{claim.match_id}_upd_{uuid.uuid4().hex[:8]}{ext}"
        
        # Upload
        supabase.storage.from_("claims").upload(
            path=filename,
            file=content,
            file_options={"content-type": screenshot.content_type}
        )
        
        # Public URL
        claim.screenshot_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/claims/{filename}"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to Cloud: {str(e)}")
    db.commit()
    db.refresh(claim)
    return _build_response(claim, db)
