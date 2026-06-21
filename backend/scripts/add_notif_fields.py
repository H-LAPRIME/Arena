import sys
import os
from dotenv import load_dotenv

# Add backend to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)

# Load .env BEFORE importing app.database
load_dotenv(os.path.join(backend_dir, ".env"))

from sqlalchemy import text
from app.database import engine

def migrate():
    with engine.connect() as conn:
        print("Adding notif_type and notif_data to notifications table...")
        try:
            conn.execute(text("ALTER TABLE notifications ADD COLUMN notif_type VARCHAR(50)"))
            conn.execute(text("ALTER TABLE notifications ADD COLUMN notif_data TEXT"))
            conn.commit()
            print("Migration successful!")
        except Exception as e:
            print(f"Migration error (maybe columns already exist?): {e}")

if __name__ == "__main__":
    migrate()
