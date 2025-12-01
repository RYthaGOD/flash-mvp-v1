#!/usr/bin/env node

/**
 * Generate Bitcoin Bridge Address
 * Creates a testnet Bitcoin address for the FLASH Bridge
 */

const bitcoin = require('bitcoinjs-lib');
const bip39 = require('bip39');
const { BIP32Factory } = require('bip32');
const ecc = require('tiny-secp256k1');

// Initialize BIP32 with ECC
const bip32 = BIP32Factory(ecc);

// Network configuration
const network = bitcoin.networks.testnet;

function generateBitcoinBridgeAddress() {
  console.log('🔐 Generating Bitcoin Bridge Address for FLASH Bridge...\n');

  try {
    // Generate random mnemonic
    const mnemonic = bip39.generateMnemonic(128); // 12 words
    console.log('📝 Generated mnemonic (SAVE THIS):');
    console.log(mnemonic);
    console.log();

    // Generate seed from mnemonic
    const seed = bip39.mnemonicToSeedSync(mnemonic);

    // Derive HD wallet root
    const root = bip32.fromSeed(seed, network);

    // Derive first account (m/84'/1'/0'/0/0 for SegWit)
    // Using BIP84 for native SegWit (starts with tb1)
    const path = "m/84'/1'/0'/0/0";
    const child = root.derivePath(path);

    // Generate P2WPKH (native SegWit) address
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: child.publicKey,
      network: network,
    });

    // Generate WIF private key for wallet import
    const privateKey = child.privateKey;
    const wif = child.toWIF();

    console.log('✅ Bitcoin Bridge Address Generated!');
    console.log('=====================================');
    console.log(`🔑 Address: ${address}`);
    console.log(`🌐 Network: Bitcoin Testnet`);
    console.log(`📍 Derivation Path: ${path}`);
    console.log(`🔒 WIF Private Key: ${wif}`);
    console.log();

    console.log('💰 Next steps:');
    console.log('1. Fund this address with testnet BTC from a faucet');
    console.log('2. Or send from your Unisat wallet to this address');
    console.log('3. Use this address as BITCOIN_BRIDGE_ADDRESS in your .env');
    console.log();

    console.log('🚨 IMPORTANT SECURITY NOTES:');
    console.log('• Save your mnemonic phrase securely!');
    console.log('• This generates a NEW address each time you run it');
    console.log('• For production, use a proper wallet management system');
    console.log('• Never commit private keys to version control');
    console.log();

    console.log('🔗 Useful links:');
    console.log('• Testnet Faucet: https://testnet-faucet.com/btc-testnet/');
    console.log('• Explorer: https://mempool.space/testnet');
    console.log('• Unisat Wallet: https://unisat.io/');

    return {
      address,
      mnemonic,
      wif,
      path
    };

  } catch (error) {
    console.error('❌ Error generating Bitcoin address:', error);
    process.exit(1);
  }
}

// Export for use in other scripts
module.exports = { generateBitcoinBridgeAddress };

// Run if called directly
if (require.main === module) {
  generateBitcoinBridgeAddress();
}
