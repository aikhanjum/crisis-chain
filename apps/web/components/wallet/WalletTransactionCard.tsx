import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

type WalletTransactionCardProps = {
  poolId: string;
  amount: string;
  memo: string;
  error: string | null;
  isConnected: boolean;
  isConfigured: boolean;
  isWorking: boolean;
  poolIdEditable: boolean;
  onPoolIdChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onMemoChange: (value: string) => void;
  onApprove: () => Promise<void>;
  onDonate: () => Promise<void>;
};

export function WalletTransactionCard({
  poolId,
  amount,
  memo,
  error,
  isConnected,
  isConfigured,
  isWorking,
  poolIdEditable,
  onPoolIdChange,
  onAmountChange,
  onMemoChange,
  onApprove,
  onDonate,
}: WalletTransactionCardProps) {
  const disabled = !isConnected || !isConfigured || isWorking;

  return (
    <Card className="rounded-2xl border-zinc-800/90 bg-zinc-900/85 p-5">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Donate</CardTitle>
      </CardHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Pool ID</span>
          <input
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 disabled:cursor-not-allowed disabled:opacity-80"
            value={poolId}
            disabled={!poolIdEditable}
            onChange={(e) => onPoolIdChange(e.target.value)}
          />
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Amount (mUSDC)</span>
          <input
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
          />
        </label>

        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-500">Donation memo</span>
          <input
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            value={memo}
            onChange={(e) => onMemoChange(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="secondary" loading={isWorking} disabled={disabled} onClick={() => onApprove()}>
          1. Approve
        </Button>
        <Button loading={isWorking} disabled={disabled} onClick={() => onDonate()}>
          2. Donate
        </Button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
