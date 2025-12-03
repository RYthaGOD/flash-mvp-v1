/**
 * Token Treasury Service
 * Manages multiple output tokens for flexible bridge payouts
 * Supports SOL, USDC, wrapped ZEC, and future token types
 */

const { PublicKey } = require('@solana/web3.js');
const { createLogger } = require('../utils/logger');

const logger = createLogger('token-treasury');

// =============================================================================
// Token Registry - Supported Output Tokens
// =============================================================================

const TOKEN_REGISTRY = {
  // Native SOL
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    isNative: true,
    mainnet: null, // Native, no mint address
    devnet: null,
    testnet: null,
  },
  
  // USDC (Circle)
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    isNative: false,
    mainnet: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    testnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  },
  
  // Native/Wrapped ZEC on Solana
  ZEC: {
    symbol: 'ZEC',
    name: 'Zcash',
    decimals: 8,
    isNative: false,
    // Official ZEC SPL token addresses (update when available)
    mainnet: process.env.ZEC_MINT_MAINNET || 'A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS',
    devnet: process.env.ZEC_MINT_DEVNET || 'A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS',
    testnet: process.env.ZEC_MINT_TESTNET || 'A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS',
  },
  
  // USDT (Tether)
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    isNative: false,
    mainnet: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    devnet: null, // Not available on devnet
    testnet: null,
  },
  
  // Wrapped BTC (for future BTC custody)
  WBTC: {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    isNative: false,
    mainnet: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
    devnet: null,
    testnet: null,
  },
};

// =============================================================================
// Token Treasury Class
// =============================================================================

class TokenTreasury {
  constructor() {
    this.network = process.env.SOLANA_NETWORK || 'devnet';
    this.defaultOutputToken = process.env.DEFAULT_OUTPUT_TOKEN || 'SOL';
    this.supportedTokens = this._loadSupportedTokens();
    
    logger.info(`Token Treasury initialized`);
    logger.info(`   Network: ${this.network}`);
    logger.info(`   Default output: ${this.defaultOutputToken}`);
    logger.info(`   Supported tokens: ${Object.keys(this.supportedTokens).join(', ')}`);
  }

  /**
   * Load supported tokens for current network
   */
  _loadSupportedTokens() {
    const supported = {};
    
    for (const [symbol, config] of Object.entries(TOKEN_REGISTRY)) {
      // Native SOL is always supported
      if (config.isNative) {
        supported[symbol] = { ...config, mint: null };
        continue;
      }
      
      // Check if token has mint for current network
      const mintAddress = config[this.network];
      if (mintAddress) {
        supported[symbol] = { 
          ...config, 
          mint: mintAddress,
        };
      }
    }
    
    // Add custom tokens from environment
    this._loadCustomTokens(supported);
    
    return supported;
  }

  /**
   * Load custom tokens from environment variables
   * Format: CUSTOM_TOKEN_<SYMBOL>=<mint>,<decimals>,<name>
   */
  _loadCustomTokens(supported) {
    const envKeys = Object.keys(process.env);
    const customTokenPattern = /^CUSTOM_TOKEN_([A-Z]+)$/;
    
    for (const key of envKeys) {
      const match = key.match(customTokenPattern);
      if (match) {
        const symbol = match[1];
        const value = process.env[key];
        const parts = value.split(',');
        
        if (parts.length >= 2) {
          const [mint, decimals, name] = parts;
          supported[symbol] = {
            symbol,
            name: name || symbol,
            decimals: parseInt(decimals, 10),
            isNative: false,
            mint,
            isCustom: true,
          };
          logger.info(`   Loaded custom token: ${symbol} (${mint})`);
        }
      }
    }
  }

  /**
   * Get token configuration by symbol
   * @param {string} symbol - Token symbol (SOL, USDC, ZEC, etc.)
   * @returns {Object|null} Token configuration
   */
  getToken(symbol) {
    const upperSymbol = symbol?.toUpperCase();
    return this.supportedTokens[upperSymbol] || null;
  }

  /**
   * Get token configuration by mint address
   * @param {string} mintAddress - Token mint address
   * @returns {Object|null} Token configuration
   */
  getTokenByMint(mintAddress) {
    if (!mintAddress) return this.getToken('SOL');
    
    for (const [symbol, config] of Object.entries(this.supportedTokens)) {
      if (config.mint === mintAddress) {
        return config;
      }
    }
    
    // Return unknown token info
    return {
      symbol: 'UNKNOWN',
      name: 'Unknown Token',
      decimals: 9,
      isNative: false,
      mint: mintAddress,
    };
  }

  /**
   * Get mint address for token symbol
   * @param {string} symbol - Token symbol
   * @returns {string|null} Mint address or null for native SOL
   */
  getMint(symbol) {
    const token = this.getToken(symbol);
    return token?.mint || null;
  }

  /**
   * Get PublicKey for token mint
   * @param {string} symbol - Token symbol
   * @returns {PublicKey|null} Mint PublicKey or null for native SOL
   */
  getMintPublicKey(symbol) {
    const mint = this.getMint(symbol);
    return mint ? new PublicKey(mint) : null;
  }

  /**
   * Check if token is supported
   * @param {string} symbolOrMint - Token symbol or mint address
   * @returns {boolean}
   */
  isSupported(symbolOrMint) {
    if (!symbolOrMint) return false;
    
    // Check by symbol
    if (this.supportedTokens[symbolOrMint.toUpperCase()]) {
      return true;
    }
    
    // Check by mint address
    for (const config of Object.values(this.supportedTokens)) {
      if (config.mint === symbolOrMint) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get default output token configuration
   * @returns {Object} Token configuration
   */
  getDefaultToken() {
    return this.getToken(this.defaultOutputToken) || this.getToken('SOL');
  }

  /**
   * List all supported tokens
   * @returns {Array} Array of token configurations
   */
  listSupportedTokens() {
    return Object.values(this.supportedTokens).map(token => ({
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      mint: token.mint,
      isNative: token.isNative,
    }));
  }

  /**
   * Convert amount between token decimals
   * @param {number} amount - Amount in source decimals
   * @param {string} fromSymbol - Source token symbol
   * @param {string} toSymbol - Target token symbol
   * @returns {number} Amount in target decimals
   */
  convertDecimals(amount, fromSymbol, toSymbol) {
    const fromToken = this.getToken(fromSymbol);
    const toToken = this.getToken(toSymbol);
    
    if (!fromToken || !toToken) {
      throw new Error(`Unknown token: ${fromSymbol} or ${toSymbol}`);
    }
    
    const decimalDiff = toToken.decimals - fromToken.decimals;
    return amount * Math.pow(10, decimalDiff);
  }

  /**
   * Format amount for display
   * @param {number|bigint} amount - Amount in smallest unit
   * @param {string} symbol - Token symbol
   * @returns {string} Formatted amount with symbol
   */
  formatAmount(amount, symbol) {
    const token = this.getToken(symbol);
    if (!token) return `${amount} ${symbol}`;
    
    const divisor = Math.pow(10, token.decimals);
    const formatted = (Number(amount) / divisor).toFixed(token.decimals);
    return `${formatted} ${token.symbol}`;
  }

  /**
   * Parse display amount to smallest unit
   * @param {string|number} displayAmount - Human-readable amount
   * @param {string} symbol - Token symbol
   * @returns {bigint} Amount in smallest unit
   */
  parseAmount(displayAmount, symbol) {
    const token = this.getToken(symbol);
    if (!token) throw new Error(`Unknown token: ${symbol}`);
    
    const multiplier = Math.pow(10, token.decimals);
    return BigInt(Math.floor(Number(displayAmount) * multiplier));
  }

  /**
   * Get treasury balance info for a token
   * Requires solanaService to be initialized
   * @param {string} symbol - Token symbol
   * @returns {Promise<Object>} Balance info
   */
  async getTreasuryBalance(symbol) {
    const solanaService = require('./solana');
    const token = this.getToken(symbol);
    
    if (!token) {
      throw new Error(`Unknown token: ${symbol}`);
    }
    
    try {
      if (token.isNative) {
        // Native SOL balance
        const balance = await solanaService.getTreasurySOLBalance();
        return {
          symbol: 'SOL',
          balance: balance,
          formatted: this.formatAmount(balance, 'SOL'),
          sufficient: balance > 0,
        };
      } else if (symbol === 'ZEC') {
        // ZEC balance (special handling)
        const balance = await solanaService.getTreasuryZECBalance();
        return {
          symbol: 'ZEC',
          balance: balance,
          formatted: this.formatAmount(balance, 'ZEC'),
          sufficient: balance > 0,
        };
      } else {
        // Generic SPL token balance
        const balance = await solanaService.getTreasuryTokenBalance(token.mint);
        return {
          symbol: token.symbol,
          balance: balance,
          formatted: this.formatAmount(balance, symbol),
          sufficient: balance > 0,
        };
      }
    } catch (error) {
      logger.error(`Error getting treasury balance for ${symbol}:`, error.message);
      return {
        symbol,
        balance: BigInt(0),
        formatted: '0 ' + symbol,
        sufficient: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all treasury balances
   * @returns {Promise<Object>} All token balances
   */
  async getAllTreasuryBalances() {
    const balances = {};
    
    for (const symbol of Object.keys(this.supportedTokens)) {
      try {
        balances[symbol] = await this.getTreasuryBalance(symbol);
      } catch (error) {
        balances[symbol] = {
          symbol,
          balance: BigInt(0),
          formatted: '0 ' + symbol,
          sufficient: false,
          error: error.message,
        };
      }
    }
    
    return balances;
  }
}

// =============================================================================
// Export Singleton
// =============================================================================

const tokenTreasury = new TokenTreasury();

module.exports = tokenTreasury;
module.exports.TokenTreasury = TokenTreasury;
module.exports.TOKEN_REGISTRY = TOKEN_REGISTRY;

