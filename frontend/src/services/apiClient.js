import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const CLIENT_ID = (process.env.REACT_APP_CLIENT_ID || '').trim();

/**
 * FLASH Bridge API Client
 * Handles all communication with the backend API
 */
class APIClient {
  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(CLIENT_ID ? { 'x-client-id': CLIENT_ID } : {}),
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 60;
          throw new Error(`Rate limited. Try again in ${retryAfter} seconds.`);
        }

        // Handle timeout errors
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          throw new Error('Request timed out. Please check your connection and try again.');
        }

        // Handle network errors
        if (!error.response) {
          throw new Error('Network error. Please check your internet connection.');
        }

        // Handle server errors
        if (error.response?.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }

        throw error;
      }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Health & System
  // ═══════════════════════════════════════════════════════════════════════════
  
  async getHealth() {
    const response = await this.client.get('/health');
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Bridge Operations
  // ═══════════════════════════════════════════════════════════════════════════
  
  async getBridgeInfo() {
    const response = await this.client.get('/api/bridge/info');
    return response.data;
  }

  async getBridgeHealth() {
    const response = await this.client.get('/api/bridge/health');
    return response.data;
  }

  async getReserves() {
    const response = await this.client.get('/api/bridge/reserves');
    return response.data;
  }

  /**
   * Submit a bridge transaction (BTC → SOL)
   * @param {Object} data - { solanaAddress, amount, bitcoinTxHash?, depositAllocationId? }
   */
  async bridgeTransaction(data) {
    const response = await this.client.post('/api/bridge', data);
    return response.data;
  }

  async getBridgeTransaction(txId) {
    const response = await this.client.get(`/api/bridge/transaction/${txId}`);
    return response.data;
  }

  async updateTransactionStatus(txId, status, notes) {
    const response = await this.client.patch(`/api/bridge/transaction/${txId}/status`, {
      status,
      notes,
    });
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BTC Deposit Management
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Allocate a unique BTC deposit address for a Solana wallet
   * @param {Object} data - { solanaAddress, sessionId?, clientLabel?, forceNew?, metadata? }
   */
  async allocateBTCAddress(data) {
    const response = await this.client.post('/api/bridge/btc-address', data);
    return response.data;
  }

  /**
   * Check all BTC deposits and their status
   */
  async checkBTCDeposits() {
    const response = await this.client.get('/api/bridge/check-btc-deposits');
    return response.data;
  }

  /**
   * Get status of a specific BTC deposit
   * @param {string} txHash - Bitcoin transaction hash
   */
  async getBTCDepositStatus(txHash) {
    const response = await this.client.get(`/api/bridge/btc-deposit/${txHash}`);
    return response.data;
  }

  /**
   * Claim a BTC deposit after monitoring detects it
   * @param {Object} data - { solanaAddress, bitcoinTxHash, outputTokenMint?, tier?, usePrivacy?, referralCode? }
   * @param {string} data.tier - Service tier: 'basic' | 'fast' | 'private' | 'premium'
   * @param {boolean} data.usePrivacy - Enable Arcium MPC encryption
   * @param {string} data.referralCode - Referral code for fee discount
   */
  async claimBTCDeposit(data) {
    const response = await this.client.post('/api/bridge/btc-deposit', {
      solanaAddress: data.solanaAddress,
      bitcoinTxHash: data.bitcoinTxHash,
      outputTokenMint: data.outputTokenMint || null,
      tier: data.tier || 'basic',
      usePrivacy: data.usePrivacy || false,
      referralCode: data.referralCode || null,
    });
    return response.data;
  }

  /**
   * Get fee quote for a bridge transaction
   * @param {number} amountUSD - Amount in USD
   * @param {string} tier - Service tier
   */
  async getFeeQuote(amountUSD, tier = 'basic') {
    const response = await this.client.get(`/api/v1/fees/quote?amount=${amountUSD}&tier=${tier}`);
    return response.data;
  }

  /**
   * Get all available service tiers with pricing
   * @param {number} amount - Amount for pricing example
   */
  async getFeeTiers(amount = 1000) {
    const response = await this.client.get(`/api/v1/fees/tiers?amount=${amount}`);
    return response.data;
  }

  /**
   * Get BTC monitor status
   */
  async getBTCMonitorStatus() {
    const response = await this.client.get('/api/bridge/btc-monitor/status');
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Proof & Compliance
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get cryptographic proof for a transaction
   * @param {string} txId - Transaction ID
   * @param {string} format - 'full' | 'audit' | 'verification'
   */
  async getTransactionProof(txId, format = 'full') {
    const response = await this.client.get(`/api/bridge/proof/${txId}`, {
      params: { format },
    });
    return response.data;
  }

  /**
   * Verify a cryptographic proof
   * @param {string} txId - Transaction ID
   * @param {Object} proof - Proof data to verify
   */
  async verifyTransactionProof(txId, proof) {
    const response = await this.client.post(`/api/bridge/proof/${txId}/verify`, { proof });
    return response.data;
  }

  async markRedemption(data) {
    const response = await this.client.post('/api/bridge/mark-redemption', data);
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Arcium MPC Operations
  // ═══════════════════════════════════════════════════════════════════════════
  
  async getArciumStatus() {
    const response = await this.client.get('/api/arcium/status');
    return response.data;
  }

  async encryptBTCAddress(data) {
    const response = await this.client.post('/api/arcium/encrypt-btc-address', data);
    return response.data;
  }

  async decryptBTCAddress(data) {
    const response = await this.client.post('/api/arcium/decrypt-btc-address', data);
    return response.data;
  }

  async encryptAmount(data) {
    const response = await this.client.post('/api/arcium/encrypt-amount', data);
    return response.data;
  }

  async privateBridge(data) {
    const response = await this.client.post('/api/arcium/bridge/private', data);
    return response.data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Zcash Operations (Legacy - Disabled)
  // ═══════════════════════════════════════════════════════════════════════════
  
  async getZECPrice() {
    const response = await this.client.get('/api/zcash/price');
    return response.data;
  }

  async validateZcashAddress(address) {
    const response = await this.client.post('/api/zcash/validate-address', { address });
    return response.data;
  }

  async getZcashInfo() {
    const response = await this.client.get('/api/zcash/info');
    return response.data;
  }
}

export default new APIClient();
