from typing import List, Optional
from pydantic import BaseModel


class StandingResponse(BaseModel):
    id: str
    league_id: str
    user_id: str
    username: str = ""
    avatar_url: str = ""
    points: int
    played: int
    wins: int
    draws: int
    losses: int
    goals_for: int
    goals_against: int
    goal_difference: int
    form: List[str] = []

    model_config = {"from_attributes": True}
