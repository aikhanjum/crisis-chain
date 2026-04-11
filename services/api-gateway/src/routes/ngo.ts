import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { query } from "../lib/db";

const router = Router();

/**
 * GET /ngo/queue — reimbursement queue for authenticated NGO
 * Protected: requires wallet-auth JWT
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
 * POST /ngo/receipt — forward uploaded receipt to OCR service
 * Protected: requires wallet-auth JWT
 *
 * TODO: stream the multipart upload directly to ocr-receipt service
 * to avoid buffering large files in the gateway.
 */
router.post("/receipt", requireAuth, async (req, res) => {
  // TODO: proxy to http://ocr-receipt:8003/receipt/parse
  res.status(501).json({ error: "Not implemented — proxy to ocr-receipt service" });
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
