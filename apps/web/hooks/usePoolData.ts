"use client";

import { useQuery } from "@tanstack/react-query";
import { getPoolStats, getPoolLedger } from "@/lib/api";
import { USDC_DECIMALS } from "@/lib/constants";

export function usePoolStats(poolId: string) {
  return useQuery({
    queryKey: ["pool", poolId, "stats"],
    queryFn: () => getPoolStats(poolId),
    refetchInterval: 30_000, // poll every 30s
    enabled: !!poolId,
  });
}

export function usePoolLedger(regionId: string) {
  return useQuery({
    queryKey: ["pool", regionId, "ledger"],
    queryFn: () => getPoolLedger(regionId),
    enabled: !!regionId,
  });
}

/** Convert raw USDC integer (6 decimals) to human-readable string */
export function formatUsdc(raw: string | bigint): string {
  const n = typeof raw === "string" ? BigInt(raw) : raw;
  const whole = n / BigInt(10 ** USDC_DECIMALS);
  const frac = n % BigInt(10 ** USDC_DECIMALS);
  return `${whole.toLocaleString()}.${frac.toString().padStart(USDC_DECIMALS, "0").slice(0, 2)}`;
}
