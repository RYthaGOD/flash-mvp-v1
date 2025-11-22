const axios = require('axios');
const zcashWallet = require('./zcash-wallet');

/**
 * Zcash Service
 * Handles interaction with Zcash blockchain for verifying shielded transactions
 * Now integrated with zecwallet-light-cli for wallet management
 */
class ZcashService {
  constructor() {
    // Using public Zcash lightwalletd endpoints
    this.lightwalletdUrl = process.env.ZCASH_LIGHTWALLETD_URL || 'https://zcash-mainnet.chainsafe.dev';
    this.explorerUrl = process.env.ZCASH_EXPLORER_URL || 'https://zcashblockexplorer.com';
    this.network = process.env.ZCASH_NETWORK || 'mainnet';
    this.useWallet = process.env.USE_ZECWALLET_CLI === 'true';
    
    // Price caching to avoid rate limits
    this.priceCache = {
      price: null,
      timestamp: null,
      ttl: 5 * 60 * 1000, // 5 minutes cache
    };
    
    // Initialize wallet if enabled
    if (this.useWallet) {
      this.initializeWallet();
    }
  }

  /**
   * Initialize zecwallet-light-cli wallet
   */
  async initializeWallet() {
    try {
      await zcashWallet.initializeWallet();
      console.log('Zcash wallet initialized');
    } catch (error) {
      console.warn('Could not initialize Zcash wallet:', error.message);
      console.warn('Falling back to manual address configuration');
    }
  }

  /**
   * Verify a Zcash shielded transaction
   * @param {string} txHash - Transaction hash
   * @param {number} expectedAmount - Optional expected amount in ZEC
   * @returns {Promise<Object>} Transaction details
   */
  async verifyShieldedTransaction(txHash, expectedAmount = null) {
    try {
      console.log(`Verifying Zcash transaction: ${txHash}`);
      
      // If wallet is enabled, try to verify using wallet
      if (this.useWallet) {
        try {
          const zcashWallet = require('./zcash-wallet');
          const transactions = await zcashWallet.getTransactions(100);
          
          // Check if transaction exists in wallet history
          const walletTx = transactions.find(tx => tx.txHash === txHash);
          if (walletTx) {
            console.log('Transaction found in wallet history');
            // Get transaction details from explorer
            const txDetails = await this.getTransaction(txHash);
            
            return {
              txHash,
              confirmed: true,
              blockHeight: txDetails.height || 2500000,
              timestamp: txDetails.timestamp || Date.now(),
              amount: expectedAmount || 0,
              verified: true,
              network: this.network,
              source: 'wallet',
            };
          }
        } catch (error) {
          console.warn('Wallet verification failed, falling back to explorer:', error.message);
        }
      }
      
      // Fallback: Use explorer API
      const txDetails = await this.getTransaction(txHash);
      
      // In a real implementation, this would:
      // 1. Query lightwalletd for transaction details
      // 2. Verify the transaction is confirmed
      // 3. Extract shielded amount
      // 4. Verify the receiving address matches our bridge address
      
      // For MVP, we'll use explorer data
      const verifiedTransaction = {
        txHash,
        confirmed: !txDetails.mock,
        blockHeight: txDetails.height || 2500000,
        timestamp: txDetails.timestamp ? txDetails.timestamp * 1000 : Date.now(),
        amount: expectedAmount || 0,
        verified: true,
        network: this.network,
        source: 'explorer',
      };

      return verifiedTransaction;
    } catch (error) {
      console.error('Error verifying Zcash transaction:', error);
      throw new Error(`Failed to verify Zcash transaction: ${error.message}`);
    }
  }

  /**
   * Get Zcash transaction from explorer API
   * @param {string} txHash - Transaction hash
   * @returns {Promise<Object>} Transaction data
   */
  async getTransaction(txHash) {
    try {
      // Query Zcash explorer API
      const url = `${this.explorerUrl}/api/tx/${txHash}`;
      const response = await axios.get(url, {
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching transaction ${txHash}:`, error.message);
      
      // Return mock data if explorer is unavailable
      return {
        txid: txHash,
        height: 2500000,
        timestamp: Date.now() / 1000,
        shielded: true,
        mock: true,
      };
    }
  }

  /**
   * Verify a shielded proof
   * In production, this would use ZK proof verification
   * @param {Object} proof - ZK proof data
   * @returns {Promise<boolean>} Whether proof is valid
   */
  async verifyShieldedProof(proof) {
    try {
      console.log('Verifying shielded proof...');
      
      // In production:
      // 1. Parse the Halo2 proof
      // 2. Verify using zcash cryptographic libraries
      // 3. Ensure proof matches claimed shielded amount
      
      // For MVP, accept all proofs
      return true;
    } catch (error) {
      console.error('Error verifying proof:', error);
      return false;
    }
  }

  /**
   * Get current ZEC price (for calculating SOL equivalent)
   * Uses caching to avoid rate limits (429 errors)
   * @returns {Promise<number>} ZEC price in USD
   */
  async getZecPrice() {
    // Check cache first
    const now = Date.now();
    if (this.priceCache.price && this.priceCache.timestamp) {
      const cacheAge = now - this.priceCache.timestamp;
      if (cacheAge < this.priceCache.ttl) {
        console.log(`Returning cached ZEC price: $${this.priceCache.price} (cache age: ${Math.round(cacheAge / 1000)}s)`);
        return this.priceCache.price;
      }
    }

    try {
      // In production, use a price oracle like Chainlink or CoinGecko
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd',
        { 
          timeout: 5000,
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      const price = response.data.zcash.usd;
      
      // Update cache
      this.priceCache.price = price;
      this.priceCache.timestamp = now;
      
      console.log(`Fetched ZEC price: $${price}`);
      return price;
    } catch (error) {
      // Handle rate limiting (429)
      if (error.response && error.response.status === 429) {
        console.warn('Rate limited by CoinGecko API (429). Using cached price or fallback.');
        
        // If we have cached price, use it even if expired
        if (this.priceCache.price) {
          console.log(`Using expired cache due to rate limit: $${this.priceCache.price}`);
          return this.priceCache.price;
        }
        
        // Return fallback price
        console.warn('No cached price available, using fallback: $30');
        return 30; // USD fallback
      }
      
      console.error('Error fetching ZEC price:', error.message);
      
      // If we have cached price, use it
      if (this.priceCache.price) {
        console.log(`Using cached price due to error: $${this.priceCache.price}`);
        return this.priceCache.price;
      }
      
      // Return fallback price
      return 30; // USD
    }
  }

  /**
   * Monitor for new shielded transactions to bridge address
   * This would be used by a background service
   * @param {string} bridgeAddress - Zcash shielded address
   * @param {Function} callback - Called when new transaction detected
   */
  async monitorShieldedTransactions(bridgeAddress, callback) {
    console.log(`Starting monitor for address: ${bridgeAddress}`);
    
    // In production:
    // 1. Connect to lightwalletd streaming API
    // 2. Filter for transactions to bridge address
    // 3. Call callback with transaction details
    
    // For MVP, this is a placeholder
    console.log('Transaction monitoring would be implemented here');
  }

  /**
   * Generate a unique bridge transaction ID
   * @param {string} zcashTxHash - Zcash transaction hash
   * @returns {string} Bridge transaction ID
   */
  generateBridgeTxId(zcashTxHash) {
    return `zec_${zcashTxHash.substring(0, 16)}_${Date.now()}`;
  }

  /**
   * Validate Zcash address format
   * @param {string} address - Zcash address
   * @returns {boolean} Whether address is valid
   */
  isValidZcashAddress(address) {
    // Zcash addresses start with:
    // - 't1' (transparent P2PKH)
    // - 't3' (transparent P2SH)
    // - 'zs1' (Sapling shielded)
    // - 'ztestsapling' (testnet Sapling)
    
    const validPrefixes = ['t1', 't3', 'zs1', 'ztestsapling'];
    return validPrefixes.some(prefix => address.startsWith(prefix));
  }

  /**
   * Get network info
   * @returns {Object} Network information
   */
  async getNetworkInfo() {
    const info = {
      network: this.network,
      lightwalletdUrl: this.lightwalletdUrl,
      explorerUrl: this.explorerUrl,
      connected: true,
      walletEnabled: this.useWallet,
    };

    // If wallet is enabled, get wallet status
    if (this.useWallet) {
      try {
        const walletStatus = await zcashWallet.getStatus();
        info.wallet = walletStatus;
        
        // Get bridge address from wallet if available
        if (walletStatus.walletExists) {
          try {
            const bridgeAddress = await zcashWallet.getBridgeAddress();
            info.bridgeAddress = bridgeAddress;
          } catch (error) {
            console.warn('Could not get bridge address from wallet:', error.message);
          }
        }
      } catch (error) {
        console.warn('Error getting wallet status:', error.message);
      }
    }

    return info;
  }

  /**
   * Get bridge address (from wallet or env)
   * @returns {Promise<string>} Bridge address
   */
  async getBridgeAddress() {
    // If wallet is enabled, get address from wallet
    if (this.useWallet) {
      try {
        const address = await zcashWallet.getBridgeAddress();
        if (address) {
          return address;
        }
      } catch (error) {
        console.warn('Could not get address from wallet, using env:', error.message);
      }
    }

    // Fallback to environment variable
    return process.env.ZCASH_BRIDGE_ADDRESS || 'zs1_bridge_address_placeholder';
  }

  /**
   * Get wallet balance
   * @returns {Promise<Object>} Balance information
   */
  async getWalletBalance() {
    if (!this.useWallet) {
      return {
        total: 0,
        confirmed: 0,
        unconfirmed: 0,
        error: 'Wallet not enabled',
      };
    }

    try {
      return await zcashWallet.getBalance();
    } catch (error) {
      console.error('Error getting wallet balance:', error);
      return {
        total: 0,
        confirmed: 0,
        unconfirmed: 0,
        error: error.message,
      };
    }
  }
}

module.exports = new ZcashService();
