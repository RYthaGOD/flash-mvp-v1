-- Migration: Add transfer metadata table
-- Date: 2025-11-30
-- Purpose: Fix transfer ambiguity by classifying treasury transfers

-- Add Transfer Metadata Table
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

-- Add comment for documentation
COMMENT ON TABLE transfer_metadata IS 'Classifies treasury transfers to prevent btc-relayer from processing non-redemption transfers';
COMMENT ON COLUMN transfer_metadata.transfer_type IS 'Type of transfer: redemption, refund, funding, admin, test';
COMMENT ON COLUMN transfer_metadata.created_by IS 'Who created this metadata: system, admin, api, relayer';
