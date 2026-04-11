import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { shortenAddress } from "@/lib/wallet-utils";

type WalletStatusCardProps = {
  address?: `0x${string}`;
  chainId?: number;
  isConnected: boolean;
  isWrongNetwork: boolean;
  isConfigured: boolean;
  usdcAddress?: `0x${string}`;
  vaultAddress?: `0x${string}`;
  onSwitchNetwork: () => Promise<unknown>;
  compact?: boolean;
};

export function WalletStatusCard({
  address,
  chainId,
  isConnected,
  isWrongNetwork,
  isConfigured,
  usdcAddress,
  vaultAddress,
  onSwitchNetwork,
  compact,
}: WalletStatusCardProps) {
  if (compact) {
    return (
      <Card className="rounded-2xl border-zinc-800/90 bg-zinc-900/85 p-3">
        <CardHeader className="mb-1">
          <CardTitle className="text-xs font-semibold">Wallet & Network</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-1 text-xs text-zinc-300 sm:grid-cols-2">
          <p><span className="text-zinc-500">Wallet:</span> {isConnected ? shortenAddress(address) : "Not connected"}</p>
          <p><span className="text-zinc-500">Chain:</span> {chainId ? `${chainId}${isWrongNetwork ? " ⚠" : " ✓"}` : "—"}</p>
        </div>
        {isWrongNetwork && (
          <Button size="sm" onClick={() => onSwitchNetwork()} className="mt-2 w-full rounded-lg text-xs">
            Switch to Humanity Testnet
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-5 py-3.5">
        <p className="text-[10px] uppercase tracking-widest text-zinc-600">Wallet & Network</p>
        <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest ${
          isWrongNetwork
            ? "border border-amber-500/20 bg-amber-500/[0.07] text-amber-400"
            : isConnected
            ? "border border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400"
            : "border border-zinc-700/40 bg-zinc-800/40 text-zinc-500"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${
            isWrongNetwork ? "bg-amber-400" : isConnected ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
          }`} />
          {isWrongNetwork ? "Wrong Network" : isConnected ? "Connected" : "Disconnected"}
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-zinc-800/60">
        {[
          { label: "Wallet",  value: isConnected ? shortenAddress(address) : "Not connected" },
          { label: "Chain",   value: chainId ? String(chainId) : "—" },
          { label: "USDC",    value: shortenAddress(usdcAddress) },
          { label: "Vault",   value: shortenAddress(vaultAddress) },
        ].map(({ label, value }, i) => (
          <div key={label} className={`px-5 py-3.5 ${i >= 2 ? "border-t border-zinc-800/60" : ""}`}>
            <p className="text-[10px] uppercase tracking-widest text-zinc-600">{label}</p>
            <p className="mt-1 font-mono text-xs text-zinc-300">{value}</p>
          </div>
        ))}
      </div>

      {!isConfigured && (
        <div className="border-t border-zinc-800/60 px-5 py-3">
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-400/90">
            Missing <code className="font-mono">NEXT_PUBLIC_USDC_ADDRESS</code> or <code className="font-mono">NEXT_PUBLIC_VAULT_ADDRESS</code>.
          </p>
        </div>
      )}

      {isWrongNetwork && (
        <div className="border-t border-zinc-800/60 px-5 py-3.5 flex justify-end">
          <Button size="sm" onClick={() => onSwitchNetwork()} className="rounded-lg">
            Switch to Humanity Testnet
          </Button>
        </div>
      )}
    </div>
  );
}
