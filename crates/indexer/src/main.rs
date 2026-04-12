use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use alloy::primitives::{keccak256, Address, B256, U256};
use alloy::providers::{Provider, ProviderBuilder};
use alloy::rpc::types::{BlockNumberOrTag, Filter, Log};
use alloy::transports::http::reqwest::Url;
use anyhow::{anyhow, Context, Result};
use axum::extract::Path;
use axum::http::StatusCode;
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, Row};
use tokio::signal;
use tokio::task::JoinHandle;
use tower_http::cors::{Any, CorsLayer};
use tracing::{info, warn};

const STATE_ROW_ID: i16 = 1;
const DONATION_SIG: &str = "Donation(uint256,address,uint256,bytes32)";
const PAYOUT_SIG: &str = "Payout(uint256,address,uint256,bytes32)";

#[derive(Clone)]
struct AppState {
    db: PgPool,
}

#[derive(Debug, Clone)]
struct Config {
    rpc_url: String,
    chain_id: i64,
    vault_address: Address,
    token_address: Address,
    database_url: String,
    start_block: u64,
    confirmations: u64,
    /// Max blocks per eth_getLogs (Alchemy free tier allows 10).
    log_chunk_blocks: u64,
    http_bind_addr: SocketAddr,
}

#[derive(Serialize)]
struct HealthResponse {
    ok: bool,
}

#[derive(Serialize)]
struct PoolResponse {
    pool_id: String,
    total_donated_raw: String,
    total_paid_out_raw: String,
    net_raw: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    init_tracing();

    let cfg = Config::from_env()?;
    let db = PgPoolOptions::new()
        .max_connections(8)
        .connect(&cfg.database_url)
        .await
        .context("failed to connect to postgres")?;

    run_migrations(&db).await?;
    ensure_indexer_state(&db, cfg.chain_id, cfg.start_block).await?;

    let state = AppState { db: db.clone() };
    let app = build_router(state);

    let indexer_handle: JoinHandle<Result<()>> = tokio::spawn(run_indexer_loop(cfg.clone(), db.clone()));
    let listener = tokio::net::TcpListener::bind(cfg.http_bind_addr)
        .await
        .with_context(|| format!("failed to bind {}", cfg.http_bind_addr))?;

    info!("HTTP API listening on {}", cfg.http_bind_addr);
    let server = axum::serve(listener, app.into_make_service());

    tokio::select! {
        result = server => {
            result.context("http server failed")?;
        }
        result = indexer_handle => {
            match result {
                Ok(inner) => inner?,
                Err(join_err) => return Err(anyhow!("indexer task panicked: {join_err}")),
            }
        }
        _ = signal::ctrl_c() => {
            info!("received shutdown signal");
        }
    }

    Ok(())
}

fn build_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/health", get(health))
        .route("/pools/{pool_id}", get(get_pool))
        .layer(cors)
        .with_state(Arc::new(state))
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse { ok: true })
}

async fn get_pool(
    Path(pool_id): Path<String>,
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
) -> Result<Json<PoolResponse>, (StatusCode, String)> {
    let donated: String = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount_raw)::text, '0') FROM donations WHERE pool_id::text = $1",
    )
    .bind(&pool_id)
    .fetch_one(&state.db)
    .await
    .map_err(internal_error)?;

    let paid_out: String = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount_raw)::text, '0') FROM payouts WHERE pool_id::text = $1",
    )
    .bind(&pool_id)
    .fetch_one(&state.db)
    .await
    .map_err(internal_error)?;

    let net: String = sqlx::query_scalar(
        "SELECT (
            COALESCE((SELECT SUM(amount_raw) FROM donations WHERE pool_id::text = $1), 0) -
            COALESCE((SELECT SUM(amount_raw) FROM payouts WHERE pool_id::text = $1), 0)
        )::text",
    )
    .bind(&pool_id)
    .fetch_one(&state.db)
    .await
    .map_err(internal_error)?;

    Ok(Json(PoolResponse {
        pool_id,
        total_donated_raw: donated,
        total_paid_out_raw: paid_out,
        net_raw: net,
    }))
}

fn internal_error<E: std::fmt::Display>(err: E) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, err.to_string())
}

async fn run_indexer_loop(cfg: Config, db: PgPool) -> Result<()> {
    let rpc_url: Url = cfg.rpc_url.parse().context("invalid RPC_URL")?;
    let provider = ProviderBuilder::new().on_http(rpc_url);

    let donation_topic = keccak256(DONATION_SIG.as_bytes());
    let payout_topic = keccak256(PAYOUT_SIG.as_bytes());

    loop {
        let latest_block = provider
            .get_block_number()
            .await
            .context("failed to fetch latest block")?;

        let safe_head = latest_block.saturating_sub(cfg.confirmations);
        let mut cursor = fetch_last_processed_block(&db)
            .await
            .context("failed to read indexer cursor")?;

        if safe_head <= cursor {
            tokio::time::sleep(Duration::from_secs(2)).await;
            continue;
        }

        let from_block = cursor + 1;
        let to_block = safe_head;
        info!("indexing logs in block range [{from_block}, {to_block}]");

        let mut tx = db.begin().await.context("failed to begin db tx")?;

        let mut chunk_start = from_block;
        while chunk_start <= to_block {
            let chunk_end = (chunk_start + cfg.log_chunk_blocks.saturating_sub(1)).min(to_block);
            let filter = Filter::new()
                .address(cfg.vault_address)
                .from_block(BlockNumberOrTag::Number(chunk_start))
                .to_block(BlockNumberOrTag::Number(chunk_end))
                .event_signature(vec![donation_topic, payout_topic]);

            let logs = provider
                .get_logs(&filter)
                .await
                .with_context(|| {
                    format!("failed to fetch logs for blocks [{chunk_start}, {chunk_end}]")
                })?;

            for log in logs {
                let Some(topic0) = log.topics().first().copied() else {
                    continue;
                };

                if topic0 == donation_topic {
                    if let Err(e) = persist_donation(&mut tx, &cfg, &log).await {
                        warn!("skipping donation log due to decode/persist error: {e:#}");
                    }
                } else if topic0 == payout_topic {
                    if let Err(e) = persist_payout(&mut tx, &cfg, &log).await {
                        warn!("skipping payout log due to decode/persist error: {e:#}");
                    }
                }
            }

            chunk_start = chunk_end.saturating_add(1);
        }

        cursor = to_block;
        upsert_last_processed_block(&mut tx, cfg.chain_id, cursor)
            .await
            .context("failed to update indexer cursor")?;
        tx.commit().await.context("failed to commit db tx")?;
    }
}

async fn persist_donation(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    cfg: &Config,
    log: &Log,
) -> Result<()> {
    let (pool_id, donor, amount, memo) = decode_donation(log)?;
    let tx_hash = log
        .transaction_hash
        .ok_or_else(|| anyhow!("log missing transaction_hash"))?
        .to_string();
    let log_index = log
        .log_index
        .ok_or_else(|| anyhow!("log missing log_index"))? as i64;
    let block_number = log
        .block_number
        .ok_or_else(|| anyhow!("log missing block_number"))? as i64;

    sqlx::query(
        "INSERT INTO donations (
            tx_hash, log_index, block_number, pool_id, donor, amount_raw, memo, token, vault_address
        ) VALUES ($1,$2,$3,$4::numeric,$5,$6::numeric,$7,$8,$9)
        ON CONFLICT (tx_hash, log_index) DO NOTHING",
    )
    .bind(tx_hash)
    .bind(log_index)
    .bind(block_number)
    .bind(pool_id.to_string())
    .bind(format_address(donor))
    .bind(amount.to_string())
    .bind(format_b256(memo))
    .bind(format_address(cfg.token_address))
    .bind(format_address(cfg.vault_address))
    .execute(&mut **tx)
    .await
    .context("failed to insert donation")?;

    Ok(())
}

async fn persist_payout(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    cfg: &Config,
    log: &Log,
) -> Result<()> {
    let (pool_id, recipient, amount, payout_ref) = decode_payout(log)?;
    let tx_hash = log
        .transaction_hash
        .ok_or_else(|| anyhow!("log missing transaction_hash"))?
        .to_string();
    let log_index = log
        .log_index
        .ok_or_else(|| anyhow!("log missing log_index"))? as i64;
    let block_number = log
        .block_number
        .ok_or_else(|| anyhow!("log missing block_number"))? as i64;

    sqlx::query(
        "INSERT INTO payouts (
            tx_hash, log_index, block_number, pool_id, recipient, amount_raw, payout_ref, token, vault_address
        ) VALUES ($1,$2,$3,$4::numeric,$5,$6::numeric,$7,$8,$9)
        ON CONFLICT (tx_hash, log_index) DO NOTHING",
    )
    .bind(tx_hash)
    .bind(log_index)
    .bind(block_number)
    .bind(pool_id.to_string())
    .bind(format_address(recipient))
    .bind(amount.to_string())
    .bind(format_b256(payout_ref))
    .bind(format_address(cfg.token_address))
    .bind(format_address(cfg.vault_address))
    .execute(&mut **tx)
    .await
    .context("failed to insert payout")?;

    Ok(())
}

fn decode_donation(log: &Log) -> Result<(U256, Address, U256, B256)> {
    let topics = log.topics();
    if topics.len() != 4 {
        return Err(anyhow!("donation topics length mismatch: {}", topics.len()));
    }
    let amount = decode_single_u256(log)?;

    let pool_id = U256::from_be_bytes(topics[1].0);
    let donor = topic_to_address(topics[2])?;
    let memo = topics[3];
    Ok((pool_id, donor, amount, memo))
}

fn decode_payout(log: &Log) -> Result<(U256, Address, U256, B256)> {
    let topics = log.topics();
    if topics.len() != 4 {
        return Err(anyhow!("payout topics length mismatch: {}", topics.len()));
    }
    let amount = decode_single_u256(log)?;

    let pool_id = U256::from_be_bytes(topics[1].0);
    let recipient = topic_to_address(topics[2])?;
    let payout_ref = topics[3];
    Ok((pool_id, recipient, amount, payout_ref))
}

fn decode_single_u256(log: &Log) -> Result<U256> {
    let data = log.data().data.as_ref();
    if data.len() != 32 {
        return Err(anyhow!("event data length mismatch: {}", data.len()));
    }
    Ok(U256::from_be_slice(data))
}

fn topic_to_address(topic: B256) -> Result<Address> {
    let bytes = topic.as_slice();
    let address_bytes = &bytes[12..];
    Ok(Address::from_slice(address_bytes))
}

fn format_address(address: Address) -> String {
    format!("{address:#x}")
}

fn format_b256(value: B256) -> String {
    format!("{value:#x}")
}

async fn run_migrations(db: &PgPool) -> Result<()> {
    let migration_sql = include_str!("../../../migrations/0001_init.sql");
    sqlx::raw_sql(migration_sql)
        .execute(db)
        .await
        .context("failed to execute migration 0001_init.sql")?;
    Ok(())
}

async fn ensure_indexer_state(db: &PgPool, chain_id: i64, start_block: u64) -> Result<()> {
    sqlx::query(
        "INSERT INTO indexer_state (id, chain_id, last_processed_block)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING",
    )
    .bind(STATE_ROW_ID)
    .bind(chain_id)
    .bind(start_block as i64)
    .execute(db)
    .await
    .context("failed to initialize indexer state")?;
    Ok(())
}

async fn fetch_last_processed_block(db: &PgPool) -> Result<u64> {
    let row = sqlx::query("SELECT last_processed_block FROM indexer_state WHERE id = $1")
        .bind(STATE_ROW_ID)
        .fetch_one(db)
        .await
        .context("indexer_state row missing")?;

    let value: i64 = row.get("last_processed_block");
    Ok(value as u64)
}

async fn upsert_last_processed_block(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    chain_id: i64,
    last_processed_block: u64,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO indexer_state (id, chain_id, last_processed_block)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET
           chain_id = EXCLUDED.chain_id,
           last_processed_block = EXCLUDED.last_processed_block",
    )
    .bind(STATE_ROW_ID)
    .bind(chain_id)
    .bind(last_processed_block as i64)
    .execute(&mut **tx)
    .await
    .context("failed to upsert indexer state")?;
    Ok(())
}

impl Config {
    fn from_env() -> Result<Self> {
        let rpc_url = std::env::var("RPC_URL").context("RPC_URL is required")?;
        let chain_id = std::env::var("CHAIN_ID")
            .context("CHAIN_ID is required")?
            .parse::<i64>()
            .context("CHAIN_ID must be an integer")?;
        let vault_address = std::env::var("VAULT_ADDRESS")
            .context("VAULT_ADDRESS is required")?
            .parse::<Address>()
            .context("VAULT_ADDRESS must be a valid EVM address")?;
        let token_address = std::env::var("USDC_ADDRESS")
            .context("USDC_ADDRESS is required")?
            .parse::<Address>()
            .context("USDC_ADDRESS must be a valid EVM address")?;
        let database_url = std::env::var("DATABASE_URL").context("DATABASE_URL is required")?;
        let start_block = std::env::var("START_BLOCK")
            .unwrap_or_else(|_| "0".to_owned())
            .parse::<u64>()
            .context("START_BLOCK must be >= 0")?;
        let confirmations = std::env::var("CONFIRMATIONS")
            .unwrap_or_else(|_| "20".to_owned())
            .parse::<u64>()
            .context("CONFIRMATIONS must be >= 0")?;
        let http_bind_addr = std::env::var("HTTP_BIND_ADDR")
            .unwrap_or_else(|_| "0.0.0.0:3000".to_owned())
            .parse::<SocketAddr>()
            .context("HTTP_BIND_ADDR must be host:port")?;
        let log_chunk_blocks = std::env::var("LOG_CHUNK_BLOCKS")
            .unwrap_or_else(|_| "10".to_owned())
            .parse::<u64>()
            .context("LOG_CHUNK_BLOCKS must be a positive integer")?;
        let log_chunk_blocks = log_chunk_blocks.max(1);

        Ok(Self {
            rpc_url,
            chain_id,
            vault_address,
            token_address,
            database_url,
            start_block,
            confirmations,
            log_chunk_blocks,
            http_bind_addr,
        })
    }
}

fn init_tracing() {
    let filter = std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_owned());
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .compact()
        .init();
}
