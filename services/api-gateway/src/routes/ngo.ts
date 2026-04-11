import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { query } from "../lib/db";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const OCR_URL = process.env.OCR_RECEIPT_URL ?? "http://localhost:8003";
const BRIDGE_URL = process.env.BLOCKCHAIN_BRIDGE_URL ?? "http://localhost:4001";

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
 * POST /ngo/receipt — upload receipt image, proxy to OCR, persist to DB
 */
router.post("/receipt", requireAuth, upload.single("file"), async (req, res) => {
  const ngoAddress = (req as typeof req & { ngoAddress: string }).ngoAddress;
  const regionId = (req.body?.region_id as string) ?? "";

  if (!req.file) {
    return res.status(400).json({ error: "file is required" });
  }
  if (!regionId) {
    return res.status(400).json({ error: "region_id is required" });
  }

  try {
    const form = new FormData();
    form.append("file", new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);
    form.append("ngo_wallet", ngoAddress);
    form.append("region_id", regionId);

    const ocrRes = await fetch(`${OCR_URL}/receipt/parse`, {
      method: "POST",
      body: form,
    });

    if (!ocrRes.ok) {
      const text = await ocrRes.text();
      return res.status(502).json({ error: "OCR service error", status: ocrRes.status, detail: text });
    }

    const ocrResult = (await ocrRes.json()) as {
      total_approved: number;
      total_flagged: number;
      approved_items: { name: string; quantity: number; unit_price: number; total: number }[];
      flagged_items: { name: string; quantity: number; unit_price: number; total: number }[];
      raw_ocr_text: string;
    };

    const totalAmount = ocrResult.total_approved ?? 0;
    const itemNotes = (ocrResult.approved_items ?? [])
      .map((i) => `${i.quantity}x ${i.name}`)
      .join(", ");

    const insertResult = await query(
      `INSERT INTO receipt_requests (ngo_wallet, region_id, requested_amount, status, item_notes, raw_ocr_text)
       VALUES ($1, $2, $3, 'pending', $4, $5)
       RETURNING id, status, submitted_at`,
      [ngoAddress, regionId, totalAmount, itemNotes || "receipt items", ocrResult.raw_ocr_text ?? ""],
    );

    const row = insertResult[0] as { id: string; status: string; submitted_at: string };

    res.json({
      receipt_id: row.id,
      status: row.status,
      submitted_at: row.submitted_at,
      ocr: ocrResult,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: "Receipt processing failed",
      detail: msg,
      hint: `Is ocr-receipt running at ${OCR_URL}?`,
    });
  }
});

/**
 * POST /ngo/receipt/:id/approve — approve a pending receipt for reimbursement
 * For the hackathon demo, this auto-sets approved_amount = requested_amount.
 */
router.post("/receipt/:id/approve", requireAuth, async (req, res) => {
  const receiptId = req.params.id;
  const ngoAddress = (req as typeof req & { ngoAddress: string }).ngoAddress;

  try {
    const rows = await query<{
      id: string; status: string; ngo_wallet: string;
      requested_amount: string; region_id: string;
    }>(
      "SELECT id, status, ngo_wallet, requested_amount, region_id FROM receipt_requests WHERE id = $1",
      [receiptId],
    );
    if (!rows.length) return res.status(404).json({ error: "Receipt not found" });

    const receipt = rows[0];

    if (receipt.status === "approved") return res.json({ status: "already_approved", receipt_id: receiptId });
    if (receipt.status === "paid") return res.status(409).json({ error: "Already paid" });
    if (receipt.status !== "pending") {
      return res.status(422).json({ error: `Receipt status is '${receipt.status}', expected 'pending'` });
    }

    await query(
      `UPDATE receipt_requests
       SET status = 'approved', approved_amount = requested_amount, processed_at = NOW()
       WHERE id = $1`,
      [receiptId],
    );

    res.json({ status: "approved", receipt_id: receiptId, approved_amount: receipt.requested_amount });
  } catch (err) {
    res.status(500).json({ error: "DB error", detail: String(err) });
  }
});

/**
 * POST /ngo/reimburse — trigger on-chain payout for an approved receipt.
 * Body: { receiptId: string }
 *
 * Calls the blockchain-bridge /reimbursement/submit endpoint which
 * executes vault.payout() and records the tx hash.
 */
router.post("/reimburse", requireAuth, async (req, res) => {
  const ngoAddress = (req as typeof req & { ngoAddress: string }).ngoAddress;
  const { receiptId } = req.body as { receiptId: string };

  if (!receiptId) return res.status(400).json({ error: "receiptId required" });

  try {
    const rows = await query<{
      id: string; status: string; ngo_wallet: string;
      approved_amount: string; region_id: string; receipt_ipfs: string | null;
    }>(
      `SELECT id, status, ngo_wallet, approved_amount, region_id, receipt_ipfs
       FROM receipt_requests WHERE id = $1`,
      [receiptId],
    );
    if (!rows.length) return res.status(404).json({ error: "Receipt not found" });

    const receipt = rows[0];

    if (receipt.ngo_wallet !== ngoAddress) {
      return res.status(403).json({ error: "This receipt belongs to a different NGO" });
    }
    if (receipt.status === "paid") return res.status(409).json({ error: "Already paid" });
    if (receipt.status !== "approved") {
      return res.status(422).json({ error: `Receipt status is '${receipt.status}', must be 'approved'` });
    }

    // Look up the pool_id for this region
    const regionRows = await query<{ pool_id: string }>(
      "SELECT pool_id FROM crisis_nodes WHERE region_id = $1",
      [receipt.region_id],
    );
    const poolId = regionRows[0]?.pool_id;
    if (!poolId) {
      return res.status(422).json({ error: `Region ${receipt.region_id} has no assigned pool` });
    }

    // Convert approved_amount from USDC to base units (6 decimals)
    const amountFloat = parseFloat(receipt.approved_amount);
    const amountBaseUnits = Math.round(amountFloat * 1_000_000).toString();

    const bridgeRes = await fetch(`${BRIDGE_URL}/reimbursement/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiptId: receipt.id,
        poolId: Number(poolId),
        ngoWallet: ngoAddress,
        amountUsdc: amountBaseUnits,
        receiptCid: receipt.receipt_ipfs || "no-ipfs-cid",
      }),
    });

    if (!bridgeRes.ok) {
      const text = await bridgeRes.text();
      return res.status(502).json({ error: "Bridge payout failed", detail: text });
    }

    const result = await bridgeRes.json();
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: "Reimbursement failed",
      detail: msg,
      hint: `Is blockchain-bridge running at ${BRIDGE_URL}?`,
    });
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
