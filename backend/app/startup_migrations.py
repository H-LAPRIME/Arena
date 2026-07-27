import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


def ensure_whatsapp_phone_column(engine: Engine) -> None:
    """Keep older deployed databases compatible with the current User model."""
    dialect = engine.dialect.name
    logger.info("Running startup migration: ensure whatsapp_phone column (dialect=%s)", dialect)

    with engine.begin() as conn:
        if dialect == "postgresql":
            result = conn.execute(
                text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_name = 'users' AND column_name = 'whatsapp_phone'"
                )
            )
            if result.scalar():
                logger.info("whatsapp_phone column already exists")
                return
            conn.execute(
                text("ALTER TABLE users ADD COLUMN whatsapp_phone VARCHAR(20)")
            )
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_whatsapp_phone "
                    "ON users (whatsapp_phone)"
                )
            )
            logger.info("whatsapp_phone column added successfully")
            return

        if dialect == "sqlite":
            columns = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            if not any(column[1] == "whatsapp_phone" for column in columns):
                conn.execute(text("ALTER TABLE users ADD COLUMN whatsapp_phone VARCHAR(20)"))
                logger.info("whatsapp_phone column added successfully")
            else:
                logger.info("whatsapp_phone column already exists")
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_whatsapp_phone ON users (whatsapp_phone)"))

        logger.info("whatsapp_phone migration complete")


def ensure_lord_count_column(engine: Engine) -> None:
    """Add lord_count column to users and backfill for existing Lords."""
    dialect = engine.dialect.name
    logger.info("Running startup migration: ensure lord_count column (dialect=%s)", dialect)

    with engine.begin() as conn:
        if dialect == "postgresql":
            result = conn.execute(
                text(
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_name = 'users' AND column_name = 'lord_count'"
                )
            )
            if result.scalar():
                logger.info("lord_count column already exists")
            else:
                conn.execute(
                    text("ALTER TABLE users ADD COLUMN lord_count INTEGER NOT NULL DEFAULT 0")
                )
                logger.info("lord_count column added successfully")

            # Backfill: set lord_count for existing Lord users
            conn.execute(
                text(
                    "UPDATE users SET lord_count = GREATEST(sub.title_count - 2, 1) "
                    "FROM ("
                    "  SELECT titles.user_id, COUNT(*) AS title_count "
                    "  FROM titles "
                    "  WHERE titles.title_type = 'champion' "
                    "  GROUP BY titles.user_id"
                    ") AS sub "
                    "WHERE users.id = sub.user_id AND users.is_lord = true AND users.lord_count = 0"
                )
            )
            logger.info("lord_count backfill complete")

        elif dialect == "sqlite":
            columns = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            if not any(column[1] == "lord_count" for column in columns):
                conn.execute(text("ALTER TABLE users ADD COLUMN lord_count INTEGER NOT NULL DEFAULT 0"))
                logger.info("lord_count column added successfully")
            else:
                logger.info("lord_count column already exists")

            # SQLite backfill: count champion titles for each Lord user
            rows = conn.execute(
                text("SELECT id FROM users WHERE is_lord = 1 AND lord_count = 0")
            ).fetchall()
            for (user_id,) in rows:
                result = conn.execute(
                    text(
                        "SELECT COUNT(*) FROM titles "
                        "WHERE user_id = :uid AND title_type = 'champion'"
                    ),
                    {"uid": user_id},
                )
                title_count = result.scalar() or 0
                lord_count = max(title_count - 2, 1)
                conn.execute(
                    text("UPDATE users SET lord_count = :lc WHERE id = :uid"),
                    {"lc": lord_count, "uid": user_id},
                )
            logger.info("lord_count backfill complete")
