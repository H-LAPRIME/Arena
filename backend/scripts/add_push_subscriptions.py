"""
Migration : cree la table push_subscriptions (pour les notifications
push navigateur envoyees a l'admin quand un claim est soumis).
A lancer une seule fois : python scripts/add_push_subscriptions.py
"""
import sys
import os
from dotenv import load_dotenv

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)
load_dotenv(os.path.join(backend_dir, ".env"))

os.environ.setdefault("JWT_SECRET", "migration-only")

from sqlalchemy import text
from app.database import engine


def migrate():
    with engine.connect() as conn:
        print("Creation de la table push_subscriptions...")
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS push_subscriptions (
                    id VARCHAR PRIMARY KEY,
                    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    endpoint TEXT NOT NULL UNIQUE,
                    p256dh VARCHAR NOT NULL,
                    auth VARCHAR NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.commit()
            print("Migration reussie !")
        except Exception as e:
            print(f"Erreur de migration (table deja existante ?): {e}")


if __name__ == "__main__":
    migrate()
