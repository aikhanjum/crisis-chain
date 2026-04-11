"""
Website scraper — fetches NGO pages and extracts email addresses.

Priority order for which pages to check:
  /contact-us, /contact, /about-us, /about, /donate, / (homepage)

Priority order for which email to keep:
  donate@ > info@ > contact@ > any @{same_domain} > any external email

All scraping is done with a short timeout and silent failures — a scraping
error should never block the overall pipeline.
"""

import re
import asyncio
from urllib.parse import urljoin, urlparse
import httpx

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

# Pages to try, in order
CANDIDATE_PATHS = ["/contact-us", "/contact", "/about-us", "/about", "/donate", "/"]

# Prefix weights — higher wins
EMAIL_PRIORITY: dict[str, int] = {
    "donate": 100,
    "donations": 100,
    "giving": 90,
    "info": 80,
    "information": 75,
    "contact": 70,
    "hello": 60,
    "admin": 40,
    "support": 40,
    "media": 20,
    "press": 20,
    "noreply": -100,
    "no-reply": -100,
    "bounce": -100,
    "mailer-daemon": -100,
}

HEADERS = {
    "User-Agent": "CrisisChain-NGO-Indexer/1.0 (humanitarian aid platform; contact@crisischain.org)",
    "Accept": "text/html,application/xhtml+xml",
}


async def scrape_emails(homepage_url: str, timeout: float = 10.0) -> list[str]:
    """
    Scrape `homepage_url` and its standard sub-pages for email addresses.
    Returns a list of unique emails ranked by priority (best first).
    """
    base = _normalize_base(homepage_url)
    if not base:
        return []

    domain = urlparse(base).netloc
    found: dict[str, int] = {}  # email → priority score

    async with httpx.AsyncClient(
        timeout=timeout,
        headers=HEADERS,
        follow_redirects=True,
        verify=False,  # some NGO sites have expired certs
    ) as client:
        tasks = [_fetch_emails(client, urljoin(base, path), domain) for path in CANDIDATE_PATHS]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in results:
        if isinstance(result, list):
            for email, score in result:
                if email not in found or found[email] < score:
                    found[email] = score

    # Sort by score descending, filter out negative-scored spam addresses
    ranked = [email for email, score in sorted(found.items(), key=lambda x: -x[1]) if score >= 0]
    return ranked


async def _fetch_emails(
    client: httpx.AsyncClient, url: str, domain: str
) -> list[tuple[str, int]]:
    """Fetch one URL and extract scored emails."""
    try:
        response = await client.get(url)
        if response.status_code >= 400:
            return []
        html = response.text
    except Exception:
        return []

    raw_emails = set(EMAIL_RE.findall(html))
    scored = []
    for email in raw_emails:
        email_lower = email.lower()
        # Skip image files accidentally matched (e.g. image@2x.png)
        if any(email_lower.endswith(ext) for ext in [".png", ".jpg", ".gif", ".svg"]):
            continue
        prefix = email_lower.split("@")[0]
        email_domain = email_lower.split("@")[1] if "@" in email_lower else ""
        base_score = 50 if email_domain == domain else 10
        # Apply prefix weight
        prefix_score = next(
            (v for k, v in EMAIL_PRIORITY.items() if k in prefix), 0
        )
        scored.append((email, base_score + prefix_score))

    return scored


def _normalize_base(url: str) -> str | None:
    """Ensure the URL has a scheme and returns just scheme+host."""
    if not url:
        return None
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    if not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def best_email(emails: list[str]) -> str | None:
    """Return the highest-priority email from the ranked list."""
    return emails[0] if emails else None
