// Test setup and global configuration
require('dotenv').config({ path: '.env.test' });

// Mock environment variables for testing
process.env.ENABLE_ARCIUM_MPC = 'true';
process.env.ARCIUM_ENDPOINT = 'http://localhost:9090';
process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com';
process.env.BITCOIN_NETWORK = 'testnet';
process.env.ZCASH_NETWORK = 'testnet';

// Global test utilities
global.testUtils = {
  // Mock addresses for testing
  mockAddresses: {
    solana: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    bitcoin: 'bc1qtestaddress12345678901234567890',
    zcash: 'zs1testaddress12345678901234567890'
  },

  // Mock transaction hashes
  mockTxHashes: {
    solana: '5xKpN2BqN4hG7VJw8LjkL8MjQZBx8F4qGzWkJcQkN6N',
    bitcoin: '6H7J8K9MNpqrstuvWXyz23456789ABCDEFGHJKLMNP',
    zcash: '5ABCDEfghijkMNopqrstUVWXYZ23456789abcdefgh'
  },

  // Helper to create mock requests
  createMockRequest: (body = {}, params = {}, query = {}) => ({
    body,
    params,
    query,
    headers: { 'content-type': 'application/json' }
  }),

  // Helper to create mock responses
  createMockResponse: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
    return res;
  },

  // Helper to create mock next function
  createMockNext: () => jest.fn()
};

// Suppress console logs during tests (optional - comment out to see logs)
global.console = {
  ...console,
  // Keep error and warn for debugging
  // log: jest.fn(),
  // info: jest.fn(),
  // debug: jest.fn(),
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(10000);
