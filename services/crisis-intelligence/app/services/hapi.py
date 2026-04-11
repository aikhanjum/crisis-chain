"""
HDX HAPI v2 — NGO discovery via operational presence.

Docs: https://hapi.humdata.org/docs (OpenAPI /api/v2/...)

Requires an app identifier on every call:
  - Set HDX_HAPI_APP_IDENTIFIER (pre-encoded), or
  - Set HDX_HAPI_CONTACT_EMAIL (or ACLED_EMAIL as fallback) + optional HDX_HAPI_APPLICATION_NAME;
    we call GET /api/v2/encode_app_identifier once and cache the result.

Operational presence: GET /api/v2/coordination-context/operational-presence
(filter by location_name — wildcard, case-insensitive per HAPI docs).

Rows do not include org websites. We resolve http(s) URLs via the public HDX CKAN
API (organization_autocomplete → organization_show → org_url) when available.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any

import httpx

HAPI_BASE = os.environ.get("HDX_HAPI_BASE", "https://hapi.humdata.org").rstrip("/")
CKAN_ACTION = "https://data.humdata.org/api/3/action"

_app_identifier_cache: str | None = None
_app_identifier_lock = asyncio.Lock()


async def _ensure_app_identifier(client: httpx.AsyncClient) -> str:
    global _app_identifier_cache
    async with _app_identifier_lock:
        if _app_identifier_cache:
            return _app_identifier_cache
        preset = os.environ.get("HDX_HAPI_APP_IDENTIFIER", "").strip()
        if preset:
            _app_identifier_cache = preset
            return preset
        app_name = os.environ.get("HDX_HAPI_APPLICATION_NAME", "CrisisChain").strip()
        email = (
            os.environ.get("HDX_HAPI_CONTACT_EMAIL", "").strip()
            or os.environ.get("ACLED_EMAIL", "").strip()
        )
        if len(app_name) < 4:
            app_name = "CrisisChain"
        if not email:
            raise ValueError(
                "HDX HAPI requires an app identifier: set HDX_HAPI_APP_IDENTIFIER, "
                "or HDX_HAPI_CONTACT_EMAIL, or ACLED_EMAIL (used as fallback for encode_app_identifier)."
            )
        r = await client.get(
            f"{HAPI_BASE}/api/v2/encode_app_identifier",
            params={"application": app_name, "email": email},
            timeout=30.0,
        )
        r.raise_for_status()
        encoded = r.json().get("encoded_app_identifier")
        if not encoded:
            raise RuntimeError("HDX HAPI encode_app_identifier returned no encoded_app_identifier")
        _app_identifier_cache = str(encoded)
        return _app_identifier_cache


def _hapi_headers(app_id: str) -> dict[str, str]:
    return {"X-HDX-HAPI-APP-IDENTIFIER": app_id, "Accept": "application/json"}


async def _fetch_operational_presence_raw(
    client: httpx.AsyncClient, app_id: str, country: str, api_limit: int
) -> list[dict[str, Any]]:
    r = await client.get(
        f"{HAPI_BASE}/api/v2/coordination-context/operational-presence",
        params={
            "output_format": "json",
            "limit": min(10_000, max(api_limit, 1)),
            "location_name": country,
        },
        headers=_hapi_headers(app_id),
        timeout=60.0,
    )
    r.raise_for_status()
    body = r.json()
    if isinstance(body, dict) and body.get("status") not in (None, 200):
        raise RuntimeError(f"HDX HAPI error: {body}")
    data = body.get("data") if isinstance(body, dict) else None
    return data if isinstance(data, list) else []


async def _ckan_resolve_org_url(
    client: httpx.AsyncClient, org_name: str, acronym: str | None
) -> str | None:
    """Return org_url from HDX CKAN when we find a plausible organization match."""
    queries: list[str] = []
    if acronym and len(acronym.strip()) >= 2:
        queries.append(acronym.strip())
    if org_name and len(org_name.strip()) >= 2:
        queries.append(org_name.strip())

    seen_q: set[str] = set()
    for q in queries:
        if q in seen_q:
            continue
        seen_q.add(q)
        try:
            r = await client.get(
                f"{CKAN_ACTION}/organization_autocomplete",
                params={"q": q},
                timeout=20.0,
            )
            r.raise_for_status()
            results = r.json().get("result") or []
        except (httpx.HTTPError, ValueError, KeyError):
            continue
        if not results:
            continue

        on = org_name.casefold().strip()
        best = None
        for item in results:
            title = (item.get("title") or "").casefold().strip()
            if not title:
                continue
            if title == on or on in title or title in on:
                best = item
                break
        pick = best or results[0]
        name_key = pick.get("name")
        if not name_key:
            continue
        try:
            sr = await client.get(
                f"{CKAN_ACTION}/organization_show",
                params={"id": name_key},
                timeout=20.0,
            )
            sr.raise_for_status()
            res = sr.json().get("result") or {}
        except (httpx.HTTPError, ValueError, KeyError):
            continue
        url = (res.get("org_url") or "").strip()
        if url.startswith("http://") or url.startswith("https://"):
            return url
    return None


async def fetch_orgs_by_country(country: str, limit: int = 50) -> list[dict[str, Any]]:
    """
    Organizations with operational presence in `country` (HAPI location_name),
    enriched with a homepage URL when HDX CKAN lists org_url.

    Returns the same shape as the former ReliefWeb helper:
      { name, source_url, homepage }
    """
    fetch_cap = min(10_000, max(limit * 40, 200))

    async with httpx.AsyncClient() as client:
        app_id = await _ensure_app_identifier(client)
        raw = await _fetch_operational_presence_raw(client, app_id, country, fetch_cap)

        by_name: dict[str, dict[str, Any]] = {}
        for row in raw:
            name = (row.get("org_name") or "").strip()
            if not name:
                continue
            key = name.casefold()
            if key not in by_name:
                by_name[key] = row

        sem = asyncio.Semaphore(5)

        async def resolve_one(row: dict[str, Any]) -> dict[str, Any] | None:
            org_name = (row.get("org_name") or "").strip()
            acronym = (row.get("org_acronym") or "").strip() or None
            loc = (row.get("location_code") or "").strip()
            async with sem:
                homepage = await _ckan_resolve_org_url(client, org_name, acronym)
            if not homepage:
                return None
            return {
                "name": org_name,
                "homepage": homepage,
                "source_url": f"https://hapi.humdata.org/docs (operational presence; {loc})",
            }

        ordered_rows = [by_name[k] for k in sorted(by_name.keys())]
        # Resolve CKAN URLs in parallel (semaphore limits concurrency).
        scan = ordered_rows[: min(len(ordered_rows), max(limit * 12, 60))]
        resolved_list = await asyncio.gather(*(resolve_one(r) for r in scan))
        out = [r for r in resolved_list if r is not None][:limit]
        return out
