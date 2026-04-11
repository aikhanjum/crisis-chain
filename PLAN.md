# CrisisChain — Implementation Plan

## What's Done (Existing)

| Area | Status | Notes |
|------|--------|-------|
| `contracts/CrisisPoolVault.sol` | ✅ Complete | Donations, role-gated payouts, pause. Deployed target: Arbitrum Sepolia |
| `contracts/MockUSDC.sol` | ✅ Complete | ERC-20 for local testing |
| `contracts/test/` | ✅ Complete | Foundry unit tests |
| `crates/indexer/` | ✅ Complete | Rust service — polls chain events, indexes to Postgres, REST API on :3001 |
| `migrations/0001_init.sql` | ✅ Complete | `donations`, `payouts`, `indexer_state` tables |

## What's Boilerplate (This Session)

| Area | Status | Notes |
|------|--------|-------|
| `apps/web/` | ✅ Scaffolded | Next.js 15, Tailwind, wagmi v2, RainbowKit, Leaflet |
| `apps/web/app/` | ✅ Page stubs | All 6 routes created with clear TODO comments |
| `apps/web/lib/` | ✅ Done | `api.ts`, `wagmi.ts`, `constants.ts`, `utils.ts` |
| `apps/web/hooks/` | ✅ Done | `useCrisisRegions`, `usePoolData`, `useWallet` |
| `apps/web/providers/Web3Provider.tsx` | ✅ Done | wagmi + RainbowKit + react-query providers |
| `apps/web/components/map/` | ✅ Done | `CrisisMap` (Leaflet), `CrisisDrawer` |
| `services/crisis-intelligence/` | ✅ Scaffolded | FastAPI, ACLED/HDX/ReliefWeb clients, normalizer, APScheduler cron |
| `services/ai-summary/` | ✅ Scaffolded | FastAPI, Claude API integration, in-memory cache |
| `services/ocr-receipt/` | ✅ Scaffolded | FastAPI, Tesseract OCR, approved items matcher, receipt model |
| `services/api-gateway/` | ✅ Scaffolded | Express/TS, auth middleware (EIP-191), regions/ngo/pool routes, WebSocket |
| `services/blockchain-bridge/` | ✅ Scaffolded | viem contract deployer stub, Pinata IPFS uploader, event watcher |
| `migrations/0002_crisis_tables.sql` | ✅ Done | `crisis_nodes`, `ngos`, `receipt_requests`, `approved_items` |
| `migrations/seed.sql` | ✅ Done | 9 real crisis regions + 28 approved items seeded |
| `docker-compose.yml` | ✅ Updated | All 7 services with health checks and networking |
| `.env.example` | ✅ Updated | All env vars for every service |

---

## What Needs Real Implementation (Ordered by Priority)

### Sprint 1 — Demo-Ready Core (hackathon must-haves)

**1. Seed the DB and get the map rendering**
- Run `docker compose up -d postgres`
- Run `psql "$DATABASE_URL" -f migrations/0002_crisis_tables.sql`
- Run `psql "$DATABASE_URL" -f migrations/seed.sql`
- In `apps/web/app/map/page.tsx`: replace placeholder div with `<CrisisMap>` using seeded data from `GET /regions`

**2. Wire the API gateway to return real data**
- `services/api-gateway/src/routes/regions.ts` — queries `crisis_nodes` table; migration + seed gets this working immediately without any scraping
- Run `npm install && npm run dev` in `services/api-gateway/`

**3. Donate flow (end-to-end)**
- `apps/web/app/donate/[regionId]/page.tsx` → implement `DonateForm` component:
  - Connect wallet via RainbowKit `<ConnectButton />`
  - Read pool balance with `usePoolStats()`
  - `useWriteContract` → call `USDC.approve(vaultAddress, amount)` then `vault.donate(poolId, amount, memo)`
- File: `apps/web/components/donate/DonateForm.tsx`

**4. Ledger page**
- `apps/web/app/pool/[regionId]/ledger/page.tsx` — fetch from `GET /regions/:id/ledger`
- Merge and sort donations + payouts by block number into a single timeline

**5. Deploy contracts + start indexer**
- `forge script contracts/script/DeployMockUSDC.s.sol --broadcast --rpc-url $RPC_URL`
- `forge script contracts/script/Deploy.s.sol --broadcast --rpc-url $RPC_URL`
- Set `VAULT_ADDRESS`, `USDC_ADDRESS`, `START_BLOCK` in `.env`
- `cargo run -p indexer`

---

### Sprint 2 — NGO Flow

**6. NGO receipt submission (OCR)**
- `services/ocr-receipt/` — install deps, confirm Tesseract works: `docker compose up ocr-receipt`
- `apps/web/app/ngo/submit/page.tsx` → implement `ReceiptUpload` component that POSTs to `api-gateway /ngo/receipt`
- API gateway must proxy to OCR service (add `http-proxy-middleware` or use `fetch` to forward)
- Show OCR result: green for approved, red for flagged items

**7. NGO wallet auth**
- `services/api-gateway/src/middleware/auth.ts` — complete the EIP-191 signature verification using `viem.verifyMessage()`
- `apps/web/hooks/useWallet.ts` — `useNgoAuth()` hook is written; connect it to login button on `/ngo/dashboard`

**8. Reimbursement queue smart contract**
- Write `contracts/src/ReimbursementQueue.sol` — FIFO queue, enforces per-NGO monthly cap + 48hr cooldown
- Wire OCR service → blockchain bridge → `ReimbursementQueue.sol` → `CrisisPoolVault.payout()`

---

### Sprint 3 — Automation & Trust

**9. Crisis intelligence scraper (live data)**
- `services/crisis-intelligence/app/services/acled.py` — implement `fetch_recent_events()`
- `services/crisis-intelligence/app/services/normalizer.py` — tune severity score weights
- Connect scheduler to upsert `crisis_nodes` table every 6h
- Trigger `blockchain-bridge /pools/deploy` for new high-severity regions

**10. AI summaries (live)**
- `services/ai-summary/app/services/claude.py` — set `ANTHROPIC_API_KEY`, verify prompt output
- Call `POST /summary/batch` from crisis intelligence cron after upsert

**11. Contract deployment automation**
- `services/blockchain-bridge/src/services/deployer.ts` — load compiled artifacts from `contracts/out/`, implement `deployPool()`
- After deploy: write pool address + pool_id back to `crisis_nodes`

**12. IPFS receipt archiving**
- `services/blockchain-bridge/src/services/ipfs.ts` — wire to Pinata, test with a real receipt
- Pass IPFS CID to `CrisisPoolVault.payout()` as `payoutRef`

---

### Sprint 4 — Polish & Production

**13. Real-time donation feed**
- API gateway WebSocket: subscribe to Postgres `LISTEN donations_feed`
- Rust indexer or trigger: `NOTIFY donations_feed` on new donation insert
- Frontend: connect WebSocket in ledger page for live updates

**14. `ApprovedItemsRegistry.sol`**
- On-chain whitelist of approved goods categories (multisig-updatable)
- Sync with `approved_items` DB table

**15. NGO registration admin UI**
- Simple admin page (password-protected or wallet-gated) to approve/reject NGO applications
- On approval: call `vault.grantRole(PAYOUT_ROLE, ngoWallet)`

**16. Mainnet / production hardening**
- Replace single private key with Safe multisig for admin role
- Switch from MockUSDC to real USDC on Arbitrum One
- Add rate limiting and request validation to all API services
- Replace in-memory auth nonce store with Redis

---

## Port Map

| Service | Port | Notes |
|---------|------|-------|
| Next.js frontend | 3000 | `npm run dev` in `apps/web/` |
| Rust indexer API | 3001 | `cargo run -p indexer` |
| API gateway | 4000 | `npm run dev` in `services/api-gateway/` |
| Blockchain bridge | 4001 | `npm run dev` in `services/blockchain-bridge/` |
| Crisis intelligence | 8001 | `uvicorn app.main:app` in `services/crisis-intelligence/` |
| AI summary | 8002 | `uvicorn app.main:app` in `services/ai-summary/` |
| OCR receipt | 8003 | `uvicorn app.main:app` in `services/ocr-receipt/` |
| Postgres | 5432 | `docker compose up -d postgres` |

## Quick Start (Local Dev)

```bash
# 1. Start Postgres + seed
docker compose up -d postgres
sleep 3
psql "postgres://postgres:postgres@localhost:5432/crisis_pool" -f migrations/0002_crisis_tables.sql
psql "postgres://postgres:postgres@localhost:5432/crisis_pool" -f migrations/seed.sql

# 2. Start API gateway (terminal 1)
cd services/api-gateway && npm install && npm run dev

# 3. Start frontend (terminal 2)
cd apps/web && npm run dev

# 4. Open http://localhost:3000
```
