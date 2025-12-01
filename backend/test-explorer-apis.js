const axios = require('axios');

const testAddress = 'tb1qug4w70zdr40clj9qecy67tx58e24lk90whzy9l';

const explorers = [
  {
    name: 'Mempool.space Testnet4',
    url: 'https://mempool.space/testnet4/api'
  },
  {
    name: 'Blockstream.info Testnet4',
    url: 'https://blockstream.info/testnet4/api'
  },
  {
    name: 'Mempool.space Testnet (testnet3)',
    url: 'https://mempool.space/testnet/api'
  },
  {
    name: 'Blockstream.info Testnet (testnet3)',
    url: 'https://blockstream.info/testnet/api'
  }
];

async function testExplorer(explorer) {
  try {
    console.log(`\n🧪 Testing ${explorer.name}...`);
    console.log(`   URL: ${explorer.url}`);
    
    const testUrl = `${explorer.url}/address/${testAddress}`;
    const response = await axios.get(testUrl, {
      timeout: 10000,
      validateStatus: () => true // Don't throw on any status
    });
    
    if (response.status === 200) {
      console.log(`   ✅ Status: ${response.status} - WORKS!`);
      console.log(`   📊 Response type: ${Array.isArray(response.data) ? 'Array' : typeof response.data}`);
      if (Array.isArray(response.data)) {
        console.log(`   📝 Transactions found: ${response.data.length}`);
      }
      return { success: true, explorer };
    } else {
      console.log(`   ❌ Status: ${response.status} - Failed`);
      return { success: false, explorer, status: response.status };
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.log(`   ❌ Connection failed: ${error.message}`);
    } else if (error.response) {
      console.log(`   ❌ HTTP ${error.response.status}: ${error.response.statusText}`);
    } else {
      console.log(`   ❌ Error: ${error.message}`);
    }
    return { success: false, explorer, error: error.message };
  }
}

async function testAllExplorers() {
  console.log('🔍 Testing Bitcoin Explorer APIs for Testnet4');
  console.log('='.repeat(60));
  console.log(`Test Address: ${testAddress}\n`);
  
  const results = [];
  
  for (const explorer of explorers) {
    const result = await testExplorer(explorer);
    results.push(result);
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Results Summary:');
  console.log('='.repeat(60));
  
  const working = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (working.length > 0) {
    console.log('\n✅ Working Explorers:');
    working.forEach(r => {
      console.log(`   • ${r.explorer.name}`);
      console.log(`     URL: ${r.explorer.url}`);
    });
    
    // Recommend the first working one
    const recommended = working[0];
    console.log('\n💡 Recommended Configuration:');
    console.log(`   BITCOIN_NETWORK=testnet4`);
    console.log(`   BITCOIN_EXPLORER_URL=${recommended.explorer.url}`);
  } else {
    console.log('\n❌ No working explorers found!');
    console.log('   This might mean:');
    console.log('   - Testnet4 APIs are not available');
    console.log('   - Network connectivity issues');
    console.log('   - Address has no transactions yet (but API should still respond)');
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed Explorers:');
    failed.forEach(r => {
      console.log(`   • ${r.explorer.name}: ${r.error || `HTTP ${r.status}` || 'Unknown error'}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
}

testAllExplorers().catch(console.error);

