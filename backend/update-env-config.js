const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

// Read current .env
let envContent = fs.readFileSync(envPath, 'utf8');

// Split into lines
const lines = envContent.split('\n');
const newLines = [];

let bitcoinNetworkSet = false;
let bitcoinExplorerSet = false;
let bitcoinAddressSet = false;
let monitoringSet = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.startsWith('BITCOIN_NETWORK=')) {
    newLines.push('BITCOIN_NETWORK=testnet4');
    bitcoinNetworkSet = true;
  } else if (line.startsWith('BITCOIN_EXPLORER_URL=')) {
    newLines.push('BITCOIN_EXPLORER_URL=https://mempool.space/testnet4/api');
    bitcoinExplorerSet = true;
  } else if (line.startsWith('BITCOIN_BRIDGE_ADDRESS=')) {
    newLines.push('BITCOIN_BRIDGE_ADDRESS=tb1qug4w70zdr40clj9qecy67tx58e24lk90whzy9l');
    bitcoinAddressSet = true;
  } else if (line.startsWith('ENABLE_BITCOIN_MONITORING=')) {
    newLines.push('ENABLE_BITCOIN_MONITORING=true');
    monitoringSet = true;
  } else {
    newLines.push(line);
  }
}

// Add missing settings
if (!bitcoinNetworkSet) {
  newLines.push('BITCOIN_NETWORK=testnet4');
}
if (!bitcoinExplorerSet) {
  newLines.push('BITCOIN_EXPLORER_URL=https://mempool.space/testnet4/api');
}
if (!bitcoinAddressSet) {
  newLines.push('BITCOIN_BRIDGE_ADDRESS=tb1qug4w70zdr40clj9qecy67tx58e24lk90whzy9l');
}
if (!monitoringSet) {
  newLines.push('ENABLE_BITCOIN_MONITORING=true');
}

// Write back
fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');

console.log('✅ .env file updated successfully!');
console.log('\n📝 Bitcoin Configuration:');
console.log('   BITCOIN_NETWORK=testnet4');
console.log('   BITCOIN_EXPLORER_URL=https://mempool.space/testnet4/api');
console.log('   BITCOIN_BRIDGE_ADDRESS=tb1qug4w70zdr40clj9qecy67tx58e24lk90whzy9l');
console.log('   ENABLE_BITCOIN_MONITORING=true');
