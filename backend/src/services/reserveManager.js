const databaseService = require('./database');
const bitcoinService = require('./bitcoin');
const { createLogger } = require('../utils/logger');

const logger = createLogger('reserve-manager');

/**
 * Centralized Reserve Manager
 * Single source of truth for all reserve operations
 * Prevents conflicts between services tracking reserves independently
 */
class ReserveManager {
  constructor() {
    this.cache = new Map(); // TTL cache with size limits
    this.cacheTTL = parseInt(process.env.RESERVE_CACHE_TTL) || 30000; // 30 seconds
    this.maxCacheSize = parseInt(process.env.RESERVE_MAX_CACHE_SIZE) || 100; // Maximum cache entries
    this.cleanupIntervalMs = parseInt(process.env.RESERVE_CLEANUP_INTERVAL) || (5 * 60 * 1000); // 5 minutes
    this.cleanupInterval = null;

    // Start cleanup interval to prevent memory leaks
    this.startCleanupInterval();
  }

  /**
   * Start cleanup interval to prevent unbounded cache growth
   */
  startCleanupInterval() {
    // Clean up at configured interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, this.cleanupIntervalMs);
  }

  /**
   * Cleanup expired and excess cache entries
   */
  cleanupCache() {
    const now = Date.now();
    let cleanedCount = 0;

    // Remove expired entries
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    // If still over limit, remove oldest entries (LRU eviction)
    if (this.cache.size > this.maxCacheSize) {
      const entriesToRemove = this.cache.size - this.maxCacheSize;
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp) // Sort by timestamp (oldest first)
        .slice(0, entriesToRemove);

      for (const [key] of sortedEntries) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`🧹 ReserveManager cache cleanup: removed ${cleanedCount} entries, ${this.cache.size} remaining`);
    }
  }

  /**
   * Get current BTC reserve (database is source of truth)
   * @param {string} bridgeAddress - BTC bridge address
   * @param {boolean} useCache - Whether to use cached value
   * @returns {Promise<Object>} { reserveSatoshis, reserveBTC, lastUpdated }
   */
  async getCurrentBTCReserve(bridgeAddress = null, useCache = true) {
    try {
      // Use cache if available and not expired
      if (useCache) {
        const cacheKey = `btc_reserve_${bridgeAddress || 'default'}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
          return cached.data;
        }
      }

      // Get bridge address from service if not provided
      const address = bridgeAddress || bitcoinService.bridgeAddress;
      if (!address) {
        throw new Error('Bridge address not configured');
      }

      // Try to query database for current reserve (authoritative source)
      let reserveSatoshis = 0;
      try {
        const client = await databaseService.pool.connect();
        try {
          const bootstrapAmount = bitcoinService.bootstrapAmount || 0;

          const reserveQuery = `
            SELECT
              ($1::BIGINT + COALESCE(deposit_sum.total, 0) - COALESCE(withdrawal_sum.total, 0)) as current_reserve
            FROM (
              SELECT SUM(amount_satoshis) as total
              FROM btc_deposits
              WHERE bridge_address = $2 AND status = 'confirmed'
            ) deposit_sum
            CROSS JOIN (
              SELECT SUM(amount_satoshis) as total
              FROM btc_withdrawals
              WHERE bridge_address = $2 AND status = 'confirmed'
            ) withdrawal_sum
          `;

          const result = await client.query(reserveQuery, [bootstrapAmount, address]);
          reserveSatoshis = parseInt(result.rows[0].current_reserve) || 0;
        } finally {
          client.release();
        }
      } catch (dbError) {
        logger.warn('Database unavailable for BTC reserve calculation, using fallback', { error: dbError.message });
        // For demo purposes, return 0 when database is unavailable
        reserveSatoshis = 0;
      }

      const reserveBTC = reserveSatoshis / 100000000;

      const reserveData = {
        reserveSatoshis,
        reserveBTC,
        lastUpdated: new Date(),
        bridgeAddress: address
      };

      // Cache the result (with size limits)
      if (useCache) {
        const cacheKey = `btc_reserve_${bridgeAddress || 'default'}`;

        // Check cache size before adding
        if (this.cache.size >= this.maxCacheSize) {
          this.cleanupCache(); // Force cleanup if at limit
        }

        this.cache.set(cacheKey, {
          data: reserveData,
          timestamp: Date.now()
        });
      }

      return reserveData;

    } catch (error) {
      logger.error('Error getting current BTC reserve', { error });
      // Return safe defaults on error
      return {
        reserveSatoshis: 0,
        reserveBTC: 0,
        lastUpdated: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Check if sufficient BTC reserve is available
   * @param {number} requestedAmountSatoshis - Amount requested in satoshis
   * @param {string} bridgeAddress - BTC bridge address
   * @returns {Promise<Object>} { sufficient: boolean, currentReserve: number, shortfall: number }
   */
  async checkBTCReserve(requestedAmountSatoshis, bridgeAddress = null) {
    const reserve = await this.getCurrentBTCReserve(bridgeAddress);

    const sufficient = reserve.reserveSatoshis >= requestedAmountSatoshis;
    const shortfall = sufficient ? 0 : (requestedAmountSatoshis - reserve.reserveSatoshis);

    return {
      sufficient,
      currentReserve: reserve.reserveSatoshis,
      currentReserveBTC: reserve.reserveBTC,
      requestedAmount: requestedAmountSatoshis,
      requestedAmountBTC: requestedAmountSatoshis / 100000000,
      shortfall,
      shortfallBTC: shortfall / 100000000,
      lastUpdated: reserve.lastUpdated
    };
  }

  /**
   * Atomically reserve BTC for withdrawal (through database service)
   * This is the ONLY way to reserve BTC - prevents race conditions
   * @param {number} requestedAmountSatoshis - Amount to reserve in satoshis
   * @param {Object} withdrawalData - Withdrawal transaction data
   * @param {Object} client - Optional database client for transactions
   * @returns {Promise<Object>} { success: boolean, reserveCheck: Object, withdrawal: Object }
   */
  async reserveBTCForWithdrawal(requestedAmountSatoshis, withdrawalData, client = null) {
    try {
      const bridgeAddress = bitcoinService.bridgeAddress;
      const bootstrapAmount = bitcoinService.bootstrapAmount || 0;

      // Use database service for atomic reserve checking and withdrawal recording
      const result = await databaseService.checkAndReserveBTC(
        bridgeAddress,
        bootstrapAmount,
        requestedAmountSatoshis,
        withdrawalData,
        client
      );

      // Invalidate cache since reserve has changed
      this.invalidateCache();

      return result;

    } catch (error) {
      logger.error('Error reserving BTC for withdrawal', { error });
      return {
        success: false,
        error: error.message,
        reserveCheck: { sufficient: false, currentReserve: 0 }
      };
    }
  }

  /**
   * Get ZEC treasury balance
   * @returns {Promise<Object>} { balance: bigint, balanceZEC: number }
   */
  async getZECTreasuryBalance() {
    try {
      const solanaService = require('./solana');
      const balance = await solanaService.getTreasuryZECBalance();

      return {
        balance,
        balanceZEC: Number(balance) / 100000000,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error getting ZEC treasury balance', { error });
      return {
        balance: 0n,
        balanceZEC: 0,
        error: error.message,
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Check if sufficient ZEC reserve is available
   * @param {number} requestedAmountSmallest - Amount requested in smallest units
   * @returns {Promise<Object>} { sufficient: boolean, currentBalance: bigint, shortfall: number }
   */
  async checkZECReserve(requestedAmountSmallest) {
    const treasury = await this.getZECTreasuryBalance();

    const sufficient = treasury.balance >= BigInt(requestedAmountSmallest);
    const shortfall = sufficient ? 0 : Number(BigInt(requestedAmountSmallest) - treasury.balance);

    return {
      sufficient,
      currentBalance: treasury.balance,
      currentBalanceZEC: treasury.balanceZEC,
      requestedAmount: requestedAmountSmallest,
      requestedAmountZEC: requestedAmountSmallest / 100000000,
      shortfall,
      shortfallZEC: shortfall / 100000000,
      lastUpdated: treasury.lastUpdated
    };
  }

  /**
   * Invalidate cache (call after any reserve-changing operations)
   */
  invalidateCache() {
    this.cache.clear();
    logger.info('🧹 Reserve cache invalidated');
  }

  /**
   * Get reserve status summary for all assets
   * @returns {Promise<Object>} Summary of all reserves
   */
  async getReserveSummary() {
    try {
      const [btcReserve, zecReserve] = await Promise.all([
        this.getCurrentBTCReserve(),
        this.getZECTreasuryBalance()
      ]);

      return {
        btc: btcReserve,
        zec: zecReserve,
        timestamp: new Date(),
        status: 'healthy'
      };
    } catch (error) {
      logger.error('Error getting reserve summary', { error });
      return {
        btc: { reserveSatoshis: 0, reserveBTC: 0, error: error.message },
        zec: { balance: 0n, balanceZEC: 0, error: error.message },
        timestamp: new Date(),
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Health check for reserve management
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const summary = await this.getReserveSummary();
      const isHealthy = !summary.btc.error && !summary.zec.error;

      return {
        healthy: isHealthy,
        summary,
        cacheSize: this.cache.size,
        maxCacheSize: this.maxCacheSize,
        cacheUtilization: (this.cache.size / this.maxCacheSize * 100).toFixed(1) + '%'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        cacheSize: this.cache.size,
        maxCacheSize: this.maxCacheSize
      };
    }
  }

  /**
   * Stop cleanup interval (for graceful shutdown)
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

module.exports = new ReserveManager();
