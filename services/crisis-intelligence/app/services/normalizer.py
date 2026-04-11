"""
Normalizer — merges data from ACLED, HDX, and ReliefWeb into a unified CrisisNode.

Scoring algorithm (TODO — tune weights):
  severity_score = (
    0.5 * acled_score       # conflict intensity (fatalities + event_count)
    + 0.3 * hdx_score       # food insecurity + displacement
    + 0.2 * inform_score    # INFORM Risk Index baseline
  )

severity_level thresholds:
  critical: >= 80
  high:     >= 60
  medium:   >= 40
  low:      < 40
"""

from datetime import datetime, timezone
from app.models.crisis_node import CrisisNode


def score_to_level(score: float) -> str:
    if score >= 80:
        return "critical"
    if score >= 60:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def build_crisis_node(
    region_id: str,
    name: str,
    country: str,
    lat: float,
    lng: float,
    acled_score: float,
    hdx_score: float,
    inform_score: float,
    source_links: list[str],
) -> CrisisNode:
    """Combine source scores into a single CrisisNode."""
    # TODO: tune weights based on data distribution
    score = (0.5 * acled_score) + (0.3 * hdx_score) + (0.2 * inform_score)
    score = min(100.0, max(0.0, score))

    return CrisisNode(
        region_id=region_id,
        name=name,
        country=country,
        lat=lat,
        lng=lng,
        severity_score=round(score, 1),
        severity_level=score_to_level(score),
        summary="",  # populated by ai-summary service
        last_updated=datetime.now(timezone.utc),
        source_links=source_links,
    )
