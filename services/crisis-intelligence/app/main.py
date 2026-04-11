import logging
from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.routes.regions import router as regions_router
from app.routes.ngos import router as ngos_router
from app.scheduler import start_scheduler

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield


app = FastAPI(
    title="CrisisChain — Crisis Intelligence Service",
    description="Scrapes ACLED, HDX, and ReliefWeb. Discovers NGOs via website + DNS.",
    version="0.2.0",
    lifespan=lifespan,
)

app.include_router(regions_router)
app.include_router(ngos_router)


@app.get("/health")
async def health():
    return {"ok": True}
