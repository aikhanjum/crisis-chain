"use client";

import dynamic from "next/dynamic";

const WalletPageClient = dynamic(
  () => import("@/components/wallet-page-client"),
  { ssr: false },
);

export default function HomePage() {
  return <WalletPageClient />;
}
