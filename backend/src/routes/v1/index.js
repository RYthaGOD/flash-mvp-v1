/**
 * API Version 1 Routes
 * ====================
 * All v1 API routes are mounted under /api/v1/
 * 
 * Versioning Strategy:
 * - /api/v1/* - Current stable version
 * - /api/v2/* - Next version (when breaking changes needed)
 * - /api/*    - Legacy routes (deprecated, points to v1)
 */

const express = require('express');
const router = express.Router();

// Import route modules
const bridgeRoutes = require('../bridge');
const arciumRoutes = require('../arcium');
const zcashRoutes = require('../zcash');

// Mount routes under v1
router.use('/bridge', bridgeRoutes);
router.use('/arcium', arciumRoutes);
router.use('/zcash', zcashRoutes);

// Version info endpoint
router.get('/', (req, res) => {
  res.json({
    version: '1.0.0',
    status: 'stable',
    endpoints: {
      bridge: '/api/v1/bridge',
      arcium: '/api/v1/arcium',
      zcash: '/api/v1/zcash',
    },
    documentation: '/api/v1/docs',
    deprecated: false,
  });
});

module.exports = router;

