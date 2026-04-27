import sys
import os
from sqlalchemy import text

# Add current directory to path so we can import app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine

def migrate():
    with engine.connect() as connection:
        print("Starting migration...")
        try:
            # Add google_id column
            print("Adding google_id column to users table...")
            connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(100) UNIQUE;"))
            
            # Make password_hash nullable
            print("Making password_hash nullable...")
            connection.execute(text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;"))
            
            connection.commit()
            print("Migration successful!")
        except Exception as e:
            connection.rollback()
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate()
