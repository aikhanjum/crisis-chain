---
name: Full app setup guide
overview: "A single reference for running CrisisChain end-to-end: infrastructure, environment variables, Humanity testnet wallets (donor + NGO), how money actually moves on-chain vs. demo treasury transfers, and which backend services power the map, regions, and NGO portal."
todos:
  - id: copy-env
    content: Copy root .env.example to .env and apps/web/.env.example to .env.local; fill RPC, contracts, DB, ACLED, Anthropic, Pinata, WalletConnect, JWT_SECRET
    status: pending
  - id: infra-db
    content: Start Postgres via docker compose; run migrations/seed.sql if you need demo regions
    status: pending
  - id: chain-indexer
    content: Deploy or configure USDC/Vault; set START_BLOCK; run Rust indexer on :3001
    status: pending
  - id: services
    content: Run api-gateway (with root .env for chain keys if using treasury payouts); crisis-intelligence + ai-summary; optional blockchain-bridge and ocr-receipt
    status: pending
  - id: wallets
    content: Fund donor with gas + mint mUSDC; register NGO and approve via bridge; test donate vs payout paths you intend to demo
    status: pending
isProject: false
---

# Full functionality setup guide (CrisisChain)

This monorepo combines a **Next.js web app** ([apps/web](apps/web)), a **Rust indexer** ([crates/indexer](crates/indexer)), a **Node API gateway** ([services/api-gateway](services/api-gateway)), **Python services** (crisis intelligence, OCR, AI summary), and a **blockchain bridge** ([services/blockchain-bridge](services/blockchain-bridge)). The authoritative env template is the **root** [.env.example](.env.example); the web app adds public URLs in [apps/web/.env.example](apps/web/.env.example).

**Note:** The root [README.md](README.md) still describes an older “Arbitrum Sepolia” runbook in places, while the app and [.env.example](.env.example) target **Humanity testnet** (`CHAIN_ID=7080969`). Follow [.env.example](.env.example) and [apps/web/README.md](apps/web/README.md) for the current stack.

---

## Quick links: files to create or edit

Use these paths in the repo (click to open). **You do not commit secrets** — copy templates, then fill the real values locally.


| What you are configuring                            | Template / source of truth                                                                                                                                                                                      | Where it is consumed                                                                                                                                                                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Master env (most services)**                      | Create `**.env`** in the repo root by copying [.env.example](.env.example)                                                                                                                                      | Loaded by [docker-compose.yml](docker-compose.yml) for Compose services; [services/api-gateway](services/api-gateway) `npm run dev` also loads root `.env` via [services/api-gateway/package.json](services/api-gateway/package.json) |
| **Web public URLs + chain addresses**               | Create `**apps/web/.env.local`** from [apps/web/.env.example](apps/web/.env.example)                                                                                                                            | Read at build/runtime in [apps/web/lib/constants.ts](apps/web/lib/constants.ts)                                                                                                                                                       |
| **API gateway (optional overrides)**                | [services/api-gateway/.env.example](services/api-gateway/.env.example) — copy to `services/api-gateway/.env` if needed                                                                                          | [services/api-gateway/src/index.ts](services/api-gateway/src/index.ts), routes under [services/api-gateway/src/routes/](services/api-gateway/src/routes/)                                                                             |
| **Treasury / chain in gateway**                     | Same keys as root `.env` — `PRIVATE_KEY`, `CHAIN_ID`, `RPC_URL`, `USDC_ADDRESS` in **root `.env`**                                                                                                              | [services/api-gateway/src/lib/chain.ts](services/api-gateway/src/lib/chain.ts)                                                                                                                                                        |
| **Blockchain bridge**                               | [services/blockchain-bridge/.env.example](services/blockchain-bridge/.env.example)                                                                                                                              | [docker-compose.yml](docker-compose.yml) `blockchain-bridge` service; bridge entry [services/blockchain-bridge/src/index.ts](services/blockchain-bridge/src/index.ts)                                                                 |
| **Crisis intelligence**                             | [services/crisis-intelligence/.env.example](services/crisis-intelligence/.env.example)                                                                                                                          | Python app under [services/crisis-intelligence/app/](services/crisis-intelligence/app/)                                                                                                                                               |
| **AI summary**                                      | [services/ai-summary/.env.example](services/ai-summary/.env.example)                                                                                                                                            | [services/ai-summary/](services/ai-summary/)                                                                                                                                                                                          |
| **OCR receipt**                                     | [services/ocr-receipt/.env.example](services/ocr-receipt/.env.example)                                                                                                                                          | [services/ocr-receipt/](services/ocr-receipt/)                                                                                                                                                                                        |
| **Rust indexer env**                                | No separate file — set vars in **root `.env`** (same as [.env.example](.env.example): `RPC_URL`, `CHAIN_ID`, `VAULT_ADDRESS`, `USDC_ADDRESS`, `DATABASE_URL`, `START_BLOCK`, `CONFIRMATIONS`, `HTTP_BIND_ADDR`) | [crates/indexer/src/main.rs](crates/indexer/src/main.rs)                                                                                                                                                                              |
| **Compose wiring (which container gets which env)** | [docker-compose.yml](docker-compose.yml)                                                                                                                                                                        | Cross-check variable names against [.env.example](.env.example)                                                                                                                                                                       |
| **Contracts / deploy scripts**                      | [contracts/script/](contracts/script/), [contracts/src/MockUSDC.sol](contracts/src/MockUSDC.sol), [contracts/src/CrisisPoolVault.sol](contracts/src/CrisisPoolVault.sol)                                        | Addresses go into root `.env` and [apps/web/.env.local](apps/web/.env.local)                                                                                                                                                          |
| **DB schema & seed**                                | [migrations/](migrations/), [migrations/seed.sql](migrations/seed.sql)                                                                                                                                          | Postgres (via Compose volume mount in [docker-compose.yml](docker-compose.yml))                                                                                                                                                       |


---

## Architecture (what talks to what)

```mermaid
flowchart LR
  subgraph client [Browser]
    Web[apps/web Next.js]
    Wallet[RainbowKit Wallet]
  end
  subgraph chain [Humanity testnet]
    USDC[MockUSDC mUSDC]
    Vault[CrisisPoolVault]
  end
  Web --> Wallet
  Wallet --> USDC
  Wallet --> Vault
  Web --> GW[api-gateway :4000]
  GW --> PG[(Postgres)]
  GW --> CI[crisis-intelligence :8001]
  CI --> AIS[ai-summary :8002]
  CI --> BB[blockchain-bridge :4001]
  BB --> Vault
  Web --> IDX[indexer :3001]
  IDX --> PG
```



- **Donors** interact with **USDC + Vault** in the wallet (approve → `donate`).
- **NGOs** use the **API gateway** for registration, JWT auth, and receipt rows in Postgres.
- **Pool analytics / ledger** in the UI typically come from the **indexer** (`NEXT_PUBLIC_INDEXER_URL`).
- **Live crisis data** (ACLED → summaries → DB) flows through **crisis-intelligence**; the map’s “refresh” calls `POST /regions/refresh` on the gateway, which proxies to that service — see [services/api-gateway/src/routes/regions.ts](services/api-gateway/src/routes/regions.ts).

---

## 1. Prerequisites


| Tool                          | Why                                                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Docker**                    | Postgres (`docker compose up -d postgres`); optional full stack via `[docker-compose.yml](docker-compose.yml)`                                                                                         |
| **Node 20+**                  | `apps/web`, `services/api-gateway`                                                                                                                                                                     |
| **Rust / `cargo`**            | `[crates/indexer](crates/indexer)` — the Compose `indexer` service references a Dockerfile that **does not exist** yet; run the indexer **on the host** per `[apps/web/README.md](apps/web/README.md)` |
| **Foundry** (`forge`, `cast`) | Optional: deploy `[contracts/](contracts/)` and mint test USDC                                                                                                                                         |
| **Wallet**                    | MetaMask, Rabby, etc., plus a **[WalletConnect Cloud](https://cloud.walletconnect.com) project ID** for RainbowKit                                                                                     |


---

## 2. Environment variables (what to fill)

Templates live in [.env.example](.env.example) (repo root) and per-service `.env.example` files. **You create** a real `**.env`** at the repo root (do not commit it). Below, each block lists **where to type the values** and **which files read them**.

### Root `.env` — groups (copy from [.env.example](.env.example))

1. **Map / ACLED (crisis-intelligence)**
  - **Variables:** `ACLED_EMAIL`, `ACLED_PASSWORD` (or `ACLED_ACCESS_TOKEN`); optional `HDX_HAPI_*`; optional `VITE_MAPBOX_TOKEN` only if you run the separate [apps/map](apps/map) app.  
  - **Edit:** [.env.example](.env.example) → your root `**.env`**; same keys are wired into the `crisis-intelligence` service in [docker-compose.yml](docker-compose.yml) (`ACLED_*`, `HDX_*`, etc.).  
  - **Consumed by:** Python service under [services/crisis-intelligence/app/](services/crisis-intelligence/app/) (e.g. ACLED fetch, region refresh). `VITE_MAPBOX_TOKEN` is for [apps/map](apps/map), not the main globe — see [apps/web/components/map/CrisisMap.tsx](apps/web/components/map/CrisisMap.tsx).
2. **Blockchain (shared)**
  - **Variables:** `RPC_URL`, `CHAIN_ID` (7080969), `PRIVATE_KEY` (deployer / operator — **testnet only**), `USDC_ADDRESS`, `VAULT_ADDRESS`, `START_BLOCK`, `CONFIRMATIONS`.  
  - **Edit:** [.env.example](.env.example) → root `**.env`**. After deploying the vault, set `**START_BLOCK`** to the vault deployment block (see deploy output or explorer) so the indexer ingests events from the correct height — documented inline in [.env.example](.env.example).  
  - **Consumed by:**  
    - **Indexer (Rust):** reads `RPC_URL`, `CHAIN_ID`, `VAULT_ADDRESS`, `USDC_ADDRESS`, `DATABASE_URL`, `START_BLOCK`, `CONFIRMATIONS`, `HTTP_BIND_ADDR` — see [crates/indexer/src/main.rs](crates/indexer/src/main.rs). Compose passes these from env in [docker-compose.yml](docker-compose.yml) under `indexer:` (profile `indexer`).  
    - **Blockchain bridge:** `RPC_URL`, `PRIVATE_KEY`, `VAULT_ADDRESS`, `USDC_ADDRESS` — [docker-compose.yml](docker-compose.yml) `blockchain-bridge:`; viem clients load from env in [services/blockchain-bridge/src/services/deployer.ts](services/blockchain-bridge/src/services/deployer.ts).  
    - **Web (browser):** does **not** read root `.env` — you **mirror** contract addresses and RPC into `**apps/web/.env.local`** as `NEXT_PUBLIC_*` (template [apps/web/.env.example](apps/web/.env.example); see **Web app** subsection below).
3. **Database**
  - **Variable:** `DATABASE_URL` — e.g. `postgres://postgres:postgres@localhost:5432/crisis_pool` when Postgres runs on your host from Compose.  
  - **Edit:** [.env.example](.env.example) → root `**.env`**. Must match the Postgres service in [docker-compose.yml](docker-compose.yml) (`postgres:` user/db/password/ port **5432**).  
  - **Consumed by:** [docker-compose.yml](docker-compose.yml) passes `DATABASE_URL` into `api-gateway`, `blockchain-bridge`, and (via URL scheme variants) Python services; the Rust indexer reads `DATABASE_URL` from env — [crates/indexer/src/main.rs](crates/indexer/src/main.rs). Local `npm run dev` for [services/api-gateway](services/api-gateway) uses the root `.env` per [services/api-gateway/package.json](services/api-gateway/package.json).
4. **Indexer HTTP port**
  - **Variable:** `HTTP_BIND_ADDR` (e.g. `0.0.0.0:3001`).  
  - **Edit:** [.env.example](.env.example) → root `**.env`**.  
  - **Consumed by:** [crates/indexer/src/main.rs](crates/indexer/src/main.rs). Align with `NEXT_PUBLIC_INDEXER_URL` in `**apps/web/.env.local`** ([apps/web/.env.example](apps/web/.env.example)).
5. **API gateway (HTTP + CORS)**
  - **Variables:** `JWT_SECRET`, `FRONTEND_URL`.  
  - **Edit:** [.env.example](.env.example) → root `**.env`**; optional override in [services/api-gateway/.env.example](services/api-gateway/.env.example) → `services/api-gateway/.env`.  
  - **Consumed by:** [services/api-gateway/src/index.ts](services/api-gateway/src/index.ts) (`JWT_SECRET`, CORS `FRONTEND_URL`). Compose: [docker-compose.yml](docker-compose.yml) `api-gateway:`.
6. **Treasury USDC transfers (receipt upload path)** — *same chain keys as §2*
  - **Variables:** `PRIVATE_KEY`, `USDC_ADDRESS`, `RPC_URL`, `CHAIN_ID` (already in root `.env` for blockchain).  
  - **Edit:** root `**.env`** — [services/api-gateway/src/lib/chain.ts](services/api-gateway/src/lib/chain.ts) loads these when the gateway process starts.  
  - **Consumed by:** [services/api-gateway/src/lib/chain.ts](services/api-gateway/src/lib/chain.ts) (`transferUsdcTo`), [services/api-gateway/src/routes/receipt-pipeline.ts](services/api-gateway/src/routes/receipt-pipeline.ts). **Note:** [docker-compose.yml](docker-compose.yml) `api-gateway` does **not** pass `PRIVATE_KEY` / `RPC_URL` / `CHAIN_ID`; for `POST /receipt/upload` payouts, run the gateway on the host with a filled root `.env` or extend Compose.
7. **AI (Anthropic)**
  - **Variable:** `ANTHROPIC_API_KEY`.  
  - **Edit:** [.env.example](.env.example) → root `**.env`** (Compose substitutes into `ai-summary`). Per-service template: [services/ai-summary/.env.example](services/ai-summary/.env.example).  
  - **Consumed by:** `ai-summary` in [docker-compose.yml](docker-compose.yml); service code under [services/ai-summary/](services/ai-summary/).
8. **IPFS (Pinata)**
  - **Variables:** `PINATA_API_KEY`, `PINATA_SECRET_KEY`.  
  - **Edit:** [.env.example](.env.example) → root `**.env`**. Template detail: [services/blockchain-bridge/.env.example](services/blockchain-bridge/.env.example).  
  - **Consumed by:** [docker-compose.yml](docker-compose.yml) `blockchain-bridge:`; pinning helpers under [services/blockchain-bridge/](services/blockchain-bridge/).
9. **WalletConnect (Compose + web)**
  - **Variables:** `WALLETCONNECT_PROJECT_ID` (Compose / root) and `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (web).  
  - **Edit:** [.env.example](.env.example) → root `**.env`**; same project ID in `**apps/web/.env.local`** from [apps/web/.env.example](apps/web/.env.example). [docker-compose.yml](docker-compose.yml) `web:` profile `frontend` maps `WALLETCONNECT_PROJECT_ID`.  
  - **Consumed by:** Next.js public env in [apps/web/lib/constants.ts](apps/web/lib/constants.ts).

### Web app `apps/web/.env.local` (from [apps/web/.env.example](apps/web/.env.example))

- **Edit:** create `**apps/web/.env.local`** next to [apps/web/.env.example](apps/web/.env.example).  
- **Variables:** `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_USDC_ADDRESS`, `NEXT_PUBLIC_VAULT_ADDRESS`, `NEXT_PUBLIC_EXPLORER_BASE_URL`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_INDEXER_URL` (default `http://localhost:3001`), `NEXT_PUBLIC_API_GATEWAY_URL` (default `http://localhost:4000`).  
- **Consumed by:** [apps/web/lib/constants.ts](apps/web/lib/constants.ts) (and any `process.env.NEXT_PUBLIC_*` usage in the app). **Mirror** `USDC_ADDRESS` / `VAULT_ADDRESS` / `RPC_URL` / `CHAIN_ID` from your deployment — same values as root `.env`, exposed to the browser with the `NEXT_PUBLIC_` prefix.

---

## 3. Database and seed data

1. Start Postgres: `docker compose up -d postgres` (migrations run from [migrations/](migrations/) on first init — see [docker-compose.yml](docker-compose.yml) `postgres:` `volumes`).
2. Optionally load demo regions: `psql "$DATABASE_URL" -f migrations/seed.sql` — data file [migrations/seed.sql](migrations/seed.sql).
3. **NGO approval** is stored in `ngos.status` (`pending` → `approved`); the blockchain-bridge can sync this when you call its approve endpoint (see below).

---

## 4. Contracts and chain (Humanity testnet)

1. Deploy **MockUSDC** and **CrisisPoolVault** (scripts under `[contracts/script/](contracts/script/)`) using your `RPC_URL` and `PRIVATE_KEY`, or use addresses someone else deployed on the same network.
2. Put `USDC_ADDRESS` and `VAULT_ADDRESS` in **root `.env`** and **mirror** them into `apps/web/.env.local` as `NEXT_PUBLIC_*`.
3. **MockUSDC** is permissionless `mint(address,uint256)` (`[contracts/src/MockUSDC.sol](contracts/src/MockUSDC.sol)`) — mint test **mUSDC** to donor and (if needed) treasury wallets.
4. **Native token** on Humanity testnet is used **only for gas** (same as `tHP` / native H in config comments).

**Vault behavior (donations vs payouts):**  

- Donors call `donate(poolId, amount, memo)` after **ERC-20 approve** to the vault — [contracts/src/CrisisPoolVault.sol](contracts/src/CrisisPoolVault.sol).  
- `payout(...)` is restricted to callers with **PAYOUT_ROLE**. The deployer/admin starts with that role. The bridge can `grantRole(PAYOUT_ROLE, ngoWallet)` when an NGO is approved — [services/blockchain-bridge/src/services/ngo.ts](services/blockchain-bridge/src/services/ngo.ts) — which lets that NGO **initiate payouts** from the wallet UI in demos; alternatively a **server key** with `PAYOUT_ROLE` can call `payout` on behalf of the system — [services/blockchain-bridge/src/services/reimbursement.ts](services/blockchain-bridge/src/services/reimbursement.ts).

---

## 5. Donor wallet: setup and flow

1. Install a browser wallet and add **Humanity testnet** (chain id **7080969**) using your `NEXT_PUBLIC_RPC_URL`.
2. Get **native tokens** for gas from a Humanity testnet faucet (not in-repo).
3. **Mint mUSDC** to your address via `MockUSDC.mint` (e.g. `cast send` or a small script).
4. In the app (`/donate/...` or [apps/web/components/wallet/DonorWalletPanel.tsx](apps/web/components/wallet/DonorWalletPanel.tsx)): **Connect** → confirm the UI shows the correct chain → **Approve** mUSDC to the vault → **Donate** to the pool id tied to the region (pool id must exist in your DB/indexer; crisis-intelligence can deploy pools when thresholds are met — see [services/crisis-intelligence](services/crisis-intelligence)).
5. **WalletConnect**: create a project at [WalletConnect Cloud](https://cloud.walletconnect.com) and set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in [apps/web/.env.local](apps/web/.env.local) (template: [apps/web/.env.example](apps/web/.env.example)); without it, RainbowKit may not work well on mobile.

---

## 6. NGO wallet: setup and flow

Product notes and route list: [apps/web/app/ngo/README.md](apps/web/app/ngo/README.md).

1. Use a **dedicated wallet address** per NGO (matches `wallet_address` in Postgres).
2. **Register** at `/ngo/register`: connect wallet, fill org details; this hits `POST /ngo/register` — [services/api-gateway/src/routes/ngo.ts](services/api-gateway/src/routes/ngo.ts) — and creates a `pending` row.
3. **Approval (off-chain + on-chain):**
  - **On-chain:** call `POST /ngos/approve` on **blockchain-bridge** with `{ "walletAddress": "0x..." }` — [services/blockchain-bridge/src/routes/ngos.ts](services/blockchain-bridge/src/routes/ngos.ts) — this grants `PAYOUT_ROLE` and sets `ngos.status = 'approved'`. This endpoint is described as admin-only; secure it before any public deployment.  
  - Ensure the NGO’s `operated_regions` in the DB include region ids they can use (via profile update after sign-in, or direct SQL for dev).
4. **Sign-in:** the web app uses **wallet nonce + signature** (`/auth/nonce`, `/auth/verify`) — see [apps/web/hooks/useWallet.ts](apps/web/hooks/useWallet.ts). Optional **email/password** login exists if `password_hash` is set on the NGO row — [services/api-gateway/src/index.ts](services/api-gateway/src/index.ts).
5. **Submit receipt:** [apps/web/components/ngo/NgoSubmitClient.tsx](apps/web/components/ngo/NgoSubmitClient.tsx) currently posts `POST /ngo/receipt` with JSON (fixed demo amount/notes) — it does **not** wire the multipart `POST /receipt/upload` pipeline. That upload route performs **treasury** [transferUsdcTo](services/api-gateway/src/lib/chain.ts) — [services/api-gateway/src/routes/receipt-pipeline.ts](services/api-gateway/src/routes/receipt-pipeline.ts). Full OCR → IPFS → **vault payout** would be the [services/ocr-receipt](services/ocr-receipt) + [services/blockchain-bridge](services/blockchain-bridge) path in a more complete integration.

---

## 7. Payments: three concepts to keep straight


| Mechanism                    | Where                                                                                                                                                                                                | What happens                                                                                                                                                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Donation**                 | User wallet                                                                                                                                                                                          | User approves mUSDC, calls `vault.donate` — funds sit in **poolBalances** on the vault.                                                                                                                                                                                 |
| **Treasury ERC-20 transfer** | `POST /receipt/upload` in api-gateway                                                                                                                                                                | [transferUsdcTo](services/api-gateway/src/lib/chain.ts) sends mUSDC from the **treasury private key** to the NGO — **not** the same accounting as vault pool balance unless you fund the treasury deliberately. Uses MockUSDC `mint` on the treasury if balance is low. |
| **Vault `payout`**           | blockchain-bridge `POST /reimbursement/submit` — [services/blockchain-bridge/src/routes/reimbursement.ts](services/blockchain-bridge/src/routes/reimbursement.ts) — or any wallet with `PAYOUT_ROLE` | Moves USDC **from the vault pool** to `recipient`, subject to cooldown/reserve rules in [contracts/src/CrisisPoolVault.sol](contracts/src/CrisisPoolVault.sol).                                                                                                         |


For a coherent demo, pick **one** reimbursement story: either fund the **vault** via donations and use **vault payouts**, or demo **treasury transfers** from the gateway — mixing without understanding will confuse balances.

---

## 8. Backend: recommended startup order (local dev)

1. **Postgres** — `docker compose up -d postgres`
2. **Migrations + optional seed**
3. **Indexer** — `HTTP_BIND_ADDR=0.0.0.0:3001 cargo run -p indexer` (from repo root with Rust env)
4. **API gateway** — `cd services/api-gateway && npm install && npm run dev` (loads root `.env`)
5. **Crisis intelligence + AI summary** — e.g. `docker compose up -d crisis-intelligence ai-summary` (needs `ANTHROPIC_API_KEY`, ACLED creds in env)
6. **Blockchain bridge** — if you need IPFS or `/ngos/approve` / `/reimbursement/submit`: `docker compose up -d blockchain-bridge` or run locally with Foundry artifacts mounted as in Compose
7. **Web** — `cd apps/web && npm install && npm run dev`

Optional: **OCR service** (`ocr-receipt`) if you integrate that pipeline.

---

## 9. “Full functionality” checklist

- Postgres up; [migrations/](migrations/) applied; [migrations/seed.sql](migrations/seed.sql) loaded if you want instant map points.  
- **Humanity testnet** RPC + deployed **USDC + Vault** addresses in [.env.example](.env.example) → your root `.env` and [apps/web/.env.local](apps/web/.env.local).  
- **Indexer** running with correct `START_BLOCK` — vars in [.env.example](.env.example), code in [crates/indexer/src/main.rs](crates/indexer/src/main.rs); `NEXT_PUBLIC_INDEXER_URL` in [apps/web/.env.local](apps/web/.env.local) points to it.  
- **API gateway** running — [services/api-gateway](services/api-gateway); `JWT_SECRET` in root `.env` ([.env.example](.env.example)); if using **treasury payouts**, root `.env` has `PRIVATE_KEY`, `CHAIN_ID`, `RPC_URL`, `USDC_ADDRESS` for [services/api-gateway/src/lib/chain.ts](services/api-gateway/src/lib/chain.ts).  
- **Crisis intelligence + Anthropic** — [services/crisis-intelligence/.env.example](services/crisis-intelligence/.env.example), [services/ai-summary/.env.example](services/ai-summary/.env.example); **ACLED** for `/regions/refresh` via [services/api-gateway/src/routes/regions.ts](services/api-gateway/src/routes/regions.ts).  
- **WalletConnect project ID** in [apps/web/.env.local](apps/web/.env.local).  
- Donor: gas + mUSDC + approve + donate ([apps/web/components/wallet/DonorWalletPanel.tsx](apps/web/components/wallet/DonorWalletPanel.tsx)).  
- NGO: register ([apps/web/app/ngo/register/page.tsx](apps/web/app/ngo/register/page.tsx)) → **approve** via [services/blockchain-bridge/src/routes/ngos.ts](services/blockchain-bridge/src/routes/ngos.ts) (or manual DB + on-chain role) → wallet sign-in ([apps/web/hooks/useWallet.ts](apps/web/hooks/useWallet.ts)) → receipt flow you actually wired ([apps/web/components/ngo/NgoSubmitClient.tsx](apps/web/components/ngo/NgoSubmitClient.tsx) vs [services/api-gateway/src/routes/receipt-pipeline.ts](services/api-gateway/src/routes/receipt-pipeline.ts) vs OCR).

---

## 10. Security (from README and code comments)

- Treat all **private keys** as **testnet/dev only**; do not reuse for mainnet.  
- `POST /ngos/approve` and bridge admin surfaces should be **authenticated** before any public exposure.  
- Production would need multisig custody, hardened key management, and reviewed access control — called out in [README.md](README.md).

