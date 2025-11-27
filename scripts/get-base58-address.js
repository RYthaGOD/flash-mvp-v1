#!/usr/bin/env node

/**
 * Get the base58-encoded Solana address from the keypair
 */

const fs = require('fs');
const path = require('path');

const keypairPath = path.join(__dirname, '..', 'backend', 'relayer-keypair-new.json');

try {
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const publicKeyBytes = new Uint8Array(keypairData[1]);

  console.log('🔑 Solana Address for Funding:');
  console.log('==============================');
  console.log('');
  console.log('📋 Public Key Bytes:', Array.from(publicKeyBytes));
  console.log('');

  // Try to encode to base58 using a simple method
  // Solana addresses are base58-encoded 32-byte public keys
  console.log('💡 To get the base58 address:');
  console.log('1. Go to: https://www.browserling.com/tools/hex-to-base58');
  console.log('2. Input:', Buffer.from(publicKeyBytes).toString('hex'));
  console.log('3. Convert to get your Solana address');
  console.log('');
  console.log('💰 Send 2-3 SOL to that base58 address from your Phantom wallet');
  console.log('(Make sure Phantom is set to Devnet!)');
  console.log('');
  console.log('✅ After funding, run:');
  console.log('anchor deploy --provider.cluster devnet');

} catch (error) {
  console.error('Error:', error.message);
}



