-- Migration: Add BTC deposit address allocations
-- Date: 2025-12-02
-- Purpose: Issue per-user BTC deposit addresses derived from bridge xpub

-- Sequence for derivation indexes (starts at 0 so path matches physical index)
CREATE SEQUENCE IF NOT EXISTS btc_deposit_address_index_seq START 0;

-- Table that tracks every allocated deposit address and its lifecycle
CREATE TABLE IF NOT EXISTS btc_deposit_addresses (
    id SERIAL PRIMARY KEY,
    allocation_id UUID NOT NULL UNIQUE,
    solana_address VARCHAR(44) NOT NULL,
    bitcoin_address VARCHAR(255) NOT NULL UNIQUE,
    derivation_index BIGINT NOT NULL UNIQUE DEFAULT nextval('btc_deposit_address_index_seq'),
    derivation_path VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'allocated', -- allocated, funded, claimed, expired, cancelled
    session_id VARCHAR(128),
    client_label VARCHAR(64),
    metadata JSONB,
    expires_at TIMESTAMP,
    funded_tx_hash VARCHAR(64),
    funded_amount_satoshis BIGINT,
    funded_at TIMESTAMP,
    claimed_tx_hash VARCHAR(64),
    solana_tx_signature VARCHAR(88),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_btc_deposit_addresses_allocation ON btc_deposit_addresses(allocation_id);
CREATE INDEX IF NOT EXISTS idx_btc_deposit_addresses_solana ON btc_deposit_addresses(solana_address);
CREATE INDEX IF NOT EXISTS idx_btc_deposit_addresses_status ON btc_deposit_addresses(status);
CREATE INDEX IF NOT EXISTS idx_btc_deposit_addresses_expires ON btc_deposit_addresses(expires_at);

-- Trigger to maintain updated_at column
CREATE TRIGGER update_btc_deposit_addresses_updated_at
BEFORE UPDATE ON btc_deposit_addresses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

