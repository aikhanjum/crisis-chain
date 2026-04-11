/**
 * Reimbursement submitter — calls vault.payout() after a receipt is approved.
 *
 * Flow:
 *   OCR service approves receipt
 *     → POST /reimbursement/submit to this service
 *       → pin receipt to IPFS (if not already pinned)
 *       → call vault.payout(poolId, ngoWallet, amount, receiptHash)
 *       → write tx hash back to receipt_requests
 *
 * Amount is in USDC base units (6 decimals).
 * receiptCid is the IPFS CID of the receipt image — stored on-chain as payoutRef.
 */

import { encodeAbiParameters, parseAbiParameters, type Hash } from "viem";
import { walletClient, publicClient } from "./deployer";
import { getVaultAbi, VAULT_ADDRESS } from "../lib/contracts";
import { execute } from "../lib/db";

export type ReimbursementParams = {
  receiptId: string;           // UUID from receipt_requests table
  poolId: number;
  ngoWallet: `0x${string}`;
  amountUsdc: bigint;          // in USDC base units (6 decimals)
  receiptCid: string;          // IPFS CID — pinned before calling this
};

export async function submitReimbursement(params: ReimbursementParams): Promise<Hash> {
  const { receiptId, poolId, ngoWallet, amountUsdc, receiptCid } = params;
  const abi = getVaultAbi();

  // Encode the IPFS CID as bytes32 for the payoutRef parameter.
  // CIDs longer than 32 bytes are truncated — store the full CID in the DB.
  const cidBytes = Buffer.from(receiptCid.slice(0, 32).padEnd(32, "\0"));
  const payoutRef = `0x${cidBytes.toString("hex")}` as `0x${string}`;

  const hash = await walletClient.writeContract({
    address: VAULT_ADDRESS,
    abi,
    functionName: "payout",
    args: [BigInt(poolId), ngoWallet, amountUsdc, payoutRef],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Write result back to DB
  await execute(
    `UPDATE receipt_requests
     SET status = 'paid', payout_tx_hash = $1, processed_at = NOW(), receipt_ipfs = $2
     WHERE id = $3`,
    [hash, receiptCid, receiptId],
  );

  console.log(`[reimbursement] Paid receipt ${receiptId} — tx: ${hash} (block ${receipt.blockNumber})`);
  return hash;
}
