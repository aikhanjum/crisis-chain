import { Router } from "express";
import { parseUnits } from "viem";
import { requireAuth } from "../middleware/auth";
import { query } from "../lib/db";
import { poolIdFromRegionId } from "../lib/poolId";

const router = Router();

const BLOCKCHAIN_BRIDGE_URL = process.env.BLOCKCHAIN_BRIDGE_URL ?? "http://127.0.0.1:4001";

/**
 * GET /ngo/me — profile of the authenticated NGO (includes operated_regions)
 */
router.get("/me", requireAuth, async (req, res) => {
  const ngoAddress = (req as typeof req & { ngoAddress: string }).ngoAddress;
  try {
    const rows = await query(
      `SELECT wallet_address, org_name, country, reg_number, operated_regions, contact_email, status
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
 * POST /ngo/receipt/:id/vault-payout
 * Authenticated NGO: approves pending receipts (if needed) and calls blockchain-bridge
 * POST /reimbursement/submit so USDC moves via CrisisPoolVault.payout.
 */
router.post("/receipt/:id/vault-payout", requireAuth, async (req, res) => {
  const ngoAddress = (req as typeof req & { ngoAddress: string }).ngoAddress;
  const { id } = req.params;

  try {
    const rows = await query<{
      id: string;
      region_id: string;
      requested_amount: string;
      approved_amount: string | null;
      status: string;
    }>(
      `SELECT id, region_id, requested_amount::text, approved_amount::text, status
       FROM receipt_requests WHERE id = $1::uuid AND ngo_wallet = $2`,
      [id, ngoAddress],
    );
    if (!rows.length) return res.status(404).json({ error: "Receipt not found" });

    const rec = rows[0];
    if (rec.status === "paid") {
      return res.status(409).json({ error: "Receipt already paid" });
    }
    if (rec.status === "rejected") {
      return res.status(422).json({ error: "Receipt was rejected" });
    }

    if (rec.status === "pending") {
      await query(
        `UPDATE receipt_requests
         SET status = 'approved', approved_amount = requested_amount
         WHERE id = $1::uuid AND ngo_wallet = $2`,
        [id, ngoAddress],
      );
    } else if (rec.status !== "approved") {
      return res.status(422).json({ error: `Cannot payout from status '${rec.status}'` });
    }

    const amountDecimal =
      rec.status === "pending" ? rec.requested_amount : rec.approved_amount ?? rec.requested_amount;
    const amountUsdc = parseUnits(amountDecimal.trim(), 6).toString();

    const poolRows = await query<{ pool_id: string | null }>(
      `SELECT pool_id::text FROM crisis_nodes WHERE region_id = $1`,
      [rec.region_id],
    );
    const poolIdStr =
      poolRows.length > 0 && poolRows[0].pool_id != null && poolRows[0].pool_id !== ""
        ? String(poolRows[0].pool_id)
        : poolIdFromRegionId(rec.region_id);
    const poolId = Number(poolIdStr);
    if (!Number.isFinite(poolId) || poolId < 0) {
      return res.status(500).json({ error: "Invalid pool id for region" });
    }

    const bridgeUrl = `${BLOCKCHAIN_BRIDGE_URL.replace(/\/$/, "")}/reimbursement/submit`;
    const br = await fetch(bridgeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiptId: id,
        poolId,
        ngoWallet: ngoAddress,
        amountUsdc,
      }),
    });
    const text = await br.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return res.status(502).json({
        error: "Blockchain bridge returned non-JSON",
        detail: text.slice(0, 500),
      });
    }
    if (!br.ok) {
      const code = br.status >= 400 && br.status < 600 ? br.status : 502;
      return res.status(code).json({
        error: typeof json.error === "string" ? json.error : "Bridge submit failed",
        detail: json,
      });
    }

    res.json(json);
  } catch (err) {
    console.error("[ngo/receipt/:id/vault-payout]", err);
    res.status(500).json({ error: "Vault payout failed", detail: String(err) });
  }
});

/**
 * PATCH /ngo/profile — update existing NGO profile (authenticated)
 */
router.patch("/profile", requireAuth, async (req, res) => {
  const ngoAddress = (req as typeof req & { ngoAddress: string }).ngoAddress;
  const { orgName, country, regNumber, regions, contactEmail } = req.body;
  if (!orgName) {
    return res.status(400).json({ error: "orgName is required" });
  }
  try {
    const result = await query(
      `UPDATE ngos
       SET org_name = $1, country = $2, reg_number = $3, operated_regions = $4, contact_email = $5
       WHERE wallet_address = $6
       RETURNING wallet_address, org_name, country, status`,
      [orgName, country || null, regNumber || null, regions || '{}', contactEmail || null, ngoAddress],
    );
    if (!result.length) return res.status(404).json({ error: "NGO not found" });
    res.json({ status: "profile_updated", profile: result[0] });
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
  const normalizedWallet = walletAddress.toLowerCase();
  try {
    const existing = await query(
      `SELECT org_name, status FROM ngos WHERE wallet_address = $1`,
      [normalizedWallet],
    );
    if (existing.length > 0) {
      const row = existing[0] as { org_name: string; status: string };
      return res.status(409).json({
        error: `This wallet is already registered to "${row.org_name}" (${row.status}). Each wallet can only be linked to one NGO.`,
      });
    }
    await query(
      `INSERT INTO ngos (wallet_address, org_name, country, reg_number, operated_regions, contact_email, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
      [normalizedWallet, orgName, country, regNumber, regions, contactEmail],
    );
    res.json({ status: "application_received" });
  } catch (err) {
    res.status(500).json({ error: "DB error", detail: String(err) });
  }
});

export default router;
