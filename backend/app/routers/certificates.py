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

@router.get("/player/{user_id}")
async def get_player_report(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download a global profile report for any player (Admin only or own)."""
    if current_user.role != "admin" and str(current_user.id) != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to download this report")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Fetch all-time stats (similar logic to users.py get_my_profile)
    from app.models.league_member import LeagueMember
    all_standings = db.query(Standing).filter(Standing.user_id == user.id).all()
    
    total_played = sum(s.played for s in all_standings)
    total_wins = sum(s.wins for s in all_standings)
    total_draws = sum(s.draws for s in all_standings)
    total_losses = sum(s.losses for s in all_standings)
    goals_for = sum(s.goals_for for s in all_standings)
    goals_against = sum(s.goals_against for s in all_standings)
    
    total_titles = db.query(League).filter(League.champion_id == user.id).count()
    win_rate = round((total_wins / total_played * 100), 1) if total_played > 0 else 0
    
    stats_dict = {
        "total_played": total_played,
        "total_wins": total_wins,
        "total_draws": total_draws,
        "total_losses": total_losses,
        "goals_for": goals_for,
        "goals_against": goals_against,
        "goal_difference": goals_for - goals_against,
        "total_titles": total_titles,
        "win_rate": win_rate,
        "is_lord": user.is_lord
    }

    pdf_content = certificate_service.generate_player_profile_pdf(
        user.username, stats_dict, user.avatar_url
    )
    
    filename = f"Profile_{user.username}.pdf"
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
