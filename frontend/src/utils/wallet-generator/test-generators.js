// Test script to verify wallet generators work
import TestnetWalletGenerator from './index.js';

async function testWalletGenerators() {
  console.log('🧪 Testing Testnet Wallet Generators...\n');

  const generator = new TestnetWalletGenerator();
  const result = await generator.generateAllWallets();

  if (result.success) {
    console.log('✅ All wallet generators working!\n');

    // Test Bitcoin wallet
    const btcWallet = result.wallets.bitcoin;
    console.log('₿ Bitcoin Testnet Wallet:');
    console.log('  Address:', btcWallet.address);
    console.log('  WIF:', btcWallet.wif.substring(0, 20) + '...');
    console.log('  Valid format:', btcWallet.address.startsWith('m') || btcWallet.address.startsWith('n'));
    console.log();

    // Test Zcash wallet
    const zecWallet = result.wallets.zcash;
    console.log('🛡️ Zcash Testnet Wallet:');
    console.log('  Transparent:', zecWallet.transparentAddress);
    console.log('  Shielded:', zecWallet.shieldedAddress.substring(0, 20) + '...');
    console.log('  Valid t-addr:', zecWallet.transparentAddress.startsWith('t'));
    console.log('  Valid z-addr:', zecWallet.shieldedAddress.startsWith('zs'));
    console.log();

    // Test Solana wallet
    const solWallet = result.wallets.solana;
    console.log('☀️ Solana Devnet Wallet:');
    console.log('  Address:', solWallet.address);
    console.log('  Private Key:', solWallet.privateKey.substring(0, 20) + '...');
    console.log('  Valid length:', solWallet.address.length >= 32);
    console.log();

    console.log('🎯 All testnet wallets generated successfully!');
    console.log('💡 Copy these addresses to test the FLASH Bridge end-to-end.');

  } else {
    console.error('❌ Wallet generation failed:', result.error);
  }
}

// Run the test
testWalletGenerators().catch(console.error);
