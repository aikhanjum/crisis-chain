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
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-bold">Submit Receipt</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Upload a receipt for purchased humanitarian supplies. Approved items are reimbursed
          automatically from the regional pool.
        </p>

        {/* TODO: <ReceiptUpload /> — drag-drop file, calls submitReceipt() from lib/api */}
        <div className="mt-8 rounded-xl border border-dashed border-zinc-700 bg-zinc-900 p-10 text-center text-zinc-500 text-sm">
          [ Drag & drop receipt here or click to upload ]
        </div>

        {/* TODO: show OCR result after upload */}
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-500 text-sm">
          [ OCR result — approved items ✓ in green, flagged items ✗ in red with annotation field ]
        </div>

        {/* TODO: submit button — calls final approval endpoint */}
      </div>
    </div>
  );
}
