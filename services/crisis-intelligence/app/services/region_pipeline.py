"""
Region pipeline — full end-to-end cycle run by the cron scheduler.

Steps per run:
  1. Fetch + cache ACLED events (last 30 days)
  2. Score countries from ACLED cache
  3. Score countries from HDX (food insecurity + displacement)
  4. For each country with data above MIN_SCORE_TO_INCLUDE:
       a. Build or update a CrisisNode
       b. Upsert into crisis_nodes
  5. For nodes crossing SEVERITY_DEPLOY_THRESHOLD (new or updated):
       POST to blockchain-bridge /pools/deploy
  6. For each updated node: POST to ai-summary with ReliefWeb text
  7. Trigger NGO discovery for all active regions
"""

import os
import asyncio
import httpx
import logging
from datetime import datetime, timezone

from app import db
from app.services import acled, hdx, reliefweb
from app.services.normalizer import build_crisis_node
from app.services.ngo_pipeline import discover_ngos_for_region

log = logging.getLogger(__name__)

MIN_SCORE_TO_INCLUDE = 20.0          # ignore countries with very low combined score
SEVERITY_DEPLOY_THRESHOLD = float(os.environ.get("SEVERITY_DEPLOY_THRESHOLD", 60))
BLOCKCHAIN_BRIDGE_URL = os.environ.get("BLOCKCHAIN_BRIDGE_URL", "http://blockchain-bridge:4001")
AI_SUMMARY_URL = os.environ.get("AI_SUMMARY_URL", "http://ai-summary:8002")


async def run_full_pipeline() -> dict:
    log.info("[pipeline] Starting crisis intelligence run")
    results = {"nodes_upserted": 0, "pools_deployed": 0, "summaries_requested": 0, "errors": []}

    # ── Step 1 & 2: ACLED ──────────────────────────────────────────────────
    try:
        await acled.fetch_and_cache(days_back=30)
        acled_scores = await acled.score_by_country(days_back=30)
        log.info(f"[pipeline] ACLED: scored {len(acled_scores)} countries")
    except Exception as exc:
        log.error(f"[pipeline] ACLED failed: {exc}")
        acled_scores = {}
        results["errors"].append(f"acled: {exc}")

    # ── Step 3: HDX ────────────────────────────────────────────────────────
    try:
        hdx_scores = await hdx.score_by_country()
        log.info(f"[pipeline] HDX: scored {len(hdx_scores)} countries")
    except Exception as exc:
        log.error(f"[pipeline] HDX failed: {exc}")
        hdx_scores = {}
        results["errors"].append(f"hdx: {exc}")

    # ── Step 4: Build and upsert crisis nodes ──────────────────────────────
    # Key ACLED data by country name; HDX keyed by ISO3.
    # Build a unified set of countries/regions.
    # ACLED is the driver — HDX scores are joined by ISO3 where available.
    # Full HDX-only countries (no ACLED events) are skipped for now.

    nodes_to_summarize: list[dict] = []

    for country, a_data in acled_scores.items():
        a_score = a_data["score"]
        iso3 = a_data.get("iso3")

        # Look up HDX score by ISO3
        h_data = hdx_scores.get(iso3, {}) if iso3 else {}
        h_score = h_data.get("score", 0.0)

        combined = round((0.6 * a_score) + (0.4 * h_score), 1)
        if combined < MIN_SCORE_TO_INCLUDE:
            continue

        region_id = _make_region_id(country, iso3)
        source_links = a_data.get("source_links", []) + h_data.get("source_links", [])

        node = build_crisis_node(
            region_id=region_id,
            name=f"{country} Crisis",
            country=country,
            lat=a_data["lat"],
            lng=a_data["lng"],
            acled_score=a_score,
            hdx_score=h_score,
            inform_score=0.0,   # INFORM not yet integrated
            source_links=source_links,
        )

        existing_pool_id = await _upsert_crisis_node(node)
        results["nodes_upserted"] += 1

        # ── Step 5: deploy pool if new high-severity region ──────────────
        if node.severity_score >= SEVERITY_DEPLOY_THRESHOLD and existing_pool_id is None:
            pool_id = await _request_pool_deploy(region_id)
            if pool_id:
                results["pools_deployed"] += 1

        nodes_to_summarize.append({
            "region_id": region_id,
            "country": country,
            "acled_summary": (
                f"{a_data['event_count']} conflict events, "
                f"{a_data['fatalities']} fatalities in last 30 days"
            ),
        })

    # ── Step 6: AI summaries ───────────────────────────────────────────────
    summary_tasks = [_request_summary(n) for n in nodes_to_summarize]
    summary_results = await asyncio.gather(*summary_tasks, return_exceptions=True)
    results["summaries_requested"] = sum(1 for r in summary_results if not isinstance(r, Exception))

    # ── Step 7: NGO discovery for all active regions ───────────────────────
    active_regions = await db.fetch(
        "SELECT region_id, country FROM crisis_nodes WHERE severity_score >= $1",
        MIN_SCORE_TO_INCLUDE,
    )
    ngo_tasks = [discover_ngos_for_region(r["region_id"], r["country"]) for r in active_regions]
    await asyncio.gather(*ngo_tasks, return_exceptions=True)

    log.info(f"[pipeline] Done: {results}")
    return results


async def _upsert_crisis_node(node) -> int | None:
    """
    Upsert the node into crisis_nodes. Returns existing pool_id if the row
    already existed, else None (signals that a new pool should be deployed).
    """
    existing = await db.fetchrow(
        "SELECT pool_id FROM crisis_nodes WHERE region_id = $1", node.region_id
    )

    await db.execute(
        """
        INSERT INTO crisis_nodes
            (region_id, name, country, lat, lng, severity_score, severity_level,
             last_updated, source_links)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (region_id) DO UPDATE SET
            severity_score  = EXCLUDED.severity_score,
            severity_level  = EXCLUDED.severity_level,
            last_updated    = EXCLUDED.last_updated,
            source_links    = EXCLUDED.source_links
        """,
        node.region_id,
        node.name,
        node.country,
        node.lat,
        node.lng,
        node.severity_score,
        node.severity_level,
        datetime.now(timezone.utc),
        node.source_links,
    )

    return existing["pool_id"] if existing else None


async def _request_pool_deploy(region_id: str) -> int | None:
    """POST to blockchain-bridge to deploy a new regional pool."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{BLOCKCHAIN_BRIDGE_URL}/pools/deploy",
                json={"regionId": region_id},
            )
        if response.status_code == 200:
            data = response.json()
            log.info(f"[pipeline] Pool deployed for {region_id}: {data.get('contractAddress')}")
            return data.get("poolId")
    except Exception as exc:
        log.warning(f"[pipeline] Pool deploy failed for {region_id}: {exc}")
    return None


async def _request_summary(node_data: dict) -> None:
    """POST to ai-summary service to generate/refresh the crisis summary."""
    country = node_data["country"]
    try:
        report_text = await reliefweb.fetch_text_for_summary(country)
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{AI_SUMMARY_URL}/summary/",
                json={
                    "region_id": node_data["region_id"],
                    "country": country,
                    "raw_reports": [report_text],
                    "acled_events_summary": node_data["acled_summary"],
                },
            )
        if response.status_code == 200:
            summary_data = response.json()
            # Write summary back to crisis_nodes
            await db.execute(
                "UPDATE crisis_nodes SET summary = $1, donate_copy = $2 WHERE region_id = $3",
                summary_data.get("summary", ""),
                summary_data.get("donate_copy", ""),
                node_data["region_id"],
            )
    except Exception as exc:
        log.warning(f"[pipeline] Summary failed for {country}: {exc}")


def _make_region_id(country: str, iso3: str | None) -> str:
    """Generate a stable region ID from country name + ISO3."""
    prefix = iso3 if iso3 else country[:3].upper()
    slug = country.upper().replace(" ", "_").replace("-", "_")
    return f"{prefix}-{slug}-CRISIS"
