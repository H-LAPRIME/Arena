from sqlalchemy.orm import Session
from app.models.badge import Badge
from app.models.standing import Standing
from app.models.result_claim import ResultClaim
import uuid
from datetime import datetime


def check_and_award_badges(db: Session, user_id: str, league_id: str) -> None:
    """
    Check and award badges based on user's performance in the league.
    Called after claim approval.
    """
    standing = db.query(Standing).filter(
        Standing.user_id == user_id,
        Standing.league_id == league_id,
    ).first()
    if not standing:
        return

    existing_badges = {b.badge_name for b in db.query(Badge).filter(Badge.user_id == user_id).all()}

    def award(name: str, desc: str):
        if name not in existing_badges:
            db.add(Badge(
                id=str(uuid.uuid4()),
                user_id=user_id,
                badge_name=name,
                description=desc,
                earned_at=datetime.utcnow(),
            ))

    # First win
    if standing.wins >= 1:
        award("First Win", "Won your first match in a league.")

    # Hat-trick of wins (3 wins in a league)
    if standing.wins >= 3:
        award("Hat-Trick", "Won 3 matches in a single league.")

    # Perfect week (5+ wins)
    if standing.wins >= 5:
        award("On Fire", "Won 5 or more matches in a league.")

    # Unbeaten (played >= 4, no losses)
    if standing.played >= 4 and standing.losses == 0:
        award("Unbeaten", "Played 4+ matches without a single loss.")

    db.commit()
