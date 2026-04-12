"""
ReliefWeb Disasters API — enrichment layer for crisis nodes.

Fetches currently-active disasters and indexes them by ISO3 country code.
This is purely additive: it decorates existing nodes but never gates node creation.

API docs: https://reliefweb.int/help/api
Endpoint: GET /v1/disasters  (no auth required)
"""

import re
import logging
import httpx
from typing import Any

log = logging.getLogger(__name__)

RELIEFWEB_BASE = "https://api.reliefweb.int/v1"
APP_NAME = "crisischain"

_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    """Remove HTML tags and collapse whitespace."""
    clean = _HTML_TAG_RE.sub(" ", text)
    return " ".join(clean.split())


def _reliefweb_text_field(raw: Any) -> str:
    """
    Normalize ReliefWeb text fields: may be str, dict with value/html, or list of chunks.
    """
    if raw is None:
        return ""
    if isinstance(raw, str):
        return _strip_html(raw)
    if isinstance(raw, dict):
        for key in ("value", "html", "content"):
            if raw.get(key):
                return _reliefweb_text_field(raw[key])
        return ""
    if isinstance(raw, list):
        parts = [_reliefweb_text_field(x) for x in raw]
        return " ".join(p for p in parts if p)
    return _strip_html(str(raw))


def _disaster_description_fallback(
    name: str,
    type_names: list[str],
    status: str,
) -> str:
    """When the API omits description, still give the UI and AI useful context."""
    status = (status or "").strip() or "current"
    if type_names:
        return (
            f"Active humanitarian situation ({', '.join(type_names)}). "
            f"ReliefWeb status: {status}."
        )
    if name:
        return f"Active humanitarian situation: {name}. ReliefWeb status: {status}."
    return f"Active humanitarian disaster. ReliefWeb status: {status}."


async def fetch_active_disasters_by_country() -> dict[str, list[dict[str, Any]]]:
    """
    Fetch all currently-active disasters from ReliefWeb and index by ISO3.

    Returns a dict mapping ISO3 country codes to lists of disaster dicts:
        {
            "SDN": [
                {"name": "...", "type": "...", "description": "...",
                 "url": "...", "date": "...", "status": "..."},
                ...
            ],
            "SOM": [...],
        }

    A single disaster can span multiple countries, so the same disaster
    may appear under more than one ISO3 key.
    """
    params: dict[str, Any] = {
        "appname": APP_NAME,
        "filter[field]": "status",
        "filter[value]": "current",
        "limit": 200,
    }
    fields = ["name", "status", "description", "country", "type", "date", "url"]
    for f in fields:
        params.setdefault("fields[include][]", [])
    field_params = [("fields[include][]", f) for f in fields]

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"{RELIEFWEB_BASE}/disasters",
            params=[*[(k, v) for k, v in params.items()], *field_params],
        )
        response.raise_for_status()

    data = response.json().get("data", [])
    log.info(f"[reliefweb-enrich] Fetched {len(data)} active disasters")

    by_country: dict[str, list[dict[str, Any]]] = {}

    for item in data:
        fields_data = item.get("fields", {})

        description = _reliefweb_text_field(fields_data.get("description"))[:500]

        disaster_types = fields_data.get("type", [])
        type_names = [t["name"] for t in disaster_types if isinstance(t, dict) and "name" in t]

        date_info = fields_data.get("date", [])
        date_str = ""
        if isinstance(date_info, list) and date_info:
            date_str = date_info[0].get("created", "") if isinstance(date_info[0], dict) else ""
        elif isinstance(date_info, dict):
            date_str = date_info.get("created", "")

        status_val = fields_data.get("status", "") or ""
        name_val = fields_data.get("name", "") or ""
        if not description.strip():
            description = _disaster_description_fallback(name_val, type_names, status_val)[:500]

        disaster = {
            "name": name_val,
            "status": status_val,
            "description": description,
            "types": type_names,
            "url": fields_data.get("url", "") or f"https://reliefweb.int/disaster/{item.get('id', '')}",
            "date": date_str,
        }

        countries = fields_data.get("country", [])
        if not isinstance(countries, list):
            countries = [countries] if countries else []

        for c in countries:
            iso3 = c.get("iso3", "") if isinstance(c, dict) else ""
            if not iso3:
                continue
            iso3 = iso3.upper()
            by_country.setdefault(iso3, []).append(disaster)

    log.info(
        f"[reliefweb-enrich] Indexed disasters across {len(by_country)} countries"
    )
    return by_country
