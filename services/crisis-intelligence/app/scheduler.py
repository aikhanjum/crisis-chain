"""
APScheduler cron — runs the full crisis intelligence + NGO discovery pipeline
every 6 hours. Also available as a one-shot via POST /regions/refresh.
"""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.services.region_pipeline import run_full_pipeline

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


@scheduler.scheduled_job("interval", hours=6, id="crisis_refresh")
async def run_crisis_pipeline():
    log.info("[scheduler] Triggering crisis intelligence pipeline")
    try:
        results = await run_full_pipeline()
        log.info(f"[scheduler] Pipeline complete: {results}")
    except Exception as exc:
        log.error(f"[scheduler] Pipeline error: {exc}", exc_info=True)


def start_scheduler():
    scheduler.start()
    log.info("[scheduler] Started — crisis pipeline runs every 6 hours")
