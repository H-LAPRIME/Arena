from sqlalchemy.orm import Session
from app.models.league import League
from app.models.standing import Standing
from app.models.match import Match
from app.models.user import User
from app.models.notification import Notification
import uuid

async def check_league_completion(db: Session, league_id: str):
    """
    Checks if a league is finished either by all matches played 
    or by mathematical certainty of the winner.
    """
    league = db.query(League).filter(League.id == league_id).first()
    if not league or league.status != "active":
        return

    # 1. Get standings ordered by points, then goal difference
    standings = (
        db.query(Standing)
        .filter(Standing.league_id == league_id)
        .order_by(Standing.points.desc(), Standing.goal_difference.desc())
        .all()
    )
    if not standings:
        return

    # 2. Check if all matches are played
    pending_count = db.query(Match).filter(Match.league_id == league_id, Match.status == "pending").count()
    if pending_count == 0:
        await _complete_league(db, league, standings[0])
        return

    # 3. Mathematical certainty check
    # If the leader's points are greater than the maximum points any other player can reach.
    leader = standings[0]
    is_finished = True
    
    for challenger in standings[1:]:
        # Find how many matches the challenger has left in this league
        challenger_pending = db.query(Match).filter(
            Match.league_id == league_id,
            Match.status == "pending",
            (Match.home_player_id == challenger.user_id) | (Match.away_player_id == challenger.user_id)
        ).count()
        
        max_possible = challenger.points + (challenger_pending * 3)
        
        # If any challenger can still reach or exceed the leader's points, league is not over.
        if max_possible >= leader.points:
            is_finished = False
            break
            
    if is_finished:
        await _complete_league(db, league, leader)

async def _complete_league(db: Session, league: League, winner_standing: Standing):
    """Finalizes the league, awards trophy, and checks for Lord status."""
    league.status = "completed"
    league.champion_id = winner_standing.user_id
    
    winner = db.query(User).filter(User.id == winner_standing.user_id).first()
    if winner:
        winner.total_trophies += 1
        
        # Notify winner
        notif = Notification(
            id=str(uuid.uuid4()),
            user_id=winner.id,
            title="🏆 CHAMPION !",
            message=f"Congratulations! You have won the league '{league.name}'. A trophy has been added to your profile."
        )
        db.add(notif)
        
        # Lord of the League check (3 trophies)
        if winner.total_trophies >= 3 and not winner.is_lord:
            winner.is_lord = True
            # Special notification for Lord status
            lord_notif = Notification(
                id=str(uuid.uuid4()),
                user_id=winner.id,
                title="👑 LORD OF THE ARENA",
                message="Incredible! With 3 trophies to your name, you are now crowned LORD OF THE ARENA."
            )
            db.add(lord_notif)

    # Notify all other members
    from app.models.league_member import LeagueMember
    members = db.query(LeagueMember).filter(LeagueMember.league_id == league.id).all()
    for m in members:
        if m.user_id != winner_standing.user_id:
            winner_name = winner.username if winner else "Quelqu'un"
            n = Notification(
                id=str(uuid.uuid4()),
                user_id=m.user_id,
                title="League Completed 🏁",
                message=f"The league '{league.name}' has ended. {winner_name} has been crowned champion."
            )
            db.add(n)
            
    db.commit()
