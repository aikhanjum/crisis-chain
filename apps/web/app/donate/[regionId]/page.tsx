"use client";

import dynamic from "next/dynamic";

const DonateWalletPageClient = dynamic(
  () => import("@/components/wallet/DonateWalletPageClient"),
  { ssr: false },
);

export default function DonatePage() {
  return <DonateWalletPageClient />;
}
