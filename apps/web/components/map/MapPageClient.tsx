"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import type { CrisisRegion } from "@/lib/api";
import { API_GATEWAY_URL } from "@/lib/constants";
import { useCrisisRegions } from "@/hooks/useCrisisRegions";
import { Web3Provider } from "@/providers/Web3Provider";
import { CrisisMap } from "@/components/map/CrisisMap";
import { CrisisDrawer } from "@/components/map/CrisisDrawer";

function MapPageInner() {
  const queryClient = useQueryClient();
  const { data: regions, isLoading, error } = useCrisisRegions();
  const [selected, setSelected] = useState<CrisisRegion | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
        <div className="flex items-center gap-4">
          <Link href="/" className="font-bold text-white text-sm tracking-wide">
            CrisisChain
          </Link>
          <span className="text-[11px] text-stone-500 uppercase tracking-widest">Global Crisis Monitor</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-md border border-stone-700 bg-stone-900/60 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 hover:text-stone-100 transition-colors disabled:opacity-50"
            title="Pull latest crisis data from ACLED + HDX"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh Data"}
          </button>
          <Link
            href="/ngo/dashboard"
            className="text-xs text-stone-400 hover:text-stone-100 transition-colors"
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
                      className="rounded-md border border-stone-700 bg-stone-900/60 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 hover:text-stone-100 transition-colors"
                    >
                      Connect Wallet
                    </button>
                  ) : chain.unsupported ? (
                    <button
                      onClick={openChainModal}
                      className="rounded-md border border-red-800 bg-red-950/60 px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-900/60 hover:text-red-300 transition-colors"
                    >
                      Wrong network
                    </button>
                  ) : (
                    <button
                      onClick={openAccountModal}
                      className="flex items-center gap-2 rounded-md border border-stone-700 bg-stone-900/60 px-3 py-1.5 text-[11px] text-stone-300 hover:bg-stone-800 hover:text-stone-100 transition-colors"
                    >
                      {chain.hasIcon && chain.iconUrl && (
                        <img src={chain.iconUrl} alt={chain.name} className="h-3 w-3 rounded-full" />
                      )}
                      <span className="font-mono">{account.displayName}</span>
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
        <CrisisDrawer region={selected} onClose={() => setSelected(null)} />
      </div>

      {/* Region count badge */}
      {regions && regions.length > 0 && (
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-lg border border-stone-800 bg-stone-900/80 px-3 py-2 backdrop-blur-sm">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[11px] text-stone-400">
            <span className="font-semibold text-stone-100">{regions.length}</span> active crisis regions
          </span>
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
