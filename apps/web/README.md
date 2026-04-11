# CrisisChain Web App

Primary frontend for CrisisChain with:

- public crisis map and donation surfaces
- NGO portal routes
- donor wallet flows wired to Humanity testnet

## Donor wallet routes

- `/donate/[regionId]` -> primary donor flow with region-scoped pool
- `/donor/wallet` -> advanced transaction console (manual pool controls)

The standalone `apps/wallet` app is still kept as a fallback demo.

## Environment setup

Copy `.env.example` to `.env.local` and fill your deployed addresses:

```bash
cp .env.example .env.local
```

Required keys:

- `NEXT_PUBLIC_CHAIN_ID=7080969`
- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_USDC_ADDRESS`
- `NEXT_PUBLIC_VAULT_ADDRESS`
- `NEXT_PUBLIC_EXPLORER_BASE_URL`
- `NEXT_PUBLIC_INDEXER_URL` (default `http://localhost:3001`)
- `NEXT_PUBLIC_API_GATEWAY_URL` (default `http://localhost:4000`)

## Startup order for full donor demo

From monorepo root:

1. Start Postgres
2. Start Rust indexer
3. Start this web app

```bash
docker compose up -d postgres
source "$HOME/.cargo/env"
HTTP_BIND_ADDR=0.0.0.0:3001 cargo run -p indexer
```

In a second terminal:

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Donor demo runbook

1. Visit `/donate/88` (or a real region route in app navigation).
2. Connect wallet and confirm network is Humanity testnet.
3. Run `Approve` -> `Donate` -> `Payout`.
4. Verify each hash in explorer from session history.
5. Click `Refresh` in Pool Analytics and verify net math updates.

## Notes

- Token math uses 6 decimals (`mUSDC` raw units).
- Native `tHP` is used for gas only.
