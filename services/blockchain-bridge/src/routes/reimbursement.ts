import { Router } from "express";
import { submitReimbursement } from "../services/reimbursement";
import { pinFile } from "../services/ipfs";
import { queryOne } from "../lib/db";

const router = Router();

/**
 * POST /reimbursement/submit
 * Called by the OCR service after a receipt passes the approved items check.
 *
 * Body:
 *   receiptId      - UUID from receipt_requests table
 *   poolId         - numeric pool ID of the crisis region
 *   ngoWallet      - NGO's wallet address (must have PAYOUT_ROLE on-chain)
 *   amountUsdc     - approved amount as a string (USDC base units, 6 decimals)
 *   receiptCid     - IPFS CID of the receipt image (already pinned by OCR service)
 *
 * Returns: { txHash, status: "paid" }
 */
router.post("/submit", async (req, res) => {
  const { receiptId, poolId, ngoWallet, amountUsdc, receiptCid } = req.body as {
    receiptId: string;
    poolId: number;
    ngoWallet: string;
    amountUsdc: string;
    receiptCid: string;
  };

  if (!receiptId || !poolId || !ngoWallet || !amountUsdc || !receiptCid) {
    return res.status(400).json({ error: "receiptId, poolId, ngoWallet, amountUsdc, receiptCid required" });
  }

  // Guard: verify the receipt is in 'approved' state before paying
  const receipt = await queryOne<{ status: string }>(
    "SELECT status FROM receipt_requests WHERE id = $1",
    [receiptId],
  );
  if (!receipt) return res.status(404).json({ error: "Receipt not found" });
  if (receipt.status === "paid") return res.status(409).json({ error: "Already paid" });
  if (receipt.status !== "approved") {
    return res.status(422).json({ error: `Receipt status is '${receipt.status}', must be 'approved'` });
  }

  try {
    const txHash = await submitReimbursement({
      receiptId,
      poolId: Number(poolId),
      ngoWallet: ngoWallet as `0x${string}`,
      amountUsdc: BigInt(amountUsdc),
      receiptCid,
    });
    res.json({ status: "paid", txHash, receiptId });
  } catch (err) {
    console.error("[reimbursement/submit]", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
