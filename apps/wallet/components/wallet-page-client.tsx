"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";

import { AppProviders } from "@/components/app-providers";
import {
  apiBaseUrl,
  erc20Abi,
  toBytes32,
  TxAction,
  TxRecord,
  usdcAddress,
  vaultAbi,
  vaultAddress,
} from "@/lib/contracts";
import { explorerTxUrl, humanityTestnet } from "@/lib/web3";

type PoolStats = {
  pool_id: string;
  total_donated_raw: string;
  total_paid_out_raw: string;
  net_raw: string;
};

const tokenDecimals = 6;

const actionLabels: Record<TxAction, string> = {
  approve: "Approve",
  donate: "Donate",
  payout: "Payout",
  requestReimbursement: "Reimburse Request",
};

function shorten(value?: string) {
  if (!value) return "-";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function WalletScreen() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [poolId, setPoolId] = useState("88");
  const [amount, setAmount] = useState("25");
  const [memo, setMemo] = useState("donation-88");
  const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHistory, setTxHistory] = useState<TxRecord[]>([]);

  const isWrongNetwork = isConnected && chainId !== humanityTestnet.id;
  const isConfigured = Boolean(usdcAddress && vaultAddress);

  const parsedAmount = useMemo(() => {
    try {
      return parseUnits(amount || "0", tokenDecimals);
    } catch {
      return 0n;
    }
  }, [amount]);

  async function loadPoolStats() {
    setIsLoadingStats(true);
    setStatsError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/pools/${poolId}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`API ${response.status}: ${response.statusText}`);
      }
      const json = (await response.json()) as PoolStats;
      setPoolStats(json);
    } catch (err) {
      setStatsError(
        err instanceof Error ? err.message : "Failed to load pool stats",
      );
      setPoolStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  }

  useEffect(() => {
    loadPoolStats().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addTxRecord(action: TxAction, hash: `0x${string}`) {
    setTxHistory((prev) => [
      {
        action,
        hash,
        at: new Date().toISOString(),
        status: "pending",
      },
      ...prev,
    ]);
  }

  function markTx(hash: `0x${string}`, status: TxRecord["status"], err?: string) {
    setTxHistory((prev) =>
      prev.map((item) =>
        item.hash === hash
          ? {
              ...item,
              status,
              error: err,
            }
          : item,
      ),
    );
  }

  async function sendTx(
    action: TxAction,
    request: Parameters<typeof writeContractAsync>[0],
  ) {
    if (!publicClient) throw new Error("Public client not ready");
    const hash = await writeContractAsync(request);
    addTxRecord(action, hash);
    try {
      await publicClient.waitForTransactionReceipt({ hash });
      markTx(hash, "confirmed");
      return hash;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      markTx(hash, "failed", msg);
      throw err;
    }
  }

  async function ensureNetwork() {
    if (!isConnected) throw new Error("Connect wallet first");
    if (isWrongNetwork) {
      await switchChainAsync({ chainId: humanityTestnet.id });
    }
  }

  async function onApprove() {
    setError(null);
    setIsWorking(true);
    try {
      if (!usdcAddress || !vaultAddress) throw new Error("Contract addresses missing");
      if (parsedAmount <= 0n) throw new Error("Enter a valid amount");
      await ensureNetwork();
      await sendTx("approve", {
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [vaultAddress, parsedAmount],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setIsWorking(false);
    }
  }

  async function onDonate() {
    setError(null);
    setIsWorking(true);
    try {
      if (!vaultAddress) throw new Error("Vault address missing");
      if (parsedAmount <= 0n) throw new Error("Enter a valid amount");
      await ensureNetwork();
      await sendTx("donate", {
        address: vaultAddress,
        abi: vaultAbi,
        functionName: "donate",
        args: [BigInt(poolId), parsedAmount, toBytes32(memo)],
      });
      await new Promise((r) => setTimeout(r, 4000));
      await loadPoolStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Donate failed");
    } finally {
      setIsWorking(false);
    }
  }


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-cyan-400">DONOR WALLET</p>
            <h1 className="text-2xl font-semibold">Donate to a Crisis Pool</h1>
            <p className="mt-1 text-sm text-slate-400">
              Use your wallet to approve mUSDC, donate into a regional pool, and track transparent activity.
            </p>
          </div>
          <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
        </header>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-3 text-lg font-medium">Wallet & Network Status</h2>
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-slate-400">Wallet:</span>{" "}
                  {isConnected ? shorten(address) : "Not connected"}
                </p>
                <p>
                  <span className="text-slate-400">Chain:</span>{" "}
                  {chainId ? `${chainId} ${isWrongNetwork ? "(wrong)" : "(ok)"}` : "Unknown"}
                </p>
                <p>
                  <span className="text-slate-400">USDC:</span> {shorten(usdcAddress)}
                </p>
                <p>
                  <span className="text-slate-400">Vault:</span> {shorten(vaultAddress)}
                </p>
              </div>
              {!isConfigured && (
                <p className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-300">
                  Missing `NEXT_PUBLIC_USDC_ADDRESS` or `NEXT_PUBLIC_VAULT_ADDRESS`.
                </p>
              )}
              {isWrongNetwork && (
                <button
                  className="mt-3 rounded bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-cyan-400"
                  onClick={() => switchChainAsync({ chainId: humanityTestnet.id })}
                >
                  Switch to Humanity Testnet
                </button>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-4 text-lg font-medium">Donate</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-slate-400">Pool ID</span>
                  <input
                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2"
                    value={poolId}
                    onChange={(e) => setPoolId(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-400">Amount (mUSDC)</span>
                  <input
                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-slate-400">Donation memo</span>
                  <input
                    className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  disabled={!isConnected || isWorking || !isConfigured}
                  onClick={onApprove}
                  className="rounded bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500 disabled:cursor-not-allowed disabled:bg-slate-700"
                >
                  {isWorking ? "Working..." : "1. Approve"}
                </button>
                <button
                  disabled={!isConnected || isWorking || !isConfigured}
                  onClick={onDonate}
                  className="rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                >
                  {isWorking ? "Working..." : "2. Donate"}
                </button>
              </div>
              {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-medium">Pool Analytics</h2>
                <button
                  className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                  onClick={() => loadPoolStats()}
                  disabled={isLoadingStats}
                >
                  {isLoadingStats ? "Refreshing..." : "Refresh"}
                </button>
              </div>
              {statsError ? (
                <p className="text-sm text-rose-400">{statsError}</p>
              ) : poolStats ? (
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-slate-400">Pool:</span> {poolStats.pool_id}
                  </p>
                  <p>
                    <span className="text-slate-400">Donated raw:</span> {poolStats.total_donated_raw}
                  </p>
                  <p>
                    <span className="text-slate-400">Paid out raw:</span> {poolStats.total_paid_out_raw}
                  </p>
                  <p>
                    <span className="text-slate-400">Net raw:</span> {poolStats.net_raw}
                  </p>
                  <p className="pt-2 text-cyan-300">
                    Net humanized: {formatUnits(BigInt(poolStats.net_raw), tokenDecimals)} mUSDC
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No data yet.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-3 text-lg font-medium">Session Transaction History</h2>
              {txHistory.length === 0 ? (
                <p className="text-sm text-slate-400">No transactions yet in this session.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {txHistory.map((tx) => (
                    <li key={tx.hash} className="rounded border border-slate-700 p-2">
                      <p className="font-medium">
                        {actionLabels[tx.action]}{" "}
                        <span className="text-xs text-slate-400">({tx.status})</span>
                      </p>
                      <a
                        href={explorerTxUrl(tx.hash)}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-cyan-300 hover:underline"
                      >
                        {tx.hash}
                      </a>
                      <p className="text-xs text-slate-500">{new Date(tx.at).toLocaleTimeString()}</p>
                      {tx.error && <p className="text-xs text-rose-400">{tx.error}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function WalletPageClient() {
  return (
    <AppProviders>
      <WalletScreen />
    </AppProviders>
  );
}
