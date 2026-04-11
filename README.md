# On-Chain Crisis Pools + Rust Indexer

Monorepo for:

- `contracts/`: Foundry Solidity contracts for donation pools and payouts.
- `crates/indexer/`: Rust service that indexes contract events into PostgreSQL and exposes a read API.
- `apps/wallet/`: Next.js wallet UI for approve/donate/payout demo on Humanity testnet.

## Structure

- `contracts/src/CrisisPoolVault.sol`: pool treasury contract
- `contracts/src/MockUSDC.sol`: 6-decimal ERC-20 for demos/tests
- `contracts/test/CrisisPoolVault.t.sol`: contract tests
- `contracts/script/Deploy.s.sol`: vault deployment script
- `contracts/script/DeployMockUSDC.s.sol`: mock token deployment script
- `crates/indexer/src/main.rs`: indexer + HTTP API entrypoint
- `apps/wallet/app/page.tsx`: wallet demo entrypoint
- `migrations/0001_init.sql`: PostgreSQL schema
- `.env.example`: required configuration

## Prerequisites

- Foundry (`forge`, `cast`)
- Rust toolchain (`cargo`)
- Docker (for local Postgres)
- Arbitrum Sepolia RPC URL + funded Sepolia key

## Environment

Copy `.env.example` to `.env` and fill in values:

- `RPC_URL`: Arbitrum Sepolia RPC endpoint
- `PRIVATE_KEY`: dev key used for Sepolia deploy/transactions only
- `USDC_ADDRESS`: token used by vault (official test token or deployed `MockUSDC`)
- `VAULT_ADDRESS`: deployed `CrisisPoolVault` address
- `DATABASE_URL`: Postgres DSN
- `START_BLOCK`: vault deployment block
- `CONFIRMATIONS`: indexing safety depth

## Verify Locally

Run contract tests:

```bash
source /Users/aikhan/.zshenv
forge test --root contracts
```

Compile Rust indexer:

```bash
source "$HOME/.cargo/env"
cargo check -p indexer
```

## End-to-end Runbook (Arbitrum Sepolia)

### 1) Start Postgres

```bash
docker compose up -d postgres
```

### 2) Deploy MockUSDC (optional, if you do not use an existing test token)

```bash
source /Users/aikhan/.zshenv
forge script contracts/script/DeployMockUSDC.s.sol:DeployMockUSDC \
  --rpc-url "$RPC_URL" \
  --broadcast
```

Copy the logged token address into `USDC_ADDRESS` in `.env`.

### 3) Deploy CrisisPoolVault

```bash
source /Users/aikhan/.zshenv
forge script contracts/script/Deploy.s.sol:DeployScript \
  --rpc-url "$RPC_URL" \
  --broadcast
```

Copy the deployed vault address into `VAULT_ADDRESS` in `.env`.

### 4) Set `START_BLOCK`

Set `START_BLOCK` to the vault deployment block number. You can query it by tx hash in the explorer or with `cast`.

### 5) Start indexer + API

```bash
source "$HOME/.cargo/env"
cargo run -p indexer
```

The service runs:

- indexer loop against `RPC_URL`
- HTTP API on `HTTP_BIND_ADDR` (default `0.0.0.0:3000`)

### 6) Donate to a pool

Choose values:

- `POOL_ID=1`
- `AMOUNT=25000000` (25 USDC with 6 decimals)
- `MEMO=0x646f6e6174696f6e2d3100000000000000000000000000000000000000000000` (`donation-1`)

Approve token spend:

```bash
source /Users/aikhan/.zshenv
cast send "$USDC_ADDRESS" "approve(address,uint256)" "$VAULT_ADDRESS" "$AMOUNT" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY"
```

Call donate:

```bash
source /Users/aikhan/.zshenv
cast send "$VAULT_ADDRESS" "donate(uint256,uint256,bytes32)" "$POOL_ID" "$AMOUNT" "$MEMO" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY"
```

### 7) Payout to NGO wallet

Set recipient and payout ref:

- `NGO=0x...`
- `PAYOUT_AMOUNT=5000000` (5 USDC)
- `PAYOUT_REF=0x7061796f75742d31000000000000000000000000000000000000000000000000` (`payout-1`)

```bash
source /Users/aikhan/.zshenv
cast send "$VAULT_ADDRESS" "payout(uint256,address,uint256,bytes32)" "$POOL_ID" "$NGO" "$PAYOUT_AMOUNT" "$PAYOUT_REF" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY"
```

### 8) Verify indexed data in DB

```bash
psql "$DATABASE_URL" -c "SELECT tx_hash, pool_id, amount_raw, donor FROM donations ORDER BY block_number DESC LIMIT 5;"
psql "$DATABASE_URL" -c "SELECT tx_hash, pool_id, amount_raw, recipient FROM payouts ORDER BY block_number DESC LIMIT 5;"
```

### 9) Verify pool totals in API

```bash
curl "http://localhost:3000/health"
curl "http://localhost:3000/pools/1"
```

Expected `pools/1` fields:

- `total_donated_raw`
- `total_paid_out_raw`
- `net_raw`

## Wallet demo app (`apps/wallet`)

### Wallet env setup

Copy `apps/wallet/.env.example` to `apps/wallet/.env.local` and fill:

- `NEXT_PUBLIC_CHAIN_ID=7080969`
- `NEXT_PUBLIC_RPC_URL`: Humanity testnet RPC URL
- `NEXT_PUBLIC_USDC_ADDRESS`: deployed `MockUSDC` (or test token) address
- `NEXT_PUBLIC_VAULT_ADDRESS`: deployed `CrisisPoolVault` address
- `NEXT_PUBLIC_EXPLORER_BASE_URL`: Humanity explorer base URL
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: WalletConnect Cloud project ID

### Startup order (full demo)

1. Start Postgres
2. Start Rust indexer API
3. Start wallet frontend

```bash
docker compose up -d postgres
source "$HOME/.cargo/env"
cargo run -p indexer
```

In a second terminal:

```bash
cd apps/wallet
npm install
npm run dev
```

### Demo checklist

- Connect wallet in `apps/wallet` and confirm chain badge says `(ok)`.
- Run `Approve`, then `Donate`, then `Payout`.
- Confirm each transaction appears in session history with explorer link.
- Click `Refresh` in Pool Analytics and verify totals match your expected math.
- Verify API directly with `curl "http://localhost:3000/pools/<pool_id>"`.

## Security notes for v1

- `.env` private keys are for development/testnet only.
- Do not use this setup for production treasury custody.
- Before mainnet, replace single-key admin with Safe multisig and run operational hardening.
