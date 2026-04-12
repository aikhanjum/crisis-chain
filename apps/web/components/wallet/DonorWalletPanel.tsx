"use client";

import Link from "next/link";
import { ConnectButton, darkTheme } from "@rainbow-me/rainbowkit";
import { useCallback, useEffect, useMemo, useState } from "react";
import { parseUnits, type TransactionReceipt } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";

import { PoolAnalyticsCard } from "@/components/wallet/PoolAnalyticsCard";
import { TxHistoryCard } from "@/components/wallet/TxHistoryCard";
import { WalletStatusCard } from "@/components/wallet/WalletStatusCard";
import { WalletTransactionCard } from "@/components/wallet/WalletTransactionCard";
import { Button } from "@/components/ui/Button";
import { formatUsdc } from "@/hooks/usePoolData";
import { Web3Provider } from "@/providers/Web3Provider";
import { CHAIN_ID, USDC_ADDRESS, USDC_DECIMALS, VAULT_ADDRESS } from "@/lib/constants";
import { humanityTestnet } from "@/lib/humanity";
import { erc20Abi, toBytes32, TxAction, vaultAbi } from "@/lib/wallet-contracts";
import { poolIdFromRegionId } from "@/lib/wallet-utils";
import { usePoolAnalytics } from "@/hooks/usePoolAnalytics";
import { useTxHistory } from "@/hooks/useTxHistory";
import { useCrisisRegion } from "@/hooks/useCrisisRegions";
import { getPoolLedger, type PoolLedger, type PoolStats } from "@/lib/api";

type DonorWalletPanelProps = {
  title: string;
  subtitle: string;
  regionId?: string;
  poolIdEditable?: boolean;
  modal?: boolean;
};

export function DonorWalletPanelInner({
  title,
  subtitle,
  regionId,
  poolIdEditable = true,
  modal,
}: DonorWalletPanelProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const { history, pushPending, markResult } = useTxHistory();

  const [poolId, setPoolId] = useState(regionId ? poolIdFromRegionId(regionId) : "88");
  const [amount, setAmount] = useState("5");
  const [memo, setMemo] = useState("donation");
  const [recipient, setRecipient] = useState("");
  const [payoutRef, setPayoutRef] = useState("payout");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: regionData } = useCrisisRegion(regionId ?? "");
  const { data: poolStats, loading, error: poolError, refresh, applySnapshot } = usePoolAnalytics(poolId);

  const isConfigured = Boolean(USDC_ADDRESS && VAULT_ADDRESS);
  const isWrongNetwork = isConnected && chainId !== CHAIN_ID;
  const parsedAmount = useMemo(() => {
    try {
      return parseUnits(amount || "0", USDC_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  useEffect(() => {
    if (!recipient && address) setRecipient(address);
  }, [address, recipient]);

  useEffect(() => {
    if (regionId) {
      const mapped = regionData?.poolId ?? poolIdFromRegionId(regionId);
      setPoolId(mapped);
      setMemo(`donation-${mapped}`);
      setPayoutRef(`payout-${mapped}`);
    }
  }, [regionId, regionData]);

  /**
   * Updates map drawer, ledger page, and this panel immediately after a tx confirms.
   * Uses on-chain `poolBalances` + DB paid-out (or adjusted after payout) so we do not
   * wait for the indexer. See CrisisPoolVault.poolBalances in contracts.
   */
  const pushPoolCachesFromChain = useCallback(
    async (kind: "donate" | "payout", txHash: `0x${string}`, receipt: TransactionReceipt) => {
      if (!publicClient || !VAULT_ADDRESS) return;

      const balance = (await publicClient.readContract({
        address: VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: "poolBalances",
        args: [BigInt(poolId)],
      })) as bigint;

      const ledgerKey = regionId && regionId.length > 0 ? regionId : poolId;
      let ledger: PoolLedger;
      try {
        ledger = await getPoolLedger(ledgerKey);
      } catch {
        try {
          ledger = await getPoolLedger(poolId);
        } catch {
          ledger = {
            poolId,
            totalDonatedRaw: "0",
            totalPaidOutRaw: "0",
            netRaw: "0",
            donations: [],
            payouts: [],
          };
        }
      }

      let paid = BigInt(ledger.totalPaidOutRaw || "0");
      if (kind === "payout") {
        const indexed = ledger.payouts.some((p) => p.txHash.toLowerCase() === txHash.toLowerCase());
        if (!indexed) paid += parsedAmount;
      }

      const donated = balance + paid;
      const net = donated - paid;

      const stats: PoolStats = {
        pool_id: poolId,
        total_donated_raw: donated.toString(),
        total_paid_out_raw: paid.toString(),
        net_raw: net.toString(),
      };

      applySnapshot(stats);
      queryClient.setQueryData(["pool", poolId, "stats"], stats);

      const blockNumber = receipt.blockNumber != null ? Number(receipt.blockNumber) : 0;
      const ts = new Date().toISOString();
      let donations = [...ledger.donations];
      let payouts = [...ledger.payouts];

      if (kind === "donate" && address) {
        if (!donations.some((d) => d.txHash.toLowerCase() === txHash.toLowerCase())) {
          donations.unshift({
            txHash,
            blockNumber,
            actor: address,
            amount: parsedAmount.toString(),
            memo,
            timestamp: ts,
          });
        }
      } else if (kind === "payout") {
        if (!payouts.some((p) => p.txHash.toLowerCase() === txHash.toLowerCase())) {
          payouts.unshift({
            txHash,
            blockNumber,
            actor: recipient,
            amount: parsedAmount.toString(),
            memo: payoutRef,
            timestamp: ts,
          });
        }
      }

      const ledgerFull: PoolLedger = {
        poolId: ledger.poolId || poolId,
        totalDonatedRaw: donated.toString(),
        totalPaidOutRaw: paid.toString(),
        netRaw: net.toString(),
        donations,
        payouts,
      };
      queryClient.setQueryData(["pool", poolId, "ledger"], ledgerFull);

      // Defer DB sync so indexer/API are less likely to overwrite with stale zeros
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["pool", poolId] });
        queryClient.invalidateQueries({ queryKey: ["ngoPoolLedger"] });
      }, 45_000);
    },
    [
      publicClient,
      poolId,
      regionId,
      queryClient,
      applySnapshot,
      address,
      memo,
      recipient,
      payoutRef,
      parsedAmount,
    ],
  );

  async function ensureNetwork() {
    if (!isConnected) throw new Error("Connect wallet first.");
    if (isWrongNetwork) {
      await switchChainAsync({ chainId: humanityTestnet.id });
    }
  }

  async function sendTx(action: TxAction, request: Parameters<typeof writeContractAsync>[0]) {
    if (!publicClient) throw new Error("Public chain client not ready");
    const hash = await writeContractAsync(request);
    pushPending(action, hash);
    try {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      markResult(hash, "confirmed");
      return { hash, receipt };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      markResult(hash, "failed", message);
      throw err;
    }
  }

  async function onApprove() {
    setError(null); setIsWorking(true);
    try {
      if (!USDC_ADDRESS || !VAULT_ADDRESS) throw new Error("Contract addresses are missing.");
      if (parsedAmount <= 0n) throw new Error("Enter a valid amount.");
      await ensureNetwork();
      await sendTx("approve", { address: USDC_ADDRESS, abi: erc20Abi, functionName: "approve", args: [VAULT_ADDRESS, parsedAmount] });
    } catch (err) { setError(err instanceof Error ? err.message : "Approve failed."); }
    finally { setIsWorking(false); }
  }

  async function onDonate() {
    setError(null); setIsWorking(true);
    try {
      if (!VAULT_ADDRESS) throw new Error("Vault address is missing.");
      if (parsedAmount <= 0n) throw new Error("Enter a valid amount.");
      await ensureNetwork();
      const { hash, receipt } = await sendTx("donate", {
        address: VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: "donate",
        args: [BigInt(poolId), parsedAmount, toBytes32(memo)],
      });
      await pushPoolCachesFromChain("donate", hash, receipt);
    } catch (err) { setError(err instanceof Error ? err.message : "Donate failed."); }
    finally { setIsWorking(false); }
  }

  async function onPayout() {
    setError(null); setIsWorking(true);
    try {
      if (!VAULT_ADDRESS) throw new Error("Vault address is missing.");
      if (!recipient.startsWith("0x") || recipient.length !== 42) throw new Error("Enter a valid recipient address.");
      if (parsedAmount <= 0n) throw new Error("Enter a valid amount.");
      await ensureNetwork();
      const { hash, receipt } = await sendTx("payout", {
        address: VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: "payout",
        args: [BigInt(poolId), recipient as `0x${string}`, parsedAmount, toBytes32(payoutRef)],
      });
      await pushPoolCachesFromChain("payout", hash, receipt);
    } catch (err) { setError(err instanceof Error ? err.message : "Payout failed."); }
    finally { setIsWorking(false); }
  }

  if (modal) {
    const btnBase = "inline-flex items-center justify-center gap-2 rounded-full border-[3px] border-black/75 px-5 py-2 text-[10px] font-bold uppercase tracking-widest shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-30";
    const disabled = !isConnected || !isConfigured || isWorking;

    return (
      <div className="p-6 text-zinc-100">

        {/* Header */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
              {regionId && (
                <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
                  {regionId}
                </span>
              )}
              <span className="text-zinc-700">·</span>
              <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
                Pool {poolId}
              </span>
            </div>
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
          </div>
          <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
        </div>

        {/* Pool stats */}
        {poolStats && (
          <div className="mb-5 overflow-hidden rounded-xl border border-zinc-800/70 bg-zinc-900/50">
            <div className="grid grid-cols-3 divide-x divide-zinc-800/60">
              {[
                { label: "Raised",   value: formatUsdc(poolStats.total_donated_raw),  color: "text-emerald-400" },
                { label: "Paid out", value: formatUsdc(poolStats.total_paid_out_raw), color: "text-sky-400"     },
                { label: "Balance",  value: formatUsdc(poolStats.net_raw),             color: "text-zinc-100"   },
              ].map(({ label, value, color }) => (
                <div key={label} className="px-4 py-3">
                  <p className="text-[9px] uppercase tracking-widest text-zinc-600">{label}</p>
                  <p className={`mt-1.5 tabular-nums text-base font-semibold leading-none ${color}`}>{value}</p>
                  <p className="mt-1 text-[9px] text-zinc-700">USDC</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wrong network */}
        {isWrongNetwork && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-2.5">
            <p className="text-xs text-amber-400">Wrong network — switch to Humanity Testnet</p>
            <button
              onClick={() => switchChainAsync({ chainId: humanityTestnet.id })}
              className="text-xs font-medium text-amber-300 hover:text-amber-200 transition-colors"
            >
              Switch →
            </button>
          </div>
        )}

        {/* Form */}
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-600">Amount (mUSDC)</span>
            <div className="relative">
              <input
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 py-3 pl-4 pr-16 text-2xl font-light tabular-nums text-white placeholder:text-zinc-700 transition-colors focus:border-zinc-600 focus:outline-none"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-600">USDC</span>
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] uppercase tracking-widest text-zinc-600">Memo</span>
            <input
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm text-zinc-300 placeholder:text-zinc-700 transition-colors focus:border-zinc-600 focus:outline-none"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </label>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap gap-2.5">
          <button onClick={onApprove} disabled={disabled} className={`${btnBase} bg-zinc-700 text-white hover:bg-zinc-600`}>
            {isWorking && <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />}
            Approve
          </button>
          <button onClick={onDonate} disabled={disabled} className={`${btnBase} bg-zinc-600 text-white hover:bg-zinc-500`}>
            {isWorking && <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />}
            Donate
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/[0.07] px-4 py-2.5 text-sm text-rose-300">
            {error}
          </p>
        )}

      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto w-full max-w-5xl px-6 py-10">

        {/* Nav */}
        <div className="mb-9 flex items-center justify-between">
          <Link
            href="/map"
            className="inline-flex items-center gap-1.5 rounded-full border-[3px] border-black/75 bg-zinc-700 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.13)] transition-all duration-150 hover:bg-zinc-600 active:translate-y-px"
          >
            ← Back to map
          </Link>
          {regionId && (
            <Link
              href={`/pool/${regionId}/ledger`}
              className="inline-flex items-center gap-1.5 rounded-full border-[3px] border-black/75 bg-zinc-700 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.13)] transition-all duration-150 hover:bg-zinc-600 active:translate-y-px"
            >
              View Pool Ledger →
            </Link>
          )}
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-widest text-zinc-600">Donor Wallet</p>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 max-w-lg text-sm text-zinc-400">{subtitle}</p>
            {regionId && (
              <p className="mt-2 font-mono text-xs text-zinc-600">
                Region {regionId}&ensp;·&ensp;Pool {poolId}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
            <Button variant="ghost" size="sm" onClick={() => refresh()}>Sync</Button>
          </div>
        </div>

        {/* Content */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <WalletStatusCard
              address={address} chainId={chainId} isConnected={isConnected}
              isWrongNetwork={isWrongNetwork} isConfigured={isConfigured}
              usdcAddress={USDC_ADDRESS} vaultAddress={VAULT_ADDRESS}
              onSwitchNetwork={() => switchChainAsync({ chainId: humanityTestnet.id })}
            />
            <WalletTransactionCard
              poolId={poolId} amount={amount} memo={memo} recipient={recipient}
              payoutRef={payoutRef} error={error} isConnected={isConnected}
              isConfigured={isConfigured} isWorking={isWorking} poolIdEditable={poolIdEditable}
              onPoolIdChange={setPoolId} onAmountChange={setAmount} onMemoChange={setMemo}
              onRecipientChange={setRecipient} onPayoutRefChange={setPayoutRef}
              onApprove={onApprove} onDonate={onDonate} onPayout={onPayout}
            />
          </div>
          <div className="space-y-5">
            <PoolAnalyticsCard poolId={poolId} loading={loading} error={poolError} data={poolStats} onRefresh={refresh} />
            <TxHistoryCard txHistory={history} />
          </div>
        </section>

      </main>
    </div>
  );
}

export function DonorWalletPanel(props: DonorWalletPanelProps) {
  return (
    <Web3Provider theme={darkTheme()}>
      <DonorWalletPanelInner {...props} />
    </Web3Provider>
  );
}
