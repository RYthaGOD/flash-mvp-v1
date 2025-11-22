/**
 * FLASH Bridge System Backtest
 * Comprehensive end-to-end testing of all workflows
 */

const axios = require('axios');
const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const { AnchorProvider, Program, BN } = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PROGRAM_ID = process.env.PROGRAM_ID || 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS';
const ZENZEC_MINT = process.env.ZENZEC_MINT || '';

// Test results
const results = {
  passed: 0,
  failed: 0,
  errors: [],
  warnings: [],
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function test(name, fn) {
  try {
    log(`\n[TEST] ${name}`, 'cyan');
    const result = fn();
    if (result === true || (result && result.then)) {
      if (result.then) {
        return result.then(() => {
          results.passed++;
          log(`✓ PASSED: ${name}`, 'green');
        }).catch((err) => {
          results.failed++;
          results.errors.push({ test: name, error: err.message });
          log(`✗ FAILED: ${name} - ${err.message}`, 'red');
        });
      } else {
        results.passed++;
        log(`✓ PASSED: ${name}`, 'green');
      }
    } else {
      results.failed++;
      results.errors.push({ test: name, error: 'Test returned false' });
      log(`✗ FAILED: ${name}`, 'red');
    }
  } catch (err) {
    results.failed++;
    results.errors.push({ test: name, error: err.message });
    log(`✗ FAILED: ${name} - ${err.message}`, 'red');
  }
}

async function testAsync(name, fn) {
  try {
    log(`\n[TEST] ${name}`, 'cyan');
    await fn();
    results.passed++;
    log(`✓ PASSED: ${name}`, 'green');
  } catch (err) {
    results.failed++;
    results.errors.push({ test: name, error: err.message });
    log(`✗ FAILED: ${name} - ${err.message}`, 'red');
  }
}

// Test 1: Backend Health Check
async function testBackendHealth() {
  const response = await axios.get(`${API_URL}/health`);
  if (response.data.status !== 'ok') {
    throw new Error('Backend health check failed');
  }
  log(`  Backend Status: ${response.data.status}`, 'blue');
  log(`  SOL Relayer: ${response.data.relayerActive ? 'Active' : 'Inactive'}`, 'blue');
  log(`  BTC Relayer: ${response.data.btcRelayerActive ? 'Active' : 'Inactive'}`, 'blue');
  log(`  Arcium MPC: ${response.data.arciumMPC ? 'Enabled' : 'Disabled'}`, 'blue');
  log(`  Zcash Monitoring: ${response.data.zcashMonitoring ? 'Active' : 'Inactive'}`, 'blue');
}

// Test 2: Bridge Info Endpoint
async function testBridgeInfo() {
  const response = await axios.get(`${API_URL}/api/bridge/info`);
  if (!response.data.network) {
    throw new Error('Bridge info missing network');
  }
  log(`  Network: ${response.data.network}`, 'blue');
  log(`  Program ID: ${response.data.programId}`, 'blue');
  log(`  Mint: ${response.data.mint}`, 'blue');
}

// Test 3: Zcash Info Endpoint
async function testZcashInfo() {
  const response = await axios.get(`${API_URL}/api/zcash/info`);
  if (!response.data.network) {
    throw new Error('Zcash info missing network');
  }
  log(`  Network: ${response.data.network}`, 'blue');
  log(`  Wallet Enabled: ${response.data.walletEnabled || false}`, 'blue');
}

// Test 4: Arcium Status Endpoint
async function testArciumStatus() {
  const response = await axios.get(`${API_URL}/api/arcium/status`);
  if (response.data.enabled === undefined) {
    throw new Error('Arcium status missing enabled field');
  }
  log(`  Arcium Enabled: ${response.data.enabled}`, 'blue');
}

// Test 5: SOL → zenZEC Swap Endpoint
async function testSOLToZenZECSwap() {
  const testAddress = '11111111111111111111111111111111'; // Dummy address for testing
  const response = await axios.post(`${API_URL}/api/bridge/swap-sol-to-zenzec`, {
    solanaAddress: testAddress,
    solAmount: 0.1,
    usePrivacy: false,
  });
  
  if (!response.data.success) {
    throw new Error('Swap endpoint returned success: false');
  }
  log(`  Transaction ID: ${response.data.transactionId}`, 'blue');
  log(`  SOL Amount: ${response.data.solAmount}`, 'blue');
}

// Test 6: Create Burn for BTC Transaction
async function testCreateBurnForBTC() {
  const testAddress = '11111111111111111111111111111111';
  const testBTCAddress = 'bc1qtq493cpzfu2frc2rumpm6225mafapmgl2q7auz';
  
  const response = await axios.post(`${API_URL}/api/bridge/create-burn-for-btc-tx`, {
    solanaAddress: testAddress,
    amount: 1.0,
    btcAddress: testBTCAddress,
    usePrivacy: false,
  });
  
  if (!response.data.success) {
    throw new Error('Create burn transaction returned success: false');
  }
  if (!response.data.transaction) {
    throw new Error('Transaction not returned');
  }
  log(`  Transaction created successfully`, 'blue');
  log(`  BTC Address: ${response.data.instruction.btcAddress.substring(0, 20)}...`, 'blue');
}

// Test 7: BTC Address Validation (using backend service directly)
async function testBTCAddressValidation() {
  // Note: There may not be a public endpoint for this, so we test the service logic
  const path = require('path');
  const bitcoinService = require(path.join(__dirname, '../backend/src/services/bitcoin'));
  
  const validAddresses = [
    'bc1qtq493cpzfu2frc2rumpm6225mafapmgl2q7auz', // Native SegWit
    '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', // Legacy
    '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', // P2SH
  ];
  
  let validated = 0;
  for (const addr of validAddresses) {
    if (bitcoinService.isValidAddress(addr)) {
      validated++;
    }
  }
  
  if (validated !== validAddresses.length) {
    throw new Error(`Only ${validated}/${validAddresses.length} addresses validated`);
  }
  
  log(`  Validated ${validated} valid addresses`, 'blue');
}

// Test 8: Arcium Encryption Endpoints
async function testArciumEncryption() {
  // Test amount encryption
  const amountResponse = await axios.post(`${API_URL}/api/arcium/encrypt-amount`, {
    amount: 100.5,
    recipientPubkey: '11111111111111111111111111111111',
  });
  
  if (!amountResponse.data.encrypted) {
    results.warnings.push('Arcium amount encryption not enabled (expected if MPC disabled)');
    log(`  Amount encryption: Not enabled (expected)`, 'yellow');
  } else {
    log(`  Amount encryption: Working`, 'blue');
  }
  
  // Test BTC address encryption
  const btcResponse = await axios.post(`${API_URL}/api/arcium/encrypt-btc-address`, {
    btcAddress: 'bc1qtq493cpzfu2frc2rumpm6225mafapmgl2q7auz',
    recipientPubkey: '11111111111111111111111111111111',
  });
  
  if (!btcResponse.data.encrypted) {
    results.warnings.push('Arcium BTC encryption not enabled (expected if MPC disabled)');
    log(`  BTC address encryption: Not enabled (expected)`, 'yellow');
  } else {
    log(`  BTC address encryption: Working`, 'blue');
  }
}

// Test 9: Zcash Price Endpoint
async function testZcashPrice() {
  const response = await axios.get(`${API_URL}/api/zcash/price`);
  if (!response.data.price && !response.data.cached) {
    results.warnings.push('ZEC price not available (may be rate limited)');
    log(`  ZEC Price: Not available (may be rate limited)`, 'yellow');
  } else {
    log(`  ZEC Price: $${response.data.price?.toFixed(2) || 'N/A'} ${response.data.cached ? '(cached)' : ''}`, 'blue');
  }
}

// Test 10: Solana Connection
async function testSolanaConnection() {
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  const blockHeight = await connection.getBlockHeight();
  log(`  Solana Block Height: ${blockHeight}`, 'blue');
  
  if (PROGRAM_ID) {
    try {
      const programId = new PublicKey(PROGRAM_ID);
      const accountInfo = await connection.getAccountInfo(programId);
      if (accountInfo) {
        log(`  Program Account: Found`, 'blue');
      } else {
        results.warnings.push('Program account not found (may not be deployed)');
        log(`  Program Account: Not found (may not be deployed)`, 'yellow');
      }
    } catch (err) {
      results.warnings.push(`Program account check failed: ${err.message}`);
      log(`  Program Account: Check failed`, 'yellow');
    }
  }
}

// Test 11: Environment Variables
function testEnvironmentVariables() {
  const required = [
    'SOLANA_RPC_URL',
    'PROGRAM_ID',
    'ZENZEC_MINT',
  ];
  
  const optional = [
    'SOL_TO_ZENZEC_RATE',
    'ZENZEC_TO_BTC_RATE',
    'ENABLE_BTC_RELAYER',
    'ENABLE_RELAYER',
    'ENABLE_ARCIUM_MPC',
  ];
  
  let missing = [];
  for (const varName of required) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  log(`  Required variables: All present`, 'blue');
  
  const missingOptional = [];
  for (const varName of optional) {
    if (!process.env[varName]) {
      missingOptional.push(varName);
    }
  }
  
  if (missingOptional.length > 0) {
    results.warnings.push(`Missing optional variables: ${missingOptional.join(', ')}`);
    log(`  Optional variables: ${missingOptional.length} missing`, 'yellow');
  } else {
    log(`  Optional variables: All present`, 'blue');
  }
}

// Test 12: API Endpoint Availability
async function testAPIEndpoints() {
  const endpoints = [
    { method: 'GET', path: '/health', name: 'Health Check' },
    { method: 'GET', path: '/api/bridge/info', name: 'Bridge Info' },
    { method: 'GET', path: '/api/zcash/info', name: 'Zcash Info' },
    { method: 'GET', path: '/api/arcium/status', name: 'Arcium Status' },
    { method: 'GET', path: '/api/zcash/price', name: 'Zcash Price' },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${API_URL}${endpoint.path}`);
      if (response.status === 200) {
        log(`  ${endpoint.name}: Available`, 'blue');
      } else {
        throw new Error(`Status ${response.status}`);
      }
    } catch (err) {
      if (err.response) {
        throw new Error(`${endpoint.name} returned ${err.response.status}`);
      } else {
        throw new Error(`${endpoint.name} not reachable: ${err.message}`);
      }
    }
  }
}

// Main test runner
async function runBacktest() {
  log('\n' + '='.repeat(60), 'cyan');
  log('FLASH Bridge System Backtest', 'cyan');
  log('='.repeat(60), 'cyan');
  
  log(`\nAPI URL: ${API_URL}`, 'blue');
  log(`Solana RPC: ${SOLANA_RPC_URL}`, 'blue');
  log(`Program ID: ${PROGRAM_ID}`, 'blue');
  
  // Run all tests
  await testAsync('Backend Health Check', testBackendHealth);
  await testAsync('Environment Variables', testEnvironmentVariables);
  await testAsync('API Endpoint Availability', testAPIEndpoints);
  await testAsync('Bridge Info Endpoint', testBridgeInfo);
  await testAsync('Zcash Info Endpoint', testZcashInfo);
  await testAsync('Arcium Status Endpoint', testArciumStatus);
  await testAsync('Zcash Price Endpoint', testZcashPrice);
  await testAsync('Solana Connection', testSolanaConnection);
  await testAsync('SOL → zenZEC Swap Endpoint', testSOLToZenZECSwap);
  await testAsync('Create Burn for BTC Transaction', testCreateBurnForBTC);
  await testAsync('BTC Address Validation', testBTCAddressValidation);
  await testAsync('Arcium Encryption Endpoints', testArciumEncryption);
  
  // Print summary
  log('\n' + '='.repeat(60), 'cyan');
  log('Backtest Summary', 'cyan');
  log('='.repeat(60), 'cyan');
  log(`\nTotal Tests: ${results.passed + results.failed}`, 'blue');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  
  if (results.warnings.length > 0) {
    log(`\nWarnings: ${results.warnings.length}`, 'yellow');
    results.warnings.forEach((warning, i) => {
      log(`  ${i + 1}. ${warning}`, 'yellow');
    });
  }
  
  if (results.errors.length > 0) {
    log(`\nErrors:`, 'red');
    results.errors.forEach((error, i) => {
      log(`  ${i + 1}. [${error.test}] ${error.error}`, 'red');
    });
  }
  
  log('\n' + '='.repeat(60), 'cyan');
  
  if (results.failed === 0) {
    log('✓ All tests passed!', 'green');
    process.exit(0);
  } else {
    log('✗ Some tests failed', 'red');
    process.exit(1);
  }
}

// Run backtest
if (require.main === module) {
  runBacktest().catch((err) => {
    log(`\nFatal error: ${err.message}`, 'red');
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runBacktest, test, testAsync };

