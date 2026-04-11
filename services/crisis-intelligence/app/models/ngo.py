from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DiscoveredNgo(BaseModel):
    org_name: str
    domain: str
    contact_email: Optional[str] = None
    email_source: str = "scraped"       # 'scraped' | 'inferred' | 'manual'
    mx_host: Optional[str] = None
    mail_provider: Optional[str] = None # 'google' | 'microsoft' | 'self-hosted' | 'bulk' | 'unknown'
    region_id: Optional[str] = None
    source_url: Optional[str] = None    # ReliefWeb org page
    status: str = "discovered"


class NgoDiscoveryResult(BaseModel):
    region_id: str
    discovered: list[DiscoveredNgo]
    total_found: int
    with_email: int
    with_inferred_email: int
    errors: list[str] = []
