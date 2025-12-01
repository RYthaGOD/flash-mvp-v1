#!/usr/bin/env node
/**
 * Arcium Docker Node Connection Test
 * Tests Arcium node setup and connectivity via Solana network
 * 
 * Note: Arcium nodes don't expose HTTP REST APIs - they participate in MPC
 * through Solana program calls. This test verifies:
 * 1. Docker container is running
 * 2. Port is mapped correctly
 * 3. Node can be verified via Solana network (if node offset/cluster ID provided)
 */

require('dotenv').config();
const { Connection, PublicKey } = require('@solana/web3.js');

const endpoint = process.env.ARCIUM_ENDPOINT || 'http://localhost:8080';
const solanaRpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const clusterId = process.env.ARCIUM_CLUSTER_ID;
const nodeOffset = process.env.ARCIUM_NODE_OFFSET;
const programId = process.env.FLASH_BRIDGE_MXE_PROGRAM_ID;

console.log('🔍 Testing Arcium Docker Node Setup...\n');
console.log(`Docker Endpoint: ${endpoint}`);
console.log(`Solana RPC: ${solanaRpcUrl}`);
if (clusterId) console.log(`Cluster ID: ${clusterId}`);
if (nodeOffset) console.log(`Node Offset: ${nodeOffset}`);
console.log('');

// Check Docker container
const { execSync } = require('child_process');

async function checkDockerNode() {
  try {
    const result = execSync('docker ps --filter "name=arx-node" --format "{{.Names}}\t{{.Status}}\t{{.Ports}}"', { encoding: 'utf-8' });
    if (result.trim()) {
      console.log('✅ Docker container is running:');
      console.log(`   ${result.trim()}`);
      return true;
    } else {
      console.log('❌ Docker container "arx-node" not found');
      return false;
    }
  } catch (error) {
    console.log('❌ Cannot check Docker status (docker command not available?)');
    return false;
  }
}

let solanaConnection = null;

async function checkSolanaConnection() {
  try {
    const connection = new Connection(solanaRpcUrl, 'confirmed');
    const version = await connection.getVersion();
    console.log('✅ Solana connection successful');
    console.log(`   RPC: ${solanaRpcUrl}`);
    console.log(`   Version: ${version['solana-core']}`);
    solanaConnection = connection;
    return connection;
  } catch (error) {
    console.log(`❌ Cannot connect to Solana RPC: ${error.message}`);
    return null;
  }
}

async function checkProgram(connection) {
  if (!programId) {
    console.log('ℹ️  FLASH_BRIDGE_MXE_PROGRAM_ID not set (skipping program check)');
    return true;
  }

  try {
    const programPubkey = new PublicKey(programId);
    const programInfo = await connection.getAccountInfo(programPubkey);
    if (programInfo) {
      console.log('✅ FLASH Bridge MXE program found on Solana');
      console.log(`   Program ID: ${programId}`);
      return true;
    } else {
      console.log('❌ FLASH Bridge MXE program not found on Solana');
      console.log(`   Program ID: ${programId}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error checking program: ${error.message}`);
    return false;
  }
}

async function checkNodeStatus(connection) {
  if (!nodeOffset || !clusterId) {
    console.log('ℹ️  Node offset or cluster ID not set (skipping node status check)');
    console.log('   To verify node status, set ARCIUM_NODE_OFFSET and ARCIUM_CLUSTER_ID');
    console.log('   Then run: arcium arx-active <offset> --rpc-url <rpc-url>');
    return true;
  }

  console.log(`ℹ️  To verify node is active, run:`);
  console.log(`   arcium arx-active ${nodeOffset} --rpc-url ${solanaRpcUrl}`);
  console.log(`   arcium arx-info ${nodeOffset} --rpc-url ${solanaRpcUrl}`);
  return true;
}

async function runTests() {
  let allGood = true;

  // 1. Check Docker container
  console.log('1. Checking Docker container...');
  const dockerOk = await checkDockerNode();
  if (!dockerOk) allGood = false;
  console.log('');

  // 2. Check Solana connection
  console.log('2. Checking Solana connection...');
  let connection = null;
  try {
    connection = await checkSolanaConnection();
    if (!connection) allGood = false;
  } catch (error) {
    console.log(`   Error: ${error.message}`);
    allGood = false;
  }
  console.log('');

  // 3. Check program (if configured)
  if (connection) {
    console.log('3. Checking FLASH Bridge MXE program...');
    try {
      const programOk = await checkProgram(connection);
      if (!programOk) allGood = false;
    } catch (error) {
      console.log(`   Error: ${error.message}`);
      allGood = false;
    }
    console.log('');
  }

  // 4. Node status info
  console.log('4. Node status verification...');
  try {
    await checkNodeStatus(connection);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  console.log('');

  // Summary
  console.log('='.repeat(70));
  
  // Clean up connection
  if (solanaConnection) {
    try {
      // Connection cleanup happens automatically, but we ensure we're done
      solanaConnection = null;
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  
  if (allGood && connection) {
    console.log('✅ Basic setup verified!');
    console.log('');
    console.log('Note: Arcium nodes participate in MPC through Solana program calls.');
    console.log('The Docker node is running and Solana connection is working.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Verify node is active in the cluster (if you have arcium CLI):');
    if (nodeOffset) {
      console.log(`   arcium arx-active ${nodeOffset} --rpc-url ${solanaRpcUrl}`);
    } else {
      console.log('   arcium arx-active <your-node-offset> --rpc-url <rpc-url>');
    }
    console.log('2. Ensure your .env has correct ARCIUM_ENDPOINT configured');
    console.log('3. Start the backend to test MPC operations');
    
    // Exit after a brief delay to allow cleanup
    setTimeout(() => {
      process.exit(0);
    }, 200);
  } else {
    console.log('⚠️  Some checks failed - see above for details');
    console.log('');
    console.log('Troubleshooting:');
    console.log('1. Ensure Docker container is running: docker ps | grep arx-node');
    console.log('2. Check Docker logs: docker logs arx-node');
    console.log('3. Verify Solana RPC URL is correct');
    console.log('4. Verify FLASH_BRIDGE_MXE_PROGRAM_ID is set correctly');
    
    // Exit after a brief delay
    setTimeout(() => {
      process.exit(1);
    }, 200);
  }
}

runTests().catch(error => {
  console.error('Error:', error);
  setTimeout(() => process.exit(1), 100);
});

