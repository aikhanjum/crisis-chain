"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock, CircleDot, Plus } from "lucide-react";

// ── Placeholder data — replace with API calls when backend is ready ──────────
const WALLET       = "0x4f3eA29b8c11D3e2fC9a2eF3d017C8b4e29c9a2";
const WALLET_SHORT = `${WALLET.slice(0, 6)}…${WALLET.slice(-4)}`;
const COUNTS       = { open: 3, pending: 1, fulfilled: 12 };

// pool.total     = USDC currently in pool (donated, waiting for reimbursement)
// pool.committed = USDC locked for approved/pending NGO requests (already transacted)
const POOLS = [
  { id: 1, name: "Gaza Emergency Relief", total: 412_800, committed:  87_500 },
  { id: 3, name: "Sudan Food Crisis",     total:  89_450, committed:  12_300 },
];

// One region shown on the dashboard — fetched from https://hapi.humdata.org/api/v1/
// Full regional data available on the region detail page
const REGION = {
  id: "PSE",
  name: "Gaza Strip",
  poolId: 1,
  affectedPeople:        2_100_000,
  ipcPhase:              5 as const,
  ipcLabel:              "Famine",
  foodInsecurePercent:   96,          // % of population in IPC 3+
  informRiskScore:       8.4,         // INFORM Risk Index (0–10)
  informRiskLevel:       "Very High",
  lastUpdated:           "Apr 2026",
};

const TXS = [
  { id: "018", date: "Apr 9",  desc: "Medical supplies — bandages, antiseptic",  usdc: 380.0, status: "fulfilled" as const, tx: "0xabc123" },
  { id: "017", date: "Apr 7",  desc: "Emergency food rations (×50)",              usdc: 620.0, status: "pending"   as const, tx: null       },
  { id: "016", date: "Apr 4",  desc: "Water purification tablets",                usdc: 145.5, status: "open"      as const, tx: null       },
  { id: "015", date: "Mar 28", desc: "Transport fuel — 120 L diesel",             usdc: 210.0, status: "fulfilled" as const, tx: "0xdef456" },
  { id: "014", date: "Mar 21", desc: "Shelter tarps (×12)",                       usdc: 480.0, status: "fulfilled" as const, tx: "0xghi789" },
];

// IPC food security phase colors
const IPC = {
  5: { color: "var(--ipc-5)",    bg: "var(--ipc-5-bg)",    border: "var(--ipc-5-border)"    }, // plum — Famine
  4: { color: "var(--open)",     bg: "var(--open-bg)",     border: "var(--open-border)"     }, // orange — Emergency
  3: { color: "var(--pending)",  bg: "var(--pending-bg)",  border: "var(--pending-border)"  }, // amber — Crisis
} as const;

const NAV = [
  { href: "/ngo/dashboard", label: "Dashboard"      },
  { href: "/ngo/submit",    label: "Submit Receipt" },
  { href: "/ngo/register",  label: "Register"       },
];

type Status = "open" | "pending" | "fulfilled";

const COL = "3.5rem 4rem 1fr 8.5rem 8rem 2.5rem";

function StatusIcon({ status, className }: { status: Status; className?: string }) {
  const s = { style: { width: 8, height: 8 }, className };
  if (status === "open")    return <CircleDot    {...s} />;
  if (status === "pending") return <Clock        {...s} />;
  return                           <CheckCircle2 {...s} />;
}

// ── Shared sub-label style ────────────────────────────────────────────────────
const subLabel: React.CSSProperties = {
  fontSize: "var(--fs-xs)",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  color: "var(--text-vlo)",
  marginBottom: 4,
};

// ── Page ─────────────────────────────────────────────────────────────────────
export default function NgoDashboardPage() {
  const pathname      = usePathname();
  const totalRequests = COUNTS.open + COUNTS.pending + COUNTS.fulfilled;
  const ipc           = IPC[REGION.ipcPhase];

  return (
    <div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header
        className="fu fu-1"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          backgroundColor: "var(--surface)",
          borderBottom: "1px solid var(--border-faint)",
        }}
      >
        <div
          style={{
            maxWidth: 1160,
            margin: "0 auto",
            padding: "0 32px",
            height: 54,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Left: brand + nav */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 20 }}>
              <span style={{ fontSize: "var(--fs-brand)", fontWeight: 600, color: "var(--text-hi)", letterSpacing: "-0.01em" }}>
                CrisisChain
              </span>
              <span style={{ color: "var(--border-mid)", fontSize: "var(--fs-sm)", userSelect: "none" }}>/</span>
              <span style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)" }}>NGO Portal</span>
            </div>

            <div style={{ width: 1, height: 18, backgroundColor: "var(--border)", marginRight: 20, flexShrink: 0 }} />

            <nav style={{ display: "flex", gap: 2 }}>
              {NAV.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`ngo-nav-link${pathname === href ? " ngo-nav-link-active" : ""}`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right: wallet + CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 11px",
                borderRadius: 5,
                border: "1px solid var(--border)",
                backgroundColor: "var(--bg)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-sm)",
                color: "var(--text-mid)",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--fulfilled)", flexShrink: 0 }} />
              {WALLET_SHORT}
            </div>

            <Link href="/ngo/submit">
              <button
                className="ngo-cta"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 15px",
                  borderRadius: 5,
                  backgroundColor: "var(--accent)",
                  color: "var(--accent-fg)",
                  fontSize: "var(--fs-ui)",
                  fontWeight: 600,
                  letterSpacing: "0.005em",
                  border: "none",
                  cursor: "pointer",
                  transition: "background-color 0.12s",
                }}
              >
                <Plus style={{ width: 13, height: 13 }} />
                Submit Receipt
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "36px 32px 96px" }}>

        {/* ── Region Overview ──────────────────────────────────────────── */}
        <section className="fu fu-2" style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <p className="ngo-label" style={{ marginBottom: 0 }}>Region Overview</p>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>HAPI / UN OCHA</span>
          </div>

          <div
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border-faint)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {/* Card header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-faint)",
              }}
            >
              <span style={{ fontSize: "var(--fs-body)", fontWeight: 600, color: "var(--text-hi)", letterSpacing: "-0.005em" }}>
                {REGION.name}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 9px",
                  borderRadius: 4,
                  fontSize: "var(--fs-xs)",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  color: ipc.color,
                  backgroundColor: ipc.bg,
                  outline: `1px solid ${ipc.border}`,
                  outlineOffset: -1,
                  whiteSpace: "nowrap",
                }}
              >
                IPC {REGION.ipcPhase} — {REGION.ipcLabel}
              </span>
            </div>

            {/* Stats row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                borderBottom: "1px solid var(--border-faint)",
              }}
            >
              {/* Affected people */}
              <div style={{ padding: "18px 20px", borderRight: "1px solid var(--border-faint)" }}>
                <p style={subLabel}>Affected People</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--fs-count)",
                      fontWeight: 500,
                      color: "var(--text-hi)",
                      fontVariantNumeric: "tabular-nums lining-nums",
                      lineHeight: 1,
                    }}
                  >
                    {(REGION.affectedPeople / 1_000_000).toFixed(1)}
                  </span>
                  <span style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)", fontWeight: 400 }}>M</span>
                </div>
              </div>

              {/* National risk */}
              <div style={{ padding: "18px 20px", borderRight: "1px solid var(--border-faint)" }}>
                <p style={subLabel}>National Risk</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--fs-count)",
                      fontWeight: 500,
                      color: "var(--text-hi)",
                      fontVariantNumeric: "tabular-nums lining-nums",
                      lineHeight: 1,
                    }}
                  >
                    {REGION.informRiskScore.toFixed(1)}
                  </span>
                  <span style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)" }}>/&nbsp;10</span>
                </div>
                <p style={{ marginTop: 4, fontSize: "var(--fs-xs)", color: "var(--text-lo)" }}>
                  {REGION.informRiskLevel} · INFORM
                </p>
              </div>

              {/* Food security */}
              <div style={{ padding: "18px 20px" }}>
                <p style={subLabel}>Food Security</p>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 10px",
                    borderRadius: 4,
                    fontSize: "var(--fs-xs)",
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                    color: ipc.color,
                    backgroundColor: ipc.bg,
                    outline: `1px solid ${ipc.border}`,
                    outlineOffset: -1,
                  }}
                >
                  IPC {REGION.ipcPhase} — {REGION.ipcLabel}
                </span>
                <p style={{ marginTop: 6, fontSize: "var(--fs-xs)", color: "var(--text-lo)" }}>
                  {REGION.foodInsecurePercent}% food insecure (IPC 3+)
                </p>
              </div>
            </div>

            {/* Card footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "11px 20px",
              }}
            >
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>
                Pool #{REGION.poolId} · Updated {REGION.lastUpdated}
              </span>
              <Link
                href={`/ngo/region/${REGION.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "var(--fs-ui)",
                  color: "var(--accent-text)",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                View region details
                <ArrowUpRight style={{ width: 13, height: 13 }} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Two-column grid ──────────────────────────────────────────── */}
        <div className="ngo-grid">

          {/* ── LEFT: Transaction log ──────────────────────────────────── */}
          <section className="fu fu-3">
            <p className="ngo-label">Recent Requests</p>

            <div
              style={{
                border: "1px solid var(--border-faint)",
                borderRadius: 7,
                overflow: "hidden",
                backgroundColor: "var(--surface)",
              }}
            >
              {/* Table header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: COL,
                  padding: "9px 20px",
                  borderBottom: "1px solid var(--border-faint)",
                  fontSize: "var(--fs-xs)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "var(--text-vlo)",
                  backgroundColor: "var(--bg)",
                }}
              >
                <span>#</span>
                <span>Date</span>
                <span>Item</span>
                <span style={{ textAlign: "right" }}>Amount</span>
                <span style={{ textAlign: "center" }}>Status</span>
                <span />
              </div>

              {/* Rows */}
              {TXS.map((tx, i) => (
                <div
                  key={tx.id}
                  className="ngo-tx"
                  style={{
                    display: "grid",
                    gridTemplateColumns: COL,
                    padding: "13px 20px",
                    borderBottom: i < TXS.length - 1 ? "1px solid var(--border-faint)" : "none",
                    alignItems: "center",
                    backgroundColor: "var(--surface)",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "var(--text-vlo)", fontVariantNumeric: "tabular-nums" }}>
                    {tx.id}
                  </span>
                  <span style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)" }}>{tx.date}</span>
                  <span style={{ fontSize: "var(--fs-body)", color: "var(--text-mid)", paddingRight: 20, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {tx.desc}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-body)", color: "var(--text-hi)", textAlign: "right", fontVariantNumeric: "tabular-nums lining-nums" }}>
                    {tx.usdc.toFixed(2)}
                    <span style={{ color: "var(--text-vlo)", fontSize: "var(--fs-xs)", marginLeft: 4 }}>USDC</span>
                  </span>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <span className={`chip chip-${tx.status}`}>
                      <StatusIcon status={tx.status} />
                      {tx.status === "open" ? "Open" : tx.status === "pending" ? "Pending" : "Fulfilled"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    {tx.tx ? (
                      <a href={`https://sepolia.arbiscan.io/tx/${tx.tx}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-text)" }} title="View on Arbiscan">
                        <ArrowUpRight style={{ width: 14, height: 14 }} />
                      </a>
                    ) : (
                      <span style={{ color: "var(--text-vlo)" }}>—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <Link href="#" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "var(--fs-ui)", color: "var(--text-lo)", textDecoration: "none" }}>
                All {totalRequests} requests
                <ArrowUpRight style={{ width: 12, height: 12 }} />
              </Link>
            </div>
          </section>

          {/* ── RIGHT: Sidebar ─────────────────────────────────────────── */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 24, position: "sticky", top: 78 }}>

            {/* Request counts */}
            <div className="fu fu-4">
              <p className="ngo-label">Requests</p>
              <div style={{ borderRadius: 7, backgroundColor: "var(--surface)", border: "1px solid var(--border-faint)", overflow: "hidden" }}>
                {(["open", "pending", "fulfilled"] as Status[]).map((s, i) => (
                  <div
                    key={s}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "13px 20px",
                      borderTop: i > 0 ? "1px solid var(--border-faint)" : "none",
                    }}
                  >
                    <span className={`chip chip-${s}`}>
                      <StatusIcon status={s} className={s === "open" ? "ping" : undefined} />
                      {s === "open" ? "Open" : s === "pending" ? "Pending" : "Fulfilled"}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-count)", fontWeight: 500, color: "var(--text-hi)", fontVariantNumeric: "tabular-nums lining-nums", lineHeight: 1 }}>
                      {COUNTS[s]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pool membership */}
            <div className="fu fu-5">
              {/* Section header with color key */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <p className="ngo-label" style={{ marginBottom: 0 }}>Pool Membership</p>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: "var(--pool-committed)", flexShrink: 0 }} />
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-lo)" }}>Committed</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: "var(--pool-in)", flexShrink: 0 }} />
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-lo)" }}>In pool</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {POOLS.map((pool) => {
                  const committedPct = (pool.committed / pool.total) * 100;
                  const inPoolPct    = 100 - committedPct;

                  return (
                    <div
                      key={pool.id}
                      style={{
                        padding: "16px 18px",
                        borderRadius: 8,
                        backgroundColor: "var(--surface)",
                        border: "1px solid var(--border-faint)",
                      }}
                    >
                      {/* Pool name */}
                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--fs-xs)",
                            padding: "2px 7px",
                            borderRadius: 4,
                            backgroundColor: "var(--accent-lo)",
                            color: "var(--accent-text)",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 500,
                            flexShrink: 0,
                          }}
                        >
                          #{pool.id}
                        </span>
                        <span style={{ fontSize: "var(--fs-body)", color: "var(--text-mid)", lineHeight: 1.3 }}>
                          {pool.name}
                        </span>
                      </div>

                      {/* Two amounts side by side */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                        {/* Committed */}
                        <div>
                          <p style={{ ...subLabel, color: "var(--pool-committed)" }}>Committed</p>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-ui)", fontWeight: 600, color: "var(--text-hi)", fontVariantNumeric: "tabular-nums lining-nums" }}>
                              {pool.committed.toLocaleString()}
                            </span>
                            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>USDC</span>
                          </div>
                        </div>
                        {/* In pool */}
                        <div>
                          <p style={{ ...subLabel, color: "var(--pool-in)" }}>In pool</p>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-ui)", fontWeight: 600, color: "var(--text-hi)", fontVariantNumeric: "tabular-nums lining-nums" }}>
                              {(pool.total - pool.committed).toLocaleString()}
                            </span>
                            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>USDC</span>
                          </div>
                        </div>
                      </div>

                      {/* Bar: committed | in pool (full bar = total) */}
                      <div style={{ height: 5, borderRadius: 999, display: "flex", overflow: "hidden" }}>
                        <div style={{ width: `${committedPct}%`, backgroundColor: "var(--pool-committed)", flexShrink: 0 }} />
                        <div style={{ width: `${inPoolPct}%`, backgroundColor: "var(--pool-in)", flexShrink: 0 }} />
                      </div>

                      {/* Total */}
                      <p style={{ marginTop: 7, fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>
                        {pool.total.toLocaleString()} USDC total
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

          </aside>
        </div>
      </main>
    </div>
  );
}
