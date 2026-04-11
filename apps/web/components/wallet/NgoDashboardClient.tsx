"use client";

import { ConnectButton, darkTheme } from "@rainbow-me/rainbowkit";
import { useQueries, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, CircleDot, Clock, Plus } from "lucide-react";
import { useCallback, useMemo, useState, useEffect } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";

import { Web3Provider } from "@/providers/Web3Provider";
import { API_GATEWAY_URL, CHAIN_ID, EXPLORER_BASE_URL, USDC_ADDRESS, USDC_DECIMALS, VAULT_ADDRESS } from "@/lib/constants";
import { humanityTestnet } from "@/lib/humanity";
import { erc20Abi, vaultAbi, toBytes32 } from "@/lib/wallet-contracts";
import { getNgoQueue, getPoolLedger, markReceiptPaid, type CrisisRegion, type NgoReceiptRequest } from "@/lib/api";
import { poolIdFromRegionId } from "@/lib/wallet-utils";
import { useCrisisRegions } from "@/hooks/useCrisisRegions";
import { useNgoAuth, useEmailAuth } from "@/hooks/useWallet";
import { NgoHeader } from "@/components/ngo/NgoHeader";

type UiStatus = "open" | "pending" | "fulfilled" | "rejected";

const COL = "3.5rem 4rem 1fr 8.5rem 8rem 5.5rem 2.5rem";

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

function StatusIcon({ status, className }: { status: UiStatus; className?: string }) {
  const s = { style: { width: 8, height: 8 }, className };
  if (status === "open") return <CircleDot {...s} />;
  if (status === "pending" || status === "rejected") return <Clock {...s} />;
  return <CheckCircle2 {...s} />;
}

function mapReceiptStatus(s: NgoReceiptRequest["status"]): UiStatus {
  if (s === "pending") return "open";
  if (s === "approved") return "pending";
  if (s === "paid") return "fulfilled";
  return "rejected";
}

function chipLabel(status: UiStatus) {
  if (status === "open") return "Open";
  if (status === "pending") return "Pending";
  if (status === "rejected") return "Rejected";
  return "Fulfilled";
}

function poolKeyForRegion(r: CrisisRegion): string {
  return r.poolId && r.poolId.length > 0 ? r.poolId : poolIdFromRegionId(r.id);
}

function NgoDashboardInner() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const walletAuth = useNgoAuth();
  const emailAuth = useEmailAuth();
  const token = walletAuth.token ?? emailAuth.token;
  const isAuthenticated = walletAuth.isAuthenticated || emailAuth.isAuthenticated;
  function logout() { walletAuth.logout(); emailAuth.logout(); }
  const [authError, setAuthError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const { data: allRegions = [], isLoading: regionsLoading, error: regionsError } = useCrisisRegions();
  const [operatedRegions, setOperatedRegions] = useState<string[] | null>(null);

  useEffect(() => {
    if (!token) { setOperatedRegions(null); return; }
    fetch(`${API_GATEWAY_URL}/ngo/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((body: { operated_regions?: string[] }) => {
        if (Array.isArray(body.operated_regions) && body.operated_regions.length > 0) {
          setOperatedRegions(body.operated_regions);
        } else {
          setOperatedRegions(null);
        }
      })
      .catch(() => setOperatedRegions(null));
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

  const { data: usdcBalance = 0n } = useReadContract({
    address: USDC_ADDRESS || undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(USDC_ADDRESS && address) },
  });

  const isConfigured = Boolean(USDC_ADDRESS && VAULT_ADDRESS);

  const onPay = useCallback(async (receipt: NgoReceiptRequest) => {
    if (!publicClient || !VAULT_ADDRESS || !token) return;
    setPayError(null);
    setPaySuccess(null);
    setPayingId(receipt.id);
    try {
      if (!isConnected) throw new Error("Connect wallet first");
      if (chainId !== CHAIN_ID) {
        await switchChainAsync({ chainId: humanityTestnet.id });
      }

      const poolId = poolIdFromRegionId(receipt.region_id);
      const amountBase = parseUnits(String(receipt.requested_amount), USDC_DECIMALS);
      const payoutRef = toBytes32(receipt.id.slice(0, 31));

      const hash = await writeContractAsync({
        address: VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: "payout",
        args: [BigInt(poolId), receipt.ngo_wallet as `0x${string}`, amountBase, payoutRef],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await markReceiptPaid(receipt.id, hash, token);
      setPaySuccess(`Paid! tx: ${hash.slice(0, 10)}…`);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payout failed");
    } finally {
      setPayingId(null);
    }
  }, [publicClient, writeContractAsync, isConnected, chainId, switchChainAsync, token]);
  const isWrongNetwork = isConnected && chainId !== CHAIN_ID;

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
          status: "fulfilled",
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
          usdc: Number(r.requested_amount),
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
      let open = 0;
      let pending = 0;
      let fulfilled = 0;
      for (const r of queue) {
        if (r.status === "pending") open += 1;
        else if (r.status === "approved") pending += 1;
        else if (r.status === "paid") fulfilled += 1;
      }
      return { open, pending, fulfilled };
    }
    const fulfilled = onChainPayouts.length;
    return { open: 0, pending: 0, fulfilled };
  }, [isAuthenticated, queue, onChainPayouts]);

  const totalRequests = counts.open + counts.pending + counts.fulfilled;

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

  const ipcHint = primaryRegion ? IPC_STYLE[primaryRegion.severityLevel] : null;
  const ipc = ipcHint ? IPC[ipcHint.key] : IPC[3];

  async function onSignIn() {
    setAuthError(null);
    try {
      await walletAuth.login();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Sign-in failed");
    }
  }

  async function onEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    try {
      await emailAuth.login(emailInput, passwordInput);
      setShowEmailForm(false);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign-in failed");
    }
  }

  const balanceLabel =
    USDC_ADDRESS && isConnected && address
      ? `${Number(formatUnits(usdcBalance, USDC_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
      : null;

  const headerRight = (
    <>
      {!isConfigured && (
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--pending)" }}>Contracts not configured</span>
      )}
      {isWrongNetwork && (
        <button
          type="button"
          className="ngo-cta"
          style={{
            padding: "6px 12px",
            borderRadius: 5,
            backgroundColor: "var(--pending-bg)",
            color: "var(--pending)",
            fontSize: "var(--fs-xs)",
            fontWeight: 600,
            border: "1px solid var(--pending-border)",
            cursor: "pointer",
          }}
          onClick={() => switchChainAsync({ chainId: humanityTestnet.id })}
        >
          Switch network
        </button>
      )}
      <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
      {balanceLabel ? (
        <span
          style={{
            fontSize: "var(--fs-xs)",
            color: "var(--text-vlo)",
            fontFamily: "var(--font-mono)",
            whiteSpace: "nowrap",
          }}
        >
          {balanceLabel}
        </span>
      ) : null}
      {!isAuthenticated ? (
        <>
          {isConnected && (
            <button
              type="button"
              className="ngo-cta"
              style={{ padding: "7px 12px", borderRadius: 5, backgroundColor: "var(--bg)", color: "var(--text-mid)", fontSize: "var(--fs-ui)", fontWeight: 600, border: "1px solid var(--border)", cursor: walletAuth.loading ? "wait" : "pointer" }}
              disabled={walletAuth.loading}
              onClick={() => onSignIn()}
            >
              {walletAuth.loading ? "Signing…" : "Sign in with wallet"}
            </button>
          )}
          <button
            type="button"
            className="ngo-cta"
            style={{ padding: "7px 12px", borderRadius: 5, backgroundColor: "var(--bg)", color: "var(--text-mid)", fontSize: "var(--fs-ui)", fontWeight: 600, border: "1px solid var(--border)", cursor: "pointer" }}
            onClick={() => setShowEmailForm((v) => !v)}
          >
            {showEmailForm ? "Cancel" : "Email sign in"}
          </button>
        </>
      ) : null}
      {isAuthenticated && (
        <button
          type="button"
          className="ngo-cta"
          style={{ padding: "7px 12px", borderRadius: 5, backgroundColor: "var(--bg)", color: "var(--text-lo)", fontSize: "var(--fs-ui)", fontWeight: 600, border: "1px solid var(--border)", cursor: "pointer" }}
          onClick={logout}
        >
          Sign out
        </button>
      )}
      <Link href="/ngo/submit">
        <button
          type="button"
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
    </>
  );

  return (
    <div>
      <NgoHeader rightSlot={headerRight} />

      {showEmailForm && !isAuthenticated ? (
        <div style={{ position: "sticky", top: 56, zIndex: 39, backgroundColor: "var(--surface)", borderBottom: "1px solid var(--border-faint)" }}>
          <form
            onSubmit={onEmailSignIn}
            style={{ maxWidth: 1160, margin: "0 auto", padding: "8px 32px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
          >
            <input
              type="email"
              required
              placeholder="Email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 5, border: "1px solid var(--border)", backgroundColor: "var(--bg)", color: "var(--text-hi)", fontSize: "var(--fs-ui)", width: 200 }}
            />
            <input
              type="password"
              required
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 5, border: "1px solid var(--border)", backgroundColor: "var(--bg)", color: "var(--text-hi)", fontSize: "var(--fs-ui)", width: 160 }}
            />
            <button
              type="submit"
              disabled={emailAuth.loading}
              style={{ padding: "7px 14px", borderRadius: 5, backgroundColor: "var(--accent)", color: "var(--accent-fg)", fontSize: "var(--fs-ui)", fontWeight: 600, border: "none", cursor: emailAuth.loading ? "wait" : "pointer" }}
            >
              {emailAuth.loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          {authError ? (
            <p style={{ maxWidth: 1160, margin: "0 auto", padding: "0 32px 8px", fontSize: "var(--fs-xs)", color: "var(--open)" }}>
              {authError}
            </p>
          ) : null}
        </div>
      ) : null}

      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "36px 32px 96px" }}>
        {!isAuthenticated && (
          <div style={{ padding: "48px 24px", textAlign: "center", border: "1px solid var(--border-faint)", borderRadius: 10, backgroundColor: "var(--surface)" }}>
            <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-hi)", marginBottom: 8 }}>Sign in to access the NGO dashboard</p>
            <p style={{ fontSize: "var(--fs-body)", color: "var(--text-lo)", marginBottom: 20 }}>Use your wallet or click &quot;Email sign in&quot; in the header.</p>
            <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>Demo: test@crisischain.org / demo1234</p>
          </div>
        )}
        {isAuthenticated && (<section className="fu fu-2" style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <p className="ngo-label" style={{ marginBottom: 0 }}>
              Region Overview
            </p>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>Crisis nodes API</span>
          </div>

          {regionsError ? (
            <p style={{ color: "var(--open)", fontSize: "var(--fs-ui)" }}>Could not load regions. Is the API gateway running?</p>
          ) : regionsLoading && !primaryRegion ? (
            <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-ui)" }}>Loading region data…</p>
          ) : !primaryRegion ? (
            <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-ui)" }}>No crisis regions in the database yet.</p>
          ) : (
            <div
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border-faint)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--border-faint)",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--fs-body)",
                    fontWeight: 600,
                    color: "var(--text-hi)",
                    letterSpacing: "-0.005em",
                  }}
                >
                  {primaryRegion.name}
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
                  IPC {ipcHint?.phase} — {ipcHint?.label}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  borderBottom: "1px solid var(--border-faint)",
                }}
              >
                <div style={{ padding: "18px 20px", borderRight: "1px solid var(--border-faint)" }}>
                  <p style={subLabel}>Active NGOs</p>
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
                      {primaryRegion.activeNgos}
                    </span>
                  </div>
                </div>

                <div style={{ padding: "18px 20px", borderRight: "1px solid var(--border-faint)" }}>
                  <p style={subLabel}>Severity score</p>
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
                      {primaryRegion.severityScore.toFixed(1)}
                    </span>
                    <span style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)" }}>/&nbsp;100</span>
                  </div>
                  <p style={{ marginTop: 4, fontSize: "var(--fs-xs)", color: "var(--text-lo)" }}>
                    {primaryRegion.severityLevel.replace(/^\w/, (c) => c.toUpperCase())} · CrisisChain index
                  </p>
                </div>

                <div style={{ padding: "18px 20px" }}>
                  <p style={subLabel}>Summary</p>
                  <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-mid)", lineHeight: 1.45, margin: 0 }}>
                    {summaryExpanded ? primaryRegion.summary : primaryRegion.summary.slice(0, 220)}
                    {!summaryExpanded && primaryRegion.summary.length > 220 ? "…" : ""}
                  </p>
                  {primaryRegion.summary.length > 220 && (
                    <button
                      onClick={() => setSummaryExpanded((v) => !v)}
                      style={{
                        marginTop: 6,
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        fontSize: "var(--fs-xs)",
                        color: "var(--accent-text)",
                        fontWeight: 500,
                      }}
                    >
                      {summaryExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 20px",
                }}
              >
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>
                  Pool key {poolKeyForRegion(primaryRegion)} · Updated {new Date(primaryRegion.lastUpdated).toLocaleDateString()}
                </span>
                <Link
                  href={`/donate/${primaryRegion.id}`}
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
                  Open donate page
                  <ArrowUpRight style={{ width: 13, height: 13 }} />
                </Link>
              </div>
            </div>
          )}
        </section>)}
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
                  <span style={{ textAlign: "center" }}>Action</span>
                  <span />
                </div>

                {tableRows.map((tx, i) => (
                  <div
                    key={`${tx.id}-${i}`}
                    className="ngo-tx"
                    style={{
                      display: "grid",
                      gridTemplateColumns: COL,
                      padding: "13px 20px",
                      borderBottom: i < tableRows.length - 1 ? "1px solid var(--border-faint)" : "none",
                      alignItems: "center",
                      backgroundColor: "var(--surface)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--fs-xs)",
                        color: "var(--text-vlo)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {tx.id}
                    </span>
                    <span style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)" }}>{tx.date}</span>
                    <span
                      style={{
                        fontSize: "var(--fs-body)",
                        color: "var(--text-mid)",
                        paddingRight: 20,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tx.desc}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--fs-body)",
                        color: "var(--text-hi)",
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums lining-nums",
                      }}
                    >
                      {tx.usdc.toFixed(2)}
                      <span style={{ color: "var(--text-vlo)", fontSize: "var(--fs-xs)", marginLeft: 4 }}>USDC</span>
                    </span>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <span className={`chip chip-${tx.status === "rejected" ? "open" : tx.status}`}>
                        <StatusIcon status={tx.status} />
                        {chipLabel(tx.status)}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      {tx.rawReceipt && tx.rawReceipt.status === "pending" ? (
                        <button
                          disabled={payingId === tx.rawReceipt.id || !isConnected}
                          onClick={() => tx.rawReceipt && onPay(tx.rawReceipt)}
                          style={{
                            padding: "4px 12px",
                            fontSize: "var(--fs-xs)",
                            fontWeight: 600,
                            borderRadius: 5,
                            border: "none",
                            cursor: payingId ? "not-allowed" : "pointer",
                            backgroundColor: "var(--accent)",
                            color: "var(--accent-fg)",
                          }}
                        >
                          {payingId === tx.rawReceipt.id ? "Paying…" : "Pay"}
                        </button>
                      ) : (
                        <span style={{ color: "var(--text-vlo)", fontSize: "var(--fs-xs)" }}>
                          {tx.rawReceipt?.status === "paid" ? "Paid" : "—"}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      {tx.tx ? (
                        <a
                          href={`${EXPLORER_BASE_URL.replace(/\/$/, "")}/tx/${tx.tx}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--accent-text)" }}
                          title="View on explorer"
                        >
                          <ArrowUpRight style={{ width: 14, height: 14 }} />
                        </a>
                      ) : (
                        <span style={{ color: "var(--text-vlo)" }}>—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {payError && (
              <p style={{ marginTop: 8, fontSize: "var(--fs-xs)", color: "var(--error)" }}>{payError}</p>
            )}
            {paySuccess && (
              <p style={{ marginTop: 8, fontSize: "var(--fs-xs)", color: "var(--success)" }}>{paySuccess}</p>
            )}

            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <span style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)" }}>
                Tracked requests: {totalRequests}
                {isAuthenticated ? "" : " (sign in for receipt queue)"}
              </span>
            </div>
          </section>

          <aside style={{ display: "flex", flexDirection: "column", gap: 24, position: "sticky", top: 78 }}>
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
                {(["open", "pending", "fulfilled"] as const).map((s, i) => (
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
                      {counts[s]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="fu fu-5">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <p className="ngo-label" style={{ marginBottom: 0 }}>
                  Pool membership
                </p>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div
                      style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: "var(--pool-committed)", flexShrink: 0 }}
                    />
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-lo)" }}>Paid out</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: "var(--pool-in)", flexShrink: 0 }} />
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-lo)" }}>In pool</span>
                  </div>
                </div>
              </div>

              {poolKeys.length === 0 ? (
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-lo)" }}>Load regions to see pools.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {poolCards.map((pool) => {
                    const committedPct = pool.total > 0 ? (pool.committed / pool.total) * 100 : 0;
                    const inPoolPct = pool.total > 0 ? 100 - committedPct : 0;

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

                        {pool.error ? (
                          <p style={{ fontSize: "var(--fs-xs)", color: "var(--open)" }}>{pool.error}</p>
                        ) : pool.loading ? (
                          <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>Loading indexer…</p>
                        ) : (
                          <>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                              <div>
                                <p style={{ ...subLabel, color: "var(--pool-committed)" }}>Paid out</p>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                                  <span
                                    style={{
                                      fontFamily: "var(--font-mono)",
                                      fontSize: "var(--fs-ui)",
                                      fontWeight: 600,
                                      color: "var(--text-hi)",
                                      fontVariantNumeric: "tabular-nums lining-nums",
                                    }}
                                  >
                                    {pool.committed.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                  </span>
                                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>USDC</span>
                                </div>
                              </div>
                              <div>
                                <p style={{ ...subLabel, color: "var(--pool-in)" }}>In pool</p>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                                  <span
                                    style={{
                                      fontFamily: "var(--font-mono)",
                                      fontSize: "var(--fs-ui)",
                                      fontWeight: 600,
                                      color: "var(--text-hi)",
                                      fontVariantNumeric: "tabular-nums lining-nums",
                                    }}
                                  >
                                    {(pool.total - pool.committed).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                  </span>
                                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>USDC</span>
                                </div>
                              </div>
                            </div>

                            <div style={{ height: 5, borderRadius: 999, display: "flex", overflow: "hidden" }}>
                              <div style={{ width: `${committedPct}%`, backgroundColor: "var(--pool-committed)", flexShrink: 0 }} />
                              <div style={{ width: `${inPoolPct}%`, backgroundColor: "var(--pool-in)", flexShrink: 0 }} />
                            </div>

                            <p style={{ marginTop: 7, fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>
                              {pool.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC donated (indexed)
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })}
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
