import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str] = mapped_column(String(500), default="")
    role: Mapped[str] = mapped_column(String(20), default="user")  # "user" | "admin"
    total_trophies: Mapped[int] = mapped_column(Integer, default=0)
    is_lord: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    standings = relationship("Standing", back_populates="user")
    badges = relationship("Badge", back_populates="user")
    titles = relationship("Title", back_populates="user")
    chat_messages = relationship("ChatMessage", back_populates="user")
    result_claims = relationship("ResultClaim", back_populates="claimant", foreign_keys="ResultClaim.claimant_id")
    league_memberships = relationship("LeagueMember", back_populates="user")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
