import { Router } from "express";
import { approveNgo, revokeNgo, grantNgoRole, revokeNgoRole } from "../services/ngo";

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

/**
 * POST /ngos/grant-ngo-role
 * Grants NGO_ROLE to a wallet on-chain, allowing it to call requestReimbursement().
 * Body: { walletAddress: string }
 */
router.post("/grant-ngo-role", async (req, res) => {
  const { walletAddress } = req.body as { walletAddress: string };
  if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });
  try {
    const txHash = await grantNgoRole(walletAddress as `0x${string}`);
    res.json({ status: "ngo_role_granted", walletAddress, txHash });
  } catch (err) {
    console.error("[ngos/grant-ngo-role]", err);
    res.status(500).json({ error: String(err) });
  }
});

/**
 * POST /ngos/revoke-ngo-role
 * Revokes NGO_ROLE from a wallet on-chain.
 * Body: { walletAddress: string }
 */
router.post("/revoke-ngo-role", async (req, res) => {
  const { walletAddress } = req.body as { walletAddress: string };
  if (!walletAddress) return res.status(400).json({ error: "walletAddress required" });
  try {
    const txHash = await revokeNgoRole(walletAddress as `0x${string}`);
    res.json({ status: "ngo_role_revoked", walletAddress, txHash });
  } catch (err) {
    console.error("[ngos/revoke-ngo-role]", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
