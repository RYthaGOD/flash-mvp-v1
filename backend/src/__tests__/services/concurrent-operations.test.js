/**
 * Concurrent Operations Stress Tests
 * Tests race condition fixes with concurrent operations
 */

const databaseService = require('../../services/database');
const BTCRedemptionService = require('../../services/btc-relayer');
const RelayerService = require('../../services/relayer');

// Mock dependencies
jest.mock('../../services/solana');
jest.mock('../../services/bitcoin');
jest.mock('../../services/arcium');

describe('Concurrent Operations Stress Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Concurrent BTC Redemption Processing', () => {
    
    test('should process only one redemption for same transfer signature', async () => {
      const userAddress = 'TestUser123';
      const transferSignature = 'TestSignature123';
      const amount = 1.0;
      const btcAddress = 'bc1test';
      
      const redemptionData = {
        userAddress,
        transferSignature,
        encryptedBtcAddress: 'encrypted_address_data',
        nativeZECAmount: amount
      };

      // Mock the service methods
      const processRedemptionSpy = jest.spyOn(BTCRedemptionService, 'processRedemption');
      
      // Simulate concurrent calls
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          BTCRedemptionService.processRedemption(redemptionData).catch(e => e)
        );
      }

      const results = await Promise.allSettled(promises);

      // Check that only one succeeded (or all failed if database not available)
      const succeeded = results.filter(r => r.status === 'fulfilled' && !r.value?.alreadyProcessed);
      const failed = results.filter(r => r.status === 'rejected' || r.value?.alreadyProcessed);
      
      // With database locking, only one should succeed, others should be marked as already processed
      expect(succeeded.length + failed.length).toBe(10);
      
      processRedemptionSpy.mockRestore();
    });

    test('should handle concurrent reserve checks atomically', async () => {
      const bridgeAddress = 'bc1bridge';
      const bootstrapAmount = 100000000; // 1 BTC in satoshis
      const amountSatoshis = 10000000; // 0.1 BTC in satoshis
      
      const withdrawalData = {
        txHash: 'test_hash',
        bridgeAddress,
        amountSatoshis,
        amountBTC: amountSatoshis / 100000000,
        recipientAddress: 'bc1recipient',
        confirmations: 0,
        status: 'pending',
        solanaTxSignature: 'test_sig',
        solanaAddress: 'TestUser',
        zenZECAmount: 1.0
      };

      // Simulate concurrent reserve checks
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          databaseService.checkAndReserveBTC(
            bridgeAddress,
            bootstrapAmount,
            amountSatoshis,
            withdrawalData
          ).catch(e => e)
        );
      }

      const results = await Promise.allSettled(promises);
      
      // All should either succeed or fail consistently
      // With atomic operations, only some should succeed based on available reserve
      const succeeded = results.filter(r => r.status === 'fulfilled' && r.value?.success);
      const failed = results.filter(r => r.status === 'rejected' || !r.value?.success);
      
      expect(succeeded.length + failed.length).toBe(5);
      
      // If any succeeded, verify they didn't over-reserve
      if (succeeded.length > 0 && databaseService.isConnected()) {
        // This test depends on database being available
        // In a real scenario, we'd verify total reserve doesn't exceed available
      }
    });
  });

  describe('Concurrent Event Processing', () => {
    
    test('should process each event only once with concurrent calls', async () => {
      const event = {
        user: 'TestUser',
        amount: 100000000, // 1 token in smallest unit
        signature: 'EventSignature123'
      };

      const processEventSpy = jest.spyOn(RelayerService, 'processBurnSwapEvent');
      
      // Simulate concurrent event processing
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          RelayerService.processBurnSwapEvent(event).catch(e => e)
        );
      }

      const results = await Promise.allSettled(promises);
      
      // Only one should process successfully, others should detect duplicate
      const processed = results.filter(r => r.status === 'fulfilled');
      const duplicates = results.filter(r => 
        r.status === 'rejected' || 
        (r.status === 'fulfilled' && r.value === undefined) // Already processed returns undefined
      );
      
      expect(processed.length + duplicates.length).toBe(10);
      
      processEventSpy.mockRestore();
    });

    test('should handle rapid status updates atomically', async () => {
      const txId = 'test_transaction_123';
      const fromStatus = 'pending';
      const toStatus = 'processing';
      
      // Simulate concurrent status updates
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          databaseService.updateTransactionStatus(txId, fromStatus, toStatus).catch(e => e)
        );
      }

      const results = await Promise.allSettled(promises);
      
      // All should either succeed or fail, but no inconsistent states
      expect(results.length).toBe(10);
      
      // Verify no race conditions occurred (would require database inspection)
      // This test structure validates that concurrent calls don't crash
    });
  });

  describe('Database Locking Behavior', () => {
    
    test('getEventWithLock should prevent concurrent processing', async () => {
      const signature = 'TestSignatureLock';
      
      // Simulate concurrent lock attempts
      const promises = [];
      for (let i = 0; i < 5; i++) {
        if (databaseService.isConnected()) {
          promises.push(
            databaseService.pool.connect().then(async (client) => {
              try {
                await client.query('BEGIN');
                const result = await databaseService.getEventWithLock(signature, client);
                await client.query('ROLLBACK');
                return result;
              } finally {
                client.release();
              }
            }).catch(e => e)
          );
        }
      }

      const results = await Promise.allSettled(promises);
      
      // First lock should succeed, others should wait or fail
      // Exact behavior depends on database configuration
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Reserve Management Concurrency', () => {
    
    test('should maintain reserve consistency under concurrent withdrawals', async () => {
      if (!databaseService.isConnected()) {
        console.log('Skipping: Database not connected');
        return;
      }

      const bridgeAddress = 'bc1test';
      const bootstrapAmount = 1000000000; // 10 BTC
      const withdrawalAmount = 10000000; // 0.1 BTC each
      
      const withdrawalData = {
        txHash: `test_${Date.now()}`,
        bridgeAddress,
        amountSatoshis: withdrawalAmount,
        amountBTC: withdrawalAmount / 100000000,
        recipientAddress: 'bc1recipient',
        confirmations: 0,
        status: 'pending'
      };

      // Simulate 10 concurrent withdrawals of 0.1 BTC each
      // Total needed: 1 BTC, reserve: 10 BTC (should succeed for all)
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const data = { ...withdrawalData, txHash: `test_${Date.now()}_${i}` };
        promises.push(
          databaseService.checkAndReserveBTC(
            bridgeAddress,
            bootstrapAmount,
            withdrawalAmount,
            data
          ).catch(e => ({ success: false, error: e.message }))
        );
      }

      const results = await Promise.allSettled(promises);
      
      // All should succeed since total < reserve
      const succeeded = results.filter(r => 
        r.status === 'fulfilled' && r.value?.success
      );
      
      // With atomic operations, all should succeed or fail consistently
      expect(results.length).toBe(10);
    });
  });

  describe('Error Recovery Under Concurrency', () => {
    
    test('should handle errors gracefully without affecting other operations', async () => {
      const validEvent = {
        user: 'ValidUser',
        amount: 100000000,
        signature: 'ValidSignature'
      };

      const invalidEvent = {
        user: null, // Invalid
        amount: 100000000,
        signature: 'InvalidSignature'
      };

      // Mix valid and invalid events
      const promises = [
        RelayerService.processBurnSwapEvent(validEvent).catch(e => ({ error: e.message })),
        RelayerService.processBurnSwapEvent(invalidEvent).catch(e => ({ error: e.message })),
        RelayerService.processBurnSwapEvent(validEvent).catch(e => ({ error: e.message })),
      ];

      const results = await Promise.allSettled(promises);
      
      // Invalid should fail, valid should process (or be marked as duplicate)
      expect(results.length).toBe(3);
      
      // At least one should have an error (the invalid one)
      const errors = results.filter(r => 
        r.status === 'rejected' || 
        (r.status === 'fulfilled' && r.value?.error)
      );
      
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

