import uuid
from typing import Optional
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ResultClaim(Base):
    """
    A player submits a result claim after playing a match.
    Screenshot proof is REQUIRED for both win and draw.
    - Win:  claimant gets 3 pts if approved
    - Draw: each player submits separately; each gets 1 pt if approved
    Admin approves or rejects in the admin interface.
    """
    __tablename__ = "result_claims"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    match_id: Mapped[str] = mapped_column(String, ForeignKey("matches.id"), nullable=False)
    league_id: Mapped[str] = mapped_column(String, ForeignKey("leagues.id"), nullable=False)
    claimant_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    claim_type: Mapped[str] = mapped_column(String(10), nullable=False)  # "win" | "draw"
    screenshot_url: Mapped[str] = mapped_column(String(500), nullable=False)  # required
    home_score: Mapped[int] = mapped_column(Integer, default=0)
    away_score: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | approved | rejected
    points_awarded: Mapped[int] = mapped_column(Integer, default=0)
    admin_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    reviewed_by: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id"), nullable=True)

    # Relationships
    match = relationship("Match", back_populates="claims", foreign_keys=[match_id])
    league = relationship("League")
    claimant = relationship("User", back_populates="result_claims", foreign_keys=[claimant_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
