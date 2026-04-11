from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.routes.regions import router as regions_router
from app.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield


app = FastAPI(
    title="CrisisChain — Crisis Intelligence Service",
    description="Pulls from ACLED, HDX, and ReliefWeb to populate the crisis heatmap.",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(regions_router)


@app.get("/health")
async def health():
    return {"ok": True}
