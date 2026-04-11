/**
 * Receipt pipeline proxy — connects the frontend to OCR + blockchain-bridge.
 *
 * POST /receipt/upload
 *   1. Accepts multipart form with receipt photo + metadata
 *   2. Forwards photo to OCR service for parsing
 *   3. Pins photo to IPFS via blockchain-bridge
 *   4. Submits delivery claim on-chain via blockchain-bridge
 *   5. Returns claim ID + attestation results
 */

import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import type { Request } from "express";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const OCR_URL = process.env.OCR_SERVICE_URL ?? "http://localhost:8000";
const BRIDGE_URL = process.env.BRIDGE_SERVICE_URL ?? "http://localhost:4001";

router.post(
  "/upload",
  requireAuth,
  upload.single("receipt"),
  async (req: Request, res) => {
    const ngoAddress = (req as Request & { ngoAddress: string }).ngoAddress;
    const file = (req as Request & { file?: Express.Multer.File }).file;
    const { region_id, pool_id, amount, lat, lng, geo_hash } = req.body ?? {};

    if (!file) return res.status(400).json({ error: "receipt file is required" });
    if (!region_id) return res.status(400).json({ error: "region_id is required" });
    if (!amount) return res.status(400).json({ error: "amount is required" });

    const results: {
      ocr: Record<string, unknown> | null;
      ipfsCid: string | null;
      claim: Record<string, unknown> | null;
    } = { ocr: null, ipfsCid: null, claim: null };

    // Step 1: OCR parse
    let ocrApproved = false;
    try {
      const ocrForm = new FormData();
      ocrForm.append("file", new Blob([file.buffer]), file.originalname);
      ocrForm.append("ngo_wallet", ngoAddress);
      ocrForm.append("region_id", region_id);

      const ocrRes = await fetch(`${OCR_URL}/receipt/parse`, {
        method: "POST",
        body: ocrForm,
      });
      if (ocrRes.ok) {
        results.ocr = await ocrRes.json() as Record<string, unknown>;
        const flaggedCount = Array.isArray(results.ocr.flagged_items) ? results.ocr.flagged_items.length : 0;
        const approvedCount = Array.isArray(results.ocr.approved_items) ? results.ocr.approved_items.length : 0;
        ocrApproved = approvedCount > 0 && flaggedCount === 0;
      }
    } catch (err) {
      console.warn("[receipt-pipeline] OCR service unavailable, continuing without OCR:", err);
    }

    // Step 2: Pin receipt to IPFS
    try {
      const pinForm = new FormData();
      pinForm.append("file", new Blob([file.buffer]), file.originalname);

      const pinRes = await fetch(`${BRIDGE_URL}/pools/pin-receipt`, {
        method: "POST",
        body: pinForm,
      });
      if (pinRes.ok) {
        const pinData = await pinRes.json() as { cid: string };
        results.ipfsCid = pinData.cid;
      }
    } catch (err) {
      console.warn("[receipt-pipeline] IPFS pin failed, using placeholder:", err);
    }

    const receiptCid = results.ipfsCid ?? `local-${Date.now()}`;

    // Step 3: Submit delivery claim on-chain
    try {
      const deliveryRes = await fetch(`${BRIDGE_URL}/delivery/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ngoWallet: ngoAddress,
          poolId: Number(pool_id) || 1,
          regionId: region_id,
          amountUsdc: String(Math.round(Number(amount) * 1e6)),
          receiptCid,
          geoHash: geo_hash || "000000",
          lat: Number(lat) || 0,
          lng: Number(lng) || 0,
          ocrApproved,
        }),
      });
      if (deliveryRes.ok) {
        results.claim = await deliveryRes.json() as Record<string, unknown>;
      } else {
        const errBody = await deliveryRes.text();
        console.error("[receipt-pipeline] Delivery submit failed:", errBody);
      }
    } catch (err) {
      console.error("[receipt-pipeline] Bridge delivery error:", err);
    }

    res.json({
      status: results.claim ? "claim_submitted" : "partial",
      ocrResult: results.ocr ? {
        approved_items: results.ocr.approved_items,
        flagged_items: results.ocr.flagged_items,
        total_approved: results.ocr.total_approved_amount,
        ocrApproved,
      } : null,
      ipfsCid: results.ipfsCid,
      claim: results.claim,
    });
  },
);

export default router;
