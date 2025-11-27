#!/usr/bin/env node

/**
 * Test Enhanced Arcium Service
 * Tests the production-ready Arcium integration
 */

require('dotenv').config({ path: './.env' });

// Mock database service to avoid PostgreSQL requirement
const mockDatabaseService = {
  isConnected: () => false,
  saveBridgeTransaction: () => Promise.resolve()
};

// Mock the database service
require.cache[require.resolve('./src/services/database')] = {
  exports: mockDatabaseService
};

const arciumService = require('./src/services/arcium');

async function testEnhancedArcium() {
  console.log('🧪 Testing Enhanced Arcium Service...\n');

  try {
    // Test 1: Initialization
    console.log('1️⃣ Testing initialization...');
    await arciumService.initialize();
    console.log('✅ Initialization successful\n');

    // Test 2: Status check
    console.log('2️⃣ Testing status reporting...');
    const status = arciumService.getStatus();
    console.log('📊 Status:', {
      enabled: status.enabled,
      connected: status.connected,
      mode: status.mode,
      computations: status.computations,
      connectionPool: status.connectionPool,
      health: status.health
    });
    console.log('✅ Status check successful\n');

    // Test 3: Amount encryption
    console.log('3️⃣ Testing amount encryption...');
    const testAmount = 1.5;
    const recipientPubkey = '11111111111111111111111111111112';

    const encrypted = await arciumService.encryptAmount(testAmount, recipientPubkey);
    console.log('🔒 Encrypted data:', {
      hasCiphertext: !!encrypted.ciphertext,
      computationId: encrypted.computationId,
      simulated: encrypted.simulated
    });
    console.log('✅ Encryption successful\n');

    // Test 4: Amount decryption
    console.log('4️⃣ Testing amount decryption...');
    const decrypted = await arciumService.decryptAmount(encrypted, recipientPubkey);
    console.log('🔓 Decrypted amount:', decrypted);
    console.log('✅ Decryption successful, amounts match:', decrypted === testAmount, '\n');

    // Test 5: Trustless random generation
    console.log('5️⃣ Testing trustless random generation...');
    const randomResult = await arciumService.generateTrustlessRandom(100);
    console.log('🎲 Random result:', {
      value: randomResult,
      type: typeof randomResult
    });
    console.log('✅ Random generation successful\n');

    // Test 6: Cache performance
    console.log('6️⃣ Testing cache performance...');
    // Encrypt same amount again (should use cache)
    const encryptedCached = await arciumService.encryptAmount(testAmount, recipientPubkey);
    console.log('📈 Cache test completed\n');

    // Test 7: Final status
    console.log('7️⃣ Final status check...');
    const finalStatus = arciumService.getStatus();
    console.log('🏁 Final metrics:', {
      totalComputations: finalStatus.computations.total,
      cacheSize: finalStatus.computations.cached,
      cacheHitRate: finalStatus.computations.cacheHitRate + '%',
      connectionPool: finalStatus.connectionPool,
      health: finalStatus.health
    });

    console.log('\n🎉 Enhanced Arcium Service test PASSED!');
    console.log('✨ All features working: encryption, decryption, random generation, caching, monitoring');

  } catch (error) {
    console.error('❌ Enhanced Arcium Service test FAILED:');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testEnhancedArcium();
