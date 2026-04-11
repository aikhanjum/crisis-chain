/**
 * Pool deployer — deploys a new CrisisPoolVault contract for a given region.
 *
 * Called by the crisis intelligence service when a region crosses the severity threshold.
 *
 * TODO:
 * - Load compiled contract ABI + bytecode from contracts/out/CrisisPoolVault.json
 * - Use viem walletClient to deploy
 * - After deploy, upsert pool_id into crisis_nodes table
 * - Emit a Postgres NOTIFY so the frontend feed updates in real time
 */

import { createWalletClient, createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const RPC_URL = process.env.RPC_URL ?? "";
const PRIVATE_KEY = (process.env.PRIVATE_KEY ?? "0x0") as `0x${string}`;
const USDC_ADDRESS = (process.env.USDC_ADDRESS ?? "0x0") as `0x${string}`;

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(RPC_URL),
});

export const walletClient = createWalletClient({
  chain: arbitrumSepolia,
  transport: http(RPC_URL),
  account: privateKeyToAccount(PRIVATE_KEY),
});

export async function deployPool(regionId: string): Promise<`0x${string}`> {
  // TODO: load ABI + bytecode
  // const { abi, bytecode } = loadContract("CrisisPoolVault");
  // const hash = await walletClient.deployContract({ abi, bytecode, args: [USDC_ADDRESS, admin] });
  // const receipt = await publicClient.waitForTransactionReceipt({ hash });
  // return receipt.contractAddress!;
  throw new Error(`deployPool(${regionId}) not implemented — load contract artifacts first`);
}
