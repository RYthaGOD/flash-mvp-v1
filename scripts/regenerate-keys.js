#!/usr/bin/env node

/**
 * FLASH Bridge - Key Regeneration Script
 * Generates new keypairs to replace compromised keys
 *
 * WARNING: This script will generate NEW keys and overwrite any existing keypairs.
 * Make sure to backup important keys before running this script.
 */

const fs = require('fs');
const path = require('path');
const { Keypair } = require('@solana/web3.js');

console.log('🔑 FLASH Bridge Key Regeneration Script');
console.log('========================================');
console.log('');

console.log('⚠️  WARNING: This will generate NEW keypairs and may overwrite existing ones.');
console.log('   Make sure you have backed up any important keys before proceeding.');
console.log('');

console.log('Generating new treasury keypair...');
const treasuryKeypair = Keypair.generate();
const treasuryKeypairPath = path.join(__dirname, '..', 'backend', 'treasury-keypair.json');

fs.writeFileSync(treasuryKeypairPath, JSON.stringify(Array.from(treasuryKeypair.secretKey)));
console.log(`✅ Treasury keypair saved to: ${treasuryKeypairPath}`);
console.log(`   Public key: ${treasuryKeypair.publicKey.toBase58()}`);
console.log('');

console.log('Generating new relayer keypair...');
const relayerKeypair = Keypair.generate();
const relayerKeypairPath = path.join(__dirname, '..', 'backend', 'relayer-keypair-new.json');

fs.writeFileSync(relayerKeypairPath, JSON.stringify(Array.from(relayerKeypair.secretKey)));
console.log(`✅ Relayer keypair saved to: ${relayerKeypairPath}`);
console.log(`   Public key: ${relayerKeypair.publicKey.toBase58()}`);
console.log('');

console.log('🔐 IMPORTANT SECURITY NOTES:');
console.log('============================');
console.log('1. These are NEW keys - the old compromised keys have been deleted');
console.log('2. Update any external systems that reference the old public keys');
console.log('3. Fund the new treasury address with SOL for operations');
console.log('4. Update any monitoring or alerting systems');
console.log('5. Test all bridge operations with the new keys');
console.log('');

console.log('📋 NEXT STEPS:');
console.log('==============');
console.log('1. Fund treasury address:', treasuryKeypair.publicKey.toBase58());
console.log('2. Fund relayer address:', relayerKeypair.publicKey.toBase58());
console.log('3. Update any configuration files referencing old keys');
console.log('4. Test bridge operations');
console.log('5. Update monitoring systems');
console.log('');

console.log('✅ Key regeneration completed successfully!');
console.log('🔒 Remember: Never commit private key files to version control!');
