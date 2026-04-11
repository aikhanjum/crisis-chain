"use client";

/**
 * Mock / dev UI for the seeded Timor-Leste demo region (DEMO-SAMPLE-2026).
 * Requires: Postgres + seed, API gateway :4000, crisis-intelligence :8001 for scrape buttons.
 */

import { useEffect, useState } from "react";
import { API_GATEWAY_URL } from "@/lib/constants";

const DEMO_REGION_ID = "DEMO-SAMPLE-2026";

type RegionRow = {
  region_id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  severity_score: number;
  severity_level: string;
  summary: string;
  donate_copy: string;
};

type DiscoveredNgo = {
  id: string;
  org_name: string;
  domain: string;
  contact_email: string | null;
  email_source: string;
  status: string;
  discovered_at: string;
};

export default function DemoTimorPage() {
  const [region, setRegion] = useState<RegionRow | null>(null);
  const [ngos, setNgos] = useState<DiscoveredNgo[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const pushLog = (m: string) =>
    setLog((prev) => [`${new Date().toISOString().slice(11, 19)} ${m}`, ...prev].slice(0, 40));

  async function loadRegion() {
    const r = await fetch(`${API_GATEWAY_URL}/regions/${DEMO_REGION_ID}`);
    if (!r.ok) {
      pushLog(`region fetch failed: ${r.status} (run seed.sql if 404)`);
      setRegion(null);
      return;
    }
    setRegion(await r.json());
    pushLog("Loaded region from API gateway");
  }

  async function loadNgos() {
    const r = await fetch(`${API_GATEWAY_URL}/regions/${DEMO_REGION_ID}/discovered-ngos`);
    if (!r.ok) {
      pushLog(`discovered-ngos failed: ${r.status}`);
      return;
    }
    const rows = await r.json();
    setNgos(rows);
    pushLog(`Loaded ${rows.length} discovered NGO row(s)`);
  }

  useEffect(() => {
    void loadRegion();
    void loadNgos();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  async function runDiscover(limit: number) {
    setBusy("discover");
    try {
      const r = await fetch(
        `${API_GATEWAY_URL}/regions/${DEMO_REGION_ID}/discover-ngos?limit=${limit}`,
        { method: "POST" },
      );
      const body = await r.json();
      pushLog(`discover-ngos ${r.status}: ${JSON.stringify(body).slice(0, 200)}…`);
      await loadNgos();
    } catch (e) {
      pushLog(`discover error: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function runFullPipeline() {
    setBusy("pipeline");
    try {
      const r = await fetch(`${API_GATEWAY_URL}/regions/refresh`, { method: "POST" });
      const body = await r.json();
      pushLog(`pipeline refresh ${r.status}: ${JSON.stringify(body).slice(0, 240)}…`);
      await loadRegion();
      await loadNgos();
    } catch (e) {
      pushLog(`pipeline error: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <span className="font-semibold">Demo — {DEMO_REGION_ID}</span>
        <a href="/map" className="text-sm text-amber-400 hover:underline">
          ← Map stub
        </a>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-8">
        <section className="space-y-2">
          <h2 className="text-lg font-medium text-white">Region (from DB via gateway)</h2>
          {region ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-sm space-y-2">
              <p>
                <span className="text-zinc-500">Name</span> — {region.name}
              </p>
              <p>
                <span className="text-zinc-500">Country</span> — {region.country}
              </p>
              <p>
                <span className="text-zinc-500">Severity</span> — {region.severity_score} (
                {region.severity_level})
              </p>
              <p className="text-zinc-400 leading-relaxed">{region.summary}</p>
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">
              No region row. Seed the DB:{" "}
              <code className="text-amber-200/90">psql $DATABASE_URL -f migrations/seed.sql</code>
            </p>
          )}
          <button
            type="button"
            onClick={() => void loadRegion()}
            className="text-sm px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700"
          >
            Reload region
          </button>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-white">NGO scraper (this region only)</h2>
          <p className="text-sm text-zinc-400">
            Proxied to crisis-intelligence <code className="text-zinc-300">POST /ngos/discover/…</code>.
            Keep <code className="text-zinc-300">limit</code> low for fast demos.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void runDiscover(8)}
              className="px-3 py-2 rounded-md bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-sm font-medium"
            >
              {busy === "discover" ? "Scraping…" : "Scrape NGOs (limit 8)"}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void loadNgos()}
              className="px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm"
            >
              Refresh list
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-white">Full pipeline (new regions from ACLED)</h2>
          <p className="text-sm text-zinc-400">
            Proxied to <code className="text-zinc-300">POST /regions/refresh</code> on
            crisis-intelligence. Needs <code className="text-zinc-300">ACLED_EMAIL</code> +{" "}
            <code className="text-zinc-300">ACLED_PASSWORD</code> for OAuth (or a static{" "}
            <code className="text-zinc-300">ACLED_ACCESS_TOKEN</code>). Upserts{" "}
            <code className="text-zinc-300">crisis_nodes</code> from conflict + HDX scores, then runs
            NGO discovery for every region with severity ≥ 20.
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void runFullPipeline()}
            className="px-3 py-2 rounded-md bg-red-900/80 hover:bg-red-800 disabled:opacity-40 text-sm"
          >
            {busy === "pipeline" ? "Pipeline running…" : "Run full refresh (background)"}
          </button>
        </section>

        <section>
          <h2 className="text-lg font-medium text-white mb-2">
            Discovered NGOs ({ngos.length})
          </h2>
          <ul className="space-y-2">
            {ngos.length === 0 ? (
              <li className="text-zinc-500 text-sm">None yet — run scrape above.</li>
            ) : (
              ngos.map((n) => (
                <li
                  key={n.id}
                  className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-zinc-200">{n.org_name}</span>
                  <span className="text-zinc-500"> · {n.domain}</span>
                  {n.contact_email && (
                    <span className="block text-zinc-400 mt-1">{n.contact_email}</span>
                  )}
                  <span className="block text-xs text-zinc-600 mt-1">
                    {n.email_source} · {n.status}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1">Log</h2>
          <pre className="text-xs text-zinc-400 bg-black/40 rounded-lg p-3 max-h-48 overflow-auto font-mono">
            {log.length ? log.join("\n") : "Actions will append here."}
          </pre>
        </section>
      </main>
    </div>
  );
}
