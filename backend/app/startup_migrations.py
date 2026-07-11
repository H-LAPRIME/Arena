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
