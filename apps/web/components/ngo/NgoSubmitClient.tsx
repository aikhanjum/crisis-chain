"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import { darkTheme } from "@rainbow-me/rainbowkit";
import { Web3Provider } from "@/providers/Web3Provider";
import { API_GATEWAY_URL } from "@/lib/constants";
import { useNgoAuth, useEmailAuth } from "@/hooks/useWallet";
import { useCrisisRegions } from "@/hooks/useCrisisRegions";

const NAV = [
  { href: "/ngo/dashboard", label: "Dashboard" },
  { href: "/ngo/submit", label: "Submit Receipt" },
  { href: "/ngo/register", label: "Register" },
] as const;

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 5,
  border: "1px solid var(--border)", backgroundColor: "var(--surface)",
  fontSize: "var(--fs-body)", color: "var(--text-hi)",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "var(--fs-xs)", fontWeight: 600,
  textTransform: "uppercase", letterSpacing: "0.07em",
  color: "var(--text-vlo)", marginBottom: 5,
};

function SubmitInner() {
  const pathname = usePathname();
  const walletAuth = useNgoAuth();
  const emailAuth = useEmailAuth();
  const token = walletAuth.token ?? emailAuth.token;
  const isAuthenticated = walletAuth.isAuthenticated || emailAuth.isAuthenticated;

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const { data: allRegions = [], isLoading: regionsLoading } = useCrisisRegions();
  const [operatedRegions, setOperatedRegions] = useState<string[] | null>(null);

  // Fetch the NGO profile to get operated_regions once authenticated
  useEffect(() => {
    if (!token) return;
    fetch(`${API_GATEWAY_URL}/ngo/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((body: { operated_regions?: string[] }) => {
        if (Array.isArray(body.operated_regions)) setOperatedRegions(body.operated_regions);
      })
      .catch(() => setOperatedRegions(null));
  }, [token]);

  // Only show regions the NGO operates in; fall back to all if profile unavailable
  const regions =
    operatedRegions && operatedRegions.length > 0
      ? allRegions.filter((r) => operatedRegions.includes(r.id))
      : allRegions;

  const [regionId, setRegionId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ receipt_id: string; submitted_at: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_GATEWAY_URL}/ngo/receipt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ region_id: regionId, amount: Number(amount), notes }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setSuccess(body as { receipt_id: string; submitted_at: string });
      setAmount("");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <header
        className="fu fu-1"
        style={{ position: "sticky", top: 0, zIndex: 40, backgroundColor: "var(--surface)", borderBottom: "1px solid var(--border-faint)" }}
      >
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 32px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 20 }}>
              <span style={{ fontSize: "var(--fs-brand)", fontWeight: 600, color: "var(--text-hi)" }}>CrisisChain</span>
              <span style={{ color: "var(--border-mid)", fontSize: "var(--fs-sm)" }}>/</span>
              <span style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)" }}>NGO Portal</span>
            </div>
            <div style={{ width: 1, height: 18, backgroundColor: "var(--border)", marginRight: 20 }} />
            <nav style={{ display: "flex", gap: 2 }}>
              {NAV.map(({ href, label }) => (
                <Link key={href} href={href} className={`ngo-nav-link${pathname === href ? " ngo-nav-link-active" : ""}`}>{label}</Link>
              ))}
            </nav>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
            {!isAuthenticated && (
              <button
                type="button"
                className="ngo-cta"
                style={{ padding: "7px 12px", borderRadius: 5, backgroundColor: "var(--bg)", color: "var(--text-mid)", fontSize: "var(--fs-ui)", fontWeight: 600, border: "1px solid var(--border)", cursor: "pointer" }}
                onClick={() => setShowEmailForm((v) => !v)}
              >
                {showEmailForm ? "Cancel" : "Email sign in"}
              </button>
            )}
            {isAuthenticated && (
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fulfilled)", padding: "4px 10px", border: "1px solid var(--fulfilled-border)", borderRadius: 5, backgroundColor: "var(--fulfilled-bg)" }}>
                Authenticated
              </span>
            )}
          </div>
        </div>

        {showEmailForm && !isAuthenticated && (
          <form
            onSubmit={onEmailSignIn}
            style={{ maxWidth: 1160, margin: "0 auto", padding: "8px 32px", display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border-faint)" }}
          >
            <input type="email" required placeholder="Email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 5, border: "1px solid var(--border)", backgroundColor: "var(--bg)", color: "var(--text-hi)", fontSize: "var(--fs-ui)", width: 200 }} />
            <input type="password" required placeholder="Password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 5, border: "1px solid var(--border)", backgroundColor: "var(--bg)", color: "var(--text-hi)", fontSize: "var(--fs-ui)", width: 160 }} />
            <button type="submit" disabled={emailAuth.loading}
              style={{ padding: "7px 14px", borderRadius: 5, backgroundColor: "var(--accent)", color: "var(--accent-fg)", fontSize: "var(--fs-ui)", fontWeight: 600, border: "none", cursor: emailAuth.loading ? "wait" : "pointer" }}>
              {emailAuth.loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
        {authError && (
          <p style={{ maxWidth: 1160, margin: "0 auto", padding: "0 32px 8px", fontSize: "var(--fs-xs)", color: "var(--open)" }}>{authError}</p>
        )}
      </header>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "56px 32px 96px" }}>
        <div className="fu fu-1">
          <h1 style={{ fontSize: "1.375rem", fontWeight: 600, color: "var(--text-hi)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
            Submit reimbursement request
          </h1>
          <p style={{ fontSize: "1rem", color: "var(--text-mid)", lineHeight: 1.6, marginTop: 8 }}>
            Enter the amount you need reimbursed and a brief description. An admin will review and approve before payout.
          </p>
        </div>

        {!isAuthenticated ? (
          <div className="fu fu-2" style={{ marginTop: 28, padding: 24, textAlign: "center", border: "1px solid var(--border-faint)", borderRadius: 10, backgroundColor: "var(--surface)" }}>
            <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-body)", marginBottom: 4 }}>Sign in to submit a request.</p>
            <p style={{ color: "var(--text-vlo)", fontSize: "var(--fs-xs)" }}>Use "Email sign in" in the header, or connect your wallet.</p>
          </div>
        ) : success ? (
          <div className="fu fu-2" style={{ marginTop: 28, padding: 28, textAlign: "center", border: "1px solid var(--fulfilled-border)", borderRadius: 10, backgroundColor: "var(--fulfilled-bg)" }}>
            <CheckCircle2 style={{ width: 32, height: 32, color: "var(--fulfilled)", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--fulfilled)", fontSize: "var(--fs-body)", fontWeight: 600 }}>Request submitted</p>
            <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-ui)", marginTop: 8 }}>
              ID: <span style={{ fontFamily: "var(--font-mono)" }}>{success.receipt_id.slice(0, 8)}…</span>
            </p>
            <div style={{ marginTop: 16, display: "flex", gap: 12, justifyContent: "center" }}>
              <button type="button" onClick={() => setSuccess(null)}
                style={{ fontSize: "var(--fs-ui)", color: "var(--accent-text)", fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>
                Submit another
              </button>
              <Link href="/ngo/dashboard" style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)" }}>View dashboard →</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="fu fu-2" style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
                <label htmlFor="region" style={{ ...labelStyle, marginBottom: 0 }}>Region <span style={{ color: "var(--open)" }}>*</span></label>
                {operatedRegions && operatedRegions.length > 0 && (
                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>limited to your approved regions</span>
                )}
              </div>
              <select
                id="region"
                required
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                style={{ ...inputStyle, appearance: "none" }}
              >
                <option value="">— Select a region —</option>
                {regionsLoading && <option disabled>Loading…</option>}
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.country})</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="amount" style={labelStyle}>Amount (USDC) <span style={{ color: "var(--open)" }}>*</span></label>
              <input
                id="amount"
                type="number"
                required
                min="0.01"
                step="0.01"
                placeholder="e.g. 250.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="notes" style={labelStyle}>Description</label>
              <input
                id="notes"
                type="text"
                placeholder="e.g. 50 water filters, 20 first aid kits"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 6, border: "1px solid var(--open-border)", backgroundColor: "var(--open-bg)", color: "var(--open)", fontSize: "var(--fs-body)" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!regionId || !amount || submitting}
              className="ngo-cta"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 20px", borderRadius: 5, backgroundColor: !regionId || !amount ? "var(--border)" : "var(--accent)", color: !regionId || !amount ? "var(--text-vlo)" : "var(--accent-fg)", fontSize: "var(--fs-body)", fontWeight: 600, border: "none", cursor: !regionId || !amount || submitting ? "not-allowed" : "pointer" }}
            >
              {submitting
                ? (<><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />Submitting…</>)
                : "Submit request"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function NgoSubmitClient() {
  return (
    <Web3Provider theme={darkTheme()}>
      <SubmitInner />
    </Web3Provider>
  );
}
