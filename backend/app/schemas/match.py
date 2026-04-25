from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class MatchResponse(BaseModel):
    id: str
    league_id: str
    home_player_id: str
    away_player_id: str
    home_player_name: str = ""
    away_player_name: str = ""
    home_player_avatar: str = ""
    away_player_avatar: str = ""
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    match_day: int
    status: str
    played_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MatchScoreUpdate(BaseModel):
    home_score: int
    away_score: int


class MatchAdminCreate(BaseModel):
    league_id: str
    home_player_id: str
    away_player_id: str
    match_day: int


class MatchAdminUpdate(BaseModel):
    home_player_id: Optional[str] = None
    away_player_id: Optional[str] = None
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    match_day: Optional[int] = None
    status: Optional[str] = None
