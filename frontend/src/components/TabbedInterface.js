import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { motion, AnimatePresence } from 'framer-motion';
import { useBitcoinWallet } from '../contexts/BitcoinWalletContext';
import SystemHealth from './SystemHealth';
import BridgeTab from './tabs/BridgeTab';
import ArciumTab from './tabs/ArciumTab';
import ZcashTab from './tabs/ZcashTab';
import TransactionHistoryTab from './tabs/TransactionHistoryTab';
import BitcoinWalletButton from './BitcoinWalletButton';
import LightningEffect from './LightningEffect';
import ErrorNotification from './ErrorNotification';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import './TabbedInterface.css';

const shortenAddress = (key) => {
  if (!key) return 'Wallet disconnected';
  const base58 = key.toBase58();
  return `${base58.slice(0, 4)}…${base58.slice(-4)}`;
};

function TabbedInterface() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const {
    connected: btcConnected,
    address: btcAddress,
    balance: btcBalance
  } = useBitcoinWallet();
  const [solBalance, setSolBalance] = useState(null);
  const [activeTab, setActiveTab] = useState('bridge');
  const [lightningActive, setLightningActive] = useState(false);
  const [lightningPosition, setLightningPosition] = useState({ x: 0, y: 0 });
  const prefersReducedMotion = usePrefersReducedMotion();

  const triggerLightning = useCallback((event) => {
    if (prefersReducedMotion) return;

    const rect = event.target.getBoundingClientRect();
    setLightningPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    });
    setLightningActive(true);

    // Reset after animation
    setTimeout(() => setLightningActive(false), 1000);
  }, [prefersReducedMotion]);

  const tabs = [
    { id: 'bridge', label: 'Bridge', component: BridgeTab },
    { id: 'arcium', label: 'Arcium MPC', component: ArciumTab },
    { id: 'zcash', label: 'Zcash', component: ZcashTab },
    { id: 'history', label: 'History', component: TransactionHistoryTab },
  ];

  const quickActions = [
    { label: 'Bridge BTC → SOL', tab: 'bridge' },
    { label: 'Arcium MPC Tools', tab: 'arcium' },
    { label: 'Monitor Zcash', tab: 'zcash' },
  ];

  const fetchBalances = useCallback(async () => {
    if (!connected || !publicKey) return;
    try {
      const solBalanceLamports = await connection.getBalance(publicKey);
      setSolBalance(solBalanceLamports / 1e9);
    } catch (err) {
      console.error('Error fetching balances:', err);
    }
  }, [connected, publicKey, connection]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchBalances();
      const interval = setInterval(fetchBalances, 30000);
      return () => clearInterval(interval);
    }
  }, [connected, publicKey, fetchBalances]);

  const heroMetrics = useMemo(() => {
    return [
      {
        label: 'SOL Wallet',
        value: connected && publicKey ? shortenAddress(publicKey) : 'Not connected',
        caption: connected ? 'Ready to receive ZEC' : 'Connect Solana wallet',
        intent: connected ? 'positive' : 'muted'
      },
      {
        label: 'BTC Wallet',
        value: btcConnected && btcAddress ? `${btcAddress.slice(0, 6)}...${btcAddress.slice(-4)}` : 'Not connected',
        caption: btcConnected ? `Balance: ${(btcBalance / 100000000).toFixed(8)} BTC` : 'Connect Bitcoin wallet',
        intent: btcConnected ? 'positive' : 'muted'
      },
      {
        label: 'SOL Balance',
        value: solBalance !== null ? `${solBalance.toFixed(4)} SOL` : '—',
        caption: 'Live on-chain balance'
      },
      {
        label: 'Network',
        value: 'Solana Devnet',
        caption: 'Arcium MPC (simulated)',
        intent: 'accent'
      },
    ];
  }, [connected, publicKey, solBalance, btcConnected, btcAddress, btcBalance]);

  const ActiveTabComponent = tabs.find(tab => tab.id === activeTab)?.component || BridgeTab;

  return (
    <div className="tabbed-interface">
      <LightningEffect active={lightningActive} position={lightningPosition} />
      <ErrorNotification />
      <header className="dashboard-hero">
        <motion.div
          className="hero-copy"
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <p className="eyebrow">Flash Bridge • Private BTC ↔ ZEC ↔ SOL</p>
          <motion.h1
            initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: 'easeOut', delay: prefersReducedMotion ? 0 : 0.05 }}
          >
            Command your cross-chain liquidity from a single pane.
          </motion.h1>
          <motion.p
            className="subtitle"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: prefersReducedMotion ? 0 : 0.1 }}
          >
            Monitor relayers, inspect Zcash privacy proofs, and bridge native assets with Arcium-grade security.
          </motion.p>

          <div className="hero-actions">
            <div className="action-buttons">
              {quickActions.map(action => (
                <motion.button
                  key={action.label}
                  className="ghost-button"
                  onClick={(e) => {
                    triggerLightning(e);
                    setActiveTab(action.tab);
                  }}
                  whileHover={
                    prefersReducedMotion
                      ? undefined
                      : { scale: 1.04, y: -2, transition: { duration: 0.15 } }
                  }
                  whileTap={
                    prefersReducedMotion
                      ? undefined
                      : { scale: 0.96, transition: { duration: 0.1 } }
                  }
                >
                  {action.label}
                </motion.button>
              ))}
            </div>
            <div className="wallet-button-wrapper">
              <WalletMultiButton />
              <BitcoinWalletButton />
            </div>
          </div>

          <div className="hero-metrics">
            {heroMetrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                className={`metric-card ${metric.intent || ''}`}
                initial={
                  prefersReducedMotion
                    ? { opacity: 1, y: 0 }
                    : { opacity: 0, y: 18, scale: 0.98 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.45,
                  ease: 'easeOut',
                  delay: prefersReducedMotion ? 0 : index * 0.08 + 0.2,
                }}
                whileHover={
                  prefersReducedMotion
                    ? undefined
                    : { scale: 1.03, boxShadow: '0 12px 32px rgba(0,0,0,0.45)' }
                }
                layout
              >
                <span className="metric-label">{metric.label}</span>
                <span className="metric-value">{metric.value}</span>
                {metric.caption && <span className="metric-caption">{metric.caption}</span>}
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="hero-panel"
          initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: prefersReducedMotion ? 0 : 0.15 }}
        >
          <SystemHealth />
        </motion.div>
      </header>

      <div className="tab-shell">
        <nav className="tab-nav">
          {tabs.map(tab => (
            <motion.button
              key={tab.id}
              className={`tab-pill ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              whileHover={
                prefersReducedMotion
                  ? undefined
                  : { y: -2, boxShadow: '0 10px 20px rgba(0,0,0,0.4)' }
              }
              whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
            >
              {tab.label}
            </motion.button>
          ))}
        </nav>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            className="tab-content-card"
            initial={
              prefersReducedMotion
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 0, y: 24, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 0, y: -12, scale: 0.98 }
            }
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <ActiveTabComponent
              publicKey={publicKey}
              connected={connected}
              connection={connection}
              onLightningTrigger={triggerLightning}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default TabbedInterface;

