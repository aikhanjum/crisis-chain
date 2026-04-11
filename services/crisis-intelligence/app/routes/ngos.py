import os
import hmac
import hashlib
import time
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app import db
from app.models.ngo import NgoDiscoveryResult
from app.services.ngo_pipeline import discover_ngos_for_region
from app.services.email_sender import send_ngo_invite

router = APIRouter(prefix="/ngos", tags=["ngos"])

INVITE_SECRET = os.environ.get("INVITE_SECRET", "change-me-in-production")
INVITE_TTL_SECONDS = 7 * 24 * 3600  # 7 days


def _make_invite_token(discovered_ngo_id: str) -> str:
    """
    Create a signed invite token: base64( id + "." + expires_at + "." + hmac )
    No JWT library needed — HMAC-SHA256 is sufficient for a one-time invite link.
    """
    import base64
    expires_at = int(time.time()) + INVITE_TTL_SECONDS
    payload = f"{discovered_ngo_id}.{expires_at}"
    sig = hmac.new(INVITE_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    raw = f"{payload}.{sig}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _verify_invite_token(token: str) -> str | None:
    """
    Verify the token and return the discovered_ngo_id, or None if invalid/expired.
    Used by POST /ngos/register when JWT auth is implemented (see TASKS.md).
    """
    import base64
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        ngo_id, expires_at_str, sig = raw.rsplit(".", 2)
        expires_at = int(expires_at_str)
        if time.time() > expires_at:
            return None
        payload = f"{ngo_id}.{expires_at_str}"
        expected = hmac.new(INVITE_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        return ngo_id
    except Exception:
        return None


@router.post("/discover/{region_id}", response_model=NgoDiscoveryResult)
async def discover_ngos(region_id: str):
    """
    Run the full NGO discovery pipeline for one region synchronously.
    Returns discovered NGOs with email addresses.
    Use POST /regions/refresh to run for all regions as a background task.
    """
    row = await db.fetchrow(
        "SELECT country FROM crisis_nodes WHERE region_id = $1", region_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Region not found")

    return await discover_ngos_for_region(region_id, row["country"])


@router.get("/{region_id}")
async def list_discovered_ngos(region_id: str, status: str | None = None):
    """List all NGOs discovered for a region, optionally filtered by status."""
    sql = "SELECT * FROM discovered_ngos WHERE region_id = $1"
    args: list = [region_id]
    if status:
        sql += " AND status = $2"
        args.append(status)
    sql += " ORDER BY discovered_at DESC"
    return await db.fetch(sql, *args)


@router.get("/{region_id}/with-email")
async def list_ngos_with_email(region_id: str):
    """NGOs that have a confirmed or inferred contact email."""
    return await db.fetch(
        """
        SELECT org_name, domain, contact_email, email_source,
               mail_provider, status, discovered_at
        FROM discovered_ngos
        WHERE region_id = $1 AND contact_email IS NOT NULL
        ORDER BY
            CASE email_source WHEN 'scraped' THEN 0 WHEN 'inferred' THEN 1 ELSE 2 END,
            discovered_at DESC
        """,
        region_id,
    )


@router.post("/invite/{discovered_ngo_id}")
async def invite_ngo(discovered_ngo_id: str):
    """
    Send a registration invite email to a discovered NGO.
    Generates a signed token embedded in the registration link.

    Idempotent — safe to call again if the first email was missed.
    Updates invite_sent_at and status = 'invited' in discovered_ngos.
    """
    row = await db.fetchrow(
        """
        SELECT d.id, d.org_name, d.contact_email, d.region_id,
               c.name AS region_name
        FROM discovered_ngos d
        LEFT JOIN crisis_nodes c ON c.region_id = d.region_id
        WHERE d.id = $1
        """,
        discovered_ngo_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Discovered NGO not found")
    if not row["contact_email"]:
        raise HTTPException(status_code=422, detail="No contact email for this NGO")
    if row["status"] == "registered":
        raise HTTPException(status_code=409, detail="NGO has already registered")

    token = _make_invite_token(discovered_ngo_id)
    region_name = row["region_name"] or row["region_id"] or "your region"

    sent = await send_ngo_invite(
        to_email=row["contact_email"],
        org_name=row["org_name"],
        region_name=region_name,
        invite_token=token,
    )
    if not sent:
        raise HTTPException(status_code=502, detail="Email delivery failed — check RESEND_API_KEY")

    await db.execute(
        "UPDATE discovered_ngos SET invite_sent_at = NOW(), status = 'invited' WHERE id = $1",
        discovered_ngo_id,
    )

    return {
        "status": "invited",
        "to": row["contact_email"],
        "org_name": row["org_name"],
        "region_name": region_name,
    }


@router.post("/register")
async def register_ngo(body: dict):
    """
    NGO self-registration endpoint.
    Called from the frontend /ngo/register page after wallet connect.
    Links a wallet address to a previously discovered NGO record.

    Required fields: wallet_address, org_name, country, operated_regions (list),
                     contact_email, reg_number (optional)

    On success: creates a row in `ngos` with status='pending'.
    Admin must then approve via grantRole() on the smart contract.
    """
    wallet = (body.get("wallet_address") or "").lower()
    org_name = body.get("org_name", "").strip()
    contact_email = body.get("contact_email", "").strip().lower()

    if not wallet or not org_name:
        raise HTTPException(status_code=400, detail="wallet_address and org_name required")

    # Find matching discovered_ngo by email to link records
    discovered_id = None
    if contact_email:
        row = await db.fetchrow(
            "SELECT id FROM discovered_ngos WHERE contact_email = $1 LIMIT 1",
            contact_email,
        )
        if row:
            discovered_id = row["id"]

    try:
        await db.execute(
            """
            INSERT INTO ngos
                (wallet_address, org_name, country, reg_number, operated_regions,
                 contact_email, status, email_source, discovered_ngo_id)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)
            ON CONFLICT (wallet_address) DO UPDATE SET
                org_name         = EXCLUDED.org_name,
                contact_email    = EXCLUDED.contact_email,
                operated_regions = EXCLUDED.operated_regions,
                discovered_ngo_id = EXCLUDED.discovered_ngo_id
            """,
            wallet,
            org_name,
            body.get("country"),
            body.get("reg_number"),
            body.get("operated_regions", []),
            contact_email or None,
            "manual",
            discovered_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # Mark discovered_ngo as registered
    if discovered_id:
        await db.execute(
            "UPDATE discovered_ngos SET status = 'registered', registered_at = NOW() WHERE id = $1",
            discovered_id,
        )

    return {
        "status": "pending",
        "wallet_address": wallet,
        "message": "Registration received. Your wallet will be whitelisted after admin review.",
    }
