import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class League(Base):
    __tablename__ = "leagues"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    join_code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False)
    max_members: Mapped[int] = mapped_column(Integer, default=3)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | active | completed
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    champion_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    champion = relationship("User", foreign_keys=[champion_id])
    members = relationship("LeagueMember", back_populates="league", cascade="all, delete-orphan")
    matches = relationship("Match", back_populates="league", cascade="all, delete-orphan")
    standings = relationship("Standing", back_populates="league", cascade="all, delete-orphan")
