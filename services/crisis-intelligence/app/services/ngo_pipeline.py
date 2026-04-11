"""
NGO discovery pipeline — orchestrates all 4 steps for a given region.

Steps:
  1. Query ReliefWeb Organizations API for NGOs active in the region's country
  2. For each org with a homepage: scrape for email addresses
  3. If no email found: DNS MX lookup → infer info@{domain}
  4. Upsert results into discovered_ngos table
  5. Return NgoDiscoveryResult summary

Concurrency: all orgs for a region are processed concurrently with a
semaphore to avoid hammering external sites (max 5 parallel requests).
"""

import asyncio
from urllib.parse import urlparse

from app.models.ngo import DiscoveredNgo, NgoDiscoveryResult
from app.services import reliefweb, ngo_scraper
from app.services.dns_lookup import resolve_mx, infer_email, is_valid_email_format
from app import db

MAX_CONCURRENT = 5  # max parallel website scrapes


async def discover_ngos_for_region(region_id: str, country: str) -> NgoDiscoveryResult:
    """
    Full pipeline: find → scrape → DNS → upsert for one region.
    Safe to call multiple times (upserts are idempotent).
    """
    errors: list[str] = []

    # Step 1: get orgs from ReliefWeb
    try:
        orgs = await reliefweb.fetch_orgs_by_country(country, limit=50)
    except Exception as exc:
        errors.append(f"ReliefWeb org fetch failed: {exc}")
        orgs = []

    sem = asyncio.Semaphore(MAX_CONCURRENT)
    tasks = [_process_org(org, region_id, sem, errors) for org in orgs]
    results: list[DiscoveredNgo | None] = await asyncio.gather(*tasks)

    discovered = [r for r in results if r is not None]

    # Step 4: upsert into DB
    if discovered:
        await _upsert_discovered(discovered)

    with_email = sum(1 for d in discovered if d.contact_email and d.email_source == "scraped")
    with_inferred = sum(1 for d in discovered if d.contact_email and d.email_source == "inferred")

    return NgoDiscoveryResult(
        region_id=region_id,
        discovered=discovered,
        total_found=len(discovered),
        with_email=with_email,
        with_inferred_email=with_inferred,
        errors=errors,
    )


async def _process_org(
    org: dict,
    region_id: str,
    sem: asyncio.Semaphore,
    errors: list[str],
) -> DiscoveredNgo | None:
    homepage = org.get("homepage")
    if not homepage:
        return None

    domain = urlparse(homepage).netloc.lstrip("www.")
    if not domain:
        return None

    async with sem:
        # Step 2: scrape website for emails
        try:
            emails = await ngo_scraper.scrape_emails(homepage)
        except Exception as exc:
            errors.append(f"{domain}: scrape error — {exc}")
            emails = []

        top_email = ngo_scraper.best_email(emails)
        email_source = "scraped" if top_email else None

        # Step 3: DNS MX fallback
        mx_host, provider = resolve_mx(domain)
        if not top_email:
            candidate = infer_email(domain, mx_host, provider)
            if candidate and is_valid_email_format(candidate):
                top_email = candidate
                email_source = "inferred"

    return DiscoveredNgo(
        org_name=org.get("name", domain),
        domain=domain,
        contact_email=top_email,
        email_source=email_source or "scraped",
        mx_host=mx_host,
        mail_provider=provider,
        region_id=region_id,
        source_url=org.get("source_url"),
    )


async def _upsert_discovered(ngos: list[DiscoveredNgo]) -> None:
    await db.executemany(
        """
        INSERT INTO discovered_ngos
            (org_name, domain, contact_email, email_source, mx_host,
             mail_provider, region_id, source_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (domain, region_id) DO UPDATE SET
            contact_email  = EXCLUDED.contact_email,
            email_source   = EXCLUDED.email_source,
            mx_host        = EXCLUDED.mx_host,
            mail_provider  = EXCLUDED.mail_provider,
            source_url     = EXCLUDED.source_url
        """,
        [
            (
                n.org_name, n.domain, n.contact_email, n.email_source,
                n.mx_host, n.mail_provider, n.region_id, n.source_url,
            )
            for n in ngos
        ],
    )
