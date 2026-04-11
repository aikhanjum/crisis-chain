import { Router } from "express";
import { query } from "../lib/db";

const router = Router();

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
    const poolId = req.params.id;
    const [donations, payouts] = await Promise.all([
      query(
        `SELECT tx_hash, block_number, donor AS actor, amount_raw AS amount, memo, created_at AS timestamp
         FROM donations WHERE pool_id = $1 ORDER BY block_number DESC`,
        [poolId],
      ),
      query(
        `SELECT tx_hash, block_number, recipient AS actor, amount_raw AS amount, payout_ref, created_at AS timestamp
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
