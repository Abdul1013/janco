from pydantic import BaseModel
from typing import Optional

class JobCreate(BaseModel):
    user_id:str
    janitor_id:Optional[str]
    service_type:str
    scheduled_date: Optional[str] = None 