#!/usr/bin/env node

/**
 * Monitor Deposit and Test Complete Workflow
 * Watches for deposit confirmation, then tests the complete workflow
 * Records all logs for analysis
 */

const axios = require('./axiosClient');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SOLANA_ADDRESS = 'J6337EyaWK5A6QL8cMcrHWVGz7Ri8MdhYxD2oQHbHCfi';
const TX_HASH = process.argv[2] || null; // If not provided, will auto-detect newest deposit

// Log file
const logFile = path.join(__dirname, `workflow-test-${Date.now()}.log`);

// Colors for console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset', alsoToFile = true) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(`${colors[color]}${logMessage}${colors.reset}`);
  
  if (alsoToFile) {
    fs.appendFileSync(logFile, logMessage + '\n');
  }
}

function logSection(title) {
  const separator = '='.repeat(60);
  log(`\n${separator}`, 'cyan');
  log(title, 'cyan');
  log(separator, 'cyan');
}

// Workflow state
const workflowState = {
  started: new Date().toISOString(),
  depositDetected: null,
  depositConfirmed: null,
  claimAttempted: null,
  claimSucceeded: null,
  solanaTxReceived: null,
  completed: false,
  errors: [],
  logs: [],
};

async function checkDepositStatus(targetTxHash = null) {
  try {
    const response = await axios.get(`${API_URL}/api/bridge/check-btc-deposits`);
    const data = response.data;
    
    const deposit = targetTxHash 
      ? data.deposits?.find(d => d.txHash === targetTxHash)
      : null;
    return { data, deposit };
  } catch (error) {
    log(`Error checking deposit status: ${error.message}`, 'red');
    workflowState.errors.push({ time: new Date().toISOString(), error: error.message });
    return { data: null, deposit: null };
  }
}

async function checkBlockchainDirectly(txHash = TX_HASH) {
  if (!txHash) return null;
  
  try {
    const explorerUrl = 'https://mempool.space/testnet4/api';
    const txResponse = await axios.get(`${explorerUrl}/tx/${txHash}`);
    const tx = txResponse.data;
    
    let confirmations = 0;
    if (tx.status?.confirmed && tx.status?.block_height) {
      const heightResponse = await axios.get(`${explorerUrl}/blocks/tip/height`);
      const currentHeight = parseInt(heightResponse.data);
      confirmations = currentHeight - tx.status.block_height + 1;
    }
    
    return {
      confirmed: tx.status?.confirmed || false,
      blockHeight: tx.status?.block_height || null,
      confirmations: confirmations,
      blockTime: tx.status?.block_time || null,
    };
  } catch (error) {
    log(`Error checking blockchain: ${error.message}`, 'red');
    return null;
  }
}

async function claimDeposit(txHash = TX_HASH) {
  logSection('STEP 3: CLAIMING DEPOSIT');
  workflowState.claimAttempted = new Date().toISOString();
  
  try {
    log(`Claiming deposit: ${txHash}`, 'blue');
    log(`Solana Address: ${SOLANA_ADDRESS}`, 'blue');
    
    const response = await axios.post(`${API_URL}/api/bridge/btc-deposit`, {
      solanaAddress: SOLANA_ADDRESS,
      bitcoinTxHash: txHash,
    }, {
      timeout: 120000, // 2 minute timeout
    });
    
    const data = response.data;
    
    if (data.success) {
      workflowState.claimSucceeded = new Date().toISOString();
      workflowState.solanaTxReceived = data.swapSignature;
      
      log(`✅ Deposit claimed successfully!`, 'green');
      log(`   BTC Amount: ${data.btcAmount} BTC`, 'green');
      log(`   USDC Equivalent: ${data.usdcAmount} USDC`, 'green');
      log(`   Output Token: ${data.outputToken}`, 'green');
      log(`   Solana TX: ${data.swapSignature}`, 'green');
      log(`   Explorer: https://solscan.io/tx/${data.swapSignature}?cluster=devnet`, 'cyan');
      
      return { success: true, data };
    } else {
      const errorMsg = `Claim failed: ${data.error || 'Unknown error'}`;
      log(`❌ ${errorMsg}`, 'red');
      workflowState.errors.push({ time: new Date().toISOString(), error: errorMsg });
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    const errorMsg = error.response 
      ? `Claim error (${error.response.status}): ${JSON.stringify(error.response.data)}`
      : `Claim error: ${error.message}`;
    
    log(`❌ ${errorMsg}`, 'red');
    workflowState.errors.push({ time: new Date().toISOString(), error: errorMsg });
    
    if (error.response?.data?.details) {
      log(`   Details: ${JSON.stringify(error.response.data.details, null, 2)}`, 'red');
    }
    
    return { success: false, error: errorMsg };
  }
}

async function monitorAndTest() {
  logSection('WORKFLOW MONITORING STARTED');
  log(`Transaction Hash: ${TX_HASH || 'AUTO-DETECT (will use newest deposit)'}`, 'cyan');
  log(`Solana Address: ${SOLANA_ADDRESS}`, 'cyan');
  log(`API URL: ${API_URL}`, 'cyan');
  log(`Log File: ${logFile}`, 'cyan');
  log(`Test Mode: ${process.env.BTC_TEST_MODE === 'true' ? 'ENABLED (will send SOL directly)' : 'DISABLED (will use Jupiter swap)'}`, 'cyan');
  
  let checkCount = 0;
  const maxChecks = 120; // 20 minutes (10 second intervals)
  let depositFound = false;
  let depositConfirmed = false;
  let claimCompleted = false;
  let targetTxHash = TX_HASH;
  
  while (checkCount < maxChecks && !claimCompleted) {
    checkCount++;
    log(`\n--- Check ${checkCount}/${maxChecks} ---`, 'blue');
    
    // Check deposit status via API
    const { data: apiData } = await checkDepositStatus();
    
    // Auto-detect newest unprocessed deposit if no TX hash provided
    if (!targetTxHash && apiData && apiData.deposits) {
      const unprocessedDeposits = apiData.deposits.filter(d => 
        d.status !== 'processed' && d.hasAmount && d.amountSatoshis > 0
      );
      if (unprocessedDeposits.length > 0) {
        // Sort by block time (newest first) and take the first one
        unprocessedDeposits.sort((a, b) => (b.blockTime || 0) - (a.blockTime || 0));
        targetTxHash = unprocessedDeposits[0].txHash;
        if (!depositFound) {
          log(`🔍 Auto-detected newest deposit: ${targetTxHash.substring(0, 16)}...`, 'cyan');
        }
      }
    }
    
    // Check blockchain directly for target transaction
    const blockchainStatus = targetTxHash ? await checkBlockchainDirectly(targetTxHash) : null;
    
    // Find the target deposit
    const apiDeposit = targetTxHash && apiData 
      ? apiData.deposits?.find(d => d.txHash === targetTxHash)
      : null;
    
    if (apiDeposit) {
      if (!depositFound) {
        depositFound = true;
        workflowState.depositDetected = new Date().toISOString();
        log(`✅ Deposit detected in system`, 'green');
      }
      
      log(`   Amount: ${apiDeposit.amountBTC} BTC`, 'yellow');
      log(`   Status: ${apiDeposit.status}`, 'yellow');
      log(`   Confirmations (API): ${apiDeposit.confirmations}/${apiDeposit.requiredConfirmations}`, 'yellow');
      log(`   Ready to Process: ${apiDeposit.readyToProcess ? 'YES' : 'NO'}`, 'yellow');
      
      if (blockchainStatus) {
        log(`   Blockchain Status:`, 'yellow');
        log(`     Confirmed: ${blockchainStatus.confirmed ? 'YES' : 'NO'}`, 'yellow');
        log(`     Block Height: ${blockchainStatus.blockHeight || 'Not mined'}`, 'yellow');
        log(`     Confirmations (Calculated): ${blockchainStatus.confirmations}`, 'yellow');
      }
      
      // Check if confirmed and ready
      const isConfirmed = blockchainStatus?.confirmed && blockchainStatus.confirmations >= 1;
      const isReady = apiDeposit.readyToProcess || (isConfirmed && apiDeposit.status !== 'processed');
      
      if (isConfirmed && !depositConfirmed) {
        depositConfirmed = true;
        workflowState.depositConfirmed = new Date().toISOString();
        logSection('STEP 2: DEPOSIT CONFIRMED');
        log(`✅ Deposit has ${blockchainStatus.confirmations} confirmations!`, 'green');
        log(`   Block Height: ${blockchainStatus.blockHeight}`, 'green');
        log(`   Ready to claim!`, 'green');
      }
      
      // Attempt to claim if ready
      if (isReady && !claimCompleted && depositConfirmed) {
        logSection('DEPOSIT READY - ATTEMPTING CLAIM');
        const claimResult = await claimDeposit(targetTxHash);
        
        if (claimResult.success) {
          claimCompleted = true;
          workflowState.completed = true;
          logSection('WORKFLOW COMPLETED SUCCESSFULLY');
          break;
        } else {
          log(`⚠️  Claim failed, will retry on next check...`, 'yellow');
          // Wait a bit longer before retry
          await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
          continue;
        }
      }
    } else if (!targetTxHash) {
      log(`   Waiting for new deposit...`, 'yellow');
      log(`   Bridge Address: ${apiData?.bridgeAddress || 'checking...'}`, 'yellow');
    } else {
      log(`   Deposit ${targetTxHash.substring(0, 16)}... not found in system yet...`, 'yellow');
    }
    
    // Wait before next check
    if (!claimCompleted) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
    }
  }
  
  // Final summary
  logSection('FINAL WORKFLOW SUMMARY');
  log(`Started: ${workflowState.started}`, 'cyan');
  log(`Deposit Detected: ${workflowState.depositDetected || 'Not detected'}`, 'cyan');
  log(`Deposit Confirmed: ${workflowState.depositConfirmed || 'Not confirmed'}`, 'cyan');
  log(`Claim Attempted: ${workflowState.claimAttempted || 'Not attempted'}`, 'cyan');
  log(`Claim Succeeded: ${workflowState.claimSucceeded || 'Failed/Not completed'}`, 'cyan');
  log(`Solana TX: ${workflowState.solanaTxReceived || 'Not received'}`, 'cyan');
  log(`Completed: ${workflowState.completed ? 'YES' : 'NO'}`, workflowState.completed ? 'green' : 'red');
  
  if (workflowState.errors.length > 0) {
    log(`\nErrors encountered: ${workflowState.errors.length}`, 'red');
    workflowState.errors.forEach((err, idx) => {
      log(`  ${idx + 1}. [${err.time}] ${err.error}`, 'red');
    });
  }
  
  // Save workflow state to JSON
  const stateFile = logFile.replace('.log', '-state.json');
  fs.writeFileSync(stateFile, JSON.stringify(workflowState, null, 2));
  log(`\nWorkflow state saved to: ${stateFile}`, 'cyan');
  log(`Full logs saved to: ${logFile}`, 'cyan');
  
  if (!workflowState.completed) {
    log(`\n⚠️  Workflow did not complete. Check logs for details.`, 'yellow');
    process.exit(1);
  } else {
    log(`\n✅ Workflow completed successfully!`, 'green');
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log(`\n\n⚠️  Monitoring interrupted by user`, 'yellow');
  log(`Logs saved to: ${logFile}`, 'cyan');
  process.exit(0);
});

// Start monitoring
monitorAndTest().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

