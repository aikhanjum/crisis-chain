"use client";

/**
 * /ngo/dashboard — NGO activity feed and reimbursement history
 *
 * TODO:
 * - Auth gate: redirect to /ngo/register if not logged in
 * - Fetch queue: useQuery → GET /ngo/queue
 * - Show: queue position, estimated wait, status of each receipt
 * - Show: total reimbursed to date (sum from payouts table filtered by NGO wallet)
 * - Show: on-chain history links (Arbiscan)
 */

export default function NgoDashboardPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-bold">NGO Dashboard</h1>

        {/* TODO: <QueueStatus /> — live queue position for pending receipts */}
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-500 text-sm">
          [ Reimbursement queue — position, status, estimated payout time ]
        </div>

        {/* TODO: past reimbursements table */}
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-500 text-sm">
          [ Past reimbursements — date, amount, items, tx hash link ]
        </div>
      </div>
    </div>
  );
}
