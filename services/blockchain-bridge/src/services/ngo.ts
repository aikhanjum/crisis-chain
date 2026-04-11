/**
 * NGO on-chain approval.
 *
 * When an admin approves an NGO application, this calls:
 *   vault.grantRole(PAYOUT_ROLE, ngoWallet)
 *
 * After this tx confirms, the NGO wallet can call vault.payout() for their
 * approved pool regions.
 */

import { keccak256, toBytes, type Hash } from "viem";
import { walletClient, publicClient } from "./deployer";
import { getVaultAbi, VAULT_ADDRESS } from "../lib/contracts";
import { execute } from "../lib/db";

const PAYOUT_ROLE: `0x${string}` = keccak256(toBytes("PAYOUT_ROLE"));

export async function approveNgo(ngoWallet: `0x${string}`): Promise<Hash> {
  const abi = getVaultAbi();

  const hash = await walletClient.writeContract({
    address: VAULT_ADDRESS,
    abi,
    functionName: "grantRole",
    args: [PAYOUT_ROLE, ngoWallet],
  });

  await publicClient.waitForTransactionReceipt({ hash });

  // Reflect approval in DB
  await execute(
    "UPDATE ngos SET status = 'approved', approved_at = NOW() WHERE wallet_address = $1",
    [ngoWallet.toLowerCase()],
  );

  console.log(`[ngo] Approved ${ngoWallet} — tx: ${hash}`);
  return hash;
}

export async function revokeNgo(ngoWallet: `0x${string}`): Promise<Hash> {
  const abi = getVaultAbi();

  const hash = await walletClient.writeContract({
    address: VAULT_ADDRESS,
    abi,
    functionName: "revokeRole",
    args: [PAYOUT_ROLE, ngoWallet],
  });

  await publicClient.waitForTransactionReceipt({ hash });

  await execute(
    "UPDATE ngos SET status = 'suspended' WHERE wallet_address = $1",
    [ngoWallet.toLowerCase()],
  );

  console.log(`[ngo] Revoked ${ngoWallet} — tx: ${hash}`);
  return hash;
}
