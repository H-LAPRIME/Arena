import sys
import os
from dotenv import load_dotenv

# Add backend to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)

# Load environment variables before importing app.database
load_dotenv(os.path.join(backend_dir, ".env"))

from sqlalchemy import text
from app.database import engine


def migrate():
    with engine.connect() as conn:
        print("Adding is_auto_created column to leagues table...")
        try:
            conn.execute(text("ALTER TABLE leagues ADD COLUMN is_auto_created BOOLEAN DEFAULT FALSE NOT NULL"))
            conn.commit()
            print("Migration successful!")
        except Exception as e:
            print(f"Migration error (maybe column already exists?): {e}")


if __name__ == "__main__":
    migrate()
