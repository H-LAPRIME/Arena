import logging
import re

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
    """Add lord_count column to users and backfill Lord status from title data."""
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

            # Fix is_lord + lord_count for users with 3+ titles in any series
            _backfill_lord_from_titles_pg(conn)
            logger.info("lord_count backfill complete")

        elif dialect == "sqlite":
            columns = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            if not any(column[1] == "lord_count" for column in columns):
                conn.execute(text("ALTER TABLE users ADD COLUMN lord_count INTEGER NOT NULL DEFAULT 0"))
                logger.info("lord_count column added successfully")
            else:
                logger.info("lord_count column already exists")

            _backfill_lord_from_titles_sqlite(conn)
            logger.info("lord_count backfill complete")


def _backfill_lord_from_titles_pg(conn) -> None:
    """Detect Lords from champion titles and set is_lord + lord_count."""
    # Get all users who have champion titles but are not marked as Lord
    rows = conn.execute(
        text(
            "SELECT DISTINCT u.id, u.is_lord "
            "FROM users u "
            "JOIN titles t ON t.user_id = u.id "
            "WHERE t.title_type = 'champion'"
        )
    ).fetchall()

    for (user_id, is_lord) in rows:
        # Get all league names this user won
        title_rows = conn.execute(
            text(
                "SELECT l.name FROM titles t "
                "JOIN leagues l ON l.id = t.league_id "
                "WHERE t.user_id = :uid AND t.title_type = 'champion'"
            ),
            {"uid": user_id},
        ).fetchall()

        titles_in_series = _count_titles_per_series([r[0] for r in title_rows])
        max_series_count = max(titles_in_series.values()) if titles_in_series else 0

        if max_series_count >= 3:
            if not is_lord:
                conn.execute(
                    text("UPDATE users SET is_lord = true WHERE id = :uid"),
                    {"uid": user_id},
                )
                logger.info("Fixed is_lord for user %s", user_id)
            conn.execute(
                text("UPDATE users SET lord_count = :lc WHERE id = :uid"),
                {"lc": max_series_count - 2, "uid": user_id},
            )


def _backfill_lord_from_titles_sqlite(conn) -> None:
    """Detect Lords from champion titles and set is_lord + lord_count (SQLite)."""
    rows = conn.execute(
        text(
            "SELECT DISTINCT u.id, u.is_lord "
            "FROM users u "
            "JOIN titles t ON t.user_id = u.id "
            "WHERE t.title_type = 'champion'"
        )
    ).fetchall()

    for (user_id, is_lord) in rows:
        title_rows = conn.execute(
            text(
                "SELECT l.name FROM titles t "
                "JOIN leagues l ON l.id = t.league_id "
                "WHERE t.user_id = :uid AND t.title_type = 'champion'"
            ),
            {"uid": user_id},
        ).fetchall()

        titles_in_series = _count_titles_per_series([r[0] for r in title_rows])
        max_series_count = max(titles_in_series.values()) if titles_in_series else 0

        if max_series_count >= 3:
            if not is_lord:
                conn.execute(
                    text("UPDATE users SET is_lord = 1 WHERE id = :uid"),
                    {"uid": user_id},
                )
                logger.info("Fixed is_lord for user %s", user_id)
            conn.execute(
                text("UPDATE users SET lord_count = :lc WHERE id = :uid"),
                {"lc": max_series_count - 2, "uid": user_id},
            )


def _count_titles_per_series(league_names: list) -> dict:
    """Count how many titles per league series (base name)."""
    series = {}
    for name in league_names:
        base = re.sub(r" V\d+$", "", name).strip()
        series[base] = series.get(base, 0) + 1
    return series
