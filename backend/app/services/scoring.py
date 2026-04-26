from sqlalchemy.orm import Session
from app.models.standing import Standing
from app.models.match import Match
from app.models.result_claim import ResultClaim
from app.models.user import User
from app.models.title import Title
from app.models.league import League
import uuid


def award_points_from_claim(db: Session, claim: ResultClaim) -> None:
    match = claim.match
    if not match:
        return

    # IMPORTANT: Prevent double counting. 
    # If the match is already "played", it means standings were already updated 
    # by a previous claim approval or admin edit.
    if match.status == "played":
        # Note: If we want to allow "correcting" a result, we'd need more complex logic.
        # For now, let's assume first approval wins or admin handles corrections via Match Edit.
        return

    # 1. Update Match record
    match.status = "played"
    match.home_score = claim.home_score
    match.away_score = claim.away_score
    from datetime import datetime
    match.played_at = datetime.utcnow()

    # 2. Update Both Standings
    home_standing = db.query(Standing).filter(
        Standing.user_id == match.home_player_id,
        Standing.league_id == match.league_id,
    ).first()
    away_standing = db.query(Standing).filter(
        Standing.user_id == match.away_player_id,
        Standing.league_id == match.league_id,
    ).first()

    if not home_standing or not away_standing:
        db.commit()
        return

    # Common updates
    home_standing.played += 1
    away_standing.played += 1
    home_standing.goals_for += match.home_score
    home_standing.goals_against += match.away_score
    away_standing.goals_for += match.away_score
    away_standing.goals_against += match.home_score

    # Result specific updates
    if match.home_score > match.away_score:
        home_standing.wins += 1
        home_standing.points += 3
        away_standing.losses += 1
    elif match.away_score > match.home_score:
        away_standing.wins += 1
        away_standing.points += 3
        home_standing.losses += 1
    else:
        home_standing.draws += 1
        home_standing.points += 1
        away_standing.draws += 1
        away_standing.points += 1

    # Update goal differences
    home_standing.goal_difference = home_standing.goals_for - home_standing.goals_against
    away_standing.goal_difference = away_standing.goals_for - away_standing.goals_against

    db.commit()


def get_player_form(db: Session, user_id: str, league_id: str, limit: int = 5) -> list[str]:
    """
    Return last N match results for a player in a league as a list of 'W', 'D', 'L'.
    Determined by approved claims (win/draw) or absence thereof.
    """
    matches = (
        db.query(Match)
        .filter(
            Match.league_id == league_id,
            Match.status == "played",
            (Match.home_player_id == user_id) | (Match.away_player_id == user_id),
        )
        .order_by(Match.played_at.desc())
        .limit(limit)
        .all()
    )

    form = []
    for m in matches:
        if m.home_player_id == user_id:
            my_score = m.home_score or 0
            opp_score = m.away_score or 0
        else:
            my_score = m.away_score or 0
            opp_score = m.home_score or 0
            
        if my_score > opp_score:
            form.append("W")
        elif my_score < opp_score:
            form.append("L")
        else:
            form.append("D")

    return list(reversed(form))


def check_and_complete_league(db: Session, league: League) -> None:
    """
    Check if all matches in the league have been played.
    If so, automatically resolve the champion.
    """
    pending = db.query(Match).filter(
        Match.league_id == league.id,
        Match.status == "pending",
    ).count()

    if pending == 0:
        resolve_champion(db, league)


def resolve_champion(db: Session, league: League) -> None:
    """Determine champion, award trophy, check Lord status."""
    if league.status == "completed":
        return

    standings = (
        db.query(Standing)
        .filter(Standing.league_id == league.id)
        .order_by(Standing.points.desc(), Standing.wins.desc())
        .all()
    )
    if not standings:
        return

    champion_standing = standings[0]
    champion = db.query(User).filter(User.id == champion_standing.user_id).first()
    if not champion:
        return

    from datetime import datetime
    league.champion_id = champion.id
    league.status = "completed"
    league.ended_at = datetime.utcnow()

    # Award title
    title = Title(
        id=str(uuid.uuid4()),
        user_id=champion.id,
        league_id=league.id,
        title_type="champion",
    )
    db.add(title)

    # Increment trophies
    champion.total_trophies += 1

    from app.models.notification import Notification
    from app.models.league_member import LeagueMember

    # 1. Notification for the Champion
    champion_notif = Notification(
        id=str(uuid.uuid4()),
        user_id=champion.id,
        title="LEAGUE CHAMPION! 🏆",
        message=f"Félicitations {champion.username}! Tu as remporté la ligue '{league.name}'. Ton trophée a été ajouté à ton profil."
    )
    db.add(champion_notif)

    # 2. Check for Lord of the Game (3 trophies)
    if champion.total_trophies >= 3 and not champion.is_lord:
        champion.is_lord = True
        lord_title = Title(
            id=str(uuid.uuid4()),
            user_id=champion.id,
            league_id=league.id,
            title_type="lord",
        )
        db.add(lord_title)
        
        lord_notif = Notification(
            id=str(uuid.uuid4()),
            user_id=champion.id,
            title="LORD OF THE GAME 👑",
            message="Incroyable ! Avec 3 trophées, tu deviens officiellement un Lord de l'Arène !"
        )
        db.add(lord_notif)

    # 3. Notification for all participants (League Report Ready)
    members = db.query(LeagueMember).filter(LeagueMember.league_id == league.id).all()
    for member in members:
        if member.user_id != champion.id: # Champion already got a better one
            report_notif = Notification(
                id=str(uuid.uuid4()),
                user_id=member.user_id,
                title="Saison Terminée 📊",
                message=f"La ligue '{league.name}' est finie. Va voir le Hall of Fame pour le rapport final !"
            )
            db.add(report_notif)

    db.commit()
