"""
OCR pipeline — extracts line items from receipt images/PDFs.

Primary: Google Cloud Vision API (most accurate for receipts in multiple languages)
Fallback: pytesseract (local, no API key required for dev)

TODO:
- Set GOOGLE_VISION_CREDENTIALS in .env for production
- Handle multi-page PDFs (convert pages to images first with pdf2image)
- Add currency normalization (USD, EUR, local → USD)
- Add line-item parser that handles tabular receipt formats
"""

import os
import re
from pathlib import Path


async def extract_text_from_image(image_bytes: bytes) -> str:
    """
    Run OCR on image bytes. Returns raw extracted text.

    Production path: Google Vision API
    Dev path: pytesseract
    """
    use_vision = bool(os.environ.get("GOOGLE_VISION_CREDENTIALS"))

    if use_vision:
        return await _google_vision_ocr(image_bytes)
    else:
        return _tesseract_ocr(image_bytes)


async def _google_vision_ocr(image_bytes: bytes) -> str:
    # TODO: implement with google-cloud-vision
    # from google.cloud import vision
    # client = vision.ImageAnnotatorClient()
    # image = vision.Image(content=image_bytes)
    # response = client.text_detection(image=image)
    # return response.full_text_annotation.text
    raise NotImplementedError("Set GOOGLE_VISION_CREDENTIALS to enable Vision API")


def _tesseract_ocr(image_bytes: bytes) -> str:
    import pytesseract
    from PIL import Image
    import io
    img = Image.open(io.BytesIO(image_bytes))
    return pytesseract.image_to_string(img)


def parse_line_items(raw_text: str) -> list[dict]:
    """
    Attempt to extract line items from raw OCR text.
    Returns list of dicts: {name, quantity, unit_price, total}

    TODO: This is a heuristic parser — replace with a more robust
    tabular extraction approach for production.
    """
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
    items = []
    # Simple pattern: "Item Name   qty   $price"
    pattern = re.compile(r"^(.+?)\s+(\d+(?:\.\d+)?)\s+\$?([\d,]+\.?\d*)$")
    for line in lines:
        match = pattern.match(line)
        if match:
            name, qty, price = match.groups()
            items.append({
                "name": name.strip(),
                "quantity": float(qty),
                "unit_price": float(price.replace(",", "")),
                "total": float(qty) * float(price.replace(",", "")),
            })
    return items
