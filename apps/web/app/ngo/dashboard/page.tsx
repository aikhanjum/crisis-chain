"use client";

import dynamic from "next/dynamic";

const NgoDashboardClient = dynamic(
  () => import("@/components/wallet/NgoDashboardClient").then((m) => m.NgoDashboardClient),
  { ssr: false },
);

export default function NgoDashboardPage() {
  return <NgoDashboardClient />;
}
