"""
ReliefWeb API client.
Docs: https://reliefweb.int/help/api

Used for situation reports (AI summary context). NGO discovery uses HDX HAPI (see hapi.py).

Rate limit: 1000 req/day on free tier — cache aggressively.
"""

import httpx
from typing import Any

RELIEFWEB_BASE = "https://api.reliefweb.int/v1"
APP_NAME = "crisischain"


async def fetch_country_reports(country: str, limit: int = 3) -> list[dict[str, Any]]:
    """
    Fetch the latest published situation reports for a country.
    Returns list of { title, body, url, date }.
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


async def fetch_text_for_summary(country: str) -> str:
    """
    Convenience wrapper — returns a single concatenated string of the latest
    situation report bodies for use as LLM prompt context.
    """
    reports = await fetch_country_reports(country, limit=3)
    snippets = []
    for r in reports:
        fields = r.get("fields", {})
        title = fields.get("title", "")
        body = (fields.get("body", "") or "")[:1500]  # cap each report at 1500 chars
        snippets.append(f"## {title}\n{body}")
    return "\n\n".join(snippets)
