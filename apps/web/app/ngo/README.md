# NGO Portal — `/app/ngo`

Self-contained section of the web app for NGO users to register, submit reimbursement requests, and track payouts from crisis pools.

---

## Routes

| Route | File | Purpose |
|---|---|---|
| `/ngo/register` | `register/page.tsx` | Onboarding — connect wallet, submit org details for whitelist approval |
| `/ngo/dashboard` | `dashboard/page.tsx` | Overview — balance, request counts, pool membership, transaction history |
| `/ngo/submit` | `submit/page.tsx` | Receipt submission — upload, parse, convert currency, and file a reimbursement request |

---

## Feature Spec

### Dashboard (`/ngo/dashboard`)

- **Request counters** — three status buckets displayed as stat cards:
  - Open (submitted, awaiting review)
  - Pending (approved, payout queued)
  - Fulfilled (on-chain payout confirmed)
- **Pool membership** — list of crisis pool IDs the connected wallet is whitelisted in, with pool name and current pool balance. show current balance (USDC, 6 decimals) with local currency equivalent shown beneath (e.g. "1,200 USDC ≈ 1,104 EUR"). Exchange rate fetched from a public FX API at load time.
- **Transaction history** — paginated table of past reimbursements: date, item description, USDC amount, status badge, Arbiscan tx link.

### Receipt Submission (`/ngo/submit`)

- **Upload interface** — drag-and-drop area that also accepts camera capture on mobile (`accept="image/*" capture="environment"`). Supports JPEG, PNG, PDF.
- **Form fields** (manually entered or pre-filled from OCR):
  - Item name / description
  - Cost in local currency (dropdown to select currency code)
  - Stablecoin equivalent (auto-calculated, read-only)
  - Date of purchase (date picker, defaults to today)
  - Receipt image preview
- **Currency conversion** — local currency amount converts to USDC in real time using FX rate fetched on page load. Formula: `usdc = localAmount / fxRate`.
- **Submission** — POST to `/api/ngo/receipt` with multipart form (image file + JSON metadata). Response includes queue position.

### Profile / Registration (`/ngo/register`)

- **Wallet connection** — RainbowKit `ConnectButton`. Wallet address is the NGO's identity (no username/password).
- **Registration form fields**:
  - Organisation name
  - Country of operation
  - Registration / charity number
  - Contact email
  - Regions operated in (multi-select)
  - Wallet address (auto-populated from connected wallet, read-only)
- **Post-submission** — admin manually calls `grantRole()` on `CrisisPoolVault` to whitelist the wallet. NGO is notified and redirected to dashboard.
- **Wallet configuration** — on dashboard, NGO can view their connected address and switch wallets via RainbowKit.

---

## Data Flow

```
NGO connects wallet (RainbowKit)
        │
        ▼
POST /api/ngo/register   ← org details + wallet address
        │
        ▼
Admin approves → grantRole() on CrisisPoolVault (on-chain)
        │
        ▼
NGO uploads receipt → POST /api/ngo/receipt
        │
        ├─ Receipt stored (IPFS or cloud storage)
        ├─ Metadata written to DB (item, amount_local, amount_usdc, date, status=open)
        │
        ▼
Admin reviews → calls payout() on CrisisPoolVault
        │
        ▼
Indexer picks up Payout event → updates DB record to status=fulfilled
        │
        ▼
NGO sees fulfilled status + Arbiscan link on dashboard
```

---

## Key Constraints

- All amounts stored and displayed in **USDC with 6 decimal precision** (match ERC-20 standard).
- Local currency conversion is **informational only** — the on-chain payout is always in USDC.
- NGO wallet must be whitelisted in at least one pool before `/ngo/submit` is accessible.
- Receipt files should be under **10MB**. PDFs and images accepted.

---

## Component Checklist

- [ ] `dashboard/page.tsx` — wallet balance + FX rate
- [ ] `dashboard/page.tsx` — request status counters (open / pending / fulfilled)
- [ ] `dashboard/page.tsx` — pool membership list
- [ ] `dashboard/page.tsx` — transaction history table
- [ ] `submit/page.tsx` — drag-and-drop / camera upload
- [ ] `submit/page.tsx` — item name, cost, date form fields
- [ ] `submit/page.tsx` — live local→USDC currency conversion
- [ ] `submit/page.tsx` — POST to receipt API + queue position response
- [ ] `register/page.tsx` — RainbowKit wallet connect
- [ ] `register/page.tsx` — org registration form + POST to register API
