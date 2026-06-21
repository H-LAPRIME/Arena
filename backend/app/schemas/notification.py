from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    notif_type: Optional[str] = None
    notif_data: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
