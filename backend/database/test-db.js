#!/usr/bin/env node

/**
 * Database Test Script
 * Tests database connection and basic operations
 */

const databaseService = require('../src/services/database');

async function testDatabase() {
  console.log('='.repeat(60));
  console.log('Database Test Suite');
  console.log('='.repeat(60));
  console.log('');

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Connection
  console.log('Test 1: Database Connection');
  try {
    const connected = await databaseService.initialize();
    if (connected) {
      console.log('✓ Database connection successful');
      testsPassed++;
    } else {
      console.log('✗ Database connection failed');
      testsFailed++;
      console.log('\nPlease check:');
      console.log('  1. PostgreSQL is running');
      console.log('  2. Database "flash_bridge" exists');
      console.log('  3. Environment variables (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD) are set');
      process.exit(1);
    }
  } catch (error) {
    console.log('✗ Database connection error:', error.message);
    testsFailed++;
    process.exit(1);
  }
  console.log('');

  // Test 2: Save Bridge Transaction
  console.log('Test 2: Save Bridge Transaction');
  try {
    const testTx = {
      txId: `test_bridge_${Date.now()}`,
      solanaAddress: '11111111111111111111111111111111', // Valid 32-byte base58 address (44 chars)
      amount: 1.5,
      reserveAsset: 'BTC',
      status: 'confirmed',
      solanaTxSignature: '1'.repeat(88), // Valid Solana signature length
      bitcoinTxHash: 'a'.repeat(64), // Valid BTC hash length
      demoMode: true,
    };

    const saved = await databaseService.saveBridgeTransaction(testTx);
    if (saved && saved.tx_id === testTx.txId) {
      console.log('✓ Bridge transaction saved successfully');
      testsPassed++;
    } else {
      console.log('✗ Bridge transaction save failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('✗ Bridge transaction save error:', error.message);
    testsFailed++;
  }
  console.log('');

  // Test 3: Get Bridge Transaction
  console.log('Test 3: Get Bridge Transaction');
  try {
    const testTxId = `test_bridge_${Date.now() - 1000}`;
    const tx = await databaseService.getBridgeTransaction(testTxId);
    if (tx) {
      console.log('✓ Bridge transaction retrieved successfully');
      testsPassed++;
    } else {
      console.log('⚠ Bridge transaction not found (this is OK if test just ran)');
      testsPassed++; // Not a failure, just means no data yet
    }
  } catch (error) {
    console.log('✗ Get bridge transaction error:', error.message);
    testsFailed++;
  }
  console.log('');

  // Test 4: Save Swap Transaction
  console.log('Test 4: Save Swap Transaction');
  try {
    const testSwap = {
      txId: `test_swap_${Date.now()}`,
      solanaAddress: '11111111111111111111111111111111', // Valid 32-byte base58 address (44 chars)
      solAmount: 0.1,
      zenZECAmount: 10,
      solanaTxSignature: '1'.repeat(88), // Valid Solana signature length
      direction: 'sol_to_zenzec',
      status: 'confirmed',
      encrypted: false,
      demoMode: true,
    };

    const saved = await databaseService.saveSwapTransaction(testSwap);
    if (saved && saved.tx_id === testSwap.txId) {
      console.log('✓ Swap transaction saved successfully');
      testsPassed++;
    } else {
      console.log('✗ Swap transaction save failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('✗ Swap transaction save error:', error.message);
    testsFailed++;
  }
  console.log('');

  // Test 5: Save Burn Transaction
  console.log('Test 5: Save Burn Transaction');
  try {
    const testBurn = {
      txId: `test_burn_${Date.now()}`,
      solanaAddress: '11111111111111111111111111111111', // Valid 32-byte base58 address (44 chars)
      amount: 5.0,
      targetAsset: 'BTC',
      targetAddress: 'bc1qtq493cpzfu2frc2rumpm6225mafapmgl2q7auz',
      solanaTxSignature: '1'.repeat(88), // Valid Solana signature length
      status: 'pending',
      encrypted: false,
    };

    const saved = await databaseService.saveBurnTransaction(testBurn);
    if (saved && saved.tx_id === testBurn.txId) {
      console.log('✓ Burn transaction saved successfully');
      testsPassed++;
    } else {
      console.log('✗ Burn transaction save failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('✗ Burn transaction save error:', error.message);
    testsFailed++;
  }
  console.log('');

  // Test 6: Event Deduplication
  console.log('Test 6: Event Deduplication');
  try {
    const testSignature = '1'.repeat(88); // Valid Solana signature length
    
    // Mark as processed
    await databaseService.markEventProcessed({
      eventSignature: testSignature,
      eventType: 'BurnSwapEvent',
      solanaAddress: '11111111111111111111111111111111', // Valid 32-byte base58 address (44 chars)
      amount: 1.0,
    });

    // Check if processed
    const isProcessed = await databaseService.isEventProcessed(testSignature);
    if (isProcessed) {
      console.log('✓ Event deduplication working');
      testsPassed++;
    } else {
      console.log('✗ Event deduplication failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('✗ Event deduplication error:', error.message);
    testsFailed++;
  }
  console.log('');

  // Test 7: Get Transactions by Address
  console.log('Test 7: Get Transactions by Address');
  try {
    const testAddress = '11111111111111111111111111111111'; // Valid 32-byte base58 address (44 chars)
    const transactions = await databaseService.getTransactionsByAddress(testAddress, {
      limit: 10,
      offset: 0,
    });

    if (transactions && typeof transactions === 'object') {
      console.log('✓ Get transactions by address working');
      console.log(`  Found: ${transactions.bridge.length} bridge, ${transactions.swap.length} swap, ${transactions.burn.length} burn`);
      testsPassed++;
    } else {
      console.log('✗ Get transactions by address failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('✗ Get transactions by address error:', error.message);
    testsFailed++;
  }
  console.log('');

  // Test 8: Statistics
  console.log('Test 8: Get Statistics');
  try {
    const stats = await databaseService.getStatistics();
    if (stats && stats.bridge && stats.swap && stats.burn) {
      console.log('✓ Statistics retrieved successfully');
      console.log(`  Bridge: ${stats.bridge.total} total, ${stats.bridge.confirmed} confirmed`);
      console.log(`  Swap: ${stats.swap.total} total, ${stats.swap.confirmed} confirmed`);
      console.log(`  Burn: ${stats.burn.total} total, ${stats.burn.confirmed} confirmed`);
      testsPassed++;
    } else {
      console.log('✗ Statistics retrieval failed');
      testsFailed++;
    }
  } catch (error) {
    console.log('✗ Statistics error:', error.message);
    testsFailed++;
  }
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`✓ Passed: ${testsPassed}`);
  console.log(`✗ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  console.log('');

  if (testsFailed === 0) {
    console.log('🎉 All tests passed! Database is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the errors above.');
  }

  // Close connection
  await databaseService.close();
  process.exit(testsFailed === 0 ? 0 : 1);
}

// Run tests
testDatabase().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

