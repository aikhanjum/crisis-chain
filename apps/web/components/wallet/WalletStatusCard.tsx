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
}: WalletStatusCardProps) {
  return (
    <Card className="rounded-2xl border-zinc-800/90 bg-zinc-900/85 p-5">
      <CardHeader className="mb-4">
        <CardTitle className="text-base font-semibold">Wallet and Network Status</CardTitle>
      </CardHeader>

      <div className="grid grid-cols-1 gap-2 text-sm text-zinc-300 sm:grid-cols-2">
        <p>
          <span className="text-zinc-500">Wallet:</span> {isConnected ? shortenAddress(address) : "Not connected"}
        </p>
        <p>
          <span className="text-zinc-500">Chain:</span>{" "}
          {chainId ? `${chainId}${isWrongNetwork ? " (wrong network)" : " (ready)"}` : "Unknown"}
        </p>
        <p>
          <span className="text-zinc-500">USDC:</span> {shortenAddress(usdcAddress)}
        </p>
        <p>
          <span className="text-zinc-500">Vault:</span> {shortenAddress(vaultAddress)}
        </p>
      </div>

      {!isConfigured && (
        <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Missing `NEXT_PUBLIC_USDC_ADDRESS` or `NEXT_PUBLIC_VAULT_ADDRESS`.
        </p>
      )}

      {isWrongNetwork && (
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={() => onSwitchNetwork()} className="rounded-lg">
            Switch to Humanity Testnet
          </Button>
        </div>
      )}
    </Card>
  );
}
