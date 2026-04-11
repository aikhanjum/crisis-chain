from pydantic import BaseModel
from typing import Optional


class LineItem(BaseModel):
    name: str
    quantity: float
    unit_price: float
    total: float
    approved: bool
    category: Optional[str] = None  # e.g. "food", "medicine", "shelter"
    flag_reason: Optional[str] = None  # why it was flagged, if any


class ReceiptParseResult(BaseModel):
    receipt_id: str
    ngo_wallet: str
    region_id: str
    approved_items: list[LineItem]
    flagged_items: list[LineItem]
    total_approved_amount: float   # sum of approved line items
    total_flagged_amount: float
    raw_ocr_text: str
    ipfs_hash: Optional[str] = None  # set after upload to IPFS


class ReimbursementRequest(BaseModel):
    receipt_id: str
    ngo_wallet: str
    region_id: str
    approved_amount: float
    receipt_hash: str   # IPFS CID
    item_notes: str     # e.g. "42x water filters, 10x first aid kits"
