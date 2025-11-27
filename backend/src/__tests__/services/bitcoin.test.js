// Set test environment variables before importing services
process.env.BITCOIN_BRIDGE_ADDRESS = 'bc1qtestaddress12345678901234567890';

// Mock axios for API calls
jest.mock('axios');
const axios = require('axios');

// Setup mock before importing service
axios.get.mockImplementation((url) => {
  console.log('TOP LEVEL MOCK called with URL:', url);
  if (url.includes('/tx/')) {
    const mockData = {
      txid: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z',
      version: 2,
      locktime: 0,
      vin: [],
      vout: [{
        scriptpubkey: 'mock-script',
        scriptpubkey_asm: 'mock-asm',
        scriptpubkey_type: 'p2wpkh',
        scriptpubkey_address: 'bc1qtestaddress12345678901234567890',
        value: 10000000 // 0.1 BTC in satoshis
      }],
      size: 250,
      weight: 1000,
      fee: 1000,
      status: {
        confirmed: true,
        block_height: 800000,
        block_hash: '000000000000000000024bead8df69990852c202db0e90eb78489cdfdbdba9e442',
        block_time: Math.floor(Date.now() / 1000),
        confirmations: 6
      }
    };
    console.log('TOP LEVEL MOCK returning:', JSON.stringify(mockData.status, null, 2));
    return Promise.resolve({ data: mockData });
  }
  return Promise.resolve({ data: {} });
});

const BitcoinService = require('../../services/bitcoin');

describe('BitcoinService', () => {
  let bitcoinService;

  beforeEach(() => {
    jest.clearAllMocks();
    // BitcoinService is a singleton, use the imported instance
    bitcoinService = BitcoinService;
  });

  describe('initialization', () => {
    test('should initialize with correct network', () => {
      expect(bitcoinService.network).toBe('testnet');
      expect(bitcoinService.explorerUrl).toBeDefined();
    });
  });

  describe('isValidAddress', () => {
    test('should validate mainnet addresses', () => {
      expect(bitcoinService.isValidAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(true);
      expect(bitcoinService.isValidAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(true);
      expect(bitcoinService.isValidAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(true);
    });

    test('should reject invalid addresses', () => {
      expect(bitcoinService.isValidAddress('')).toBe(false);
      expect(bitcoinService.isValidAddress('invalid')).toBe(false);
      expect(bitcoinService.isValidAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN')).toBe(false); // Too short
      expect(bitcoinService.isValidAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN22')).toBe(false); // Too long
    });

    test('should validate testnet addresses', () => {
      // Testnet addresses (start with 'm', 'n', '2', 'tb1')
      expect(bitcoinService.isValidAddress('mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn')).toBe(true);
      expect(bitcoinService.isValidAddress('2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc')).toBe(true);
    });
  });

  describe('verifyBitcoinPayment', () => {
    const mockTxHash = global.testUtils.mockTxHashes.bitcoin;
    const mockAmount = 0.1;

    beforeEach(() => {
      // Mock successful API response
      axios.get.mockResolvedValue({
        data: {
          txid: mockTxHash,
          confirmations: 6,
          vout: [
            {
              value: 0.1,
              scriptpubkey_address: global.testUtils.mockAddresses.bitcoin
            }
          ]
        }
      });
    });

    test('should verify valid bitcoin payment', async () => {
      console.log('Bridge address in test:', bitcoinService.bridgeAddress);
      console.log('Mock amount:', mockAmount);

      // Get the transaction data directly to debug
      const tx = await bitcoinService.getTransaction(mockTxHash);
      console.log('Transaction data received:', JSON.stringify(tx, null, 2));
      console.log('Transaction status:', tx?.status);
      console.log('Block height:', tx?.status?.block_height);

      const result = await bitcoinService.verifyBitcoinPayment(mockTxHash, mockAmount);
      console.log('Verification result:', JSON.stringify(result, null, 2));

      expect(result.verified).toBe(true);
      expect(result.amount).toBe(10000000); // 0.1 BTC in satoshis
      expect(result.confirmations).toBe(6);
      expect(result.txHash).toBe(mockTxHash);
    });

    test('should reject insufficient confirmations', async () => {
      axios.get.mockResolvedValue({
        data: {
          txid: mockTxHash,
          confirmations: 1, // Less than minimum
          vout: [{ value: 0.1, scriptpubkey_address: global.testUtils.mockAddresses.bitcoin }]
        }
      });

      const result = await bitcoinService.verifyBitcoinPayment(mockTxHash, mockAmount);
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('insufficient confirmations');
    });

    test('should reject amount mismatch', async () => {
      axios.get.mockResolvedValue({
        data: {
          txid: mockTxHash,
          confirmations: 6,
          vout: [{ value: 0.05, scriptpubkey_address: global.testUtils.mockAddresses.bitcoin }] // Wrong amount
        }
      });

      const result = await bitcoinService.verifyBitcoinPayment(mockTxHash, mockAmount);
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('amount mismatch');
    });

    test('should handle API errors gracefully', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));

      const result = await bitcoinService.verifyBitcoinPayment(mockTxHash, mockAmount);
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('API error');
    });

    test('should handle non-existent transaction', async () => {
      axios.get.mockRejectedValue({ response: { status: 404 } });

      const result = await bitcoinService.verifyBitcoinPayment(mockTxHash, mockAmount);
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('not found');
    });
  });

  describe('getTransactionDetails', () => {
    const mockTxHash = global.testUtils.mockTxHashes.bitcoin;

    test('should return transaction details', async () => {
      axios.get.mockResolvedValue({
        data: {
          txid: mockTxHash,
          confirmations: 10,
          size: 250,
          weight: 1000,
          fee: 1000,
          vin: [],
          vout: [
            { value: 0.05, scriptpubkey_address: 'address1' },
            { value: 0.04, scriptpubkey_address: 'address2' }
          ]
        }
      });

      const result = await bitcoinService.getTransactionDetails(mockTxHash);

      expect(result.txid).toBe(mockTxHash);
      expect(result.confirmations).toBe(10);
      expect(result.outputs).toHaveLength(2);
      expect(result.totalOutput).toBe(0.09);
    });

    test('should handle API errors', async () => {
      axios.get.mockRejectedValue(new Error('API Error'));

      await expect(bitcoinService.getTransactionDetails(mockTxHash))
        .rejects.toThrow('Failed to get transaction details');
    });
  });

  describe('getCurrentReserveBTC', () => {
    test('should return current reserve amount', () => {
      const reserve = bitcoinService.getCurrentReserveBTC();
      expect(typeof reserve).toBe('number');
      expect(reserve).toBeGreaterThanOrEqual(0);
    });
  });

  describe('addToReserve', () => {
    test('should add positive amount to reserve', () => {
      const initialReserve = bitcoinService.getCurrentReserveBTC();
      bitcoinService.addToReserve(100000); // 0.001 BTC
      const newReserve = bitcoinService.getCurrentReserveBTC();

      expect(newReserve).toBe(initialReserve + 100000);
    });

    test('should subtract negative amount from reserve', () => {
      const initialReserve = bitcoinService.getCurrentReserveBTC();
      bitcoinService.addToReserve(-50000); // Subtract 0.0005 BTC
      const newReserve = bitcoinService.getCurrentReserveBTC();

      expect(newReserve).toBe(initialReserve - 50000);
    });
  });

  describe('convertBTCToSatoshis', () => {
    test('should convert BTC to satoshis correctly', () => {
      expect(bitcoinService.convertBTCToSatoshis(1)).toBe(100000000);
      expect(bitcoinService.convertBTCToSatoshis(0.1)).toBe(10000000);
      expect(bitcoinService.convertBTCToSatoshis(0.001)).toBe(100000);
      expect(bitcoinService.convertBTCToSatoshis(0.00000001)).toBe(1);
    });

    test('should handle zero and negative values', () => {
      expect(bitcoinService.convertBTCToSatoshis(0)).toBe(0);
      expect(bitcoinService.convertBTCToSatoshis(-0.1)).toBe(-10000000);
    });
  });

  describe('convertSatoshisToBTC', () => {
    test('should convert satoshis to BTC correctly', () => {
      expect(bitcoinService.convertSatoshisToBTC(100000000)).toBe(1);
      expect(bitcoinService.convertSatoshisToBTC(10000000)).toBe(0.1);
      expect(bitcoinService.convertSatoshisToBTC(100000)).toBe(0.001);
      expect(bitcoinService.convertSatoshisToBTC(1)).toBe(0.00000001);
    });

    test('should handle zero and negative values', () => {
      expect(bitcoinService.convertSatoshisToBTC(0)).toBe(0);
      expect(bitcoinService.convertSatoshisToBTC(-10000000)).toBe(-0.1);
    });
  });

  describe('getNetworkInfo', () => {
    test('should return network information', () => {
      const info = bitcoinService.getNetworkInfo();

      expect(info).toHaveProperty('network');
      expect(info).toHaveProperty('explorerUrl');
      expect(info).toHaveProperty('bridgeAddress');
      expect(info).toHaveProperty('currentReserveBTC');
    });
  });

  describe('getBridgeAddress', () => {
    test('should return configured bridge address', () => {
      const address = bitcoinService.getBridgeAddress();
      expect(typeof address).toBe('string');
      expect(address.length).toBeGreaterThan(0);
    });
  });

  describe('estimateFee', () => {
    test('should estimate transaction fee', () => {
      const fee = bitcoinService.estimateFee();
      expect(typeof fee).toBe('number');
      expect(fee).toBeGreaterThan(0);
    });

    test('should estimate fee for specific sat/vbyte', () => {
      const fee = bitcoinService.estimateFee(10); // 10 sat/vbyte
      expect(typeof fee).toBe('number');
      expect(fee).toBeGreaterThan(0);
    });
  });

  describe('validateTransaction', () => {
    const mockTx = {
      txid: global.testUtils.mockTxHashes.bitcoin,
      confirmations: 6,
      outputs: [
        { value: 0.1, address: global.testUtils.mockAddresses.bitcoin }
      ]
    };

    test('should validate correct transaction', () => {
      const result = bitcoinService.validateTransaction(mockTx, 0.1);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject insufficient confirmations', () => {
      const invalidTx = { ...mockTx, confirmations: 1 };
      const result = bitcoinService.validateTransaction(invalidTx, 0.1);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Insufficient confirmations');
    });

    test('should reject amount mismatch', () => {
      const result = bitcoinService.validateTransaction(mockTx, 0.2); // Wrong amount
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount mismatch');
    });

    test('should reject missing outputs', () => {
      const invalidTx = { ...mockTx, outputs: [] };
      const result = bitcoinService.validateTransaction(invalidTx, 0.1);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No outputs found');
    });
  });

  describe('getTransactionHistory', () => {
    const mockAddress = global.testUtils.mockAddresses.bitcoin;

    test('should return transaction history', async () => {
      axios.get.mockResolvedValue({
        data: [
          {
            txid: global.testUtils.mockTxHashes.bitcoin,
            confirmations: 10,
            amount: 0.1,
            time: Date.now() / 1000
          }
        ]
      });

      const history = await bitcoinService.getTransactionHistory(mockAddress);

      expect(Array.isArray(history)).toBe(true);
      expect(history).toHaveLength(1);
      expect(history[0]).toHaveProperty('txid');
      expect(history[0]).toHaveProperty('amount');
    });

    test('should handle API errors', async () => {
      axios.get.mockRejectedValue(new Error('API Error'));

      await expect(bitcoinService.getTransactionHistory(mockAddress))
        .rejects.toThrow('Failed to get transaction history');
    });
  });

  describe('sendBTC', () => {
    const mockAddress = global.testUtils.mockAddresses.bitcoin;
    const mockAmount = 0.01;

    test('should send BTC successfully in demo mode', async () => {
      // In demo mode, this should return a mock transaction hash
      const result = await bitcoinService.sendBTC(mockAddress, mockAmount);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should validate address before sending', async () => {
      await expect(bitcoinService.sendBTC('invalid-address', mockAmount))
        .rejects.toThrow('Invalid Bitcoin address');
    });

    test('should validate amount', async () => {
      await expect(bitcoinService.sendBTC(mockAddress, -1))
        .rejects.toThrow('Invalid amount');

      await expect(bitcoinService.sendBTC(mockAddress, 0))
        .rejects.toThrow('Invalid amount');
    });
  });
});
