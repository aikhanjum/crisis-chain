/**
 * /ngo/register — NGO onboarding + wallet whitelist application
 *
 * TODO:
 * - Connect wallet (RainbowKit ConnectButton)
 * - Form: org name, country, registration number, contact email, operated regions
 * - POST to /ngo/register on API gateway
 * - Admin reviews and calls grantRole() on CrisisPoolVault to whitelist the NGO wallet
 */

export default function NgoRegisterPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-bold">NGO Registration</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Apply to receive reimbursements from regional crisis pools. Your wallet address will be
          whitelisted after manual review.
        </p>

        {/* TODO: connect wallet first, then show form */}
        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-500 text-sm">
          [ Registration form — org name, country, reg number, operated regions, wallet (auto from MetaMask) ]
        </div>
      </div>
    </div>
  );
}
