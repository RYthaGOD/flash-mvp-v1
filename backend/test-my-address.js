// Load environment variables
require('dotenv').config();

const bitcoinService = require('./src/services/bitcoin');

async function testMyAddress() {
  console.log('🧪 Testing Your Bridge Address Setup\n');
  console.log('='.repeat(60));
  
  try {
    // Initialize service
    await bitcoinService.initialize();
    
    // Get your bridge address
    const address = bitcoinService.getBridgeAddress();
    console.log(`✅ Bridge Address: ${address}`);
    console.log(`✅ Network: ${bitcoinService.network}`);
    
    // Validate address
    const isValid = bitcoinService.isValidAddress(address);
    console.log(`✅ Address Valid: ${isValid}\n`);
    
    if (!isValid) {
      console.log('❌ ERROR: Address validation failed!');
      process.exit(1);
    }
    
    // Check for transactions
    console.log('📊 Checking for deposits...');
    console.log('   (This may take a few seconds...)');
    
    try {
      const txs = await bitcoinService.getAddressTransactions(address);
      console.log(`\n   Found ${txs.length} total transactions\n`);
      
      // Check for confirmed deposits
      let confirmedDeposits = 0;
      let pendingDeposits = 0;
      
      for (const tx of txs) {
        const amount = bitcoinService.extractAmountToAddress(tx, address);
        if (amount > 0) {
          const confirmations = tx.status?.confirmations || 0;
          
          if (confirmations >= 6) {
            confirmedDeposits++;
            console.log(`   ✅ Deposit #${confirmedDeposits} (Ready to process):`);
            console.log(`      Amount: ${amount / 100000000} BTC`);
            console.log(`      TX: ${tx.txid}`);
            console.log(`      Confirmations: ${confirmations}`);
            console.log(`      Block: ${tx.status?.block_height || 'N/A'}`);
            console.log(`      Status: ✅ Ready to process via /api/bridge/btc-deposit\n`);
          } else if (confirmations > 0) {
            pendingDeposits++;
            console.log(`   ⏳ Deposit #${pendingDeposits} (Pending confirmations):`);
            console.log(`      Amount: ${amount / 100000000} BTC`);
            console.log(`      TX: ${tx.txid}`);
            console.log(`      Confirmations: ${confirmations}/6`);
            console.log(`      Status: ⏳ Waiting for ${6 - confirmations} more confirmations\n`);
          }
        }
      }
      
      if (confirmedDeposits === 0 && pendingDeposits === 0) {
        console.log('   ℹ️  No deposits found yet');
        console.log('   📝 Next steps:');
        console.log('      1. Get testnet BTC from: https://mempool.space/testnet/faucet');
        console.log('      2. Send to: ' + address);
        console.log('      3. Wait for 6+ confirmations (~60 min on testnet)');
        console.log('      4. Run this script again to verify detection');
        console.log('      5. Process via: POST /api/bridge/btc-deposit\n');
      } else {
        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Ready to process: ${confirmedDeposits}`);
        console.log(`   ⏳ Pending confirmations: ${pendingDeposits}`);
      }
      
    } catch (error) {
      console.error('   ❌ Error checking transactions:', error.message);
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        console.log('   💡 Tip: Check your internet connection and explorer URL');
      }
    }
    
    // Show explorer link
    let explorerUrl;
    if (bitcoinService.network === 'testnet4') {
      explorerUrl = `https://mempool.space/testnet4/address/${address}`;
    } else if (bitcoinService.network === 'testnet') {
      explorerUrl = `https://blockstream.info/testnet/address/${address}`;
    } else {
      explorerUrl = `https://blockstream.info/address/${address}`;
    }
    
    console.log('\n🔍 View on explorer:');
    console.log(`   ${explorerUrl}\n`);
    
    console.log('✅ Setup verified!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testMyAddress().catch(console.error);

