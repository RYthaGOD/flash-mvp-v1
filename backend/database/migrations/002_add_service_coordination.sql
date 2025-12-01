-- Migration: Add service coordination table
-- Date: 2025-11-30
-- Purpose: Prevent multiple services from processing the same transaction

-- Add Service Coordination Table
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

-- Add comment for documentation
COMMENT ON TABLE service_coordination IS 'Prevents multiple services from processing the same transaction';
COMMENT ON COLUMN service_coordination.transaction_id IS 'Unique transaction identifier across all services';
COMMENT ON COLUMN service_coordination.processing_service IS 'Name of the service currently processing this transaction';
