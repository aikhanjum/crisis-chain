"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Web3Provider } from "@/providers/Web3Provider";
import { API_GATEWAY_URL } from "@/lib/constants";
import { shortenAddress } from "@/lib/wallet-utils";

const NAV = [
  { href: "/ngo/dashboard", label: "Dashboard" },
  { href: "/ngo/submit", label: "Submit Receipt" },
  { href: "/ngo/register", label: "Register" },
] as const;

function RegisterInner() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();

  const [orgName, setOrgName] = useState("");
  const [country, setCountry] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [regions, setRegions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !orgName) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_GATEWAY_URL}/ngo/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName,
          country: country || null,
          regNumber: regNumber || null,
          contactEmail: contactEmail || null,
          regions: regions ? regions.split(",").map((s) => s.trim()).filter(Boolean) : null,
          walletAddress: address,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

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

  return (
    <div>
      <header className="fu fu-1" style={{ position: "sticky", top: 0, zIndex: 40, backgroundColor: "var(--surface)", borderBottom: "1px solid var(--border-faint)" }}>
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
          <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
        </div>
      </header>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "56px 32px 96px" }}>
        <div className="fu fu-1">
          <h1 style={{ fontSize: "1.375rem", fontWeight: 600, color: "var(--text-hi)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
            Register your NGO
          </h1>
          <p style={{ fontSize: "1rem", color: "var(--text-mid)", lineHeight: 1.6, marginTop: 8 }}>
            Connect your wallet and provide organisation details. An admin will review and whitelist your address for pool access.
          </p>
        </div>

        {!isConnected ? (
          <div className="fu fu-2" style={{ marginTop: 28, padding: 24, textAlign: "center", border: "1px solid var(--border-faint)", borderRadius: 10, backgroundColor: "var(--surface)" }}>
            <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-body)", marginBottom: 12 }}>Connect your wallet to begin registration.</p>
            <ConnectButton />
          </div>
        ) : success ? (
          <div className="fu fu-2" style={{ marginTop: 28, padding: 28, textAlign: "center", border: "1px solid var(--fulfilled-border)", borderRadius: 10, backgroundColor: "var(--fulfilled-bg)" }}>
            <CheckCircle2 style={{ width: 32, height: 32, color: "var(--fulfilled)", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--fulfilled)", fontSize: "var(--fs-body)", fontWeight: 600 }}>Application received</p>
            <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-ui)", marginTop: 8 }}>An admin will review your registration and approve your wallet for pool access.</p>
            <Link href="/ngo/dashboard" style={{ display: "inline-block", marginTop: 16, fontSize: "var(--fs-ui)", color: "var(--accent-text)", fontWeight: 500 }}>Go to dashboard →</Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="fu fu-2" style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Wallet address</label>
              <div style={{ ...inputStyle, backgroundColor: "var(--bg)", color: "var(--text-lo)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-sm)" }}>{shortenAddress(address)}</div>
            </div>
            <div>
              <label htmlFor="org-name" style={labelStyle}>Organisation name <span style={{ color: "var(--open)" }}>*</span></label>
              <input id="org-name" required value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Doctors Without Borders" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="country" style={labelStyle}>Country of operation</label>
              <input id="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Sudan" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="reg-number" style={labelStyle}>Registration / charity number</label>
              <input id="reg-number" value={regNumber} onChange={(e) => setRegNumber(e.target.value)} placeholder="e.g. CH-12345" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="email" style={labelStyle}>Contact email</label>
              <input id="email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="admin@ngo.org" style={inputStyle} />
            </div>
            <div>
              <label htmlFor="regions" style={labelStyle}>Regions operated in (comma-separated)</label>
              <input id="regions" value={regions} onChange={(e) => setRegions(e.target.value)} placeholder="SDN-DARFUR-2024, HTI-PORT-2024" style={inputStyle} />
            </div>
            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 6, border: "1px solid var(--open-border)", backgroundColor: "var(--open-bg)", color: "var(--open)", fontSize: "var(--fs-body)" }}>{error}</div>
            )}
            <button type="submit" className="ngo-cta" disabled={!orgName || submitting}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 20px", borderRadius: 5, backgroundColor: !orgName ? "var(--border)" : "var(--accent)", color: !orgName ? "var(--text-vlo)" : "var(--accent-fg)", fontSize: "var(--fs-body)", fontWeight: 600, border: "none", cursor: !orgName || submitting ? "not-allowed" : "pointer" }}>
              {submitting ? (<><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />Submitting…</>) : "Submit application"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function NgoRegisterClient() {
  return (
    <Web3Provider>
      <RegisterInner />
    </Web3Provider>
  );
}
