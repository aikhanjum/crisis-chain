/**
 * /donate/[regionId] — Donate USDC to a regional crisis pool
 *
 * TODO:
 * - Fetch region data: const region = await getRegion(params.regionId)
 * - Fetch live pool balance via usePoolStats(params.regionId)
 * - Implement DonateForm: USDC approve + donate() contract call via wagmi
 * - Show transaction confirmation with on-chain link
 */

export default async function DonatePage({ params }: { params: { regionId: string } }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-bold">Donate to Region</h1>
        <p className="mt-1 text-zinc-400 text-sm">Region ID: {params.regionId}</p>

        {/* TODO: <PoolStats regionId={params.regionId} /> */}
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-500 text-sm">
          [ Pool stats — total raised, # donors, last reimbursement ]
        </div>

        {/* TODO: <DonateForm regionId={params.regionId} /> */}
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-500 text-sm">
          [ Donate form — connect wallet, enter amount, approve USDC, call donate() ]
        </div>
      </div>
    </div>
  );
}
