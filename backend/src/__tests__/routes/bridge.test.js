const request = require('supertest');
const express = require('express');
const bridgeRoutes = require('../../routes/bridge');

// Mock services
jest.mock('../../services/solana');
jest.mock('../../services/bitcoin');
jest.mock('../../services/zcash');
jest.mock('../../services/arcium');
jest.mock('../../services/database');
jest.mock('../../services/converter');

const solanaService = require('../../services/solana');
const bitcoinService = require('../../services/bitcoin');
const zcashService = require('../../services/zcash');
const arciumService = require('../../services/arcium');
const databaseService = require('../../services/database');
const converterService = require('../../services/converter');

describe('Bridge Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/bridge', bridgeRoutes);

    // Mock database connection
    databaseService.isConnected = jest.fn().mockReturnValue(true);
    databaseService.saveBridgeTransaction = jest.fn().mockResolvedValue();
    databaseService.saveBurnTransaction = jest.fn().mockResolvedValue();
    databaseService.saveSwapTransaction = jest.fn().mockResolvedValue();
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
      expect(response.body).toHaveProperty('solana');
      expect(response.body).toHaveProperty('bitcoin');
      expect(response.body).toHaveProperty('zcash');
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
        confirmations: 10,
        txHash: global.testUtils.mockTxHashes.bitcoin
      });

      // Mock successful minting
      solanaService.mintZenZEC = jest.fn().mockResolvedValue({
        signature: 'mint-signature',
        amount: 0.1
      });

      // Mock successful database save
      databaseService.saveBridgeTransaction = jest.fn().mockResolvedValue();
    });

    test('should successfully process BTC to zenZEC bridge', async () => {
      const response = await request(app)
        .post('/api/bridge')
        .send(validBridgeRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('transaction');
      expect(response.body.transaction).toHaveProperty('signature', 'mint-signature');
      expect(response.body.transaction).toHaveProperty('amount', 0.1);
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

    test('should process ZEC to zenZEC bridge', async () => {
      zcashService.verifyShieldedTransaction = jest.fn().mockResolvedValue({
        verified: true,
        amount: 0.1,
        txHash: global.testUtils.mockTxHashes.zcash,
        confirmations: 10
      });

      const zecRequest = {
        solanaAddress: global.testUtils.mockAddresses.solana,
        amount: 0.1,
        zcashTxHash: global.testUtils.mockTxHashes.zcash
      };

      const response = await request(app)
        .post('/api/bridge')
        .send(zecRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('zcashVerification');
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

      expect(response.body).toHaveProperty('error');
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

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('both');
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
      zcashService.verifyShieldedTransaction = jest.fn().mockResolvedValue({
        verified: false,
        reason: 'transaction not found'
      });

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
      expect(response.body.error).toContain('verification failed');
    });

    test('should support ZEC privacy conversion', async () => {
      bitcoinService.verifyBitcoinPayment = jest.fn().mockResolvedValue({
        verified: true,
        amount: 10000000,
        confirmations: 10
      });

      converterService.convertBTCtoZEC = jest.fn().mockResolvedValue({
        zecAmount: 0.09,
        zecTxHash: 'zec-tx-hash'
      });

      zcashService.verifyShieldedTransaction = jest.fn().mockResolvedValue({
        verified: true,
        amount: 0.09,
        confirmations: 10
      });

      const privacyRequest = {
        ...validBridgeRequest,
        useZecPrivacy: true
      };

      const response = await request(app)
        .post('/api/bridge')
        .send(privacyRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(converterService.convertBTCtoZEC).toHaveBeenCalled();
    });

    test('should save transaction to database', async () => {
      await request(app)
        .post('/api/bridge')
        .send(validBridgeRequest)
        .expect(200);

      expect(databaseService.saveBridgeTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          solanaAddress: global.testUtils.mockAddresses.solana,
          amount: 0.1,
          bitcoinTxHash: global.testUtils.mockTxHashes.bitcoin,
          direction: 'btc_to_zenzec'
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
      expect(response.body.transaction).toBeDefined();
    });
  });

  describe('POST /api/bridge/swap-sol-to-zenzec', () => {
    const validSwapRequest = {
      solanaAddress: global.testUtils.mockAddresses.solana,
      solAmount: 0.1
    };

    beforeEach(() => {
      solanaService.swapSOLToZenZEC = jest.fn().mockResolvedValue({
        signature: 'swap-signature',
        solAmount: 0.1,
        zenZecAmount: 10
      });

      arciumService.encryptAmount = jest.fn().mockResolvedValue({
        encrypted: true,
        ciphertext: 'encrypted-amount',
        pubkey: global.testUtils.mockAddresses.solana
      });
    });

    test('should successfully swap SOL to zenZEC', async () => {
      const response = await request(app)
        .post('/api/bridge/swap-sol-to-zenzec')
        .send(validSwapRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('txSignature', 'swap-signature');
      expect(response.body).toHaveProperty('solAmount', 0.1);
      expect(response.body).toHaveProperty('zenZECAmount', 10);
      expect(response.body).toHaveProperty('encrypted', true);
    });

    test('should encrypt amount when usePrivacy is true', async () => {
      const privacyRequest = {
        ...validSwapRequest,
        usePrivacy: true
      };

      await request(app)
        .post('/api/bridge/swap-sol-to-zenzec')
        .send(privacyRequest)
        .expect(200);

      expect(arciumService.encryptAmount).toHaveBeenCalledWith(0.1, global.testUtils.mockAddresses.solana);
    });

    test('should always encrypt amount (privacy mandatory)', async () => {
      await request(app)
        .post('/api/bridge/swap-sol-to-zenzec')
        .send(validSwapRequest)
        .expect(200);

      expect(arciumService.encryptAmount).toHaveBeenCalledWith(0.1, global.testUtils.mockAddresses.solana);
    });

    test('should reject invalid requests', async () => {
      const invalidRequest = {
        solanaAddress: global.testUtils.mockAddresses.solana
        // Missing solAmount
      };

      const response = await request(app)
        .post('/api/bridge/swap-sol-to-zenzec')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle swap errors', async () => {
      solanaService.swapSOLToZenZEC = jest.fn().mockRejectedValue(new Error('Swap failed'));

      const response = await request(app)
        .post('/api/bridge/swap-sol-to-zenzec')
        .send(validSwapRequest)
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Swap failed');
    });

    test('should save swap transaction to database', async () => {
      await request(app)
        .post('/api/bridge/swap-sol-to-zenzec')
        .send(validSwapRequest)
        .expect(200);

      expect(databaseService.saveSwapTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          solanaAddress: global.testUtils.mockAddresses.solana,
          solAmount: 0.1,
          zenZECAmount: 10,
          direction: 'sol_to_zenzec'
        })
      );
    });
  });

  describe('POST /api/bridge/create-burn-for-btc-tx', () => {
    const validBurnRequest = {
      solanaAddress: global.testUtils.mockAddresses.solana,
      amount: 0.5,
      btcAddress: global.testUtils.mockAddresses.bitcoin
    };

    beforeEach(() => {
      solanaService.createBurnForBTCTransaction = jest.fn().mockReturnValue({
        // Mock transaction object
        add: jest.fn().mockReturnThis(),
        sign: jest.fn(),
        serialize: jest.fn(() => Buffer.from('mock-serialized-tx'))
      });

      arciumService.encryptBTCAddress = jest.fn().mockResolvedValue({
        encrypted: true,
        ciphertext: 'encrypted-btc-address',
        pubkey: global.testUtils.mockAddresses.solana
      });
    });

    test('should create burn transaction successfully', async () => {
      const response = await request(app)
        .post('/api/bridge/create-burn-for-btc-tx')
        .send(validBurnRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('transaction');
      expect(response.body).toHaveProperty('message');
      expect(response.body.instruction).toHaveProperty('btcAddress', '[ENCRYPTED]');
      expect(response.body.instruction).toHaveProperty('encrypted', true);
    });

    test('should always encrypt BTC address', async () => {
      await request(app)
        .post('/api/bridge/create-burn-for-btc-tx')
        .send(validBurnRequest)
        .expect(200);

      expect(arciumService.encryptBTCAddress).toHaveBeenCalledWith(
        global.testUtils.mockAddresses.bitcoin,
        global.testUtils.mockAddresses.solana
      );
    });

    test('should reject invalid requests', async () => {
      const invalidRequest = {
        solanaAddress: global.testUtils.mockAddresses.solana,
        amount: 0.5
        // Missing btcAddress
      };

      const response = await request(app)
        .post('/api/bridge/create-burn-for-btc-tx')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    test('should validate BTC address format', async () => {
      const invalidRequest = {
        ...validBurnRequest,
        btcAddress: 'invalid-address'
      };

      const response = await request(app)
        .post('/api/bridge/create-burn-for-btc-tx')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Bitcoin address');
    });

    test('should handle transaction creation errors', async () => {
      solanaService.createBurnForBTCTransaction = jest.fn().mockImplementation(() => {
        throw new Error('Transaction creation failed');
      });

      const response = await request(app)
        .post('/api/bridge/create-burn-for-btc-tx')
        .send(validBurnRequest)
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Transaction creation failed');
    });
  });

  describe('GET /api/bridge/transactions/:address', () => {
    const mockAddress = global.testUtils.mockAddresses.solana;

    test('should return transactions for address', async () => {
      databaseService.getTransactionsByAddress = jest.fn().mockResolvedValue([
        {
          id: 1,
          amount: 0.1,
          direction: 'btc_to_zenzec',
          status: 'confirmed',
          created_at: new Date()
        }
      ]);

      const response = await request(app)
        .get(`/api/bridge/transactions/${mockAddress}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('transactions');
      expect(Array.isArray(response.body.transactions)).toBe(true);
      expect(response.body.transactions).toHaveLength(1);
    });

    test('should handle pagination', async () => {
      databaseService.getTransactionsByAddress = jest.fn().mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/bridge/transactions/${mockAddress}?limit=10&offset=20&type=bridge`)
        .expect(200);

      expect(databaseService.getTransactionsByAddress).toHaveBeenCalledWith(
        mockAddress,
        expect.objectContaining({
          limit: 10,
          offset: 20,
          type: 'bridge'
        })
      );
    });

    test('should handle database unavailability', async () => {
      databaseService.isConnected = jest.fn().mockReturnValue(false);

      const response = await request(app)
        .get(`/api/bridge/transactions/${mockAddress}`)
        .expect(503);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Database not available');
    });

    test('should handle database errors', async () => {
      databaseService.getTransactionsByAddress = jest.fn().mockRejectedValue(new Error('DB Error'));

      const response = await request(app)
        .get(`/api/bridge/transactions/${mockAddress}`)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

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
