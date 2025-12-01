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
    output_token VARCHAR(44), -- Token mint user receives (for BTC deposits)
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

-- Cryptographic Proofs Table
-- Stores institutional-grade cryptographic proofs for transactions
CREATE TABLE IF NOT EXISTS cryptographic_proofs (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(255) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- 'bridge', 'swap', 'burn'
    proof_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    transaction_hash VARCHAR(64) NOT NULL,
    signature TEXT NOT NULL, -- JSON with signature, public key, algorithm
    merkle_proof TEXT NOT NULL, -- JSON with Merkle tree proof
    zk_proof TEXT, -- JSON with ZK proof (optional)
    chain_of_custody TEXT NOT NULL, -- JSON array of custody steps
    metadata TEXT NOT NULL, -- JSON with generation metadata
    expires_at TIMESTAMP, -- When proof expires (for cache management)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(transaction_id, transaction_type)
);

-- Proof Verification Attempts Table
-- Tracks proof verification requests for audit
CREATE TABLE IF NOT EXISTS proof_verifications (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(255) NOT NULL,
    verifier_address VARCHAR(44), -- Who requested verification
    verification_result BOOLEAN NOT NULL,
    verification_reason TEXT,
    verification_timestamp TIMESTAMP DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Indexes for proof performance
CREATE INDEX IF NOT EXISTS idx_proofs_tx_id ON cryptographic_proofs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_proofs_tx_type ON cryptographic_proofs(transaction_type);
CREATE INDEX IF NOT EXISTS idx_proofs_created_at ON cryptographic_proofs(created_at);
CREATE INDEX IF NOT EXISTS idx_proofs_expires_at ON cryptographic_proofs(expires_at);

CREATE INDEX IF NOT EXISTS idx_verifications_tx_id ON proof_verifications(transaction_id);
CREATE INDEX IF NOT EXISTS idx_verifications_timestamp ON proof_verifications(verification_timestamp);

-- Transfer Metadata Table
-- Classifies treasury transfers to prevent processing non-redemption transfers
CREATE TABLE IF NOT EXISTS transfer_metadata (
    id SERIAL PRIMARY KEY,
    solana_tx_signature VARCHAR(88) UNIQUE NOT NULL,
    transfer_type VARCHAR(20) NOT NULL, -- 'redemption', 'refund', 'funding', 'admin', 'test'
    user_address VARCHAR(44), -- Solana address of user (for redemptions)
    amount DECIMAL(20, 8), -- Amount in smallest units (for validation)
    metadata JSONB, -- Additional metadata (notes, admin info, etc.)
    created_by VARCHAR(50) NOT NULL DEFAULT 'system', -- 'system', 'admin', 'api', 'relayer'
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for transfer metadata
CREATE INDEX IF NOT EXISTS idx_transfer_metadata_signature ON transfer_metadata(solana_tx_signature);
CREATE INDEX IF NOT EXISTS idx_transfer_metadata_type ON transfer_metadata(transfer_type);
CREATE INDEX IF NOT EXISTS idx_transfer_metadata_user ON transfer_metadata(user_address);
CREATE INDEX IF NOT EXISTS idx_transfer_metadata_created_at ON transfer_metadata(created_at);

-- Service Coordination Table
-- Prevents multiple services from processing the same transaction
CREATE TABLE IF NOT EXISTS service_coordination (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(255) NOT NULL UNIQUE,
    transaction_type VARCHAR(50) NOT NULL,
    processing_service VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed'
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for service coordination
CREATE INDEX IF NOT EXISTS idx_service_coordination_tx_id ON service_coordination(transaction_id);
CREATE INDEX IF NOT EXISTS idx_service_coordination_service ON service_coordination(processing_service);
CREATE INDEX IF NOT EXISTS idx_service_coordination_status ON service_coordination(status);
CREATE INDEX IF NOT EXISTS idx_service_coordination_started_at ON service_coordination(started_at);

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

-- Trigger for proof table
CREATE TRIGGER update_cryptographic_proofs_updated_at BEFORE UPDATE ON cryptographic_proofs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- BTC Deposits Table
-- Tracks all BTC deposits from detection through processing
-- Enables fast processing with configurable confirmation requirements
CREATE TABLE IF NOT EXISTS btc_deposits (
    id SERIAL PRIMARY KEY,
    tx_hash VARCHAR(64) UNIQUE NOT NULL,
    bridge_address VARCHAR(255) NOT NULL,
    amount_satoshis BIGINT NOT NULL,
    amount_btc DECIMAL(20, 8) NOT NULL,
    confirmations INT NOT NULL DEFAULT 0,
    required_confirmations INT NOT NULL DEFAULT 1, -- Configurable (default 1 for speed)
    block_height INT,
    block_time TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'processed', 'failed'
    solana_address VARCHAR(44), -- Set when user claims
    solana_tx_signature VARCHAR(88), -- Set when processed
    output_token VARCHAR(44), -- Token user receives
    detected_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for BTC deposits
CREATE INDEX IF NOT EXISTS idx_btc_deposits_tx_hash ON btc_deposits(tx_hash);
CREATE INDEX IF NOT EXISTS idx_btc_deposits_bridge_address ON btc_deposits(bridge_address);
CREATE INDEX IF NOT EXISTS idx_btc_deposits_status ON btc_deposits(status);
CREATE INDEX IF NOT EXISTS idx_btc_deposits_confirmations ON btc_deposits(confirmations);
CREATE INDEX IF NOT EXISTS idx_btc_deposits_detected_at ON btc_deposits(detected_at);
CREATE INDEX IF NOT EXISTS idx_btc_deposits_solana_address ON btc_deposits(solana_address);

-- Trigger for btc_deposits updated_at
CREATE TRIGGER update_btc_deposits_updated_at BEFORE UPDATE ON btc_deposits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- BTC Withdrawals Table
-- Tracks all outgoing BTC transactions for complete audit trail
-- Ensures ingoings align with outgoings for verifiability
CREATE TABLE IF NOT EXISTS btc_withdrawals (
    id SERIAL PRIMARY KEY,
    tx_hash VARCHAR(64) UNIQUE NOT NULL,
    bridge_address VARCHAR(255) NOT NULL,
    amount_satoshis BIGINT NOT NULL,
    amount_btc DECIMAL(20, 8) NOT NULL,
    recipient_address VARCHAR(255) NOT NULL,
    confirmations INT NOT NULL DEFAULT 0,
    block_height INT,
    block_time TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
    solana_tx_signature VARCHAR(88), -- Solana burn transaction that triggered this
    solana_address VARCHAR(44), -- User's Solana address
    zen_zec_amount DECIMAL(20, 8), -- Amount of zenZEC burned
    created_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for BTC withdrawals
CREATE INDEX IF NOT EXISTS idx_btc_withdrawals_tx_hash ON btc_withdrawals(tx_hash);
CREATE INDEX IF NOT EXISTS idx_btc_withdrawals_bridge_address ON btc_withdrawals(bridge_address);
CREATE INDEX IF NOT EXISTS idx_btc_withdrawals_status ON btc_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_btc_withdrawals_solana_tx ON btc_withdrawals(solana_tx_signature);
CREATE INDEX IF NOT EXISTS idx_btc_withdrawals_created_at ON btc_withdrawals(created_at);

-- Trigger for btc_withdrawals updated_at
CREATE TRIGGER update_btc_withdrawals_updated_at BEFORE UPDATE ON btc_withdrawals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

