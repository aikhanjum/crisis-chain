/**
 * Pool deployer.
 *
 * Architecture note: CrisisChain uses a single CrisisPoolVault contract with
 * a poolId mapping — one vault, many pools. "Deploying a pool" means assigning
 * the next sequential pool ID to a region and writing it to the DB.
 * No new contract is deployed per region.
 *
 * Flow:
 *   1. Read the current max pool_id from crisis_nodes
 *   2. Assign next_id = max + 1
 *   3. UPDATE crisis_nodes SET pool_id = next_id, pool_address = VAULT_ADDRESS
 *   4. Return { poolId, contractAddress }
 */

import { createWalletClient, createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { queryOne, execute } from "../lib/db";
import { VAULT_ADDRESS } from "../lib/contracts";

const RPC_URL = process.env.RPC_URL ?? "";
const PRIVATE_KEY = (process.env.PRIVATE_KEY ?? "0x0") as `0x${string}`;

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(RPC_URL),
});

export const walletClient = createWalletClient({
  chain: arbitrumSepolia,
  transport: http(RPC_URL),
  account: privateKeyToAccount(PRIVATE_KEY),
});

export type PoolDeployResult = {
  poolId: number;
  contractAddress: `0x${string}`;
  regionId: string;
};

export async function deployPool(regionId: string): Promise<PoolDeployResult> {
  if (!VAULT_ADDRESS) throw new Error("VAULT_ADDRESS env var is not set");

  // Check the region isn't already assigned a pool
  const existing = await queryOne<{ pool_id: number }>(
    "SELECT pool_id FROM crisis_nodes WHERE region_id = $1",
    [regionId],
  );
  if (existing?.pool_id) {
    return { poolId: existing.pool_id, contractAddress: VAULT_ADDRESS, regionId };
  }

  // Get next sequential pool ID
  const maxRow = await queryOne<{ max: string }>(
    "SELECT COALESCE(MAX(pool_id), 0)::text AS max FROM crisis_nodes",
  );
  const nextPoolId = Number(maxRow?.max ?? 0) + 1;

  // Write to DB
  await execute(
    "UPDATE crisis_nodes SET pool_id = $1, pool_address = $2 WHERE region_id = $3",
    [nextPoolId, VAULT_ADDRESS, regionId],
  );

  console.log(`[deployer] Assigned pool_id=${nextPoolId} to region ${regionId}`);
  return { poolId: nextPoolId, contractAddress: VAULT_ADDRESS, regionId };
}
