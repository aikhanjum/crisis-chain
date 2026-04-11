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
};

export function TxHistoryCard({ txHistory }: TxHistoryCardProps) {
  return (
    <Card className="rounded-2xl border-zinc-800/90 bg-zinc-900/85 p-5">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Session Transaction History</CardTitle>
      </CardHeader>

      {txHistory.length === 0 ? (
        <p className="text-sm text-zinc-500">No transactions in this session yet.</p>
      ) : (
        <ul className="space-y-3">
          {txHistory.map((tx) => (
            <li key={tx.hash} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm">
              <p className="font-medium text-zinc-100">
                {ACTION_LABEL[tx.action]}{" "}
                <span className="text-xs uppercase tracking-wider text-zinc-500">({tx.status})</span>
              </p>
              <a
                href={explorerTxUrl(tx.hash)}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all text-xs text-cyan-300 hover:underline"
              >
                {tx.hash}
              </a>
              <p className="mt-1 text-xs text-zinc-500">{new Date(tx.at).toLocaleString()}</p>
              {tx.error ? <p className="mt-1 text-xs text-rose-300">{tx.error}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
