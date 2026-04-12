"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { CrisisRegion } from "@/lib/api";
import { formatUsdc, usePoolStats } from "@/hooks/usePoolData";
import { poolIdFromRegionId } from "@/lib/wallet-utils";

interface CrisisDrawerProps {
  region: CrisisRegion | null;
  onClose: () => void;
  onDonate?: (regionId: string) => void;
}

export function CrisisDrawer({ region, onClose, onDonate }: CrisisDrawerProps) {
  const poolId = region?.poolId ?? poolIdFromRegionId(region?.id ?? "");
  const { data: pool } = usePoolStats(poolId);

  if (!region) return null;

  return (
    <div className="crisis-panel-enter absolute right-4 top-[calc(theme(spacing.14)+theme(spacing.4))] z-[1000] w-80">
      {/* Glass panel */}
      <div
        className="relative overflow-hidden rounded-2xl border border-white/[0.07] backdrop-blur-xl"
        style={{
          background:
            "linear-gradient(155deg, rgba(13,13,19,0.93) 0%, rgba(9,9,14,0.91) 100%)",
          boxShadow:
            "0 12px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(59,130,246,0.07), inset 0 1px 0 rgba(255,255,255,0.045)",
        }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.35) 50%, transparent 100%)",
          }}
        />

        <div className="p-5">
          {/* ── Header ─────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-3 mb-[18px]">
            <div className="flex-1 min-w-0">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-400/55">
                {region.country}
              </p>
              <h2 className="text-[17px] font-semibold leading-snug tracking-tight text-white/95">
                {region.name}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-zinc-600 transition-all duration-150 hover:bg-white/[0.07] hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* ── Summary ────────────────────────────────────────── */}
          <p className="text-[13px] leading-[1.7] text-zinc-400/90">
            {region.summary}
          </p>

          {/* ── Pool stats ─────────────────────────────────────── */}
          {pool && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div
                className="rounded-xl p-3"
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <p className="mb-0.5 text-[9px] uppercase tracking-[0.16em] text-zinc-600">
                  Raised
                </p>
                <p className="text-sm font-semibold text-emerald-400">
                  ${formatUsdc(pool.total_donated_raw)}
                </p>
              </div>
              <div
                className="rounded-xl p-3"
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <p className="mb-0.5 text-[9px] uppercase tracking-[0.16em] text-zinc-600">
                  Disbursed
                </p>
                <p className="text-sm font-semibold text-blue-400">
                  ${formatUsdc(pool.total_paid_out_raw)}
                </p>
              </div>
            </div>
          )}

          {/* ── Action buttons ─────────────────────────────────── */}
          <div className="mt-4 flex gap-2">
            {onDonate ? (
              <button
                onClick={() => onDonate(region.id)}
                className="crisis-btn-donate flex-1 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white"
              >
                Donate
              </button>
            ) : (
              <Link href={`/donate/${region.id}`} className="flex-1">
                <button className="crisis-btn-donate w-full rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white">
                  Donate
                </button>
              </Link>
            )}
            <Link href={`/pool/${region.id}/ledger`}>
              <button className="crisis-btn-ledger rounded-xl px-4 py-2.5 text-[13px] font-medium text-zinc-500">
                Ledger
              </button>
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
