import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

class APIClient {
  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
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

  // Health & System
  async getHealth() {
    const response = await this.client.get('/health');
    return response.data;
  }

  // Bridge Operations
  async getBridgeInfo() {
    const response = await this.client.get('/api/bridge/info');
    return response.data;
  }

  async getReserves() {
    const response = await this.client.get('/api/bridge/reserves');
    return response.data;
  }

  async bridgeTransaction(data) {
    const response = await this.client.post('/api/bridge', data);
    return response.data;
  }

  async getBridgeTransaction(txId) {
    const response = await this.client.get(`/api/bridge/transaction/${txId}`);
    return response.data;
  }

  async markRedemption(data) {
    const response = await this.client.post('/api/bridge/mark-redemption', data);
    return response.data;
  }

  // Arcium Operations
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

  // Zcash Operations
  async getZECPrice() {
    const response = await this.client.get('/api/zcash/price');
    return response.data;
  }

  async validateZcashAddress(address) {
    const response = await this.client.post('/api/zcash/validate-address', { address });
    return response.data;
  }
}

export default new APIClient();
