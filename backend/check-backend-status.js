// Quick script to verify backend setup and readiness
require('dotenv').config();
const axios = require('axios');

const API_URL = 'http://localhost:3001';

async function checkBackendStatus() {
  console.log('🔍 Checking Backend Status...\n');
  console.log('='.repeat(60));

  // Check 1: Server Health
  console.log('1️⃣  Checking server health...');
  try {
    const healthResponse = await axios.get(`${API_URL}/health`, { timeout: 2000 });
    console.log('   ✅ Backend is running!');
    console.log(`   Status: ${healthResponse.data.status || 'OK'}`);
  } catch (error) {
    console.log('   ❌ Backend is not running or not accessible');
    console.log(`   Error: ${error.message}`);
    console.log('\n   💡 Make sure backend is started: npm start');
    return;
  }

  // Check 2: Bridge Info
  console.log('\n2️⃣  Checking bridge configuration...');
  try {
    const bridgeInfo = await axios.get(`${API_URL}/api/bridge/info`, { timeout: 2000 });
    console.log('   ✅ Bridge info retrieved');
    if (bridgeInfo.data.bridgeAddress) {
      console.log(`   Bridge Address: ${bridgeInfo.data.bridgeAddress}`);
    }
  } catch (error) {
    console.log('   ⚠️  Could not retrieve bridge info');
    console.log(`   Error: ${error.message}`);
  }

  // Check 3: Environment Configuration
  console.log('\n3️⃣  Checking environment configuration...');
  const requiredVars = {
    'BITCOIN_NETWORK': process.env.BITCOIN_NETWORK,
    'BITCOIN_BRIDGE_ADDRESS': process.env.BITCOIN_BRIDGE_ADDRESS,
    'BITCOIN_EXPLORER_URL': process.env.BITCOIN_EXPLORER_URL,
    'ENABLE_BITCOIN_MONITORING': process.env.ENABLE_BITCOIN_MONITORING,
  };

  let allConfigured = true;
  for (const [key, value] of Object.entries(requiredVars)) {
    if (value) {
      console.log(`   ✅ ${key}: ${value}`);
    } else {
      console.log(`   ❌ ${key}: NOT SET`);
      allConfigured = false;
    }
  }

  // Check 4: Bitcoin Service
  console.log('\n4️⃣  Testing Bitcoin service...');
  try {
    const bitcoinService = require('./src/services/bitcoin');
    await bitcoinService.initialize();
    const info = bitcoinService.getNetworkInfo();
    console.log('   ✅ Bitcoin service initialized');
    console.log(`   Network: ${info.network}`);
    console.log(`   Bridge Address: ${info.bridgeAddress || 'NOT SET'}`);
    console.log(`   Reserve: ${info.currentReserveBTC} BTC`);
    
    if (process.env.ENABLE_BITCOIN_MONITORING === 'true' && info.bridgeAddress) {
      console.log('   ✅ Monitoring should be active');
    } else {
      console.log('   ⚠️  Monitoring may not be active');
    }
  } catch (error) {
    console.log('   ❌ Bitcoin service error');
    console.log(`   Error: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log('='.repeat(60));
  
  if (allConfigured) {
    console.log('✅ Configuration looks good!');
    console.log('\n💡 Next steps:');
    console.log('   1. Send 0.0001 testnet4 BTC to your bridge address');
    console.log('   2. Wait for 6+ confirmations');
    console.log('   3. Check backend logs for detection');
    console.log('   4. Claim via: POST /api/bridge/btc-deposit');
  } else {
    console.log('⚠️  Some configuration is missing');
    console.log('   Check your .env file and restart the backend');
  }
}

checkBackendStatus().catch(console.error);





