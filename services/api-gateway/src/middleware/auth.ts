/**
 * Wallet-based auth middleware for NGO-only endpoints.
 *
 * Login flow (EIP-191):
 *   1. GET /auth/nonce?address=0x... → returns a one-time nonce string
 *   2. Client signs the nonce with MetaMask: personal_sign(nonce, address)
 *   3. POST /auth/verify { address, signature, nonce } → returns JWT
 *   4. Client sends JWT in Authorization: Bearer <token> header
 *
 * TODO:
 * - Store nonces in DB (with TTL) instead of in-memory map
 * - Verify signature using ethers.js verifyMessage()
 * - Check that address is in the `ngos` table (whitelisted)
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

// Temporary in-memory nonce store — replace with DB
const pendingNonces = new Map<string, string>();

export function generateNonce(address: string): string {
  const nonce = `Sign this message to log in to CrisisChain NGO portal.\nNonce: ${crypto.randomBytes(16).toString("hex")}`;
  pendingNonces.set(address.toLowerCase(), nonce);
  return nonce;
}

export function verifyAndIssueToken(address: string, _signature: string, nonce: string): string | null {
  const expected = pendingNonces.get(address.toLowerCase());
  if (!expected || expected !== nonce) return null;
  pendingNonces.delete(address.toLowerCase());

  // TODO: verify `signature` is a valid EIP-191 signature from `address`
  // const recovered = ethers.verifyMessage(nonce, signature);
  // if (recovered.toLowerCase() !== address.toLowerCase()) return null;

  return jwt.sign({ address: address.toLowerCase() }, JWT_SECRET, { expiresIn: "8h" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing auth token" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { address: string };
    (req as Request & { ngoAddress: string }).ngoAddress = payload.address;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
