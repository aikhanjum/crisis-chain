from fastapi import FastAPI
from app.routes.receipt import router as receipt_router

app = FastAPI(
    title="CrisisChain — OCR Receipt Service",
    description="Parses NGO receipts and enforces the approved items list.",
    version="0.1.0",
)

app.include_router(receipt_router)


@app.get("/health")
async def health():
    return {"ok": True}
