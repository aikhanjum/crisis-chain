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
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-full border-[3px] border-black/75 bg-zinc-700 px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.13)] transition-all duration-150 hover:bg-zinc-600 active:translate-y-px disabled:opacity-35 disabled:cursor-not-allowed"
            title="Pull latest crisis data from ACLED + HDX"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh Data"}
          </button>
          <Link
            href="/ngo/dashboard"
            className="rounded-full border-[3px] border-black/75 bg-zinc-700 px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.13)] transition-all duration-150 hover:bg-zinc-600 active:translate-y-px"
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
                      className="rounded-full border-[3px] border-black/75 bg-zinc-600 px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] transition-all duration-150 hover:bg-zinc-500 active:translate-y-px"
                    >
                      Connect Wallet
                    </button>
                  ) : chain.unsupported ? (
                    <button
                      onClick={openChainModal}
                      className="rounded-full border-[3px] border-black/75 bg-red-900 px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-red-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-150 hover:bg-red-800 active:translate-y-px"
                    >
                      Wrong Network
                    </button>
                  ) : (
                    <button
                      onClick={openAccountModal}
                      className="flex items-center gap-2 rounded-full border-[3px] border-black/75 bg-zinc-600 px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] transition-all duration-150 hover:bg-zinc-500 active:translate-y-px"
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

      {/* Region count badge */}
      {regions && regions.length > 0 && (
        <div className="absolute bottom-6 right-6 z-10 flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-zinc-900/60 px-5 py-4 backdrop-blur-xl shadow-[0_4px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex flex-col items-end gap-1">
            <span className="text-3xl font-extralight tabular-nums leading-none tracking-tight text-white/90">{regions.length}</span>
            <span className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">active crisis regions</span>
          </div>
          <div className="relative h-2.5 w-2.5 flex-shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/60" />
            <span className="relative flex h-2.5 w-2.5 rounded-full bg-amber-400" />
          </div>
        </div>
      )}

      {/* Donate modal overlay */}
      {donateRegionId && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl mx-4">
            <button
              onClick={() => setDonateRegionId(null)}
              className="absolute top-4 right-4 z-10 rounded-md p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
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
