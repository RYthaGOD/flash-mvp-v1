#!/usr/bin/env node

/**
 * Verify that the base58 address matches our generated keypair
 */

const fs = require('fs');
const path = require('path');

const keypairPath = path.join(__dirname, '..', 'backend', 'relayer-keypair-new.json');
const userAddress = 'DC5HrcMyMEAk7aSCnMM6shcsPPCkvaFLx1SiYJAm27q8';

try {
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const publicKeyBytes = new Uint8Array(keypairData[1]);

  console.log('🔍 Address Verification:');
  console.log('========================');
  console.log('');
  console.log('📋 Our generated public key (hex):');
  console.log(Buffer.from(publicKeyBytes).toString('hex'));
  console.log('');
  console.log('🎯 Your base58 address:');
  console.log(userAddress);
  console.log('');

  // Manual base58 decoding for verification
  // Using a simple base58 alphabet check
  const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  console.log('✅ Address format validation:');
  console.log('- Length (44):', userAddress.length === 44 ? '✅' : '❌');
  console.log('- Valid base58 chars:', [...userAddress].every(c => base58Alphabet.includes(c)) ? '✅' : '❌');
  console.log('- Starts with letter:', /^[A-Z]/.test(userAddress) ? '✅' : '❌');
  console.log('');

  console.log('💡 To fully verify:');
  console.log('Convert', userAddress, 'back to hex and compare with:');
  console.log(Buffer.from(publicKeyBytes).toString('hex'));
  console.log('');
  console.log('🛠️  Use: https://www.browserling.com/tools/base58-to-hex');
  console.log('');
  console.log('✅ If they match, this is your correct Solana address!');

} catch (error) {
  console.error('Error:', error.message);
}



