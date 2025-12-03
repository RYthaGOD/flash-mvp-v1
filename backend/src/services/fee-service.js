/**
 * Fee Service - Revenue Generation for FLASH Bridge
 * =================================================
 * Handles all fee calculations, collection, and tracking
 * 
 * Revenue Streams:
 * 1. Base bridge fee (0.25-0.3%)
 * 2. Privacy premium (Arcium MPC encryption)
 * 3. Fast processing fee (1-confirmation)
 * 4. Minimum fee floor
 */

const { PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { createLogger } = require('../utils/logger');

const logger = createLogger('fee-service');

// =============================================================================
// Fee Configuration
// =============================================================================

const FEE_CONFIG = {
  // Base bridge fee (percentage)
  baseFeePercent: parseFloat(process.env.BRIDGE_FEE_PERCENT || '0.003'), // 0.3%
  
  // Privacy premium for Arcium MPC encryption
  privacyFeePercent: parseFloat(process.env.PRIVACY_FEE_PERCENT || '0.001'), // 0.1%
  
  // Fast processing (1 confirmation vs 3+)
  fastProcessingFeePercent: parseFloat(process.env.FAST_PROCESSING_FEE_PERCENT || '0.002'), // 0.2%
  
  // Minimum fee in USD (protects against dust attacks)
  minFeeUSD: parseFloat(process.env.MIN_FEE_USD || '1.00'),
  
  // Maximum fee cap in USD (fair pricing)
  maxFeeUSD: parseFloat(process.env.MAX_FEE_USD || '500.00'),
  
  // Fee recipient address (where fees are collected)
  feeRecipientAddress: process.env.FEE_RECIPIENT_ADDRESS || null,
  
  // Fee split for referrals/partners (optional)
  referralFeePercent: parseFloat(process.env.REFERRAL_FEE_PERCENT || '0.0005'), // 0.05%
};

// Service tiers with different fee structures
const SERVICE_TIERS = {
  basic: {
    name: 'Basic',
    description: 'Standard processing (3+ confirmations)',
    baseFeeMultiplier: 1.0,
    confirmations: 3,
    priority: 'normal',
    features: ['standard_speed'],
  },
  fast: {
    name: 'Fast',
    description: 'Priority processing (1 confirmation)',
    baseFeeMultiplier: 1.5,
    confirmations: 1,
    priority: 'high',
    features: ['fast_processing', '1_confirmation'],
  },
  private: {
    name: 'Private',
    description: 'Full Arcium MPC encryption',
    baseFeeMultiplier: 1.0,
    confirmations: 3,
    priority: 'normal',
    features: ['arcium_mpc', 'encrypted_amounts', 'private_verification'],
    privacyEnabled: true,
  },
  premium: {
    name: 'Premium',
    description: 'Fast + Private + Priority support',
    baseFeeMultiplier: 2.0,
    confirmations: 1,
    priority: 'highest',
    features: ['fast_processing', '1_confirmation', 'arcium_mpc', 'encrypted_amounts', 'priority_support'],
    privacyEnabled: true,
  },
};

// =============================================================================
// Fee Service Class
// =============================================================================

class FeeService {
  constructor() {
    this.config = FEE_CONFIG;
    this.tiers = SERVICE_TIERS;
    this.feeRecipient = null;
    
    // Fee statistics
    this.stats = {
      totalFeesCollected: 0,
      totalTransactions: 0,
      feesByTier: {},
      feesByDay: {},
      startTime: Date.now(),
    };
    
    this._initialize();
  }

  /**
   * Initialize fee service
   */
  _initialize() {
    // Validate fee recipient address
    if (this.config.feeRecipientAddress) {
      try {
        this.feeRecipient = new PublicKey(this.config.feeRecipientAddress);
        logger.info(`✅ Fee collection enabled`);
        logger.info(`   Recipient: ${this.feeRecipient.toBase58()}`);
        logger.info(`   Base fee: ${(this.config.baseFeePercent * 100).toFixed(2)}%`);
        logger.info(`   Privacy premium: ${(this.config.privacyFeePercent * 100).toFixed(2)}%`);
        logger.info(`   Min fee: $${this.config.minFeeUSD}`);
      } catch (error) {
        logger.error('❌ Invalid FEE_RECIPIENT_ADDRESS:', error.message);
        this.feeRecipient = null;
      }
    } else {
      logger.warn('⚠️  FEE_RECIPIENT_ADDRESS not set - fees will not be collected');
      logger.warn('   Set FEE_RECIPIENT_ADDRESS in .env to enable revenue collection');
    }
    
    // Initialize tier stats
    for (const tier of Object.keys(this.tiers)) {
      this.stats.feesByTier[tier] = { count: 0, total: 0 };
    }
  }

  /**
   * Calculate fees for a bridge transaction
   * @param {Object} params - Transaction parameters
   * @returns {Object} Fee breakdown
   */
  calculateFees(params) {
    const {
      amountUSD,
      amountBTC,
      tier = 'basic',
      usePrivacy = false,
      referralCode = null,
    } = params;

    // Get tier configuration
    const tierConfig = this.tiers[tier] || this.tiers.basic;
    
    // Calculate base fee
    let baseFee = amountUSD * this.config.baseFeePercent * tierConfig.baseFeeMultiplier;
    
    // Add privacy premium if applicable
    let privacyFee = 0;
    if (usePrivacy || tierConfig.privacyEnabled) {
      privacyFee = amountUSD * this.config.privacyFeePercent;
    }
    
    // Calculate referral discount/split
    let referralFee = 0;
    let referralDiscount = 0;
    if (referralCode) {
      referralFee = amountUSD * this.config.referralFeePercent;
      referralDiscount = referralFee * 0.5; // 50% discount to user
    }
    
    // Calculate total fee
    let totalFee = baseFee + privacyFee - referralDiscount;
    
    // Apply minimum fee
    if (totalFee < this.config.minFeeUSD) {
      totalFee = this.config.minFeeUSD;
    }
    
    // Apply maximum fee cap
    if (totalFee > this.config.maxFeeUSD) {
      totalFee = this.config.maxFeeUSD;
    }
    
    // Calculate user receives
    const userReceivesUSD = amountUSD - totalFee;
    const feePercentEffective = (totalFee / amountUSD) * 100;
    
    // Calculate in BTC terms
    const btcPrice = amountUSD / amountBTC;
    const feeBTC = totalFee / btcPrice;
    const userReceivesBTC = amountBTC - feeBTC;

    return {
      // USD values
      amountUSD,
      totalFeeUSD: Math.round(totalFee * 100) / 100,
      userReceivesUSD: Math.round(userReceivesUSD * 100) / 100,
      
      // BTC values
      amountBTC,
      feeBTC: feeBTC.toFixed(8),
      userReceivesBTC: userReceivesBTC.toFixed(8),
      
      // Fee breakdown
      breakdown: {
        baseFee: Math.round(baseFee * 100) / 100,
        privacyFee: Math.round(privacyFee * 100) / 100,
        referralDiscount: Math.round(referralDiscount * 100) / 100,
        referralFee: Math.round(referralFee * 100) / 100,
      },
      
      // Percentages
      feePercentEffective: Math.round(feePercentEffective * 100) / 100,
      feePercentBase: this.config.baseFeePercent * 100,
      
      // Tier info
      tier: tier,
      tierName: tierConfig.name,
      features: tierConfig.features,
      confirmations: tierConfig.confirmations,
      
      // Collection info
      feeRecipient: this.feeRecipient ? this.feeRecipient.toBase58() : null,
      collectionEnabled: !!this.feeRecipient,
      
      // Referral
      referralCode: referralCode || null,
      referralCredit: referralFee,
    };
  }

  /**
   * Get fee quote for UI display
   * @param {number} amountUSD - Amount in USD
   * @param {string} tier - Service tier
   * @returns {Object} Fee quote
   */
  getQuote(amountUSD, tier = 'basic') {
    return this.calculateFees({
      amountUSD,
      amountBTC: amountUSD / 100000, // Placeholder BTC price
      tier,
      usePrivacy: ['private', 'premium'].includes(tier),
    });
  }

  /**
   * Get all available tiers with pricing
   * @param {number} amountUSD - Amount for pricing
   * @returns {Array} Tier options
   */
  getTiers(amountUSD = 1000) {
    const tiers = [];
    
    for (const [id, config] of Object.entries(this.tiers)) {
      const quote = this.getQuote(amountUSD, id);
      
      tiers.push({
        id,
        ...config,
        pricing: {
          feeUSD: quote.totalFeeUSD,
          feePercent: quote.feePercentEffective,
          userReceives: quote.userReceivesUSD,
        },
      });
    }
    
    return tiers;
  }

  /**
   * Record a fee collection
   * @param {Object} feeData - Fee data to record
   */
  recordFee(feeData) {
    const { tier, totalFeeUSD, txId } = feeData;
    
    // Update stats
    this.stats.totalFeesCollected += totalFeeUSD;
    this.stats.totalTransactions++;
    
    // Update tier stats
    if (this.stats.feesByTier[tier]) {
      this.stats.feesByTier[tier].count++;
      this.stats.feesByTier[tier].total += totalFeeUSD;
    }
    
    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    if (!this.stats.feesByDay[today]) {
      this.stats.feesByDay[today] = { count: 0, total: 0 };
    }
    this.stats.feesByDay[today].count++;
    this.stats.feesByDay[today].total += totalFeeUSD;
    
    logger.info(`💰 Fee collected: $${totalFeeUSD.toFixed(2)} (${tier}) - TX: ${txId}`);
    
    return {
      recorded: true,
      txId,
      feeUSD: totalFeeUSD,
      tier,
    };
  }

  /**
   * Get fee statistics
   * @returns {Object} Fee statistics
   */
  getStats() {
    const uptimeMs = Date.now() - this.stats.startTime;
    const uptimeHours = uptimeMs / (1000 * 60 * 60);
    
    // Calculate averages
    const avgFeePerTx = this.stats.totalTransactions > 0
      ? this.stats.totalFeesCollected / this.stats.totalTransactions
      : 0;
    
    const feesPerHour = uptimeHours > 0
      ? this.stats.totalFeesCollected / uptimeHours
      : 0;
    
    // Get recent daily stats
    const recentDays = Object.entries(this.stats.feesByDay)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 30);
    
    return {
      // Summary
      totalFeesCollected: Math.round(this.stats.totalFeesCollected * 100) / 100,
      totalTransactions: this.stats.totalTransactions,
      averageFeePerTx: Math.round(avgFeePerTx * 100) / 100,
      
      // Projections
      feesPerHour: Math.round(feesPerHour * 100) / 100,
      projectedDaily: Math.round(feesPerHour * 24 * 100) / 100,
      projectedMonthly: Math.round(feesPerHour * 24 * 30 * 100) / 100,
      
      // Breakdown by tier
      byTier: this.stats.feesByTier,
      
      // Daily history
      dailyHistory: recentDays.map(([date, data]) => ({
        date,
        transactions: data.count,
        feesUSD: Math.round(data.total * 100) / 100,
      })),
      
      // Configuration
      configuration: {
        baseFeePercent: this.config.baseFeePercent * 100,
        privacyFeePercent: this.config.privacyFeePercent * 100,
        minFeeUSD: this.config.minFeeUSD,
        maxFeeUSD: this.config.maxFeeUSD,
        feeRecipient: this.feeRecipient ? this.feeRecipient.toBase58() : null,
        collectionEnabled: !!this.feeRecipient,
      },
      
      // Uptime
      uptimeHours: Math.round(uptimeHours * 10) / 10,
      startTime: new Date(this.stats.startTime).toISOString(),
    };
  }

  /**
   * Check if fee collection is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return !!this.feeRecipient;
  }

  /**
   * Get fee recipient address
   * @returns {PublicKey|null}
   */
  getFeeRecipient() {
    return this.feeRecipient;
  }

  /**
   * Get configuration
   * @returns {Object}
   */
  getConfig() {
    return {
      ...this.config,
      feeRecipientAddress: this.feeRecipient ? this.feeRecipient.toBase58() : null,
      enabled: this.isEnabled(),
    };
  }
}

// Export singleton instance
module.exports = new FeeService();

