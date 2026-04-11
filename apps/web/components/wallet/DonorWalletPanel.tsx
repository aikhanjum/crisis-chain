"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useMemo, useEffect, useState } from "react";
import { parseUnits } from "viem";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";

import { PoolAnalyticsCard } from "@/components/wallet/PoolAnalyticsCard";
import { TxHistoryCard } from "@/components/wallet/TxHistoryCard";
import { WalletStatusCard } from "@/components/wallet/WalletStatusCard";
import { WalletTransactionCard } from "@/components/wallet/WalletTransactionCard";
import { Button } from "@/components/ui/Button";
import { Web3Provider } from "@/providers/Web3Provider";
import { CHAIN_ID, USDC_ADDRESS, USDC_DECIMALS, VAULT_ADDRESS } from "@/lib/constants";
import { humanityTestnet } from "@/lib/humanity";
import { erc20Abi, toBytes32, TxAction, vaultAbi } from "@/lib/wallet-contracts";
import { poolIdFromRegionId } from "@/lib/wallet-utils";
import { usePoolAnalytics } from "@/hooks/usePoolAnalytics";
import { useTxHistory } from "@/hooks/useTxHistory";
import { useCrisisRegion } from "@/hooks/useCrisisRegions";

type DonorWalletPanelProps = {
  title: string;
  subtitle: string;
  regionId?: string;
  poolIdEditable?: boolean;
};

function DonorWalletPanelInner({
  title,
  subtitle,
  regionId,
  poolIdEditable = true,
}: DonorWalletPanelProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { history, pushPending, markResult } = useTxHistory();

  const [poolId, setPoolId] = useState(regionId ? poolIdFromRegionId(regionId) : "88");
  const [amount, setAmount] = useState("5");
  const [memo, setMemo] = useState("donation");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: regionData } = useCrisisRegion(regionId ?? "");
  const { data: poolStats, loading, error: poolError, refresh } = usePoolAnalytics(poolId);

  const isConfigured = Boolean(USDC_ADDRESS && VAULT_ADDRESS);
  const isWrongNetwork = isConnected && chainId !== CHAIN_ID;
  const parsedAmount = useMemo(() => {
    try {
      return parseUnits(amount || "0", USDC_DECIMALS);
    } catch {
      return 0n;
    }
  }, [amount]);

  useEffect(() => {
    if (regionId) {
      const mapped = regionData?.poolId ?? poolIdFromRegionId(regionId);
      setPoolId(mapped);
      setMemo(`donation-${mapped}`);
    }
  }, [regionId, regionData]);

  async function ensureNetwork() {
    if (!isConnected) throw new Error("Connect wallet first.");
    if (isWrongNetwork) {
      await switchChainAsync({ chainId: humanityTestnet.id });
    }
  }

  async function sendTx(action: TxAction, request: Parameters<typeof writeContractAsync>[0]) {
    if (!publicClient) throw new Error("Public chain client not ready");

    const hash = await writeContractAsync(request);
    pushPending(action, hash);

    try {
      await publicClient.waitForTransactionReceipt({ hash });
      markResult(hash, "confirmed");
      return hash;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      markResult(hash, "failed", message);
      throw err;
    }
  }

  async function onApprove() {
    setError(null);
    setIsWorking(true);
    try {
      if (!USDC_ADDRESS || !VAULT_ADDRESS) throw new Error("Contract addresses are missing.");
      if (parsedAmount <= 0n) throw new Error("Enter a valid amount.");
      await ensureNetwork();
      await sendTx("approve", {
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [VAULT_ADDRESS, parsedAmount],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed.");
    } finally {
      setIsWorking(false);
    }
  }

  async function onDonate() {
    setError(null);
    setIsWorking(true);
    try {
      if (!VAULT_ADDRESS) throw new Error("Vault address is missing.");
      if (parsedAmount <= 0n) throw new Error("Enter a valid amount.");
      await ensureNetwork();
      await sendTx("donate", {
        address: VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: "donate",
        args: [BigInt(poolId), parsedAmount, toBytes32(memo)],
      });
      await new Promise((r) => setTimeout(r, 4000));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Donate failed.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/85 p-6 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-zinc-500">Donor Wallet</p>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">{subtitle}</p>
              {regionId ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Region <span className="text-zinc-300">{regionId}</span> maps to Pool{" "}
                  <span className="text-zinc-300">{poolId}</span>.
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
              <Button variant="ghost" size="sm" onClick={() => refresh()}>
                Sync pool
              </Button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <WalletStatusCard
              address={address}
              chainId={chainId}
              isConnected={isConnected}
              isWrongNetwork={isWrongNetwork}
              isConfigured={isConfigured}
              usdcAddress={USDC_ADDRESS}
              vaultAddress={VAULT_ADDRESS}
              onSwitchNetwork={() => switchChainAsync({ chainId: humanityTestnet.id })}
            />

            <WalletTransactionCard
              poolId={poolId}
              amount={amount}
              memo={memo}
              error={error}
              isConnected={isConnected}
              isConfigured={isConfigured}
              isWorking={isWorking}
              poolIdEditable={poolIdEditable}
              onPoolIdChange={setPoolId}
              onAmountChange={setAmount}
              onMemoChange={setMemo}
              onApprove={onApprove}
              onDonate={onDonate}
            />
          </div>

          <div className="space-y-6">
            <PoolAnalyticsCard
              poolId={poolId}
              loading={loading}
              error={poolError}
              data={poolStats}
              onRefresh={refresh}
            />
            <TxHistoryCard txHistory={history} />
          </div>
        </section>
      </main>
    </div>
  );
}

export function DonorWalletPanel(props: DonorWalletPanelProps) {
  return (
    <Web3Provider>
      <DonorWalletPanelInner {...props} />
    </Web3Provider>
  );
}
