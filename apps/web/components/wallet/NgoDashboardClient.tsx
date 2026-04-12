"use client";

import { darkTheme } from "@rainbow-me/rainbowkit";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, CircleDot, Clock, FileText, Globe, Shield, Banknote } from "lucide-react";
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";

import { Web3Provider } from "@/providers/Web3Provider";
import { API_GATEWAY_URL, EXPLORER_BASE_URL, USDC_DECIMALS } from "@/lib/constants";
import { executeVaultPayout, getNgoQueue, getPoolLedger, type CrisisRegion, type NgoReceiptRequest } from "@/lib/api";
import { poolIdFromRegionId } from "@/lib/wallet-utils";
import { useCrisisRegions } from "@/hooks/useCrisisRegions";
import { useNgoAuth } from "@/hooks/useWallet";
import { NgoHeader } from "@/components/ngo/NgoHeader";

type UiStatus = "submitted" | "verifying" | "paid" | "rejected";

const COL = "3.5rem 4rem 1fr 8.5rem 8rem";

const subLabel: React.CSSProperties = {
  fontSize: "var(--fs-xs)",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  color: "var(--text-vlo)",
  marginBottom: 4,
};

const IPC_STYLE = {
  critical: { phase: 5, label: "Famine", key: 5 as const },
  high: { phase: 4, label: "Emergency", key: 4 as const },
  medium: { phase: 3, label: "Crisis", key: 3 as const },
  low: { phase: 2, label: "Stressed", key: 3 as const },
} as const;

const IPC = {
  5: { color: "var(--ipc-5)", bg: "var(--ipc-5-bg)", border: "var(--ipc-5-border)" },
  4: { color: "var(--open)", bg: "var(--open-bg)", border: "var(--open-border)" },
  3: { color: "var(--pending)", bg: "var(--pending-bg)", border: "var(--pending-border)" },
} as const;

function shortRegionName(name: string): string {
  return name
    .replace(/\s+(Conflict Zone|Gang Crisis|Displacement|Recovery Crisis|Frontline|Famine Risk|Drought|Violence|Crisis Zone)$/i, "")
    .trim();
}

function formatPop(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function StatusIcon({ status, className }: { status: UiStatus; className?: string }) {
  const s = { style: { width: 8, height: 8 }, className };
  if (status === "submitted") return <CircleDot {...s} />;
  if (status === "verifying" || status === "rejected") return <Clock {...s} />;
  return <CheckCircle2 {...s} />;
}

function mapReceiptStatus(s: NgoReceiptRequest["status"]): UiStatus {
  if (s === "pending") return "submitted";
  if (s === "rejected") return "rejected";
  if (s === "approved") return "verifying"; // approved in DB, vault payout not done yet
  if (s === "paid") return "paid";
  return "submitted";
}

function chipLabel(status: UiStatus, raw?: NgoReceiptRequest["status"]) {
  if (status === "submitted") return "Submitted";
  if (status === "verifying" && raw === "approved") return "Approved";
  if (status === "verifying") return "Verifying";
  if (status === "rejected") return "Rejected";
  return "Paid";
}

type ReceiptRowProps = {
  tx: {
    id: string;
    date: string;
    desc: string;
    usdc: number;
    status: UiStatus;
    tx: string | null;
    rawReceipt: NgoReceiptRequest | null;
  };
  isLast: boolean;
};

function pipelineSteps(receipt: NgoReceiptRequest | null, status: UiStatus) {
  if (!receipt) {
    return [
      { label: "Receipt submitted", icon: FileText, done: true, detail: null },
      { label: "Pinned to IPFS", icon: Globe, done: status === "paid", detail: null },
      { label: "On-chain claim", icon: Shield, done: status === "paid", detail: null },
      { label: "Payout", icon: Banknote, done: status === "paid", detail: null },
    ];
  }

  const hasIpfs = !!receipt.receipt_ipfs;
  const hasTx = !!receipt.payout_tx_hash;
  const paidOnChain = receipt.status === "paid";

  return [
    {
      label: "Receipt submitted",
      icon: FileText,
      done: true,
      detail: receipt.item_notes || null,
    },
    {
      label: "Pinned to IPFS",
      icon: Globe,
      done: hasIpfs || paidOnChain,
      detail: hasIpfs
        ? receipt.receipt_ipfs
        : paidOnChain
          ? "Archived"
          : "Awaiting IPFS pin",
    },
    {
      label: "On-chain delivery claim",
      icon: Shield,
      done: hasTx || paidOnChain,
      detail: hasTx
        ? receipt.status === "paid"
          ? "Claim recorded on-chain"
          : "Claim submitted — awaiting attestations"
        : paidOnChain
          ? "Recorded"
          : "Awaiting on-chain submission",
    },
    {
      label: "Payout",
      icon: Banknote,
      done: paidOnChain,
      detail: hasTx
        ? receipt.payout_tx_hash!.slice(0, 10) + "…"
        : paidOnChain
          ? "Paid"
          : "Run vault payout when pool is funded",
    },
  ];
}

function ReceiptRow({ tx, isLast }: ReceiptRowProps) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((v) => !v), []);
  const { token } = useNgoAuth();
  const queryClient = useQueryClient();
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultErr, setVaultErr] = useState<string | null>(null);
  const steps = pipelineSteps(tx.rawReceipt, tx.status);
  const canVaultPayout =
    !!tx.rawReceipt &&
    (tx.rawReceipt.status === "pending" || tx.rawReceipt.status === "approved");

  const handleVaultPayout = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!token || !tx.rawReceipt) return;
      setVaultErr(null);
      setVaultBusy(true);
      try {
        await executeVaultPayout(tx.rawReceipt.id, token);
        await queryClient.invalidateQueries({ queryKey: ["ngoQueue", token] });
      } catch (err) {
        setVaultErr(err instanceof Error ? err.message : "Vault payout failed");
      } finally {
        setVaultBusy(false);
      }
    },
    [token, tx.rawReceipt, queryClient],
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [expanded, steps]);

  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid var(--border-faint)" }}>
      <div
        onClick={toggle}
        className="ngo-tx"
        style={{
          display: "grid",
          gridTemplateColumns: COL,
          padding: "13px 20px",
          alignItems: "center",
          backgroundColor: expanded ? "var(--hero-bg)" : "var(--surface)",
          cursor: "pointer",
          transition: "background-color 0.15s",
        }}
        onMouseEnter={(e) => { if (!expanded) e.currentTarget.style.backgroundColor = "var(--hero-bg)"; }}
        onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.backgroundColor = "var(--surface)"; }}
      >
        {tx.tx ? (
          <a
            href={`${EXPLORER_BASE_URL.replace(/\/$/, "")}/tx/${tx.tx}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)",
              color: "var(--text-vlo)", fontVariantNumeric: "tabular-nums",
              textDecoration: "none",
            }}
            title="View on explorer"
          >
            {tx.id}
          </a>
        ) : (
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)",
            color: "var(--text-vlo)", fontVariantNumeric: "tabular-nums",
          }}>
            {tx.id}
          </span>
        )}
        <span style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)" }}>{tx.date}</span>
        <span style={{
          fontSize: "var(--fs-body)", color: "var(--text-mid)",
          paddingRight: 20, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {tx.desc}
        </span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "var(--fs-body)",
          color: "var(--text-hi)", textAlign: "right",
          fontVariantNumeric: "tabular-nums lining-nums",
        }}>
          {tx.usdc.toFixed(2)}
          <span style={{ color: "var(--text-vlo)", fontSize: "var(--fs-xs)", marginLeft: 4 }}>USDC</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className={`chip chip-${tx.status === "submitted" ? "pending" : tx.status === "verifying" ? "pending" : tx.status === "paid" ? "fulfilled" : "open"}`}>
            <StatusIcon status={tx.status} />
            {chipLabel(tx.status, tx.rawReceipt?.status)}
          </span>
        </div>
      </div>

      <div style={{
        overflow: "hidden",
        maxHeight: expanded ? height : 0,
        opacity: expanded ? 1 : 0,
        transition: "max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease",
      }}>
        <div
          ref={contentRef}
          style={{
            padding: "16px 20px 20px 28px",
            backgroundColor: "var(--hero-bg)",
            borderTop: "1px solid var(--border-faint)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
            {steps.map((step, si) => {
              const Icon = step.icon;
              const isActive = !step.done && (si === 0 || steps[si - 1].done);
              return (
                <div key={si} style={{ display: "flex", gap: 12, position: "relative", paddingBottom: si < steps.length - 1 ? 16 : 0 }}>
                  {si < steps.length - 1 && (
                    <div style={{
                      position: "absolute", left: 11, top: 24, bottom: 0, width: 1,
                      backgroundColor: steps[si + 1].done ? "var(--fulfilled)" : "var(--border)",
                    }} />
                  )}
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    backgroundColor: step.done ? "var(--fulfilled)" : isActive ? "var(--pending)" : "var(--border)",
                    transition: "background-color 0.2s",
                    zIndex: 1,
                  }}>
                    {step.done ? (
                      <CheckCircle2 style={{ width: 13, height: 13, color: "var(--surface)" }} />
                    ) : (
                      <Icon style={{ width: 11, height: 11, color: isActive ? "#111" : "var(--text-vlo)" }} />
                    )}
                  </div>
                  <div style={{ paddingTop: 1 }}>
                    <span style={{
                      fontSize: "var(--fs-ui)", fontWeight: 600,
                      color: step.done ? "var(--fulfilled)" : isActive ? "var(--pending)" : "var(--text-vlo)",
                    }}>
                      {step.label}
                    </span>
                    {step.detail && (
                      <p style={{
                        fontSize: "var(--fs-xs)", color: "var(--text-vlo)", margin: "2px 0 0",
                        fontFamily: step.label.includes("IPFS") || step.label === "Payout" ? "var(--font-mono)" : "inherit",
                        wordBreak: "break-all",
                      }}>
                        {step.detail}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {canVaultPayout && token ? (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-faint)" }}>
              <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)", marginBottom: 10, lineHeight: 1.45 }}>
                Pulls USDC from the CrisisPoolVault for this region&apos;s pool (same pool id as donate). Ensure the pool has balance and the blockchain-bridge is running.
              </p>
              <button
                type="button"
                onClick={handleVaultPayout}
                disabled={vaultBusy}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid var(--fulfilled-border)",
                  backgroundColor: "var(--fulfilled-bg)",
                  color: "var(--fulfilled)",
                  fontSize: "var(--fs-ui)",
                  fontWeight: 600,
                  cursor: vaultBusy ? "wait" : "pointer",
                  opacity: vaultBusy ? 0.7 : 1,
                }}
              >
                <Banknote style={{ width: 14, height: 14 }} />
                {vaultBusy ? "Submitting…" : "Execute vault payout"}
              </button>
              {vaultErr ? (
                <p style={{ color: "var(--open)", fontSize: "var(--fs-xs)", marginTop: 8 }}>{vaultErr}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function poolKeyForRegion(r: CrisisRegion): string {
  return r.poolId && r.poolId.length > 0 ? r.poolId : poolIdFromRegionId(r.id);
}

function NgoDashboardInner() {
  const { address, isConnected } = useAccount();
  const walletAuth = useNgoAuth();
  const token = walletAuth.token;
  const isAuthenticated = walletAuth.isAuthenticated;

  const { data: allRegions = [], isLoading: regionsLoading, error: regionsError } = useCrisisRegions();
  const [operatedRegions, setOperatedRegions] = useState<string[] | null>(null);
  const [ngoProfile, setNgoProfile] = useState<{ org_name: string; status: string; country: string } | null>(null);

  useEffect(() => {
    if (!token) { setOperatedRegions(null); setNgoProfile(null); return; }
    fetch(`${API_GATEWAY_URL}/ngo/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((body: { operated_regions?: string[]; org_name?: string; status?: string; country?: string }) => {
        if (Array.isArray(body.operated_regions) && body.operated_regions.length > 0) {
          setOperatedRegions(body.operated_regions);
        } else {
          setOperatedRegions(null);
        }
        if (body.org_name) {
          setNgoProfile({ org_name: body.org_name, status: body.status ?? "pending", country: body.country ?? "" });
        }
      })
      .catch(() => { setOperatedRegions(null); setNgoProfile(null); });
  }, [token]);

  // Restrict to NGO's operated regions if available
  const regions = useMemo(() => {
    if (!operatedRegions) return allRegions;
    return allRegions.filter((r) => operatedRegions.includes(r.id));
  }, [allRegions, operatedRegions]);

  const primaryRegion = useMemo(() => {
    if (!regions.length) return null;
    return [...regions].sort((a, b) => b.severityScore - a.severityScore)[0] ?? null;
  }, [regions]);

  const poolKeys = useMemo(() => {
    const s = new Set<string>();
    for (const r of regions) {
      s.add(poolKeyForRegion(r));
    }
    return [...s].slice(0, 12);
  }, [regions]);

  const ledgerQueries = useQueries({
    queries: poolKeys.map((poolId) => ({
      queryKey: ["ngoPoolLedger", poolId],
      queryFn: () => getPoolLedger(poolId),
      staleTime: 30_000,
      retry: 1,
    })),
  });

  const { data: queue = [], isLoading: queueLoading } = useQuery({
    queryKey: ["ngoQueue", token],
    queryFn: () => getNgoQueue(token!),
    enabled: isAuthenticated && !!token,
  });

  const onChainPayouts = useMemo(() => {
    if (!address) return [];
    const a = address.toLowerCase();
    const rows: {
      id: string;
      date: string;
      desc: string;
      usdc: number;
      status: UiStatus;
      tx: string | null;
      poolId: string;
      sortKey: number;
    }[] = [];

    for (let i = 0; i < poolKeys.length; i += 1) {
      const q = ledgerQueries[i];
      const poolId = poolKeys[i];
      if (!q?.data?.payouts) continue;
      for (const p of q.data.payouts) {
        if (p.actor?.toLowerCase() !== a) continue;
        const raw = BigInt(p.amount || "0");
        const ts = p.timestamp ? new Date(p.timestamp) : new Date(0);
        rows.push({
          id: p.txHash?.slice(2, 10) ?? poolId,
          date: ts.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          desc: `Payout — pool #${poolId}`,
          usdc: Number(formatUnits(raw, USDC_DECIMALS)),
          status: "paid",
          tx: p.txHash || null,
          poolId,
          sortKey: ts.getTime(),
        });
      }
    }
    rows.sort((x, y) => y.sortKey - x.sortKey);
    return rows.slice(0, 25);
  }, [address, ledgerQueries, poolKeys]);

  const tableRows = useMemo(() => {
    if (isAuthenticated && queue.length > 0) {
      return queue.map((r) => {
        const ui = mapReceiptStatus(r.status);
        return {
          id: r.id.slice(0, 8),
          date: new Date(r.submitted_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          desc: r.item_notes || "Receipt request",
          usdc: Number(r.approved_amount ?? r.requested_amount),
          status: ui,
          tx: r.payout_tx_hash,
          rawReceipt: r,
        };
      });
    }
    return onChainPayouts.map((r) => ({
      id: r.id,
      date: r.date,
      desc: r.desc,
      usdc: r.usdc,
      status: r.status,
      tx: r.tx,
      rawReceipt: null as NgoReceiptRequest | null,
    }));
  }, [isAuthenticated, queue, onChainPayouts]);

  const counts = useMemo(() => {
    if (isAuthenticated && queue.length > 0) {
      let submitted = 0;
      let verifying = 0;
      let paid = 0;
      for (const r of queue) {
        if (r.status === "pending") submitted += 1;
        else if (r.status === "approved") verifying += 1;
        else if (r.status === "paid") paid += 1;
      }
      return { submitted, verifying, paid };
    }
    const paid = onChainPayouts.length;
    return { submitted: 0, verifying: 0, paid };
  }, [isAuthenticated, queue, onChainPayouts]);

  const totalRequests = counts.submitted + counts.verifying + counts.paid;

  const poolCards = useMemo(() => {
    return poolKeys.map((key, i) => {
      const ledger = ledgerQueries[i]?.data;
      const regionName =
        regions.find((r) => poolKeyForRegion(r) === key)?.name ?? `Pool ${key}`;
      if (!ledger) {
        return {
          id: key,
          name: regionName,
          total: 0,
          committed: 0,
          loading: ledgerQueries[i]?.isLoading ?? true,
          error: ledgerQueries[i]?.error ? String(ledgerQueries[i]?.error) : null,
        };
      }
      const donated = BigInt(ledger.totalDonatedRaw || "0");
      const paid = BigInt(ledger.totalPaidOutRaw || "0");
      return {
        id: key,
        name: regionName,
        total: Number(formatUnits(donated, USDC_DECIMALS)),
        committed: Number(formatUnits(paid, USDC_DECIMALS)),
        loading: false,
        error: null as string | null,
      };
    });
  }, [poolKeys, ledgerQueries, regions]);

  // The ledger card for the single highest-severity region
  const primaryPoolCard = useMemo(() => {
    if (!primaryRegion) return null;
    const key = poolKeyForRegion(primaryRegion);
    return poolCards.find((p) => p.id === key) ?? null;
  }, [primaryRegion, poolCards]);

  // USDC totals per request status
  const requestFinancials = useMemo(() => {
    if (!isAuthenticated || queue.length === 0) return null;
    const totals: Record<UiStatus, number> = { submitted: 0, verifying: 0, paid: 0, rejected: 0 };
    for (const r of queue) {
      const ui = mapReceiptStatus(r.status);
      const amt = r.status === "pending"
        ? Number(r.requested_amount)
        : Number(r.approved_amount ?? r.requested_amount);
      if (!isNaN(amt)) totals[ui] += amt;
    }
    return totals;
  }, [isAuthenticated, queue]);

  // Aggregate across all operated pools
  const poolAggregate = useMemo(() => {
    let net = 0n;
    let donated = 0n;
    let paidOut = 0n;
    let loaded = 0;
    const donors = new Set<string>();
    for (const q of ledgerQueries) {
      if (!q.data) continue;
      donated += BigInt(q.data.totalDonatedRaw || "0");
      paidOut += BigInt(q.data.totalPaidOutRaw || "0");
      net += BigInt(q.data.netRaw || "0");
      loaded += 1;
      for (const d of q.data.donations) {
        if (d.actor) donors.add(d.actor.toLowerCase());
      }
    }
    return {
      net: Number(formatUnits(net, USDC_DECIMALS)),
      donated: Number(formatUnits(donated, USDC_DECIMALS)),
      paidOut: Number(formatUnits(paidOut, USDC_DECIMALS)),
      totalMembers: donors.size,
      loading: loaded === 0 && ledgerQueries.some((q) => q.isLoading),
    };
  }, [ledgerQueries]);

  const ipcHint = primaryRegion ? IPC_STYLE[primaryRegion.severityLevel] : null;
  // Use explicit ipcPhase from DB when available, fall back to severity-level derivation
  const ipcPhaseDisplay = primaryRegion?.ipcPhase ?? ipcHint?.phase ?? 3;
  const ipcLabelMap: Record<number, string> = { 5: "Famine", 4: "Emergency", 3: "Crisis", 2: "Stressed", 1: "Minimal" };
  const ipcLabel = ipcLabelMap[ipcPhaseDisplay] ?? ipcHint?.label ?? "Crisis";
  const ipcKey = (ipcPhaseDisplay >= 5 ? 5 : ipcPhaseDisplay >= 4 ? 4 : 3) as 3 | 4 | 5;
  const ipc = IPC[ipcKey];

  return (
    <div>
      <NgoHeader />

      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "36px 32px 96px" }}>
        {!isAuthenticated && (
          <div style={{ padding: "48px 24px", textAlign: "center", border: "1px solid var(--border-faint)", borderRadius: 10, backgroundColor: "var(--surface)" }}>
            <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-hi)", marginBottom: 8 }}>Sign in to access the NGO dashboard</p>
            <p style={{ fontSize: "var(--fs-body)", color: "var(--text-lo)", marginBottom: 20 }}>Connect your wallet and sign in from the <Link href="/ngo/register" style={{ color: "var(--accent-text)", textDecoration: "none" }}>Profile</Link> page.</p>
          </div>
        )}
        {isAuthenticated && (
          <section className="fu fu-2" style={{ marginBottom: 48, paddingBottom: 40, borderBottom: "1px solid var(--border-faint)" }}>
            {regionsError ? (
              <p style={{ color: "var(--open)", fontSize: "var(--fs-ui)" }}>Could not load regions. Is the API gateway running?</p>
            ) : regionsLoading && !primaryRegion ? (
              <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-ui)" }}>Loading region data…</p>
            ) : !primaryRegion ? (
              <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-ui)" }}>No crisis regions in the database yet.</p>
            ) : (
              <>
                {/* Region name + IPC phase */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 28 }}>
                  <div>
                    <p style={{ ...subLabel, marginBottom: 8 }}>Primary operating region</p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                      <h2 style={{
                        fontSize: "var(--fs-hero)",
                        fontWeight: 700,
                        color: "var(--text-hi)",
                        lineHeight: 1,
                        letterSpacing: "-0.025em",
                        margin: 0,
                        fontFamily: "var(--font-sans)",
                      }}>
                        {shortRegionName(primaryRegion.name)}
                      </h2>
                      <span style={{ fontSize: "var(--fs-body)", color: "var(--text-lo)", fontWeight: 400 }}>
                        {primaryRegion.country}
                      </span>
                    </div>
                  </div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "5px 12px",
                      borderRadius: 4,
                      fontSize: "var(--fs-ui)",
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                      color: ipc.color,
                      backgroundColor: ipc.bg,
                      outline: `1px solid ${ipc.border}`,
                      outlineOffset: -1,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      marginTop: 4,
                      textTransform: "uppercase",
                    }}
                  >
                    IPC {ipcPhaseDisplay} — {ipcLabel}
                  </span>
                </div>

                {/* Population impact stats row */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 32, marginBottom: 20 }}>
                  {/* Affected population — hero stat (36px if available, else severity score) */}
                  <div style={{ flexShrink: 0 }}>
                    <p style={subLabel}>{primaryRegion.affectedPopulation != null ? "Affected" : "Severity index"}</p>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                      <span style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--fs-hero)",
                        fontWeight: 500,
                        color: "var(--text-hi)",
                        fontVariantNumeric: "tabular-nums lining-nums",
                        lineHeight: 1,
                        letterSpacing: "-0.02em",
                      }}>
                        {primaryRegion.affectedPopulation != null
                          ? formatPop(primaryRegion.affectedPopulation)
                          : primaryRegion.severityScore.toFixed(1)}
                      </span>
                      {primaryRegion.affectedPopulation == null && (
                        <span style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)" }}>/100</span>
                      )}
                    </div>
                    <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)", margin: "3px 0 0", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                      {primaryRegion.affectedPopulation != null ? "people IPC 3+" : "composite score"}
                    </p>
                  </div>

                  {/* Divider */}
                  <div style={{ width: 1, alignSelf: "stretch", backgroundColor: "var(--border-faint)", flexShrink: 0 }} />

                  {/* Displaced */}
                  {primaryRegion.displacedCount != null && (
                    <>
                      <div style={{ flexShrink: 0 }}>
                        <p style={subLabel}>Displaced</p>
                        <span style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--fs-count)",
                          fontWeight: 500,
                          color: "var(--text-hi)",
                          fontVariantNumeric: "tabular-nums lining-nums",
                          lineHeight: 1,
                        }}>
                          {formatPop(primaryRegion.displacedCount)}
                        </span>
                        <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)", margin: "3px 0 0", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>internally</p>
                      </div>
                      <div style={{ width: 1, alignSelf: "stretch", backgroundColor: "var(--border-faint)", flexShrink: 0 }} />
                    </>
                  )}

                  {/* Food insecure % */}
                  {primaryRegion.foodInsecurePct != null && (
                    <>
                      <div style={{ flexShrink: 0 }}>
                        <p style={subLabel}>Food insecure</p>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                          <span style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--fs-count)",
                            fontWeight: 500,
                            color: "var(--text-hi)",
                            fontVariantNumeric: "tabular-nums lining-nums",
                            lineHeight: 1,
                          }}>
                            {primaryRegion.foodInsecurePct % 1 === 0
                              ? primaryRegion.foodInsecurePct.toFixed(0)
                              : primaryRegion.foodInsecurePct.toFixed(1)}
                          </span>
                          <span style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)" }}>%</span>
                        </div>
                        <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)", margin: "3px 0 0", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>of population</p>
                      </div>
                      <div style={{ width: 1, alignSelf: "stretch", backgroundColor: "var(--border-faint)", flexShrink: 0 }} />
                    </>
                  )}

                  {/* NGOs in region */}
                  <div style={{ flexShrink: 0 }}>
                    <p style={subLabel}>NGOs in region</p>
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--fs-count)",
                      fontWeight: 500,
                      color: primaryRegion.activeNgos > 0 ? "var(--text-hi)" : "var(--text-vlo)",
                      fontVariantNumeric: "tabular-nums lining-nums",
                      lineHeight: 1,
                    }}>
                      {primaryRegion.activeNgos > 0 ? primaryRegion.activeNgos : "—"}
                    </span>
                    <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)", margin: "3px 0 0", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                      {primaryRegion.activeNgos > 0 ? "registered" : "run discover-ngos"}
                    </p>
                  </div>

                  {/* Pool balance — available USDC in this region's pool */}
                  {primaryPoolCard && !primaryPoolCard.loading && !primaryPoolCard.error && (
                    <>
                      <div style={{ width: 1, alignSelf: "stretch", backgroundColor: "var(--border-faint)", flexShrink: 0 }} />
                      <div style={{ flexShrink: 0 }}>
                        <p style={subLabel}>Pool balance</p>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                          <span style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--fs-count)",
                            fontWeight: 500,
                            color: "var(--text-hi)",
                            fontVariantNumeric: "tabular-nums lining-nums",
                            lineHeight: 1,
                          }}>
                            {(primaryPoolCard.total - primaryPoolCard.committed).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                          <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>USDC</span>
                        </div>
                        <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)", margin: "3px 0 0", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>available</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Footer meta + donate link */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
                  <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)", margin: 0 }}>
                    Pool #{poolKeyForRegion(primaryRegion)} · Updated {new Date(primaryRegion.lastUpdated).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · HAPI / UN OCHA · Severity index {primaryRegion.severityScore.toFixed(0)}/100
                  </p>
                  <Link
                    href={`/donate/${primaryRegion.id}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: "var(--fs-xs)",
                      color: "var(--text-vlo)",
                      textDecoration: "none",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      letterSpacing: "0.03em",
                    }}
                  >
                    Donate page
                    <ArrowUpRight style={{ width: 11, height: 11 }} />
                  </Link>
                </div>
              </>
            )}
          </section>
        )}
        {/* Operating regions — compact multi-region table, shown only when NGO has >1 region */}
        {isAuthenticated && regions.length > 1 && (
          <section style={{ marginBottom: 48 }}>
            <p className="ngo-label" style={{ marginBottom: 10 }}>Operating regions</p>
            <div style={{ border: "1px solid var(--border-faint)", borderRadius: 7, overflow: "hidden", backgroundColor: "var(--surface)" }}>
              {[...regions].sort((a, b) => b.severityScore - a.severityScore).map((region, idx) => {
                const rPhase = region.ipcPhase ?? IPC_STYLE[region.severityLevel]?.phase ?? 3;
                const rKey = (rPhase >= 5 ? 5 : rPhase >= 4 ? 4 : 3) as 3 | 4 | 5;
                const rIpc = IPC[rKey];
                const rCard = poolCards.find((p) => p.id === poolKeyForRegion(region));
                const available = rCard && !rCard.loading && !rCard.error ? rCard.total - rCard.committed : null;
                return (
                  <div
                    key={region.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto auto",
                      gap: 12,
                      alignItems: "center",
                      padding: "10px 16px",
                      borderTop: idx > 0 ? "1px solid var(--border-faint)" : "none",
                    }}
                  >
                    <span style={{
                      fontSize: "var(--fs-xs)", fontWeight: 700, color: rIpc.color,
                      backgroundColor: rIpc.bg, outline: `1px solid ${rIpc.border}`, outlineOffset: -1,
                      padding: "2px 6px", borderRadius: 3, whiteSpace: "nowrap",
                    }}>
                      IPC {rPhase}
                    </span>
                    <span style={{ fontSize: "var(--fs-body)", color: "var(--text-mid)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {shortRegionName(region.name)}
                      <span style={{ color: "var(--text-vlo)", marginLeft: 8, fontSize: "var(--fs-xs)" }}>{region.country}</span>
                    </span>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: "var(--fs-ui)", fontVariantNumeric: "tabular-nums",
                      color: available != null ? "var(--text-lo)" : "var(--text-vlo)", textAlign: "right", whiteSpace: "nowrap",
                    }}>
                      {available != null
                        ? <>{available.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>USDC</span></>
                        : "—"}
                    </span>
                    <Link href={`/donate/${region.id}`} style={{ color: "var(--text-vlo)", textDecoration: "none", display: "flex" }}>
                      <ArrowUpRight style={{ width: 12, height: 12 }} />
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {isAuthenticated && <div className="ngo-grid">
          <section className="fu fu-3">
            <p className="ngo-label">
              {isAuthenticated && queue.length > 0 ? "Your receipt requests" : "On-chain payouts to your wallet"}
            </p>
            {!isConnected ? (
              <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-ui)" }}>Connect a wallet to see payout history.</p>
            ) : isAuthenticated && queueLoading ? (
              <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-ui)" }}>Loading your queue…</p>
            ) : tableRows.length === 0 ? (
              <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-ui)" }}>
                {isAuthenticated
                  ? "No receipt requests yet. Submit one from Submit Receipt."
                  : "No indexed payouts to this address yet, or indexer/API is offline. Sign in to load your receipt queue from the gateway."}
              </p>
            ) : (
              <div
                style={{
                  border: "1px solid var(--border-faint)",
                  borderRadius: 7,
                  overflow: "hidden",
                  backgroundColor: "var(--surface)",
                }}
              >
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
                </div>

                {tableRows.map((tx, i) => (
                  <ReceiptRow key={`${tx.id}-${i}`} tx={tx} isLast={i === tableRows.length - 1} />
                ))}
              </div>
            )}

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <span style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)" }}>
                Tracked requests: {totalRequests}
                {isAuthenticated ? "" : " (sign in for receipt queue)"}
              </span>
            </div>
          </section>

          <aside style={{ display: "flex", flexDirection: "column", gap: 24, position: "sticky", top: 78 }}>
            {/* NGO org profile */}
            {ngoProfile && (
              <div className="fu fu-4">
                <p className="ngo-label">Organization</p>
                <div style={{ border: "1px solid var(--border-faint)", borderRadius: 7, backgroundColor: "var(--surface)", padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ fontSize: "var(--fs-body)", fontWeight: 600, color: "var(--text-hi)", lineHeight: 1.3 }}>
                      {ngoProfile.org_name}
                    </span>
                    <span style={{
                      padding: "2px 8px", borderRadius: 3, fontSize: "var(--fs-xs)", fontWeight: 700,
                      whiteSpace: "nowrap", flexShrink: 0,
                      ...(ngoProfile.status === "approved"
                        ? { color: "var(--fulfilled)", backgroundColor: "var(--fulfilled-bg)", outline: "1px solid var(--fulfilled-border)", outlineOffset: -1 }
                        : { color: "var(--pending)", backgroundColor: "var(--pending-bg)", outline: "1px solid var(--pending-border)", outlineOffset: -1 }),
                    }}>
                      {ngoProfile.status === "approved" ? "Approved" : "Pending review"}
                    </span>
                  </div>
                  {ngoProfile.country && (
                    <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)", marginTop: 6 }}>{ngoProfile.country}</p>
                  )}
                </div>
              </div>
            )}

            <div className="fu fu-4">
              <p className="ngo-label">Requests</p>
              <div
                style={{
                  borderRadius: 7,
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border-faint)",
                  overflow: "hidden",
                }}
              >
                {(["submitted", "verifying", "paid"] as const).map((s, i) => (
                  <div
                    key={s}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 18px",
                      borderTop: i > 0 ? "1px solid var(--border-faint)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)", fontWeight: 400 }}>
                        {s === "submitted" ? "Submitted" : s === "verifying" ? "Verifying" : "Paid"}
                      </span>
                      {requestFinancials && requestFinancials[s] > 0 && (
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)",
                          color: "var(--text-vlo)", fontVariantNumeric: "tabular-nums",
                        }}>
                          {requestFinancials[s].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: "var(--fs-count)", fontWeight: 500,
                      color: "var(--text-hi)", fontVariantNumeric: "tabular-nums lining-nums", lineHeight: 1,
                    }}>
                      {counts[s]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="fu fu-5">
              <p className="ngo-label">Pool membership</p>

              {poolKeys.length === 0 ? (
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-lo)" }}>Load regions to see pools.</p>
              ) : poolAggregate.loading ? (
                <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>Loading…</p>
              ) : (
                <div style={{
                  display: "flex", gap: 0,
                  border: "1px solid var(--border-faint)", borderRadius: 7, overflow: "hidden",
                  backgroundColor: "var(--surface)",
                }}>
                  {[
                    { label: "Available", value: poolAggregate.net.toLocaleString(undefined, { maximumFractionDigits: 0 }), unit: "USDC" },
                    { label: "Total donated", value: poolAggregate.donated.toLocaleString(undefined, { maximumFractionDigits: 0 }), unit: "USDC" },
                    { label: "Total members", value: String(poolAggregate.totalMembers), unit: null },
                  ].map(({ label, value, unit }, i) => (
                    <div key={label} style={{
                      flex: 1, padding: "12px 14px",
                      borderLeft: i > 0 ? "1px solid var(--border-faint)" : "none",
                    }}>
                      <p style={{ ...subLabel, marginBottom: 4 }}>{label}</p>
                      <span style={{
                        fontFamily: "var(--font-mono)", fontSize: "var(--fs-body)", color: "var(--text-hi)",
                        fontVariantNumeric: "tabular-nums lining-nums",
                      }}>
                        {value}
                        {unit && <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)", marginLeft: 3 }}>{unit}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>}
      </main>

    </div>
  );
}

export function NgoDashboardClient() {
  return (
    <Web3Provider theme={darkTheme()}>
      <NgoDashboardInner />
    </Web3Provider>
  );
}
