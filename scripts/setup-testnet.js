#!/usr/bin/env node

/**
 * FLASH Bridge Testnet Setup Script
 * Sets up environment for complete testnet operation
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 FLASH Bridge - Testnet Setup');
console.log('================================\n');

// Environment configuration for testnet
const testnetConfig = {
  // Privacy (Required)
  ENABLE_ARCIUM_MPC: 'true',
  ARCIUM_SIMULATED: 'true',
  ARCIUM_ENDPOINT: 'http://localhost:9090',

  // Solana Devnet
  SOLANA_RPC_URL: 'https://api.devnet.solana.com',
  SOLANA_NETWORK: 'devnet',
  PROGRAM_ID: 'MockProgramId1111111111111111111111111111111',

  // zenZEC Token
  ZENZEC_MINT: 'MockZenZecMintAddress11111111111111111111111',

  // Database
  DATABASE_PATH: './database/flash-bridge.db',

  // Bitcoin Testnet
  BITCOIN_NETWORK: 'testnet',
  BITCOIN_EXPLORER_URL: 'https://blockstream.info/testnet/api',
  BITCOIN_BRIDGE_ADDRESS: 'tb1qmockbitcoinaddress1234567890',

  // Zcash Testnet
  ZCASH_NETWORK: 'testnet',
  ZCASH_EXPLORER_URL: 'https://lightwalletd.testnet.z.cash',
  ZCASH_BRIDGE_ADDRESS: 'zs1mockzcashaddress1234567890',

  // Relayers (Disabled for demo)
  ENABLE_RELAYER: 'false',
  ENABLE_BTC_RELAYER: 'false',

  // Server
  PORT: '3001',
  NODE_ENV: 'development',

  // Frontend
  FRONTEND_URL: 'http://localhost:3000'
};

function setupTestnet() {
  const envPath = path.join(__dirname, '..', 'backend', '.env');

  console.log('📝 Creating testnet environment configuration...');

  // Convert config to .env format
  let envContent = '# FLASH Bridge Testnet Configuration\n';
  envContent += '# Auto-generated for complete testnet operation\n\n';

  for (const [key, value] of Object.entries(testnetConfig)) {
    envContent += `${key}=${value}\n`;
  }

  try {
    // Check if .env file exists
    if (fs.existsSync(envPath)) {
      console.log('⚠️  .env file already exists. Backing up...');
      const backupPath = `${envPath}.backup`;
      fs.copyFileSync(envPath, backupPath);
      console.log(`✅ Backup created: .env.backup`);
    }

    // Write the new .env file
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✅ Testnet configuration created successfully!');
    console.log(`📍 Location: ${envPath}`);

    console.log('\n🔧 Testnet Configuration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Privacy: Arcium MPC (Simulated)');
    console.log('✅ Solana: Devnet RPC');
    console.log('✅ Bitcoin: Testnet3');
    console.log('✅ Zcash: Testnet');
    console.log('✅ Database: SQLite (./database/flash-bridge.db)');
    console.log('✅ Relayers: Disabled (Demo mode)');

    console.log('\n🎯 Next Steps:');
    console.log('1. Start backend: cd backend && npm start');
    console.log('2. Start frontend: cd frontend && npm start (new terminal)');
    console.log('3. Open http://localhost:3000');
    console.log('4. Run the complete BTC → zenZEC demo!');

  } catch (error) {
    console.error('❌ Failed to create testnet configuration:', error.message);
    process.exit(1);
  }
}

function validateSetup() {
  console.log('\n🔍 Validating testnet setup...');

  const required = ['ENABLE_ARCIUM_MPC', 'SOLANA_RPC_URL', 'BITCOIN_NETWORK'];
  const envPath = path.join(__dirname, '..', 'backend', '.env');

  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found!');
    return false;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split('\n').forEach(line => {
    if (line.includes('=')) {
      const [key, value] = line.split('=');
      envVars[key.trim()] = value.trim();
    }
  });

  let valid = true;
  required.forEach(key => {
    if (!envVars[key]) {
      console.error(`❌ Missing required: ${key}`);
      valid = false;
    } else {
      console.log(`✅ ${key}: ${envVars[key]}`);
    }
  });

  return valid;
}

// Run setup
setupTestnet();

if (validateSetup()) {
  console.log('\n🎉 Testnet setup complete! Ready for demo.');
} else {
  console.error('\n❌ Setup validation failed!');
  process.exit(1);
}
