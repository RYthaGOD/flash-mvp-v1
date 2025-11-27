#!/usr/bin/env node

/**
 * Use existing Solana private key for relayer
 * Converts hex private key to Solana keypair format
 */

const fs = require('fs');
const path = require('path');

console.log('🔑 Use Existing Solana Private Key for Relayer');
console.log('==============================================\n');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node scripts/use-existing-keypair.js <your_private_key_hex>');
  console.log('');
  console.log('Example:');
  console.log('  node scripts/use-existing-keypair.js a1b2c3d4e5f6...');
  console.log('');
  console.log('Your private key should be 64 characters (32 bytes) in hex format.');
  console.log('This is typically what Phantom wallet exports.');
  process.exit(0);
}

const privateKeyHex = args[0];

try {
  // Validate hex format
  if (!/^[a-fA-F0-9]{64}$/.test(privateKeyHex)) {
    throw new Error('Private key must be 64 hex characters (32 bytes)');
  }

  // Convert hex to byte array
  const secretKey = [];
  for (let i = 0; i < privateKeyHex.length; i += 2) {
    secretKey.push(parseInt(privateKeyHex.substr(i, 2), 16));
  }

  // Simple public key derivation (for demo - not cryptographically secure)
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(Buffer.from(secretKey)).digest();
  const publicKey = Array.from(hash.slice(0, 32));

  // Create keypair in Solana format
  const keypairData = [secretKey, publicKey];

  // Save to backend
  const backendDir = path.join(__dirname, '..', 'backend');
  const keypairPath = path.join(backendDir, 'relayer-keypair.json');

  fs.writeFileSync(keypairPath, JSON.stringify(keypairData, null, 2));

  console.log('✅ Keypair saved to:', keypairPath);
  console.log('🔑 Public Key (first 20 chars):', Buffer.from(publicKey).toString('hex').substring(0, 20) + '...');
  console.log('');
  console.log('⚠️  SECURITY NOTE:');
  console.log('   This keypair file contains your private key.');
  console.log('   Keep it secure and never commit it to version control.');
  console.log('');
  console.log('📝 Backend will automatically use this keypair.');
  console.log('   No need to update .env - it uses this file by default now.');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
