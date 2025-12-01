const axios = require('axios');

/**
 * Converter Service
 * Handles BTC → ZEC conversion for privacy layer
 * Can use exchange APIs or atomic swaps
 */
class ConverterService {
  constructor() {
    this.exchangeApiKey = process.env.EXCHANGE_API_KEY;
    this.exchangeApiSecret = process.env.EXCHANGE_API_SECRET;
    this.useExchange = process.env.USE_EXCHANGE === 'true';
    this.exchangeProvider = process.env.EXCHANGE_PROVIDER || 'coingecko'; // coingecko, kraken, coinbase
    this.conversionCache = new Map();
    this.cacheTTL = 60000; // 1 minute
    this.lastKnownRate = null;
    this.fallbackRate = parseFloat(process.env.FALLBACK_BTC_TO_ZEC_RATE || '1');
  }

  /**
   * Calculate ZEC equivalent for BTC amount using exchange rate
   * Simplified approach: Uses exchange rate only, no actual conversion execution
   * This avoids exchange fees, API costs, and liquidity requirements
   * 
   * @param {number} btcAmount - Amount in BTC
   * @returns {Promise<Object>} Calculation result with ZEC amount
   */
  async convertBTCtoZEC(btcAmount) {
    try {
      console.log(`Calculating ZEC equivalent for ${btcAmount} BTC...`);

      // Get current exchange rate (free API, no execution needed)
      const exchangeRate = await this.getBTCtoZECRate();
      const zecAmount = btcAmount * exchangeRate;

      console.log(`Exchange rate: 1 BTC = ${exchangeRate} ZEC`);
      console.log(`ZEC equivalent: ${btcAmount} BTC → ${zecAmount} ZEC`);

      // Return calculation result (no actual exchange execution)
      return {
        success: true,
        btcAmount,
        zecAmount,
        exchangeRate,
        timestamp: Date.now(),
        note: 'Rate-based calculation. Native ZEC will be transferred from treasury.',
      };
    } catch (error) {
      console.error('Error calculating ZEC equivalent:', error);
      throw new Error(`Failed to calculate ZEC equivalent: ${error.message}`);
    }
  }

  /**
   * Get current BTC to ZEC exchange rate
   * @returns {Promise<number>} Exchange rate (ZEC per BTC)
   */
  async getBTCtoZECRate() {
    // Check cache first
    const cacheKey = 'btc_zec_rate';
    const cached = this.conversionCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.rate;
    }

    try {
      let rate;

      switch (this.exchangeProvider) {
        case 'coingecko':
          rate = await this.getRateFromCoinGecko();
          break;
        case 'kraken':
          rate = await this.getRateFromKraken();
          break;
        case 'coinbase':
          rate = await this.getRateFromCoinbase();
          break;
        default:
          rate = await this.getRateFromCoinGecko();
      }

      // Cache the rate
      this.conversionCache.set(cacheKey, {
        rate,
        timestamp: Date.now(),
      });
      this.lastKnownRate = rate;

      return rate;
    } catch (error) {
      console.error('Error fetching exchange rate:', error);

      if (this.lastKnownRate) {
        console.warn('Using last known exchange rate due to API failure');
        return this.lastKnownRate;
      }

      console.warn('Using configured fallback exchange rate due to API failure');
      return this.fallbackRate;
    }
  }

  /**
   * Get rate from CoinGecko API
   */
  async getRateFromCoinGecko() {
    try {
      const btcResponse = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
        { timeout: 5000 }
      );
      
      const zecResponse = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd',
        { timeout: 5000 }
      );

      const btcPrice = btcResponse.data.bitcoin.usd;
      const zecPrice = zecResponse.data.zcash.usd;

      // Calculate ZEC per BTC
      const rate = btcPrice / zecPrice;
      return rate;
    } catch (error) {
      console.error('CoinGecko API error:', error.message);
      throw error;
    }
  }

  /**
   * Get rate from Kraken API
   */
  async getRateFromKraken() {
    try {
      const response = await axios.get(
        'https://api.kraken.com/0/public/Ticker?pair=BTCZEC',
        { timeout: 5000 }
      );

      const pair = response.data.result.XBTZEC || response.data.result.BTCZEC;
      if (!pair) {
        throw new Error('Kraken API: Pair not found');
      }

      return parseFloat(pair.c[0]); // Last trade price
    } catch (error) {
      console.error('Kraken API error:', error.message);
      throw error;
    }
  }

  /**
   * Get rate from Coinbase API
   */
  async getRateFromCoinbase() {
    try {
      const btcResponse = await axios.get(
        'https://api.coinbase.com/v2/exchange-rates?currency=BTC',
        { timeout: 5000 }
      );
      
      const zecResponse = await axios.get(
        'https://api.coinbase.com/v2/exchange-rates?currency=ZEC',
        { timeout: 5000 }
      );

      const btcUsd = parseFloat(btcResponse.data.data.rates.USD);
      const zecUsd = parseFloat(zecResponse.data.data.rates.USD);

      return btcUsd / zecUsd;
    } catch (error) {
      console.error('Coinbase API error:', error.message);
      throw error;
    }
  }

  /**
   * Execute actual exchange order (DEPRECATED - Not recommended)
   * 
   * NOTE: This method is kept for backward compatibility but is not recommended.
   * The simplified approach uses exchange rates only, avoiding:
   * - Exchange API fees
   * - KYC requirements
   * - Liquidity management
   * - Complex execution logic
   * 
   * If you need actual exchange execution, consider:
   * - Partnering with existing DEX aggregators (ThorSwap, etc.)
   * - Using atomic swaps (complex, requires liquidity)
   * - Integrating with exchange APIs (requires funding)
   * 
   * @param {number} btcAmount - Amount in BTC
   * @returns {Promise<Object>} Exchange result with ZEC transaction hash
   */
  async executeExchange(btcAmount) {
    console.warn('⚠️  Exchange execution is deprecated. Use rate-based calculation instead.');
    throw new Error(
      'Exchange execution not implemented. ' +
      'Use rate-based calculation (convertBTCtoZEC) which calculates ZEC equivalent ' +
      'and transfers native ZEC from treasury instead.'
    );
  }

  /**
   * Get conversion status
   * @param {string} conversionId - Conversion ID
   * @returns {Object} Conversion status
   */
  getConversionStatus(conversionId) {
    // In production, track conversion status
    return {
      conversionId,
      status: 'pending',
      note: 'Conversion tracking not implemented in MVP',
    };
  }

  /**
   * Get service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      enabled: true,
      exchangeProvider: this.exchangeProvider,
      useExchange: this.useExchange,
      cachedRates: this.conversionCache.size,
    };
  }
}

module.exports = new ConverterService();

