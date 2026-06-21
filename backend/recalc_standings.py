from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.models.match import Match
from app.models.standing import Standing
from app.models.league import League
from app.models.user import User
from app.models.notification import Notification # Import to avoid mapper errors
from app.config import get_settings

settings = get_settings()
engine = create_engine(settings.DATABASE_URL)

def sync_all_standings():
    with Session(engine) as db:
        # 1. Reset all standings
        print("Resetting standings...")
        db.query(Standing).update({
            "points": 0, "played": 0, "wins": 0, "draws": 0, "losses": 0,
            "goals_for": 0, "goals_against": 0, "goal_difference": 0
        })
        db.commit()

        # 2. Process all played matches
        print("Recalculating from played matches...")
        matches = db.query(Match).filter(Match.status == "played").all()
        for m in matches:
            # Home player standing
            h_st = db.query(Standing).filter(Standing.league_id == m.league_id, Standing.user_id == m.home_player_id).first()
            # Away player standing
            a_st = db.query(Standing).filter(Standing.league_id == m.league_id, Standing.user_id == m.away_player_id).first()

            if h_st and a_st:
                h_st.played += 1
                a_st.played += 1
                h_st.goals_for += (m.home_score or 0)
                h_st.goals_against += (m.away_score or 0)
                a_st.goals_for += (m.away_score or 0)
                a_st.goals_against += (m.home_score or 0)

                if m.home_score > m.away_score:
                    h_st.points += 3
                    h_st.wins += 1
                    a_st.losses += 1
                elif m.home_score < m.away_score:
                    a_st.points += 3
                    a_st.wins += 1
                    h_st.losses += 1
                else:
                    h_st.points += 1
                    a_st.points += 1
                    h_st.draws += 1
                    a_st.draws += 1
        
        db.commit()
        print("Done!")

if __name__ == "__main__":
    sync_all_standings()
