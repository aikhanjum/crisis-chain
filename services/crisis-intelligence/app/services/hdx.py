"""
HDX HAPI (Humanitarian Data Exchange) API client.
Docs: https://hapi.humdata.org/docs

Provides: food insecurity, displacement, and population indicators per country.

TODO:
- Paginate through results (page_size max 10000)
- Map country ISO codes to lat/lng centroids
- Normalize indicator values into a 0–100 severity contribution
"""

import httpx
from typing import Any

HDX_BASE = "https://hapi.humdata.org/api/v1"


async def fetch_food_insecurity(iso3: str | None = None) -> list[dict[str, Any]]:
    """Fetch food insecurity data. Pass iso3 to filter by country."""
    params: dict[str, Any] = {"output_format": "json", "limit": 1000}
    if iso3:
        params["location_code"] = iso3
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(f"{HDX_BASE}/food/food-security", params=params)
        response.raise_for_status()
    return response.json().get("data", [])


async def fetch_population_displacement(iso3: str | None = None) -> list[dict[str, Any]]:
    """Fetch IDP/refugee displacement data."""
    params: dict[str, Any] = {"output_format": "json", "limit": 1000}
    if iso3:
        params["location_code"] = iso3
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(f"{HDX_BASE}/coordination-context/refugees", params=params)
        response.raise_for_status()
    return response.json().get("data", [])
