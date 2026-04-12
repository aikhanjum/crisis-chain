# CrisisChain

On-chain crisis pools, a Rust indexer, Next.js web app (donor + NGO portal), Node API gateway, and a blockchain bridge for Humanity testnet. This README is the **single runbook** for getting everything running locally.

**Chain:** [Humanity testnet](https://explorer.testnet.humanity.org) (`CHAIN_ID=7080969`). Older docs may mention Arbitrum Sepolia — ignore those; follow [`.env.example`](.env.example) and this file.

---

## What’s in the repo

| Area | Path | Role |
|------|------|------|
| Contracts | [`contracts/`](contracts/) | `CrisisPoolVault`, `MockUSDC`, Foundry scripts |
| Indexer | [`crates/indexer/`](crates/indexer/) | Indexes `Donation` / `Payout` logs → Postgres; HTTP API |
| Web app | [`apps/web/`](apps/web/) | Main UI: globe, donate, NGO register/submit, dashboards |
| Wallet demo | [`apps/wallet/`](apps/wallet/) | Slim approve/donate/payout panel (optional) |
| API gateway | [`services/api-gateway/`](services/api-gateway/) | REST + JWT; regions; NGO routes; receipt pipeline |
| Blockchain bridge | [`services/blockchain-bridge/`](services/blockchain-bridge/) | `vault.payout`, `/ngos/approve`, `/reimbursement/submit` |
| Crisis intelligence | [`services/crisis-intelligence/`](services/crisis-intelligence/) | ACLED, region refresh (optional for map) |
| AI summary | [`services/ai-summary/`](services/ai-summary/) | Anthropic summaries (optional) |
| Database | [`migrations/`](migrations/) | Schema + [`migrations/seed.sql`](migrations/seed.sql) |
| Compose | [`docker-compose.yml`](docker-compose.yml) | Postgres, optional services |

Authoritative env templates: **root** [`.env.example`](.env.example), **web** [`apps/web/.env.example`](apps/web/.env.example).

---

## Prerequisites

- **Docker** — Postgres (`docker compose up -d postgres`)
- **Node 20+** — `apps/web`, `services/api-gateway`, `services/blockchain-bridge`
- **Rust (`cargo`)** — indexer ([`crates/indexer`](crates/indexer))
- **Foundry** (`forge`, `cast`) — optional; deploy contracts and mint mUSDC
- **Git submodules** — from repo root: `git submodule update --init --recursive` (contracts depend on `forge-std`, OpenZeppelin)

---

## 1. Environment variables

1. Copy templates (do **not** commit secrets):

   ```bash
   cp .env.example .env
   cp apps/web/.env.example apps/web/.env.local
   ```

2. Fill **root `.env`** at minimum:

   - **`RPC_URL`**, **`CHAIN_ID=7080969`**, **`PRIVATE_KEY`** (testnet deployer / operator)
   - **`USDC_ADDRESS`**, **`VAULT_ADDRESS`** (after deploy or from your team)
   - **`DATABASE_URL`** — e.g. `postgres://postgres:postgres@localhost:5432/crisis_pool`
   - **`START_BLOCK`** — block at or before vault deployment (for indexer)
   - **`JWT_SECRET`**, **`FRONTEND_URL=http://localhost:3000`**
   - **`BLOCKCHAIN_BRIDGE_URL=http://127.0.0.1:4001`** — gateway calls the bridge for vault payouts (see below)
   - **`HTTP_BIND_ADDR=0.0.0.0:3001`**, **`LOG_CHUNK_BLOCKS=10`** — indexer (Alchemy free tier limits `eth_getLogs` range; keep 10)

3. Fill **`apps/web/.env.local`** with the **same** chain + contract info exposed to the browser:

   - **`NEXT_PUBLIC_RPC_URL`**, **`NEXT_PUBLIC_CHAIN_ID`**, **`NEXT_PUBLIC_USDC_ADDRESS`**, **`NEXT_PUBLIC_VAULT_ADDRESS`**
   - **`NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:4000`**, **`NEXT_PUBLIC_INDEXER_URL=http://localhost:3001`**
   - **`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`** — from [WalletConnect Cloud](https://cloud.walletconnect.com)

4. Optional: **`ACLED_*`**, **`ANTHROPIC_API_KEY`**, **`PINATA_*`** — for crisis-intelligence, AI summary, IPFS (see [`.env.example`](.env.example)).

**Docker Compose:** `api-gateway` gets `BLOCKCHAIN_BRIDGE_URL` defaulting to `http://blockchain-bridge:4001` when both run in Compose. On the host, use `127.0.0.1:4001`.

---

## 2. Database

```bash
docker compose up -d postgres
```

On **first** container start, Postgres runs every `*.sql` file in [`migrations/`](migrations/) (see [`docker-compose.yml`](docker-compose.yml) `postgres:` `volumes`). If you already have an **old volume** without newer tables, either reset (`docker compose down -v` — **destroys data**) or apply new files manually:

```bash
psql "$DATABASE_URL" -f migrations/0006_sudan_haiti_regions.sql   # example
psql "$DATABASE_URL" -f migrations/seed.sql
```

[`migrations/seed.sql`](migrations/seed.sql) loads demo `crisis_nodes` and a test NGO. [`migrations/0006_sudan_haiti_regions.sql`](migrations/0006_sudan_haiti_regions.sql) adds extra Sudan/Haiti regions and can update `operated_regions` for NGOs.

**NGOs** need **`operated_regions`** set to real `crisis_nodes.region_id` values (comma-separated / array in Postgres), or receipt submission will show no regions. You can **`PATCH /ngo/profile`** after sign-in or update `ngos.operated_regions` in SQL for local dev.

---

## 3. Contracts (Humanity testnet)

From [`contracts/`](contracts/), with `PRIVATE_KEY` and `RPC_URL` in the environment:

```bash
cd contracts
forge script script/DeployMockUSDC.s.sol:DeployMockUSDC --rpc-url "$RPC_URL" --broadcast
forge script script/Deploy.s.sol:DeployScript --rpc-url "$RPC_URL" --broadcast
```

Put **`USDC_ADDRESS`** and **`VAULT_ADDRESS`** into `.env` and **`apps/web/.env.local`** as **`NEXT_PUBLIC_*`**.

**MockUSDC** exposes **`mint(address,uint256)`** for testnet demos — fund donor and treasury wallets as needed.

Set **`START_BLOCK`** in `.env` to the vault deployment block (or earlier) so the indexer sees events.

---

## 4. Services and ports (local dev)

| Service | Port | Command / notes |
|---------|------|------------------|
| **Postgres** | 5432 | `docker compose up -d postgres` |
| **Indexer** | **3001** | `cargo run -p indexer` (from repo root; loads root `.env`) |
| **API gateway** | **4000** | `cd services/api-gateway && npm install && npm run dev` (loads root `.env` via `package.json`) |
| **Blockchain bridge** | **4001** | `cd services/blockchain-bridge && npm install && source ../../.env && export CONTRACTS_OUT_DIR="$(pwd)/../../contracts/out" && PORT=4001 && npx tsx src/index.ts` |
| **Web** | **3000** | `cd apps/web && npm install && npm run dev` |

Use **`PORT=4000`** when starting the gateway if your shell sets **`PORT`** to something else.

**Blockchain bridge** needs compiled Foundry artifacts: run **`forge build`** in `contracts/` so `contracts/out/CrisisPoolVault.sol/CrisisPoolVault.json` exists.

**Recommended order:** Postgres → migrations/seed → indexer → api-gateway → blockchain-bridge → web.

Optional: [`scripts/start-local-backend.sh`](scripts/start-local-backend.sh) starts Postgres + indexer + gateway (adjust paths if needed).

---

## 5. Architecture (high level)

- **Donors** use the web app + wallet: **approve** mUSDC → **`donate(poolId, …)`** on **`CrisisPoolVault`** → funds sit in **`poolBalances[poolId]`**.
- **NGOs** register via **`POST /ngo/register`** (Postgres). Approval: **`POST /ngos/approve`** on the **blockchain-bridge** with `{ "walletAddress": "0x…" }` — grants **`PAYOUT_ROLE`** and sets **`ngos.status = 'approved'`** (treat as admin-only).
- **Ledger / pool stats** in the UI come from the **indexer** (`NEXT_PUBLIC_INDEXER_URL`).
- **Crisis regions** come from Postgres (`GET /regions` on the gateway); optional **crisis-intelligence** refreshes data.

---

## 6. Payments: three mechanisms (do not confuse them)

| Mechanism | Where | What moves |
|-----------|--------|------------|
| **Donation** | User wallet → `vault.donate` | USDC into **vault pool balance** on-chain |
| **Treasury transfer** | `POST /receipt/upload` (receipt-pipeline) | mUSDC from **gateway `PRIVATE_KEY`** wallet — **not** the same ledger as pool balance unless you intentionally fund that wallet |
| **Vault payout** | Bridge **`POST /reimbursement/submit`** or **NGO `payout`** with **`PAYOUT_ROLE`** | USDC **from the vault** to recipient (see [`contracts/src/CrisisPoolVault.sol`](contracts/src/CrisisPoolVault.sol) for reserve/cooldown rules) |

### Vault payout from the NGO dashboard (integrated)

- **`POST /ngo/receipt/:id/vault-payout`** (authenticated NGO) approves a pending receipt if needed, resolves **`poolId`** from **`crisis_nodes.pool_id`** or the same **deterministic** mapping as the web donate flow (`poolIdFromRegionId`), then calls the **blockchain-bridge** **`/reimbursement/submit`** so **`vault.payout`** runs.
- Requires **api-gateway**, **blockchain-bridge**, and **pool liquidity** (donations to that **`poolId`**). Set **`BLOCKCHAIN_BRIDGE_URL`** in `.env` if the bridge is not on `127.0.0.1:4001`.

---

## 7. NGO flow (short)

1. **`/ngo/register`** → row in **`ngos`** (status **`pending`**).
2. **`POST http://localhost:4001/ngos/approve`** with JSON **`{ "walletAddress": "0x…" }`** (bridge must use deployer key with vault admin).
3. Sign in (**`/auth/nonce`** + **`/auth/verify`**) → JWT.
4. Submit receipt **`POST /ngo/receipt`** with **`region_id`**, **`amount`**, **`notes`**.
5. Approve receipt in DB (or use flows that set **`approved`**) → **Execute vault payout** on the NGO dashboard or **`POST /ngo/receipt/:id/vault-payout`**.

---

## 8. Indexer and HTTP API

- **Health:** `GET http://localhost:3001/health`
- **Pool:** `GET http://localhost:3001/pools/:poolId` (pool id as used on-chain / indexer)

If logs don’t appear, lower **`START_BLOCK`** or confirm **`LOG_CHUNK_BLOCKS`** matches your RPC provider limits.

---

## 9. Verify with `cast` (optional)

With **`POOL_ID`**, **`AMOUNT`** (6 decimals), **`MEMO`** / **`PAYOUT_REF`** as `bytes32`:

```bash
cast send "$USDC_ADDRESS" "approve(address,uint256)" "$VAULT_ADDRESS" "$AMOUNT" --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
cast send "$VAULT_ADDRESS" "donate(uint256,uint256,bytes32)" "$POOL_ID" "$AMOUNT" "$MEMO" --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
```

---

## 10. Full functionality checklist

- [ ] Postgres up; migrations + optional [`migrations/seed.sql`](migrations/seed.sql)
- [ ] Root `.env` + `apps/web/.env.local` with matching **Humanity** RPC, **vault**, **USDC**
- [ ] **Indexer** on **:3001** with **`START_BLOCK`** and **`LOG_CHUNK_BLOCKS`**
- [ ] **API gateway** on **:4000** with **`JWT_SECRET`**, **`BLOCKCHAIN_BRIDGE_URL`** (if using vault payouts)
- [ ] **Blockchain bridge** on **:4001** with **`CONTRACTS_OUT_DIR`**, **`PRIVATE_KEY`**, same **`DATABASE_URL`**
- [ ] **Web** on **:3000**; WalletConnect project ID set
- [ ] Donor: gas + mUSDC + donate to the **same `poolId`** you use for payouts
- [ ] NGO: register → **approve** on bridge → **`operated_regions`** set → receipt → **vault payout**

---

## 11. Security

- **Private keys** in `.env` are for **development / testnet only**; rotate if exposed.
- **`POST /ngos/approve`** and bridge admin routes must be **protected** before any public deployment.
- Do not use single-key admin for production treasury; use multisig and audited ops.

---

## Further reading

- [`apps/web/README.md`](apps/web/README.md) — Next.js app
- [`apps/web/app/ngo/README.md`](apps/web/app/ngo/README.md) — NGO routes
- [`.env.example`](.env.example) — all variables grouped by subsystem
