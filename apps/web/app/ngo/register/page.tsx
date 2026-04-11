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
          NGO Registration
        </h1>
        <p
          style={{
            fontSize: "1rem",
            color: "var(--text-mid)",
            lineHeight: 1.6,
            marginTop: 8,
          }}
        >
          Apply to receive reimbursements from regional crisis pools. Your wallet
          address will be whitelisted after manual review.
        </p>
      </div>

      {/* TODO: connect wallet first, then show form */}
      <div
        className="fu fu-2"
        style={{
          marginTop: 28,
          border: "1px solid var(--border-faint)",
          backgroundColor: "var(--surface)",
          borderRadius: 10,
          padding: 24,
          color: "var(--text-vlo)",
          fontSize: "var(--fs-body)",
        }}
      >
        [ Registration form — org name, country, reg number, operated regions,
        wallet (auto from MetaMask) ]
      </div>
    </div>
  );
}
