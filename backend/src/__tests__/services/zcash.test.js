// Mock axios for API calls
jest.mock('axios');
const { mockZcashAPI, mockAxiosError, simulateNetworkError } = require('../mocks/axios');

const ZcashService = require('../../services/zcash');

describe('ZcashService', () => {
  let zcashService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup axios mock
    const axios = require('axios');
    Object.assign(axios, mockZcashAPI());

    // Reset singleton instance
    delete require.cache[require.resolve('../../services/zcash')];
    zcashService = require('../../services/zcash');
  });

  describe('initialization', () => {
    test('should initialize with correct network', () => {
      expect(zcashService.network).toBe('testnet');
      expect(zcashService.lightwalletdUrl).toBeDefined();
      expect(zcashService.explorerUrl).toBeDefined();
    });
  });

  describe('isValidAddress', () => {
    test('should validate transparent addresses (t1)', () => {
      expect(zcashService.isValidAddress('t1h8SqgtSqVF2Z3TdC2y9cy2Z7F5Z8Z8Z8Z')).toBe(true);
      expect(zcashService.isValidAddress('t1aKQbwJfGJ6gHq8Z8Z8Z8Z8Z8Z8Z8Z8Z8')).toBe(true);
    });

    test('should validate shielded addresses (z)', () => {
      expect(zcashService.isValidAddress('zs1testaddress12345678901234567890')).toBe(true);
      expect(zcashService.isValidAddress('zs1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq')).toBe(true);
    });

    test('should reject invalid addresses', () => {
      expect(zcashService.isValidAddress('')).toBe(false);
      expect(zcashService.isValidAddress('invalid')).toBe(false);
      expect(zcashService.isValidAddress('t1invalid')).toBe(false);
      expect(zcashService.isValidAddress('zs1invalid')).toBe(false);
    });

    test('should handle mainnet vs testnet addresses', () => {
      // Testnet addresses
      expect(zcashService.isValidAddress('tm9oXpT4N7QF5CzX7QJnM')).toBe(true);
      expect(zcashService.isValidAddress('zs1testaddress12345678901234567890')).toBe(true);
    });
  });

  describe('verifyShieldedTransaction', () => {
    const mockTxHash = global.testUtils.mockTxHashes.zcash;
    const mockAmount = 1.5;

    beforeEach(() => {
      // Mock successful API response
      axios.get.mockResolvedValue({
        data: {
          txid: mockTxHash,
          amount: mockAmount,
          confirmations: 10,
          blockHeight: 1500000,
          timestamp: Date.now() / 1000,
          shielded: true
        }
      });
    });

    test('should verify valid shielded transaction', async () => {
      const result = await zcashService.verifyShieldedTransaction(mockTxHash);

      expect(result.verified).toBe(true);
      expect(result.txHash).toBe(mockTxHash);
      expect(result.amount).toBe(mockAmount);
      expect(result.confirmations).toBe(10);
      expect(result.blockHeight).toBe(1500000);
      expect(result.shielded).toBe(true);
    });

    test('should reject insufficient confirmations', async () => {
      axios.get.mockResolvedValue({
        data: {
          txid: mockTxHash,
          amount: mockAmount,
          confirmations: 2, // Less than minimum
          shielded: true
        }
      });

      const result = await zcashService.verifyShieldedTransaction(mockTxHash);
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('insufficient confirmations');
    });

    test('should handle non-shielded transactions', async () => {
      axios.get.mockResolvedValue({
        data: {
          txid: mockTxHash,
          amount: mockAmount,
          confirmations: 10,
          shielded: false // Not shielded
        }
      });

      const result = await zcashService.verifyShieldedTransaction(mockTxHash);
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('not a shielded transaction');
    });

    test('should handle API errors gracefully', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));

      const result = await zcashService.verifyShieldedTransaction(mockTxHash);
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('API error');
    });

    test('should handle non-existent transaction', async () => {
      axios.get.mockRejectedValue({ response: { status: 404 } });

      const result = await zcashService.verifyShieldedTransaction(mockTxHash);
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('not found');
    });
  });

  describe('getTransactionDetails', () => {
    const mockTxHash = global.testUtils.mockTxHashes.zcash;

    test('should return transaction details', async () => {
      axios.get.mockResolvedValue({
        data: {
          txid: mockTxHash,
          amount: 2.5,
          confirmations: 15,
          blockHeight: 1600000,
          timestamp: Date.now() / 1000,
          shielded: true,
          fee: 0.0001,
          inputs: [],
          outputs: [
            { amount: 2.4, address: 'zs1...' },
            { amount: 0.0001, address: 'fee' }
          ]
        }
      });

      const result = await zcashService.getTransactionDetails(mockTxHash);

      expect(result.txid).toBe(mockTxHash);
      expect(result.amount).toBe(2.5);
      expect(result.confirmations).toBe(15);
      expect(result.shielded).toBe(true);
      expect(result.outputs).toHaveLength(2);
    });

    test('should handle API errors', async () => {
      axios.get.mockRejectedValue(new Error('API Error'));

      await expect(zcashService.getTransactionDetails(mockTxHash))
        .rejects.toThrow('Failed to get transaction details');
    });
  });

  describe('getBridgeAddress', () => {
    test('should return configured bridge address', () => {
      const address = zcashService.getBridgeAddress();
      expect(typeof address).toBe('string');
      expect(address.length).toBeGreaterThan(0);
    });

    test('should return fallback placeholder when not configured', () => {
      // Mock environment without bridge address
      const originalEnv = process.env.ZCASH_BRIDGE_ADDRESS;
      delete process.env.ZCASH_BRIDGE_ADDRESS;

      const service = new ZcashService();
      const address = service.getBridgeAddress();

      expect(address).toContain('placeholder');

      // Restore
      process.env.ZCASH_BRIDGE_ADDRESS = originalEnv;
    });
  });

  describe('convertZECToZatoshis', () => {
    test('should convert ZEC to zatoshis correctly', () => {
      expect(zcashService.convertZECToZatoshis(1)).toBe(100000000);
      expect(zcashService.convertZECToZatoshis(0.1)).toBe(10000000);
      expect(zcashService.convertZECToZatoshis(0.001)).toBe(100000);
      expect(zcashService.convertZECToZatoshis(0.00000001)).toBe(1);
    });

    test('should handle zero and negative values', () => {
      expect(zcashService.convertZECToZatoshis(0)).toBe(0);
      expect(zcashService.convertZECToZatoshis(-0.1)).toBe(-10000000);
    });
  });

  describe('convertZatoshisToZEC', () => {
    test('should convert zatoshis to ZEC correctly', () => {
      expect(zcashService.convertZatoshisToZEC(100000000)).toBe(1);
      expect(zcashService.convertZatoshisToZEC(10000000)).toBe(0.1);
      expect(zcashService.convertZatoshisToZEC(100000)).toBe(0.001);
      expect(zcashService.convertZatoshisToZEC(1)).toBe(0.00000001);
    });

    test('should handle zero and negative values', () => {
      expect(zcashService.convertZatoshisToZEC(0)).toBe(0);
      expect(zcashService.convertZatoshisToZEC(-10000000)).toBe(-0.1);
    });
  });

  describe('getNetworkInfo', () => {
    test('should return network information', () => {
      const info = zcashService.getNetworkInfo();

      expect(info).toHaveProperty('network');
      expect(info).toHaveProperty('lightwalletdUrl');
      expect(info).toHaveProperty('explorerUrl');
      expect(info).toHaveProperty('bridgeAddress');
    });
  });

  describe('getPrice', () => {
    test('should return ZEC price in USD', async () => {
      axios.get.mockResolvedValue({
        data: {
          zcash: { usd: 45.67 }
        }
      });

      const price = await zcashService.getPrice();
      expect(price).toBe(45.67);
    });

    test('should handle API errors', async () => {
      axios.get.mockRejectedValue(new Error('API Error'));

      const price = await zcashService.getPrice();
      expect(typeof price).toBe('number');
      expect(price).toBeGreaterThan(0); // Should return fallback price
    });
  });

  describe('estimateFee', () => {
    test('should estimate transaction fee', () => {
      const fee = zcashService.estimateFee();
      expect(typeof fee).toBe('number');
      expect(fee).toBeGreaterThan(0);
    });

    test('should estimate fee for specific priority', () => {
      expect(zcashService.estimateFee('slow')).toBeGreaterThan(0);
      expect(zcashService.estimateFee('fast')).toBeGreaterThan(zcashService.estimateFee('slow'));
    });
  });

  describe('validateTransaction', () => {
    const mockTx = {
      txid: global.testUtils.mockTxHashes.zcash,
      amount: 1.5,
      confirmations: 10,
      shielded: true,
      blockHeight: 1500000
    };

    test('should validate correct shielded transaction', () => {
      const result = zcashService.validateTransaction(mockTx, 1.5);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject insufficient confirmations', () => {
      const invalidTx = { ...mockTx, confirmations: 3 };
      const result = zcashService.validateTransaction(invalidTx, 1.5);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Insufficient confirmations');
    });

    test('should reject amount mismatch', () => {
      const result = zcashService.validateTransaction(mockTx, 2.0); // Wrong amount
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount mismatch');
    });

    test('should reject non-shielded transactions', () => {
      const invalidTx = { ...mockTx, shielded: false };
      const result = zcashService.validateTransaction(invalidTx, 1.5);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Not a shielded transaction');
    });
  });

  describe('getTransactionHistory', () => {
    const mockAddress = global.testUtils.mockAddresses.zcash;

    test('should return transaction history', async () => {
      axios.get.mockResolvedValue({
        data: [
          {
            txid: global.testUtils.mockTxHashes.zcash,
            amount: 1.5,
            confirmations: 12,
            time: Date.now() / 1000,
            shielded: true
          }
        ]
      });

      const history = await zcashService.getTransactionHistory(mockAddress);

      expect(Array.isArray(history)).toBe(true);
      expect(history).toHaveLength(1);
      expect(history[0]).toHaveProperty('txid');
      expect(history[0]).toHaveProperty('amount');
      expect(history[0]).toHaveProperty('shielded');
    });

    test('should handle API errors', async () => {
      axios.get.mockRejectedValue(new Error('API Error'));

      await expect(zcashService.getTransactionHistory(mockAddress))
        .rejects.toThrow('Failed to get transaction history');
    });
  });

  describe('sendZEC', () => {
    const mockAddress = global.testUtils.mockAddresses.zcash;
    const mockAmount = 0.1;

    test('should send ZEC successfully in demo mode', async () => {
      // In demo mode, this should return a mock transaction hash
      const result = await zcashService.sendZEC(mockAddress, mockAmount);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should validate address before sending', async () => {
      await expect(zcashService.sendZEC('invalid-address', mockAmount))
        .rejects.toThrow('Invalid Zcash address');
    });

    test('should validate amount', async () => {
      await expect(zcashService.sendZEC(mockAddress, -1))
        .rejects.toThrow('Invalid amount');

      await expect(zcashService.sendZEC(mockAddress, 0))
        .rejects.toThrow('Invalid amount');
    });
  });

  describe('getBalance', () => {
    const mockAddress = global.testUtils.mockAddresses.zcash;

    test('should return balance information', async () => {
      axios.get.mockResolvedValue({
        data: {
          balance: 5.25,
          confirmed: 5.0,
          unconfirmed: 0.25
        }
      });

      const balance = await zcashService.getBalance(mockAddress);

      expect(balance).toHaveProperty('total', 5.25);
      expect(balance).toHaveProperty('confirmed', 5.0);
      expect(balance).toHaveProperty('unconfirmed', 0.25);
    });

    test('should handle API errors', async () => {
      axios.get.mockRejectedValue(new Error('API Error'));

      const balance = await zcashService.getBalance(mockAddress);
      expect(balance.total).toBe(0); // Should return default balance
    });
  });

  describe('getBlockHeight', () => {
    test('should return current block height', async () => {
      axios.get.mockResolvedValue({
        data: {
          blockHeight: 1750000
        }
      });

      const height = await zcashService.getBlockHeight();
      expect(height).toBe(1750000);
    });

    test('should handle API errors', async () => {
      axios.get.mockRejectedValue(new Error('API Error'));

      const height = await zcashService.getBlockHeight();
      expect(typeof height).toBe('number');
      expect(height).toBeGreaterThan(0); // Should return fallback
    });
  });

  describe('isShieldedTransaction', () => {
    test('should identify shielded transactions', () => {
      expect(zcashService.isShieldedTransaction({ shielded: true })).toBe(true);
      expect(zcashService.isShieldedTransaction({ shielded: false })).toBe(false);
      expect(zcashService.isShieldedTransaction({})).toBe(false);
    });
  });

  describe('getMinimumConfirmations', () => {
    test('should return minimum confirmations for network', () => {
      const minConfs = zcashService.getMinimumConfirmations();
      expect(typeof minConfs).toBe('number');
      expect(minConfs).toBeGreaterThan(0);
    });
  });

  describe('getTransactionFee', () => {
    test('should calculate transaction fee', () => {
      const fee = zcashService.getTransactionFee(2.5); // 2.5 ZEC transaction
      expect(typeof fee).toBe('number');
      expect(fee).toBeGreaterThan(0);
      expect(fee).toBeLessThan(2.5); // Fee should be less than transaction amount
    });

    test('should handle zero amount', () => {
      const fee = zcashService.getTransactionFee(0);
      expect(fee).toBeGreaterThanOrEqual(0);
    });
  });
});
