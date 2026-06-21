from sqlalchemy.orm import Session
from app.models.league import League
from app.models.standing import Standing
from app.models.match import Match
from app.models.user import User
from app.models.title import Title
from app.models.notification import Notification
from app.models.league_member import LeagueMember
from app.services.calendar import generate_league_calendar
import uuid
import re
import json
from datetime import datetime


def get_league_base_name(league_name: str) -> str:
    """Return the series name shared by seasons like 'Arena V2'."""
    return re.sub(r' V\d+$', '', league_name).strip()


def count_series_titles(db: Session, user_id: str, league_name: str) -> int:
    """Count titles a player has won in this specific league series."""
    base_name = get_league_base_name(league_name)
    leagues_won = db.query(League).filter(
        League.champion_id == user_id,
        League.name.like(f"{base_name}%")
    ).all()
    return sum(1 for l in leagues_won if get_league_base_name(l.name) == base_name)


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


async def complete_active_league(db: Session, league: League):
    """Force-complete an active league using the current standings leader."""
    standings = (
        db.query(Standing)
        .filter(Standing.league_id == league.id)
        .order_by(Standing.points.desc(), Standing.goal_difference.desc(), Standing.wins.desc())
        .all()
    )
    if not standings:
        return False
    await _complete_league(db, league, standings[0])
    return True


async def _complete_league(db: Session, league: League, winner_standing: Standing):
    """Finalizes the league, awards trophy, checks for Lord status, and auto-creates next season."""
    league.status = "completed"
    league.champion_id = winner_standing.user_id
    league.ended_at = datetime.utcnow()
    
    winner = db.query(User).filter(User.id == winner_standing.user_id).first()
    if winner:
        winner.total_trophies += 1
        db.add(Title(
            id=str(uuid.uuid4()),
            user_id=winner.id,
            league_id=league.id,
            title_type="champion",
        ))
        
        # Notify winner
        notif = Notification(
            id=str(uuid.uuid4()),
            user_id=winner.id,
            title="CHAMPION !",
            message=f"Congratulations! You have won the league '{league.name}'. A trophy has been added to your profile.",
            notif_type="champion",
            notif_data=json.dumps({"league_id": league.id, "league_name": league.name, "champion_id": winner.id}),
        )
        db.add(notif)
        
        titles_in_league = count_series_titles(db, winner.id, league.name)
        
        if titles_in_league >= 3 and not winner.is_lord:
            winner.is_lord = True
            db.add(Title(
                id=str(uuid.uuid4()),
                user_id=winner.id,
                league_id=league.id,
                title_type="lord",
            ))
            # Special notification for Lord status
            lord_notif = Notification(
                id=str(uuid.uuid4()),
                user_id=winner.id,
                title="LORD OF THE ARENA",
                message="Incredible! With 3 trophies to your name, you are now crowned LORD OF THE ARENA.",
                notif_type="lord",
                notif_data=json.dumps({"league_id": league.id, "league_name": league.name, "champion_id": winner.id}),
            )
            db.add(lord_notif)

    # Notify all other members
    members = db.query(LeagueMember).filter(LeagueMember.league_id == league.id).all()
    for m in members:
        if m.user_id != winner_standing.user_id:
            winner_name = winner.username if winner else "Quelqu'un"
            n = Notification(
                id=str(uuid.uuid4()),
                user_id=m.user_id,
                title="League Completed",
                message=f"The league '{league.name}' has ended. {winner_name} has been crowned champion.",
                notif_type="league_completed",
                notif_data=json.dumps({"league_id": league.id, "league_name": league.name, "champion_id": winner_standing.user_id}),
            )
            db.add(n)
    
    db.commit()
    
    # Auto-create next season until someone wins 3 titles in this league series.
    if winner and count_series_titles(db, winner.id, league.name) < 3:
        await _auto_create_next_season(db, league, members)


async def _auto_create_next_season(db: Session, completed_league: League, members: list):
    """Automatically creates and starts the next season."""
    # Calculate new name
    match = re.search(r' V(\d+)$', completed_league.name)
    if match:
        v_num = int(match.group(1))
        new_name = re.sub(r' V\d+$', f' V{v_num + 1}', completed_league.name)
    else:
        new_name = f"{completed_league.name} V2"

    # Generate unique join code
    import random
    import string
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        existing = db.query(League).filter(League.join_code == code).first()
        if not existing:
            break

    # Create new league
    new_league = League(
        id=str(uuid.uuid4()),
        name=new_name,
        description=completed_league.description,
        join_code=code,
        max_members=completed_league.max_members,
        created_by=completed_league.created_by,
        status="active",
        started_at=datetime.utcnow(),
        is_auto_created=True,
    )
    db.add(new_league)
    db.flush()

    # Copy members and create standings
    for m in members:
        db.add(LeagueMember(id=str(uuid.uuid4()), league_id=new_league.id, user_id=m.user_id))
        db.add(Standing(id=str(uuid.uuid4()), league_id=new_league.id, user_id=m.user_id))

    db.commit()

    # Generate calendar for the new season
    generate_league_calendar(db, new_league, members)
    
    # Notify all members about the new season
    for m in members:
        member_user = db.query(User).filter(User.id == m.user_id).first()
        if member_user:
            notif = Notification(
                id=str(uuid.uuid4()),
                user_id=member_user.id,
                title="NEW SEASON",
                message=f"A new season '{new_name}' has started! The matches have been generated. Let's play!",
                notif_type="new_season",
                notif_data=json.dumps({"league_id": new_league.id, "league_name": new_name}),
            )
            db.add(notif)
    
    db.commit()
