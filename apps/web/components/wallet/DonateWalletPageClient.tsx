"use client";

import { useParams } from "next/navigation";

import { DonorWalletPanel } from "@/components/wallet/DonorWalletPanel";

export default function DonateWalletPageClient() {
  const params = useParams<{ regionId: string }>();
  const regionId = params?.regionId ?? "88";

  return (
    <DonorWalletPanel
      title="Donate to a Crisis Pool"
      subtitle="Use your wallet to approve mUSDC, donate into the regional pool, and track transparent payout activity."
      regionId={regionId}
      poolIdEditable={false}
    />
  );
}
