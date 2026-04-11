import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { explorerTxUrl } from "@/lib/humanity";
import { TxRecord } from "@/lib/wallet-contracts";

const ACTION_LABEL: Record<TxRecord["action"], string> = {
  approve: "Approve",
  donate: "Donate",
  payout: "Payout",
};

type TxHistoryCardProps = {
  txHistory: TxRecord[];
  compact?: boolean;
};

export function TxHistoryCard({ txHistory, compact }: TxHistoryCardProps) {
  return (
    <Card className={`rounded-2xl border-zinc-800/90 bg-zinc-900/85 ${compact ? "p-3" : "p-5"}`}>
      <CardHeader className={compact ? "mb-1" : undefined}>
        <CardTitle className={compact ? "text-xs font-semibold" : "text-base font-semibold"}>Tx History</CardTitle>
      </CardHeader>

      {txHistory.length === 0 ? (
        <p className={`text-zinc-500 ${compact ? "text-xs" : "text-sm"}`}>No transactions yet.</p>
      ) : (
        <ul className={compact ? "space-y-1.5" : "space-y-3"}>
          {txHistory.map((tx) => (
            <li key={tx.hash} className={`rounded-xl border border-zinc-800 bg-zinc-950/60 text-sm ${compact ? "p-2" : "p-3"}`}>
              <p className={`font-medium text-zinc-100 ${compact ? "text-xs" : ""}`}>
                {ACTION_LABEL[tx.action]}{" "}
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">({tx.status})</span>
              </p>
              <a
                href={explorerTxUrl(tx.hash)}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 block break-all text-[10px] text-cyan-300 hover:underline"
              >
                {tx.hash}
              </a>
              <p className="mt-0.5 text-[10px] text-zinc-500">{new Date(tx.at).toLocaleString()}</p>
              {tx.error ? <p className="mt-0.5 text-[10px] text-rose-300">{tx.error}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
