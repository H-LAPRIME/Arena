"""
init_db.py — Drop all tables (including old schema) and recreate fresh.
Run once: python init_db.py
"""
from sqlalchemy import text
from app.database import engine, Base
from app.config import get_settings

# Register all models so Base.metadata knows about them
from app.models import *  # noqa

settings = get_settings()


def init():
    print("Dropping all existing tables with CASCADE...")
    with engine.connect() as conn:
        # Drop all tables in public schema forcefully (handles old FK constraints)
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
        conn.commit()

    print("Creating new schema...")
    Base.metadata.create_all(bind=engine)
    print()
    print("Database initialized successfully.")
    print()
    print("Next steps:")
    print("  1. Register your admin: POST /api/auth/register  (first user = admin automatically)")
    print("  2. Start the server:    python -m app.main")
    print("  3. Create a league:     POST /api/admin/leagues")
    print("  4. Share join_code with your 2 friends")


if __name__ == "__main__":
    init()
