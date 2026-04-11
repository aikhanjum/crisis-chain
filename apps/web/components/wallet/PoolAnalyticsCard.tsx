import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { PoolStats } from "@/lib/api";
import { formatUsdc } from "@/hooks/usePoolData";

type PoolAnalyticsCardProps = {
  poolId: string;
  loading: boolean;
  error: string | null;
  data: PoolStats | null;
  onRefresh: () => Promise<void>;
  compact?: boolean;
};

export function PoolAnalyticsCard({ poolId, loading, error, data, onRefresh, compact }: PoolAnalyticsCardProps) {
  if (compact) {
    return (
      <Card className="rounded-2xl border-zinc-800/90 bg-zinc-900/85 p-3">
        <CardHeader className="mb-1">
          <CardTitle className="text-xs font-semibold">Pool Analytics</CardTitle>
          <Button variant="secondary" size="sm" onClick={() => onRefresh()} loading={loading}>Refresh</Button>
        </CardHeader>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Pool {poolId}</p>
        {error && <p className="text-xs text-rose-300">{error}</p>}
        {!error && data ? (
          <div className="space-y-0.5 text-xs text-zinc-300">
            <p><span className="text-zinc-500">Raised:</span> {formatUsdc(data.total_donated_raw)} USDC</p>
            <p><span className="text-zinc-500">Paid out:</span> {formatUsdc(data.total_paid_out_raw)} USDC</p>
            <p className="text-cyan-300">Net: {formatUsdc(data.net_raw)} USDC</p>
          </div>
        ) : !error ? <p className="text-xs text-zinc-500">No indexed data yet.</p> : null}
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-5 py-3.5">
        <p className="text-[10px] uppercase tracking-widest text-zinc-600">Pool Analytics</p>
        <button
          onClick={() => onRefresh()}
          disabled={loading}
          className="text-[10px] font-medium text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-40"
        >
          {loading ? "Syncing…" : "Sync"}
        </button>
      </div>

      {error ? (
        <div className="px-5 py-4">
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/[0.07] px-4 py-2.5 text-sm text-rose-300">{error}</p>
        </div>
      ) : !data ? (
        <div className="px-5 py-6 text-center">
          {loading
            ? <div className="flex flex-col items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" /><p className="text-xs text-zinc-600">Loading…</p></div>
            : <p className="text-xs text-zinc-600">No indexed data yet.</p>
          }
        </div>
      ) : (
        <div className="grid grid-cols-1 divide-y divide-zinc-800/60">
          {[
            { label: "Total Raised",   value: formatUsdc(data.total_donated_raw),  color: "text-emerald-400" },
            { label: "Disbursed",      value: formatUsdc(data.total_paid_out_raw), color: "text-sky-400"     },
            { label: "Net Balance",    value: formatUsdc(data.net_raw),             color: "text-zinc-100"   },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between px-5 py-4">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">{label}</p>
              <div className="text-right">
                <span className={`tabular-nums text-base font-semibold ${color}`}>{value}</span>
                <span className="ml-1.5 text-[10px] text-zinc-700">USDC</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-zinc-800/60 px-5 py-3">
        <p className="font-mono text-[10px] text-zinc-700">Pool {poolId}</p>
      </div>
    </div>
  );
}
