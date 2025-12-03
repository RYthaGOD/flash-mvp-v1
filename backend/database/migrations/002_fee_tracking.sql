-- =============================================================================
-- FLASH Bridge Fee Tracking Schema
-- =============================================================================
-- Tracks all fees collected for revenue analytics and reporting
-- =============================================================================

-- Fee Collections Table
-- Tracks every fee collected from bridge transactions
CREATE TABLE IF NOT EXISTS fee_collections (
    id SERIAL PRIMARY KEY,
    
    -- Transaction reference
    transaction_id VARCHAR(255) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL DEFAULT 'bridge', -- 'bridge', 'swap', 'burn'
    
    -- Fee details
    fee_usd DECIMAL(20, 2) NOT NULL,
    fee_btc DECIMAL(20, 8),
    fee_sol DECIMAL(20, 9),
    
    -- Fee breakdown
    base_fee_usd DECIMAL(20, 2) NOT NULL,
    privacy_fee_usd DECIMAL(20, 2) DEFAULT 0,
    fast_processing_fee_usd DECIMAL(20, 2) DEFAULT 0,
    referral_discount_usd DECIMAL(20, 2) DEFAULT 0,
    
    -- Transaction details
    amount_usd DECIMAL(20, 2) NOT NULL,
    amount_btc DECIMAL(20, 8),
    fee_percent_effective DECIMAL(10, 4) NOT NULL,
    
    -- Service tier
    tier VARCHAR(20) NOT NULL DEFAULT 'basic', -- 'basic', 'fast', 'private', 'premium'
    features TEXT[], -- Array of features used
    
    -- User info (anonymized)
    user_address VARCHAR(44), -- Solana address (for analytics, not tracking)
    
    -- Referral tracking
    referral_code VARCHAR(50),
    referral_credit_usd DECIMAL(20, 2) DEFAULT 0,
    
    -- Collection status
    status VARCHAR(20) NOT NULL DEFAULT 'collected', -- 'collected', 'withdrawn', 'refunded'
    collection_address VARCHAR(44), -- Fee recipient address
    collection_tx_signature VARCHAR(88), -- Solana TX where fee was collected
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Fee Withdrawals Table
-- Tracks when fees are withdrawn to owner wallet
CREATE TABLE IF NOT EXISTS fee_withdrawals (
    id SERIAL PRIMARY KEY,
    
    -- Withdrawal details
    amount_usd DECIMAL(20, 2) NOT NULL,
    amount_sol DECIMAL(20, 9),
    
    -- Addresses
    from_address VARCHAR(44) NOT NULL, -- Fee collection address
    to_address VARCHAR(44) NOT NULL, -- Owner withdrawal address
    
    -- Transaction
    tx_signature VARCHAR(88) UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
    
    -- Period covered
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    transaction_count INT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP
);

-- Daily Fee Summary Table
-- Pre-aggregated daily stats for fast reporting
CREATE TABLE IF NOT EXISTS fee_daily_summary (
    id SERIAL PRIMARY KEY,
    
    -- Date
    date DATE UNIQUE NOT NULL,
    
    -- Totals
    total_fee_usd DECIMAL(20, 2) NOT NULL DEFAULT 0,
    total_transactions INT NOT NULL DEFAULT 0,
    total_volume_usd DECIMAL(20, 2) NOT NULL DEFAULT 0,
    
    -- By tier
    basic_fee_usd DECIMAL(20, 2) DEFAULT 0,
    basic_count INT DEFAULT 0,
    fast_fee_usd DECIMAL(20, 2) DEFAULT 0,
    fast_count INT DEFAULT 0,
    private_fee_usd DECIMAL(20, 2) DEFAULT 0,
    private_count INT DEFAULT 0,
    premium_fee_usd DECIMAL(20, 2) DEFAULT 0,
    premium_count INT DEFAULT 0,
    
    -- Averages
    avg_fee_usd DECIMAL(20, 2),
    avg_fee_percent DECIMAL(10, 4),
    
    -- Referrals
    referral_discounts_usd DECIMAL(20, 2) DEFAULT 0,
    referral_credits_usd DECIMAL(20, 2) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Referral Codes Table
-- Track referral partners for revenue sharing
CREATE TABLE IF NOT EXISTS referral_codes (
    id SERIAL PRIMARY KEY,
    
    -- Code
    code VARCHAR(50) UNIQUE NOT NULL,
    
    -- Partner info
    partner_name VARCHAR(100),
    partner_address VARCHAR(44), -- SOL address for payouts
    partner_email VARCHAR(255),
    
    -- Commission settings
    commission_percent DECIMAL(5, 2) DEFAULT 10.00, -- % of fee to partner
    user_discount_percent DECIMAL(5, 2) DEFAULT 5.00, -- % discount to user
    
    -- Stats
    total_uses INT DEFAULT 0,
    total_volume_usd DECIMAL(20, 2) DEFAULT 0,
    total_commission_usd DECIMAL(20, 2) DEFAULT 0,
    total_commission_paid_usd DECIMAL(20, 2) DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused', 'disabled'
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fee_collections_transaction ON fee_collections(transaction_id);
CREATE INDEX IF NOT EXISTS idx_fee_collections_created_at ON fee_collections(created_at);
CREATE INDEX IF NOT EXISTS idx_fee_collections_tier ON fee_collections(tier);
CREATE INDEX IF NOT EXISTS idx_fee_collections_status ON fee_collections(status);
CREATE INDEX IF NOT EXISTS idx_fee_collections_referral ON fee_collections(referral_code);

CREATE INDEX IF NOT EXISTS idx_fee_withdrawals_status ON fee_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_fee_withdrawals_created_at ON fee_withdrawals(created_at);

CREATE INDEX IF NOT EXISTS idx_fee_daily_summary_date ON fee_daily_summary(date);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_status ON referral_codes(status);

-- Trigger for updated_at
CREATE TRIGGER update_fee_collections_updated_at 
    BEFORE UPDATE ON fee_collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fee_daily_summary_updated_at 
    BEFORE UPDATE ON fee_daily_summary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referral_codes_updated_at 
    BEFORE UPDATE ON referral_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update daily summary
CREATE OR REPLACE FUNCTION update_fee_daily_summary()
RETURNS TRIGGER AS $$
DECLARE
    summary_date DATE;
BEGIN
    summary_date := DATE(NEW.created_at);
    
    INSERT INTO fee_daily_summary (date, total_fee_usd, total_transactions, total_volume_usd)
    VALUES (summary_date, NEW.fee_usd, 1, NEW.amount_usd)
    ON CONFLICT (date) DO UPDATE SET
        total_fee_usd = fee_daily_summary.total_fee_usd + NEW.fee_usd,
        total_transactions = fee_daily_summary.total_transactions + 1,
        total_volume_usd = fee_daily_summary.total_volume_usd + NEW.amount_usd,
        basic_fee_usd = CASE WHEN NEW.tier = 'basic' THEN fee_daily_summary.basic_fee_usd + NEW.fee_usd ELSE fee_daily_summary.basic_fee_usd END,
        basic_count = CASE WHEN NEW.tier = 'basic' THEN fee_daily_summary.basic_count + 1 ELSE fee_daily_summary.basic_count END,
        fast_fee_usd = CASE WHEN NEW.tier = 'fast' THEN fee_daily_summary.fast_fee_usd + NEW.fee_usd ELSE fee_daily_summary.fast_fee_usd END,
        fast_count = CASE WHEN NEW.tier = 'fast' THEN fee_daily_summary.fast_count + 1 ELSE fee_daily_summary.fast_count END,
        private_fee_usd = CASE WHEN NEW.tier = 'private' THEN fee_daily_summary.private_fee_usd + NEW.fee_usd ELSE fee_daily_summary.private_fee_usd END,
        private_count = CASE WHEN NEW.tier = 'private' THEN fee_daily_summary.private_count + 1 ELSE fee_daily_summary.private_count END,
        premium_fee_usd = CASE WHEN NEW.tier = 'premium' THEN fee_daily_summary.premium_fee_usd + NEW.fee_usd ELSE fee_daily_summary.premium_fee_usd END,
        premium_count = CASE WHEN NEW.tier = 'premium' THEN fee_daily_summary.premium_count + 1 ELSE fee_daily_summary.premium_count END,
        avg_fee_usd = (fee_daily_summary.total_fee_usd + NEW.fee_usd) / (fee_daily_summary.total_transactions + 1),
        avg_fee_percent = ((fee_daily_summary.avg_fee_percent * fee_daily_summary.total_transactions) + NEW.fee_percent_effective) / (fee_daily_summary.total_transactions + 1),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update daily summary
CREATE TRIGGER trigger_update_fee_daily_summary
    AFTER INSERT ON fee_collections
    FOR EACH ROW EXECUTE FUNCTION update_fee_daily_summary();

-- =============================================================================
-- Sample referral codes (for testing)
-- =============================================================================
INSERT INTO referral_codes (code, partner_name, commission_percent, user_discount_percent, status)
VALUES 
    ('FLASH10', 'Launch Partner', 10.00, 5.00, 'active'),
    ('EARLYBIRD', 'Early Adopter', 15.00, 10.00, 'active'),
    ('PARTNER20', 'Strategic Partner', 20.00, 10.00, 'active')
ON CONFLICT (code) DO NOTHING;

