import { Router } from "express";
import { query } from "../lib/db";

const router = Router();

const crisisIntelBase = () =>
  process.env.CRISIS_INTELLIGENCE_URL ?? "http://localhost:8001";

function intelProxyError(base: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const cause =
    err instanceof Error && err.cause != null ? String(err.cause) : undefined;
  const dockerHostname = base.includes("crisis-intelligence");
  return {
    error: "Failed to reach crisis-intelligence",
    detail: msg,
    ...(cause ? { cause } : {}),
    crisisIntelligenceUrl: base,
    hint: dockerHostname
      ? "Hostname crisis-intelligence only works inside Docker. If api-gateway runs on your host (npm run dev), set CRISIS_INTELLIGENCE_URL=http://127.0.0.1:8001. If both are in Compose, run: docker compose up -d crisis-intelligence && docker compose ps"
      : "Start the service: docker compose up -d crisis-intelligence — then curl CRISIS_INTELLIGENCE_URL/health",
  };
}

/** GET /regions — all crisis nodes ordered by severity */
router.get("/", async (_req, res) => {
  try {
    const rows = await query(
      `SELECT region_id, name, country, lat, lng, severity_score, severity_level,
              summary, last_updated, source_links, active_ngos, pool_id
       FROM crisis_nodes
       ORDER BY severity_score DESC`,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "DB error", detail: String(err) });
  }
});

/**
 * POST /regions/refresh — proxy to crisis-intelligence (ACLED→HDX→upsert→NGO discovery).
 * Requires crisis-intelligence running and ACLED_* env set there.
 */
router.post("/refresh", async (_req, res) => {
  const base = crisisIntelBase();
  try {
    const r = await fetch(`${base}/regions/refresh`, { method: "POST" });
    const text = await r.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
    res.status(r.status).json(body);
  } catch (err) {
    res.status(502).json(intelProxyError(base, err));
  }
});

/** GET /regions/:id/discovered-ngos — scraper results from Postgres */
router.get("/:id/discovered-ngos", async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, org_name, domain, contact_email, email_source, mail_provider,
              status, source_url, discovered_at
       FROM discovered_ngos
       WHERE region_id = $1
       ORDER BY discovered_at DESC`,
      [req.params.id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "DB error", detail: String(err) });
  }
});

/**
 * POST /regions/:id/discover-ngos — proxy NGO scrape for one region (?limit=1–50)
 */
router.post("/:id/discover-ngos", async (req, res) => {
  const base = crisisIntelBase();
  const id = encodeURIComponent(req.params.id);
  const lim = req.query.limit;
  const qs =
    typeof lim === "string" && lim.length > 0 ? `?limit=${encodeURIComponent(lim)}` : "";
  try {
    const r = await fetch(`${base}/ngos/discover/${id}${qs}`, { method: "POST" });
    const text = await r.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
    res.status(r.status).json(body);
  } catch (err) {
    res.status(502).json(intelProxyError(base, err));
  }
});

/** GET /regions/:id — single region */
router.get("/:id", async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM crisis_nodes WHERE region_id = $1`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Region not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "DB error", detail: String(err) });
  }
});

/**
 * GET /regions/:id/ledger — merged donations + payouts timeline
 *
 * TODO: join with payouts.payout_ref to add item notes from receipt_requests table
 */
router.get("/:id/ledger", async (req, res) => {
  try {
    const regionKey = req.params.id;
    // Resolve region_id slug → numeric pool_id stored in crisis_nodes
    const nodeRows = await query(
      `SELECT pool_id FROM crisis_nodes WHERE region_id = $1`,
      [regionKey],
    );
    const poolId = nodeRows.length > 0 ? String(nodeRows[0].pool_id) : regionKey;
    const [donations, payouts] = await Promise.all([
      query(
        `SELECT tx_hash, block_number, donor AS actor, amount_raw AS amount, memo
         FROM donations WHERE pool_id = $1 ORDER BY block_number DESC`,
        [poolId],
      ),
      query(
        `SELECT tx_hash, block_number, recipient AS actor, amount_raw AS amount, payout_ref
         FROM payouts WHERE pool_id = $1 ORDER BY block_number DESC`,
        [poolId],
      ),
    ]);
    res.json({ poolId, donations, payouts });
  } catch (err) {
    res.status(500).json({ error: "DB error", detail: String(err) });
  }
});

export default router;
