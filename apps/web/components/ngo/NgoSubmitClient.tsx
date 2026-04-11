"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Loader2, Upload, Camera, FileText, Shield, MapPin, Globe } from "lucide-react";

import { darkTheme } from "@rainbow-me/rainbowkit";
import { Web3Provider } from "@/providers/Web3Provider";
import { API_GATEWAY_URL } from "@/lib/constants";
import { useNgoAuth, useEmailAuth } from "@/hooks/useWallet";
import { useCrisisRegions } from "@/hooks/useCrisisRegions";
import { NgoHeader } from "@/components/ngo/NgoHeader";

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
};

function SubmitInner() {
  const walletAuth = useNgoAuth();
  const emailAuth = useEmailAuth();
  const token = walletAuth.token ?? emailAuth.token;
  const isAuthenticated = walletAuth.isAuthenticated || emailAuth.isAuthenticated;

  const { data: allRegions = [], isLoading: regionsLoading } = useCrisisRegions();
  const [operatedRegions, setOperatedRegions] = useState<string[] | null>(null);

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

  const regions =
    operatedRegions && operatedRegions.length > 0
      ? allRegions.filter((r) => operatedRegions.includes(r.id))
      : allRegions;

  const [regionId, setRegionId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState("");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGeoLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  }

  const selectedRegion = regions.find((r) => r.id === regionId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !regionId || !amount) return;
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      if (receiptFile) {
        setSubmitStage("Uploading receipt & running OCR...");
        const formData = new FormData();
        formData.append("receipt", receiptFile);
        formData.append("region_id", regionId);
        formData.append("pool_id", selectedRegion?.poolId || "1");
        formData.append("amount", amount);
        if (geoLocation) {
          formData.append("lat", String(geoLocation.lat));
          formData.append("lng", String(geoLocation.lng));
        }

        setSubmitStage("Parsing receipt with OCR...");
        await new Promise((r) => setTimeout(r, 300));
        setSubmitStage("Pinning to IPFS...");
        await new Promise((r) => setTimeout(r, 200));
        setSubmitStage("Submitting on-chain claim...");

        const res = await fetch(`${API_GATEWAY_URL}/receipt/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const body = await res.json() as PipelineResult;
        if (!res.ok) throw new Error((body as unknown as { error: string }).error ?? `HTTP ${res.status}`);
        setResult(body);
      } else {
        setSubmitStage("Submitting request...");
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
        setResult({
          status: "queued",
          ocrResult: null,
          ipfsCid: null,
          claim: null,
        });
      }
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
    setAmount("");
    setNotes("");
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
            <div style={{ padding: 28, border: "1px solid var(--fulfilled-border)", borderRadius: 10, backgroundColor: "var(--fulfilled-bg)", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <CheckCircle2 style={{ width: 28, height: 28, color: "var(--fulfilled)" }} />
                <p style={{ color: "var(--fulfilled)", fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>
                  {result.claim ? "Delivery claim submitted on-chain" : "Request queued"}
                </p>
              </div>

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

              {result.ocrResult && (
                <div style={{ borderTop: "1px solid var(--fulfilled-border)", paddingTop: 12 }}>
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
                <div style={{ borderTop: "1px solid var(--fulfilled-border)", paddingTop: 10, marginTop: 10 }}>
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
                  <div style={{ display: "flex", gap: 12 }}>
                    <Upload style={{ width: 20, height: 20, color: "var(--text-vlo)" }} />
                    <Camera style={{ width: 20, height: 20, color: "var(--text-vlo)" }} />
                  </div>
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

            {/* Amount */}
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

            {/* Notes */}
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

            {/* Geo status */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>
              <MapPin style={{ width: 12, height: 12 }} />
              {geoLocation
                ? <span>Location: {geoLocation.lat.toFixed(4)}, {geoLocation.lng.toFixed(4)} (auto-detected)</span>
                : <span>Location not available — enable browser location for geo-verification</span>}
            </div>

            {/* Pipeline indicator */}
            {receiptFile && (
              <div style={{
                padding: "10px 14px", borderRadius: 6,
                border: "1px solid var(--border-faint)", backgroundColor: "var(--hero-bg)",
                fontSize: "var(--fs-xs)", color: "var(--text-lo)",
                display: "flex", flexDirection: "column", gap: 4,
              }}>
                <span style={{ fontWeight: 600, color: "var(--text-mid)" }}>Automated pipeline will run:</span>
                <span>1. OCR parse receipt → extract line items</span>
                <span>2. Pin receipt photo to IPFS → tamper-proof archive</span>
                <span>3. Submit on-chain delivery claim → ProofOfDelivery contract</span>
                <span>4. Auto-attest oracle signals (receipt + geo verification)</span>
              </div>
            )}

            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 6, border: "1px solid var(--open-border)", backgroundColor: "var(--open-bg)", color: "var(--open)", fontSize: "var(--fs-body)" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!regionId || !amount || submitting}
              className="ngo-cta"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, padding: "11px 20px", borderRadius: 5,
                backgroundColor: !regionId || !amount ? "var(--border)" : "var(--accent)",
                color: !regionId || !amount ? "var(--text-vlo)" : "var(--accent-fg)",
                fontSize: "var(--fs-body)", fontWeight: 600,
                border: "none",
                cursor: !regionId || !amount || submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting
                ? (<><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />{submitStage || "Processing..."}</>)
                : receiptFile ? "Submit receipt & verify on-chain" : "Submit request"}
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
