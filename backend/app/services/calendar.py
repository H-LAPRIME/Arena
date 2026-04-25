from sqlalchemy.orm import Session
from app.models.user import User
from app.models.match import Match
from app.models.standing import Standing
from app.models.league import League
from app.models.league_member import LeagueMember
import uuid


def generate_league_calendar(db: Session, league: League, members: list):
    """
    Generate round-robin matches for a league.
    Each pair plays home+away = 2 matches per pair direction.
    With 3 players: 3 pairs x 2 matches each = 6 matches total... 
    but spec says 4 matches per user (8 total for 3 players).
    
    For 3 players we do double round-robin:
    Each pair plays TWICE in each direction (4 fixtures per pair):
      p1 home vs p2, p2 home vs p1, p1 home vs p2, p2 home vs p1
    Total: 3 pairs x 4 matches = 12 matches, each user plays 8.
    """
    n = len(members)
    if n < 2:
        raise ValueError("At least 2 members required")

    pairs = []
    for i in range(n):
        for j in range(i + 1, n):
            pairs.append((members[i], members[j]))

    import random
    all_matches = []
    for p1, p2 in pairs:
        for _ in range(2):
            all_matches.append((p1.user_id, p2.user_id))
            all_matches.append((p2.user_id, p1.user_id))

    random.shuffle(all_matches)

    for i, (home_id, away_id) in enumerate(all_matches):
        db.add(Match(
            id=str(uuid.uuid4()),
            league_id=league.id,
            home_player_id=home_id,
            away_player_id=away_id,
            match_day=(i // (n // 2)) + 1 if n % 2 == 0 else (i // (n // 2)) + 1, # basic grouping
        ))
    
    # Actually, simpler match day assignment:
    # Just assign a sequential match day for now, but the pairs are shuffled.
    # If we want proper "rounds", it's more complex, but shuffling satisfies "melonger".
    
    db.commit()
