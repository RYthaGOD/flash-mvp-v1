#!/usr/bin/env node
/**
 * Testnet Configuration Checker
 * Validates all environment variables are properly configured for Arcium testnet deployment
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Apply same defaults as index.js to ensure consistency
process.env.ENABLE_ARCIUM_MPC = process.env.ENABLE_ARCIUM_MPC || 'true';
process.env.ARCIUM_SIMULATED = process.env.ARCIUM_SIMULATED || 'true';
process.env.SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
process.env.SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'devnet';
process.env.BITCOIN_NETWORK = process.env.BITCOIN_NETWORK || 'testnet';
process.env.ZCASH_NETWORK = process.env.ZCASH_NETWORK || 'testnet';
process.env.ARCIUM_NETWORK = process.env.ARCIUM_NETWORK || 'testnet';
process.env.ARCIUM_ENDPOINT = process.env.ARCIUM_ENDPOINT || 'http://localhost:8080';

const ConfigValidator = require('./src/utils/configValidator');

console.log('🔍 Checking Testnet Configuration...\n');

const errors = [];
const warnings = [];
const info = [];

// ============================================================================
// CRITICAL CHECKS
// ============================================================================

// 1. Check FLASH_BRIDGE_MXE_PROGRAM_ID
if (!process.env.FLASH_BRIDGE_MXE_PROGRAM_ID || process.env.FLASH_BRIDGE_MXE_PROGRAM_ID === 'YOUR_FLASH_BRIDGE_MXE_PROGRAM_ID_HERE') {
  errors.push('❌ FLASH_BRIDGE_MXE_PROGRAM_ID is not set or still has placeholder value');
  errors.push('   → This is REQUIRED for Arcium testnet deployment');
  errors.push('   → Set it to your deployed flash-bridge-mxe program ID');
} else {
  info.push('✅ FLASH_BRIDGE_MXE_PROGRAM_ID is set: ' + process.env.FLASH_BRIDGE_MXE_PROGRAM_ID);
}

// 2. Check IDL file exists
const idlPath = path.join(__dirname, '..', 'flash-bridge-mxe', 'target', 'idl', 'flash_bridge_mxe.json');
if (!fs.existsSync(idlPath)) {
  warnings.push('⚠️  IDL file not found at: ' + idlPath);
  warnings.push('   → Run: cd flash-bridge-mxe && anchor build');
} else {
  info.push('✅ IDL file found: ' + idlPath);
}

// 3. Check relayer keypair if relayers enabled
if (process.env.ENABLE_RELAYER === 'true' || process.env.ENABLE_BTC_RELAYER === 'true') {
  const keypairPath = process.env.RELAYER_KEYPAIR_PATH || path.join(__dirname, 'relayer-keypair-new.json');
  if (!fs.existsSync(keypairPath)) {
    errors.push('❌ Relayer keypair not found at: ' + keypairPath);
    errors.push('   → Required when ENABLE_RELAYER or ENABLE_BTC_RELAYER is true');
  } else {
    info.push('✅ Relayer keypair found: ' + keypairPath);
  }
}

// 4. Check database if configured
if (process.env.DB_HOST) {
  if (!process.env.DB_PASSWORD) {
    warnings.push('⚠️  DB_PASSWORD not set (database may not connect)');
  } else {
    info.push('✅ Database password is configured');
  }
}

// ============================================================================
// RECOMMENDED CHECKS
// ============================================================================

// 5. Check native ZEC configuration
if (process.env.USE_NATIVE_ZEC !== 'false') {
  const nativeZECMint = process.env.NATIVE_ZEC_MINT || process.env.ZEC_MINT;
  if (!nativeZECMint) {
    warnings.push('⚠️  NATIVE_ZEC_MINT not set (will use default)');
  } else if (nativeZECMint === 'A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS') {
    info.push('✅ Using official native ZEC mint address');
  } else {
    info.push('ℹ️  Using custom ZEC mint: ' + nativeZECMint);
  }
}

// 6. Check Arcium configuration
if (process.env.ENABLE_ARCIUM_MPC === 'true') {
  if (process.env.ARCIUM_SIMULATED === 'true') {
    info.push('✅ Arcium MPC enabled (simulated mode - good for testnet)');
  } else {
    if (!process.env.ARCIUM_API_KEY) {
      warnings.push('⚠️  ARCIUM_API_KEY not set (may be optional for local Docker node)');
    } else {
      info.push('✅ Arcium real MPC configured');
    }
  }
  
  // 6.5. Check Arcium Docker node connectivity
  if (process.env.ARCIUM_SIMULATED === 'false') {
    if (process.env.ARCIUM_ENDPOINT) {
      const endpoint = process.env.ARCIUM_ENDPOINT;
      if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) {
        info.push(`ℹ️  Arcium endpoint configured: ${endpoint} (local Docker node)`);
        info.push(`   → Note: Arcium works through Solana program calls, not direct HTTP`);
        info.push(`   → Docker node is running on port 8080 (verified)`);
        
        // Warn if using port 9090 instead of 8080 (Docker default)
        if (endpoint.includes(':9090')) {
          warnings.push(`⚠️  Arcium endpoint uses port 9090, but Docker node typically uses 8080`);
          warnings.push(`   → Check your Docker port mapping: docker ps | grep arx-node`);
          warnings.push(`   → Update ARCIUM_ENDPOINT=http://localhost:8080 if your node uses port 8080`);
        }
      } else {
        info.push(`ℹ️  Arcium endpoint configured: ${endpoint} (remote node)`);
      }
      
      // Check if required cluster/node config is set
      if (!process.env.ARCIUM_CLUSTER_ID) {
        warnings.push('⚠️  ARCIUM_CLUSTER_ID not set (may be required for Docker node)');
      }
    } else {
      errors.push('❌ ARCIUM_ENDPOINT not set (required when using real Docker node)');
      errors.push('   → Set ARCIUM_ENDPOINT=http://localhost:8080 (or your Docker node port)');
    }
    
    if (process.env.ARCIUM_USE_REAL_SDK !== 'true') {
      warnings.push('⚠️  ARCIUM_USE_REAL_SDK should be true when using Docker node');
    }
  }
} else {
  warnings.push('⚠️  ENABLE_ARCIUM_MPC is false (privacy features disabled)');
}

// 7. Check network configurations
const networks = {
  SOLANA_NETWORK: process.env.SOLANA_NETWORK || 'devnet',
  BITCOIN_NETWORK: process.env.BITCOIN_NETWORK || 'testnet',
  ZCASH_NETWORK: process.env.ZCASH_NETWORK || 'testnet',
  ARCIUM_NETWORK: process.env.ARCIUM_NETWORK || 'testnet',
};

info.push('\n📡 Network Configuration:');
for (const [key, value] of Object.entries(networks)) {
  if (value.includes('testnet') || value.includes('devnet')) {
    info.push(`   ✅ ${key}=${value} (testnet ready)`);
  } else if (value.includes('mainnet')) {
    warnings.push(`⚠️  ${key}=${value} (MAINNET - double check!)`);
  } else {
    info.push(`   ℹ️  ${key}=${value}`);
  }
}

// 8. Check BTC relayer (hybrid automation)
if (process.env.ENABLE_BTC_RELAYER === 'true') {
  info.push('✅ BTC Relayer enabled (hybrid automation for redemptions)');
  if (!process.env.RELAYER_KEYPAIR_PATH) {
    warnings.push('⚠️  RELAYER_KEYPAIR_PATH not set (BTC relayer may not work)');
  }
} else {
  warnings.push('⚠️  ENABLE_BTC_RELAYER is false (BTC redemptions require manual API calls)');
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('CONFIGURATION CHECK RESULTS');
console.log('='.repeat(70));

if (errors.length > 0) {
  console.log('\n❌ ERRORS (Must fix before deployment):');
  errors.forEach(err => console.log('   ' + err));
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS (Recommended to fix):');
  warnings.forEach(warn => console.log('   ' + warn));
}

if (info.length > 0) {
  console.log('\n✅ INFO:');
  info.forEach(i => console.log('   ' + i));
}

console.log('\n' + '='.repeat(70));

// Run standard config validator
console.log('\n🔍 Running standard config validator...\n');
const validationResult = ConfigValidator.validate(false);
ConfigValidator.logResults(validationResult);

// Final status
if (errors.length === 0 && validationResult.valid) {
  console.log('\n✅ Configuration check PASSED - Ready for testnet deployment!');
  process.exit(0);
} else {
  console.log('\n❌ Configuration check FAILED - Please fix errors above');
  process.exit(1);
}

