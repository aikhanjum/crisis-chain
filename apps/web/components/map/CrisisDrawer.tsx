"use client";

import Link from "next/link";
import { X, ExternalLink } from "lucide-react";
import type { CrisisRegion } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatUsdc, usePoolStats } from "@/hooks/usePoolData";
import { poolIdFromRegionId } from "@/lib/wallet-utils";

interface CrisisDrawerProps {
  region: CrisisRegion | null;
  onClose: () => void;
}

export function CrisisDrawer({ region, onClose }: CrisisDrawerProps) {
  const numericPoolId = region ? poolIdFromRegionId(region.id) : "";
  const { data: pool } = usePoolStats(numericPoolId);

  if (!region) return null;

  return (
    <div className="absolute right-4 top-4 z-[1000] w-80 flex flex-col gap-3">
      <Card className="border-stone-800 bg-stone-900">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{region.country}</p>
            <h2 className="text-lg font-bold text-stone-100">{region.name}</h2>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-stone-300">{region.summary}</p>

        {pool && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-stone-800 p-2">
              <p className="text-[10px] uppercase tracking-wide text-stone-500">Raised</p>
              <p className="text-sm font-semibold text-green-400">${formatUsdc(pool.total_donated_raw)}</p>
            </div>
            <div className="rounded-lg bg-stone-800 p-2">
              <p className="text-[10px] uppercase tracking-wide text-stone-500">Disbursed</p>
              <p className="text-sm font-semibold text-blue-400">${formatUsdc(pool.total_paid_out_raw)}</p>
            </div>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <Link href={`/donate/${region.id}`} className="flex-1">
            <Button className="w-full" size="sm">Donate</Button>
          </Link>
          <Link href={`/pool/${region.id}/ledger`}>
            <Button variant="secondary" size="sm">Ledger</Button>
          </Link>
        </div>

        {region.sourceLinks.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {region.sourceLinks.map((link) => (
              <a
                key={link}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-300"
              >
                <ExternalLink className="h-3 w-3" /> {new URL(link).hostname}
              </a>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
