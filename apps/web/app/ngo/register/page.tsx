"use client";

import dynamic from "next/dynamic";

const NgoRegisterClient = dynamic(
  () => import("@/components/ngo/NgoRegisterClient"),
  { ssr: false },
);

export default function NgoRegisterPage() {
  return <NgoRegisterClient />;
}
