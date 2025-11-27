#!/usr/bin/env node

/**
 * Create Treasury Keypair
 * Generates a new Solana keypair for the USDC treasury
 */

const fs = require('fs');
const path = require('path');
const { Keypair } = require('@solana/web3.js');

function createTreasuryKeypair() {
  console.log('🔐 Creating Treasury Keypair for USDC holdings...\n');

  // Generate new keypair
  const treasuryKeypair = Keypair.generate();

  // Convert secret key to JSON format
  const secretKeyJson = JSON.stringify(Array.from(treasuryKeypair.secretKey));

  // Save to file
  const keypairPath = path.join(__dirname, 'treasury-keypair.json');
  fs.writeFileSync(keypairPath, secretKeyJson);

  console.log('✅ Treasury keypair created successfully!');
  console.log(`📁 Saved to: ${keypairPath}`);
  console.log(`🔑 Public Key: ${treasuryKeypair.publicKey.toBase58()}`);
  console.log('\n💰 Next steps:');
  console.log('1. Fund this address with USDC on devnet');
  console.log('2. Use this address as your treasury for Jupiter swaps');
  console.log('\n🚨 IMPORTANT: Keep treasury-keypair.json secure!');
  console.log('   Never commit it to version control.');

  return treasuryKeypair.publicKey.toBase58();
}

// Run if called directly
if (require.main === module) {
  try {
    createTreasuryKeypair();
  } catch (error) {
    console.error('❌ Error creating treasury keypair:', error);
    process.exit(1);
  }
}

module.exports = { createTreasuryKeypair };
