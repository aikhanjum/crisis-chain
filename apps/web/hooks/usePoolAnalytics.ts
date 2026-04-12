"use client";

import { useCallback, useEffect, useState } from "react";

import { getPoolLedger, PoolStats } from "@/lib/api";

export function usePoolAnalytics(poolId: string) {
  const [data, setData] = useState<PoolStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ledger = await getPoolLedger(poolId);
      setData({
        pool_id: ledger.poolId,
        total_donated_raw: ledger.totalDonatedRaw,
        total_paid_out_raw: ledger.totalPaidOutRaw,
        net_raw: ledger.netRaw,
      });
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Failed to fetch pool analytics");
    } finally {
      setLoading(false);
    }
  }, [poolId]);

  const applySnapshot = useCallback((stats: PoolStats) => {
    setData(stats);
    setError(null);
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  return { data, loading, error, refresh, applySnapshot };
}
