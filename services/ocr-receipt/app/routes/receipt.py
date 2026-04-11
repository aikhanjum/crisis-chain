import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services.ocr import extract_text_from_image, parse_line_items
from app.services.approved_items import classify_item
from app.models.receipt import LineItem, ReceiptParseResult

router = APIRouter(prefix="/receipt", tags=["receipt"])


@router.post("/parse", response_model=ReceiptParseResult)
async def parse_receipt(
    file: UploadFile = File(...),
    ngo_wallet: str = Form(...),
    region_id: str = Form(...),
):
    """
    Upload a receipt image or PDF.
    Returns approved line items, flagged items, and total approved amount.

    Flow:
    1. Extract text via OCR
    2. Parse line items from raw text
    3. Classify each item (approved / flagged)
    4. Return structured result

    TODO: after parse, NGO reviews flagged items on the frontend,
    then calls /receipt/submit to queue the reimbursement.
    """
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    raw_text = await extract_text_from_image(image_bytes)
    raw_items = parse_line_items(raw_text)

    approved, flagged = [], []
    for item in raw_items:
        ok, category, reason = classify_item(item["name"])
        li = LineItem(
            name=item["name"],
            quantity=item["quantity"],
            unit_price=item["unit_price"],
            total=item["total"],
            approved=ok,
            category=category,
            flag_reason=reason,
        )
        (approved if ok else flagged).append(li)

    return ReceiptParseResult(
        receipt_id=str(uuid.uuid4()),
        ngo_wallet=ngo_wallet,
        region_id=region_id,
        approved_items=approved,
        flagged_items=flagged,
        total_approved_amount=sum(i.total for i in approved),
        total_flagged_amount=sum(i.total for i in flagged),
        raw_ocr_text=raw_text,
    )


@router.post("/submit")
async def submit_reimbursement(receipt_id: str, ngo_wallet: str, region_id: str):
    """
    After NGO reviews parse result, submit for reimbursement.

    TODO:
    1. Load parsed result from DB
    2. Upload receipt image to IPFS via blockchain-bridge
    3. POST reimbursement request to blockchain-bridge → queue contract
    4. Return queue position
    """
    return {"status": "queued", "receipt_id": receipt_id, "queue_position": None}
