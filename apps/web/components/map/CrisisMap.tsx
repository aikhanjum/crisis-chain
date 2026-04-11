"use client";

import { useRef, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import type { GlobeMethods } from "react-globe.gl";
import type { CrisisRegion } from "@/lib/api";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

const EARTH_NIGHT = "//unpkg.com/three-globe/example/img/earth-night.jpg";
const EARTH_TOPOLOGY = "//unpkg.com/three-globe/example/img/earth-topology.png";
const NIGHT_SKY = "//unpkg.com/three-globe/example/img/night-sky.png";

function severityColor(score: number): string {
  if (score >= 80) return "#ef4444";
  if (score >= 60) return "#f97316";
  if (score >= 40) return "#eab308";
  return "#22c55e";
}

type PointDatum = {
  _regionId: string;
  lat: number;
  lng: number;
  altitude: number;
  color: string;
  radius: number;
  name: string;
  country: string;
  severity: number;
};

type RingDatum = {
  lat: number;
  lng: number;
  maxR: number;
  propagationSpeed: number;
  repeatPeriod: number;
};

interface CrisisMapProps {
  regions: CrisisRegion[];
  onSelectRegion: (region: CrisisRegion) => void;
}

export function CrisisMap({ regions, onSelectRegion }: CrisisMapProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.pointOfView({ lat: 20, lng: 15, altitude: 2.5 });
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
  }, []);

  const pointsData = useMemo<PointDatum[]>(
    () =>
      regions.map((r) => ({
        _regionId: r.id,
        lat: r.lat,
        lng: r.lng,
        altitude: 0.01 + (r.severityScore / 100) * 0.15,
        color: severityColor(r.severityScore),
        radius: 0.35 + (r.severityScore / 100) * 0.4,
        name: r.name,
        country: r.country,
        severity: r.severityScore,
      })),
    [regions],
  );

  const ringsData = useMemo<RingDatum[]>(
    () =>
      regions
        .filter((r) => r.severityScore >= 60)
        .map((r) => ({
          lat: r.lat,
          lng: r.lng,
          maxR: 2 + (r.severityScore / 100) * 4,
          propagationSpeed: 2,
          repeatPeriod: 1200,
        })),
    [regions],
  );

  const handlePointClick = useCallback(
    (point: object) => {
      const p = point as PointDatum;
      const region = regions.find((r) => r.id === p._regionId);
      if (!region) return;
      const globe = globeRef.current;
      if (globe) {
        globe.controls().autoRotate = false;
        globe.pointOfView({ lat: region.lat, lng: region.lng, altitude: 1.8 }, 800);
      }
      onSelectRegion(region);
    },
    [regions, onSelectRegion],
  );

  const pointLabel = useCallback((d: object) => {
    const p = d as PointDatum;
    return `
      <div style="background:rgba(0,0,0,0.88);padding:8px 12px;border-radius:6px;font-size:13px;color:#fff;max-width:220px;line-height:1.4;border:1px solid rgba(255,255,255,0.12)">
        <div style="font-weight:600;margin-bottom:2px">${p.name}</div>
        <div style="color:#a1a1aa;font-size:11px">${p.country}</div>
        <div style="margin-top:4px;font-size:11px">
          <span style="color:${p.color};font-weight:600">Severity: ${p.severity}</span>
        </div>
      </div>
    `;
  }, []);

  const ringColor = useCallback(
    (d: object) => {
      const ring = d as RingDatum;
      const region = regions.find(
        (r) => Math.abs(r.lat - ring.lat) < 0.01 && Math.abs(r.lng - ring.lng) < 0.01,
      );
      const c = severityColor(region?.severityScore ?? 50);
      return (t: number) => `${c}${Math.round((1 - t) * 255).toString(16).padStart(2, "0")}`;
    },
    [regions],
  );

  return (
    <Globe
      ref={globeRef}
      globeImageUrl={EARTH_NIGHT}
      bumpImageUrl={EARTH_TOPOLOGY}
      backgroundImageUrl={NIGHT_SKY}
      showAtmosphere={true}
      atmosphereColor="#3b82f6"
      atmosphereAltitude={0.25}
      pointsData={pointsData}
      pointLat="lat"
      pointLng="lng"
      pointAltitude="altitude"
      pointRadius="radius"
      pointColor="color"
      pointLabel={pointLabel}
      pointsTransitionDuration={600}
      onPointClick={handlePointClick}
      ringsData={ringsData}
      ringLat="lat"
      ringLng="lng"
      ringMaxRadius="maxR"
      ringPropagationSpeed="propagationSpeed"
      ringRepeatPeriod="repeatPeriod"
      ringColor={ringColor}
    />
  );
}
