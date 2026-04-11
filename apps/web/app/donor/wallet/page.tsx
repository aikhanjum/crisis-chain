"use client";

import dynamic from "next/dynamic";

const AdvancedWalletPageClient = dynamic(
  () => import("@/components/wallet/AdvancedWalletPageClient"),
  { ssr: false },
);

export default function DonorWalletPage() {
  return <AdvancedWalletPageClient />;
}
