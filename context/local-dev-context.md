# Local Development Context (No Faucet Path)

This document captures the practical setup, testing flow, and troubleshooting notes used to get the project working locally.

## What This Project Does

- `contracts/src/CrisisPoolVault.sol`
  - Accepts donations into pool IDs: `donate(poolId, amount, memo)`
  - Allows admin payout from pool IDs: `payout(poolId, recipient, amount, payoutRef)`
  - Tracks per-pool balances in `poolBalances`
  - Emits `Donation` and `Payout` events
- `crates/indexer/src/main.rs`
  - Reads contract events from RPC
  - Persists them into Postgres
  - Exposes:
    - `GET /health`
    - `GET /pools/:pool_id` (donated, paid out, net)

## Why We Used Local Mode

Public faucets on Arbitrum Sepolia were gated by mainnet activity/asset requirements.  
To avoid faucet and real-money friction, we switched to local `anvil` testing.

## Local Env (`.env.local`) Meaning

- `CHAIN_ID=31337`: local Anvil chain ID
- `RPC_URL=http://127.0.0.1:8545`: local Anvil RPC endpoint
- `START_BLOCK=0`: index from beginning of local chain
- `CONFIRMATIONS=0`: no confirmation delay for local testing
- `PRIVATE_KEY=...`: one of Anvil-funded private keys
- `USDC_ADDRESS=...`: deployed `MockUSDC` address
- `VAULT_ADDRESS=...`: deployed `CrisisPoolVault` address
- `DATABASE_URL=postgres://postgres:postgres@localhost:5432/crisis_pool`
- `HTTP_BIND_ADDR=0.0.0.0:3000`

## Final Working Local Contract Addresses (current Anvil session)

- `USDC_ADDRESS`: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- `VAULT_ADDRESS`: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`

If Anvil is restarted, redeploy and update these values again.

## End-to-End Local Test Flow

### 1) Start local blockchain

```bash
source /Users/aikhan/.zshenv
anvil
```

### 2) Load local env

```bash
cd /Users/aikhan/dev/mit-expo-bitcoin-2026
set -a
source .env.local
set +a
```

### 3) Deploy MockUSDC and Vault

```bash
cd contracts
forge script script/DeployMockUSDC.s.sol:DeployMockUSDC --rpc-url "$RPC_URL" --broadcast
forge script script/Deploy.s.sol:DeployScript --rpc-url "$RPC_URL" --broadcast
```

Copy resulting addresses into `.env.local` and reload env.

### 4) Start Postgres

```bash
cd /Users/aikhan/dev/mit-expo-bitcoin-2026
docker compose up -d postgres
```

### 5) Start indexer API

```bash
source "$HOME/.cargo/env"
set -a
source .env.local
set +a
cargo run -p indexer
```

### 6) Mint + approve + donate + payout

```bash
cd /Users/aikhan/dev/mit-expo-bitcoin-2026
source /Users/aikhan/.zshenv
set -a
source .env.local
set +a

WALLET=$(cast wallet address --private-key "$PRIVATE_KEY")

# Mint 100 mock USDC (6 decimals) to donor wallet
cast send "$USDC_ADDRESS" "mint(address,uint256)" "$WALLET" 100000000 --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"

# Approve vault
cast send "$USDC_ADDRESS" "approve(address,uint256)" "$VAULT_ADDRESS" 25000000 --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"

# Donate 25 USDC to pool 1
cast send "$VAULT_ADDRESS" "donate(uint256,uint256,bytes32)" 1 25000000 0x646f6e6174696f6e2d3100000000000000000000000000000000000000000000 --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"

# Payout 5 USDC from pool 1
cast send "$VAULT_ADDRESS" "payout(uint256,address,uint256,bytes32)" 1 "$WALLET" 5000000 0x7061796f75742d31000000000000000000000000000000000000000000000000 --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"
```

### 7) Verify state

```bash
# On-chain balance
cast call "$VAULT_ADDRESS" "poolBalances(uint256)(uint256)" 1 --rpc-url "$RPC_URL"

# API checks
curl http://localhost:3000/health
curl http://localhost:3000/pools/1
```

Expected pool result:

- donated: `25000000`
- paid out: `5000000`
- net: `20000000`

## Troubleshooting Notes

- `vm.envUint PRIVATE_KEY missing 0x prefix`
  - Fix: ensure `PRIVATE_KEY=0x...` in env file.
- `insufficient funds for gas`
  - On testnet: missing faucet ETH.
  - On local: wrong key (not Anvil-funded) or wrong RPC URL.
- `contract ... does not have any code`
  - Address does not exist on current chain/session.
  - Usually caused by Anvil restart while using stale addresses.
- `logs: []` with status success on contract calls
  - You likely sent tx to non-contract address.
- `failed to connect to postgres`
  - Start database first with `docker compose up -d postgres`.
- `cannot insert multiple commands into a prepared statement`
  - Fixed by using `sqlx::raw_sql(...)` for migration execution.

## Security Notes

- Do not use local/test private keys with real funds.
- Treat any private key pasted in chat/term output as compromised.
- Keep actual secrets in `.env` / `.env.local`, never commit them.
