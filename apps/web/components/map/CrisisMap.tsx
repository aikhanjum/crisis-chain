"use client";

/**
 * CrisisMap — Leaflet-based interactive world map.
 * Each crisis region is a CircleMarker colored by severity score.
 *
 * TODO: Replace placeholder data with useCrisisRegions() once API is live.
 */

import dynamic from "next/dynamic";
import { useState } from "react";
import { SEVERITY_COLORS } from "@/lib/constants";
import type { CrisisRegion } from "@/lib/api";

// Leaflet must be dynamically imported (no SSR)
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((m) => m.CircleMarker),
  { ssr: false },
);

function severityColor(score: number): string {
  if (score >= 80) return SEVERITY_COLORS.critical;
  if (score >= 60) return SEVERITY_COLORS.high;
  if (score >= 40) return SEVERITY_COLORS.medium;
  return SEVERITY_COLORS.low;
}

interface CrisisMapProps {
  regions: CrisisRegion[];
  onSelectRegion: (region: CrisisRegion) => void;
}

export function CrisisMap({ regions, onSelectRegion }: CrisisMapProps) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      className="h-full w-full rounded-xl"
      style={{ background: "#0f172a" }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />
      {regions.map((region) => (
        <CircleMarker
          key={region.id}
          center={[region.lat, region.lng]}
          radius={8 + region.severityScore / 10}
          pathOptions={{
            color: severityColor(region.severityScore),
            fillColor: severityColor(region.severityScore),
            fillOpacity: 0.75,
            weight: 1.5,
          }}
          eventHandlers={{ click: () => onSelectRegion(region) }}
        />
      ))}
    </MapContainer>
  );
}
