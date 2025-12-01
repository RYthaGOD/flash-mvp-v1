import * as bitcoin from 'bitcoinjs-lib';
import ECPairFactory from 'ecpair';
import * as ecc from '@noble/secp256k1';
import { Buffer } from 'buffer';

const ECPair = ECPairFactory(ecc);
const TESTNET = bitcoin.networks.testnet;

class BitcoinTestnetGenerator {
  generateWallet() {
    const keyPair = ECPair.makeRandom({ network: TESTNET });
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network: TESTNET,
    });

    return {
      type: 'bitcoin',
      network: 'testnet',
      address,
      wif: keyPair.toWIF(),
      publicKey: keyPair.publicKey.toString('hex'),
      privateKey: Buffer.from(keyPair.privateKey).toString('hex'),
    };
  }

  importWallet(wif) {
    const keyPair = ECPair.fromWIF(wif, TESTNET);
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network: TESTNET,
    });

    return {
      type: 'bitcoin',
      network: 'testnet',
      address,
      wif: keyPair.toWIF(),
      publicKey: keyPair.publicKey.toString('hex'),
      privateKey: Buffer.from(keyPair.privateKey).toString('hex'),
    };
  }

  validateWIF(wif) {
    try {
      ECPair.fromWIF(wif, TESTNET);
      return true;
    } catch (error) {
      return false;
    }
  }
}

class TestnetWalletGenerator {
  constructor() {
    this.generators = {
      bitcoin: new BitcoinTestnetGenerator(),
    };
  }

  async generateAllWallets() {
    try {
      const wallets = {
        bitcoin: this.generators.bitcoin.generateWallet(),
      };

      return {
        success: true,
        wallets,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        wallets: null,
      };
    }
  }

  generateWallet(chain) {
    try {
      if (chain !== 'bitcoin') {
        throw new Error('Only Bitcoin testnet supported in MVP');
      }

      return {
        success: true,
        wallet: this.generators.bitcoin.generateWallet(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        wallet: null,
      };
    }
  }

  importWallet(chain, privateKey) {
    try {
      if (chain !== 'bitcoin') {
        throw new Error('Only Bitcoin testnet supported in MVP');
      }

      if (!this.generators.bitcoin.validateWIF(privateKey)) {
        throw new Error('Invalid WIF private key');
      }

      const wallet = this.generators.bitcoin.importWallet(privateKey);
      return {
        success: true,
        wallet,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        wallet: null,
      };
    }
  }

  validatePrivateKey(chain, privateKey) {
    if (chain !== 'bitcoin') {
      return false;
    }
    return this.generators.bitcoin.validateWIF(privateKey);
  }

  validateWallet(wallet) {
    if (!wallet) return false;
    return wallet.address?.startsWith('m') ||
      wallet.address?.startsWith('n') ||
      wallet.address?.startsWith('tb1');
  }

  getWalletInfo(wallet) {
    return {
      type: wallet.type,
      network: wallet.network,
      addresses: {
        receiving: wallet.address,
        format: 'Testnet (bech32)',
      },
    };
  }
}

export default TestnetWalletGenerator;
