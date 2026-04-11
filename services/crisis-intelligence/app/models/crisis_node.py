from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CrisisNode(BaseModel):
    region_id: str          # e.g. "SDN-2024-001"
    name: str               # "Darfur Conflict Zone"
    country: str            # "Sudan"
    lat: float
    lng: float
    severity_score: float   # 0–100, normalized across sources
    severity_level: str     # "low" | "medium" | "high" | "critical"
    summary: str            # AI-generated, populated by ai-summary service
    last_updated: datetime
    source_links: list[str]
    active_ngos: int = 0
    pool_id: Optional[int] = None  # blockchain pool ID, set after contract deploy
