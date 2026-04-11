/**
 * Wallet-based auth middleware for NGO-only endpoints.
 *
 * Login flow (EIP-191):
 *   1. GET /auth/nonce?address=0x... → returns a one-time nonce string
 *   2. Client signs the nonce with MetaMask: personal_sign(nonce, address)
 *   3. POST /auth/verify { address, signature, nonce } → returns JWT
 *   4. Client sends JWT in Authorization: Bearer <token> header
 *
 * Prod improvements: store nonces in DB with TTL, check `ngos` table whitelist.
 */

import { Request, Response, NextFunction } from "express";
import { verifyMessage } from "viem";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

// In-memory nonce store (prod: DB + TTL)
const pendingNonces = new Map<string, string>();

export function generateNonce(address: string): string {
  const nonce = `Sign this message to log in to CrisisChain NGO portal.\nNonce: ${crypto.randomBytes(16).toString("hex")}`;
  pendingNonces.set(address.toLowerCase(), nonce);
  return nonce;
}

export async function verifyAndIssueToken(address: string, signature: string, nonce: string): Promise<string | null> {
  const addr = address.toLowerCase();
  const expected = pendingNonces.get(addr);
  if (!expected || expected !== nonce) return null;
  pendingNonces.delete(addr);

  const valid = await verifyMessage({
    address: address as `0x${string}`,
    message: nonce,
    signature: signature as `0x${string}`,
  });
  if (!valid) return null;

  return jwt.sign({ address: addr }, JWT_SECRET, { expiresIn: "8h" });
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
