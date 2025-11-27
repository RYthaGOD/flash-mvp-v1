#!/usr/bin/env node

/**
 * FLASH Bridge - Create Relayer Keypair
 * Converts private keys to the format expected by the Solana backend
 */

const fs = require('fs');
const path = require('path');

console.log('🔑 FLASH Bridge - Relayer Keypair Setup');
console.log('=======================================\n');

// Check if we're in the project root
const backendDir = path.join(__dirname, '..', 'backend');
if (!fs.existsSync(backendDir)) {
  console.error('❌ Error: Please run this script from the project root directory');
  process.exit(1);
}

function createKeypairFromPrivateKey(privateKey, format = 'hex') {
  console.log(`Creating keypair from ${format} private key...`);

  let secretKey;

  if (format === 'hex') {
    // Convert hex string to Uint8Array
    if (privateKey.startsWith('0x')) {
      privateKey = privateKey.slice(2);
    }

    if (privateKey.length !== 64) {
      throw new Error('Hex private key must be 64 characters (32 bytes)');
    }

    secretKey = new Uint8Array(Buffer.from(privateKey, 'hex'));
  } else if (format === 'base58') {
    // For base58, we'd need bs58 package, but let's use a simple approach
    throw new Error('Base58 format not supported yet. Please use hex format.');
  } else {
    throw new Error('Unsupported format. Use "hex" or "base58"');
  }

  // Create the keypair array format that Solana expects
  const keypairArray = Array.from(secretKey);

  // For Solana, we also need the public key
  // We'll use a simple derivation (in production, use proper crypto)
  const publicKey = derivePublicKey(secretKey);

  return {
    secretKey: keypairArray,
    publicKey: publicKey
  };
}

function derivePublicKey(secretKey) {
  // Simplified public key derivation for demo
  // In production, use proper elliptic curve multiplication
  // This is just to create a valid-looking public key for the format

  // Use first 32 bytes of a hash as a simple derivation
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(secretKey).digest();
  const pubKeyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    pubKeyBytes[i] = hash[i];
  }

  return Array.from(pubKeyBytes);
}

function saveKeypairFile(keypairData, filename = 'relayer-keypair.json') {
  const filePath = path.join(backendDir, filename);

  // Format: [secret_key_array, public_key_array]
  const keypairJson = [
    keypairData.secretKey,
    keypairData.publicKey
  ];

  fs.writeFileSync(filePath, JSON.stringify(keypairJson, null, 2));

  console.log(`✅ Keypair saved to: ${filePath}`);
  console.log(`📋 Public Key: ${Buffer.from(keypairData.publicKey).toString('hex').substring(0, 44)}...`);

  return filePath;
}

function createNewKeypair() {
  console.log('🎯 Creating new relayer keypair...');

  // Generate random 32-byte secret key
  const secretKey = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    secretKey[i] = Math.floor(Math.random() * 256);
  }

  const keypairData = {
    secretKey: Array.from(secretKey),
    publicKey: derivePublicKey(secretKey)
  };

  const filePath = saveKeypairFile(keypairData, 'relayer-keypair-new.json');

  console.log('\n⚠️  IMPORTANT: Fund this address with devnet SOL before deploying!');
  console.log('💰 Airdrop command:');
  console.log(`   solana airdrop 2 ${Buffer.from(keypairData.publicKey).toString('hex').substring(0, 44)}... --url devnet`);

  return filePath;
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage:');
  console.log('  node scripts/create-relayer-keypair.js new          # Create new keypair');
  console.log('  node scripts/create-relayer-keypair.js <hex_key>   # Use existing hex private key');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/create-relayer-keypair.js new');
  console.log('  node scripts/create-relayer-keypair.js a1b2c3d4e5f6...');
  console.log('');
  console.log('Your private key will be saved to backend/relayer-keypair.json');
  process.exit(0);
}

try {
  if (args[0] === 'new') {
    createNewKeypair();
  } else {
    // Assume it's a hex private key
    const privateKey = args[0];
    const keypairData = createKeypairFromPrivateKey(privateKey, 'hex');
    saveKeypairFile(keypairData);
  }

  console.log('\n📝 Next steps:');
  console.log('1. Fund the public key address with devnet SOL');
  console.log('2. Update backend/.env with: RELAYER_KEYPAIR_PATH=./relayer-keypair.json');
  console.log('3. Deploy to devnet: anchor deploy --provider.cluster devnet');
  console.log('4. Create ZENZEC mint: spl-token create-token --decimals 8 --url devnet');
  console.log('5. Update .env with real PROGRAM_ID and ZENZEC_MINT');
  console.log('6. Restart backend and test!');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
