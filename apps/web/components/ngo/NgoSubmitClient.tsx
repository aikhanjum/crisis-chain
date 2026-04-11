"use client";

import { useState, useRef } from "react";
import { CheckCircle2, XCircle, Upload, Loader2, Plus } from "lucide-react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import { Web3Provider } from "@/providers/Web3Provider";
import { API_GATEWAY_URL } from "@/lib/constants";
import { useNgoAuth } from "@/hooks/useWallet";
import { useCrisisRegions } from "@/hooks/useCrisisRegions";
import { NgoHeader } from "@/components/ngo/NgoHeader";

type OcrItem = { name: string; quantity: number; unit_price: number; total: number };
type SubmitResult = {
  receipt_id: string;
  status: string;
  submitted_at: string;
  ocr: {
    total_approved: number;
    total_flagged: number;
    approved_items: OcrItem[];
    flagged_items: OcrItem[];
    raw_ocr_text: string;
  };
};

function SubmitInner() {
  const { isConnected } = useAccount();
  const { token, login, loading: authLoading, isAuthenticated } = useNgoAuth();
  const { data: regions = [] } = useCrisisRegions();

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [regionId, setRegionId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError(null);
    if (f && f.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  }

  async function onUpload() {
    if (!file || !regionId || !token) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("region_id", regionId);

      const res = await fetch(`${API_GATEWAY_URL}/ngo/receipt`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? body?.detail ?? `HTTP ${res.status}`);
      setResult(body as SubmitResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const step = !isConnected ? 0 : !isAuthenticated ? 0 : !regionId ? 1 : !file ? 2 : 3;

  const headerRight = <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />;

  return (
    <div>
      <NgoHeader rightSlot={headerRight} />

      <div style={{ maxWidth: 540, margin: "0 auto", padding: "48px 32px 96px" }}>
        <div className="fu fu-1" style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--text-hi)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Submit Receipt
          </h1>
          <p style={{ fontSize: "var(--fs-body)", color: "var(--text-mid)", lineHeight: 1.6, marginTop: 8 }}>
            Upload a receipt for purchased humanitarian supplies. Approved items are reimbursed from the regional pool.
          </p>
        </div>

        {/* ── Step progress ─────────────────────────────────── */}
        {isConnected && isAuthenticated && (
          <div className="ngo-steps fu fu-2">
            {[
              { n: 1, label: "Select Region" },
              { n: 2, label: "Upload Receipt" },
              { n: 3, label: "Submit" },
            ].map(({ n, label }, i) => {
              const isDone = step > n;
              const isActive = step === n || (n === 3 && step >= 3);
              return (
                <>
                  {i > 0 && <div key={`conn-${n}`} className="ngo-step-connector" />}
                  <div
                    key={n}
                    className={`ngo-step${isDone ? " ngo-step-done" : isActive ? " ngo-step-active" : ""}`}
                  >
                    <div className="ngo-step-num">
                      {isDone ? <CheckCircle2 style={{ width: 11, height: 11 }} /> : n}
                    </div>
                    <span>{label}</span>
                  </div>
                </>
              );
            })}
          </div>
        )}

        {!isConnected && (
          <div className="fu fu-2 ngo-card" style={{ marginTop: 28, padding: 28, textAlign: "center" }}>
            <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-body)", marginBottom: 16 }}>Connect your wallet to submit receipts.</p>
            <ConnectButton />
          </div>
        )}

        {isConnected && !isAuthenticated && (
          <div className="fu fu-2 ngo-card" style={{ marginTop: 28, padding: 28, textAlign: "center" }}>
            <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-body)", marginBottom: 16 }}>Sign in to verify your NGO wallet.</p>
            <button
              type="button"
              className="ngo-cta"
              disabled={authLoading}
              onClick={() => login()}
              style={{
                padding: "9px 20px",
                borderRadius: 5,
                backgroundColor: "var(--accent)",
                color: "var(--accent-fg)",
                fontSize: "var(--fs-ui)",
                fontWeight: 600,
                border: "none",
                cursor: authLoading ? "wait" : "pointer",
              }}
            >
              {authLoading ? "Signing…" : "Sign in with wallet"}
            </button>
          </div>
        )}

        {isConnected && isAuthenticated && (
          <>
            {/* Region select */}
            <div className="fu fu-2" style={{ marginTop: 24 }}>
              <label
                htmlFor="region-select"
                style={{ display: "block", fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-vlo)", marginBottom: 6 }}
              >
                Crisis Region
              </label>
              <select
                id="region-select"
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 7,
                  border: regionId ? "1px solid var(--fulfilled-border)" : "1px solid var(--border)",
                  backgroundColor: "var(--surface)",
                  fontSize: "var(--fs-body)",
                  color: "var(--text-hi)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <option value="">Select a crisis region…</option>
                {regions.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.country})</option>)}
              </select>
            </div>

            {/* Upload dropzone */}
            <div className="fu fu-3" style={{ marginTop: 16 }}>
              <label
                style={{ display: "block", fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-vlo)", marginBottom: 6 }}
              >
                Receipt Photo
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: file ? "2px solid var(--fulfilled-border)" : "2px dashed var(--border)",
                  backgroundColor: file ? "var(--fulfilled-bg)" : "var(--accent-lo)",
                  borderRadius: 10,
                  padding: "44px 24px",
                  textAlign: "center",
                  color: file ? "var(--fulfilled)" : "var(--text-lo)",
                  fontSize: "var(--fs-body)",
                  cursor: "pointer",
                  transition: "border-color 0.15s, background-color 0.15s",
                }}
              >
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFileChange} style={{ display: "none" }} />
                {file ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <CheckCircle2 style={{ width: 28, height: 28 }} />
                    <span style={{ fontWeight: 500 }}>{file.name}</span>
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-lo)" }}>Tap to replace</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <Upload style={{ width: 28, height: 28, color: "var(--accent-text)" }} />
                    <div>
                      <span style={{ fontWeight: 500, color: "var(--text-mid)" }}>Tap to take a photo or choose a file</span>
                      <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-vlo)", marginTop: 4 }}>JPG, PNG, or HEIC accepted</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {preview && (
              <div style={{ marginTop: 12, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-faint)", boxShadow: "var(--shadow-card)" }}>
                <img src={preview} alt="Receipt preview" style={{ width: "100%", maxHeight: 300, objectFit: "contain", backgroundColor: "#fafafa" }} />
              </div>
            )}

            <button
              type="button"
              className="ngo-cta"
              disabled={!file || !regionId || uploading}
              onClick={onUpload}
              style={{
                marginTop: 16,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "13px 20px",
                borderRadius: 7,
                backgroundColor: !file || !regionId ? "var(--border)" : "var(--accent)",
                color: !file || !regionId ? "var(--text-vlo)" : "var(--accent-fg)",
                fontSize: "var(--fs-body)",
                fontWeight: 600,
                border: "none",
                cursor: !file || !regionId || uploading ? "not-allowed" : "pointer",
                boxShadow: file && regionId ? "var(--shadow-card)" : "none",
              }}
            >
              {uploading
                ? <><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />Processing…</>
                : <><Plus style={{ width: 15, height: 15 }} />Upload &amp; Parse Receipt</>
              }
            </button>

            {error && (
              <div className="fu fu-1" style={{ marginTop: 16, padding: "12px 16px", borderRadius: 8, border: "1px solid var(--open-border)", backgroundColor: "var(--open-bg)", color: "var(--open)", fontSize: "var(--fs-body)" }}>
                {error}
              </div>
            )}

            {result && (
              <div className="fu fu-4 ngo-card" style={{ marginTop: 24, overflow: "hidden" }}>
                {/* Result header */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-faint)", backgroundColor: "var(--fulfilled-bg)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle2 style={{ width: 18, height: 18, color: "var(--fulfilled)" }} />
                    <span style={{ fontSize: "var(--fs-body)", fontWeight: 600, color: "var(--text-hi)" }}>
                      Receipt submitted
                    </span>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "var(--text-vlo)" }}>
                    {result.receipt_id.slice(0, 8)}
                  </span>
                </div>

                {/* Approved total hero */}
                {result.ocr.total_approved > 0 && (
                  <div style={{ padding: "20px 20px 0" }}>
                    <p style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-vlo)", marginBottom: 4 }}>
                      Approved for reimbursement
                    </p>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--fs-hero)",
                        fontWeight: 500,
                        color: "var(--fulfilled)",
                        fontVariantNumeric: "tabular-nums lining-nums",
                        lineHeight: 1,
                      }}
                    >
                      ${result.ocr.total_approved.toFixed(2)}
                    </span>
                  </div>
                )}

                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                  {result.ocr.approved_items.length > 0 && (
                    <div>
                      <p style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fulfilled)", marginBottom: 6 }}>
                        Approved items
                      </p>
                      {result.ocr.approved_items.map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 6, backgroundColor: "var(--fulfilled-bg)", marginBottom: 4, outline: "1px solid var(--fulfilled-border)", outlineOffset: -1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <CheckCircle2 style={{ width: 13, height: 13, color: "var(--fulfilled)", flexShrink: 0 }} />
                            <span style={{ fontSize: "var(--fs-body)", color: "var(--text-mid)" }}>{item.quantity}× {item.name}</span>
                          </div>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-ui)", color: "var(--text-hi)", fontWeight: 600 }}>${item.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.ocr.flagged_items.length > 0 && (
                    <div>
                      <p style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--open)", marginBottom: 6 }}>
                        Flagged items
                      </p>
                      {result.ocr.flagged_items.map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 6, backgroundColor: "var(--open-bg)", marginBottom: 4, outline: "1px solid var(--open-border)", outlineOffset: -1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <XCircle style={{ width: 13, height: 13, color: "var(--open)", flexShrink: 0 }} />
                            <span style={{ fontSize: "var(--fs-body)", color: "var(--text-mid)" }}>{item.quantity}× {item.name}</span>
                          </div>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-ui)", color: "var(--text-hi)" }}>${item.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.ocr.approved_items.length === 0 && result.ocr.flagged_items.length === 0 && (
                    <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-body)" }}>No line items parsed. The receipt may need clearer text.</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function NgoSubmitClient() {
  return (
    <Web3Provider>
      <SubmitInner />
    </Web3Provider>
  );
}
