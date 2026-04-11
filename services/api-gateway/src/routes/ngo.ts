import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { query } from "../lib/db";

const router = Router();

/**
 * GET /ngo/me — profile of the authenticated NGO (includes operated_regions)
 */
router.get("/me", requireAuth, async (req, res) => {
  const ngoAddress = (req as typeof req & { ngoAddress: string }).ngoAddress;
  try {
    const rows = await query(
      `SELECT wallet_address, org_name, country, operated_regions, contact_email, status
       FROM ngos WHERE wallet_address = $1`,
      [ngoAddress],
    );
    if (!rows.length) return res.status(404).json({ error: "NGO not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "DB error", detail: String(err) });
  }
});

/**
 * GET /ngo/queue — reimbursement queue for authenticated NGO
 */
router.get("/queue", requireAuth, async (req, res) => {
  const ngoAddress = (req as typeof req & { ngoAddress: string }).ngoAddress;
  try {
    const rows = await query(
      `SELECT * FROM receipt_requests
       WHERE ngo_wallet = $1
       ORDER BY submitted_at ASC`,
      [ngoAddress],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "DB error", detail: String(err) });
  }
});

/**
 * POST /ngo/receipt — submit a reimbursement request
 * Body: { region_id: string, amount: number, notes?: string }
 */
router.post("/receipt", requireAuth, async (req, res) => {
  const ngoAddress = (req as typeof req & { ngoAddress: string }).ngoAddress;
  const { region_id, amount, notes } = req.body ?? {};

  if (!region_id) return res.status(400).json({ error: "region_id is required" });
  const parsedAmount = Number(amount);
  if (!parsedAmount || parsedAmount <= 0) return res.status(400).json({ error: "amount must be a positive number" });

  try {
    const insertResult = await query(
      `INSERT INTO receipt_requests (ngo_wallet, region_id, requested_amount, status, item_notes)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING id, status, submitted_at`,
      [ngoAddress, region_id, parsedAmount, notes || ""],
    );
    const row = insertResult[0] as { id: string; status: string; submitted_at: string };
    res.json({ receipt_id: row.id, status: row.status, submitted_at: row.submitted_at });
  } catch (err) {
    res.status(500).json({ error: "DB error", detail: String(err) });
  }
});

/**
 * POST /ngo/receipt/:id/pay — mark receipt as paid after on-chain payout
 * Body: { txHash: string }
 */
router.post("/receipt/:id/pay", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { txHash } = req.body ?? {};
  if (!txHash) return res.status(400).json({ error: "txHash is required" });

  try {
    const result = await query(
      `UPDATE receipt_requests
       SET status = 'paid', payout_tx_hash = $1, processed_at = NOW()
       WHERE id = $2
       RETURNING id, status, payout_tx_hash`,
      [txHash, id],
    );
    if (!result.length) return res.status(404).json({ error: "Receipt not found" });
    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: "DB error", detail: String(err) });
  }
});

/**
 * POST /ngo/register — submit NGO registration application
 */
router.post("/register", async (req, res) => {
  const { orgName, country, regNumber, regions, walletAddress, contactEmail } = req.body;
  if (!orgName || !walletAddress) {
    return res.status(400).json({ error: "orgName and walletAddress required" });
  }
  try {
    await query(
      `INSERT INTO ngos (wallet_address, org_name, country, reg_number, operated_regions, contact_email, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       ON CONFLICT (wallet_address) DO NOTHING`,
      [walletAddress.toLowerCase(), orgName, country, regNumber, regions, contactEmail],
    );
    res.json({ status: "application_received" });
  } catch (err) {
    res.status(500).json({ error: "DB error", detail: String(err) });
  }
});

export default router;
