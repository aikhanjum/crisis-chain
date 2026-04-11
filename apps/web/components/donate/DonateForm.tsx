"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { RegionalPoolABI, MOCK_REGIONAL_POOL_ADDRESS } from "@/lib/contracts/RegionalPoolABI";
import { Loader2, Fingerprint, ArrowRight, CheckCircle2 } from "lucide-react";

export function DonateForm() {
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState("");

  const { writeContract, data: hash, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const handleDonate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;
    
    writeContract({
      address: MOCK_REGIONAL_POOL_ADDRESS,
      abi: RegionalPoolABI,
      functionName: "donate",
      args: [parseUnits(amount, 6)],
    });
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-xl">
      <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Contribute to Pool</h3>
          <ConnectButton showBalance={false} />
        </div>

        {isConfirmed ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="rounded-full bg-emerald-500/20 p-3 text-emerald-400">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h4 className="mt-4 text-lg font-medium text-white">Donation Successful!</h4>
            <p className="mt-2 text-sm text-zinc-400">
              Your contribution has been securely locked in the regional smart contract.
            </p>
            {hash && (
              <a
                href={`https://sepolia.arbiscan.io/tx/${hash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-6 flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                View on Arbiscan <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={handleDonate} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-400">
                Amount (USDC)
              </label>
              <div className="mt-2 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <span className="text-zinc-500 text-lg">$</span>
                </div>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="50.00"
                  className="block w-full rounded-xl border border-zinc-800 bg-zinc-950/50 py-4 pl-10 pr-4 text-xl text-white placeholder-zinc-700 outline-none transition-all focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                  disabled={!isConnected || isPending || isConfirming}
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                  <span className="text-zinc-500 text-sm font-medium uppercase">USDC</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!isConnected || isPending || isConfirming || !amount}
              className="group relative flex w-full items-center justify-center overflow-hidden rounded-xl bg-emerald-500 px-8 py-4 font-semibold text-white transition-all hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {isPending || isConfirming ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {isPending ? "Confirm in Wallet..." : "Processing Tx..."}
                </>
              ) : isConnected ? (
                <>
                  Execute Smart Contract <Fingerprint className="ml-2 h-5 w-5 opacity-70 transition-opacity group-hover:opacity-100" />
                </>
              ) : (
                "Connect Wallet to Donate"
              )}
            </button>
            <p className="text-center text-xs text-zinc-500 mt-4 flex items-center justify-center gap-1">
               On-chain operations verified by CrisisChain protocol.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
