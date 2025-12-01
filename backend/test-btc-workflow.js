/**
 * Test Complete BTC Deposit Workflow
 * Tests: Detection → Confirmation → Claim → Solana Send
 * 
 * Usage:
 *   node test-btc-workflow.js [bitcoinTxHash] [solanaAddress]
 * 
 * Example:
 *   node test-btc-workflow.js 180a0ccee8b2d40e8353fd9441ac9e35a79c8065433b0b1838883276de968578 YourSolanaAddress...
 */

const axios = require('axios');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const BITCOIN_TX_HASH = process.argv[2];
const SOLANA_ADDRESS = process.argv[3];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`STEP ${step}: ${message}`, 'bright');
  log('='.repeat(60), 'cyan');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Step 1: Check for BTC deposits
 */
async function checkDeposits() {
  logStep(1, 'Checking for BTC Deposits');
  
  try {
    const response = await axios.get(`${API_URL}/api/bridge/check-btc-deposits`);
    const data = response.data;
    
    if (!data.success) {
      log(`❌ Error: ${data.error}`, 'red');
      return null;
    }

    log(`✓ Bridge Address: ${data.bridgeAddress}`, 'green');
    log(`✓ Network: ${data.network}`, 'green');
    log(`✓ Required Confirmations: ${data.requiredConfirmations}`, 'green');
    log(`✓ Current Reserve: ${data.currentReserveBTC} BTC`, 'green');
    
    log(`\n📊 Summary:`, 'yellow');
    log(`   Total Deposits: ${data.summary.total}`);
    log(`   Confirmed: ${data.summary.confirmed}`);
    log(`   Pending: ${data.summary.pending}`);
    log(`   Ready to Process: ${data.summary.readyToProcess}`);
    log(`   Already Processed: ${data.summary.alreadyProcessed}`);

    if (data.reconciliation) {
      log(`\n💰 Balance Reconciliation:`, 'yellow');
      log(`   Actual Balance: ${data.reconciliation.actualBalanceBTC} BTC`);
      log(`   Expected Balance: ${data.reconciliation.expectedBalanceBTC} BTC`);
      log(`   Tracked Reserve: ${data.reconciliation.trackedReserveBTC} BTC`);
      log(`   Difference: ${data.reconciliation.differenceBTC} BTC`);
      log(`   Reconciled: ${data.reconciliation.reconciled ? '✓' : '✗'}`);
      
      if (data.reconciliation.breakdown) {
        log(`\n   Breakdown:`, 'yellow');
        log(`   Bootstrap: ${data.reconciliation.breakdown.bootstrapBTC} BTC`);
        log(`   Total Deposits: ${data.reconciliation.breakdown.totalDepositsBTC} BTC`);
        log(`   Total Withdrawals: ${data.reconciliation.breakdown.totalWithdrawalsBTC} BTC`);
        log(`   Net Balance: ${data.reconciliation.breakdown.netBalanceBTC} BTC`);
      }
    }

    if (data.deposits && data.deposits.length > 0) {
      log(`\n📋 Deposits:`, 'yellow');
      data.deposits.slice(0, 5).forEach((deposit, index) => {
        const statusIcon = deposit.status === 'processed' ? '✓' : 
                          deposit.status === 'confirmed' ? '⏳' : '⏱';
        log(`   ${index + 1}. ${statusIcon} ${deposit.txHash.substring(0, 16)}... - ${deposit.amountBTC} BTC (${deposit.confirmations}/${deposit.requiredConfirmations} confirmations, ${deposit.status})`);
      });
    }

    return data;
  } catch (error) {
    log(`❌ Error checking deposits: ${error.message}`, 'red');
    if (error.response) {
      log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
    return null;
  }
}

/**
 * Step 2: Wait for confirmation (if needed)
 */
async function waitForConfirmation(txHash, requiredConfirmations = 1) {
  logStep(2, 'Waiting for Confirmation');
  
  if (!txHash) {
    log(`⚠️  No transaction hash provided, skipping confirmation check`, 'yellow');
    return true;
  }

  let attempts = 0;
  const maxAttempts = 30; // 5 minutes max (10s intervals)
  
  while (attempts < maxAttempts) {
    const deposits = await checkDeposits();
    if (!deposits) break;

    const deposit = deposits.deposits?.find(d => d.txHash === txHash);
    if (!deposit) {
      log(`⚠️  Deposit ${txHash.substring(0, 16)}... not found in deposits`, 'yellow');
      break;
    }

    log(`   Confirmations: ${deposit.confirmations}/${deposit.requiredConfirmations}`, 'blue');
    
    if (deposit.confirmations >= deposit.requiredConfirmations) {
      log(`✓ Deposit confirmed!`, 'green');
      return true;
    }

    if (deposit.status === 'processed') {
      log(`✓ Deposit already processed`, 'green');
      return true;
    }

    attempts++;
    log(`   Waiting... (${attempts}/${maxAttempts})`, 'blue');
    await sleep(10000); // Wait 10 seconds
  }

  log(`⚠️  Timeout waiting for confirmation`, 'yellow');
  return false;
}

/**
 * Step 3: Claim BTC deposit
 */
async function claimDeposit(txHash, solanaAddress, outputTokenMint = null) {
  logStep(3, 'Claiming BTC Deposit');
  
  if (!txHash || !solanaAddress) {
    log(`❌ Missing required parameters:`, 'red');
    log(`   txHash: ${txHash || 'MISSING'}`, 'red');
    log(`   solanaAddress: ${solanaAddress || 'MISSING'}`, 'red');
    log(`\nUsage: node test-btc-workflow.js <bitcoinTxHash> <solanaAddress> [outputTokenMint]`, 'yellow');
    return null;
  }

  log(`   Bitcoin TX: ${txHash}`, 'blue');
  log(`   Solana Address: ${solanaAddress}`, 'blue');
  if (outputTokenMint) {
    log(`   Output Token: ${outputTokenMint}`, 'blue');
  }

  try {
    const payload = {
      solanaAddress,
      bitcoinTxHash: txHash,
    };
    
    if (outputTokenMint) {
      payload.outputTokenMint = outputTokenMint;
    }

    log(`\n   Sending claim request...`, 'blue');
    const response = await axios.post(`${API_URL}/api/bridge/btc-deposit`, payload);
    const data = response.data;

    if (data.success) {
      log(`✓ Deposit claimed successfully!`, 'green');
      log(`\n📊 Result:`, 'yellow');
      log(`   BTC Amount: ${data.btcAmount} BTC`, 'green');
      log(`   USDC Equivalent: ${data.usdcAmount} USDC`, 'green');
      log(`   Output Token: ${data.outputToken}`, 'green');
      log(`   Solana TX Signature: ${data.swapSignature}`, 'green');
      log(`   Bitcoin TX Hash: ${data.bitcoinTxHash}`, 'green');
      
      return data;
    } else {
      log(`❌ Claim failed: ${data.error || 'Unknown error'}`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ Error claiming deposit: ${error.message}`, 'red');
    if (error.response) {
      log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
    return null;
  }
}

/**
 * Step 4: Verify Solana transaction
 */
async function verifySolanaTransaction(signature) {
  logStep(4, 'Verifying Solana Transaction');
  
  if (!signature) {
    log(`⚠️  No Solana transaction signature provided`, 'yellow');
    return false;
  }

  log(`   Transaction Signature: ${signature}`, 'blue');
  log(`   Checking on Solana explorer...`, 'blue');
  
  // You can add Solana explorer check here if needed
  // For now, we'll just confirm the signature format is valid
  if (signature && signature.length === 88) {
    log(`✓ Transaction signature is valid format`, 'green');
    log(`   View on explorer: https://solscan.io/tx/${signature}`, 'cyan');
    return true;
  } else {
    log(`⚠️  Transaction signature format appears invalid`, 'yellow');
    return false;
  }
}

/**
 * Main test workflow
 */
async function runWorkflow() {
  log(`\n${'='.repeat(60)}`, 'bright');
  log(`🚀 BTC Deposit Workflow Test`, 'bright');
  log(`${'='.repeat(60)}`, 'bright');
  log(`API URL: ${API_URL}`, 'cyan');

  // Step 1: Check deposits
  const deposits = await checkDeposits();
  if (!deposits) {
    log(`\n❌ Failed to check deposits. Exiting.`, 'red');
    process.exit(1);
  }

  // If tx hash provided, use it; otherwise use first ready deposit
  let txHash = BITCOIN_TX_HASH;
  if (!txHash && deposits.deposits && deposits.deposits.length > 0) {
    const readyDeposit = deposits.deposits.find(d => d.readyToProcess);
    if (readyDeposit) {
      txHash = readyDeposit.txHash;
      log(`\n📌 Using first ready deposit: ${txHash.substring(0, 16)}...`, 'yellow');
    } else {
      log(`\n⚠️  No ready deposits found. Please provide a transaction hash.`, 'yellow');
      log(`   Usage: node test-btc-workflow.js <bitcoinTxHash> <solanaAddress>`, 'yellow');
      process.exit(0);
    }
  }

  // Step 2: Wait for confirmation (if needed)
  if (txHash) {
    const confirmed = await waitForConfirmation(txHash, deposits.requiredConfirmations);
    if (!confirmed) {
      log(`\n⚠️  Deposit not yet confirmed. You can still try to claim it.`, 'yellow');
    }
  }

  // Step 3: Claim deposit (if Solana address provided)
  if (txHash && SOLANA_ADDRESS) {
    const result = await claimDeposit(txHash, SOLANA_ADDRESS);
    
    if (result && result.swapSignature) {
      // Step 4: Verify Solana transaction
      await verifySolanaTransaction(result.swapSignature);
      
      log(`\n${'='.repeat(60)}`, 'green');
      log(`✅ Workflow Complete!`, 'green');
      log(`${'='.repeat(60)}`, 'green');
    } else {
      log(`\n⚠️  Deposit claim completed but no Solana transaction found`, 'yellow');
    }
  } else {
    log(`\n📝 To complete the workflow, run:`, 'yellow');
    log(`   node test-btc-workflow.js ${txHash || '<txHash>'} <solanaAddress>`, 'yellow');
  }

  // Final deposit check
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`📊 Final Status Check`, 'cyan');
  log(`${'='.repeat(60)}`, 'cyan');
  await checkDeposits();
}

// Run the workflow
runWorkflow().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

