"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState, useCallback } from "react";
import { ArrowDownLeft, ArrowUpRight, Copy, Check, ExternalLink } from "lucide-react";

import { Web3Provider } from "@/providers/Web3Provider";
import { EXPLORER_BASE_URL } from "@/lib/constants";
import { usePoolLedger, formatUsdc } from "@/hooks/usePoolData";
import { useCrisisRegion } from "@/hooks/useCrisisRegions";
import { poolIdFromRegionId } from "@/lib/wallet-utils";

type MergedRow = {
  type: "donation" | "payout";
  txHash: string;
  blockNumber: number;
  actor: string;
  amount: string;
  memo?: string;
};

function shorten(str: string, head = 6, tail = 4): string {
  if (!str) return "—";
  if (str.length <= head + tail + 3) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
}

function CopyableHash({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);

  return (
    <button
      onClick={copy}
      className="group/copy flex items-center gap-1 text-left"
      title={`Click to copy: ${value}`}
    >
      <span className="font-mono text-[11px] text-zinc-400 transition-colors group-hover/copy:text-zinc-200">
        {shorten(value)}
      </span>
      <span className="opacity-0 transition-opacity group-hover/copy:opacity-100">
        {copied
          ? <Check className="h-3 w-3 text-emerald-400" />
          : <Copy className="h-3 w-3 text-zinc-600" />}
      </span>
    </button>
  );
}

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

        {/* Header */}
        <div className="mb-9">
          <Link href="/map" className="text-xs text-zinc-600 transition-colors hover:text-zinc-400">
            ← Back to map
          </Link>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Pool Ledger</h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
              {shorten(regionId, 8, 6)}
            </span>
            <span className="text-zinc-700">·</span>
            <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
              {shorten(poolId, 8, 6)}
            </span>
            <span className="text-zinc-700">·</span>
            <span className="text-[10px] text-zinc-600">all transactions on-chain</span>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-3 gap-3">
          {[
            { label: "Total Raised",   value: stats ? formatUsdc(stats.total_donated_raw)  : "—", color: "text-emerald-400" },
            { label: "Disbursed",      value: stats ? formatUsdc(stats.total_paid_out_raw) : "—", color: "text-sky-400"     },
            { label: "Net Balance",    value: stats ? formatUsdc(stats.net_raw)             : "—", color: "text-zinc-100"   },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-zinc-800/70 bg-zinc-900/50 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">{label}</p>
              <p className={`mt-2 text-xl font-light tabular-nums leading-none ${color}`}>
                {statsLoading ? <span className="text-zinc-700">…</span> : value}
              </p>
              <p className="mt-1 text-[10px] text-zinc-700">USDC</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-zinc-800/70 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">

          {/* Column headers */}
          <div className="grid grid-cols-[2.5rem_1fr_6rem_4rem] gap-4 border-b border-zinc-800/60 px-5 py-3">
            <span />
            <span className="text-[10px] uppercase tracking-widest text-zinc-600">Transaction</span>
            <span className="text-right text-[10px] uppercase tracking-widest text-zinc-600">Amount</span>
            <span className="text-right text-[10px] uppercase tracking-widest text-zinc-600">Block</span>
          </div>

          {/* Loading */}
          {ledgerLoading && (
            <div className="flex flex-col items-center gap-3 px-5 py-14">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
              <p className="text-xs text-zinc-600">Loading ledger…</p>
            </div>
          )}

          {/* Error */}
          {ledgerError && (
            <p className="px-5 py-14 text-center text-xs text-red-400/70">
              Could not load ledger. Check API gateway + indexer.
            </p>
          )}

          {/* Empty */}
          {!ledgerLoading && !ledgerError && rows.length === 0 && (
            <p className="px-5 py-14 text-center text-xs text-zinc-600">
              No transactions indexed for this pool yet.
            </p>
          )}

          {/* Rows */}
          {rows.map((row, i) => {
            const isDonation = row.type === "donation";
            return (
              <div
                key={`${row.txHash}-${i}`}
                className="group grid grid-cols-[2.5rem_1fr_6rem_4rem] items-center gap-4 border-b border-zinc-800/40 px-5 py-4 transition-colors last:border-b-0 hover:bg-white/[0.02]"
              >
                {/* Type icon */}
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                  isDonation ? "bg-emerald-400/10" : "bg-sky-400/10"
                }`}>
                  {isDonation
                    ? <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
                    : <ArrowUpRight  className="h-3.5 w-3.5 text-sky-400" />}
                </div>

                {/* Main cell */}
                <div className="min-w-0 flex flex-col gap-1">
                  {/* Tx hash + explorer link */}
                  <div className="flex items-center gap-1.5">
                    {row.txHash
                      ? <CopyableHash value={row.txHash} />
                      : <span className="font-mono text-[11px] text-zinc-700">no hash</span>}
                    {row.txHash && (
                      <a
                        href={explorerTx(row.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View on explorer"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <ExternalLink className="h-3 w-3 text-zinc-600 hover:text-zinc-400" />
                      </a>
                    )}
                  </div>

                  {/* Actor */}
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-semibold uppercase tracking-wider ${
                      isDonation ? "text-emerald-700" : "text-sky-700"
                    }`}>
                      {isDonation ? "from" : "to"}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-600">{shorten(row.actor)}</span>
                  </div>

                  {/* Memo */}
                  {row.memo && (
                    <span className="truncate text-[10px] italic text-zinc-700">{row.memo}</span>
                  )}
                </div>

                {/* Amount */}
                <div className="text-right">
                  <span className={`tabular-nums text-sm font-medium ${
                    isDonation ? "text-emerald-400" : "text-sky-400"
                  }`}>
                    {formatUsdc(row.amount)}
                  </span>
                  <p className="mt-0.5 text-[10px] text-zinc-700">USDC</p>
                </div>

                {/* Block */}
                <div className="text-right">
                  <span className="font-mono text-[11px] text-zinc-600">
                    #{row.blockNumber.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-between text-[11px] text-zinc-600">
          <Link href={`/donate/${regionId}`} className="transition-colors hover:text-zinc-400">
            Donate to this pool →
          </Link>
          <a
            href={EXPLORER_BASE_URL.replace(/\/$/, "")}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-zinc-400"
          >
            Explorer ↗
          </a>
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
