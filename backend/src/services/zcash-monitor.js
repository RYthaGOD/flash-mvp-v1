const zcashWallet = require('./zcash-wallet');
const zcashService = require('./zcash');

/**
 * Zcash Transaction Monitor
 * Monitors wallet for incoming ZEC payments and triggers bridge minting
 */
class ZcashMonitor {
  constructor() {
    this.isMonitoring = false;
    this.monitoringInterval = null;
    // Use Map with timestamps for LRU eviction (max 5000 entries)
    this.processedTransactions = new Map();
    this.maxProcessedTransactions = 5000;
    this.lastCheckedBlock = null;
    this.callbacks = [];
  }

  /**
   * Add transaction to processed set with LRU eviction
   * @param {string} txHash - Transaction hash
   */
  markTransactionProcessed(txHash) {
    // If at capacity, remove oldest entry
    if (this.processedTransactions.size >= this.maxProcessedTransactions) {
      const oldestEntry = this.processedTransactions.entries().next().value;
      if (oldestEntry) {
        this.processedTransactions.delete(oldestEntry[0]);
      }
    }
    this.processedTransactions.set(txHash, Date.now());
  }

  /**
   * Check if transaction was processed
   * @param {string} txHash - Transaction hash
   * @returns {boolean} Whether transaction was processed
   */
  isTransactionProcessed(txHash) {
    return this.processedTransactions.has(txHash);
  }

  /**
   * Start monitoring for incoming ZEC payments
   * @param {Function} callback - Called when new payment detected
   */
  async startMonitoring(callback) {
    if (this.isMonitoring) {
      console.log('Zcash monitoring already started');
      return;
    }

    if (process.env.USE_ZECWALLET_CLI !== 'true') {
      console.warn('Zcash wallet not enabled. Set USE_ZECWALLET_CLI=true to enable monitoring');
      return;
    }

    if (callback) {
      this.callbacks.push(callback);
    }

    this.isMonitoring = true;
    console.log('Starting Zcash transaction monitoring...');

    // Initial sync
    try {
      await zcashWallet.sync();
    } catch (error) {
      console.warn('Initial wallet sync failed:', error.message);
    }

    // Poll for new transactions every 60 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.checkForNewPayments();
    }, 60000); // Check every minute

    // Also check immediately
    await this.checkForNewPayments();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    this.callbacks = [];
    console.log('Zcash monitoring stopped');
  }

  /**
   * Check for new payments to bridge address
   */
  async checkForNewPayments() {
    if (!this.isMonitoring) return;

    try {
      // Get recent transactions from wallet
      const transactions = await zcashWallet.getTransactions(50);
      const bridgeAddress = await zcashService.getBridgeAddress();

      for (const tx of transactions) {
        // Check database first (database is source of truth)
        const databaseService = require('./database');
        let alreadyProcessed = false;
        
        if (databaseService.isConnected()) {
          // Check if transaction was already processed in database
          // Use isEventProcessed to check if this Zcash transaction was processed
          alreadyProcessed = await databaseService.isEventProcessed(tx.txHash);
          
          if (alreadyProcessed) {
            // Already processed in database - update cache and skip
            if (!this.isTransactionProcessed(tx.txHash)) {
              this.markTransactionProcessed(tx.txHash);
            }
            continue;
          }
        } else {
          // Fallback: Use in-memory cache if database not available
          if (this.isTransactionProcessed(tx.txHash)) {
            continue;
          }
        }

        // Verify transaction is to bridge address
        // In production, this would parse transaction outputs
        // For MVP, we'll verify the transaction exists and is confirmed
        try {
          const verification = await zcashService.verifyShieldedTransaction(tx.txHash);
          
          if (verification.verified && verification.confirmed) {
            // Mark as processed in database first (database is source of truth)
            if (databaseService.isConnected()) {
              try {
                await databaseService.markEventProcessed({
                  eventSignature: tx.txHash,
                  eventType: 'ZcashDeposit',
                  solanaAddress: null, // Will be set by handler
                  amount: null, // Will be extracted by handler
                });
              } catch (error) {
                console.error('Error marking Zcash transaction as processed:', error);
              }
            }
            
            // Mark as processed in cache
            this.markTransactionProcessed(tx.txHash);
            
            console.log(`New ZEC payment detected: ${tx.txHash}`);
            console.log(`Block height: ${verification.blockHeight}`);
            
            // Notify callbacks
            for (const callback of this.callbacks) {
              try {
                await callback({
                  txHash: tx.txHash,
                  blockHeight: verification.blockHeight,
                  timestamp: verification.timestamp,
                  bridgeAddress,
                  // Amount would be extracted from transaction in production
                });
              } catch (error) {
                console.error('Error in payment callback:', error);
              }
            }
          }
        } catch (error) {
          console.warn(`Error verifying transaction ${tx.txHash}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error checking for new payments:', error.message);
    }
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      processedCount: this.processedTransactions.size,
      maxProcessedTransactions: this.maxProcessedTransactions,
      callbackCount: this.callbacks.length,
    };
  }
}

module.exports = new ZcashMonitor();

