import { Router } from "express";
import { approveNgo, revokeNgo } from "../services/ngo";

const router = Router();

/**
 * POST /ngos/approve
 * Grants PAYOUT_ROLE to the NGO wallet on-chain + marks approved in DB.
 * Body: { walletAddress: string }
 *
 * This is an admin-only action. Add auth middleware before exposing externally.
 */
router.post("/approve", async (req, res) => {
  const { walletAddress } = req.body as { walletAddress: string };
  if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });
  try {
    const txHash = await approveNgo(walletAddress as `0x${string}`);
    res.json({ status: "approved", walletAddress, txHash });
  } catch (err) {
    console.error("[ngos/approve]", err);
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /ngos/revoke
 * Revokes PAYOUT_ROLE from an NGO wallet on-chain + marks suspended in DB.
 * Body: { walletAddress: string }
 */
router.post("/revoke", async (req, res) => {
  const { walletAddress } = req.body as { walletAddress: string };
  if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });
  try {
    const txHash = await revokeNgo(walletAddress as `0x${string}`);
    res.json({ status: "revoked", walletAddress, txHash });
  } catch (err) {
    console.error("[ngos/revoke]", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
