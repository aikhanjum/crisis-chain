"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CheckCircle2, Loader2, Wallet } from "lucide-react";
import { formatUnits } from "viem";

import { darkTheme } from "@rainbow-me/rainbowkit";
import { Web3Provider } from "@/providers/Web3Provider";
import { API_GATEWAY_URL, USDC_ADDRESS, USDC_DECIMALS, VAULT_ADDRESS } from "@/lib/constants";
import { erc20Abi } from "@/lib/wallet-contracts";
import { shortenAddress } from "@/lib/wallet-utils";
import { useNgoAuth } from "@/hooks/useWallet";
import { useCrisisRegions } from "@/hooks/useCrisisRegions";
import { NgoHeader } from "@/components/ngo/NgoHeader";
import { NgoWalletButton } from "@/components/ngo/NgoWalletButton";

function RegisterInner() {
  const { address, isConnected } = useAccount();
  const walletAuth = useNgoAuth();
  const isAuthenticated = walletAuth.isAuthenticated;
  const isConfigured = Boolean(USDC_ADDRESS && VAULT_ADDRESS);

  const [authError, setAuthError] = useState<string | null>(null);

  const { data: allRegions = [] } = useCrisisRegions();

  const { data: usdcBalance = 0n } = useReadContract({
    address: USDC_ADDRESS || undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(USDC_ADDRESS && address) },
  });
  const balanceLabel = USDC_ADDRESS && isConnected && address
    ? `${Number(formatUnits(usdcBalance, USDC_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
    : null;

  async function onSignIn() {
    setAuthError(null);
    try { await walletAuth.login(); }
    catch (e) { setAuthError(e instanceof Error ? e.message : "Sign-in failed"); }
  }

  function logout() { walletAuth.logout(); }

  const [orgName, setOrgName] = useState("");
  const [country, setCountry] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
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
          regions: selectedRegions.length > 0 ? selectedRegions : null,
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
    width: "100%",
    padding: "10px 12px",
    borderRadius: 7,
    border: "1px solid var(--border)",
    backgroundColor: "var(--surface)",
    fontSize: "var(--fs-body)",
    color: "var(--text-hi)",
    boxShadow: "var(--shadow-card)",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "var(--fs-xs)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "var(--text-vlo)",
    marginBottom: 5,
  };

  return (
    <div>
      <NgoHeader />

      <div style={{ maxWidth: 500, margin: "0 auto", padding: "48px 32px 96px" }}>

        {/* ── Wallet / Auth card ─────────────────────────────── */}
        <div className="fu fu-1 ngo-card" style={{ padding: "20px 24px", marginBottom: 32, display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ ...labelStyle, marginBottom: 0 }}>Wallet &amp; Session</p>
          <hr className="ngo-field-divider" />

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <NgoWalletButton />
            {!isConfigured && (
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--pending)" }}>Contracts not configured</span>
            )}
            {balanceLabel && (
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)", fontFamily: "var(--font-mono)" }}>{balanceLabel}</span>
            )}
          </div>

          {isConnected && !isAuthenticated && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="ngo-cta"
                style={{ padding: "6px 14px", borderRadius: 5, backgroundColor: "var(--bg)", color: "var(--text-mid)", fontSize: "var(--fs-ui)", fontWeight: 600, border: "1px solid var(--border)", cursor: walletAuth.loading ? "wait" : "pointer" }}
                disabled={walletAuth.loading}
                onClick={onSignIn}
              >
                {walletAuth.loading ? "Signing…" : "Sign in with wallet"}
              </button>
              {authError && <p style={{ width: "100%", fontSize: "var(--fs-xs)", color: "var(--open)", margin: 0 }}>{authError}</p>}
            </div>
          )}

          {isAuthenticated && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fulfilled)", padding: "3px 10px", border: "1px solid var(--fulfilled-border)", borderRadius: 5, backgroundColor: "var(--fulfilled-bg)" }}>
                Authenticated
              </span>
              <button
                type="button"
                className="ngo-cta"
                style={{ padding: "6px 14px", borderRadius: 5, backgroundColor: "var(--bg)", color: "var(--text-lo)", fontSize: "var(--fs-ui)", fontWeight: 600, border: "1px solid var(--border)", cursor: "pointer" }}
                onClick={logout}
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        <div className="fu fu-1" style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--text-hi)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Register your NGO
          </h1>
          <p style={{ fontSize: "var(--fs-body)", color: "var(--text-mid)", lineHeight: 1.6, marginTop: 8 }}>
            Connect your wallet and provide organisation details. An admin will review and whitelist your address for pool access.
          </p>
        </div>

        {!isConnected ? (
          <div
            className="fu fu-2 ngo-card"
            style={{
              padding: "40px 28px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "var(--accent-lo)",
                border: "1px solid var(--border-faint)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Wallet style={{ width: 22, height: 22, color: "var(--accent-text)" }} />
            </div>
            <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-body)", lineHeight: 1.5, textAlign: "center" }}>
              Connect your wallet to begin registration.
            </p>
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <button
                  type="button"
                  onClick={openConnectModal}
                  className="ngo-cta"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "11px 28px",
                    borderRadius: 7,
                    backgroundColor: "var(--accent)",
                    color: "var(--accent-fg)",
                    fontSize: "var(--fs-ui)",
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "var(--shadow-card)",
                  }}
                >
                  Connect Wallet
                </button>
              )}
            </ConnectButton.Custom>
          </div>
        ) : success ? (
          <div className="fu fu-1 ngo-card" style={{ padding: 36, textAlign: "center", borderColor: "var(--fulfilled-border)", backgroundColor: "var(--fulfilled-bg)" }}>
            <CheckCircle2 style={{ width: 48, height: 48, color: "var(--fulfilled)", margin: "0 auto 16px" }} />
            <p style={{ color: "var(--text-hi)", fontSize: "1.125rem", fontWeight: 600, letterSpacing: "-0.01em" }}>Application received</p>
            <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-body)", marginTop: 8, lineHeight: 1.6 }}>
              An admin will review your registration and approve your wallet for pool access.
            </p>
            <Link
              href="/ngo/dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginTop: 20,
                padding: "9px 20px",
                borderRadius: 7,
                backgroundColor: "var(--accent)",
                color: "var(--accent-fg)",
                fontSize: "var(--fs-ui)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Go to dashboard →
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="fu fu-2">
            {/* ── Identity ───────────────────────────────────── */}
            <div className="ngo-card" style={{ padding: "20px 24px", marginBottom: 16 }}>
              <p style={{ ...labelStyle, marginBottom: 12 }}>Wallet Identity</p>
              <div
                style={{
                  ...inputStyle,
                  backgroundColor: "var(--hero-bg)",
                  color: "var(--text-lo)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--fs-sm)",
                  cursor: "default",
                  boxShadow: "none",
                  border: "1px solid var(--border-faint)",
                }}
              >
                {shortenAddress(address)}
              </div>
            </div>

            {/* ── Organisation ───────────────────────────────── */}
            <div className="ngo-card" style={{ padding: "20px 24px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ ...labelStyle, marginBottom: 0 }}>Organisation</p>
              <hr className="ngo-field-divider" />
              <div>
                <label htmlFor="org-name" style={labelStyle}>
                  Name <span style={{ color: "var(--open)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>*</span>
                </label>
                <input
                  id="org-name"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Doctors Without Borders"
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="country" style={labelStyle}>Country of operation</label>
                <input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. Sudan"
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="reg-number" style={labelStyle}>Registration / charity number</label>
                <input
                  id="reg-number"
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  placeholder="e.g. CH-12345"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* ── Contact ────────────────────────────────────── */}
            <div className="ngo-card" style={{ padding: "20px 24px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ ...labelStyle, marginBottom: 0 }}>Contact &amp; Operations</p>
              <hr className="ngo-field-divider" />
              <div>
                <label htmlFor="email" style={labelStyle}>Contact email</label>
                <input
                  id="email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="admin@ngo.org"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Regions operated in</label>
                <div style={{
                  border: "1px solid var(--border)",
                  borderRadius: 7,
                  backgroundColor: "var(--surface)",
                  boxShadow: "var(--shadow-card)",
                  maxHeight: 220,
                  overflowY: "auto",
                  padding: "6px 4px",
                }}>
                  {allRegions.length === 0 ? (
                    <p style={{ padding: "8px 12px", margin: 0, fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>Loading regions…</p>
                  ) : (
                    allRegions.map((r) => {
                      const checked = selectedRegions.includes(r.id);
                      return (
                        <label
                          key={r.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "7px 12px",
                            borderRadius: 5,
                            cursor: "pointer",
                            backgroundColor: checked ? "var(--accent-lo)" : "transparent",
                            transition: "background-color 0.1s",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedRegions((prev) =>
                                prev.includes(r.id)
                                  ? prev.filter((id) => id !== r.id)
                                  : [...prev, r.id]
                              )
                            }
                            style={{ accentColor: "var(--accent)", width: 14, height: 14, flexShrink: 0 }}
                          />
                          <span style={{ fontSize: "var(--fs-body)", color: "var(--text-hi)" }}>{r.name}</span>
                          <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)", marginLeft: "auto" }}>{r.country}</span>
                        </label>
                      );
                    })
                  )}
                </div>
                {selectedRegions.length > 0 && (
                  <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)", marginTop: 6 }}>
                    {selectedRegions.length} region{selectedRegions.length > 1 ? "s" : ""} selected
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 7, border: "1px solid var(--open-border)", backgroundColor: "var(--open-bg)", color: "var(--open)", fontSize: "var(--fs-body)" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="ngo-cta"
              disabled={!orgName || submitting}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "13px 20px",
                borderRadius: 7,
                backgroundColor: !orgName ? "var(--border)" : "var(--accent)",
                color: !orgName ? "var(--text-vlo)" : "var(--accent-fg)",
                fontSize: "var(--fs-body)",
                fontWeight: 600,
                border: "none",
                cursor: !orgName || submitting ? "not-allowed" : "pointer",
                boxShadow: orgName ? "var(--shadow-card)" : "none",
              }}
            >
              {submitting
                ? <><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />Submitting…</>
                : "Submit application"
              }
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function NgoRegisterClient() {
  return (
    <Web3Provider theme={darkTheme()}>
      <RegisterInner />
    </Web3Provider>
  );
}
