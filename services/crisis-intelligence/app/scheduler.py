"""
APScheduler cron job — runs the crisis data pipeline every 6 hours.

TODO:
1. Call ACLED, HDX, ReliefWeb clients
2. Normalize into CrisisNode list via normalizer.py
3. Upsert into crisis_nodes table (ON CONFLICT region_id DO UPDATE)
4. For each new or updated node above severity threshold, POST to
   blockchain-bridge /deploy-pool to trigger contract deployment
5. POST to ai-summary /batch-summarize with updated region IDs
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()


@scheduler.scheduled_job("interval", hours=6, id="crisis_refresh")
async def run_crisis_pipeline():
    # TODO: import and call pipeline steps
    print("[scheduler] Running crisis intelligence pipeline...")


def start_scheduler():
    scheduler.start()
    print("[scheduler] Started — crisis pipeline runs every 6 hours")
