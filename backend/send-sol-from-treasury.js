#!/usr/bin/env node

/**
 * Send SOL from Treasury to Address
 * Sends devnet SOL from treasury keypair to specified address
 * 
 * Usage:
 *   node send-sol-from-treasury.js <recipientAddress> <amount>
 * 
 * Example:
 *   node send-sol-from-treasury.js 5v8wJJ9UR8KbcH6c3ik9iN3TY2mSjUqCKSVoc6Km9LVx 1.5
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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

async function sendSOLFromTreasury(recipientAddress, amountSOL) {
  try {
    // Get network from environment
    const network = process.env.SOLANA_NETWORK || 'devnet';
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    
    log(`\n${'='.repeat(60)}`, 'cyan');
    log(`💰 Sending SOL from Treasury`, 'bright');
    log(`${'='.repeat(60)}`, 'cyan');
    log(`Network: ${network}`, 'blue');
    log(`RPC URL: ${rpcUrl}`, 'blue');
    
    // Load treasury keypair
    const keypairPath = path.join(__dirname, 'treasury-keypair.json');
    if (!fs.existsSync(keypairPath)) {
      throw new Error(`Treasury keypair not found at: ${keypairPath}`);
    }
    
    log(`\n📁 Loading treasury keypair from: ${keypairPath}`, 'blue');
    const secretKey = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
    const treasuryKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    const treasuryAddress = treasuryKeypair.publicKey.toBase58();
    
    log(`✓ Treasury Address: ${treasuryAddress}`, 'green');
    
    // Validate recipient address
    let recipientPubkey;
    try {
      recipientPubkey = new PublicKey(recipientAddress);
    } catch (error) {
      throw new Error(`Invalid recipient address: ${recipientAddress}`);
    }
    
    log(`✓ Recipient Address: ${recipientAddress}`, 'green');
    
    // Validate amount
    const amount = parseFloat(amountSOL);
    if (isNaN(amount) || amount <= 0) {
      throw new Error(`Invalid amount: ${amountSOL}. Must be a positive number.`);
    }
    
    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
    log(`✓ Amount: ${amount} SOL (${lamports} lamports)`, 'green');
    
    // Connect to Solana
    log(`\n🔗 Connecting to Solana ${network}...`, 'blue');
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // Check treasury balance
    log(`\n💵 Checking treasury balance...`, 'blue');
    const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
    const treasuryBalanceSOL = treasuryBalance / LAMPORTS_PER_SOL;
    
    log(`   Treasury Balance: ${treasuryBalanceSOL} SOL`, 'yellow');
    
    if (treasuryBalance < lamports) {
      throw new Error(
        `Insufficient balance! ` +
        `Treasury has ${treasuryBalanceSOL} SOL, but need ${amount} SOL`
      );
    }
    
    // Estimate transaction fee
    const feeEstimate = await connection.getRecentPrioritizationFees();
    const estimatedFee = feeEstimate.length > 0 
      ? feeEstimate[0].prioritizationFee 
      : 5000; // Default 0.000005 SOL
    
    const totalRequired = lamports + estimatedFee;
    log(`   Estimated Fee: ${estimatedFee / LAMPORTS_PER_SOL} SOL`, 'yellow');
    log(`   Total Required: ${totalRequired / LAMPORTS_PER_SOL} SOL`, 'yellow');
    
    if (treasuryBalance < totalRequired) {
      throw new Error(
        `Insufficient balance including fees! ` +
        `Treasury has ${treasuryBalanceSOL} SOL, but need ${totalRequired / LAMPORTS_PER_SOL} SOL`
      );
    }
    
    // Create transfer transaction
    log(`\n📝 Creating transfer transaction...`, 'blue');
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasuryKeypair.publicKey,
        toPubkey: recipientPubkey,
        lamports: lamports,
      })
    );
    
    // Get latest blockhash
    log(`   Getting latest blockhash...`, 'blue');
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = treasuryKeypair.publicKey;
    
    // Sign transaction
    log(`   Signing transaction...`, 'blue');
    transaction.sign(treasuryKeypair);
    
    // Send transaction
    log(`\n📤 Sending transaction...`, 'blue');
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
    });
    
    log(`✓ Transaction sent!`, 'green');
    log(`   Signature: ${signature}`, 'cyan');
    
    // Confirm transaction
    log(`\n⏳ Confirming transaction...`, 'blue');
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }
    
    log(`✓ Transaction confirmed!`, 'green');
    log(`   Slot: ${confirmation.value.slot}`, 'cyan');
    
    // Verify final balances
    log(`\n💵 Verifying balances...`, 'blue');
    const newTreasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
    const recipientBalance = await connection.getBalance(recipientPubkey);
    
    log(`   Treasury Balance: ${newTreasuryBalance / LAMPORTS_PER_SOL} SOL`, 'green');
    log(`   Recipient Balance: ${recipientBalance / LAMPORTS_PER_SOL} SOL`, 'green');
    
    log(`\n${'='.repeat(60)}`, 'green');
    log(`✅ Transfer Complete!`, 'green');
    log(`${'='.repeat(60)}`, 'green');
    log(`\n📊 Summary:`, 'yellow');
    log(`   From: ${treasuryAddress}`, 'cyan');
    log(`   To: ${recipientAddress}`, 'cyan');
    log(`   Amount: ${amount} SOL`, 'cyan');
    log(`   Transaction: ${signature}`, 'cyan');
    log(`   Explorer: https://solscan.io/tx/${signature}?cluster=${network}`, 'cyan');
    
    return {
      success: true,
      signature,
      from: treasuryAddress,
      to: recipientAddress,
      amount: amount,
      treasuryBalanceBefore: treasuryBalanceSOL,
      treasuryBalanceAfter: newTreasuryBalance / LAMPORTS_PER_SOL,
      recipientBalance: recipientBalance / LAMPORTS_PER_SOL,
    };
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    if (error.stack) {
      console.error(error.stack);
    }
    throw error;
  }
}

// Main execution
async function main() {
  const recipientAddress = process.argv[2];
  const amountSOL = process.argv[3];
  
  if (!recipientAddress || !amountSOL) {
    log(`\n❌ Missing required arguments`, 'red');
    log(`\nUsage: node send-sol-from-treasury.js <recipientAddress> <amountSOL>`, 'yellow');
    log(`\nExample:`, 'yellow');
    log(`  node send-sol-from-treasury.js 5v8wJJ9UR8KbcH6c3ik9iN3TY2mSjUqCKSVoc6Km9LVx 1.5`, 'cyan');
    process.exit(1);
  }
  
  try {
    await sendSOLFromTreasury(recipientAddress, amountSOL);
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { sendSOLFromTreasury };

