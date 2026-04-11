import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

type WalletTransactionCardProps = {
  poolId: string;
  amount: string;
  memo: string;
  recipient: string;
  payoutRef: string;
  error: string | null;
  isConnected: boolean;
  isConfigured: boolean;
  isWorking: boolean;
  poolIdEditable: boolean;
  onPoolIdChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onMemoChange: (value: string) => void;
  onRecipientChange: (value: string) => void;
  onPayoutRefChange: (value: string) => void;
  onApprove: () => Promise<void>;
  onDonate: () => Promise<void>;
  onPayout: () => Promise<void>;
  compact?: boolean;
};

export function WalletTransactionCard({
  poolId,
  amount,
  memo,
  recipient,
  payoutRef,
  error,
  isConnected,
  isConfigured,
  isWorking,
  poolIdEditable,
  onPoolIdChange,
  onAmountChange,
  onMemoChange,
  onRecipientChange,
  onPayoutRefChange,
  onApprove,
  onDonate,
  onPayout,
  compact,
}: WalletTransactionCardProps) {
  const disabled = !isConnected || !isConfigured || isWorking;
  const inputCls = `w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-zinc-100 ${compact ? "py-1 text-xs" : "py-2"}`;
  const labelCls = compact ? "text-xs" : "text-sm";
  const spanCls = `block text-zinc-500 ${compact ? "mb-0.5" : "mb-1"}`;

  return (
    <Card className={`rounded-2xl border-zinc-800/90 bg-zinc-900/85 ${compact ? "p-3" : "p-5"}`}>
      <CardHeader className={compact ? "mb-1" : undefined}>
        <CardTitle className={compact ? "text-xs font-semibold" : "text-base font-semibold"}>Transaction Controls</CardTitle>
      </CardHeader>

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${compact ? "gap-2" : "gap-3"}`}>
        <label className={labelCls}>
          <span className={spanCls}>Pool ID</span>
          <input
            className={`${inputCls} disabled:cursor-not-allowed disabled:opacity-80`}
            value={poolId}
            disabled={!poolIdEditable}
            onChange={(e) => onPoolIdChange(e.target.value)}
          />
        </label>

        <label className={labelCls}>
          <span className={spanCls}>Amount (mUSDC)</span>
          <input
            className={inputCls}
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
          />
        </label>

        <label className={`${labelCls} sm:col-span-2`}>
          <span className={spanCls}>Donation memo</span>
          <input
            className={inputCls}
            value={memo}
            onChange={(e) => onMemoChange(e.target.value)}
          />
        </label>

        <label className={`${labelCls} sm:col-span-2`}>
          <span className={spanCls}>Payout recipient</span>
          <input
            className={inputCls}
            value={recipient}
            onChange={(e) => onRecipientChange(e.target.value)}
          />
        </label>

        <label className={`${labelCls} sm:col-span-2`}>
          <span className={spanCls}>Payout reference</span>
          <input
            className={inputCls}
            value={payoutRef}
            onChange={(e) => onPayoutRefChange(e.target.value)}
          />
        </label>
      </div>

      <div className={`flex flex-wrap gap-2 ${compact ? "mt-2" : "mt-4 gap-3"}`}>
        <Button variant="secondary" size={compact ? "sm" : undefined} loading={isWorking} disabled={disabled} onClick={() => onApprove()}>
          Approve
        </Button>
        <Button size={compact ? "sm" : undefined} loading={isWorking} disabled={disabled} onClick={() => onDonate()}>
          Donate
        </Button>
        <Button variant="danger" size={compact ? "sm" : undefined} loading={isWorking} disabled={disabled} onClick={() => onPayout()}>
          Payout
        </Button>
      </div>

      {error ? (
        <p className={`rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-300 ${compact ? "mt-2 text-xs" : "mt-3 text-sm"}`}>
          {error}
        </p>
      ) : null}
    </Card>
  );
}
