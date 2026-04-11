import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { explorerTxUrl } from "@/lib/humanity";
import { TxRecord } from "@/lib/wallet-contracts";

const ACTION_LABEL: Record<TxRecord["action"], string> = {
  approve: "Approve",
  donate:  "Donate",
  payout:  "Payout",
};

const STATUS_STYLE: Record<TxRecord["status"], string> = {
  pending:   "border-amber-500/20 bg-amber-500/[0.07] text-amber-400",
  confirmed: "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400",
  failed:    "border-rose-500/20 bg-rose-500/[0.07] text-rose-400",
};

function shorten(hash: string, head = 6, tail = 4) {
  if (!hash || hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

type TxHistoryCardProps = {
  txHistory: TxRecord[];
  compact?: boolean;
};

export function TxHistoryCard({ txHistory, compact }: TxHistoryCardProps) {
  if (compact) {
    return (
      <Card className="rounded-2xl border-zinc-800/90 bg-zinc-900/85 p-3">
        <CardHeader className="mb-1">
          <CardTitle className="text-xs font-semibold">Tx History</CardTitle>
        </CardHeader>
        {txHistory.length === 0 ? (
          <p className="text-xs text-zinc-500">No transactions yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {txHistory.map((tx) => (
              <li key={tx.hash} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-zinc-100">{ACTION_LABEL[tx.action]}</p>
                  <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${STATUS_STYLE[tx.status]}`}>{tx.status}</span>
                </div>
                <a href={explorerTxUrl(tx.hash)} target="_blank" rel="noreferrer" className="mt-0.5 block font-mono text-[10px] text-zinc-500 hover:text-zinc-300">
                  {shorten(tx.hash)}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="border-b border-zinc-800/60 px-5 py-3.5">
        <p className="text-[10px] uppercase tracking-widest text-zinc-600">Transaction History</p>
      </div>

      {txHistory.length === 0 ? (
        <p className="px-5 py-8 text-center text-xs text-zinc-600">No transactions yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-800/40">
          {txHistory.map((tx) => (
            <li key={tx.hash} className="flex items-center gap-4 px-5 py-4">
              {/* Action + status */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200">{ACTION_LABEL[tx.action]}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider ${STATUS_STYLE[tx.status]}`}>
                    {tx.status}
                  </span>
                </div>
                <a
                  href={explorerTxUrl(tx.hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex items-center gap-1 font-mono text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
                  title={tx.hash}
                >
                  {shorten(tx.hash)}
                  <span className="text-zinc-700">↗</span>
                </a>
                {tx.error && <p className="mt-0.5 text-[10px] text-rose-400">{tx.error}</p>}
              </div>

              {/* Timestamp */}
              <p className="shrink-0 text-[10px] text-zinc-600">
                {new Date(tx.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
