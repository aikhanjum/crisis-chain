import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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

const Spinner = () => (
  <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
);

export function WalletTransactionCard({
  poolId, amount, memo, recipient, payoutRef, error,
  isConnected, isConfigured, isWorking, poolIdEditable,
  onPoolIdChange, onAmountChange, onMemoChange, onRecipientChange, onPayoutRefChange,
  onApprove, onDonate, onPayout,
  compact,
}: WalletTransactionCardProps) {
  const disabled = !isConnected || !isConfigured || isWorking;
  // When poolIdEditable=false we're in donor mode — hide payout controls
  const showPayout = poolIdEditable;

  if (compact) {
    const inputCls = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 text-xs text-zinc-100";
    return (
      <Card className="rounded-2xl border-zinc-800/90 bg-zinc-900/85 p-3">
        <CardHeader className="mb-1">
          <CardTitle className="text-xs font-semibold">Transaction Controls</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-xs"><span className="mb-0.5 block text-zinc-500">Pool ID</span>
            <input className={`${inputCls} disabled:opacity-80`} value={poolId} disabled={!poolIdEditable} onChange={(e) => onPoolIdChange(e.target.value)} />
          </label>
          <label className="text-xs"><span className="mb-0.5 block text-zinc-500">Amount (mUSDC)</span>
            <input className={inputCls} value={amount} onChange={(e) => onAmountChange(e.target.value)} />
          </label>
          <label className="text-xs sm:col-span-2"><span className="mb-0.5 block text-zinc-500">Memo</span>
            <input className={inputCls} value={memo} onChange={(e) => onMemoChange(e.target.value)} />
          </label>
          {showPayout && <>
            <label className="text-xs sm:col-span-2"><span className="mb-0.5 block text-zinc-500">Recipient</span>
              <input className={inputCls} value={recipient} onChange={(e) => onRecipientChange(e.target.value)} />
            </label>
            <label className="text-xs sm:col-span-2"><span className="mb-0.5 block text-zinc-500">Payout ref</span>
              <input className={inputCls} value={payoutRef} onChange={(e) => onPayoutRefChange(e.target.value)} />
            </label>
          </>}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" loading={isWorking} disabled={disabled} onClick={() => onApprove()}>Approve</Button>
          <Button size="sm" loading={isWorking} disabled={disabled} onClick={() => onDonate()}>Donate</Button>
          {showPayout && <Button variant="danger" size="sm" loading={isWorking} disabled={disabled} onClick={() => onPayout()}>Payout</Button>}
        </div>
        {error && <p className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
      </Card>
    );
  }

  const inputCls = "w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-700 transition-colors focus:border-zinc-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40";
  const labelCls = "block text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5";

  const btnBase = "inline-flex items-center justify-center gap-2 rounded-full border-[3px] border-black/75 px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="border-b border-zinc-800/60 px-5 py-3.5">
        <p className="text-[10px] uppercase tracking-widest text-zinc-600">Transaction Controls</p>
      </div>

      <div className="px-5 py-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label>
            <span className={labelCls}>Pool ID</span>
            <input className={inputCls} value={poolId} disabled={!poolIdEditable} onChange={(e) => onPoolIdChange(e.target.value)} />
          </label>

          <label>
            <span className={labelCls}>Amount (mUSDC)</span>
            <input className={inputCls} value={amount} onChange={(e) => onAmountChange(e.target.value)} placeholder="5" />
          </label>

          <label className="sm:col-span-2">
            <span className={labelCls}>Donation memo</span>
            <input className={inputCls} value={memo} onChange={(e) => onMemoChange(e.target.value)} />
          </label>

          {showPayout && (
            <>
              <label className="sm:col-span-2">
                <span className={labelCls}>Payout recipient</span>
                <input className={inputCls} value={recipient} onChange={(e) => onRecipientChange(e.target.value)} placeholder="0x…" />
              </label>
              <label className="sm:col-span-2">
                <span className={labelCls}>Payout reference</span>
                <input className={inputCls} value={payoutRef} onChange={(e) => onPayoutRefChange(e.target.value)} />
              </label>
            </>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <button onClick={onApprove} disabled={disabled} className={`${btnBase} bg-zinc-700 text-white hover:bg-zinc-600`}>
            {isWorking && <Spinner />}
            Approve
          </button>
          <button onClick={onDonate} disabled={disabled} className={`${btnBase} bg-zinc-600 text-white hover:bg-zinc-500`}>
            {isWorking && <Spinner />}
            Donate
          </button>
          {showPayout && (
            <button onClick={onPayout} disabled={disabled} className={`${btnBase} bg-red-900 text-red-200 hover:bg-red-800`}>
              {isWorking && <Spinner />}
              Payout
            </button>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/[0.07] px-4 py-2.5 text-sm text-rose-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
