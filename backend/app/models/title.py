import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Title(Base):
    __tablename__ = "titles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    league_id: Mapped[str] = mapped_column(String, ForeignKey("leagues.id"), nullable=False)
    title_type: Mapped[str] = mapped_column(String(20), nullable=False)  # champion | lord
    awarded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="titles")
    league = relationship("League")
