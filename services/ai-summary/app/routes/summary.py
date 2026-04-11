from fastapi import APIRouter
from app.models.summary import SummaryRequest, SummaryResponse
from app.services.cache import get_cached, set_cache
from app.services.claude import generate_summary

router = APIRouter(prefix="/summary", tags=["summary"])


@router.post("/", response_model=SummaryResponse)
async def create_summary(req: SummaryRequest) -> SummaryResponse:
    """Generate (or return cached) AI summary for a crisis region."""
    cached = get_cached(req.region_id)
    if cached:
        return cached
    result = await generate_summary(req)
    set_cache(req.region_id, result)
    return result


@router.post("/batch")
async def batch_summarize(requests: list[SummaryRequest]) -> list[SummaryResponse]:
    """
    Batch endpoint called by the crisis intelligence cron job.
    Only regenerates summaries for regions whose data has changed.
    TODO: pass a content hash to skip unchanged regions.
    """
    results = []
    for req in requests:
        cached = get_cached(req.region_id)
        if cached:
            results.append(cached)
        else:
            result = await generate_summary(req)
            set_cache(req.region_id, result)
            results.append(result)
    return results
