from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any

from app.database import get_db
from app.models.user import User
from app.models.match import Match
from app.models.standing import Standing
from app.models.league import League
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/stats", tags=["stats"])

@router.get("/records")
def get_records(db: Session = Depends(get_db)):
    # Biggest win
    biggest_win_match = db.query(Match).filter(Match.status == "played").order_by(func.abs(Match.home_score - Match.away_score).desc()).first()
    biggest_win = None
    if biggest_win_match:
        biggest_win = {
            "home": biggest_win_match.home_player.username,
            "away": biggest_win_match.away_player.username,
            "score": f"{biggest_win_match.home_score} - {biggest_win_match.away_score}"
        }

    # Highest scoring match
    highest_scoring_match_obj = db.query(Match).filter(Match.status == "played").order_by((Match.home_score + Match.away_score).desc()).first()
    highest_scoring_match = None
    if highest_scoring_match_obj:
        highest_scoring_match = {
            "home": highest_scoring_match_obj.home_player.username,
            "away": highest_scoring_match_obj.away_player.username,
            "score": f"{highest_scoring_match_obj.home_score} - {highest_scoring_match_obj.away_score}",
            "total_goals": highest_scoring_match_obj.home_score + highest_scoring_match_obj.away_score
        }

    # Player global stats
    players = db.query(User).filter(User.is_active == True).all()
    player_stats = []
    for p in players:
        all_standings = db.query(Standing).filter(Standing.user_id == p.id).all()
        total_wins = sum(s.wins for s in all_standings)
        total_goals = sum(s.goals_for for s in all_standings)
        titles = db.query(League).filter(League.champion_id == p.id).count()
        
        player_stats.append({
            "username": p.username,
            "total_wins": total_wins,
            "total_goals": total_goals,
            "titles": titles,
            "is_lord": p.is_lord
        })
    
    # Sort by wins desc
    player_stats.sort(key=lambda x: x["total_wins"], reverse=True)

    return {
        "biggest_win": biggest_win,
        "highest_scoring_match": highest_scoring_match,
        "player_stats": player_stats[:10] # Top 10
    }

@router.get("/head-to-head/{id1}/{id2}")
def get_h2h(id1: str, id2: str, db: Session = Depends(get_db)):
    u1 = db.query(User).filter(User.id == id1).first()
    u2 = db.query(User).filter(User.id == id2).first()
    if not u1 or not u2:
        raise HTTPException(status_code=404, detail="User not found")

    matches = db.query(Match).filter(
        Match.status == "played",
        ((Match.home_player_id == id1) & (Match.away_player_id == id2)) |
        ((Match.home_player_id == id2) & (Match.away_player_id == id1))
    ).all()

    u1_wins = 0
    u2_wins = 0
    draws = 0
    u1_goals = 0
    u2_goals = 0

    for m in matches:
        if m.home_player_id == id1:
            u1_goals += m.home_score
            u2_goals += m.away_score
            if m.home_score > m.away_score: u1_wins += 1
            elif m.home_score < m.away_score: u2_wins += 1
            else: draws += 1
        else:
            u2_goals += m.home_score
            u1_goals += m.away_score
            if m.home_score > m.away_score: u2_wins += 1
            elif m.home_score < m.away_score: u1_wins += 1
            else: draws += 1

    return {
        "user1": {"username": u1.username},
        "user2": {"username": u2.username},
        "user1_wins": u1_wins,
        "user2_wins": u2_wins,
        "draws": draws,
        "user1_goals": u1_goals,
        "user2_goals": u2_goals,
        "total_matches": len(matches)
    }

@router.get("/player/{user_id}")
def get_player_stats(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    all_standings = db.query(Standing).filter(Standing.user_id == user_id).all()
    
    total_played = sum(s.played for s in all_standings)
    total_wins = sum(s.wins for s in all_standings)
    total_draws = sum(s.draws for s in all_standings)
    total_losses = sum(s.losses for s in all_standings)
    goals_for = sum(s.goals_for for s in all_standings)
    goals_against = sum(s.goals_against for s in all_standings)
    total_titles = db.query(League).filter(League.champion_id == user_id).count()
    
    win_rate = round((total_wins / total_played * 100), 1) if total_played > 0 else 0
    avg_goals = round((goals_for / total_played), 2) if total_played > 0 else 0
    
    # Home/Away breakdown from matches
    home_matches = db.query(Match).filter(Match.home_player_id == user_id, Match.status == "played").all()
    away_matches = db.query(Match).filter(Match.away_player_id == user_id, Match.status == "played").all()
    
    home_wins = sum(1 for m in home_matches if m.home_score > m.away_score)
    away_wins = sum(1 for m in away_matches if m.away_score > m.home_score)

    return {
        "total_titles": total_titles,
        "win_rate": win_rate,
        "total_played": total_played,
        "avg_goals_per_match": avg_goals,
        "total_wins": total_wins,
        "total_draws": total_draws,
        "total_losses": total_losses,
        "goals_for": goals_for,
        "goals_against": goals_against,
        "goal_difference": goals_for - goals_against,
        "home_wins": home_wins,
        "home_played": len(home_matches),
        "away_wins": away_wins,
        "away_played": len(away_matches)
    }
