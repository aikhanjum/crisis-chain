/**
 * /pool/[regionId]/ledger — Public transparency ledger for a regional pool
 *
 * TODO:
 * - Fetch full ledger: const ledger = await getPoolLedger(params.regionId)
 * - Render timeline of donations in / payouts out with receipt notes
 * - Add fund velocity chart (recharts or chart.js)
 * - Add category breakdown of purchased goods
 * - Make this page shareable (og:image with pool stats)
 */

export default async function LedgerPage({ params }: { params: { regionId: string } }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-bold">Pool Ledger</h1>
        <p className="mt-1 text-zinc-400 text-sm">Region: {params.regionId} — all transactions are on-chain</p>

        {/* Summary stats */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {["Total Raised", "Total Disbursed", "Net Balance"].map((label) => (
            <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-zinc-200">—</p>
            </div>
          ))}
        </div>

        {/* Transaction timeline */}
        {/* TODO: map over ledger.donations and ledger.payouts, merge + sort by block */}
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-500 text-sm">
          [ Transaction timeline — donations ↓ in green, payouts ↑ in blue, with receipt item notes ]
        </div>
      </div>
    </div>
  );
}
