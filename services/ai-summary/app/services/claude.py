"""
Claude API integration for generating crisis summaries.
Uses the Anthropic Python SDK.

TODO:
- Set ANTHROPIC_API_KEY in .env
- Tune the prompt for neutrality and brevity
- Add retry logic for rate limit errors
"""

import os
import anthropic
from app.models.summary import SummaryRequest, SummaryResponse
from datetime import datetime, timezone

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

SUMMARY_PROMPT = """You are a neutral humanitarian aid analyst. Based on the following data, write:
1. A 2-3 sentence factual summary of what is happening in this region (who is affected, what type of crisis).
2. A single sentence starting with "Your donation funds..." describing what aid is needed.

Be factual and neutral. Do not editorialize or assign blame.

Country: {country}
Recent conflict data: {acled_summary}
Situation reports:
{reports}

Respond in JSON: {{"summary": "...", "donate_copy": "..."}}"""


async def generate_summary(req: SummaryRequest) -> SummaryResponse:
    reports_text = "\n\n".join(req.raw_reports[:3])  # cap at 3 reports
    prompt = SUMMARY_PROMPT.format(
        country=req.country,
        acled_summary=req.acled_events_summary,
        reports=reports_text,
    )

    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )

    import json
    content = message.content[0].text
    parsed = json.loads(content)

    return SummaryResponse(
        region_id=req.region_id,
        summary=parsed["summary"],
        donate_copy=parsed["donate_copy"],
        generated_at=datetime.now(timezone.utc),
    )
