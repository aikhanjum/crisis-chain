from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db  # TODO: implement in app/db.py

router = APIRouter(prefix="/regions", tags=["regions"])


@router.get("/")
async def list_regions(db: AsyncSession = Depends(get_db)):
    """
    Return all active crisis nodes.
    TODO: SELECT * FROM crisis_nodes ORDER BY severity_score DESC
    """
    # placeholder
    return []


@router.get("/{region_id}")
async def get_region(region_id: str, db: AsyncSession = Depends(get_db)):
    """
    Return a single crisis node by ID.
    TODO: SELECT * FROM crisis_nodes WHERE region_id = :region_id
    """
    return {"region_id": region_id}


@router.post("/refresh")
async def trigger_refresh():
    """
    Manually trigger a data refresh cycle (normally runs on cron).
    TODO: enqueue a background task that calls ACLED, HDX, ReliefWeb,
          normalizes, upserts crisis_nodes, then pings ai-summary.
    """
    return {"status": "refresh enqueued"}
