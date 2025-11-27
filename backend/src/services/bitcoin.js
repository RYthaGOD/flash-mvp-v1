const axios = require('axios');

/**
 * Circuit Breaker for external API calls
 * Prevents cascading failures and allows graceful degradation
 */
class CircuitBreaker {
  constructor(failureThreshold = 5, recoveryTimeout = 60000, monitoringPeriod = 10000) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;
    this.monitoringPeriod = monitoringPeriod;

    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        console.log('🔄 Circuit breaker: Testing recovery');
      } else {
        throw new Error('Circuit breaker is OPEN - external service unavailable');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`🔴 Circuit breaker: OPEN after ${this.failures} failures`);
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailureTime
    };
  }
}

/**
 * Bitcoin Service
 * Handles Bitcoin blockchain monitoring and payment verification
 * For Cash App user onboarding
 */
class BitcoinService {
  constructor() {
    this.network = process.env.BITCOIN_NETWORK || 'mainnet';
    this.bridgeAddress = process.env.BITCOIN_BRIDGE_ADDRESS;
    this.explorerUrl = process.env.BITCOIN_EXPLORER_URL || 'https://blockstream.info/api';
    this.currentReserve = 0; // BTC in satoshis
    this.bootstrapAmount = parseFloat(process.env.BOOTSTRAP_BTC || '0') * 100000000; // Convert to satoshis
    this.monitoringInterval = null;
    this.processedTransactions = new Set();

    // Circuit breaker for API calls
    this.apiCircuitBreaker = new CircuitBreaker(5, 60000, 10000);

    // Health monitoring
    this.lastApiCall = Date.now();
    this.apiCallCount = 0;
    this.apiErrorCount = 0;
  }

  /**
   * Initialize Bitcoin monitoring
   */
  async initialize() {
    if (!this.bridgeAddress) {
      console.warn('Bitcoin bridge address not configured. Set BITCOIN_BRIDGE_ADDRESS in .env');
      return;
    }

    this.currentReserve = this.bootstrapAmount;
    console.log(`Bitcoin service initialized`);
    console.log(`Bridge address: ${this.bridgeAddress}`);
    console.log(`Bootstrap reserve: ${this.bootstrapAmount / 100000000} BTC`);
    console.log(`Network: ${this.network}`);
  }

  /**
   * Start monitoring Bitcoin blockchain for payments to bridge address
   * @param {Function} callback - Called when new payment detected
   */
  async startMonitoring(callback) {
    if (!this.bridgeAddress) {
      console.warn('Cannot start monitoring: Bitcoin bridge address not configured');
      return;
    }

    console.log(`Starting Bitcoin monitoring for address: ${this.bridgeAddress}`);

    // Poll Bitcoin explorer API for new transactions
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkForNewPayments(callback);
      } catch (error) {
        console.error('Error monitoring Bitcoin:', error.message);
      }
    }, 60000); // Check every minute

    // Initial check
    await this.checkForNewPayments(callback);
  }

  /**
   * Check for new payments to bridge address
   */
  async checkForNewPayments(callback) {
    try {
      const txs = await this.getAddressTransactions(this.bridgeAddress);

      for (const tx of txs) {
        // Skip if already processed
        if (this.processedTransactions.has(tx.txid)) {
          continue;
        }

        // Check if transaction is confirmed (6+ confirmations for security)
        if (tx.status && tx.status.confirmations >= 6) {
          // Extract amount sent to bridge address
          const amount = this.extractAmountToAddress(tx, this.bridgeAddress);

          if (amount > 0) {
            this.processedTransactions.add(tx.txid);
            this.currentReserve += amount;

            console.log(`BTC payment detected: ${amount / 100000000} BTC`);
            console.log(`Reserve updated: ${this.currentReserve / 100000000} BTC`);

            // Callback to trigger zenZEC minting
            if (callback) {
              callback({
                txHash: tx.txid,
                amount: amount, // in satoshis
                confirmations: tx.status.confirmations,
                blockHeight: tx.status.block_height,
                timestamp: tx.status.block_time,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking for payments:', error.message);
    }
  }

  /**
   * Extract amount sent to specific address from transaction
   */
  extractAmountToAddress(tx, address) {
    if (!tx.vout) return 0;

    return tx.vout
      .filter(output => output.scriptpubkey_address === address)
      .reduce((sum, output) => sum + output.value, 0);
  }

  /**
   * Verify Bitcoin payment
   * @param {string} txHash - Transaction hash
   * @param {number} expectedAmount - Expected amount in BTC (will be converted to satoshis)
   * @returns {Promise<Object>} Verification result
   */
  async verifyBitcoinPayment(txHash, expectedAmount) {
    try {
      const tx = await this.getTransaction(txHash);

      // Check if transaction exists
      if (!tx) {
        return {
          verified: false,
          reason: 'Transaction not found',
        };
      }

      // Check if transaction is confirmed
      if (!tx.status || !tx.status.block_height) {
        return {
          verified: false,
          reason: 'Transaction not confirmed',
        };
      }

      // Check confirmations (need 6+ for security)
      const confirmations = tx.status.confirmations || 0;
      if (confirmations < 6) {
        return {
          verified: false,
          reason: 'Insufficient confirmations',
          confirmations,
          required: 6,
        };
      }

      // Check if payment is to bridge address
      const amount = this.extractAmountToAddress(tx, this.bridgeAddress);

      if (amount === 0) {
        return {
          verified: false,
          reason: 'Payment not to bridge address',
        };
      }

      // Convert expected amount to satoshis for comparison
      const expectedSatoshis = Math.floor(expectedAmount * 100000000);

      // Allow small variance for fees (within 1%)
      const variance = expectedSatoshis * 0.01;
      if (Math.abs(amount - expectedSatoshis) > variance) {
        return {
          verified: false,
          reason: 'Amount mismatch',
          expected: expectedSatoshis,
          received: amount,
        };
      }

      return {
        verified: true,
        txHash,
        amount, // in satoshis
        amountBTC: amount / 100000000,
        confirmations,
        blockHeight: tx.status.block_height,
        timestamp: tx.status.block_time,
      };
    } catch (error) {
      console.error('Error verifying Bitcoin payment:', error);
      return {
        verified: false,
        reason: error.message,
      };
    }
  }

  /**
   * Get transaction from explorer with circuit breaker protection
   * @param {string} txHash - Transaction hash
   * @returns {Promise<Object>} Transaction data
   */
  async getTransaction(txHash) {
    return await this.apiCircuitBreaker.execute(async () => {
      try {
        this.lastApiCall = Date.now();
        this.apiCallCount++;

        const url = `${this.explorerUrl}/tx/${txHash}`;
        console.log('BitcoinService.getTransaction calling URL:', url);

        const response = await axios.get(url, {
          timeout: 10000, // 10 second timeout
          headers: {
            'User-Agent': 'FLASH-Bridge/1.0'
          }
        });

        console.log('BitcoinService.getTransaction received data');
        return response.data;
      } catch (error) {
        this.apiErrorCount++;
        console.error(`Error fetching transaction ${txHash}:`, error.message);

        // Re-throw with more context
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          throw new Error(`Bitcoin API unavailable: ${error.message}`);
        } else if (error.response?.status === 429) {
          throw new Error('Bitcoin API rate limited');
        } else if (error.response?.status >= 500) {
          throw new Error(`Bitcoin API server error: ${error.response.status}`);
        } else if (error.code === 'ECONNABORTED') {
          throw new Error('Bitcoin API timeout');
        }

        throw error;
      }
    });
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    const circuitState = this.apiCircuitBreaker.getState();
    const uptime = Date.now() - this.lastApiCall;

    return {
      service: 'bitcoin',
      healthy: circuitState.state === 'CLOSED',
      circuitBreaker: circuitState,
      stats: {
        totalCalls: this.apiCallCount,
        errorCount: this.apiErrorCount,
        errorRate: this.apiCallCount > 0 ? (this.apiErrorCount / this.apiCallCount) * 100 : 0,
        lastCall: new Date(this.lastApiCall).toISOString(),
        uptime: Math.round(uptime / 1000) // seconds
      },
      network: this.network,
      bridgeAddress: this.bridgeAddress ? 'configured' : 'not configured'
    };
  }

  /**
   * Get address transactions from explorer
   * @param {string} address - Bitcoin address
   * @returns {Promise<Array>} Array of transactions
   */
  async getAddressTransactions(address) {
    try {
      const response = await axios.get(`${this.explorerUrl}/address/${address}/txs`, {
        timeout: 10000,
      });
      return response.data || [];
    } catch (error) {
      console.error(`Error fetching address transactions:`, error.message);
      return [];
    }
  }

  /**
   * Get current BTC reserve
   * @returns {number} Reserve in satoshis
   */
  getCurrentReserve() {
    return this.currentReserve;
  }

  /**
   * Get current BTC reserve in BTC
   * @returns {number} Reserve in BTC
   */
  getCurrentReserveBTC() {
    return this.currentReserve / 100000000;
  }

  /**
   * Add to reserve (called when BTC is received)
   * @param {number} amount - Amount in satoshis
   */
  addToReserve(amount) {
    this.currentReserve += amount;
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Bitcoin monitoring stopped');
    }
  }

  /**
   * Get bridge address
   * @returns {string} Bitcoin bridge address
   */
  getBridgeAddress() {
    return this.bridgeAddress;
  }

  /**
   * Validate Bitcoin address format
   * @param {string} address - Bitcoin address
   * @returns {boolean} Whether address is valid
   */
  isValidAddress(address) {
    if (!address || typeof address !== 'string') {
      return false;
    }

    // Bitcoin address formats:
    // - Legacy (P2PKH): starts with '1'
    // - P2SH: starts with '3'
    // - Bech32 (Native SegWit): starts with 'bc1' (mainnet) or 'tb1' (testnet)
    // - Taproot: starts with 'bc1p' (mainnet) or 'tb1p' (testnet)
    
    const validPrefixes = this.network === 'mainnet' 
      ? ['1', '3', 'bc1']
      : ['m', 'n', '2', 'tb1'];
    
    // Check for valid prefix
    const hasValidPrefix = validPrefixes.some(prefix => address.startsWith(prefix));
    
    // Basic length check (Bitcoin addresses are typically 26-62 characters)
    const validLength = address.length >= 26 && address.length <= 62;
    
    return hasValidPrefix && validLength;
  }

  /**
   * Send BTC to an address
   * @param {string} toAddress - Bitcoin address
   * @param {number} amount - Amount in BTC
   * @returns {Promise<string>} Transaction hash
   */
  async sendBTC(toAddress, amount) {
    // For MVP, this is a placeholder
    // In production, this would:
    // 1. Use Bitcoin wallet/API to create transaction
    // 2. Sign and broadcast transaction
    // 3. Return transaction hash
    
    if (!this.isValidAddress(toAddress)) {
      throw new Error(`Invalid Bitcoin address: ${toAddress}`);
    }

    console.log(`Sending ${amount} BTC to ${toAddress}...`);
    
    // Mock implementation for MVP
    // In production, integrate with Bitcoin wallet (bitcoinjs-lib, etc.)
    const mockTxHash = `btc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    console.log(`Mock BTC transaction: ${mockTxHash}`);
    console.warn('BTC sending not fully implemented - this is a mock transaction for MVP');
    
    // Update reserve (subtract sent amount)
    this.currentReserve -= Math.floor(amount * 100000000); // Convert to satoshis
    
    return mockTxHash;
  }

  /**
   * Get network info
   * @returns {Object} Network information
   */
  getNetworkInfo() {
    return {
      network: this.network,
      bridgeAddress: this.bridgeAddress,
      explorerUrl: this.explorerUrl,
      currentReserve: this.currentReserve,
      currentReserveBTC: this.getCurrentReserveBTC(),
      bootstrapAmount: this.bootstrapAmount,
    };
  }
}

module.exports = new BitcoinService();

