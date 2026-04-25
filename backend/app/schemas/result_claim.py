from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class ClaimResponse(BaseModel):
    id: str
    match_id: str
    league_id: str
    claimant_id: str
    claimant_username: str = ""
    home_player_name: str = ""
    away_player_name: str = ""
    claim_type: str
    screenshot_url: str
    home_score: int = 0
    away_score: int = 0
    status: str
    points_awarded: int
    admin_note: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ClaimReview(BaseModel):
    admin_note: Optional[str] = None
