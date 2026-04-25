from sqlalchemy import create_engine, text
from app.config import get_settings

settings = get_settings()
engine = create_engine(settings.DATABASE_URL)

def migrate():
    with engine.connect() as conn:
        print("Adding home_score and away_score to result_claims...")
        try:
            conn.execute(text("ALTER TABLE result_claims ADD COLUMN home_score INTEGER DEFAULT 0"))
            conn.execute(text("ALTER TABLE result_claims ADD COLUMN away_score INTEGER DEFAULT 0"))
            conn.commit()
            print("Successfully added columns.")
        except Exception as e:
            print(f"Error (maybe columns already exist?): {e}")

if __name__ == "__main__":
    migrate()
