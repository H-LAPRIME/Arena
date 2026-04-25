import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    league_id: Mapped[str] = mapped_column(String, ForeignKey("leagues.id"), nullable=False)
    home_player_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    away_player_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    home_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    away_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    match_day: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | claimed | played
    played_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    league = relationship("League", back_populates="matches")
    home_player = relationship("User", foreign_keys=[home_player_id])
    away_player = relationship("User", foreign_keys=[away_player_id])
    claims = relationship("ResultClaim", back_populates="match", cascade="all, delete-orphan")
