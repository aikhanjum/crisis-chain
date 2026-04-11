#!/usr/bin/env bash
# Start Postgres (Docker), Rust indexer, and API gateway for local web development.
# Prereqs: Docker running, Rust toolchain, Node 20+.
# Then run the web app: cd apps/web && npm run dev
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Postgres"
docker compose up -d postgres
for _ in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

if ! docker compose exec -T postgres psql -U postgres -d crisis_pool -c "SELECT 1 FROM crisis_nodes LIMIT 1" >/dev/null 2>&1; then
  echo "WARNING: crisis_nodes missing. Your Postgres volume may predate migrations."
  echo "  Fix: docker compose down -v && docker compose up -d postgres"
  exit 1
fi

export DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:5432/crisis_pool}"
export RPC_URL="${RPC_URL:-https://humanity-testnet.g.alchemy.com/public}"
export CHAIN_ID="${CHAIN_ID:-7080969}"
export VAULT_ADDRESS="${VAULT_ADDRESS:-0xAdFceAa9C932c665C4B4196A8e0Ee5DDCd9E8Cf9}"
export USDC_ADDRESS="${USDC_ADDRESS:-0xe9275dC0c6a2B586020d5b6395E1b617Ec6774C1}"
export HTTP_BIND_ADDR="${HTTP_BIND_ADDR:-127.0.0.1:3001}"
export CONFIRMATIONS="${CONFIRMATIONS:-2}"
export START_BLOCK="${START_BLOCK:-0}"
export RUST_LOG="${RUST_LOG:-warn}"

if nc -z 127.0.0.1 3001 2>/dev/null; then
  echo "==> Indexer already listening on :3001 (skip)"
else
  echo "==> Indexer (background on :3001)"
  (cd "$ROOT" && source "$HOME/.cargo/env" && cargo run -p indexer >/tmp/crisischain-indexer.log 2>&1) &
  for _ in $(seq 1 40); do
    if nc -z 127.0.0.1 3001 2>/dev/null; then break; fi
    sleep 0.25
  done
  if ! nc -z 127.0.0.1 3001 2>/dev/null; then
    echo "Indexer failed to bind. See /tmp/crisischain-indexer.log"
    exit 1
  fi
fi

export INDEXER_URL="${INDEXER_URL:-http://127.0.0.1:3001}"
export PORT="${PORT:-4000}"
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

if nc -z 127.0.0.1 4000 2>/dev/null; then
  echo "==> API gateway already listening on :4000 (skip)"
else
  echo "==> API gateway (background on :4000)"
  (cd "$ROOT/services/api-gateway" && npm run dev >/tmp/crisischain-gateway.log 2>&1) &
  for _ in $(seq 1 40); do
    if nc -z 127.0.0.1 4000 2>/dev/null; then break; fi
    sleep 0.25
  done
  if ! nc -z 127.0.0.1 4000 2>/dev/null; then
    echo "API gateway failed to listen. See /tmp/crisischain-gateway.log"
    exit 1
  fi
fi

echo "==> OK"
echo "  curl http://127.0.0.1:3001/health"
echo "  curl http://127.0.0.1:4000/health"
echo "  cd apps/web && npm run dev   # then open http://localhost:3000/ngo/dashboard"
