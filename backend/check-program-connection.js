#!/usr/bin/env node

/**
 * Check Program Connection
 * Verifies that the backend can connect to the deployed Solana program
 */

const { Connection, PublicKey } = require('@solana/web3.js');

async function checkProgramConnection() {
  console.log('🔍 Checking Solana Program Connection...\n');

  // Configuration
  const programId = process.env.PROGRAM_ID || '7ac8wtD5S9BRutHBMUoKMjpYepKSHVCgGaoN1etLjkd4';
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const network = process.env.SOLANA_NETWORK || 'devnet';

  console.log(`📡 RPC URL: ${rpcUrl}`);
  console.log(`🌐 Network: ${network}`);
  console.log(`📋 Program ID: ${programId}\n`);

  try {
    // Connect to Solana
    const connection = new Connection(rpcUrl, 'confirmed');

    // Check program account
    const programPubkey = new PublicKey(programId);
    const programAccount = await connection.getAccountInfo(programPubkey);

    if (!programAccount) {
      console.log('❌ Program not found!');
      console.log('   The program may have been closed or never deployed.');
      console.log('   Check the Program ID and network.');
      return false;
    }

    console.log('✅ Program found!');
    console.log(`   Owner: ${programAccount.owner.toBase58()}`);
    console.log(`   Executable: ${programAccount.executable}`);
    console.log(`   Balance: ${programAccount.lamports / 1_000_000_000} SOL`);

    // Check if it's an upgradeable program
    if (programAccount.owner.toBase58() === 'BPFLoaderUpgradeab1e111111111111111111111111') {
      console.log('   Type: Upgradeable Program');
    } else if (programAccount.owner.toBase58() === 'BPFLoader2111111111111111111111111111111111') {
      console.log('   Type: Executable Program');
    }

    console.log('\n🎉 Program connection successful!');
    console.log('   Ready to start the backend server.');

    return true;

  } catch (error) {
    console.log('❌ Connection failed!');
    console.log(`   Error: ${error.message}`);

    if (error.message.includes('Invalid public key')) {
      console.log('   → Check the PROGRAM_ID format');
    } else if (error.message.includes('fetch')) {
      console.log('   → Check the SOLANA_RPC_URL');
    } else if (error.message.includes('AccountNotFound')) {
      console.log('   → Program does not exist on this network');
    }

    return false;
  }
}

// Check environment
console.log('🔧 Environment Check:');
console.log(`   PROGRAM_ID: ${process.env.PROGRAM_ID || 'Not set (using default)'}`);
console.log(`   SOLANA_RPC_URL: ${process.env.SOLANA_RPC_URL || 'Not set (using default)'}`);
console.log(`   SOLANA_NETWORK: ${process.env.SOLANA_NETWORK || 'Not set (using default)'}\n`);

// Run check
checkProgramConnection().then(success => {
  if (!success) {
    console.log('\n💡 To fix connection issues:');
    console.log('   1. Verify PROGRAM_ID is correct');
    console.log('   2. Check SOLANA_RPC_URL is accessible');
    console.log('   3. Ensure program is deployed on the correct network');
    process.exit(1);
  }
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
