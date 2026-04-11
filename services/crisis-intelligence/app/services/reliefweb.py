"""
ReliefWeb API client.
Docs: https://reliefweb.int/help/api

Used for: country situation reports that feed into the AI summary agent.

TODO:
- Filter by date (last 30 days) and status (current)
- Pull "body" field for the LLM summary prompt
- Rate limit: 1000 req/day on free tier — cache aggressively
"""

import httpx
from typing import Any

RELIEFWEB_BASE = "https://api.reliefweb.int/v1"
APP_NAME = "crisischain"


async def fetch_country_reports(country: str, limit: int = 3) -> list[dict[str, Any]]:
    """
    Fetch the latest situation reports for a given country name.
    Returns a list of report dicts with 'title', 'body', 'url', 'date'.
    """
    payload = {
        "appname": APP_NAME,
        "query": {"value": country, "operator": "AND"},
        "filter": {
            "operator": "AND",
            "conditions": [
                {"field": "type.name", "value": "Situation Report"},
                {"field": "status", "value": "published"},
            ],
        },
        "fields": {"include": ["title", "body", "url", "date"]},
        "sort": ["date:desc"],
        "limit": limit,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(f"{RELIEFWEB_BASE}/reports", json=payload)
        response.raise_for_status()
    return response.json().get("data", [])
