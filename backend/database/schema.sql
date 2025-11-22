-- FLASH Bridge Database Schema
-- PostgreSQL Database Schema for Transaction Persistence

-- Bridge Transactions Table
-- Stores all bridge minting operations (BTC/ZEC → zenZEC)
CREATE TABLE IF NOT EXISTS bridge_transactions (
    id SERIAL PRIMARY KEY,
    tx_id VARCHAR(255) UNIQUE NOT NULL,
    solana_address VARCHAR(44) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    reserve_asset VARCHAR(10) NOT NULL, -- 'BTC' or 'ZEC'
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
    solana_tx_signature VARCHAR(88),
    bitcoin_tx_hash VARCHAR(64),
    zcash_tx_hash VARCHAR(64),
    demo_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Swap Transactions Table
-- Stores SOL ↔ zenZEC swap operations
CREATE TABLE IF NOT EXISTS swap_transactions (
    id SERIAL PRIMARY KEY,
    tx_id VARCHAR(255) UNIQUE NOT NULL,
    solana_address VARCHAR(44) NOT NULL,
    sol_amount DECIMAL(20, 8),
    zenzec_amount DECIMAL(20, 8),
    solana_tx_signature VARCHAR(88),
    direction VARCHAR(20) NOT NULL, -- 'sol_to_zenzec' or 'zenzec_to_sol'
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
    encrypted BOOLEAN DEFAULT FALSE,
    demo_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Burn Transactions Table
-- Stores zenZEC burn operations (zenZEC → SOL or zenZEC → BTC)
CREATE TABLE IF NOT EXISTS burn_transactions (
    id SERIAL PRIMARY KEY,
    tx_id VARCHAR(255) UNIQUE NOT NULL,
    solana_address VARCHAR(44) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    target_asset VARCHAR(10) NOT NULL, -- 'SOL' or 'BTC'
    target_address VARCHAR(255), -- SOL address or BTC address
    solana_tx_signature VARCHAR(88),
    btc_tx_hash VARCHAR(64), -- If target is BTC
    sol_tx_signature VARCHAR(88), -- If target is SOL
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'failed', 'processing'
    encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Processed Events Table
-- Prevents duplicate processing of relayer events
CREATE TABLE IF NOT EXISTS processed_events (
    id SERIAL PRIMARY KEY,
    event_signature VARCHAR(88) UNIQUE NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'BurnSwapEvent', 'BurnToBTCEvent'
    solana_address VARCHAR(44),
    amount DECIMAL(20, 8),
    processed_at TIMESTAMP DEFAULT NOW()
);

-- Transaction Status History Table
-- Tracks status changes for audit trail
CREATE TABLE IF NOT EXISTS transaction_status_history (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(255) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- 'bridge', 'swap', 'burn'
    status VARCHAR(20) NOT NULL,
    previous_status VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bridge_tx_id ON bridge_transactions(tx_id);
CREATE INDEX IF NOT EXISTS idx_bridge_solana_address ON bridge_transactions(solana_address);
CREATE INDEX IF NOT EXISTS idx_bridge_status ON bridge_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bridge_created_at ON bridge_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_swap_tx_id ON swap_transactions(tx_id);
CREATE INDEX IF NOT EXISTS idx_swap_solana_address ON swap_transactions(solana_address);
CREATE INDEX IF NOT EXISTS idx_swap_status ON swap_transactions(status);
CREATE INDEX IF NOT EXISTS idx_swap_direction ON swap_transactions(direction);

CREATE INDEX IF NOT EXISTS idx_burn_tx_id ON burn_transactions(tx_id);
CREATE INDEX IF NOT EXISTS idx_burn_solana_address ON burn_transactions(solana_address);
CREATE INDEX IF NOT EXISTS idx_burn_status ON burn_transactions(status);
CREATE INDEX IF NOT EXISTS idx_burn_target_asset ON burn_transactions(target_asset);

CREATE INDEX IF NOT EXISTS idx_processed_events_signature ON processed_events(event_signature);
CREATE INDEX IF NOT EXISTS idx_processed_events_type ON processed_events(event_type);

CREATE INDEX IF NOT EXISTS idx_status_history_tx_id ON transaction_status_history(transaction_id);
CREATE INDEX IF NOT EXISTS idx_status_history_type ON transaction_status_history(transaction_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
CREATE TRIGGER update_bridge_transactions_updated_at BEFORE UPDATE ON bridge_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_swap_transactions_updated_at BEFORE UPDATE ON swap_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_burn_transactions_updated_at BEFORE UPDATE ON burn_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

