"""
Email sender using the Resend API.
Docs: https://resend.com/docs/api-reference/emails/send-email

Used for:
  - NGO invite emails: sends a registration link to a discovered NGO's contact address

Set RESEND_API_KEY and RESEND_FROM_ADDRESS in .env.
"""

import os
import httpx

RESEND_API = "https://api.resend.com/emails"
FROM_ADDRESS = os.environ.get("RESEND_FROM_ADDRESS", "CrisisChain <noreply@crisischain.org>")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")


async def send_ngo_invite(
    to_email: str,
    org_name: str,
    region_name: str,
    invite_token: str,
) -> bool:
    """
    Send an NGO platform invite email with a tokenized registration link.
    Returns True on success, False on failure (non-raising — pipeline must not crash on email errors).
    """
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        raise EnvironmentError("RESEND_API_KEY is not set")

    register_url = f"{FRONTEND_URL}/ngo/register?token={invite_token}"

    html = _build_invite_html(org_name=org_name, region_name=region_name, register_url=register_url)
    text = _build_invite_text(org_name=org_name, region_name=region_name, register_url=register_url)

    payload = {
        "from": FROM_ADDRESS,
        "to": [to_email],
        "subject": f"CrisisChain — Join the humanitarian aid platform for {region_name}",
        "html": html,
        "text": text,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                RESEND_API,
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
        response.raise_for_status()
        return True
    except httpx.HTTPStatusError as exc:
        # Log but don't raise — a failed email should not abort the discovery pipeline
        print(f"[email] Resend API error {exc.response.status_code}: {exc.response.text}")
        return False
    except Exception as exc:
        print(f"[email] Send failed: {exc}")
        return False


def _build_invite_html(org_name: str, region_name: str, register_url: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; color: #111; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1d4ed8;">CrisisChain — Transparent Humanitarian Aid</h2>
  <p>Hi {org_name},</p>
  <p>
    We've identified your organization as active in the <strong>{region_name}</strong> region
    and would like to invite you to join <strong>CrisisChain</strong>.
  </p>
  <p>
    CrisisChain is a blockchain-powered platform that lets donors fund regional aid pools directly.
    As a participating NGO, you can submit receipts for approved humanitarian purchases and receive
    reimbursements automatically — with every transaction publicly verifiable on-chain.
  </p>
  <p>
    <strong>How it works:</strong>
  </p>
  <ol>
    <li>Click the link below and connect your organization's crypto wallet</li>
    <li>Complete the registration form (org name, country, registration number)</li>
    <li>Our team reviews and approves your application</li>
    <li>Submit receipts for approved items — water, food, medicine, shelter materials</li>
    <li>Receive USDC reimbursements directly to your wallet, with on-chain receipts</li>
  </ol>
  <p style="margin: 32px 0;">
    <a href="{register_url}"
       style="background: #1d4ed8; color: white; padding: 12px 24px; border-radius: 8px;
              text-decoration: none; font-weight: bold; display: inline-block;">
      Complete Registration →
    </a>
  </p>
  <p style="color: #6b7280; font-size: 13px;">
    This link expires in 7 days. If you did not expect this email, you can safely ignore it.
  </p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
  <p style="color: #6b7280; font-size: 12px;">
    CrisisChain · Built for transparent humanitarian aid ·
    <a href="{register_url}" style="color: #6b7280;">View in browser</a>
  </p>
</body>
</html>
"""


def _build_invite_text(org_name: str, region_name: str, register_url: str) -> str:
    return f"""Hi {org_name},

We've identified your organization as active in the {region_name} region and would like to
invite you to join CrisisChain — a blockchain-powered humanitarian aid platform.

CrisisChain lets donors fund regional aid pools directly. As a participating NGO, you can
submit receipts for approved humanitarian purchases and receive USDC reimbursements automatically,
with every transaction publicly verifiable on-chain.

Complete your registration here:
{register_url}

This link expires in 7 days.

—
CrisisChain · Transparent Humanitarian Aid
"""
