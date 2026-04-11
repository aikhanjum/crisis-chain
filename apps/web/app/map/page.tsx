"use client";

import dynamic from "next/dynamic";

const MapPageClient = dynamic(() => import("@/components/map/MapPageClient"), {
  ssr: false,
});

export default function MapPage() {
  return <MapPageClient />;
}
