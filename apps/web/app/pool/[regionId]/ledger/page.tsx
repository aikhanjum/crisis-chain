"use client";

import dynamic from "next/dynamic";

const LedgerClient = dynamic(
  () => import("@/components/pool/LedgerClient"),
  { ssr: false },
);

export default function LedgerPage() {
  return <LedgerClient />;
}
