from fastapi import APIRouter, HTTPException, BackgroundTasks
from app import db
from app.services.region_pipeline import run_full_pipeline

router = APIRouter(prefix="/regions", tags=["regions"])


@router.get("/")
async def list_regions():
    """All active crisis nodes ordered by severity."""
    return await db.fetch(
        """
        SELECT region_id, name, country, lat, lng, severity_score, severity_level,
               summary, donate_copy, last_updated, source_links, active_ngos,
               pool_id, pool_address
        FROM crisis_nodes
        ORDER BY severity_score DESC
        """
    )


@router.get("/{region_id}")
async def get_region(region_id: str):
    """Single crisis node by ID."""
    row = await db.fetchrow(
        "SELECT * FROM crisis_nodes WHERE region_id = $1", region_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Region not found")
    return row


@router.post("/refresh")
async def trigger_refresh(background_tasks: BackgroundTasks):
    """
    Manually trigger a full data refresh cycle.
    Runs in the background — returns immediately.
    """
    background_tasks.add_task(run_full_pipeline)
    return {"status": "refresh started"}
