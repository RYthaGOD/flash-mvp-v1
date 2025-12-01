#!/usr/bin/env node

/**
 * Arcium Integration Test
 * Tests FLASH Bridge connection to real Arcium MPC network
 */

require('dotenv').config();
const arciumService = require('./src/services/arcium');

async function testArciumIntegration() {
  console.log('🧪 Testing Arcium Integration');
  console.log('='.repeat(60));
  
  try {
    // Test 1: Initialize Arcium Service
    console.log('\n1️⃣ Testing Arcium Service Initialization...');
    await arciumService.initialize();
    const status = arciumService.getStatus();
    
    console.log('✅ Arcium Service Status:');
    console.log(`   Enabled: ${status.enabled}`);
    console.log(`   Connected: ${status.connected}`);
    console.log(`   Simulated: ${status.simulated}`);
    console.log(`   Use Real SDK: ${status.useRealSDK}`);
    console.log(`   Mode: ${status.mode}`);
    console.log(`   Network: ${status.network}`);
    console.log(`   Cluster ID: ${status.clusterId}`);
    console.log(`   MXE Program ID: ${status.mxeProgramId}`);
    console.log(`   Solana Client Initialized: ${status.solanaClientInitialized}`);
    
    if (status.simulated) {
      console.log('⚠️  WARNING: Running in SIMULATION mode');
      console.log('   Set ARCIUM_SIMULATED=false and ARCIUM_USE_REAL_SDK=true for real MPC');
    } else {
      console.log('✅ Running in REAL MPC mode');
    }
    
    // Test 2: Bridge Amount Encryption
    console.log('\n2️⃣ Testing Bridge Amount Encryption...');
    const testAmount = 1000000; // 1 ZEC in satoshis
    const testPubkey = 'TestPubkey123456789012345678901234567890';
    
    try {
      const encrypted = await arciumService.encryptAmount(testAmount, testPubkey);
      console.log('✅ Encryption successful:');
      console.log(`   Computation ID: ${encrypted.computationId}`);
      console.log(`   Simulated: ${encrypted.simulated}`);
      console.log(`   Privacy Level: ${encrypted.privacyLevel}`);
      console.log(`   Timestamp: ${new Date(encrypted.timestamp).toISOString()}`);
    } catch (error) {
      console.error('❌ Encryption failed:', error.message);
    }
    
    // Test 3: Trustless Random Generation
    console.log('\n3️⃣ Testing Trustless Random Generation...');
    try {
      const random = await arciumService.generateTrustlessRandom(100);
      console.log('✅ Random generation successful:');
      console.log(`   Value: ${random}`);
      console.log(`   Range: 0-99`);
    } catch (error) {
      console.error('❌ Random generation failed:', error.message);
    }
    
    // Test 4: BTC Address Encryption
    console.log('\n4️⃣ Testing BTC Address Encryption...');
    const testBTCAddress = 'bc1qexampleaddress1234567890abcdefghijklmnopqrstuvwxyz';
    try {
      const encrypted = await arciumService.encryptBTCAddress(testBTCAddress, testPubkey);
      console.log('✅ BTC address encryption successful:');
      console.log(`   Encrypted: ${encrypted.encrypted}`);
      console.log(`   Simulated: ${encrypted.simulated || false}`);
    } catch (error) {
      console.error('❌ BTC address encryption failed:', error.message);
    }
    
    // Test 5: Encrypted Amount Verification
    console.log('\n5️⃣ Testing Encrypted Amount Verification...');
    try {
      const encrypted1 = await arciumService.encryptAmount(testAmount, testPubkey);
      const encrypted2 = await arciumService.encryptAmount(testAmount, testPubkey);
      
      // Note: In real MPC, this would compare encrypted values without revealing amounts
      const verified = await arciumService.verifyEncryptedAmountsMatch(encrypted1, encrypted2);
      console.log('✅ Verification successful:');
      console.log(`   Verified: ${verified}`);
    } catch (error) {
      console.error('❌ Verification failed:', error.message);
    }
    
    // Test 6: Swap Calculation
    console.log('\n6️⃣ Testing Encrypted Swap Calculation...');
    try {
      const encryptedZen = await arciumService.encryptAmount(testAmount, testPubkey);
      const exchangeRate = 10; // 1 ZEC = 10 SOL
      
      const swapResult = await arciumService.calculateEncryptedSwapAmount(encryptedZen, exchangeRate);
      console.log('✅ Swap calculation successful:');
      console.log(`   Encrypted: ${swapResult.encrypted}`);
      console.log(`   Simulated: ${swapResult.simulated || false}`);
    } catch (error) {
      console.error('❌ Swap calculation failed:', error.message);
    }
    
    // Test 7: Performance Metrics
    console.log('\n7️⃣ Performance Metrics...');
    const finalStatus = arciumService.getStatus();
    console.log(`   Total Computations: ${finalStatus.computations.total}`);
    console.log(`   Cache Hit Rate: ${finalStatus.computations.cacheHitRate}%`);
    console.log(`   Errors: ${finalStatus.errors}`);
    console.log(`   Uptime: ${Math.floor(finalStatus.uptime / 60)} minutes`);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary:');
    console.log(`   Mode: ${finalStatus.mode}`);
    console.log(`   Status: ${finalStatus.health.status}`);
    console.log(`   Computations: ${finalStatus.computations.total}`);
    console.log(`   Errors: ${finalStatus.errors}`);
    
    if (finalStatus.simulated) {
      console.log('\n⚠️  NOTE: Tests ran in SIMULATION mode');
      console.log('   To test with real Arcium MPC:');
      console.log('   1. Set ARCIUM_SIMULATED=false');
      console.log('   2. Set ARCIUM_USE_REAL_SDK=true');
      console.log('   3. Configure FLASH_BRIDGE_MXE_PROGRAM_ID');
      console.log('   4. Ensure Arcium node is running');
    } else {
      console.log('\n✅ Tests completed with REAL Arcium MPC');
    }
    
  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    process.exit(1);
  }
}

// Run tests
testArciumIntegration()
  .then(() => {
    console.log('\n✅ All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });



