#!/usr/bin/env node

/**
 * Claim BTC Deposit - Quick Test Script
 */

const axios = require('axios');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const BITCOIN_TX_HASH = process.argv[2] || '876655c9f0a2e797b6eab42e32039f8a1f84f31f2125159356ec9b6e0e6e3bf1';
const SOLANA_ADDRESS = process.argv[3] || 'J6337EyaWK5A6QL8cMcrHWVGz7Ri8MdhYxD2oQHbHCfi';

async function claimDeposit() {
  console.log('\n🚀 Claiming BTC Deposit...\n');
  console.log(`Bitcoin TX: ${BITCOIN_TX_HASH}`);
  console.log(`Solana Address: ${SOLANA_ADDRESS}`);
  console.log(`API URL: ${API_URL}\n`);

  try {
    const response = await axios.post(`${API_URL}/api/bridge/btc-deposit`, {
      solanaAddress: SOLANA_ADDRESS,
      bitcoinTxHash: BITCOIN_TX_HASH,
    }, {
      timeout: 60000, // 60 second timeout
    });

    const data = response.data;
    
      console.log('\n✅ Deposit Claimed Successfully!\n');
      console.log('📊 Result:');
      console.log(`   BTC Amount: ${data.btcAmount} BTC`);
      if (data.testMode) {
        console.log(`   SOL Amount: ${data.solAmount} SOL (TEST MODE - direct transfer)`);
      } else {
        console.log(`   USDC Equivalent: ${data.usdcAmount} USDC`);
      }
      console.log(`   Output Token: ${data.outputToken}`);
      console.log(`   Solana TX Signature: ${data.swapSignature}`);
      console.log(`\n🔗 View on Solscan:`);
      console.log(`   https://solscan.io/tx/${data.swapSignature}?cluster=devnet`);
    
    return data;
  } catch (error) {
    console.error('\n❌ Error claiming deposit:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      const errorData = error.response.data;
      console.error(`   Error: ${JSON.stringify(errorData, null, 2)}`);
      
      // Show verification reason if available
      if (errorData.details && errorData.details.reason) {
        console.error(`\n   Verification Reason: ${errorData.details.reason}`);
        if (errorData.details.confirmations !== undefined) {
          console.error(`   Confirmations: ${errorData.details.confirmations}`);
        }
      }
    } else if (error.request) {
      console.error(`   Request failed: ${error.message}`);
      console.error(`   Is the server running at ${API_URL}?`);
    } else {
      console.error(`   ${error.message}`);
    }
    throw error;
  }
}

claimDeposit()
  .then(() => {
    console.log('\n✅ Complete workflow test finished!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed\n');
    process.exit(1);
  });

