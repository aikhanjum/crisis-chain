# CrisisChain — Tasks & Demo Path

---

## ✅ Completed

### Smart Contracts
- [x] `CrisisPoolVault.sol` — single vault with poolId mapping, AccessControl, donate/payout
- [x] Distribution rules: 48hr cooldown per NGO per pool (Rule 2), 10% minimum reserve (Rule 3)
- [x] Admin bypass for both rules (`DEFAULT_ADMIN_ROLE`)
- [x] `MockUSDC.sol` — mintable test ERC-20

### Crisis Intelligence (`services/crisis-intelligence/`)
- [x] ACLED API fetch + caching in `acled_events`, weighted conflict scoring
- [x] HDX HAPI food insecurity + displacement scoring
- [x] Region pipeline: normalize → upsert `crisis_nodes` → deploy pool → AI summary → NGO discovery
- [x] APScheduler running pipeline every 6 hours inside FastAPI lifespan
- [x] ReliefWeb org scraper → website email extraction → DNS MX fallback
- [x] NGO invite email via Resend (HMAC-SHA256 signed token, 7-day TTL)
- [x] `POST /ngos/register?token=...` — full token validation (one-time use, expiry, email check)
- [x] `POST /ngos/invite/:id` — sends invite email, marks discovered_ngo as `invited`

### Blockchain Bridge (`services/blockchain-bridge/`)
- [x] `POST /pools/deploy` — assigns sequential pool_id to region (no new contract per region)
- [x] `POST /pools/pin-receipt` — multipart upload to Pinata IPFS, returns CID
- [x] `POST /ngos/approve` — `grantRole(PAYOUT_ROLE, wallet)` on-chain + DB update
- [x] `POST /ngos/revoke` — `revokeRole(PAYOUT_ROLE, wallet)` on-chain + DB update
- [x] `POST /reimbursement/submit` — `vault.payout()` on-chain, waits for confirm, marks receipt `paid`
- [x] ABI loaded from Foundry `contracts/out/` volume mount

### OCR Receipt (`services/ocr-receipt/`)
- [x] `POST /receipt/parse` — OCR image → parse line items → classify against approved_items DB

### API Gateway (`services/api-gateway/`)
- [x] `GET /auth/nonce`, `POST /auth/verify` — nonce generation + JWT issuance
- [x] `GET /regions` — returns all crisis_nodes
- [x] `POST /ngo/register` — inserts NGO application
- [x] `GET /ngo/queue` — returns receipt_requests for authenticated NGO wallet
- [x] JWT `requireAuth` middleware

### AI Summary (`services/ai-summary/`)
- [x] Anthropic Claude integration for region descriptions

### Database
- [x] All migrations: `crisis_nodes`, `ngos`, `discovered_ngos`, `receipt_requests`, `approved_items`, `acled_events`
- [x] Seed data: 9 crisis regions + 28 approved items

### Frontend (`apps/web/`)
- [x] Next.js 15 + Tailwind + wagmi v2 + RainbowKit scaffolded
- [x] Page stubs: `/map`, `/donate/[regionId]`, `/pool/[regionId]/ledger`, `/ngo/register`, `/ngo/submit`, `/ngo/dashboard`
- [x] docker-compose.yml with all services + volume mounts

---

## 🚨 Demo Critical Path (do in this order)

### Step 1 — External Accounts Setup
- [ ] **Arbitrum Sepolia RPC** — get a free endpoint from Alchemy or Infura, copy into `.env` as `RPC_URL`
- [ ] **Deployer wallet** — create/fund a wallet on Arbitrum Sepolia (needs ETH for gas)
  - Export private key → `.env` as `PRIVATE_KEY`
  - Get Sepolia ETH from faucet: `faucet.triangleplatform.com` or `sepolia.arbiscan.io/faucet`
- [ ] **Resend account** — sign up at resend.com, create API key → `.env` as `RESEND_API_KEY`
  - Verify a sending domain or use their sandbox (`onboarding@resend.dev`) for demo
- [ ] **Pinata account** — sign up at pinata.cloud, create API key pair → `.env` as `PINATA_API_KEY` / `PINATA_SECRET_KEY`
- [ ] **ACLED API** — myACLED → `.env` as `ACLED_EMAIL` + `ACLED_PASSWORD` (OAuth; optional `ACLED_ACCESS_TOKEN`)
- [ ] **Anthropic API key** → `.env` as `ANTHROPIC_API_KEY`
- [ ] **WalletConnect Project ID** — create project at cloud.walletconnect.com → `.env` as `WALLETCONNECT_PROJECT_ID`

### Step 2 — Deploy Contracts
- [ ] **Compile contracts**
  ```bash
  cd contracts && forge build
  ```
- [ ] **Deploy MockUSDC**
  ```bash
  forge script contracts/script/DeployMockUSDC.s.sol --broadcast --rpc-url $RPC_URL --private-key $PRIVATE_KEY
  ```
  Copy output address → `.env` as `USDC_ADDRESS`

- [ ] **Deploy CrisisPoolVault**
  ```bash
  forge script contracts/script/Deploy.s.sol --broadcast --rpc-url $RPC_URL --private-key $PRIVATE_KEY
  ```
  Copy output address → `.env` as `VAULT_ADDRESS`
  Copy deploy block number → `.env` as `START_BLOCK`

- [ ] **Mint test USDC to donor wallet**
  ```bash
  cast send $USDC_ADDRESS "mint(address,uint256)" $DONOR_WALLET 10000000000 \
    --rpc-url $RPC_URL --private-key $PRIVATE_KEY
  ```
  (10,000 USDC — 6 decimals)

### Step 3 — Fix Broken Backend Code
- [ ] **EIP-191 signature verification** in `services/api-gateway/src/middleware/auth.ts`
  - Install viem: `cd services/api-gateway && npm install viem`
  - Replace the `// TODO: verify signature` block:
    ```ts
    import { verifyMessage } from "viem";
    const valid = await verifyMessage({ address: address as `0x${string}`, message: nonce, signature: _signature as `0x${string}` });
    if (!valid) return null;
    ```

- [ ] **Fix ledger query** in `services/api-gateway/src/routes/regions.ts`
  - `donations` and `payouts` tables have no `created_at` column
  - Replace `ORDER BY created_at` with `ORDER BY block_number` (or remove `created_at` from SELECT)

- [ ] **Implement `POST /receipt/submit`** in `services/ocr-receipt/app/routes/receipt.py`
  - Load parsed result from DB (or accept line items directly in request body)
  - `POST http://blockchain-bridge:4001/pools/pin-receipt` with the receipt image → get IPFS CID
  - Insert into `receipt_requests` table (status=`approved`, pool_id, ngo_wallet, amount)
  - `POST http://blockchain-bridge:4001/reimbursement/submit` → triggers on-chain payout
  - Return `{ receipt_id, status: "paid", tx_hash }`

- [ ] **Implement `POST /ngo/receipt` proxy** in `services/api-gateway/src/routes/ngo.ts`
  - Pipe the multipart body from the browser directly to `http://ocr-receipt:8003/receipt/parse`
  - Use `http-proxy-middleware` or `node-fetch` with form-data passthrough
  - Forward the NGO wallet address from the JWT payload as a form field

### Step 4 — Wire the Frontend
- [ ] **CrisisMap component** (`apps/web/app/map/page.tsx`)
  - Fetch `GET http://localhost:4000/regions` on load
  - Render Leaflet markers at each region's lat/lng, colored by severity
  - Click → navigate to `/donate/[regionId]`

- [ ] **DonateForm component** (`apps/web/components/donate/DonateForm.tsx`)
  - `<ConnectButton />` from RainbowKit
  - Input for amount (USDC)
  - `useWriteContract` → `USDC.approve(VAULT_ADDRESS, amount)` then `vault.donate(poolId, amount, memo)`
  - Show tx hash with link to `arbiscan.io/tx/...` on confirm

- [ ] **Ledger page** (`apps/web/app/pool/[regionId]/ledger/page.tsx`)
  - Fetch `GET /regions/:id/ledger` → merge donations + payouts
  - Render as a timeline table: type | amount | wallet | tx hash | block

### Step 5 — Start Everything
- [ ] **Create `.env` file** at repo root with all vars:
  ```env
  RPC_URL=https://arb-sepolia.g.alchemy.com/v2/<key>
  PRIVATE_KEY=0x...
  VAULT_ADDRESS=0x...
  USDC_ADDRESS=0x...
  START_BLOCK=...
  ACLED_EMAIL=...
  ACLED_PASSWORD=...
  ANTHROPIC_API_KEY=...
  RESEND_API_KEY=...
  PINATA_API_KEY=...
  PINATA_SECRET_KEY=...
  WALLETCONNECT_PROJECT_ID=...
  FRONTEND_URL=http://localhost:3000
  JWT_SECRET=some-random-secret
  ```

- [ ] **Start all services**
  ```bash
  docker compose up --build
  ```
  Services start in order: postgres → crisis-intelligence, ai-summary, ocr-receipt, blockchain-bridge, api-gateway

- [ ] **Trigger pipeline manually** (don't wait 6 hours)
  ```bash
  curl -X POST http://localhost:8001/regions/refresh
  ```
  This runs the full ACLED→HDX→pool deploy→AI summary→NGO scrape pipeline immediately.

- [ ] **Verify seed data loaded**
  ```bash
  docker compose exec postgres psql -U postgres crisis_pool -c "SELECT region_id, severity_score FROM crisis_nodes LIMIT 5;"
  ```

- [ ] **Start frontend** (separate terminal — not in docker for dev)
  ```bash
  cd apps/web && npm run dev
  ```

---

## 🟡 Post-Demo (defer these)

- [ ] NGO register page — read invite token from URL (`searchParams.get("token")`)
- [ ] Rust indexer Dockerfile (`crates/indexer/Dockerfile`)
- [ ] Postgres LISTEN/NOTIFY WebSocket feed in api-gateway
- [ ] Replace admin private key with Safe multisig
- [ ] INFORM Risk Index integration (currently hardcoded 0)
- [ ] Verify HDX HAPI endpoint paths against live API docs
- [ ] Bulk invite endpoint: `POST /ngos/invite-all/:region_id`
- [ ] `ReimbursementQueue.sol` + `ApprovedItemsRegistry.sol`
- [ ] Add `created_at` to donations/payouts via migration `0004`
- [ ] nonce store in DB (currently in-memory map, resets on restart)
