// Quick config verification script
require('dotenv').config();

console.log('🔍 Verifying Configuration...\n');
console.log('='.repeat(60));

// Bitcoin Configuration
console.log('📊 Bitcoin Configuration:');
console.log(`   Network: ${process.env.BITCOIN_NETWORK || 'NOT SET'}`);
console.log(`   Explorer: ${process.env.BITCOIN_EXPLORER_URL || 'NOT SET'}`);
console.log(`   Bridge Address: ${process.env.BITCOIN_BRIDGE_ADDRESS || 'NOT SET'}`);
console.log(`   Monitoring: ${process.env.ENABLE_BITCOIN_MONITORING || 'NOT SET'}`);

// Database Configuration
console.log('\n📊 Database Configuration:');
const hasDbConfig = process.env.DB_HOST || process.env.DB_NAME || process.env.DB_USER;
const hasDbPassword = process.env.DB_PASSWORD;

if (!hasDbConfig && !hasDbPassword) {
  console.log('   ✅ Database disabled (no DB variables set)');
  console.log('   System will run without database - perfect for testing!');
} else if (hasDbConfig && !hasDbPassword) {
  console.log('   ⚠️  Database partially configured (missing password)');
  console.log('   System will skip database connection - this is fine!');
} else if (hasDbPassword) {
  console.log('   ⚠️  Database password is set');
  console.log('   If you see password errors, comment out DB_PASSWORD in .env');
} else {
  console.log('   ✅ Database not configured - will run without it');
}

console.log('\n' + '='.repeat(60));
console.log('✅ Configuration check complete!');
console.log('\n💡 Next steps:');
console.log('   1. Start backend: npm start');
console.log('   2. Verify Bitcoin monitoring starts');
console.log('   3. Send testnet4 BTC to your bridge address');
console.log('   4. Wait for 6+ confirmations');
console.log('   5. Process via /api/bridge/btc-deposit');

