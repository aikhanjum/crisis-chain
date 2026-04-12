/**
 * On-chain payout helper — demo treasury signer.
 *
 * Reads PRIVATE_KEY / USDC_ADDRESS / RPC_URL / CHAIN_ID from env and
 * performs real Mock-USDC transfers from a treasury wallet to NGO wallets
 * when receipts are finalized.
 *
 * The Mock USDC contract on the Humanity testnet exposes a permissionless
 * `mint(address,uint256)` function — we use it to top up the treasury when
 * its balance drops below the requested transfer amount, so demos never
 * silently fall back to fake hashes.
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
  defineChain,
  type Address,
  type Hex,
  type WalletClient,
  type PublicClient,
  type Chain,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

const USDC_DECIMALS = 6;

// 100,000 mUSDC top-up amount when treasury falls below the requested transfer.
const TOPUP_UNITS = parseUnits("100000", USDC_DECIMALS);

const erc20Abi = [
  {
    type: "function",
    stateMutability: "view",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

type ChainCtx = {
  wallet: WalletClient;
  publicClient: PublicClient;
  account: PrivateKeyAccount;
  usdc: Address;
  chain: Chain;
};

let ctx: ChainCtx | null = null;
let initLogged = false;

function getCtx(): ChainCtx | null {
  if (ctx) return ctx;

  const pk = process.env.PRIVATE_KEY;
  const usdc = process.env.USDC_ADDRESS;
  const rpcUrl = process.env.RPC_URL;
  const chainId = Number(process.env.CHAIN_ID ?? 0);

  const missing: string[] = [];
  if (!pk) missing.push("PRIVATE_KEY");
  if (!usdc) missing.push("USDC_ADDRESS");
  if (!rpcUrl) missing.push("RPC_URL");
  if (!chainId) missing.push("CHAIN_ID");

  if (missing.length > 0) {
    console.warn(
      `[chain] Missing env vars (${missing.join(", ")}) — on-chain payouts disabled. ` +
      `Make sure the api-gateway dev script loads the root .env file.`,
    );
    return null;
  }

  const chain = defineChain({
    id: chainId,
    name: "Humanity Testnet",
    nativeCurrency: { name: "Humanity", symbol: "H", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl!] } },
  });

  const account = privateKeyToAccount(pk! as Hex);
  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl!) });
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl!) }) as PublicClient;

  ctx = { wallet, publicClient, account, usdc: usdc! as Address, chain };

  if (!initLogged) {
    initLogged = true;
    console.log(
      `[chain] Treasury wallet ready: ${account.address} ` +
      `(USDC=${usdc}, chainId=${chainId})`,
    );
    // Fire-and-forget balance probe
    publicClient
      .readContract({
        address: usdc! as Address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account.address],
      })
      .then((bal) => {
        console.log(
          `[chain] Treasury USDC balance at startup: ${formatUnits(bal as bigint, USDC_DECIMALS)} mUSDC`,
        );
      })
      .catch((err) => {
        console.warn(`[chain] Could not read treasury balance at startup: ${String(err)}`);
      });
  }

  return ctx;
}

export type PayoutResult =
  | {
      ok: true;
      txHash: Hex;
      from: Address;
      to: Address;
      amount: string;
      blockNumber: bigint;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Ensure the treasury has at least `needed` units of USDC; mint a top-up if not.
 * Mock USDC has a permissionless mint() — fine for demo / testnet.
 */
async function ensureTreasuryFunded(c: ChainCtx, needed: bigint): Promise<void> {
  const balance = (await c.publicClient.readContract({
    address: c.usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [c.account.address],
  })) as bigint;

  if (balance >= needed) return;

  const mintAmount = needed > TOPUP_UNITS ? needed * 2n : TOPUP_UNITS;
  console.log(
    `[chain] Treasury balance ${formatUnits(balance, USDC_DECIMALS)} mUSDC < ` +
    `${formatUnits(needed, USDC_DECIMALS)} mUSDC needed — minting ` +
    `${formatUnits(mintAmount, USDC_DECIMALS)} mUSDC to treasury`,
  );

  const mintHash = await c.wallet.writeContract({
    address: c.usdc,
    abi: erc20Abi,
    functionName: "mint",
    args: [c.account.address, mintAmount],
    account: c.account,
    chain: c.chain,
  });
  await c.publicClient.waitForTransactionReceipt({ hash: mintHash });
  console.log(`[chain] Mint confirmed: ${mintHash}`);
}

/**
 * Transfer USDC from the treasury wallet to the given recipient.
 * Amount is a decimal string or number (e.g. 21.93) — converted to 6-decimal units.
 */
export async function transferUsdcTo(
  recipient: string,
  amount: number | string,
): Promise<PayoutResult> {
  const c = getCtx();
  if (!c) return { ok: false, error: "chain-not-configured" };

  try {
    const value = parseUnits(String(amount), USDC_DECIMALS);

    await ensureTreasuryFunded(c, value);

    console.log(
      `[chain] Transferring ${amount} mUSDC ${c.account.address} → ${recipient}`,
    );

    const txHash = await c.wallet.writeContract({
      address: c.usdc,
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient as Address, value],
      account: c.account,
      chain: c.chain,
    });

    const receipt = await c.publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(
      `[chain] Transfer confirmed: ${txHash} (block ${receipt.blockNumber}, status=${receipt.status})`,
    );

    if (receipt.status !== "success") {
      return { ok: false, error: `tx reverted: ${txHash}` };
    }

    return {
      ok: true,
      txHash,
      from: c.account.address,
      to: recipient as Address,
      amount: String(amount),
      blockNumber: receipt.blockNumber,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chain] transferUsdcTo failed:", msg);
    return { ok: false, error: msg };
  }
}
