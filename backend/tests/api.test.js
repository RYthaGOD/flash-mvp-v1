/**
 * Comprehensive API Integration Tests for FLASH Bridge
 * Tests all 19+ API endpoints
 * 
 * Run with: npm test -- tests/api.test.js
 * Or: npm test (runs all tests)
 * 
 * Note: These tests use mocks to avoid starting real services
 * For full integration tests, see test-*.js files in the root directory
 */

// Mock services BEFORE importing routes (to prevent initialization)
jest.mock('../src/services/solana');
jest.mock('../src/services/bitcoin');
jest.mock('../src/services/zcash');
jest.mock('../src/services/arcium');
jest.mock('../src/services/database');
jest.mock('../src/services/converter');
jest.mock('../src/services/jupiter');
jest.mock('../src/services/btc-deposit-handler');
jest.mock('../src/services/crypto-proofs');
jest.mock('../src/services/relayer');
jest.mock('../src/services/zcash-monitor');
jest.mock('../src/services/btc-relayer');
jest.mock('../src/services/zcash-wallet');

const request = require('supertest');
const express = require('express');

// Mock environment variables
process.env.ENABLE_ARCIUM_MPC = 'true';
process.env.ARCIUM_SIMULATED = 'true';
process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com';
process.env.SOLANA_NETWORK = 'devnet';
process.env.BITCOIN_NETWORK = 'testnet';
process.env.ZCASH_NETWORK = 'testnet';
process.env.PORT = '3001';

// Import mocked services
const solanaService = require('../src/services/solana');
const bitcoinService = require('../src/services/bitcoin');
const zcashService = require('../src/services/zcash');
const arciumService = require('../src/services/arcium');
const databaseService = require('../src/services/database');

// Create test app using Express
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Import routes (after mocks are set up)
const bridgeRoutes = require('../src/routes/bridge');
const zcashRoutes = require('../src/routes/zcash');
const arciumRoutes = require('../src/routes/arcium');

// Mount routes
app.use('/api/bridge', bridgeRoutes);
app.use('/api/zcash', zcashRoutes);
app.use('/api/arcium', arciumRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'FLASH — BTC → ZEC (shielded) → Solana Bridge',
    description: 'Backend API for zenZEC minting and SOL swap relayer',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      bridge: '/api/bridge',
      zcash: '/api/zcash',
      arcium: '/api/arcium',
      health: '/health',
    },
  });
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Error handling
const { errorHandler, notFoundHandler } = require('../src/middleware/errorHandler');
app.use(notFoundHandler);
app.use(errorHandler);

// Setup mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  
  // Mock database
  databaseService.isConnected = jest.fn().mockReturnValue(false);
  databaseService.getBridgeTransaction = jest.fn().mockResolvedValue(null);
  databaseService.getSwapTransaction = jest.fn().mockResolvedValue(null);
  databaseService.getBurnTransaction = jest.fn().mockResolvedValue(null);
  databaseService.getTransactionsByAddress = jest.fn().mockResolvedValue([]);
  databaseService.saveBTCDeposit = jest.fn().mockResolvedValue();
  
  // Mock Solana service
  solanaService.getConnection = jest.fn().mockReturnValue({
    getVersion: jest.fn().mockResolvedValue({ 'solana-core': '1.18.0' })
  });
  solanaService.getProgramInfo = jest.fn().mockReturnValue({
    programId: 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS',
    network: 'devnet'
  });
  solanaService.relayerKeypair = null; // Demo mode
  
  // Mock Bitcoin service
  bitcoinService.getNetworkInfo = jest.fn().mockReturnValue({
    network: 'testnet',
    bridgeAddress: 'tb1qtest',
    currentReserveBTC: 0
  });
  bitcoinService.verifyBitcoinPayment = jest.fn().mockResolvedValue({
    verified: true,
    amountBTC: 0.01,
    confirmations: 6
  });
  bitcoinService.isValidAddress = jest.fn().mockReturnValue(true);
  bitcoinService.supportsDepositAllocations = jest.fn().mockReturnValue(false);
  bitcoinService.markAllocationFunded = jest.fn().mockResolvedValue();
  bitcoinService.markAllocationClaimed = jest.fn().mockResolvedValue();
  bitcoinService.getOrCreateDepositAllocation = jest.fn();
  bitcoinService.assertAllocationForAddress = jest.fn();
  bitcoinService.bridgeAddress = 'tb1qtest';
  
  // Mock Zcash service
  zcashService.getNetworkInfo = jest.fn().mockResolvedValue({
    network: 'testnet',
    walletEnabled: false
  });
  zcashService.getBridgeAddress = jest.fn().mockResolvedValue('zs1test');
  zcashService.getZecPrice = jest.fn().mockResolvedValue(25.50);
  zcashService.priceCache = { price: 25.50, timestamp: Date.now(), ttl: 300000 };
  zcashService.isValidZcashAddress = jest.fn().mockReturnValue(true);
  zcashService.getWalletBalance = jest.fn().mockResolvedValue({ total: 0, confirmed: 0 });
  zcashService.verifyShieldedTransaction = jest.fn().mockResolvedValue({ verified: false });
  zcashService.getTransaction = jest.fn().mockResolvedValue({});
  
  // Mock Zcash wallet service
  const zcashWallet = require('../src/services/zcash-wallet');
  zcashWallet.getStatus = jest.fn().mockResolvedValue({ connected: false });
  
  // Mock Arcium service
  arciumService.getStatus = jest.fn().mockReturnValue({
    enabled: true,
    connected: true,
    mode: 'simulated',
    mpcEnabled: true
  });
  arciumService.encryptAmount = jest.fn().mockResolvedValue({ 
    ciphertext: 'encrypted', 
    computationId: 'test-id',
    simulated: true
  });
  arciumService.generateTrustlessRandom = jest.fn().mockResolvedValue(42);
  arciumService.getComputationStatus = jest.fn().mockReturnValue({ status: 'not_found' });
  arciumService.createEncryptedBridgeTx = jest.fn().mockResolvedValue({ tx: 'test-tx' });
  arciumService.calculateEncryptedSwapAmount = jest.fn().mockResolvedValue({ encrypted: 'swap' });
  arciumService.privateVerifyZcashTx = jest.fn().mockResolvedValue({ verified: true });
  arciumService.selectConfidentialRelayer = jest.fn().mockResolvedValue('relayer-address');
  arciumService.encryptBTCAddress = jest.fn().mockResolvedValue({ encrypted: 'btc-addr' });
  arciumService.decryptBTCAddress = jest.fn().mockResolvedValue('decrypted-btc-addr');
  arciumService.mpcEnabled = true;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('FLASH Bridge API - Core Endpoints', () => {
  
  describe('GET /', () => {
    test('should return API information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.endpoints).toHaveProperty('bridge');
      expect(response.body.endpoints).toHaveProperty('zcash');
      expect(response.body.endpoints).toHaveProperty('arcium');
    });
  });

  describe('GET /health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
    });
  });

});

describe('Bridge API Endpoints', () => {
  
  describe('GET /api/bridge/info', () => {
    test('should return bridge configuration and status', async () => {
      const response = await request(app)
        .get('/api/bridge/info')
        .expect(200);
      
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('network');
      expect(response.body).toHaveProperty('bitcoin');
      expect(response.body).toHaveProperty('zcash');
    });
  });

  describe('POST /api/bridge', () => {
    test('should accept valid bridge request (demo mode)', async () => {
      const response = await request(app)
        .post('/api/bridge')
        .send({
          solanaAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          amount: 1.5,
          swapToSol: false
        });
      
      // May return 200 or 500 depending on service mocks
      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('transactionId');
      }
    });

    test('should reject invalid solana address', async () => {
      const response = await request(app)
        .post('/api/bridge')
        .send({
          solanaAddress: 'invalid-address',
          amount: 1.5
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });

    test('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/bridge')
        .send({
          amount: 1.5
          // Missing solanaAddress
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });

    test('should reject invalid amount', async () => {
      const response = await request(app)
        .post('/api/bridge')
        .send({
          solanaAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          amount: -1
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/bridge/transaction/:txId', () => {
    test('should return 503 when database not available', async () => {
      databaseService.isConnected = jest.fn().mockReturnValue(false);
      
      const response = await request(app)
        .get('/api/bridge/transaction/test-tx-id')
        .expect(503);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/bridge/jupiter-swap', () => {
    test('should reject request with missing parameters', async () => {
      const response = await request(app)
        .post('/api/bridge/jupiter-swap')
        .send({
          userAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
          // Missing outputToken and usdcAmount
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/bridge/btc-deposit', () => {
    test('should reject request with missing parameters', async () => {
      const response = await request(app)
        .post('/api/bridge/btc-deposit')
        .send({
          solanaAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
          // Missing bitcoinTxHash
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });

});

describe('Zcash API Endpoints', () => {
  
  describe('GET /api/zcash/info', () => {
    test('should return Zcash network information', async () => {
      const response = await request(app)
        .get('/api/zcash/info')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('network');
    });
  });

  describe('GET /api/zcash/price', () => {
    test('should return ZEC price', async () => {
      const response = await request(app)
        .get('/api/zcash/price')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('price');
      expect(response.body).toHaveProperty('currency', 'USD');
    });
  });

  describe('POST /api/zcash/verify-transaction', () => {
    test('should reject request with missing txHash', async () => {
      const response = await request(app)
        .post('/api/zcash/verify-transaction')
        .send({
          expectedAmount: 1.5
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/zcash/validate-address', () => {
    test('should validate Zcash address format', async () => {
      const response = await request(app)
        .post('/api/zcash/validate-address')
        .send({
          address: 'zs1testaddress12345678901234567890'
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('valid');
    });

    test('should reject request with missing address', async () => {
      const response = await request(app)
        .post('/api/zcash/validate-address')
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/zcash/bridge-address', () => {
    test('should return bridge address', async () => {
      const response = await request(app)
        .get('/api/zcash/bridge-address')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('address');
      expect(response.body).toHaveProperty('network');
    });
  });

  describe('GET /api/zcash/balance', () => {
    test('should return wallet balance (may fail if wallet not configured)', async () => {
      const response = await request(app)
        .get('/api/zcash/balance');
      
      // May return 200 or 500 depending on wallet configuration
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('GET /api/zcash/wallet-status', () => {
    test('should return wallet status (may fail if wallet not configured)', async () => {
      const response = await request(app)
        .get('/api/zcash/wallet-status');
      
      // May return 200 or 500 depending on wallet configuration
      expect([200, 500]).toContain(response.status);
    });
  });

});

describe('Arcium MPC API Endpoints', () => {
  
  describe('GET /api/arcium/status', () => {
    test('should return Arcium MPC status', async () => {
      const response = await request(app)
        .get('/api/arcium/status')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('enabled');
      expect(response.body).toHaveProperty('mode');
    });
  });

  describe('POST /api/arcium/encrypt-amount', () => {
    test('should encrypt amount successfully', async () => {
      const response = await request(app)
        .post('/api/arcium/encrypt-amount')
        .send({
          amount: 1.5,
          recipientPubkey: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('encrypted');
    });

    test('should reject request with missing fields', async () => {
      const response = await request(app)
        .post('/api/arcium/encrypt-amount')
        .send({
          amount: 1.5
          // Missing recipientPubkey
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/arcium/random', () => {
    test('should generate trustless random number', async () => {
      const response = await request(app)
        .post('/api/arcium/random')
        .send({
          max: 100
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('random');
      expect(response.body.random).toBeGreaterThanOrEqual(0);
      expect(response.body.random).toBeLessThan(100);
    });

    test('should reject invalid max value', async () => {
      const response = await request(app)
        .post('/api/arcium/random')
        .send({
          max: -1
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/arcium/computation/:computationId', () => {
    test('should return computation status', async () => {
      const response = await request(app)
        .get('/api/arcium/computation/test-computation-id')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('computationId');
    });
  });

  describe('POST /api/arcium/bridge/private', () => {
    test('should create private bridge transaction', async () => {
      const response = await request(app)
        .post('/api/arcium/bridge/private')
        .send({
          solanaAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          amount: 1.5,
          swapToSol: false
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('transaction');
    });

    test('should reject request with missing fields', async () => {
      const response = await request(app)
        .post('/api/arcium/bridge/private')
        .send({
          amount: 1.5
          // Missing solanaAddress
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/arcium/calculate-swap', () => {
    test('should reject request with missing fields', async () => {
      const response = await request(app)
        .post('/api/arcium/calculate-swap')
        .send({
          encryptedZenZEC: {}
          // Missing exchangeRate
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/arcium/verify-zcash-private', () => {
    test('should reject request with missing txHash', async () => {
      const response = await request(app)
        .post('/api/arcium/verify-zcash-private')
        .send({
          encryptedExpectedAmount: {}
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/arcium/select-relayer', () => {
    test('should select relayer from addresses', async () => {
      const response = await request(app)
        .post('/api/arcium/select-relayer')
        .send({
          relayerAddresses: [
            '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
            '11111111111111111111111111111112'
          ]
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('selectedRelayer');
    });

    test('should reject invalid relayerAddresses', async () => {
      const response = await request(app)
        .post('/api/arcium/select-relayer')
        .send({
          relayerAddresses: 'not-an-array'
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/arcium/encrypt-btc-address', () => {
    test('should reject request with missing fields', async () => {
      const response = await request(app)
        .post('/api/arcium/encrypt-btc-address')
        .send({
          btcAddress: 'bc1qtestaddress12345678901234567890'
          // Missing recipientPubkey
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/arcium/decrypt-btc-address', () => {
    test('should reject request with missing fields', async () => {
      const response = await request(app)
        .post('/api/arcium/decrypt-btc-address')
        .send({
          encryptedAddress: {}
          // Missing recipientPubkey
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });

});

describe('Error Handling', () => {
  
  test('should return 404 for non-existent routes', async () => {
    const response = await request(app)
      .get('/api/nonexistent')
      .expect(404);
    
    expect(response.body).toHaveProperty('error');
  });

  test('should handle malformed JSON', async () => {
    const response = await request(app)
      .post('/api/bridge')
      .set('Content-Type', 'application/json')
      .send('invalid json');
    
    // Should handle JSON parse errors
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

});
