"""
ReliefWeb API client.
Docs: https://reliefweb.int/help/api

Two purposes:
  1. fetch_country_reports() — situation report text for AI summary agent
  2. fetch_orgs_by_country() — NGO discovery (name + website URL)

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


async def fetch_orgs_by_country(country: str, limit: int = 50) -> list[dict[str, Any]]:
    """
    Fetch NGOs/organizations active in a given country from ReliefWeb.
    Returns list of { name, url, homepage } dicts.

    The 'url' is the ReliefWeb org page; 'homepage' is the org's own website
    (used as the starting point for the email scraper).
    """
    payload = {
        "appname": APP_NAME,
        "query": {"value": country, "operator": "AND"},
        "fields": {"include": ["name", "url", "links"]},
        "sort": ["name:asc"],
        "limit": limit,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(f"{RELIEFWEB_BASE}/organizations", json=payload)
        response.raise_for_status()

    orgs = []
    for item in response.json().get("data", []):
        fields = item.get("fields", {})
        links = fields.get("links", [])
        homepage = next(
            (lnk.get("url") for lnk in links if lnk.get("active")),
            None,
        )
        orgs.append({
            "name": fields.get("name", ""),
            "source_url": fields.get("url", ""),
            "homepage": homepage,
        })
    return [o for o in orgs if o["homepage"]]  # only keep orgs with a website


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
