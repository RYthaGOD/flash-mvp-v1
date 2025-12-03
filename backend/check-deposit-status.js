#!/usr/bin/env node

/**
 * Check Deposit Status - Detailed View
 */

const axios = require('./axiosClient');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TX_HASH = process.argv[2] || '876655c9f0a2e797b6eab42e32039f8a1f84f31f2125159356ec9b6e0e6e3bf1';

async function checkStatus() {
  console.log('\n🔍 Checking Deposit Status...\n');
  
  try {
    // Check via API
    const response = await axios.get(`${API_URL}/api/bridge/check-btc-deposits`);
    const data = response.data;
    
    console.log('📊 Summary:');
    console.log(`   Total: ${data.summary.total}`);
    console.log(`   Confirmed: ${data.summary.confirmed}`);
    console.log(`   Pending: ${data.summary.pending}`);
    console.log(`   Ready to Process: ${data.summary.readyToProcess}`);
    console.log(`   Already Processed: ${data.summary.alreadyProcessed}`);
    
    // Find specific transaction
    const deposit = data.deposits?.find(d => d.txHash === TX_HASH);
    
    if (deposit) {
      console.log(`\n📋 Deposit Details (${TX_HASH.substring(0, 16)}...):`);
      console.log(`   Amount: ${deposit.amountBTC} BTC`);
      console.log(`   Confirmations: ${deposit.confirmations}/${deposit.requiredConfirmations}`);
      console.log(`   Status: ${deposit.status}`);
      console.log(`   Block Height: ${deposit.blockHeight || 'Not yet mined'}`);
      console.log(`   Ready to Process: ${deposit.readyToProcess ? '✅ YES' : '❌ NO'}`);
      console.log(`   Is Processed: ${deposit.isProcessed ? '✅ YES' : '❌ NO'}`);
      
      if (deposit.status === 'pending' && deposit.confirmations === 0) {
        console.log(`\n⏳ Transaction is still in mempool (unconfirmed)`);
        console.log(`   Waiting for miners to include it in a block...`);
        console.log(`   View on explorer: https://mempool.space/testnet4/tx/${TX_HASH}`);
      } else if (deposit.status === 'confirmed' && deposit.readyToProcess) {
        console.log(`\n✅ Deposit is ready to claim!`);
        console.log(`   Run: node claim-btc-deposit.js ${TX_HASH} J6337EyaWK5A6QL8cMcrHWVGz7Ri8MdhYxD2oQHbHCfi`);
      } else if (deposit.status === 'processed') {
        console.log(`\n⚠️  Deposit has already been processed`);
        console.log(`   You need a new deposit to test the workflow`);
      }
    } else {
      console.log(`\n⚠️  Transaction ${TX_HASH.substring(0, 16)}... not found in deposits`);
    }
    
    // Check blockchain directly
    console.log(`\n🔗 Checking blockchain directly...`);
    try {
      const explorerUrl = data.explorerUrl || 'https://mempool.space/testnet4/api';
      const txResponse = await axios.get(`${explorerUrl}/tx/${TX_HASH}`);
      const tx = txResponse.data;
      
      console.log(`   Confirmed: ${tx.status?.confirmed ? '✅ YES' : '❌ NO'}`);
      console.log(`   Block Height: ${tx.status?.block_height || 'Not mined yet'}`);
      
      if (tx.status?.confirmed && tx.status?.block_height) {
        // Get current block height
        const heightResponse = await axios.get(`${explorerUrl}/blocks/tip/height`);
        const currentHeight = parseInt(heightResponse.data);
        const confirmations = currentHeight - tx.status.block_height + 1;
        console.log(`   Current Block: ${currentHeight}`);
        console.log(`   Confirmations: ${confirmations}`);
      }
    } catch (error) {
      console.log(`   Error checking blockchain: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

checkStatus();

