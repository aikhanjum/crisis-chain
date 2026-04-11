from fastapi import FastAPI
from app.routes.summary import router as summary_router

app = FastAPI(
    title="CrisisChain — AI Summary Service",
    description="Generates neutral 2-3 sentence crisis summaries using Claude.",
    version="0.1.0",
)

app.include_router(summary_router)


@app.get("/health")
async def health():
    return {"ok": True}
