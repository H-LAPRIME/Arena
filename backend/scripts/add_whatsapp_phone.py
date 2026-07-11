"""
Add the whatsapp_phone column used by the WhatsApp bot.

Run once from the backend directory:
    python scripts/add_whatsapp_phone.py
"""
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import text

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)
load_dotenv(os.path.join(backend_dir, ".env"))

from app.database import engine  # noqa: E402


def migrate():
    with engine.begin() as conn:
        dialect = engine.dialect.name
        if dialect == "postgresql":
            result = conn.execute(
                text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_name = 'users' AND column_name = 'whatsapp_phone'"
                )
            )
            if result.scalar():
                print("whatsapp_phone column already exists")
                return
            conn.execute(text("ALTER TABLE users ADD COLUMN whatsapp_phone VARCHAR(20)"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_whatsapp_phone ON users (whatsapp_phone)"))
        else:
            columns = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            if not any(column[1] == "whatsapp_phone" for column in columns):
                conn.execute(text("ALTER TABLE users ADD COLUMN whatsapp_phone VARCHAR(20)"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_whatsapp_phone ON users (whatsapp_phone)"))
        print("whatsapp_phone migration complete")


if __name__ == "__main__":
    migrate()
