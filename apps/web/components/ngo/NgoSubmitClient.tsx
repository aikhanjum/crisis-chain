"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useRef } from "react";
import { CheckCircle2, XCircle, Upload, Loader2, Plus } from "lucide-react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import { Web3Provider } from "@/providers/Web3Provider";
import { API_GATEWAY_URL } from "@/lib/constants";
import { useNgoAuth } from "@/hooks/useWallet";
import { useCrisisRegions } from "@/hooks/useCrisisRegions";

const NAV = [
  { href: "/ngo/dashboard", label: "Dashboard" },
  { href: "/ngo/submit", label: "Submit Receipt" },
  { href: "/ngo/register", label: "Register" },
] as const;

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
  const pathname = usePathname();
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

  return (
    <div>
      <header
        className="fu fu-1"
        style={{
          position: "sticky", top: 0, zIndex: 40,
          backgroundColor: "var(--surface)",
          borderBottom: "1px solid var(--border-faint)",
        }}
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
          <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
        </div>
      </header>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "56px 32px 96px" }}>
        <div className="fu fu-1">
          <h1 style={{ fontSize: "1.375rem", fontWeight: 600, color: "var(--text-hi)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
            Submit Receipt
          </h1>
          <p style={{ fontSize: "1rem", color: "var(--text-mid)", lineHeight: 1.6, marginTop: 8 }}>
            Upload a receipt for purchased humanitarian supplies. Approved items are reimbursed from the regional pool.
          </p>
        </div>

        {!isConnected && (
          <div className="fu fu-2" style={{ marginTop: 28, padding: 24, textAlign: "center", border: "1px solid var(--border-faint)", borderRadius: 10, backgroundColor: "var(--surface)" }}>
            <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-body)", marginBottom: 12 }}>Connect your wallet to submit receipts.</p>
            <ConnectButton />
          </div>
        )}

        {isConnected && !isAuthenticated && (
          <div className="fu fu-2" style={{ marginTop: 28, padding: 24, textAlign: "center", border: "1px solid var(--border-faint)", borderRadius: 10, backgroundColor: "var(--surface)" }}>
            <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-body)", marginBottom: 12 }}>Sign in to verify your NGO wallet.</p>
            <button type="button" className="ngo-cta" disabled={authLoading} onClick={() => login()}
              style={{ padding: "9px 20px", borderRadius: 5, backgroundColor: "var(--accent)", color: "var(--accent-fg)", fontSize: "var(--fs-ui)", fontWeight: 600, border: "none", cursor: authLoading ? "wait" : "pointer" }}>
              {authLoading ? "Signing…" : "Sign in with wallet"}
            </button>
          </div>
        )}

        {isConnected && isAuthenticated && (
          <>
            <div className="fu fu-2" style={{ marginTop: 28 }}>
              <label htmlFor="region-select" style={{ display: "block", fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-vlo)", marginBottom: 6 }}>Region</label>
              <select id="region-select" value={regionId} onChange={(e) => setRegionId(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 5, border: "1px solid var(--border)", backgroundColor: "var(--surface)", fontSize: "var(--fs-body)", color: "var(--text-hi)" }}>
                <option value="">Select a crisis region…</option>
                {regions.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.country})</option>)}
              </select>
            </div>

            <div className="fu fu-3" onClick={() => fileRef.current?.click()}
              style={{ marginTop: 16, border: file ? "1px solid var(--fulfilled-border)" : "1px dashed var(--border)", backgroundColor: file ? "var(--fulfilled-bg)" : "var(--accent-lo)", borderRadius: 10, padding: "32px 24px", textAlign: "center", color: file ? "var(--fulfilled)" : "var(--text-lo)", fontSize: "var(--fs-body)", cursor: "pointer" }}>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFileChange} style={{ display: "none" }} />
              {file ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <CheckCircle2 style={{ width: 16, height: 16 }} /><span>{file.name}</span>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Upload style={{ width: 16, height: 16 }} /><span>Tap to take a photo or choose a file</span>
                </div>
              )}
            </div>

            {preview && (
              <div style={{ marginTop: 12, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-faint)" }}>
                <img src={preview} alt="Receipt preview" style={{ width: "100%", maxHeight: 300, objectFit: "contain", backgroundColor: "#fafafa" }} />
              </div>
            )}

            <button type="button" className="ngo-cta" disabled={!file || !regionId || uploading} onClick={onUpload}
              style={{ marginTop: 16, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 20px", borderRadius: 5, backgroundColor: !file || !regionId ? "var(--border)" : "var(--accent)", color: !file || !regionId ? "var(--text-vlo)" : "var(--accent-fg)", fontSize: "var(--fs-body)", fontWeight: 600, border: "none", cursor: !file || !regionId || uploading ? "not-allowed" : "pointer" }}>
              {uploading ? (<><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />Processing…</>) : (<><Plus style={{ width: 15, height: 15 }} />Upload &amp; Parse Receipt</>)}
            </button>

            {error && (
              <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 8, border: "1px solid var(--open-border)", backgroundColor: "var(--open-bg)", color: "var(--open)", fontSize: "var(--fs-body)" }}>{error}</div>
            )}

            {result && (
              <div className="fu fu-4" style={{ marginTop: 20 }}>
                <div style={{ padding: "12px 16px", borderRadius: 8, border: "1px solid var(--fulfilled-border)", backgroundColor: "var(--fulfilled-bg)", color: "var(--fulfilled)", fontSize: "var(--fs-body)", marginBottom: 16 }}>
                  Receipt submitted. Request ID: <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{result.receipt_id.slice(0, 8)}</span> &middot; Status: <strong>{result.status}</strong>
                </div>
                {result.ocr.approved_items.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fulfilled)", marginBottom: 6 }}>Approved items</p>
                    {result.ocr.approved_items.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 5, backgroundColor: "var(--fulfilled-bg)", marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <CheckCircle2 style={{ width: 12, height: 12, color: "var(--fulfilled)" }} />
                          <span style={{ fontSize: "var(--fs-body)", color: "var(--text-mid)" }}>{item.quantity}× {item.name}</span>
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-ui)", color: "var(--text-hi)" }}>${item.total.toFixed(2)}</span>
                      </div>
                    ))}
                    <p style={{ marginTop: 4, fontSize: "var(--fs-xs)", color: "var(--text-vlo)", textAlign: "right" }}>Approved total: <strong>${result.ocr.total_approved.toFixed(2)}</strong></p>
                  </div>
                )}
                {result.ocr.flagged_items.length > 0 && (
                  <div>
                    <p style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--open)", marginBottom: 6 }}>Flagged items</p>
                    {result.ocr.flagged_items.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 5, backgroundColor: "var(--open-bg)", marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <XCircle style={{ width: 12, height: 12, color: "var(--open)" }} />
                          <span style={{ fontSize: "var(--fs-body)", color: "var(--text-mid)" }}>{item.quantity}× {item.name}</span>
                        </div>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-ui)", color: "var(--text-hi)" }}>${item.total.toFixed(2)}</span>
                      </div>
                    ))}
                    <p style={{ marginTop: 4, fontSize: "var(--fs-xs)", color: "var(--text-vlo)", textAlign: "right" }}>Flagged total: <strong>${result.ocr.total_flagged.toFixed(2)}</strong></p>
                  </div>
                )}
                {result.ocr.approved_items.length === 0 && result.ocr.flagged_items.length === 0 && (
                  <p style={{ color: "var(--text-lo)", fontSize: "var(--fs-body)" }}>No line items parsed. The receipt may need clearer text.</p>
                )}
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
