import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { query } from "../lib/db";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const OCR_URL = process.env.OCR_RECEIPT_URL ?? "http://localhost:8003";

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
