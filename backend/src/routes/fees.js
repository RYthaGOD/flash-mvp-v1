/**
 * Fee Routes - Revenue Management API
 * ====================================
 * Endpoints for fee configuration, analytics, and withdrawals
 */

const express = require('express');
const router = express.Router();
const feeService = require('../services/fee-service');
const databaseService = require('../services/database');
const { requireApiKey } = require('../middleware/auth');
const { createLogger } = require('../utils/logger');

const logger = createLogger('fee-routes');

// =============================================================================
// PUBLIC ENDPOINTS (for UI)
// =============================================================================

/**
 * GET /api/v1/fees/quote
 * Get a fee quote for a specific amount
 */
router.get('/quote', (req, res) => {
  try {
    const { amount, tier = 'basic', btcPrice = 100000 } = req.query;
    
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        error: 'Invalid amount',
        message: 'Please provide a valid positive amount',
      });
    }
    
    const amountUSD = parseFloat(amount);
    const amountBTC = amountUSD / parseFloat(btcPrice);
    
    const quote = feeService.calculateFees({
      amountUSD,
      amountBTC,
      tier,
      usePrivacy: ['private', 'premium'].includes(tier),
    });
    
    res.json({
      success: true,
      quote,
    });
  } catch (error) {
    logger.error('Error getting fee quote:', error);
    res.status(500).json({ error: 'Failed to get fee quote' });
  }
});

/**
 * GET /api/v1/fees/tiers
 * Get all available service tiers with pricing
 */
router.get('/tiers', (req, res) => {
  try {
    const { amount = 1000 } = req.query;
    const tiers = feeService.getTiers(parseFloat(amount));
    
    res.json({
      success: true,
      tiers,
      defaultTier: 'basic',
      recommendedTier: 'private', // Privacy is our differentiator
    });
  } catch (error) {
    logger.error('Error getting tiers:', error);
    res.status(500).json({ error: 'Failed to get service tiers' });
  }
});

/**
 * GET /api/v1/fees/config
 * Get current fee configuration (public info only)
 */
router.get('/config', (req, res) => {
  try {
    const config = feeService.getConfig();
    
    res.json({
      success: true,
      config: {
        baseFeePercent: config.baseFeePercent * 100,
        privacyFeePercent: config.privacyFeePercent * 100,
        minFeeUSD: config.minFeeUSD,
        maxFeeUSD: config.maxFeeUSD,
        enabled: config.enabled,
      },
    });
  } catch (error) {
    logger.error('Error getting fee config:', error);
    res.status(500).json({ error: 'Failed to get fee configuration' });
  }
});

// =============================================================================
// ADMIN ENDPOINTS (require API key)
// =============================================================================

/**
 * GET /api/v1/fees/stats
 * Get fee collection statistics (admin only)
 */
router.get('/stats', requireApiKey, (req, res) => {
  try {
    const stats = feeService.getStats();
    
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('Error getting fee stats:', error);
    res.status(500).json({ error: 'Failed to get fee statistics' });
  }
});

/**
 * GET /api/v1/fees/analytics
 * Get detailed fee analytics from database (admin only)
 */
router.get('/analytics', requireApiKey, async (req, res) => {
  try {
    const { startDate, endDate, tier, limit = 30 } = req.query;
    
    // Get daily summary from database
    let dailySummaryQuery = `
      SELECT * FROM fee_daily_summary 
      WHERE 1=1
    `;
    const params = [];
    
    if (startDate) {
      params.push(startDate);
      dailySummaryQuery += ` AND date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      dailySummaryQuery += ` AND date <= $${params.length}`;
    }
    
    dailySummaryQuery += ` ORDER BY date DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));
    
    const dailySummary = await databaseService.query(dailySummaryQuery, params);
    
    // Get totals
    const totalsQuery = `
      SELECT 
        COALESCE(SUM(fee_usd), 0) as total_fees,
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount_usd), 0) as total_volume,
        COALESCE(AVG(fee_usd), 0) as avg_fee,
        COALESCE(AVG(fee_percent_effective), 0) as avg_fee_percent
      FROM fee_collections
      WHERE status = 'collected'
    `;
    const totals = await databaseService.query(totalsQuery);
    
    // Get tier breakdown
    const tierQuery = `
      SELECT 
        tier,
        COUNT(*) as count,
        COALESCE(SUM(fee_usd), 0) as total_fees,
        COALESCE(SUM(amount_usd), 0) as total_volume
      FROM fee_collections
      WHERE status = 'collected'
      GROUP BY tier
      ORDER BY total_fees DESC
    `;
    const tierBreakdown = await databaseService.query(tierQuery);
    
    res.json({
      success: true,
      analytics: {
        totals: totals.rows[0] || {},
        byTier: tierBreakdown.rows || [],
        dailySummary: dailySummary.rows || [],
      },
    });
  } catch (error) {
    logger.error('Error getting fee analytics:', error);
    res.status(500).json({ error: 'Failed to get fee analytics' });
  }
});

/**
 * GET /api/v1/fees/history
 * Get fee collection history (admin only)
 */
router.get('/history', requireApiKey, async (req, res) => {
  try {
    const { page = 1, limit = 50, tier, status = 'collected' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT * FROM fee_collections 
      WHERE status = $1
    `;
    const params = [status];
    
    if (tier) {
      params.push(tier);
      query += ` AND tier = $${params.length}`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);
    
    const result = await databaseService.query(query, params);
    
    // Get total count
    let countQuery = `SELECT COUNT(*) FROM fee_collections WHERE status = $1`;
    const countParams = [status];
    if (tier) {
      countParams.push(tier);
      countQuery += ` AND tier = $${countParams.length}`;
    }
    const countResult = await databaseService.query(countQuery, countParams);
    
    res.json({
      success: true,
      history: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('Error getting fee history:', error);
    res.status(500).json({ error: 'Failed to get fee history' });
  }
});

/**
 * GET /api/v1/fees/referrals
 * Get referral statistics (admin only)
 */
router.get('/referrals', requireApiKey, async (req, res) => {
  try {
    const query = `
      SELECT * FROM referral_codes
      ORDER BY total_commission_usd DESC
    `;
    const result = await databaseService.query(query);
    
    res.json({
      success: true,
      referrals: result.rows,
    });
  } catch (error) {
    logger.error('Error getting referrals:', error);
    res.status(500).json({ error: 'Failed to get referral data' });
  }
});

/**
 * POST /api/v1/fees/referrals
 * Create a new referral code (admin only)
 */
router.post('/referrals', requireApiKey, async (req, res) => {
  try {
    const { 
      code, 
      partnerName, 
      partnerAddress, 
      commissionPercent = 10, 
      userDiscountPercent = 5 
    } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Referral code is required' });
    }
    
    const query = `
      INSERT INTO referral_codes (code, partner_name, partner_address, commission_percent, user_discount_percent)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await databaseService.query(query, [
      code.toUpperCase(),
      partnerName,
      partnerAddress,
      commissionPercent,
      userDiscountPercent,
    ]);
    
    res.json({
      success: true,
      referral: result.rows[0],
    });
  } catch (error) {
    logger.error('Error creating referral:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Referral code already exists' });
    }
    res.status(500).json({ error: 'Failed to create referral code' });
  }
});

/**
 * GET /api/v1/fees/withdrawals
 * Get fee withdrawal history (admin only)
 */
router.get('/withdrawals', requireApiKey, async (req, res) => {
  try {
    const query = `
      SELECT * FROM fee_withdrawals
      ORDER BY created_at DESC
      LIMIT 100
    `;
    const result = await databaseService.query(query);
    
    // Get pending balance
    const pendingQuery = `
      SELECT COALESCE(SUM(fee_usd), 0) as pending_balance
      FROM fee_collections
      WHERE status = 'collected'
    `;
    const pendingResult = await databaseService.query(pendingQuery);
    
    res.json({
      success: true,
      withdrawals: result.rows,
      pendingBalance: parseFloat(pendingResult.rows[0].pending_balance),
    });
  } catch (error) {
    logger.error('Error getting withdrawals:', error);
    res.status(500).json({ error: 'Failed to get withdrawal history' });
  }
});

/**
 * POST /api/v1/fees/withdraw
 * Initiate a fee withdrawal (admin only)
 * Note: Actual transfer would be done via Solana service
 */
router.post('/withdraw', requireApiKey, async (req, res) => {
  try {
    const { toAddress, amount } = req.body;
    
    if (!toAddress) {
      return res.status(400).json({ error: 'Withdrawal address is required' });
    }
    
    // Get available balance
    const balanceQuery = `
      SELECT COALESCE(SUM(fee_usd), 0) as available
      FROM fee_collections
      WHERE status = 'collected'
    `;
    const balanceResult = await databaseService.query(balanceQuery);
    const available = parseFloat(balanceResult.rows[0].available);
    
    const withdrawAmount = amount ? parseFloat(amount) : available;
    
    if (withdrawAmount > available) {
      return res.status(400).json({ 
        error: 'Insufficient balance',
        available,
        requested: withdrawAmount,
      });
    }
    
    // Record withdrawal intent
    const withdrawalQuery = `
      INSERT INTO fee_withdrawals (amount_usd, from_address, to_address, status, period_end)
      VALUES ($1, $2, $3, 'pending', NOW())
      RETURNING *
    `;
    const feeRecipient = feeService.getFeeRecipient();
    const result = await databaseService.query(withdrawalQuery, [
      withdrawAmount,
      feeRecipient ? feeRecipient.toBase58() : 'treasury',
      toAddress,
    ]);
    
    logger.info(`💸 Withdrawal initiated: $${withdrawAmount} to ${toAddress}`);
    
    res.json({
      success: true,
      withdrawal: result.rows[0],
      message: 'Withdrawal initiated. Execute the Solana transfer to complete.',
      note: 'Manual transfer required - update withdrawal status after completion',
    });
  } catch (error) {
    logger.error('Error initiating withdrawal:', error);
    res.status(500).json({ error: 'Failed to initiate withdrawal' });
  }
});

/**
 * GET /api/v1/fees/dashboard
 * Get dashboard summary data (admin only)
 */
router.get('/dashboard', requireApiKey, async (req, res) => {
  try {
    // Get in-memory stats
    const stats = feeService.getStats();
    
    // Get today's stats from database
    const todayQuery = `
      SELECT * FROM fee_daily_summary
      WHERE date = CURRENT_DATE
    `;
    const todayResult = await databaseService.query(todayQuery);
    
    // Get this week
    const weekQuery = `
      SELECT 
        COALESCE(SUM(total_fee_usd), 0) as fees,
        COALESCE(SUM(total_transactions), 0) as transactions,
        COALESCE(SUM(total_volume_usd), 0) as volume
      FROM fee_daily_summary
      WHERE date >= CURRENT_DATE - INTERVAL '7 days'
    `;
    const weekResult = await databaseService.query(weekQuery);
    
    // Get this month
    const monthQuery = `
      SELECT 
        COALESCE(SUM(total_fee_usd), 0) as fees,
        COALESCE(SUM(total_transactions), 0) as transactions,
        COALESCE(SUM(total_volume_usd), 0) as volume
      FROM fee_daily_summary
      WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
    `;
    const monthResult = await databaseService.query(monthQuery);
    
    // Get pending balance
    const pendingQuery = `
      SELECT COALESCE(SUM(fee_usd), 0) as pending
      FROM fee_collections
      WHERE status = 'collected'
    `;
    const pendingResult = await databaseService.query(pendingQuery);
    
    res.json({
      success: true,
      dashboard: {
        // Current session (in-memory)
        session: {
          fees: stats.totalFeesCollected,
          transactions: stats.totalTransactions,
          uptimeHours: stats.uptimeHours,
        },
        
        // Today
        today: todayResult.rows[0] || { total_fee_usd: 0, total_transactions: 0 },
        
        // This week
        week: weekResult.rows[0] || { fees: 0, transactions: 0, volume: 0 },
        
        // This month
        month: monthResult.rows[0] || { fees: 0, transactions: 0, volume: 0 },
        
        // Pending withdrawal
        pendingBalance: parseFloat(pendingResult.rows[0].pending),
        
        // Configuration
        config: stats.configuration,
        
        // Projections
        projections: {
          daily: stats.projectedDaily,
          monthly: stats.projectedMonthly,
        },
      },
    });
  } catch (error) {
    logger.error('Error getting dashboard:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

module.exports = router;

