"""
Approved items matcher.

The approved items list lives in the `approved_items` DB table so it can be
updated by admins without redeploying. This module loads it and matches
receipt line items against it.

Approved categories (seeded in migrations/seed.sql):
  - food
  - water_sanitation
  - medicine
  - shelter_materials
  - hygiene_supplies
  - emergency_tools       (e.g. generators, pumps)

Rejected categories:
  - electronics
  - vehicles
  - administrative
  - ambiguous
"""

# TODO: load from DB instead of this hardcoded list
APPROVED_KEYWORDS: dict[str, str] = {
    # food
    "rice": "food", "wheat": "food", "flour": "food", "beans": "food",
    "lentils": "food", "canned": "food", "ration": "food", "nutrition": "food",
    # water
    "water": "water_sanitation", "filter": "water_sanitation", "purification": "water_sanitation",
    "jerrycan": "water_sanitation", "tank": "water_sanitation",
    # medicine
    "medicine": "medicine", "antibiotic": "medicine", "vaccine": "medicine",
    "bandage": "medicine", "gauze": "medicine", "paracetamol": "medicine",
    "ibuprofen": "medicine", "first aid": "medicine", "ors": "medicine",
    # shelter
    "tarp": "shelter_materials", "tent": "shelter_materials", "blanket": "shelter_materials",
    "sleeping bag": "shelter_materials", "plastic sheet": "shelter_materials",
    # hygiene
    "soap": "hygiene_supplies", "sanitizer": "hygiene_supplies", "mask": "hygiene_supplies",
    "toothbrush": "hygiene_supplies", "sanitary": "hygiene_supplies",
}

REJECTED_KEYWORDS = ["laptop", "phone", "vehicle", "car", "fuel", "salary", "admin",
                     "computer", "tv", "television", "entertainment"]


def classify_item(name: str) -> tuple[bool, str | None, str | None]:
    """
    Returns (approved, category, flag_reason).
    """
    lower = name.lower()
    for keyword, category in APPROVED_KEYWORDS.items():
        if keyword in lower:
            return True, category, None
    for keyword in REJECTED_KEYWORDS:
        if keyword in lower:
            return False, None, f"Category not approved: matches '{keyword}'"
    return False, None, "Unrecognized item — requires manual review"
