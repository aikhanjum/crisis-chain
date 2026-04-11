"use client";

import { useCallback, useEffect, useState } from "react";

import { getPoolStats, PoolStats } from "@/lib/api";

export function usePoolAnalytics(poolId: string) {
  const [data, setData] = useState<PoolStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stats = await getPoolStats(poolId);
      setData(stats);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Failed to fetch pool analytics");
    } finally {
      setLoading(false);
    }
  }, [poolId]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  return { data, loading, error, refresh };
}
