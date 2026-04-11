"""
DNS MX record lookup for NGO email discovery.

Flow:
  domain → resolve MX records → classify mail provider → return primary MX host

Provider classification is used to decide whether a constructed email like
info@{domain} is likely to be valid, and to skip bulk/transactional providers
that won't have real staff inboxes.
"""

import dns.resolver
import dns.exception


# MX host substring → provider name
# Ordered from most specific to least specific
PROVIDER_PATTERNS: list[tuple[str, str]] = [
    ("google.com", "google"),
    ("googlemail.com", "google"),
    ("outlook.com", "microsoft"),
    ("hotmail.com", "microsoft"),
    ("protection.outlook.com", "microsoft"),
    ("office365.com", "microsoft"),
    ("mailgun.org", "bulk"),
    ("sendgrid.net", "bulk"),
    ("amazonses.com", "bulk"),
    ("spamgourmet.com", "bulk"),
    ("mailchimp.com", "bulk"),
]

# Providers where constructing info@{domain} is unlikely to reach a human inbox
BULK_PROVIDERS = {"bulk"}


def resolve_mx(domain: str) -> tuple[str | None, str]:
    """
    Resolve the primary MX record for `domain`.
    Returns (mx_host, mail_provider).

    mx_host is None if DNS resolution fails.
    mail_provider is one of: 'google' | 'microsoft' | 'self-hosted' | 'bulk' | 'unknown'
    """
    try:
        records = dns.resolver.resolve(domain, "MX", lifetime=5.0)
        # Sort by priority (lower = higher priority)
        sorted_records = sorted(records, key=lambda r: r.preference)
        primary_host = str(sorted_records[0].exchange).rstrip(".")
    except (dns.exception.DNSException, Exception):
        return None, "unknown"

    provider = _classify_provider(primary_host)
    return primary_host, provider


def _classify_provider(mx_host: str) -> str:
    lower = mx_host.lower()
    for pattern, name in PROVIDER_PATTERNS:
        if pattern in lower:
            return name
    # If MX host is a subdomain of the domain itself → self-hosted
    return "self-hosted"


def infer_email(domain: str, mx_host: str | None, provider: str) -> str | None:
    """
    Construct a candidate email address from the domain.
    Returns None if the provider is bulk/transactional (unlikely to have a real inbox).
    """
    if provider in BULK_PROVIDERS or mx_host is None:
        return None
    # Preference order for generic inbox names
    return f"info@{domain}"


def is_valid_email_format(email: str) -> bool:
    """Basic regex sanity check — not a full RFC 5322 validator."""
    import re
    pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email))
