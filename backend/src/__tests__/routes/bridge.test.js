const request = require('supertest');
const express = require('express');
const bridgeRoutes = require('../../routes/bridge');

// Mock services
jest.mock('../../services/solana');
jest.mock('../../services/bitcoin');
jest.mock('../../services/zcash');
jest.mock('../../services/arcium');
jest.mock('../../services/database', () => ({
  isConnected: jest.fn(),
  saveBridgeTransaction: jest.fn(),
  saveBTCDeposit: jest.fn(),
  saveBurnTransaction: jest.fn(),
  saveSwapTransaction: jest.fn(),
  addTransferMetadata: jest.fn(),
  saveCryptographicProof: jest.fn(),
  getBridgeTransaction: jest.fn(),
  getTransactionStatusHistory: jest.fn(),
  getCryptographicProof: jest.fn(),
  logProofVerification: jest.fn(),
  getTransactionsByAddress: jest.fn(),
  getTransactionCountByAddress: jest.fn(),
  getTransferMetadata: jest.fn(),
  updateTransactionStatus: jest.fn(),
  getNextBTCDepositAddressIndex: jest.fn(),
  createBTCDepositAllocation: jest.fn(),
  findActiveBTCDepositAllocation: jest.fn(),
  getBTCDepositAllocationById: jest.fn(),
  markBTCDepositAllocationFunded: jest.fn(),
  markBTCDepositAllocationClaimed: jest.fn()
}));
jest.mock('../../services/converter');
jest.mock('../../services/reserveManager', () => ({
  getReserveSummary: jest.fn().mockResolvedValue({ sol: { reserveLamports: '0' } })
}));
jest.mock('../../middleware/rateLimit', () => {
  const passThrough = () => (req, res, next) => next();
  return {
    generalLimiter: passThrough(),
    bridgeLimiter: passThrough(),
    reserveLimiter: passThrough(),
    adminLimiter: passThrough(),
    healthLimiter: passThrough(),
    walletBridgeLimiter: passThrough(),
    createCombinedLimiter: () => (req, res, next) => next(),
    createWalletLimiter: () => (req, res, next) => next(),
  };
});

const solanaService = require('../../services/solana');
const bitcoinService = require('../../services/bitcoin');
const zcashService = require('../../services/zcash');
const databaseService = require('../../services/database');
const converterService = require('../../services/converter');
const { errorHandler, notFoundHandler } = require('../../middleware/errorHandler');

describe('Bridge Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/bridge', bridgeRoutes);
    app.use(notFoundHandler);
    app.use(errorHandler);

    // Mock database connection
    databaseService.isConnected = jest.fn().mockReturnValue(true);
    databaseService.saveBridgeTransaction = jest.fn().mockResolvedValue();
    databaseService.saveBTCDeposit = jest.fn().mockResolvedValue();
    databaseService.saveBurnTransaction = jest.fn().mockResolvedValue();
    databaseService.saveSwapTransaction = jest.fn().mockResolvedValue();
    databaseService.addTransferMetadata = jest.fn().mockResolvedValue();
    databaseService.saveCryptographicProof = jest.fn().mockResolvedValue();
    databaseService.getBridgeTransaction = jest.fn().mockResolvedValue(null);
    databaseService.getTransactionStatusHistory = jest.fn().mockResolvedValue([]);
    databaseService.getCryptographicProof = jest.fn().mockResolvedValue(null);
    databaseService.logProofVerification = jest.fn().mockResolvedValue();
    databaseService.getTransactionsByAddress = jest.fn().mockResolvedValue([
      {
        tx_id: 'demo_tx',
        amount: 0.1,
        reserve_asset: 'SOL',
        status: 'confirmed',
        created_at: new Date().toISOString(),
      },
    ]);
    databaseService.getTransactionCountByAddress = jest.fn().mockResolvedValue(1);
    databaseService.getTransferMetadata = jest.fn().mockResolvedValue(null);

    const mockPublicKey = {
      toBase58: () => 'mockPubkey',
      equals: () => true,
    };

    solanaService.getConnection = jest.fn().mockReturnValue({
      getVersion: jest.fn().mockResolvedValue({ 'solana-core': '1.0.0' }),
      getBlockHeight: jest.fn().mockResolvedValue(123456),
    });
    solanaService.connection = {
      getBalance: jest.fn().mockResolvedValue(10_000_000_000),
    };
    solanaService.relayerKeypair = { publicKey: mockPublicKey };
    solanaService.transferNativeSOL = jest.fn().mockResolvedValue('sol-transfer-signature');
    solanaService.getTreasuryZECBalance = jest.fn().mockResolvedValue(1_000_000_000);
    converterService.getBTCtoZECRate = jest.fn().mockResolvedValue(100);
    bitcoinService.supportsDepositAllocations = jest.fn().mockReturnValue(false);
    bitcoinService.markAllocationFunded = jest.fn().mockResolvedValue();
    bitcoinService.markAllocationClaimed = jest.fn().mockResolvedValue();
    bitcoinService.getOrCreateDepositAllocation = jest.fn();
    bitcoinService.assertAllocationForAddress = jest.fn();
    bitcoinService.bridgeAddress = 'tb1qmockbridge';
  });

  describe('GET /api/bridge/info', () => {
    test('should return bridge information', async () => {
      solanaService.getProgramInfo = jest.fn().mockReturnValue({
        programId: 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS',
        network: 'devnet',
        mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      });

      bitcoinService.getNetworkInfo = jest.fn().mockReturnValue({
        network: 'mainnet',
        bridgeAddress: 'bc1qtestaddress',
        currentReserveBTC: 1.5
      });

      zcashService.getNetworkInfo = jest.fn().mockReturnValue({
        network: 'mainnet',
        bridgeAddress: 'zs1testaddress',
        walletEnabled: false
      });

      const response = await request(app)
        .get('/api/bridge/info')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'active');
      expect(response.body).toHaveProperty('solanaVersion');
      expect(response.body).toHaveProperty('bitcoin');
      expect(response.body).toHaveProperty('zcash');
    });
  });

  describe('GET /api/bridge/check-btc-deposits', () => {
    const mockDetails = {
      bridgeAddress: 'tb1qbridgeaddr',
      network: 'testnet',
      explorerUrl: 'https://blockstream.info/testnet/api',
      requiredConfirmations: 1,
      summary: {
        total: 1,
        confirmed: 1,
        pending: 0,
        alreadyProcessed: 0,
        zeroAmount: 0,
        readyToProcess: 1,
      },
      deposits: [
        {
          txHash: 'abc123',
          confirmations: 1,
          requiredConfirmations: 1,
          amountBTC: 0.001,
          status: 'confirmed',
          readyToProcess: true,
        }
      ],
      currentReserveBTC: 0.001,
      reconciliation: { reconciled: true },
      timestamp: '2024-01-01T00:00:00.000Z',
    };

    test('should return deposit details', async () => {
      bitcoinService.getDepositDetails = jest.fn().mockResolvedValue(mockDetails);

      const response = await request(app)
        .get('/api/bridge/check-btc-deposits')
        .expect(200);

      expect(bitcoinService.getDepositDetails).toHaveBeenCalled();
      expect(response.body).toMatchObject({
        success: true,
        summary: mockDetails.summary,
        deposits: mockDetails.deposits,
        bridgeAddress: mockDetails.bridgeAddress,
      });
    });

    test('should return 503 when service fails', async () => {
      bitcoinService.getDepositDetails = jest.fn().mockResolvedValue({
        error: 'Database not available',
      });

      const response = await request(app)
        .get('/api/bridge/check-btc-deposits')
        .expect(503);

      expect(response.body).toHaveProperty('error', 'Database not available');
    });
  });

  describe('POST /api/bridge/btc-address', () => {
    test('returns 503 when per-user deposits disabled', async () => {
      bitcoinService.supportsDepositAllocations.mockReturnValue(false);

      const response = await request(app)
        .post('/api/bridge/btc-address')
        .send({ solanaAddress: global.testUtils.mockAddresses.solana })
        .expect(503);

      expect(response.body).toHaveProperty('error');
      expect(bitcoinService.getOrCreateDepositAllocation).not.toHaveBeenCalled();
    });

    test('allocates address when feature enabled', async () => {
      bitcoinService.supportsDepositAllocations.mockReturnValue(true);
      const allocation = {
        allocationId: '11111111-2222-3333-4444-555555555555',
        bitcoinAddress: 'tb1qnewaddressxyz',
        solanaAddress: global.testUtils.mockAddresses.solana,
        status: 'allocated',
      };
      bitcoinService.getOrCreateDepositAllocation.mockResolvedValue(allocation);

      const response = await request(app)
        .post('/api/bridge/btc-address')
        .send({ solanaAddress: global.testUtils.mockAddresses.solana })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        depositAddress: allocation.bitcoinAddress,
      });
      expect(response.body.allocation).toMatchObject({
        allocationId: allocation.allocationId,
        bitcoinAddress: allocation.bitcoinAddress,
      });
      expect(bitcoinService.getOrCreateDepositAllocation).toHaveBeenCalled();
    });
  });

  describe('POST /api/bridge', () => {
    const validBridgeRequest = {
      solanaAddress: global.testUtils.mockAddresses.solana,
      amount: 0.1,
      bitcoinTxHash: global.testUtils.mockTxHashes.bitcoin
    };

    beforeEach(() => {
      // Mock successful verification
      bitcoinService.verifyBitcoinPayment = jest.fn().mockResolvedValue({
        verified: true,
        amount: 10000000, // 0.1 BTC in satoshis
        amountBTC: 0.1,
        confirmations: 10,
        txHash: global.testUtils.mockTxHashes.bitcoin
      });

      // Mock successful database save
      databaseService.saveBridgeTransaction = jest.fn().mockResolvedValue();
    });

    afterEach(() => {
      delete process.env.CLIENT_API_KEY;
    });

    test('should successfully process BTC to SOL bridge', async () => {
      const response = await request(app)
        .post('/api/bridge')
        .send(validBridgeRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('solanaTxSignature', 'sol-transfer-signature');
      expect(response.body).toHaveProperty('reserveAsset', 'SOL');
      expect(response.body).toHaveProperty('amount');
    });

    test('should process demo mode without transaction hash', async () => {
      const demoRequest = {
        solanaAddress: global.testUtils.mockAddresses.solana,
        amount: 0.1
      };

      const response = await request(app)
        .post('/api/bridge')
        .send(demoRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('demoMode', true);
    });

    test('should reject invalid requests', async () => {
      const invalidRequest = {
        // Missing required fields
        amount: 0.1
      };

      const response = await request(app)
        .post('/api/bridge')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body.message).toContain('solanaAddress');
    });

    test('should reject both BTC and ZEC transaction hashes', async () => {
      const invalidRequest = {
        solanaAddress: global.testUtils.mockAddresses.solana,
        amount: 0.1,
        bitcoinTxHash: global.testUtils.mockTxHashes.bitcoin,
        zcashTxHash: global.testUtils.mockTxHashes.zcash
      };

      const response = await request(app)
        .post('/api/bridge')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body.message).toContain('both');
    });

    test('should handle Bitcoin verification failure', async () => {
      bitcoinService.verifyBitcoinPayment = jest.fn().mockResolvedValue({
        verified: false,
        reason: 'insufficient confirmations'
      });

      const response = await request(app)
        .post('/api/bridge')
        .send(validBridgeRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('verification failed');
    });

    test('should handle Zcash verification failure', async () => {
      const zecRequest = {
        solanaAddress: global.testUtils.mockAddresses.solana,
        amount: 0.1,
        zcashTxHash: global.testUtils.mockTxHashes.zcash
      };

      const response = await request(app)
        .post('/api/bridge')
        .send(zecRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Zcash bridge flow is currently disabled');
    });

    test('should execute demo workflow end-to-end with status + proof verification', async () => {
      const bridgeResponse = await request(app)
        .post('/api/bridge')
        .send({
          solanaAddress: global.testUtils.mockAddresses.solana,
          amount: 0.2,
        })
        .expect(200);

      expect(bridgeResponse.body).toMatchObject({
        success: true,
        reserveAsset: 'SOL',
        demoMode: true,
      });

      const { transactionId, solanaTxSignature } = bridgeResponse.body;
      expect(transactionId).toBeDefined();
      expect(solanaTxSignature).toBeDefined();

      const transactionResponse = await request(app)
        .get(`/api/bridge/transaction/${transactionId}`)
        .expect(200);

      expect(transactionResponse.body.transaction).toMatchObject({
        transaction_id: transactionId,
        reserve_asset: 'SOL',
        solana_tx_signature: solanaTxSignature,
      });

      await request(app)
        .patch(`/api/bridge/transaction/${transactionId}/status`)
        .send({ status: 'processing', notes: 'status-sync-check' })
        .expect(200);

      const updatedTransactionResponse = await request(app)
        .get(`/api/bridge/transaction/${transactionId}`)
        .expect(200);

      expect(updatedTransactionResponse.body.transaction.status).toBe('processing');
      expect(Array.isArray(updatedTransactionResponse.body.history)).toBe(true);
      expect(updatedTransactionResponse.body.history.length).toBeGreaterThan(0);

      const proofResponse = await request(app)
        .get(`/api/bridge/proof/${transactionId}/verify`)
        .expect(200);

      expect(proofResponse.body.transactionId).toBe(transactionId);
      expect(proofResponse.body.verified).toBe(true);
      expect(Array.isArray(proofResponse.body.auditTrail)).toBe(true);
      expect(proofResponse.body.auditTrail.length).toBeGreaterThan(0);
    });

    test('should save transaction to database', async () => {
      await request(app)
        .post('/api/bridge')
        .send(validBridgeRequest)
        .expect(200);

      expect(databaseService.saveBridgeTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          solanaAddress: global.testUtils.mockAddresses.solana,
          reserveAsset: 'SOL',
          status: 'confirmed'
        })
      );
    });

    test('should handle database errors gracefully', async () => {
      databaseService.saveBridgeTransaction = jest.fn().mockRejectedValue(new Error('DB Error'));

      const response = await request(app)
        .post('/api/bridge')
        .send(validBridgeRequest)
        .expect(200); // Should still succeed

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('solanaTxSignature');
    });

    test('should require client signature when CLIENT_API_KEY is set', async () => {
      process.env.CLIENT_API_KEY = 'test-client-key';

      const response = await request(app)
        .post('/api/bridge')
        .send(validBridgeRequest)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid client signature');
    });

    test('should allow request when valid client signature provided', async () => {
      process.env.CLIENT_API_KEY = 'test-client-key';

      const response = await request(app)
        .post('/api/bridge')
        .set('x-client-id', 'test-client-key')
        .send(validBridgeRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  // Removed swap and burn route tests – endpoints no longer exist

  describe('error handling', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/bridge')
        .set('Content-Type', 'application/json')
        .send('{invalid json}')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle unsupported HTTP methods', async () => {
      await request(app)
        .patch('/api/bridge')
        .expect(404);
    });

    test('should handle non-existent routes', async () => {
      await request(app)
        .get('/api/bridge/non-existent')
        .expect(404);
    });
  });

  describe('middleware validation', () => {
    test('should validate bridge request format', async () => {
      // Test that validation middleware is called
      const invalidRequest = {
        solanaAddress: 'invalid-address',
        amount: -1,
        bitcoinTxHash: 'invalid-hash'
      };

      const response = await request(app)
        .post('/api/bridge')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
