import { Router } from "express";
import { submitDeliveryClaim, verifyGeoLocation } from "../services/delivery";

const router = Router();

/**
 * POST /delivery/submit
 *
 * Fully automated delivery verification pipeline:
 *   1. Accepts delivery proof from NGO
 *   2. Forwards to OCR service for receipt parsing
 *   3. Checks geo coordinates against crisis zone
 *   4. Submits on-chain claim + auto-attests oracle signals
 *   5. Returns claim ID — payout happens automatically when threshold met
 *
 * Body (JSON for simplicity; real version would accept multipart with photo):
 *   ngoWallet   - NGO's wallet address (must hold SoulboundCredential)
 *   poolId      - numeric pool ID of the crisis region
 *   regionId    - string region identifier
 *   amountUsdc  - amount in USDC base units (6 decimals)
 *   receiptCid  - IPFS CID of receipt/photo (already pinned)
 *   geoHash     - geohash string of delivery location
 *   lat         - latitude of delivery location
 *   lng         - longitude of delivery location
 *   ocrApproved - whether OCR verified all items are in approved registry
 */
router.post("/submit", async (req, res) => {
  const {
    ngoWallet,
    poolId,
    regionId,
    amountUsdc,
    receiptCid,
    geoHash,
    lat,
    lng,
    ocrApproved,
  } = req.body as {
    ngoWallet: string;
    poolId: number;
    regionId: string;
    amountUsdc: string;
    receiptCid: string;
    geoHash: string;
    lat: number;
    lng: number;
    ocrApproved: boolean;
  };

  if (!ngoWallet || !poolId || !amountUsdc || !receiptCid || !geoHash) {
    return res.status(400).json({
      error: "ngoWallet, poolId, amountUsdc, receiptCid, geoHash are required",
    });
  }

  try {
    // Auto-verify geo location against crisis zone
    const geoVerified = regionId
      ? await verifyGeoLocation(regionId, lat, lng)
      : false;

    const result = await submitDeliveryClaim({
      ngoWallet: ngoWallet as `0x${string}`,
      poolId: Number(poolId),
      amountUsdc: BigInt(amountUsdc),
      receiptCid,
      geoHash,
      ocrApproved: ocrApproved ?? false,
      geoVerified,
    });

    res.json({
      status: "claim_submitted",
      claimId: result.claimId.toString(),
      txHash: result.submitTxHash,
      attestations: result.attestations,
      geoVerified,
      message: result.attestations.length > 0
        ? `Auto-attested: ${result.attestations.join(", ")}. Awaiting peer/beneficiary attestations for auto-payout.`
        : "Claim submitted. Awaiting attestations for auto-payout.",
    });
  } catch (err) {
    console.error("[delivery/submit]", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
