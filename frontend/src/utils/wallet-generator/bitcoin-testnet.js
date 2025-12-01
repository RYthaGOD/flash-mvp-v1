// Bitcoin Testnet Wallet Generator
// Real Bitcoin addresses for testnet - uses bitcoinjs-lib v6+

import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import secp256k1 from '@noble/secp256k1';

// Initialize ECC library for bitcoinjs-lib v6+
bitcoin.initEccLib(secp256k1);
const ECPair = ECPairFactory(secp256k1);

class BitcoinTestnetGenerator {
  constructor() {
    this.network = bitcoin.networks.testnet;
  }

  // Generate a random wallet with simple keypair
  generateWallet() {
    // Generate a random keypair
    const keyPair = ECPair.makeRandom({ network: this.network });

    // Generate P2WPKH (SegWit) address - starts with 'tb1'
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network: this.network
    });

    // Get WIF format private key
    const wif = keyPair.toWIF();

    return {
      type: 'bitcoin',
      network: 'testnet',
      address: address,
      wif: wif,
      publicKey: keyPair.publicKey.toString('hex'),
      privateKey: keyPair.privateKey.toString('hex')
    };
  }

  // Validate a Bitcoin testnet address
  validateAddress(address) {
    try {
      bitcoin.address.toOutputScript(address, this.network);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Import wallet from WIF private key
  importWallet(wif) {
    try {
      // Decode WIF to keypair
      const keyPair = ECPair.fromWIF(wif, this.network);

      // Generate P2WPKH (SegWit) address
      const { address } = bitcoin.payments.p2wpkh({
        pubkey: keyPair.publicKey,
        network: this.network
      });

      return {
        type: 'bitcoin',
        network: 'testnet',
        address: address,
        wif: wif,
        publicKey: keyPair.publicKey.toString('hex'),
        privateKey: keyPair.privateKey.toString('hex')
      };
    } catch (error) {
      throw new Error(`Invalid WIF format: ${error.message}`);
    }
  }

  // Validate WIF format
  validateWIF(wif) {
    try {
      ECPair.fromWIF(wif, this.network);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get wallet info for display
  getWalletInfo(wallet) {
    return {
      address: wallet.address,
      format: wallet.address.startsWith('tb1') ? 'P2WPKH (SegWit)' : 'Legacy',
      network: 'Bitcoin Testnet',
      explorer: `https://mempool.space/testnet/address/${wallet.address}`,
      faucet: 'https://mempool.space/testnet/faucet'
    };
  }
}

export default BitcoinTestnetGenerator;
