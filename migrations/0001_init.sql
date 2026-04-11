CREATE TABLE IF NOT EXISTS indexer_state (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    chain_id BIGINT NOT NULL,
    last_processed_block BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS donations (
    tx_hash TEXT NOT NULL,
    log_index BIGINT NOT NULL,
    block_number BIGINT NOT NULL,
    pool_id NUMERIC(78, 0) NOT NULL,
    donor TEXT NOT NULL,
    amount_raw NUMERIC(78, 0) NOT NULL,
    memo TEXT NOT NULL,
    token TEXT NOT NULL,
    vault_address TEXT NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS donations_pool_id_idx ON donations (pool_id);
CREATE INDEX IF NOT EXISTS donations_block_number_idx ON donations (block_number);

CREATE TABLE IF NOT EXISTS payouts (
    tx_hash TEXT NOT NULL,
    log_index BIGINT NOT NULL,
    block_number BIGINT NOT NULL,
    pool_id NUMERIC(78, 0) NOT NULL,
    recipient TEXT NOT NULL,
    amount_raw NUMERIC(78, 0) NOT NULL,
    payout_ref TEXT NOT NULL,
    token TEXT NOT NULL,
    vault_address TEXT NOT NULL,
    PRIMARY KEY (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS payouts_pool_id_idx ON payouts (pool_id);
CREATE INDEX IF NOT EXISTS payouts_block_number_idx ON payouts (block_number);
