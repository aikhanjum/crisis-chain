"""
Simple in-memory + DB cache for AI summaries.
Prevents regenerating summaries on every cron tick.

TODO: Replace in-memory dict with Redis for multi-replica safety.
Cache TTL should match the crisis intelligence cron interval (6h).
"""

from datetime import datetime, timezone, timedelta
from app.models.summary import SummaryResponse

CACHE_TTL_HOURS = 6

_cache: dict[str, SummaryResponse] = {}


def get_cached(region_id: str) -> SummaryResponse | None:
    entry = _cache.get(region_id)
    if not entry:
        return None
    age = datetime.now(timezone.utc) - entry.generated_at
    if age > timedelta(hours=CACHE_TTL_HOURS):
        del _cache[region_id]
        return None
    entry.cached = True
    return entry


def set_cache(region_id: str, summary: SummaryResponse) -> None:
    _cache[region_id] = summary
