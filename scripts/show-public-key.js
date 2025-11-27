#!/usr/bin/env node

/**
 * Show public key from keypair file
 */

const fs = require('fs');
const path = require('path');

const keypairPath = path.join(__dirname, '..', 'backend', 'relayer-keypair-new.json');

try {
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const publicKeyBytes = keypairData[1]; // Second array is public key

  // Convert to base58-like format (simplified)
  const publicKeyHex = Buffer.from(publicKeyBytes).toString('hex');

  console.log('🔑 Relayer Public Key:');
  console.log(publicKeyHex);
  console.log('');
  console.log('💰 Fund this address with devnet SOL:');
  console.log(`solana airdrop 2 ${publicKeyHex} --url devnet`);
  console.log('');
  console.log('📝 Then update backend/.env:');
  console.log('RELAYER_KEYPAIR_PATH=./relayer-keypair-new.json');

} catch (error) {
  console.error('Error reading keypair file:', error.message);
}
