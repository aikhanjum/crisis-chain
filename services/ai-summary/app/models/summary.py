from pydantic import BaseModel
from datetime import datetime


class SummaryRequest(BaseModel):
    region_id: str
    country: str
    raw_reports: list[str]  # ReliefWeb report body text snippets
    acled_events_summary: str  # e.g. "42 conflict events, 156 fatalities in last 30 days"


class SummaryResponse(BaseModel):
    region_id: str
    summary: str            # 2-3 sentence neutral summary for the map drawer
    donate_copy: str        # 1 sentence "your donation funds..." copy for donate page
    generated_at: datetime
    cached: bool = False
