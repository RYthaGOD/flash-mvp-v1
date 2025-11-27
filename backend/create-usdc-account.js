#!/usr/bin/env node

/**
 * Create USDC Token Account for Treasury
 * Creates an Associated Token Account for USDC owned by the treasury
 */

const fs = require('fs');
const path = require('path');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');

// USDC mint on devnet
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

async function createUSDCAccount() {
  console.log('💰 Creating USDC token account for treasury...\n');

  // Load treasury keypair
  const treasuryKeypairPath = path.join(__dirname, 'treasury-keypair.json');
  const treasurySecretKey = JSON.parse(fs.readFileSync(treasuryKeypairPath));
  const treasuryKeypair = Keypair.fromSecretKey(Uint8Array.from(treasurySecretKey));

  console.log(`Treasury Public Key: ${treasuryKeypair.publicKey.toBase58()}`);

  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com');

  // Get associated token address for USDC
  const associatedTokenAddress = await getAssociatedTokenAddress(
    USDC_MINT,
    treasuryKeypair.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  console.log(`USDC Associated Token Account: ${associatedTokenAddress.toBase58()}`);

  // Check if account already exists
  const accountInfo = await connection.getAccountInfo(associatedTokenAddress);
  if (accountInfo) {
    console.log('✅ USDC token account already exists!');
    console.log(`📍 Account: ${associatedTokenAddress.toBase58()}`);
    return associatedTokenAddress.toBase58();
  }

  // Create the associated token account
  const createATAIx = createAssociatedTokenAccountInstruction(
    treasuryKeypair.publicKey, // payer
    associatedTokenAddress, // ata
    treasuryKeypair.publicKey, // owner
    USDC_MINT, // mint
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Create transaction
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const transaction = {
    blockhash,
    lastValidBlockHeight,
    instructions: [createATAIx],
    signers: [treasuryKeypair],
  };

  // Sign and send
  transaction.sign(treasuryKeypair);
  const signature = await connection.sendRawTransaction(transaction.serialize());

  // Confirm
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

  console.log('✅ USDC token account created successfully!');
  console.log(`📍 Account: ${associatedTokenAddress.toBase58()}`);
  console.log(`🔗 Transaction: ${signature}`);

  return associatedTokenAddress.toBase58();
}

// Run if called directly
if (require.main === module) {
  createUSDCAccount().catch(error => {
    console.error('❌ Error creating USDC account:', error);
    process.exit(1);
  });
}

module.exports = { createUSDCAccount };
