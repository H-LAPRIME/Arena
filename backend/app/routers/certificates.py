from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.league import League
from app.models.standing import Standing
from app.models.match import Match
from app.routers.auth import get_current_user
from app.services.certificate_service import certificate_service
from app.services.chatbot import _call_mistral, build_league_context

router = APIRouter(prefix="/api/certificates", tags=["certificates"])

@router.get("/title/{league_id}")
async def get_title_certificate(
    league_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    # Verify user is the champion
    if league.champion_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the champion of this league")

    pdf_content = certificate_service.generate_title_pdf(current_user.username, league.name)
    
    filename = f"Champion_{league.name.replace(' ', '_')}.pdf"
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/lord")
async def get_lord_certificate(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Count titles
    titles_count = db.query(League).filter(League.champion_id == current_user.id).count()
    if titles_count < 3:
        raise HTTPException(status_code=403, detail="You need at least 3 titles to claim this certificate")

    pdf_content = certificate_service.generate_lord_pdf(current_user.username)
    
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=Lord_of_the_Arena.pdf"}
    )

@router.get("/report/{league_id}")
async def get_performance_report(
    league_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    # Fetch stats for this user in this league
    standing = db.query(Standing).filter(
        Standing.league_id == league_id,
        Standing.user_id == current_user.id
    ).first()
    
    if not standing:
        raise HTTPException(status_code=404, detail="Stats not found for this league")

    # Fetch highlights (matches with big wins)
    matches = db.query(Match).filter(
        Match.league_id == league_id,
        Match.status == "played",
        ((Match.home_player_id == current_user.id) | (Match.away_player_id == current_user.id))
    ).all()
    
    highlights = []
    for m in matches:
        is_home = m.home_player_id == current_user.id
        my_score = m.home_score if is_home else m.away_score
        opp_score = m.away_score if is_home else m.home_score
        opp_name = m.away_player.username if is_home else m.home_player.username
        
        if my_score > opp_score:
            highlights.append({
                "score": f"{my_score}-{opp_score}",
                "opponent": opp_name,
                "diff": my_score - opp_score
            })
    
    # Sort highlights by diff
    highlights.sort(key=lambda x: x["diff"], reverse=True)
    top_highlights = [f"Victory {h['score']} against {h['opponent']}" for h in highlights[:3]]

    stats_dict = {
        "played": standing.played,
        "wins": standing.wins,
        "draws": standing.draws,
        "losses": standing.losses,
        "gf": standing.goals_for,
        "ga": standing.goals_against,
        "gd": standing.goals_for - standing.goals_against,
        "pts": standing.points,
        "highlights": top_highlights
    }

    # Generate AI Message
    context = await build_league_context(db, current_user.id, league_id)
    prompt = (
        f"Generate a personalized, courageous, and analytical performance summary for {current_user.username} "
        f"for their campaign in {league.name}. Use these stats: {stats_dict}. "
        f"Mention specific highlights. Keep it to 4-5 sentences, encouraging tone. No emojis."
    )
    ai_msg = await _call_mistral(db, prompt, current_user.id, save=False)
    if not ai_msg:
        ai_msg = f"Good performance in the {league.name}. Keep training and pushing for the top!"

    pdf_content = certificate_service.generate_performance_report_pdf(
        current_user.username, league.name, stats_dict, ai_msg
    )
    
    filename = f"Report_{league.name.replace(' ', '_')}_{current_user.username}.pdf"
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
