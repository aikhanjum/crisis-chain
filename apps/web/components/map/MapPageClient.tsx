"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { RefreshCw, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import type { CrisisRegion } from "@/lib/api";
import { API_GATEWAY_URL } from "@/lib/constants";
import { useCrisisRegions } from "@/hooks/useCrisisRegions";
import { Web3Provider } from "@/providers/Web3Provider";
import { CrisisMap } from "@/components/map/CrisisMap";
import { CrisisDrawer } from "@/components/map/CrisisDrawer";
import { DonorWalletPanelInner } from "@/components/wallet/DonorWalletPanel";

function MapPageInner() {
  const queryClient = useQueryClient();
  const { data: regions, isLoading, error } = useCrisisRegions();
  const [selected, setSelected] = useState<CrisisRegion | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [donateRegionId, setDonateRegionId] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch(`${API_GATEWAY_URL}/regions/refresh`, { method: "POST" });
      await new Promise((r) => setTimeout(r, 3000));
      await queryClient.invalidateQueries({ queryKey: ["regions"] });
    } catch {
      /* gateway or crisis-intelligence not running */
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return (
    <div className="relative flex h-screen w-full flex-col" style={{ background: "#0c0a09" }}>
      <header className="absolute top-0 left-0 right-0 z-20 flex h-14 items-center justify-between px-5"
        style={{ background: "linear-gradient(to bottom, rgba(12,10,9,0.85) 0%, transparent 100%)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <img src="/favicon.svg" alt="CrisisChain" className="h-8 w-8" />
            <span className="font-bold text-white text-sm tracking-wide">CrisisChain</span>
          </Link>
          <span className="text-[11px] text-stone-500 uppercase tracking-widest">Global Crisis Monitor</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/ngo/dashboard"
            className="rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 backdrop-blur-sm transition-all duration-150 hover:bg-white/[0.10] hover:border-white/[0.14] hover:text-zinc-200 active:scale-[0.97]"
          >
            NGO Portal
          </Link>
          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
              const connected = mounted && account && chain;
              return (
                <div className={!mounted ? "opacity-0 pointer-events-none select-none" : ""}>
                  {!connected ? (
                    <button
                      onClick={openConnectModal}
                      className="rounded-xl border border-amber-400/25 bg-gradient-to-br from-amber-400/10 to-orange-500/8 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-amber-200/80 backdrop-blur-sm transition-all duration-150 hover:border-amber-400/40 hover:from-amber-400/18 hover:to-orange-500/14 hover:text-amber-100 active:scale-[0.97]"
                    >
                      Connect Wallet
                    </button>
                  ) : chain.unsupported ? (
                    <button
                      onClick={openChainModal}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-red-300/90 backdrop-blur-sm transition-all duration-150 hover:bg-red-500/18 hover:border-red-400/45 active:scale-[0.97]"
                    >
                      Wrong Network
                    </button>
                  ) : (
                    <button
                      onClick={openAccountModal}
                      className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-300 backdrop-blur-sm transition-all duration-150 hover:bg-white/[0.10] hover:border-white/[0.14] hover:text-white active:scale-[0.97]"
                    >
                      {chain.hasIcon && chain.iconUrl && (
                        <img src={chain.iconUrl} alt={chain.name} className="h-3 w-3 rounded-full" />
                      )}
                      <span>{account.displayName}</span>
                    </button>
                  )}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </header>

      <div className="relative flex-1">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-600 border-t-stone-100" />
              <p className="text-sm text-stone-400">Loading crisis regions…</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <p className="text-sm text-red-400">
              Could not load regions. Is the API gateway running on :4000?
            </p>
          </div>
        )}
        <CrisisMap
          regions={regions ?? []}
          onSelectRegion={(r) => setSelected(r)}
        />
        <CrisisDrawer
          region={selected}
          onClose={() => setSelected(null)}
          onDonate={(regionId) => { setDonateRegionId(regionId); setSelected(null); }}
        />
      </div>

      {/* Refresh Data button — bottom-left, contextually near the globe */}
      <div className="absolute bottom-6 left-6 z-10">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-zinc-900/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 backdrop-blur-xl transition-all duration-150 hover:bg-white/[0.08] hover:border-white/[0.14] hover:text-zinc-300 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_4px_32px_rgba(0,0,0,0.4)]"
          title="Pull latest crisis data from ACLED + HDX"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh Data"}
        </button>
      </div>

      {/* Region count badge */}
      {regions && regions.length > 0 && (() => {
        const avgScore = regions.reduce((sum, r) => sum + r.severityScore, 0) / regions.length;
        const t = Math.max(0, Math.min(1, avgScore / 100));
        // hue slides from 48° (yellow) → 0° (red) as severity rises
        const hue = Math.round(48 * (1 - t));
        const dotStyle = { backgroundColor: `hsl(${hue}, 90%, 58%)` };
        const pingStyle = { backgroundColor: `hsla(${hue}, 90%, 58%, 0.5)` };
        return (
          <div className="absolute bottom-6 right-6 z-10 flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-zinc-900/60 px-5 py-4 backdrop-blur-xl shadow-[0_4px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex flex-col items-end gap-1">
              <span className="text-3xl font-extralight tabular-nums leading-none tracking-tight text-white/90">{regions.length}</span>
              <span className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">active crisis regions</span>
            </div>
            <div className="relative h-2.5 w-2.5 flex-shrink-0">
              <span className="absolute inset-0 animate-ping rounded-full" style={pingStyle} />
              <span className="relative flex h-2.5 w-2.5 rounded-full" style={dotStyle} />
            </div>
          </div>
        );
      })()}

      {/* Donate modal overlay */}
      {donateRegionId && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800/80 bg-zinc-950 shadow-[0_24px_64px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.05)] mx-4">
            <button
              onClick={() => setDonateRegionId(null)}
              className="absolute top-4 right-4 z-10 rounded-lg p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
              aria-label="Close donate panel"
            >
              <X className="h-5 w-5" />
            </button>
            <DonorWalletPanelInner
              title="Donate to a Crisis Pool"
              subtitle="Use your wallet to approve mUSDC, donate into the regional pool, and track transparent payout activity."
              regionId={donateRegionId}
              poolIdEditable={false}
              modal
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function MapPageClient() {
  return (
    <Web3Provider>
      <MapPageInner />
    </Web3Provider>
  );
}
