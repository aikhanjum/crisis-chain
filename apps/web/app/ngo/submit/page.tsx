"use client";

import dynamic from "next/dynamic";

const NgoSubmitClient = dynamic(
  () => import("@/components/ngo/NgoSubmitClient"),
  { ssr: false },
);

export default function NgoSubmitPage() {
  return <NgoSubmitClient />;
}
