"use client";

import { DonorWalletPanel } from "@/components/wallet/DonorWalletPanel";

export default function AdvancedWalletPageClient() {
  return (
    <DonorWalletPanel
      title="Advanced Donor Wallet Console"
      subtitle="Run full approve, donate, and payout flows with manual pool controls, explorer-linked transactions, and live indexed analytics."
      poolIdEditable
    />
  );
}
