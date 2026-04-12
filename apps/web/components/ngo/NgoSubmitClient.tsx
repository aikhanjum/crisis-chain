"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Loader2, Upload, FileText, Shield, Globe } from "lucide-react";

import { darkTheme } from "@rainbow-me/rainbowkit";
import { Web3Provider } from "@/providers/Web3Provider";
import { API_GATEWAY_URL, EXPLORER_BASE_URL } from "@/lib/constants";
import { useNgoAuth } from "@/hooks/useWallet";
import { useCrisisRegions } from "@/hooks/useCrisisRegions";
import { NgoHeader } from "@/components/ngo/NgoHeader";

// ── Fixed OCR demo data ────────────────────────────────────────────────────
// These values are used for every submission regardless of which image is
// uploaded. Update them here to change what the demo sends to the API.
const FIXED_OCR_TEXT = "HAND TOWEL 30x $2.97" + 
"GATORADE 10x $2.00" +
"T-SHIRT 5x $16.88" +
"PUSH PINS 100x$1.24" +
"CHANGE DUE $7.27";

const FIXED_TOTAL = "7.27";
// ──────────────────────────────────────────────────────────────────────────
import { useToast } from "@/components/ui/Toast";

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

type PipelineResult = {
  status: string;
  receiptId?: string;
  ocrResult: {
    approved_items: { name: string; quantity: number; total: number; category: string }[];
    flagged_items: { name: string; quantity: number; total: number; flag_reason: string }[];
    total_approved: number;
    ocrApproved: boolean;
  } | null;
  ipfsCid: string | null;
  claim: {
    claimId: string;
    txHash: string;
    attestations: string[];
    message: string;
  } | null;
  payout?: {
    onChain: boolean;
    txHash: string;
    recipient: string;
    amount: number;
  };
  pipeline?: {
    ocr: string;
    ipfs: string;
    onChain: string;
  };
};

function SubmitInner() {
  const walletAuth = useNgoAuth();
  const token = walletAuth.token;
  const isAuthenticated = walletAuth.isAuthenticated;
  const { showToast } = useToast();

  const { data: allRegions = [], isLoading: regionsLoading } = useCrisisRegions();
  const [operatedRegions, setOperatedRegions] = useState<string[] | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!token) { setOperatedRegions(null); return; }
    setProfileLoading(true);
    fetch(`${API_GATEWAY_URL}/ngo/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((body: { operated_regions?: string[] }) => {
        setOperatedRegions(Array.isArray(body.operated_regions) ? body.operated_regions : []);
      })
      .catch(() => setOperatedRegions([]))
      .finally(() => setProfileLoading(false));
  }, [token]);

  // Strictly restrict to NGO's operated regions only
  const regions = allRegions.filter((r) => operatedRegions?.includes(r.id));

  const [regionId, setRegionId] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState("");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !regionId) return;
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      setSubmitStage("Submitting request...");
      const res = await fetch(`${API_GATEWAY_URL}/ngo/receipt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          region_id: regionId,
          amount: Number(FIXED_TOTAL),
          notes: FIXED_OCR_TEXT,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setResult({ status: "queued", ocrResult: null, ipfsCid: null, claim: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
      setSubmitStage("");
    }
  }

  function reset() {
    setResult(null);
    setReceiptFile(null);
    setPreviewUrl(null);
    setError(null);
  }

  return (
    <div>
      <NgoHeader />

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "48px 32px 96px" }}>
        <div className="fu fu-1" style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--text-hi)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Submit delivery receipt
          </h1>
          <p style={{ fontSize: "var(--fs-body)", color: "var(--text-mid)", lineHeight: 1.6, marginTop: 8 }}>
            Upload a receipt photo for automatic verification. The system will OCR-parse the receipt, pin it to IPFS, and submit an on-chain delivery claim.
          </p>
        </div>

        {!isAuthenticated ? (
          <div className="fu fu-2" style={{ marginTop: 28, padding: 24, textAlign: "center", border: "1px solid var(--border-faint)", borderRadius: 10, backgroundColor: "var(--surface)" }}>
            <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-body)", marginBottom: 4 }}>Sign in to submit a receipt.</p>
            <p style={{ color: "var(--text-vlo)", fontSize: "var(--fs-xs)" }}>Connect your wallet and sign in using the button in the header.</p>
          </div>
        ) : result ? (
          <div className="fu fu-2" style={{ marginTop: 28 }}>
            {/* Success state with pipeline results */}
            <div style={{ padding: 28, border: `1px solid ${result.claim ? "var(--fulfilled-border)" : "var(--border)"}`, borderRadius: 10, backgroundColor: result.claim ? "var(--fulfilled-bg)" : "var(--surface)", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <CheckCircle2 style={{ width: 28, height: 28, color: "var(--fulfilled)" }} />
                <div>
                  <p style={{ color: result.claim ? "var(--fulfilled)" : "var(--text-hi)", fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>
                    {result.claim ? "Delivery claim submitted on-chain" : "Receipt saved"}
                  </p>
                  {result.receiptId && (
                    <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)", margin: "2px 0 0", fontFamily: "var(--font-mono)" }}>
                      ID: {result.receiptId.slice(0, 8)}…
                    </p>
                  )}
                </div>
              </div>

              {/* Pipeline status */}
              {result.pipeline && (
                <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                  {([
                    { key: "ocr", label: "OCR Parse", icon: FileText },
                    { key: "ipfs", label: "IPFS Pin", icon: Globe },
                    { key: "onChain", label: "On-chain Claim", icon: Shield },
                  ] as const).map(({ key, label, icon: Icon }) => {
                    const status = result.pipeline![key];
                    const ok = status !== "unavailable";
                    return (
                      <div key={key} style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "5px 10px", borderRadius: 5,
                        backgroundColor: ok ? "var(--fulfilled-bg)" : "var(--surface)",
                        border: `1px solid ${ok ? "var(--fulfilled-border)" : "var(--border-faint)"}`,
                        fontSize: "var(--fs-xs)", fontWeight: 600,
                        color: ok ? "var(--fulfilled)" : "var(--text-vlo)",
                      }}>
                        <Icon style={{ width: 12, height: 12 }} />
                        {label}: {ok ? status : "skipped"}
                      </div>
                    );
                  })}
                </div>
              )}

              {result.claim && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Shield style={{ width: 14, height: 14, color: "var(--text-lo)" }} />
                    <span style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)" }}>
                      Claim ID: <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-hi)" }}>{result.claim.claimId}</span>
                    </span>
                  </div>
                  {result.claim.attestations.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CheckCircle2 style={{ width: 14, height: 14, color: "var(--fulfilled)" }} />
                      <span style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)" }}>
                        Auto-attested: <span style={{ color: "var(--text-hi)" }}>{result.claim.attestations.join(", ")}</span>
                      </span>
                    </div>
                  )}
                  <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)", margin: 0 }}>
                    {result.claim.message}
                  </p>
                </div>
              )}

              {!result.claim && result.pipeline?.onChain === "unavailable" && (
                <p style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)", margin: "0 0 12px" }}>
                  Receipt saved to your dashboard. On-chain verification will run when the blockchain bridge is available.
                </p>
              )}

              {result.ocrResult && (
                <div style={{ borderTop: `1px solid ${result.claim ? "var(--fulfilled-border)" : "var(--border-faint)"}`, paddingTop: 12 }}>
                  <p style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--text-lo)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                    OCR Results
                  </p>
                  {result.ocrResult.approved_items.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      {result.ocrResult.approved_items.map((item, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-ui)", color: "var(--text-mid)", padding: "3px 0" }}>
                          <span>{item.name} x{item.quantity}</span>
                          <span style={{ fontFamily: "var(--font-mono)", color: "var(--fulfilled)" }}>${item.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.ocrResult.flagged_items.length > 0 && (
                    <div>
                      <p style={{ fontSize: "var(--fs-xs)", color: "var(--pending)", marginBottom: 4 }}>Flagged items:</p>
                      {result.ocrResult.flagged_items.map((item, i) => (
                        <div key={i} style={{ fontSize: "var(--fs-ui)", color: "var(--pending)", padding: "2px 0" }}>
                          {item.name} — {item.flag_reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {result.ipfsCid && (
                <div style={{ borderTop: `1px solid ${result.claim ? "var(--fulfilled-border)" : "var(--border-faint)"}`, paddingTop: 10, marginTop: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Globe style={{ width: 14, height: 14, color: "var(--text-lo)" }} />
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>
                      IPFS: <span style={{ fontFamily: "var(--font-mono)" }}>{result.ipfsCid}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button type="button" onClick={reset}
                style={{ fontSize: "var(--fs-ui)", color: "var(--accent-text)", fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>
                Submit another
              </button>
              <Link href="/ngo/dashboard" style={{ fontSize: "var(--fs-ui)", color: "var(--text-lo)" }}>View dashboard →</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="fu fu-2" style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Receipt photo upload */}
            <div>
              <label style={labelStyle}>Receipt photo</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onFileChange}
                style={{ display: "none" }}
              />
              {previewUrl ? (
                <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
                  <img
                    src={previewUrl}
                    alt="Receipt preview"
                    style={{ width: "100%", maxHeight: 300, objectFit: "contain", backgroundColor: "var(--bg)" }}
                  />
                  <div style={{ position: "absolute", bottom: 8, right: 8, display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        padding: "6px 12px", borderRadius: 5,
                        backgroundColor: "rgba(0,0,0,0.7)", color: "#fff",
                        fontSize: "var(--fs-xs)", fontWeight: 600,
                        border: "none", cursor: "pointer",
                      }}
                    >
                      Replace
                    </button>
                  </div>
                  <div style={{ padding: "8px 12px", backgroundColor: "var(--surface)", display: "flex", alignItems: "center", gap: 6 }}>
                    <FileText style={{ width: 13, height: 13, color: "var(--text-vlo)" }} />
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-lo)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {receiptFile?.name}
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: "100%", padding: "32px 20px",
                    borderRadius: 8,
                    border: "2px dashed var(--border)",
                    backgroundColor: "var(--surface)",
                    cursor: "pointer",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 10,
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}
                >
                  <Upload style={{ width: 20, height: 20, color: "var(--text-vlo)" }} />
                  <span style={{ fontSize: "var(--fs-body)", color: "var(--text-mid)", fontWeight: 500 }}>
                    Upload or photograph a receipt
                  </span>
                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>
                    JPG, PNG up to 10MB — will be OCR-parsed and pinned to IPFS
                  </span>
                </button>
              )}
            </div>

            {/* Region selector */}
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
                <label htmlFor="region" style={{ ...labelStyle, marginBottom: 0 }}>Region <span style={{ color: "var(--open)" }}>*</span></label>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>your approved regions only</span>
              </div>
              {profileLoading || regionsLoading ? (
                <div style={{ ...inputStyle, color: "var(--text-vlo)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />
                  Loading your regions…
                </div>
              ) : operatedRegions !== null && operatedRegions.length === 0 ? (
                <div style={{ ...inputStyle, color: "var(--text-vlo)", fontSize: "var(--fs-xs)" }}>
                  No regions assigned to your NGO yet. Contact an admin.
                </div>
              ) : (
                <select
                  id="region"
                  required
                  value={regionId}
                  onChange={(e) => setRegionId(e.target.value)}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="">— Select a region —</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({r.country})</option>
                  ))}
                </select>
              )}
            </div>

            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 6, border: "1px solid var(--open-border)", backgroundColor: "var(--open-bg)", color: "var(--open)", fontSize: "var(--fs-body)" }}>
                {error}
              </div>
            )}

            {submitting && receiptFile && (
              <div style={{
                padding: "12px 14px", borderRadius: 6,
                border: "1px solid var(--border-faint)", backgroundColor: "var(--surface)",
                fontSize: "var(--fs-ui)", color: "var(--text-lo)", lineHeight: 1.5,
              }}>
                <span style={{ display: "block", marginBottom: 8, color: "var(--text-mid)" }}>
                  Processing can take a few seconds. You can watch status on your dashboard without waiting here.
                </span>
                <Link
                  href="/ngo/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent-text)", fontWeight: 600, textDecoration: "none" }}
                >
                  Open dashboard in new tab →
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={!regionId || submitting}
              className="ngo-cta"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, padding: "11px 20px", borderRadius: 5,
                backgroundColor: !regionId ? "var(--border)" : "var(--accent)",
                color: !regionId ? "var(--text-vlo)" : "var(--accent-fg)",
                fontSize: "var(--fs-body)", fontWeight: 600,
                border: "none",
                cursor: !regionId || submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting
                ? (<><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />{submitStage || "Processing..."}</>)
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
