"""
User-facing league routes.
All routes require authentication. Users can only see/join leagues they are members of.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.league import League
from app.models.league_member import LeagueMember
from app.models.match import Match
from app.models.standing import Standing
from app.models.user import User
from app.schemas.league import LeagueJoin, LeagueResponse, MemberResponse, LeagueCreate, LeagueUpdate
from app.schemas.match import MatchResponse
from app.schemas.standing import StandingResponse
from app.routers.auth import get_current_user
from app.services.scoring import get_player_form

router = APIRouter(prefix="/api/leagues", tags=["leagues"])


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
    data.home_player_avatar = home.avatar_url if home else ""
    data.away_player_avatar = away.avatar_url if away else ""
    return data


def _require_membership(db: Session, user_id: str, league_id: str) -> League:
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    membership = db.query(LeagueMember).filter(
        LeagueMember.league_id == league_id,
        LeagueMember.user_id == user_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this league")
    return league


@router.get("/", response_model=list[LeagueResponse])
def get_all_leagues(
    db: Session = Depends(get_db),
):
    """Get all leagues (public, shows member count)"""
    leagues = db.query(League).all()
    return [_league_response(league, db) for league in leagues]


@router.post("/", response_model=LeagueResponse)
def create_league(
    data: LeagueCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new league (creator becomes admin)"""
    import string
    import random
    
    # Generate unique join code
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        existing = db.query(League).filter(League.join_code == code).first()
        if not existing:
            break
    
    league = League(
        id=str(uuid.uuid4()),
        name=data.name,
        description=data.description,
        join_code=code,
        max_members=data.max_members,
        status="pending",
        created_by=current_user.id,
    )
    db.add(league)
    db.flush()
    
    # Add creator as member
    db.add(LeagueMember(
        id=str(uuid.uuid4()),
        league_id=league.id,
        user_id=current_user.id,
    ))
    # Initial standing
    db.add(Standing(
        id=str(uuid.uuid4()),
        league_id=league.id,
        user_id=current_user.id,
    ))
    db.commit()
    return _league_response(league, db)


@router.put("/{league_id}", response_model=LeagueResponse)
def update_league(
    league_id: str,
    data: LeagueUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a league (creator only)"""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    if league.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can update this league")
    
    if data.name is not None:
        league.name = data.name
    if data.description is not None:
        league.description = data.description
    if data.status is not None:
        league.status = data.status
    if data.champion_id is not None:
        league.champion_id = data.champion_id
    
    db.commit()
    return _league_response(league, db)


@router.delete("/{league_id}")
def delete_league(
    league_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a league (creator only)"""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    if league.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can delete this league")
    
    # Delete related data
    db.query(LeagueMember).filter(LeagueMember.league_id == league_id).delete()
    db.query(Match).filter(Match.league_id == league_id).delete()
    db.query(Standing).filter(Standing.league_id == league_id).delete()
    db.delete(league)
    db.commit()
    return {"message": "League deleted"}


@router.post("/join", response_model=LeagueResponse)
def join_league(
    body: LeagueJoin,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    league = db.query(League).filter(League.join_code == body.join_code.upper()).first()
    if not league:
        raise HTTPException(status_code=404, detail="Invalid join code")
    if league.status == "completed":
        raise HTTPException(status_code=400, detail="League is already completed")

    existing = db.query(LeagueMember).filter(
        LeagueMember.league_id == league.id,
        LeagueMember.user_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You are already a member of this league")

    if league.status == "active":
        raise HTTPException(status_code=400, detail="Cannot join a league that has already started")

    count = db.query(LeagueMember).filter(LeagueMember.league_id == league.id).count()
    if count >= league.max_members:
        raise HTTPException(status_code=400, detail="League is full")

    db.add(LeagueMember(
        id=str(uuid.uuid4()),
        league_id=league.id,
        user_id=current_user.id,
    ))
    # Initial standing
    db.add(Standing(
        id=str(uuid.uuid4()),
        league_id=league.id,
        user_id=current_user.id,
    ))
    db.commit()
    return _league_response(league, db)


@router.delete("/{league_id}/quit")
def quit_league(
    league_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Quit a league (members only). Creator cannot quit."""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
        
    membership = db.query(LeagueMember).filter(
        LeagueMember.league_id == league_id,
        LeagueMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=400, detail="You are not a member of this league")
        
    if league.created_by == current_user.id:
        raise HTTPException(status_code=400, detail="Creator cannot quit the league. Delete the league instead.")

    if league.status != "pending":
        raise HTTPException(status_code=400, detail="Cannot quit a league that has already started.")
    
    # Delete related data for this user in this league
    db.delete(membership)
    db.query(Standing).filter(
        Standing.league_id == league_id,
        Standing.user_id == current_user.id
    ).delete()
    
    db.query(Match).filter(
        Match.league_id == league_id,
        (Match.home_player_id == current_user.id) | (Match.away_player_id == current_user.id)
    ).delete()
    
    db.commit()
    return {"message": "Successfully quit the league"}


@router.get("/my", response_model=list[LeagueResponse])
def my_leagues(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    memberships = db.query(LeagueMember).filter(LeagueMember.user_id == current_user.id).all()
    result = []
    for m in memberships:
        league = db.query(League).filter(League.id == m.league_id).first()
        if league:
            result.append(_league_response(league, db))
    return result


@router.get("/{league_id}", response_model=LeagueResponse)
def get_league(
    league_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    league = _require_membership(db, current_user.id, league_id)
    return _league_response(league, db)


@router.get("/{league_id}/members", response_model=list[MemberResponse])
def get_members(
    league_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_membership(db, current_user.id, league_id)
    memberships = db.query(LeagueMember).filter(LeagueMember.league_id == league_id).all()
    result = []
    for m in memberships:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            result.append(MemberResponse(
                id=m.id,
                user_id=user.id,
                username=user.username,
                avatar_url=user.avatar_url,
                joined_at=m.joined_at,
                is_lord=user.is_lord,
                total_trophies=user.total_trophies,
            ))
    return result


@router.get("/{league_id}/standings", response_model=list[StandingResponse])
def get_standings(
    league_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_membership(db, current_user.id, league_id)
    standings = (
        db.query(Standing)
        .filter(Standing.league_id == league_id)
        .order_by(Standing.points.desc(), Standing.wins.desc(), Standing.goal_difference.desc())
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


@router.get("/{league_id}/matches", response_model=list[MatchResponse])
def get_matches(
    league_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_membership(db, current_user.id, league_id)
    matches = (
        db.query(Match)
        .filter(Match.league_id == league_id)
        .order_by(Match.match_day)
        .all()
    )
    return [_match_response(m, db) for m in matches]


@router.get("/{league_id}/my-matches", response_model=list[MatchResponse])
def get_my_matches(
    league_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_membership(db, current_user.id, league_id)
    matches = (
        db.query(Match)
        .filter(
            Match.league_id == league_id,
            (Match.home_player_id == current_user.id) | (Match.away_player_id == current_user.id),
        )
        .order_by(Match.match_day)
        .all()
    )
    return [_match_response(m, db) for m in matches]


@router.get("/{league_id}/ai-advice")
async def get_ai_advice(
    league_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_membership(db, current_user.id, league_id)
    from app.services.chatbot import get_ai_advice_for_user
    advice = await get_ai_advice_for_user(db, current_user.id, league_id)
    return {"advice": advice}


@router.get("/{league_id}/standing-advice")
async def get_standing_advice(
    league_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_membership(db, current_user.id, league_id)
    from app.services.chatbot import generate_standing_comment
    comment = await generate_standing_comment(db, current_user.id, league_id)
    return {"comment": comment}


@router.get("/{league_id}/h2h-advice/{opponent_id}")
async def get_h2h_advice(
    league_id: str,
    opponent_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if league_id != "global":
        _require_membership(db, current_user.id, league_id)
    from app.services.chatbot import generate_h2h_comment
    comment = await generate_h2h_comment(db, current_user.id, opponent_id)
    return {"comment": comment}


@router.get("/match-advice/{match_id}")
async def get_match_advice(
    match_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.chatbot import generate_approval_comment
    comment = await generate_approval_comment(db, current_user.id, match_id)
    return {"comment": comment}
