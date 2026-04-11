/**
 * NGO on-chain role management.
 *
 * Two roles:
 *   - PAYOUT_ROLE: allows the bridge wallet to call vault.payout() on behalf of NGOs
 *   - NGO_ROLE: allows the NGO wallet to call vault.requestReimbursement() directly
 *
 * approveNgo() grants PAYOUT_ROLE (for bridge-as-relayer payouts)
 * grantNgoRole() grants NGO_ROLE (for NGO-initiated on-chain requests)
 */

import { keccak256, toBytes, type Hash } from "viem";
import { walletClient, publicClient } from "./deployer";
import { getVaultAbi, VAULT_ADDRESS } from "../lib/contracts";
import { execute } from "../lib/db";

const PAYOUT_ROLE: `0x${string}` = keccak256(toBytes("PAYOUT_ROLE"));
const NGO_ROLE: `0x${string}` = keccak256(toBytes("NGO_ROLE"));

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

export async function grantNgoRole(ngoWallet: `0x${string}`): Promise<Hash> {
  const abi = getVaultAbi();

  const hash = await walletClient.writeContract({
    address: VAULT_ADDRESS,
    abi,
    functionName: "grantRole",
    args: [NGO_ROLE, ngoWallet],
  });

  await publicClient.waitForTransactionReceipt({ hash });

  console.log(`[ngo] Granted NGO_ROLE to ${ngoWallet} — tx: ${hash}`);
  return hash;
}

export async function revokeNgoRole(ngoWallet: `0x${string}`): Promise<Hash> {
  const abi = getVaultAbi();

  const hash = await walletClient.writeContract({
    address: VAULT_ADDRESS,
    abi,
    functionName: "revokeRole",
    args: [NGO_ROLE, ngoWallet],
  });

  await publicClient.waitForTransactionReceipt({ hash });

  console.log(`[ngo] Revoked NGO_ROLE from ${ngoWallet} — tx: ${hash}`);
  return hash;
}
