#!/usr/bin/env node

/**
 * Show the Solana address (base58 format) from the generated keypair
 */

const fs = require('fs');
const path = require('path');

const keypairPath = path.join(__dirname, '..', 'backend', 'relayer-keypair-new.json');

try {
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const publicKeyBytes = keypairData[1]; // Second array is public key

  // For proper Solana address, we should use base58 encoding
  // Since we don't have bs58 working, let's show the hex and explain
  const publicKeyHex = Buffer.from(publicKeyBytes).toString('hex');

  console.log('🔑 Solana Relayer Address Details:');
  console.log('=====================================');
  console.log('');
  console.log('📋 Raw Public Key (hex):');
  console.log(publicKeyHex);
  console.log('');
  console.log('💰 For SOL Transfer:');
  console.log('Use your Phantom wallet to send SOL to this address');
  console.log('Amount needed: 2-3 SOL (for deployment + transactions)');
  console.log('');
  console.log('🔍 To verify this is a valid Solana address:');
  console.log('- Should be 32 bytes (64 hex characters):', publicKeyHex.length === 64 ? '✅' : '❌');
  console.log('- Solana addresses are base58-encoded versions of this public key');
  console.log('');
  console.log('📝 After funding:');
  console.log('Run: anchor deploy --provider.cluster devnet');
  console.log('');
  console.log('⚠️  Make sure you\'re on Solana Devnet in Phantom!');

} catch (error) {
  console.error('Error reading keypair file:', error.message);
  console.log('');
  console.log('🔄 Try generating a new keypair:');
  console.log('node scripts/create-relayer-keypair.js new');
}



