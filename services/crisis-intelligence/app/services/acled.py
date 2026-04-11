"""
ACLED (Armed Conflict Location & Event Data) API client.
Docs: https://acleddata.com/api-documentation

OAuth: POST /oauth/token (grant_type=password or refresh_token, client_id=acled),
then GET /api/acled/read with Authorization: Bearer <access_token>.

Tokens are cached in process memory for the server session and refreshed before
expiry (with skew) or after a 401 using refresh_token when available.
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from datetime import datetime, date, timedelta, timezone
from typing import Any

import httpx

from app import db

log = logging.getLogger(__name__)

ACLED_ORIGIN = "https://acleddata.com"
ACLED_OAUTH_PATH = "/oauth/token"
ACLED_READ_PATH = "/api/acled/read"

# Renew this many seconds before access_token expires (default ACLED: 86400)
TOKEN_EXPIRY_SKEW_SEC = 120

# Conflict event types ordered by severity weight
EVENT_WEIGHTS: dict[str, float] = {
    "Battles": 1.0,
    "Explosions/Remote violence": 0.9,
    "Violence against civilians": 0.9,
    "Riots": 0.5,
    "Protests": 0.2,
    "Strategic developments": 0.3,
}


def _query_end_date() -> date:
    """
    Inclusive end date for ACLED API BETWEEN filter and for scoring from acled_events.

    If the host clock is ahead of ACLED's published coverage (e.g. system date in 2026+ while
    the API has no events yet for that range), a plain "last 30 days from today" returns zero rows.

    Override with ACLED_QUERY_END_DATE=YYYY-MM-DD, or raise the cap year via ACLED_DATA_CAP_YEAR
    (default 2026) so the effective end is min(today, YYYY-12-31).
    """
    raw = os.environ.get("ACLED_QUERY_END_DATE", "").strip()
    if raw:
        return date.fromisoformat(raw)
    today = date.today()
    cap_year = int(os.environ.get("ACLED_DATA_CAP_YEAR", "2026"))
    cap_end = date(cap_year, 12, 31)
    return min(today, cap_end)


def _query_start_date(days_back: int) -> date:
    return _query_end_date() - timedelta(days=days_back)


@dataclass
class _OAuthSession:
    access_token: str | None = None
    refresh_token: str | None = None
    expires_at_utc: datetime | None = None

    def access_valid(self) -> bool:
        if not self.access_token or not self.expires_at_utc:
            return False
        return datetime.now(timezone.utc) < self.expires_at_utc

    def clear_access(self) -> None:
        self.access_token = None
        self.expires_at_utc = None

    def set_from_oauth_response(self, body: dict[str, Any]) -> None:
        self.access_token = body["access_token"]
        if "refresh_token" in body and body["refresh_token"]:
            self.refresh_token = body["refresh_token"]
        expires_in = int(body.get("expires_in", 86400))
        safe = max(60, expires_in - TOKEN_EXPIRY_SKEW_SEC)
        self.expires_at_utc = datetime.now(timezone.utc) + timedelta(seconds=safe)


_oauth_lock = asyncio.Lock()
_session = _OAuthSession()


def _filter_rows_by_date_window(
    rows: list[dict[str, Any]], start: date, end: date
) -> list[dict[str, Any]]:
    """Keep only rows whose event_date falls in [start, end] (API may ignore filters)."""
    out: list[dict[str, Any]] = []
    for r in rows:
        ed = r.get("event_date")
        if not ed or not isinstance(ed, str):
            continue
        try:
            d = datetime.strptime(ed[:10], "%Y-%m-%d").date()
        except ValueError:
            continue
        if start <= d <= end:
            out.append(r)
    return out


def _parse_read_body(body: Any) -> list[dict[str, Any]]:
    """Normalize ACLED read JSON (may include top-level status + data)."""
    if not isinstance(body, dict):
        return []
    st = body.get("status")
    if st is not None and st != 200:
        return []
    data = body.get("data")
    if isinstance(data, list):
        return data
    return []


async def _oauth_token_request(client: httpx.AsyncClient, data: dict[str, str]) -> dict[str, Any]:
    r = await client.post(
        ACLED_OAUTH_PATH,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    r.raise_for_status()
    return r.json()


async def _ensure_oauth_tokens(client: httpx.AsyncClient, *, after_401: bool) -> str:
    """
    Return a valid Bearer access token. Uses in-memory cache, refresh_token,
    or password grant. Optional env ACLED_ACCESS_TOKEN bypasses OAuth entirely.
    """
    static = os.environ.get("ACLED_ACCESS_TOKEN", "").strip()
    if static:
        return static

    username = os.environ.get("ACLED_EMAIL", "").strip()
    password = os.environ.get("ACLED_PASSWORD", "")
    if not username or not password:
        raise ValueError(
            "Set ACLED_EMAIL and ACLED_PASSWORD for OAuth, or ACLED_ACCESS_TOKEN for a static Bearer token."
        )

    async with _oauth_lock:
        if not after_401 and _session.access_valid():
            return _session.access_token  # type: ignore[return-value]

        # After 401: drop cached access so we re-auth
        if after_401:
            _session.clear_access()

        if _session.refresh_token and (after_401 or not _session.access_valid()):
            try:
                body = await _oauth_token_request(
                    client,
                    {
                        "refresh_token": _session.refresh_token,
                        "grant_type": "refresh_token",
                        "client_id": "acled",
                    },
                )
                _session.set_from_oauth_response(body)
                return _session.access_token  # type: ignore[return-value]
            except httpx.HTTPStatusError:
                _session.refresh_token = None
                _session.clear_access()

        body = await _oauth_token_request(
            client,
            {
                "username": username,
                "password": password,
                "grant_type": "password",
                "client_id": "acled",
            },
        )
        _session.set_from_oauth_response(body)
        return _session.access_token  # type: ignore[return-value]


async def fetch_and_cache(days_back: int = 30) -> list[dict[str, Any]]:
    """
    Pull recent events from ACLED and upsert into acled_events cache table.
    Returns raw rows.

    ACLED's /read endpoint returns the first N rows of a year when using BETWEEN on event_date,
    not the rows in that date range. We request one HTTP call per calendar day with
    event_date = that day (equality), which matches the API behavior we verified.
    """
    end = _query_end_date()
    start = _query_start_date(days_back)
    fetch_limit = int(os.environ.get("ACLED_FETCH_LIMIT", "5000"))
    max_days = int(os.environ.get("ACLED_MAX_FETCH_DAYS", "31"))
    span_days = (end - start).days + 1
    if span_days > max_days:
        start = end - timedelta(days=max_days - 1)

    fields = "event_id_cnty|event_date|event_type|country|iso3|latitude|longitude|fatalities|notes"
    seen_ids: set[str] = set()
    rows: list[dict[str, Any]] = []

    async with httpx.AsyncClient(
        base_url=ACLED_ORIGIN,
        timeout=60.0,
        follow_redirects=True,
        headers={"Accept": "application/json"},
    ) as client:
        token = await _ensure_oauth_tokens(client, after_401=False)
        headers = {"Authorization": f"Bearer {token}"}

        d = start
        while d <= end:
            params: dict[str, str | int] = {
                "_format": "json",
                "limit": fetch_limit,
                "year": d.year,
                "event_date": d.isoformat(),
                "fields": fields,
            }
            response = await client.get(ACLED_READ_PATH, params=params, headers=headers)

            if response.status_code == 401 and not os.environ.get("ACLED_ACCESS_TOKEN", "").strip():
                token = await _ensure_oauth_tokens(client, after_401=True)
                headers = {"Authorization": f"Bearer {token}"}
                response = await client.get(ACLED_READ_PATH, params=params, headers=headers)

            response.raise_for_status()
            body = response.json()
            if isinstance(body, dict) and "status" in body and body["status"] != 200:
                raise RuntimeError(
                    f"ACLED API error: status={body.get('status')} message={body.get('message', body)}"
                )
            for r in _parse_read_body(body):
                eid = r.get("event_id_cnty")
                if not eid or eid in seen_ids:
                    continue
                seen_ids.add(eid)
                rows.append(r)

            d += timedelta(days=1)

    rows = _filter_rows_by_date_window(rows, start, end)

    if not rows:
        log.warning(
            "[acled] No events for window %s–%s. ACLED may not publish this range yet; "
            "set ACLED_QUERY_END_DATE or ACLED_DATA_CAP_YEAR to a year the API returns "
            "(check myACLED access / data lag).",
            start,
            end,
        )

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
    end = _query_end_date()
    since = _query_start_date(days_back)
    rows = await db.fetch(
        """
        SELECT country, iso3, lat, lng, fatalities, event_type
        FROM acled_events
        WHERE event_date >= $1 AND event_date <= $2
        """,
        since,
        end,
    )

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
