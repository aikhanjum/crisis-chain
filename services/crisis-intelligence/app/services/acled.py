"""
ACLED (Armed Conflict Location & Event Data) API client.
Docs: https://apidocs.acleddata.com/

TODO:
- Set ACLED_EMAIL and ACLED_API_KEY in .env
- Filter by event_date (last 30 days) and event_type
- Group events by country/region and compute a severity score based on
  fatalities + event count
"""

import os
import httpx
from typing import Any

ACLED_BASE = "https://api.acleddata.com/acled/read"


async def fetch_recent_events(days_back: int = 30) -> list[dict[str, Any]]:
    """Return raw ACLED event rows for the last `days_back` days."""
    params = {
        "email": os.environ["ACLED_EMAIL"],
        "key": os.environ["ACLED_API_KEY"],
        "limit": 500,
        "event_date": f"{days_back}|ago",    # ACLED date filter syntax
        "event_date_where": "BETWEEN",
        "fields": "event_id_cnty|event_date|event_type|country|latitude|longitude|fatalities|notes",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(ACLED_BASE, params=params)
        response.raise_for_status()
        data = response.json()
    return data.get("data", [])
