"use client";

/**
 * /ngo/submit — Upload a receipt for reimbursement
 *
 * TODO:
 * - Wallet login via useNgoAuth() hook (EIP-191 signed nonce → JWT)
 * - File upload (image or PDF) → POST to /ngo/receipt on API gateway
 * - Display OCR result: approved line items in green, flagged in red
 * - Allow NGO to annotate flagged items before final submit
 * - Show queue position after submission
 */

export default function NgoSubmitPage() {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "56px 32px 96px" }}>
      <div className="fu fu-1">
        <h1
          style={{
            fontSize: "1.375rem",
            fontWeight: 600,
            color: "var(--text-hi)",
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}
        >
          Submit Receipt
        </h1>
        <p
          style={{
            fontSize: "1rem",
            color: "var(--text-mid)",
            lineHeight: 1.6,
            marginTop: 8,
          }}
        >
          Upload a receipt for purchased humanitarian supplies. Approved items
          are reimbursed automatically from the regional pool.
        </p>
      </div>

      {/* TODO: <ReceiptUpload /> — drag-drop file, calls submitReceipt() from lib/api */}
      <div
        className="fu fu-2"
        style={{
          marginTop: 28,
          border: "1px dashed var(--border)",
          backgroundColor: "var(--accent-lo)",
          borderRadius: 10,
          padding: "40px 24px",
          textAlign: "center",
          color: "var(--text-lo)",
          fontSize: "var(--fs-body)",
        }}
      >
        [ Drag &amp; drop receipt here or click to upload ]
      </div>

      {/* TODO: show OCR result after upload */}
      <div
        className="fu fu-3"
        style={{
          marginTop: 12,
          border: "1px solid var(--border-faint)",
          backgroundColor: "var(--surface)",
          borderRadius: 10,
          padding: 24,
          color: "var(--text-vlo)",
          fontSize: "var(--fs-body)",
        }}
      >
        [ OCR result — approved items ✓ in green, flagged items ✗ in red with
        annotation field ]
      </div>

      {/* TODO: submit button — calls final approval endpoint */}
    </div>
  );
}
