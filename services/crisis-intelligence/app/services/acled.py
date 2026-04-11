"""
ACLED (Armed Conflict Location & Event Data) API client.
Docs: https://apidocs.acleddata.com/

Fetches conflict events for the last N days, caches them in `acled_events`,
then returns per-country severity scores and centroid coordinates.
"""

import os
import math
import httpx
from datetime import datetime, date, timedelta
from typing import Any
from app import db

ACLED_BASE = "https://api.acleddata.com/acled/read"

# Conflict event types ordered by severity weight
EVENT_WEIGHTS: dict[str, float] = {
    "Battles": 1.0,
    "Explosions/Remote violence": 0.9,
    "Violence against civilians": 0.9,
    "Riots": 0.5,
    "Protests": 0.2,
    "Strategic developments": 0.3,
}


async def fetch_and_cache(days_back: int = 30) -> list[dict[str, Any]]:
    """
    Pull recent events from ACLED and upsert into acled_events cache table.
    Returns raw rows.
    """
    since = (date.today() - timedelta(days=days_back)).isoformat()
    params = {
        "email": os.environ["ACLED_EMAIL"],
        "key": os.environ["ACLED_API_KEY"],
        "limit": 5000,
        "event_date": since,
        "event_date_where": "BETWEEN",
        "event_date2": date.today().isoformat(),
        "fields": "event_id_cnty|event_date|event_type|country|iso3|latitude|longitude|fatalities|notes",
    }
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(ACLED_BASE, params=params)
        response.raise_for_status()
    rows: list[dict[str, Any]] = response.json().get("data", [])

    # Upsert into cache
    if rows:
        await db.executemany(
            """
            INSERT INTO acled_events
                (event_id, event_date, event_type, country, iso3, lat, lng, fatalities, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (event_id) DO NOTHING
            """,
            [
                (
                    r["event_id_cnty"],
                    datetime.strptime(r["event_date"], "%Y-%m-%d").date(),
                    r.get("event_type", ""),
                    r.get("country", ""),
                    r.get("iso3"),
                    float(r.get("latitude") or 0),
                    float(r.get("longitude") or 0),
                    int(r.get("fatalities") or 0),
                    r.get("notes", ""),
                )
                for r in rows
                if r.get("event_id_cnty") and r.get("latitude") and r.get("longitude")
            ],
        )

    return rows


async def score_by_country(days_back: int = 30) -> dict[str, dict[str, Any]]:
    """
    Read cached events for the last `days_back` days and return a dict:
        country_name → {
            score: float (0–100),
            lat: float,          # centroid of events
            lng: float,
            event_count: int,
            fatalities: int,
            iso3: str | None,
            source_links: list[str],
        }

    Scoring formula:
        raw = fatalities * 2 + weighted_event_count
        score = min(100, raw / NORMALIZATION * 100)

    NORMALIZATION = 200 is tuned so that ~100 fatalities + 50 events ≈ 100 score.
    Adjust based on observed data distribution.
    """
    since = date.today() - timedelta(days=days_back)
    rows = await db.fetch(
        """
        SELECT country, iso3, lat, lng, fatalities, event_type
        FROM acled_events
        WHERE event_date >= $1
        """,
        since,
    )

    # Group by country
    by_country: dict[str, dict[str, Any]] = {}
    for r in rows:
        country = r["country"]
        if country not in by_country:
            by_country[country] = {
                "fatalities": 0,
                "weighted_events": 0.0,
                "lat_sum": 0.0,
                "lng_sum": 0.0,
                "count": 0,
                "iso3": r["iso3"],
            }
        entry = by_country[country]
        entry["fatalities"] += r["fatalities"]
        entry["weighted_events"] += EVENT_WEIGHTS.get(r["event_type"], 0.3)
        entry["lat_sum"] += r["lat"]
        entry["lng_sum"] += r["lng"]
        entry["count"] += 1

    NORMALIZATION = 200.0
    result: dict[str, dict[str, Any]] = {}
    for country, data in by_country.items():
        raw = data["fatalities"] * 2 + data["weighted_events"]
        score = min(100.0, (raw / NORMALIZATION) * 100)
        n = data["count"]
        result[country] = {
            "score": round(score, 1),
            "lat": round(data["lat_sum"] / n, 4),
            "lng": round(data["lng_sum"] / n, 4),
            "event_count": n,
            "fatalities": data["fatalities"],
            "iso3": data["iso3"],
            "source_links": [
                f"https://acleddata.com/data/#/dashboard?iso={data['iso3']}"
                if data["iso3"]
                else "https://acleddata.com/"
            ],
        }
    return result
