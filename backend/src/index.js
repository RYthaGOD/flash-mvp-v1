const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

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
const databaseService = require('./services/database');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

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
      privacy: 'Full MPC encryption via Arcium',
      confidential: 'All transactions encrypted',
    },
  });
});

app.get('/health', async (req, res) => {
  const arciumStatus = arciumService.getStatus();
  const zcashMonitorStatus = zcashMonitor.getStatus();
  const btcRelayerStatus = btcRelayer.getStatus();
  
  const health = {
    status: 'ok',
    relayerActive: relayerService.isListening,
    btcRelayerActive: btcRelayerStatus.isListening,
    arciumMPC: arciumStatus.enabled,
    privacy: arciumStatus.enabled ? 'full' : 'basic',
    zcashMonitoring: zcashMonitorStatus.isMonitoring,
    database: databaseService.isConnected(),
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
  console.log('FLASH — BTC → ZEC → Solana Bridge (MVP)');
  console.log('='.repeat(60));
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Solana Network: ${process.env.SOLANA_NETWORK || 'devnet'}`);
  console.log(`Program ID: ${process.env.PROGRAM_ID || 'Not configured'}`);
  console.log(`zenZEC Mint: ${process.env.ZENZEC_MINT || 'Not configured'}`);
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
  
  // Initialize Arcium MPC if enabled
  if (process.env.ENABLE_ARCIUM_MPC === 'true') {
    console.log('Initializing Arcium MPC network...');
    try {
      await arciumService.initialize();
      const arciumStatus = arciumService.getStatus();
      console.log(`Arcium MPC: ${arciumStatus.connected ? 'Connected' : 'Not connected'}`);
      console.log(`Privacy Features: ${arciumStatus.features.encryptedAmounts ? 'Enabled' : 'Disabled'}`);
    } catch (error) {
      console.error('Failed to initialize Arcium:', error.message);
    }
  } else {
    console.log('Arcium MPC disabled (set ENABLE_ARCIUM_MPC=true to enable full privacy)');
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
        console.log(`New Bitcoin payment detected: ${payment.amount / 100000000} BTC`);
        console.log(`Transaction: ${payment.txHash}`);
        // In production, this would trigger zenZEC minting automatically
      });
      console.log('Bitcoin monitoring started successfully');
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
