import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../services/apiClient';

const SystemHealth = () => {
  const [health, setHealth] = useState(null);
  const [bridgeInfo, setBridgeInfo] = useState(null);
  const [reserves, setReserves] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHealth = async () => {
    try {
      setError(null);
      const [healthData, bridgeData, reservesData] = await Promise.allSettled([
        apiClient.getHealth(),
        apiClient.getBridgeInfo(),
        apiClient.getReserves()
      ]);

      if (healthData.status === 'fulfilled') {
        setHealth(healthData.value);
      }

      if (bridgeData.status === 'fulfilled') {
        setBridgeInfo(bridgeData.value);
      }

      if (reservesData.status === 'fulfilled') {
        setReserves(reservesData.value.reserves);
      }

      setLoading(false);
    } catch (err) {
      setError('Failed to fetch system health');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
      case 'ok':
      case 'active':
        return '#10b981'; // green
      case 'warning':
      case 'degraded':
        return '#f59e0b'; // amber
      case 'error':
      case 'failed':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  const getStatusIcon = (status, type = 'circle') => {
    const color = getStatusColor(status);

    if (type === 'pulse') {
      return (
        <motion.div
          className="status-pulse"
          style={{ backgroundColor: color }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.7, 1, 0.7]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      );
    }

    return (
      <motion.div
        className="status-dot"
        style={{ backgroundColor: color }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    );
  };

  const formatBTC = (satoshis) => {
    if (!satoshis) return '0.00000000';
    return (parseInt(satoshis) / 100000000).toFixed(8);
  };

  const formatZEC = (balance) => {
    if (!balance) return '0.00000000';
    // Handle both string and BigInt formats
    const numBalance = typeof balance === 'string' ? parseInt(balance) : parseInt(balance.toString());
    return (numBalance / 100000000).toFixed(8);
  };

  if (loading) {
    return (
      <motion.div
        className="system-health loading"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="health-header">
          <div className="health-icon">🏥</div>
          <div className="health-title">System Health</div>
        </div>
        <div className="loading-spinner">Loading...</div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        className="system-health error"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="health-header">
          <div className="health-icon">⚠️</div>
          <div className="health-title">System Health</div>
        </div>
        <div className="error-message">{error}</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="system-health"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="health-header">
        <div className="health-icon">
          {health?.status === 'ok' ? '🟢' : health?.status === 'warning' ? '🟡' : '🔴'}
        </div>
        <div className="health-title">System Health</div>
        <motion.button
          className="refresh-btn"
          onClick={fetchHealth}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          🔄
        </motion.button>
      </div>

      <div className="health-grid">
        {/* Backend Status */}
        <motion.div
          className="health-item"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="item-header">
            {getStatusIcon(health?.status)}
            <span className="item-label">Backend</span>
          </div>
          <div className="item-value">
            {health?.status === 'ok' ? 'Online' : 'Issues'}
          </div>
        </motion.div>

        {/* Arcium MPC Status */}
        <motion.div
          className="health-item"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="item-header">
            {getStatusIcon(health?.arciumMPC ? 'healthy' : 'error', 'pulse')}
            <span className="item-label">Arcium MPC</span>
          </div>
          <div className="item-value">
            {health?.arciumMPC ? 'Active' : 'Inactive'}
          </div>
        </motion.div>

        {/* Privacy Status */}
        <motion.div
          className="health-item"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="item-header">
            {getStatusIcon(health?.privacy === 'full' ? 'healthy' : 'warning')}
            <span className="item-label">Privacy</span>
          </div>
          <div className="item-value">
            {health?.privacy === 'full' ? 'Full' : 'Limited'}
          </div>
        </motion.div>

        {/* Network Status */}
        <motion.div
          className="health-item"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="item-header">
            {getStatusIcon(bridgeInfo?.status)}
            <span className="item-label">Bridge</span>
          </div>
          <div className="item-value">
            {bridgeInfo?.network || 'Unknown'}
          </div>
        </motion.div>

        {/* BTC Reserve */}
        <motion.div
          className="health-item reserve"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="item-header">
            <span className="reserve-icon">₿</span>
            <span className="item-label">BTC Reserve</span>
          </div>
          <div className="item-value">
            {formatBTC(reserves?.btc?.reserveSatoshis)} BTC
          </div>
        </motion.div>

        {/* ZEC Reserve */}
        <motion.div
          className="health-item reserve"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="item-header">
            <span className="reserve-icon">🛡️</span>
            <span className="item-label">ZEC Treasury</span>
          </div>
          <div className="item-value">
            {formatZEC(reserves?.zec?.balance)} ZEC
          </div>
        </motion.div>
      </div>

      {/* Additional Details */}
      <AnimatePresence>
        {health?.configuration && (
          <motion.div
            className="health-details"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="detail-row">
              <span>Database:</span>
              <span className={health.configuration.databaseConfigured ? 'status-good' : 'status-bad'}>
                {health.configuration.databaseConfigured ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="detail-row">
              <span>Privacy Mode:</span>
              <span className="status-good">
                {health.privacyMode === 'mandatory' ? 'Mandatory' : 'Optional'}
              </span>
            </div>
            <div className="detail-row">
              <span>Network:</span>
              <span>{bridgeInfo?.network?.toUpperCase()}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SystemHealth;