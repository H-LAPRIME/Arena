from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class LeagueCreate(BaseModel):
    name: str
    description: str = ""
    max_members: int = 3


class LeagueUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    champion_id: Optional[str] = None


class LeagueJoin(BaseModel):
    join_code: str


class MemberResponse(BaseModel):
    id: str
    user_id: str
    username: str
    avatar_url: str
    joined_at: datetime
    is_lord: bool
    total_trophies: int

    model_config = {"from_attributes": True}


class LeagueResponse(BaseModel):
    id: str
    name: str
    description: str
    join_code: str
    max_members: int
    status: str
    created_by: str
    champion_id: Optional[str] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
    member_count: int = 0

    model_config = {"from_attributes": True}
