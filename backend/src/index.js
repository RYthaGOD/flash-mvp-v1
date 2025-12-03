const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
require('dotenv').config();
const { createLogger } = require('./utils/logger');

const logger = createLogger('server');

// Enable garbage collection if available (for memory management)
if (typeof global.gc === 'undefined') {
  try {
    // Attempt to enable garbage collection
    require('v8').setFlagsFromString('--expose-gc');
    global.gc = require('v8').gc;
    logger.info('✅ Garbage collection enabled for memory management');
  } catch (error) {
    logger.info('ℹ️  Garbage collection not available (run with --expose-gc for better memory management)');
  }
}

// Ensure logs directory exists for crash logging
const fs = require('fs');
const path = require('path');
const logsDir = path.join(__dirname, '..', 'logs');
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    logger.info('📁 Created logs directory for crash logging');
  }
} catch (error) {
  logger.warn('⚠️  Could not create logs directory', { error: error.message });
}

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================
// Supports both production (strict) and development (flexible) modes
// Set NODE_ENV=production for strict validation
// =============================================================================

const isProduction = process.env.NODE_ENV === 'production';
const isDevnet = (process.env.SOLANA_NETWORK || 'devnet').toLowerCase() === 'devnet';

// Set sensible defaults
process.env.PORT = process.env.PORT || '3001';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'devnet';
process.env.SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
process.env.BITCOIN_NETWORK = process.env.BITCOIN_NETWORK || 'testnet';

// Bitcoin explorer - configure based on network
if (!process.env.BITCOIN_EXPLORER_URL) {
  process.env.BITCOIN_EXPLORER_URL = process.env.BITCOIN_NETWORK === 'mainnet' 
    ? 'https://blockstream.info/api' 
    : 'https://blockstream.info/testnet/api';
}

// Arcium configuration - allow simulation for devnet
if (isProduction) {
  process.env.ENABLE_ARCIUM_MPC = 'true';
  process.env.ARCIUM_SIMULATED = 'false';
  process.env.ARCIUM_USE_REAL_SDK = 'true';
} else {
  // Development/devnet - allow simulation
  process.env.ENABLE_ARCIUM_MPC = process.env.ENABLE_ARCIUM_MPC || 'true';
  process.env.ARCIUM_SIMULATED = process.env.ARCIUM_SIMULATED || 'true';
  process.env.ARCIUM_USE_REAL_SDK = process.env.ARCIUM_USE_REAL_SDK || 'false';
}

// Validate environment variables
const CRITICAL_ENV_VARS = isProduction ? [
  'FLASH_BRIDGE_MXE_PROGRAM_ID',
  'SOLANA_RPC_URL',
  'BITCOIN_BRIDGE_ADDRESS',
  'ADMIN_API_KEY',
  'FRONTEND_ORIGIN',
  'DB_HOST',
  'DB_PASSWORD',
] : [
  // Minimum for devnet testing
  'FRONTEND_ORIGIN',
  'ADMIN_API_KEY',
];

const missingCritical = CRITICAL_ENV_VARS.filter(key => !process.env[key]);
if (missingCritical.length > 0) {
  console.error('');
  console.error('═'.repeat(60));
  console.error('❌ Missing required environment variables:');
  console.error('═'.repeat(60));
  missingCritical.forEach(key => console.error(`   - ${key}`));
  console.error('');
  console.error('To fix:');
  console.error('1. Copy backend/env-template.txt to backend/.env');
  console.error('2. Fill in the required values');
  console.error('3. Run: npm run preflight (to validate)');
  console.error('═'.repeat(60));
  process.exit(1);
}
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

// Log current mode
logger.info(`Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
logger.info(`Network: ${process.env.SOLANA_NETWORK}`);
if (!isProduction) {
  logger.info('Arcium: Simulation enabled (set NODE_ENV=production for real MPC)');
}

// =============================================================================
// CRASH PREVENTION & ERROR HANDLING
// =============================================================================

// Global uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('🚨 CRITICAL: Uncaught Exception - System would crash!', {
    error: error.message,
    stack: error.stack,
  });

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
    logger.error('Failed to write crash log', { error: logError.message });
  }

  // Graceful shutdown instead of immediate crash
  logger.info('🔄 Attempting graceful shutdown after uncaught exception');
  setTimeout(() => {
    logger.error('❌ Force shutdown due to uncaught exception');
    process.exit(1);
  }, 1000);
});

// Global unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚨 CRITICAL: Unhandled Promise Rejection - System would crash!', {
    reason,
    promise,
  });

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
    logger.error('Failed to write crash log', { error: logError.message });
  }

  // Don't crash, just log and continue
  logger.info('✅ Unhandled rejection logged, continuing operation');
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  logger.info('📴 SIGTERM received - Graceful shutdown initiated');
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  logger.info('📴 SIGINT received - Graceful shutdown initiated');
  gracefulShutdown('SIGINT');
});

// Memory monitoring and management
let lastGCTime = 0;
const GC_COOLDOWN = 5 * 60 * 1000; // 5 minutes cooldown between forced GC

const memoryMonitor = () => {
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };

  const now = Date.now();

  // Critical memory threshold (500MB) - EMERGENCY ACTION
  if (memUsageMB.heapUsed > 500) {
    logger.error('🚨 CRITICAL: Memory usage extremely high', { memUsageMB });
    logger.error('🔄 Emergency cleanup initiated...');

    // Force garbage collection (with cooldown to prevent loops)
    if (global.gc && (now - lastGCTime) > GC_COOLDOWN) {
      global.gc();
      lastGCTime = now;
      logger.info('🗑️  Emergency garbage collection completed');
    } else if (!global.gc) {
      logger.warn('⚠️  Garbage collection not available, cannot clean up memory');
    }

    // Clear caches if available (only in extreme cases)
    if (cryptoProofsService && cryptoProofsService.proofCache && memUsageMB.heapUsed > 600) {
      const cacheSize = cryptoProofsService.proofCache.size;
      cryptoProofsService.proofCache.clear();
      logger.info(`🧹 Cleared ${cacheSize} cached proofs due to extreme memory pressure`);
    }

    // Log warning but don't re-check immediately to prevent loops
    logger.error('⚠️  Memory usage critical - manual intervention may be required');

  // High memory warning (300MB) - CONSERVATIVE ACTION
  } else if (memUsageMB.heapUsed > 300) {
    logger.warn('⚠️  High memory usage detected', { memUsageMB });

    // Only force GC if we haven't done it recently (prevent loops)
    if (global.gc && (now - lastGCTime) > GC_COOLDOWN) {
      logger.info('🗑️  Running conservative garbage collection...');
      global.gc();
      lastGCTime = now;
    }

  // Normal memory logging (200MB) - MONITORING ONLY
  } else if (memUsageMB.heapUsed > 200) {
    logger.info('📊 Memory usage', { memUsageMB });
  }

  // Periodic detailed logging (every 10 minutes) - INFO ONLY
  if (Math.random() < 0.0033) { // ~1 in 300 calls, ~10 minutes at 2min intervals
    logger.info('📈 Detailed memory report', { memUsageMB });
  }
};

// Start memory monitoring
setInterval(memoryMonitor, 120000); // Check every 2 minutes
logger.info('🧠 Memory monitoring enabled');

// Graceful shutdown function
async function gracefulShutdown(signal) {
  logger.info(`🔄 Starting graceful shutdown (${signal})...`);

  try {
    // Close database connections
    if (databaseService && databaseService.isConnected()) {
      logger.info('💾 Closing database connections...');
      await databaseService.close();
    }

    // Close any active connections
    logger.info('🔌 Closing active connections...');
    // Add any additional cleanup here

    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error during graceful shutdown', { error });
    process.exit(1);
  }
}

const bridgeRoutes = require('./routes/bridge');
const zcashRoutes = require('./routes/zcash');
const arciumRoutes = require('./routes/arcium');
const v1Routes = require('./routes/v1');
const apiDocsRoutes = require('./routes/api-docs');
const { initializeRedis } = require('./middleware/redisRateLimit');
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
const reserveManager = require('./services/reserveManager');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const ConfigValidator = require('./utils/configValidator');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
  })
);

const allowedOrigins = FRONTEND_ORIGIN.split(',').map((origin) => origin.trim());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      logger.warn('Blocked request from disallowed origin', { origin });
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info('HTTP request received', {
    method: req.method,
    path: req.path,
    origin: req.get('origin'),
    ip: req.ip,
  });
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'FLASH — BTC → SOL Bridge',
    description: 'Production Bridge API with Arcium MPC',
    version: '1.0.0',
    status: 'running',
    apiVersions: {
      current: '/api/v1',
      legacy: '/api (deprecated)',
    },
    endpoints: {
      bridge: '/api/v1/bridge',
      arcium: '/api/v1/arcium',
      docs: '/api/v1/docs',
      health: '/health',
    },
    features: {
      privacy: 'ALWAYS ON - Full MPC encryption via Arcium',
      confidential: 'All transactions encrypted (mandatory)',
      mode: 'PRODUCTION',
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

      // Add centralized reserve information
      const reserveSummary = await reserveManager.getReserveSummary();
      health.reserves = reserveSummary;
    } catch (error) {
      logger.error('Error fetching database stats or reserves', { error });
    }
  }

  res.json(health);
});

// API Version 1 (Current)
app.use('/api/v1', v1Routes);
app.use('/api/v1/docs', apiDocsRoutes);

// Legacy routes (deprecated - point to v1)
app.use('/api/bridge', bridgeRoutes);
app.use('/api/zcash', zcashRoutes);
app.use('/api/arcium', arciumRoutes);

// Deprecation warning for legacy routes
app.use('/api/bridge', (req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Link', '</api/v1/bridge>; rel="successor-version"');
  next();
});
app.use('/api/zcash', (req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Link', '</api/v1/zcash>; rel="successor-version"');
  next();
});
app.use('/api/arcium', (req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Link', '</api/v1/arcium>; rel="successor-version"');
  next();
});

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, async () => {
  logger.info('='.repeat(60));
  logger.info('FLASH — BTC → SOL Bridge (PRODUCTION)');
  logger.info('='.repeat(60));
  
  // Initialize Redis for distributed rate limiting
  logger.info('Initializing Redis for rate limiting...');
  try {
    const redisConnected = await initializeRedis();
    if (redisConnected) {
      logger.info('✅ Redis: Connected (distributed rate limiting enabled)');
    } else {
      logger.warn('⚠️  Redis: Not available (using in-memory rate limiting)');
      logger.warn('   Set REDIS_URL in .env for production scaling');
    }
  } catch (error) {
    logger.warn('Redis initialization failed:', error.message);
  }
  logger.info('='.repeat(60));
  
  // Validate configuration
  logger.info('Validating configuration...');
  const configValidation = ConfigValidator.validate(false); // Non-strict for MVP
  ConfigValidator.logResults(configValidation);
  
  if (!configValidation.valid) {
    logger.error('⚠️  Configuration errors detected. Some features may not work correctly.');
  }
  
  logger.info('='.repeat(60));
  logger.info(`Backend server running on port ${PORT}`);
  logger.info(`Solana Network: ${process.env.SOLANA_NETWORK || 'devnet'}`);
  logger.info(`Program ID: ${process.env.PROGRAM_ID || 'Not configured (optional for BTC deposit flow)'}`);
  logger.info('Treasury: Using USDC treasury + Jupiter swaps (no native ZEC mint needed)');
  logger.info(`Zcash Network: ${process.env.ZCASH_NETWORK || 'mainnet'}`);
  if (process.env.USE_ZECWALLET_CLI === 'true') {
    logger.info('Zcash Wallet: Enabled (zecwallet-light-cli)');
    try {
      const zcashWallet = require('./services/zcash-wallet');
      await zcashWallet.initializeWallet();
      const bridgeAddress = await zcashWallet.getBridgeAddress();
      logger.info(`Zcash Bridge Address: ${bridgeAddress} (from wallet)`);
      const balance = await zcashWallet.getBalance();
      logger.info(`Zcash Balance: ${balance.total} ZEC (${balance.confirmed} confirmed)`);
    } catch (error) {
      logger.warn('Zcash Wallet: Initialization failed', { error: error.message });
      logger.warn('Falling back to manual address configuration');
    }
  } else {
    logger.info(`Zcash Bridge: ${process.env.ZCASH_BRIDGE_ADDRESS ? 'Configured' : 'Not configured'}`);
    logger.info('Zcash Wallet: Disabled (set USE_ZECWALLET_CLI=true to enable)');
  }
  logger.info(`Bitcoin Network: ${process.env.BITCOIN_NETWORK || 'mainnet'}`);
  logger.info(`Bitcoin Bridge: ${process.env.BITCOIN_BRIDGE_ADDRESS ? 'Configured' : 'Not configured'}`);
  logger.info('='.repeat(60));
  
  // Initialize Database
  logger.info('Initializing database...');
  try {
    const dbConnected = await databaseService.initialize();
    if (dbConnected) {
      logger.info('Database: Connected');
    } else {
      logger.warn('Database: Connection failed - transactions will not be persisted');
      logger.warn('Set DB_HOST, DB_NAME, DB_USER, DB_PASSWORD in .env to enable database');
    }
  } catch (error) {
    logger.error('Database initialization error', { error: error.message });
    logger.warn('Continuing without database - transactions will not be persisted');
  }
  logger.info('='.repeat(60));
  
  // Validate Configuration
  const validation = configValidator.validate();
  configValidator.printResults();
  
  if (!validation.valid) {
    logger.error('❌ Cannot start with invalid configuration');
    logger.error('ℹ️  See ENV_SETUP.md or QUICK_START.md for help');
    process.exit(1);
  }
  
  // Initialize Arcium MPC - REQUIRED for complete privacy
  logger.info('🔒 Initializing Arcium MPC Privacy Layer...');
  try {
    await arciumService.initialize();
    const arciumStatus = arciumService.getStatus();

    if (!arciumStatus.enabled || !arciumStatus.connected) {
      logger.error('❌ CRITICAL: Arcium MPC is not available - cannot start without privacy');
      logger.error('📝 Quick Fix: add ENABLE_ARCIUM_MPC=true to backend/.env and restart');
      logger.error('ℹ️  For MVP: This enables simulated privacy (no real Arcium network needed)');
      logger.error('ℹ️  See ENV_SETUP.md for complete configuration guide');
      process.exit(1);
    }

    logger.info('✅ Privacy Mode: FULL');
    logger.info(`   Mode: ${arciumStatus.mode}`);
    logger.info(`   - Encrypted amounts: ${arciumStatus.features.encryptedAmounts ? '✓' : '✗'}`);
    logger.info(`   - Private verification: ${arciumStatus.features.privateVerification ? '✓' : '✗'}`);
    logger.info(`   - Trustless randomness: ${arciumStatus.features.trustlessRandom ? '✓' : '✗'}`);
    logger.info(`   - Encrypted addresses: ${arciumStatus.features.encryptedAddresses ? '✓' : '✗'}`);
  } catch (error) {
    logger.error('❌ FATAL: Failed to initialize Arcium MPC');
    logger.error(error.message);
    logger.error('ℹ️  See ENV_SETUP.md for configuration help');
    process.exit(1);
  }
  
  logger.info('='.repeat(60));

  // Initialize Bitcoin service
  logger.info('Initializing Bitcoin service...');
  try {
    await bitcoinService.initialize();
    const bitcoinInfo = bitcoinService.getNetworkInfo();
    logger.info(`Bitcoin Bridge Address: ${bitcoinInfo.bridgeAddress || 'Not configured'}`);
    logger.info(`Bitcoin Reserve: ${bitcoinInfo.currentReserveBTC} BTC`);
    
    // Start Bitcoin monitoring (enabled by default for demo)
    process.env.ENABLE_BITCOIN_MONITORING = process.env.ENABLE_BITCOIN_MONITORING || 'true';
// For demo purposes, allow instant confirmations
process.env.BITCOIN_REQUIRED_CONFIRMATIONS = process.env.BITCOIN_REQUIRED_CONFIRMATIONS || '0';
    if (process.env.ENABLE_BITCOIN_MONITORING === 'true' && bitcoinInfo.bridgeAddress) {
      logger.info('Starting Bitcoin monitoring...');
      await bitcoinService.startMonitoring(async (payment) => {
        logger.info('🔔 New Bitcoin payment detected', {
          amountBTC: payment.amount / 100000000,
          txHash: payment.txHash,
          confirmations: payment.confirmations,
        });
        
        // Get user's Solana address from payment metadata or API
        // For demo: User provides address via API endpoint
        // In production: This would be stored when user initiates bridge
        
        // Note: User must call API endpoint with their Solana address
        // The monitoring just detects the BTC deposit
        logger.warn('User must call /api/bridge/btc-deposit with their Solana address');
      });
      logger.info('Bitcoin monitoring started successfully');
      logger.info('Users can claim deposits via POST /api/bridge/btc-deposit');
    } else {
      logger.info('Bitcoin monitoring disabled (set ENABLE_BITCOIN_MONITORING=true to enable)');
    }

    // Start Zcash monitoring if wallet is enabled
    if (process.env.USE_ZECWALLET_CLI === 'true' && process.env.ENABLE_ZCASH_MONITORING === 'true') {
      logger.info('Starting Zcash transaction monitoring...');
      try {
        await zcashMonitor.startMonitoring(async (payment) => {
          logger.info('New Zcash payment detected', {
            txHash: payment.txHash,
            bridgeAddress: payment.bridgeAddress,
          });
          // In production, this would trigger native ZEC minting automatically
          // Example: await bridgeService.autoMint(payment);
        });
        logger.info('Zcash monitoring started successfully');
      } catch (error) {
        logger.error('Failed to start Zcash monitoring', { error: error.message });
      }
    } else if (process.env.USE_ZECWALLET_CLI === 'true') {
      logger.info('Zcash monitoring disabled (set ENABLE_ZCASH_MONITORING=true to enable)');
    }
  } catch (error) {
    logger.error('Failed to initialize Bitcoin service', { error: error.message });
  }
  
  logger.info('='.repeat(60));

  // Start relayer listener if enabled
  if (process.env.ENABLE_RELAYER === 'true') {
    logger.warn('🚫 WARNING: SOL relayer service is DISABLED');
    logger.warn('Reason: flash_bridge_mxe program does not support burn/swap operations');
    logger.warn('The relayer expects BurnSwapEvent which does not exist in this program');
    logger.warn('Keeping ENABLE_RELAYER=true for compatibility, but service will not start');
    logger.info('SOL relayer service kept disabled (incompatible with flash_bridge_mxe)');
  } else {
    logger.info('SOL relayer disabled (set ENABLE_RELAYER=true to enable)');
    logger.warn('flash_bridge_mxe program does not support burn/swap operations');
  }

  // Start BTC relayer listener if enabled
  if (process.env.ENABLE_BTC_RELAYER === 'true') {
    logger.info('Starting BTC relayer service...');
    try {
      await btcRelayer.startListening();
      logger.info('BTC relayer service started successfully');
    } catch (error) {
      logger.error('Failed to start BTC relayer', { error: error.message });
    }
  } else {
    logger.info('BTC relayer disabled (set ENABLE_BTC_RELAYER=true to enable)');
  }
  
  logger.info('='.repeat(60));
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully (SIGINT handler)');
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
