import { formatUnits } from "viem";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { PoolStats } from "@/lib/api";
import { USDC_DECIMALS } from "@/lib/constants";

type PoolAnalyticsCardProps = {
  poolId: string;
  loading: boolean;
  error: string | null;
  data: PoolStats | null;
  onRefresh: () => Promise<void>;
  compact?: boolean;
};

export function PoolAnalyticsCard({
  poolId,
  loading,
  error,
  data,
  onRefresh,
  compact,
}: PoolAnalyticsCardProps) {
  return (
    <Card className={`rounded-2xl border-zinc-800/90 bg-zinc-900/85 ${compact ? "p-3" : "p-5"}`}>
      <CardHeader className={compact ? "mb-1" : undefined}>
        <CardTitle className={compact ? "text-xs font-semibold" : "text-base font-semibold"}>Pool Analytics</CardTitle>
        <Button variant="secondary" size="sm" onClick={() => onRefresh()} loading={loading}>
          Refresh
        </Button>
      </CardHeader>

      <p className={`uppercase tracking-wider text-zinc-500 ${compact ? "mb-1 text-[10px]" : "mb-3 text-xs"}`}>Pool {poolId}</p>

      {error ? (
        <p className={`rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-300 ${compact ? "text-xs" : "text-sm"}`}>
          {error}
        </p>
      ) : null}

      {!error && data ? (
        <div className={`text-zinc-300 ${compact ? "space-y-0.5 text-xs" : "space-y-2 text-sm"}`}>
          <p>
            <span className="text-zinc-500">Donated raw:</span> {data.total_donated_raw}
          </p>
          <p>
            <span className="text-zinc-500">Paid out raw:</span> {data.total_paid_out_raw}
          </p>
          <p>
            <span className="text-zinc-500">Net raw:</span> {data.net_raw}
          </p>
          <p className={`text-cyan-300 ${compact ? "" : "pt-2"}`}>
            Net: {formatUnits(BigInt(data.net_raw), USDC_DECIMALS)} mUSDC
          </p>
        </div>
      ) : null}

      {!error && !data ? <p className={`text-zinc-500 ${compact ? "text-xs" : "text-sm"}`}>No indexed data yet.</p> : null}
    </Card>
  );
}
