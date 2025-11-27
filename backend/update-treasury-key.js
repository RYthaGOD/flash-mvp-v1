#!/usr/bin/env node

/**
 * Update Treasury Keypair
 * Converts a base58 private key to the JSON format used by the treasury
 */

const fs = require('fs');
const path = require('path');
const bs58 = require('bs58');

// The user's treasury private key (base58)
const userPrivateKeyBase58 = '2kVgx6xbijWa1yVXD16A4iVb4CqM1XWCqX5dw5AjvYGvTqLkgGLmEhcRRF346vhHHUjFhnu1cakCyYLLN5U3jTiz';

try {
  // Decode base58 to bytes
  const privateKeyBytes = bs58.decode(userPrivateKeyBase58);

  console.log('🔑 Converting treasury private key...');
  console.log(`📏 Key length: ${privateKeyBytes.length} bytes`);

  if (privateKeyBytes.length !== 64) {
    throw new Error(`Invalid private key length. Expected 64 bytes, got ${privateKeyBytes.length}`);
  }

  // Convert to array format
  const privateKeyArray = Array.from(privateKeyBytes);

  // Save to treasury keypair file
  const keypairPath = path.join(__dirname, 'treasury-keypair.json');
  fs.writeFileSync(keypairPath, JSON.stringify(privateKeyArray));

  console.log('✅ Treasury keypair updated successfully!');
  console.log(`📁 Saved to: ${keypairPath}`);

  // Verify by loading it back
  const { Keypair } = require('@solana/web3.js');
  const loadedKeypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
  console.log(`🔑 Public Key: ${loadedKeypair.publicKey.toBase58()}`);

  console.log('\n🚨 IMPORTANT: Keep treasury-keypair.json secure!');
  console.log('   Never commit it to version control.');
  console.log('\n💰 Make sure this wallet has USDC on devnet for Jupiter swaps.');

} catch (error) {
  console.error('❌ Error updating treasury keypair:', error);
  console.error(error.message);
  process.exit(1);
}
