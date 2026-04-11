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

  // Encode the receipt CID (or a placeholder) as bytes32 payoutRef.
  const refStr = (receiptCid ?? receiptId).slice(0, 32).padEnd(32, "\0");
  const payoutRef = `0x${Buffer.from(refStr).toString("hex")}` as `0x${string}`;

  const hash = await walletClient.writeContract({
    address: VAULT_ADDRESS,
    abi,
    functionName: "payout",
    args: [BigInt(poolId), ngoWallet, amountUsdc, payoutRef],
  });

  const txReceipt = await publicClient.waitForTransactionReceipt({ hash });

  // Update receipt_requests and write a matching row into payouts so the ledger reflects it
  await execute(
    `UPDATE receipt_requests
     SET status = 'paid', payout_tx_hash = $1, processed_at = NOW(), receipt_ipfs = $2
     WHERE id = $3`,
    [hash, receiptCid ?? null, receiptId],
  );

  await execute(
    `INSERT INTO payouts (tx_hash, log_index, block_number, pool_id, recipient, amount_raw, payout_ref, token, vault_address)
     VALUES ($1, 0, $2, $3, $4, $5, $6, 'USDC', $7)
     ON CONFLICT (tx_hash, log_index) DO NOTHING`,
    [hash, Number(txReceipt.blockNumber), poolId, ngoWallet, amountUsdc.toString(), receiptCid ?? receiptId, VAULT_ADDRESS],
  );

  console.log(`[reimbursement] Paid receipt ${receiptId} — tx: ${hash} (block ${txReceipt.blockNumber})`);
  return hash;
}
