const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

// Enable garbage collection if available (for memory management)
if (typeof global.gc === 'undefined') {
  try {
    // Attempt to enable garbage collection
    require('v8').setFlagsFromString('--expose-gc');
    global.gc = require('v8').gc;
    console.log('✅ Garbage collection enabled for memory management');
  } catch (error) {
    console.log('ℹ️  Garbage collection not available (run with --expose-gc for better memory management)');
  }
}

// Ensure logs directory exists for crash logging
const fs = require('fs');
const path = require('path');
const logsDir = path.join(__dirname, '..', 'logs');
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log('📁 Created logs directory for crash logging');
  }
} catch (error) {
  console.warn('⚠️  Could not create logs directory:', error.message);
}

// Set default testnet environment variables if not configured
process.env.ENABLE_ARCIUM_MPC = process.env.ENABLE_ARCIUM_MPC || 'true';
process.env.ARCIUM_SIMULATED = process.env.ARCIUM_SIMULATED || 'true';
process.env.SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
process.env.SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'devnet';
// Only set mock PROGRAM_ID if not explicitly disabled
if (process.env.PROGRAM_ID === undefined) {
  process.env.PROGRAM_ID = process.env.ENABLE_ZENZEC !== 'false' ? 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS' : '';
}
process.env.ZENZEC_MINT = process.env.ZENZEC_MINT || 'MockZenZecMintAddress11111111111111111111111';
process.env.DATABASE_PATH = process.env.DATABASE_PATH || './database/flash-bridge.db';
process.env.BITCOIN_NETWORK = process.env.BITCOIN_NETWORK || 'testnet';
process.env.BITCOIN_EXPLORER_URL = process.env.BITCOIN_EXPLORER_URL || 'https://blockstream.info/testnet/api';
process.env.BITCOIN_BRIDGE_ADDRESS = process.env.BITCOIN_BRIDGE_ADDRESS || 'tb1qmockbitcoinaddress1234567890';
process.env.ZCASH_NETWORK = process.env.ZCASH_NETWORK || 'testnet';
process.env.ZCASH_EXPLORER_URL = process.env.ZCASH_EXPLORER_URL || 'https://lightwalletd.testnet.z.cash';
process.env.ZCASH_BRIDGE_ADDRESS = process.env.ZCASH_BRIDGE_ADDRESS || 'zs1mockzcashaddress1234567890';
process.env.ENABLE_RELAYER = process.env.ENABLE_RELAYER || 'false';
process.env.ENABLE_BTC_RELAYER = process.env.ENABLE_BTC_RELAYER || 'false';
process.env.PORT = process.env.PORT || '3001';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// =============================================================================
// CRASH PREVENTION & ERROR HANDLING
// =============================================================================

// Global uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('🚨 CRITICAL: Uncaught Exception - System would crash!');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);

  // Log to file if possible
  try {
    const fs = require('fs');
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'uncaughtException',
      error: error.message,
      stack: error.stack,
      uptime: process.uptime()
    };
    fs.appendFileSync('./logs/crash.log', JSON.stringify(logEntry) + '\n');
  } catch (logError) {
    console.error('Failed to write crash log:', logError.message);
  }

  // Graceful shutdown instead of immediate crash
  console.log('🔄 Attempting graceful shutdown...');
  setTimeout(() => {
    console.error('❌ Force shutdown due to uncaught exception');
    process.exit(1);
  }, 1000);
});

// Global unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 CRITICAL: Unhandled Promise Rejection - System would crash!');
  console.error('Reason:', reason);
  console.error('Promise:', promise);

  // Log to file if possible
  try {
    const fs = require('fs');
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'unhandledRejection',
      reason: reason?.message || reason,
      uptime: process.uptime()
    };
    fs.appendFileSync('./logs/crash.log', JSON.stringify(logEntry) + '\n');
  } catch (logError) {
    console.error('Failed to write crash log:', logError.message);
  }

  // Don't crash, just log and continue
  console.log('✅ Unhandled rejection logged, continuing operation...');
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received - Graceful shutdown initiated');
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received - Graceful shutdown initiated');
  gracefulShutdown('SIGINT');
});

// Memory monitoring and management
const memoryMonitor = () => {
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };

  // Critical memory threshold (500MB)
  if (memUsageMB.heapUsed > 500) {
    console.error('🚨 CRITICAL: Memory usage extremely high!', memUsageMB);
    console.error('🔄 Forcing garbage collection and cleanup...');

    // Force garbage collection
    if (global.gc) {
      global.gc();
      console.log('🗑️  Emergency garbage collection completed');
    }

    // Clear caches if available
    if (cryptoProofsService && cryptoProofsService.proofCache) {
      const cacheSize = cryptoProofsService.proofCache.size;
      cryptoProofsService.proofCache.clear();
      console.log(`🧹 Cleared ${cacheSize} cached proofs`);
    }

    // Check memory again after cleanup
    setTimeout(() => {
      const afterCleanup = process.memoryUsage();
      const afterMB = Math.round(afterCleanup.heapUsed / 1024 / 1024);
      if (afterMB > 400) {
        console.warn('⚠️  Memory still high after cleanup:', afterMB, 'MB');
      } else {
        console.log('✅ Memory usage normalized:', afterMB, 'MB');
      }
    }, 1000);

  // High memory warning (300MB)
  } else if (memUsageMB.heapUsed > 300) {
    console.warn('⚠️  High memory usage detected:', memUsageMB);

    // Force garbage collection if available
    if (global.gc) {
      console.log('🗑️  Running garbage collection...');
      global.gc();
    }

  // Normal memory logging (200MB)
  } else if (memUsageMB.heapUsed > 200) {
    console.log('📊 Memory usage:', memUsageMB);
  }

  // Periodic detailed logging (every 10 minutes)
  if (Math.random() < 0.0033) { // ~1 in 300 calls, ~10 minutes at 2min intervals
    console.log('📈 Detailed memory report:', memUsageMB);
  }
};

// Start memory monitoring
setInterval(memoryMonitor, 120000); // Check every 2 minutes
console.log('🧠 Memory monitoring enabled');

// Graceful shutdown function
async function gracefulShutdown(signal) {
  console.log(`🔄 Starting graceful shutdown (${signal})...`);

  try {
    // Close database connections
    if (databaseService && databaseService.isConnected()) {
      console.log('💾 Closing database connections...');
      await databaseService.close();
    }

    // Close any active connections
    console.log('🔌 Closing active connections...');
    // Add any additional cleanup here

    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
}

const bridgeRoutes = require('./routes/bridge');
const zcashRoutes = require('./routes/zcash');
const arciumRoutes = require('./routes/arcium');
const solanaService = require('./services/solana');
const relayerService = require('./services/relayer');
const zcashService = require('./services/zcash');
const arciumService = require('./services/arcium');
const bitcoinService = require('./services/bitcoin');
const zcashMonitor = require('./services/zcash-monitor');
const btcRelayer = require('./services/btc-relayer');
const btcDepositHandler = require('./services/btc-deposit-handler');
const configValidator = require('./utils/config-validator');
const databaseService = require('./services/database');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const ConfigValidator = require('./utils/configValidator');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'FLASH — BTC → ZEC (shielded) → Solana Bridge',
    description: 'Backend API for zenZEC minting and SOL swap relayer',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      bridge: '/api/bridge',
      zcash: '/api/zcash',
      arcium: '/api/arcium',
      health: '/health',
      bridgeInfo: '/api/bridge/info',
      zcashInfo: '/api/zcash/info',
      arciumStatus: '/api/arcium/status',
    },
    features: {
      privacy: 'ALWAYS ON - Full MPC encryption via Arcium',
      confidential: 'All transactions encrypted (mandatory)',
      mode: 'Complete Privacy',
    },
  });
});

app.get('/health', async (req, res) => {
  const arciumStatus = arciumService.getStatus();
  const zcashMonitorStatus = zcashMonitor.getStatus();
  const btcRelayerStatus = btcRelayer.getStatus();
  const configStatus = configValidator.getSummary();
  
  const health = {
    status: 'ok',
    relayerActive: relayerService.isListening,
    btcRelayerActive: btcRelayerStatus.isListening,
    arciumMPC: arciumStatus.enabled,
    privacy: 'full',  // ALWAYS full privacy
    privacyMode: 'mandatory',
    privacySimulated: arciumStatus.simulated,
    encrypted: true,
    zcashMonitoring: zcashMonitorStatus.isMonitoring,
    database: databaseService.isConnected(),
    configuration: configStatus,
    timestamp: new Date().toISOString(),
  };
  
  // If database is connected, add statistics
  if (databaseService.isConnected()) {
    try {
      const stats = await databaseService.getStatistics();
      health.databaseStats = stats;
    } catch (error) {
      console.error('Error fetching database stats:', error);
    }
  }
  
  res.json(health);
});

app.use('/api/bridge', bridgeRoutes);
app.use('/api/zcash', zcashRoutes);
app.use('/api/arcium', arciumRoutes);

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, async () => {
  console.log('='.repeat(60));
  console.log('FLASH — BTC → USDC Treasury → Token Bridge (MVP)');
  console.log('='.repeat(60));
  
  // Validate configuration
  console.log('Validating configuration...');
  const configValidation = ConfigValidator.validate(false); // Non-strict for MVP
  ConfigValidator.logResults(configValidation);
  
  if (!configValidation.valid) {
    console.error('⚠️  Configuration errors detected. Some features may not work correctly.');
  }
  
  console.log('='.repeat(60));
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Solana Network: ${process.env.SOLANA_NETWORK || 'devnet'}`);
  console.log(`Program ID: ${process.env.PROGRAM_ID || 'Not configured (optional for BTC deposit flow)'}`);
  console.log(`Treasury: Using USDC treasury + Jupiter swaps (no zenZEC mint needed)`);
  console.log(`Zcash Network: ${process.env.ZCASH_NETWORK || 'mainnet'}`);
  if (process.env.USE_ZECWALLET_CLI === 'true') {
    console.log('Zcash Wallet: Enabled (zecwallet-light-cli)');
    try {
      const zcashWallet = require('./services/zcash-wallet');
      await zcashWallet.initializeWallet();
      const bridgeAddress = await zcashWallet.getBridgeAddress();
      console.log(`Zcash Bridge Address: ${bridgeAddress} (from wallet)`);
      const balance = await zcashWallet.getBalance();
      console.log(`Zcash Balance: ${balance.total} ZEC (${balance.confirmed} confirmed)`);
    } catch (error) {
      console.warn(`Zcash Wallet: Initialization failed - ${error.message}`);
      console.warn('Falling back to manual address configuration');
    }
  } else {
    console.log(`Zcash Bridge: ${process.env.ZCASH_BRIDGE_ADDRESS ? 'Configured' : 'Not configured'}`);
    console.log('Zcash Wallet: Disabled (set USE_ZECWALLET_CLI=true to enable)');
  }
  console.log(`Bitcoin Network: ${process.env.BITCOIN_NETWORK || 'mainnet'}`);
  console.log(`Bitcoin Bridge: ${process.env.BITCOIN_BRIDGE_ADDRESS ? 'Configured' : 'Not configured'}`);
  console.log('='.repeat(60));
  
  // Initialize Database
  console.log('Initializing database...');
  try {
    const dbConnected = await databaseService.initialize();
    if (dbConnected) {
      console.log('Database: Connected');
    } else {
      console.warn('Database: Connection failed - transactions will not be persisted');
      console.warn('Set DB_HOST, DB_NAME, DB_USER, DB_PASSWORD in .env to enable database');
    }
  } catch (error) {
    console.error('Database initialization error:', error.message);
    console.warn('Continuing without database - transactions will not be persisted');
  }
  console.log('='.repeat(60));
  
  // Validate Configuration
  const validation = configValidator.validate();
  configValidator.printResults();
  
  if (!validation.valid) {
    console.error('\n❌ Cannot start with invalid configuration');
    console.error('ℹ️  See ENV_SETUP.md or QUICK_START.md for help\n');
    process.exit(1);
  }
  
  // Initialize Arcium MPC - REQUIRED for complete privacy
  console.log('🔒 Initializing Arcium MPC Privacy Layer...');
    try {
      await arciumService.initialize();
      const arciumStatus = arciumService.getStatus();
    
    if (!arciumStatus.enabled || !arciumStatus.connected) {
      console.error('❌ CRITICAL: Arcium MPC is not available - cannot start without privacy');
      console.error('');
      console.error('📝 Quick Fix:');
      console.error('   1. Create .env file in backend/ directory');
      console.error('   2. Add: ENABLE_ARCIUM_MPC=true');
      console.error('   3. Restart the server');
      console.error('');
      console.error('ℹ️  For MVP: This enables simulated privacy (no real Arcium network needed)');
      console.error('ℹ️  See ENV_SETUP.md for complete configuration guide');
      process.exit(1);
    }
    
    console.log('✅ Privacy Mode: FULL');
    console.log(`   Mode: ${arciumStatus.mode}`);
    console.log(`   - Encrypted amounts: ${arciumStatus.features.encryptedAmounts ? '✓' : '✗'}`);
    console.log(`   - Private verification: ${arciumStatus.features.privateVerification ? '✓' : '✗'}`);
    console.log(`   - Trustless randomness: ${arciumStatus.features.trustlessRandom ? '✓' : '✗'}`);
    console.log(`   - Encrypted addresses: ${arciumStatus.features.encryptedAddresses ? '✓' : '✗'}`);
    } catch (error) {
    console.error('❌ FATAL: Failed to initialize Arcium MPC');
    console.error('');
    console.error(error.message);
    console.error('');
    console.error('ℹ️  See ENV_SETUP.md for configuration help');
    process.exit(1);
  }
  
  console.log('='.repeat(60));

  // Initialize Bitcoin service
  console.log('Initializing Bitcoin service...');
  try {
    await bitcoinService.initialize();
    const bitcoinInfo = bitcoinService.getNetworkInfo();
    console.log(`Bitcoin Bridge Address: ${bitcoinInfo.bridgeAddress || 'Not configured'}`);
    console.log(`Bitcoin Reserve: ${bitcoinInfo.currentReserveBTC} BTC`);
    
    // Start Bitcoin monitoring if enabled
    if (process.env.ENABLE_BITCOIN_MONITORING === 'true' && bitcoinInfo.bridgeAddress) {
      console.log('Starting Bitcoin monitoring...');
      await bitcoinService.startMonitoring(async (payment) => {
        console.log(`\n🔔 New Bitcoin payment detected:`);
        console.log(`   Amount: ${payment.amount / 100000000} BTC`);
        console.log(`   Transaction: ${payment.txHash}`);
        console.log(`   Confirmations: ${payment.confirmations}`);
        
        // Get user's Solana address from payment metadata or API
        // For demo: User provides address via API endpoint
        // In production: This would be stored when user initiates bridge
        
        // Note: User must call API endpoint with their Solana address
        // The monitoring just detects the BTC deposit
        console.log(`   ⚠️  User must call /api/bridge/btc-deposit with their Solana address`);
      });
      console.log('Bitcoin monitoring started successfully');
      console.log('   Users can claim deposits via POST /api/bridge/btc-deposit');
    } else {
      console.log('Bitcoin monitoring disabled (set ENABLE_BITCOIN_MONITORING=true to enable)');
    }

    // Start Zcash monitoring if wallet is enabled
    if (process.env.USE_ZECWALLET_CLI === 'true' && process.env.ENABLE_ZCASH_MONITORING === 'true') {
      console.log('Starting Zcash transaction monitoring...');
      try {
        await zcashMonitor.startMonitoring(async (payment) => {
          console.log(`New Zcash payment detected: ${payment.txHash}`);
          console.log(`Bridge address: ${payment.bridgeAddress}`);
          // In production, this would trigger zenZEC minting automatically
          // Example: await bridgeService.autoMint(payment);
        });
        console.log('Zcash monitoring started successfully');
      } catch (error) {
        console.error('Failed to start Zcash monitoring:', error.message);
      }
    } else if (process.env.USE_ZECWALLET_CLI === 'true') {
      console.log('Zcash monitoring disabled (set ENABLE_ZCASH_MONITORING=true to enable)');
    }
  } catch (error) {
    console.error('Failed to initialize Bitcoin service:', error.message);
  }
  
  console.log('='.repeat(60));

  // Start relayer listener if enabled
  if (process.env.ENABLE_RELAYER === 'true') {
    console.log('Starting SOL relayer service...');
    try {
      await relayerService.startListening();
      console.log('SOL relayer service started successfully');
    } catch (error) {
      console.error('Failed to start SOL relayer:', error.message);
    }
  } else {
    console.log('SOL relayer disabled (set ENABLE_RELAYER=true to enable)');
  }

  // Start BTC relayer listener if enabled
  if (process.env.ENABLE_BTC_RELAYER === 'true') {
    console.log('Starting BTC relayer service...');
    try {
      await btcRelayer.startListening();
      console.log('BTC relayer service started successfully');
    } catch (error) {
      console.error('Failed to start BTC relayer:', error.message);
    }
  } else {
    console.log('BTC relayer disabled (set ENABLE_BTC_RELAYER=true to enable)');
  }
  
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  bitcoinService.stopMonitoring();
  relayerService.stopListening();
  btcRelayer.stopListening();
  
  // Close database connection
  if (databaseService.isConnected()) {
    await databaseService.close();
  }
  
  process.exit(0);
});

module.exports = app;
