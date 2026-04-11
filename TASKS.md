# CrisisChain — Outstanding Tasks

Ordered roughly by priority for the hackathon demo. Items marked **[DEMO CRITICAL]**
must be done before presenting. Items marked **[POST-DEMO]** can be deferred.

---

## Smart Contracts

- [ ] **[DEMO CRITICAL]** Deploy `MockUSDC` + `CrisisPoolVault` to Arbitrum Sepolia
  - `forge script contracts/script/DeployMockUSDC.s.sol --broadcast --rpc-url $RPC_URL`
  - `forge script contracts/script/Deploy.s.sol --broadcast --rpc-url $RPC_URL`
  - Fill `VAULT_ADDRESS`, `USDC_ADDRESS`, `START_BLOCK` in `.env`

- [ ] **[DEMO CRITICAL]** Mint test USDC to demo donor wallet
  - `cast send $USDC_ADDRESS "mint(address,uint256)" $DONOR_ADDR 10000000000 --rpc-url $RPC_URL --private-key $PRIVATE_KEY`

- [ ] **[POST-DEMO]** Write `ReimbursementQueue.sol`
  - FIFO queue across NGOs, enforcing per-NGO monthly cap
  - Wire to `CrisisPoolVault.payout()` so queue processes in order

- [ ] **[POST-DEMO]** Write `ApprovedItemsRegistry.sol`
  - On-chain record of approved goods categories, multisig-updatable
  - Sync with `approved_items` DB table

---

## Blockchain Bridge (`services/blockchain-bridge/`)

- [ ] **[DEMO CRITICAL]** Implement `deployPool()` in `src/services/deployer.ts`
  - Load compiled artifacts from `contracts/out/CrisisPoolVault.sol/CrisisPoolVault.json`
  - Call `walletClient.deployContract({ abi, bytecode, args: [usdcAddress, adminAddress] })`
  - After deploy, POST back to crisis-intelligence to write `pool_address` + `pool_id` to `crisis_nodes`

- [ ] **[DEMO CRITICAL]** Implement `watchPool()` in `src/services/events.ts`
  - `publicClient.watchContractEvent()` for `Donation` and `Payout` events
  - Upsert into `donations` / `payouts` tables
  - `NOTIFY` Postgres channel so WebSocket feed updates live

- [ ] **[DEMO CRITICAL]** Implement `POST /pools/pin-receipt`
  - Add `multer` for multipart parsing
  - Call `pinFile()` from `ipfs.ts` (already implemented)
  - Return IPFS CID to OCR service

- [ ] **[POST-DEMO]** Run `npm install` and verify TypeScript builds clean
  - `cd services/blockchain-bridge && npm install && npm run build`

---

## API Gateway (`services/api-gateway/`)

- [ ] **[DEMO CRITICAL]** Fix `ledger` query — `donations` and `payouts` tables have no `created_at` column
  - Either: `ALTER TABLE donations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`
  - Or: remove the `created_at` reference in `src/routes/regions.ts` and use `block_number` for ordering

- [ ] **[DEMO CRITICAL]** Complete EIP-191 signature verification in `src/middleware/auth.ts`
  - Install `viem`: `npm install viem`
  - Replace the commented TODO with:
    ```ts
    import { verifyMessage } from "viem";
    const recovered = await verifyMessage({ address, message: nonce, signature });
    if (recovered.toLowerCase() !== address.toLowerCase()) return null;
    ```

- [ ] **[DEMO CRITICAL]** Implement `POST /ngo/receipt` — proxy to OCR service
  - Use `http-proxy-middleware` or stream the multipart body to `http://ocr-receipt:8003/receipt/parse`
  - Forward the `Authorization` header so the OCR service knows which NGO submitted

- [ ] **[POST-DEMO]** Wire Postgres `LISTEN/NOTIFY` to WebSocket in `src/index.ts`
  - Subscribe to `donations_feed` channel on startup
  - Broadcast new donation/payout events to all connected WebSocket clients

- [ ] **[POST-DEMO]** Run `npm install` and verify TypeScript builds clean
  - `cd services/api-gateway && npm install && npm run build`

---

## OCR Receipt Service (`services/ocr-receipt/`)

- [ ] **[DEMO CRITICAL]** Implement `POST /receipt/submit`
  - Load the parsed receipt from DB (or pass receipt_id referencing a cached parse result)
  - Call `POST blockchain-bridge/pools/pin-receipt` → get IPFS CID
  - Insert into `receipt_requests` table
  - Return `{ queue_position, receipt_id, status: "queued" }`

- [ ] **[POST-DEMO]** Replace regex line-item parser with structured table extraction
  - Current heuristic only handles simple `"Item   qty   $price"` format
  - For production: use `pdfplumber` for PDFs, or Google Vision's `document_text_detection` for photos

---

## Crisis Intelligence (`services/crisis-intelligence/`)

- [ ] **[POST-DEMO]** NGO invite — JWT token validation on `POST /ngos/register`
  - `_verify_invite_token()` is already implemented in `app/routes/ngos.py`
  - Add a `token` query param to `POST /ngos/register`
  - Decode token → verify `discovered_ngo_id` + expiry
  - Use the token's `discovered_ngo_id` instead of email-matching to link records
  - Return `403` if token is missing, expired, or tampered

- [ ] **[POST-DEMO]** Admin bulk-invite endpoint
  - `POST /ngos/invite-all/{region_id}` — sends invites to all `status = 'discovered'` NGOs with emails in a region
  - Rate-limit to avoid Resend quota issues (e.g. 10/minute)

- [ ] **[POST-DEMO]** INFORM Risk Index integration
  - Currently `inform_score = 0.0` in `region_pipeline.py`
  - Fetch from `https://drmkc.jrc.ec.europa.eu/inform-index` or use their static CSV
  - Map ISO3 → INFORM score and pass into `build_crisis_node()`

- [ ] **[POST-DEMO]** Verify HDX HAPI endpoint paths
  - `/food/food-security` and `/coordination-context/refugees` paths may have changed
  - Check against live API docs at `https://hapi.humdata.org/docs`

---

## Frontend (`apps/web/`)

- [ ] **[DEMO CRITICAL]** Wire `CrisisMap` to real data
  - Replace placeholder div in `app/map/page.tsx` with `<CrisisMap>` component
  - Fetch from `GET /regions` via `useCrisisRegions()` hook
  - Seed data is already in DB — map should render immediately

- [ ] **[DEMO CRITICAL]** Implement `DonateForm` component (`components/donate/DonateForm.tsx`)
  - `<ConnectButton />` from RainbowKit
  - `useWriteContract` → `USDC.approve(vaultAddress, amount)` then `vault.donate(poolId, amount, memo)`
  - Show tx hash + Arbiscan link on confirmation

- [ ] **[DEMO CRITICAL]** Implement ledger page data display (`app/pool/[regionId]/ledger/page.tsx`)
  - Fetch from `GET /regions/:id/ledger`
  - Merge donations + payouts into a single timeline sorted by block number

- [ ] **[POST-DEMO]** NGO register page — read invite token from URL
  - `const token = searchParams.get("token")`
  - Decode token client-side (base64) to pre-fill org name
  - Send token with `POST /ngos/register` once wallet auth is validated

- [ ] **[POST-DEMO]** Add `<ConnectButton />` to map page nav

---

## Infrastructure

- [ ] **[POST-DEMO]** Write `crates/indexer/Dockerfile` (referenced in `docker-compose.yml` but doesn't exist)
- [ ] **[POST-DEMO]** Add `created_at` column to `donations` and `payouts` tables via migration `0004`
- [ ] **[POST-DEMO]** Global `.env` — consolidate all service env vars so `docker compose up` works with one file
- [ ] **[POST-DEMO]** Replace admin private key with Safe multisig before mainnet
