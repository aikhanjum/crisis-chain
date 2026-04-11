/**
 * On-chain event listener — mirrors contract events to Postgres
 * so the frontend doesn't need to query the chain on every page load.
 *
 * The Rust indexer already handles this for the existing vault.
 * This service handles events from dynamically deployed regional pools.
 *
 * TODO:
 * - Watch for Donation and Payout events on each deployed pool address
 * - Use publicClient.watchContractEvent()
 * - Upsert into donations / payouts tables
 * - NOTIFY via Postgres so WebSocket feed updates instantly
 */

import { publicClient } from "./deployer";

export async function watchPool(contractAddress: `0x${string}`, poolId: number): Promise<void> {
  // TODO: load ABI
  // publicClient.watchContractEvent({
  //   address: contractAddress,
  //   abi: CrisisPoolVaultAbi,
  //   eventName: "Donation",
  //   onLogs: (logs) => persistDonations(logs, poolId),
  // });
  console.log(`[events] Watching pool ${poolId} at ${contractAddress}`);
}
