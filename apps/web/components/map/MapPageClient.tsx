"use client";

import Link from "next/link";
import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import type { CrisisRegion } from "@/lib/api";
import { useCrisisRegions } from "@/hooks/useCrisisRegions";
import { Web3Provider } from "@/providers/Web3Provider";
import { CrisisMap } from "@/components/map/CrisisMap";
import { CrisisDrawer } from "@/components/map/CrisisDrawer";

function MapPageInner() {
  const { data: regions, isLoading, error } = useCrisisRegions();
  const [selected, setSelected] = useState<CrisisRegion | null>(null);

  return (
    <div className="relative flex h-screen w-full flex-col bg-zinc-950">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-bold text-white">
            CrisisChain
          </Link>
          <span className="text-xs text-zinc-500">Crisis Heatmap</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/ngo/dashboard"
            className="text-xs text-zinc-400 hover:text-white transition-colors"
          >
            NGO Portal
          </Link>
          <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
        </div>
      </header>

      <div className="relative flex-1">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/80">
            <p className="text-sm text-zinc-400">Loading crisis regions…</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/80">
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
