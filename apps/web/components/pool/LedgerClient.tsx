"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { Web3Provider } from "@/providers/Web3Provider";
import { EXPLORER_BASE_URL } from "@/lib/constants";
import { usePoolLedger, formatUsdc } from "@/hooks/usePoolData";
import { useCrisisRegion } from "@/hooks/useCrisisRegions";
import { poolIdFromRegionId, shortenAddress } from "@/lib/wallet-utils";

type MergedRow = {
  type: "donation" | "payout";
  txHash: string;
  blockNumber: number;
  actor: string;
  amount: string;
  memo?: string;
};

function LedgerInner() {
  const params = useParams<{ regionId: string }>();
  const regionId = params?.regionId ?? "";
  const { data: regionData } = useCrisisRegion(regionId);
  const poolId = regionData?.poolId ?? poolIdFromRegionId(regionId);

  const { data: ledger, isLoading: ledgerLoading, error: ledgerError } = usePoolLedger(poolId);
  const statsLoading = ledgerLoading;
  const stats = ledger ? {
    total_donated_raw: ledger.totalDonatedRaw,
    total_paid_out_raw: ledger.totalPaidOutRaw,
    net_raw: ledger.netRaw,
  } : null;

  const rows = useMemo<MergedRow[]>(() => {
    if (!ledger) return [];
    const donations: MergedRow[] = (ledger.donations ?? []).map((d) => ({
      type: "donation", txHash: d.txHash, blockNumber: d.blockNumber,
      actor: d.actor, amount: d.amount, memo: d.memo,
    }));
    const payouts: MergedRow[] = (ledger.payouts ?? []).map((p) => ({
      type: "payout", txHash: p.txHash, blockNumber: p.blockNumber,
      actor: p.actor, amount: p.amount, memo: p.memo,
    }));
    return [...donations, ...payouts].sort((a, b) => b.blockNumber - a.blockNumber);
  }, [ledger]);

  const explorerTx = (hash: string) =>
    `${EXPLORER_BASE_URL.replace(/\/$/, "")}/tx/${hash}`;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-6">
          <Link href="/map" className="text-xs text-zinc-500 hover:text-zinc-300">← Back to map</Link>
          <h1 className="mt-1 text-2xl font-bold">Pool Ledger</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Region: {regionId} &middot; Pool: {poolId} &middot; All transactions are on-chain
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Raised", value: stats ? formatUsdc(stats.total_donated_raw) : "—", color: "text-green-400" },
            { label: "Total Disbursed", value: stats ? formatUsdc(stats.total_paid_out_raw) : "—", color: "text-blue-400" },
            { label: "Net Balance", value: stats ? formatUsdc(stats.net_raw) : "—", color: "text-cyan-300" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
              <p className={`mt-1 text-lg font-semibold ${color}`}>
                {statsLoading ? "…" : value} <span className="text-xs text-zinc-500">USDC</span>
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="grid grid-cols-[2rem_1fr_6rem_5rem_2.5rem] gap-2 border-b border-zinc-800 bg-zinc-800/50 px-4 py-2 text-[11px] uppercase tracking-wider text-zinc-500">
            <span /><span>Actor</span><span className="text-right">Amount</span><span className="text-right">Block</span><span />
          </div>

          {ledgerLoading && <p className="px-4 py-8 text-center text-sm text-zinc-500">Loading ledger…</p>}
          {ledgerError && <p className="px-4 py-8 text-center text-sm text-red-400">Could not load ledger. Check API gateway + indexer.</p>}
          {!ledgerLoading && !ledgerError && rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-zinc-500">No transactions indexed for this pool yet.</p>}

          {rows.map((row, i) => {
            const isDonation = row.type === "donation";
            return (
              <div key={`${row.txHash}-${i}`} className="grid grid-cols-[2rem_1fr_6rem_5rem_2.5rem] items-center gap-2 border-b border-zinc-800/50 px-4 py-3 text-sm last:border-b-0">
                <span>{isDonation ? <ArrowDownLeft className="h-4 w-4 text-green-400" /> : <ArrowUpRight className="h-4 w-4 text-blue-400" />}</span>
                <div className="min-w-0">
                  <span className="font-mono text-xs text-zinc-300">{shortenAddress(row.actor)}</span>
                  {row.memo && <span className="ml-2 text-xs text-zinc-500 truncate">{row.memo}</span>}
                </div>
                <span className={`text-right font-mono text-xs ${isDonation ? "text-green-400" : "text-blue-400"}`}>{formatUsdc(row.amount)}</span>
                <span className="text-right font-mono text-xs text-zinc-500">{row.blockNumber}</span>
                <span className="flex justify-center">
                  {row.txHash ? (
                    <a href={explorerTx(row.txHash)} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white" title="View on explorer">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  ) : <span className="text-zinc-700">—</span>}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-between text-xs text-zinc-500">
          <Link href={`/donate/${regionId}`} className="hover:text-white">Donate to this pool →</Link>
          <span>
            Data from on-chain indexer &middot;{" "}
            <a href={EXPLORER_BASE_URL.replace(/\/$/, "")} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">Explorer</a>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LedgerClient() {
  return (
    <Web3Provider>
      <LedgerInner />
    </Web3Provider>
  );
}
