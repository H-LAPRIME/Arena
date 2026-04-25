import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.models.league_member import LeagueMember
from app.models.standing import Standing
from app.config import get_settings

settings = get_settings()
engine = create_engine(settings.DATABASE_URL)

def sync_standings():
    with Session(engine) as db:
        members = db.query(LeagueMember).all()
        created_count = 0
        for m in members:
            existing = db.query(Standing).filter(
                Standing.league_id == m.league_id,
                Standing.user_id == m.user_id
            ).first()
            if not existing:
                db.add(Standing(
                    id=str(uuid.uuid4()),
                    league_id=m.league_id,
                    user_id=m.user_id
                ))
                created_count += 1
        db.commit()
        print(f"Created {created_count} missing standings records.")

if __name__ == "__main__":
    sync_standings()
