"""
HDX HAPI (Humanitarian Data Exchange) API client.
Docs: https://hapi.humdata.org/docs

Fetches food insecurity and displacement indicators, returns per-country
severity scores that feed into the normalizer.
"""

import httpx
from typing import Any

HDX_BASE = "https://hapi.humdata.org/api/v1"

# IPC food insecurity phases — phase 3+ is "crisis or worse"
IPC_CRISIS_PHASES = {3, 4, 5}


async def fetch_food_insecurity(iso3: str | None = None) -> list[dict[str, Any]]:
    """Fetch food insecurity data, optionally filtered to one country."""
    params: dict[str, Any] = {"output_format": "json", "limit": 2000}
    if iso3:
        params["location_code"] = iso3
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(f"{HDX_BASE}/food/food-security", params=params)
        response.raise_for_status()
    return response.json().get("data", [])


async def fetch_population_displacement(iso3: str | None = None) -> list[dict[str, Any]]:
    """Fetch IDP and refugee displacement counts."""
    params: dict[str, Any] = {"output_format": "json", "limit": 2000}
    if iso3:
        params["location_code"] = iso3
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(f"{HDX_BASE}/coordination-context/refugees", params=params)
        response.raise_for_status()
    return response.json().get("data", [])


async def score_by_country() -> dict[str, dict[str, Any]]:
    """
    Pull food insecurity + displacement data and return per-country severity scores:
        iso3 → { score: float (0–100), food_score: float, displacement_score: float }

    Food score:
        Percentage of population in IPC phase 3+ (crisis/emergency/famine), scaled to 0–100.
        e.g. 35% of population in crisis → food_score = 35 (not scaled further, already 0–100).

    Displacement score:
        Displaced persons as a fraction of a reference population (10 million),
        capped at 100.  e.g. 3.5M displaced → score = 35.

    Combined HDX score = 0.6 * food_score + 0.4 * displacement_score
    """
    food_rows, disp_rows = await _fetch_both()

    # --- food insecurity ---
    # HDX returns population_in_phase per IPC phase per country
    food_by_iso: dict[str, dict[str, float]] = {}
    for r in food_rows:
        iso3 = r.get("location_code")
        if not iso3:
            continue
        phase = r.get("ipc_phase")
        pop = float(r.get("population_in_phase") or 0)
        total = float(r.get("population_affected_total") or 1)
        if not iso3 in food_by_iso:
            food_by_iso[iso3] = {"crisis_pop": 0.0, "total_pop": total}
        if phase in IPC_CRISIS_PHASES:
            food_by_iso[iso3]["crisis_pop"] += pop
        food_by_iso[iso3]["total_pop"] = max(food_by_iso[iso3]["total_pop"], total)

    food_scores: dict[str, float] = {}
    for iso3, data in food_by_iso.items():
        pct = (data["crisis_pop"] / data["total_pop"]) * 100 if data["total_pop"] else 0
        food_scores[iso3] = min(100.0, pct)

    # --- displacement ---
    disp_by_iso: dict[str, float] = {}
    for r in disp_rows:
        iso3 = r.get("location_code") or r.get("origin_location_code")
        if not iso3:
            continue
        disp_by_iso[iso3] = disp_by_iso.get(iso3, 0.0) + float(r.get("individuals") or 0)

    DISPLACEMENT_REF = 10_000_000  # 10M displaced = score of 100
    disp_scores: dict[str, float] = {
        iso3: min(100.0, (count / DISPLACEMENT_REF) * 100)
        for iso3, count in disp_by_iso.items()
    }

    # --- combine ---
    all_iso3 = set(food_scores) | set(disp_scores)
    result: dict[str, dict[str, Any]] = {}
    for iso3 in all_iso3:
        fs = food_scores.get(iso3, 0.0)
        ds = disp_scores.get(iso3, 0.0)
        result[iso3] = {
            "score": round(0.6 * fs + 0.4 * ds, 1),
            "food_score": round(fs, 1),
            "displacement_score": round(ds, 1),
            "source_links": [f"https://hapi.humdata.org/locations/{iso3}"],
        }
    return result


async def _fetch_both() -> tuple[list[dict], list[dict]]:
    async with httpx.AsyncClient(timeout=60) as client:
        food_res, disp_res = await asyncio.gather(
            client.get(f"{HDX_BASE}/food/food-security", params={"output_format": "json", "limit": 5000}),
            client.get(f"{HDX_BASE}/coordination-context/refugees", params={"output_format": "json", "limit": 5000}),
        )
    food_res.raise_for_status()
    disp_res.raise_for_status()
    return food_res.json().get("data", []), disp_res.json().get("data", [])


import asyncio  # noqa: E402 — imported here to avoid circular at module level
