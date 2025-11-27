#!/usr/bin/env node
/**
 * Configuration Checker
 * Run this before starting the server to verify setup
 * Usage: node check-config.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║       FLASH Bridge - Configuration Check                 ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

let allGood = true;
let warnings = 0;

// Check .env file exists
console.log('📋 Checking .env file...');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('   ✅ .env file found\n');
} else {
  console.log('   ❌ .env file NOT found');
  console.log('   💡 Create .env file in backend/ directory\n');
  allGood = false;
}

// Check critical: Arcium MPC
console.log('🔒 Checking Privacy Configuration...');
const arciumEnabled = process.env.ENABLE_ARCIUM_MPC;
if (arciumEnabled === 'true') {
  console.log('   ✅ ENABLE_ARCIUM_MPC = true');
  console.log('   ℹ️  Privacy mode: Simulated (MVP)\n');
} else {
  console.log('   ❌ ENABLE_ARCIUM_MPC not set or false');
  console.log('   💡 Add to .env: ENABLE_ARCIUM_MPC=true');
  console.log('   ℹ️  For MVP: Enables simulated privacy\n');
  allGood = false;
}

// Check optional: Solana
console.log('⚡ Checking Solana Configuration...');
const solanaRpc = process.env.SOLANA_RPC_URL;
if (solanaRpc) {
  console.log(`   ✅ SOLANA_RPC_URL = ${solanaRpc}`);
} else {
  console.log('   ⚠️  SOLANA_RPC_URL not set');
  console.log('   📍 Default: http://127.0.0.1:8899');
  warnings++;
}

const zenzecMint = process.env.ZENZEC_MINT;
if (zenzecMint && zenzecMint !== 'YourZenZECMintAddressHere') {
  console.log(`   ✅ ZENZEC_MINT configured`);
} else {
  console.log('   ⚠️  ZENZEC_MINT not configured');
  console.log('   📍 Demo mode: Will generate mock transactions');
  console.log('   💡 Create mint: npm run create-mint');
  warnings++;
}
console.log('');

// Check optional: Database
console.log('💾 Checking Database Configuration...');
const dbPath = process.env.DATABASE_PATH || './database/flash-bridge.db';
const dbDir = path.dirname(path.join(__dirname, dbPath));
if (fs.existsSync(dbDir)) {
  console.log(`   ✅ Database directory exists: ${dbDir}`);
} else {
  console.log(`   ⚠️  Database directory missing: ${dbDir}`);
  console.log(`   💡 Create: mkdir -p ${dbDir}`);
  warnings++;
}
console.log('');

// Check optional: Bitcoin/Zcash
console.log('₿ Checking Crypto Configuration...');
const btcNetwork = process.env.BITCOIN_NETWORK || 'testnet';
const btcAddress = process.env.BITCOIN_BRIDGE_ADDRESS;
console.log(`   Bitcoin Network: ${btcNetwork}`);
console.log(`   Bitcoin Bridge: ${btcAddress ? '✅ Configured' : '⚠️  Not configured (demo mode)'}`);

const zcashNetwork = process.env.ZCASH_NETWORK || 'testnet';
const zcashAddress = process.env.ZCASH_BRIDGE_ADDRESS;
console.log(`   Zcash Network: ${zcashNetwork}`);
console.log(`   Zcash Bridge: ${zcashAddress ? '✅ Configured' : '⚠️  Not configured (demo mode)'}`);
console.log('');

// Summary
console.log('═'.repeat(60));
if (allGood) {
  console.log('✅ READY TO START!');
  console.log('');
  console.log('Run: npm start');
  if (warnings > 0) {
    console.log('');
    console.log(`ℹ️  ${warnings} optional configuration(s) - demo mode features enabled`);
  }
} else {
  console.log('❌ CONFIGURATION INCOMPLETE');
  console.log('');
  console.log('Quick fix:');
  console.log('  1. Create .env file: cp .env.example .env  (or see ENV_SETUP.md)');
  console.log('  2. Add: ENABLE_ARCIUM_MPC=true');
  console.log('  3. Run this check again: node check-config.js');
  console.log('');
  console.log('Full guide: See QUICK_START.md');
}
console.log('═'.repeat(60));

process.exit(allGood ? 0 : 1);

