import React, { useState } from 'react';
import { useBitcoinWallet } from '../contexts/BitcoinWalletContext';
import { motion } from 'framer-motion';

const BitcoinWalletButton = () => {
  const {
    connected,
    address,
    walletType,
    balance,
    loading,
    error,
    network,
    connectUnisat,
    connectXverse,
    disconnect
  } = useBitcoinWallet();

  const [showOptions, setShowOptions] = useState(false);

  const shortenAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatBalance = (satoshis) => {
    const btc = satoshis / 100000000;
    return btc.toFixed(8);
  };

  if (connected) {
    return (
      <div className="wallet-info bitcoin-wallet">
        <div className="wallet-header">
          <span className="wallet-icon">₿</span>
          <span className="wallet-label">BTC</span>
        </div>
        <div className="wallet-details">
          <div className="wallet-address">{shortenAddress(address)}</div>
          <div className="wallet-balance">{formatBalance(balance)} BTC</div>
          <div className="wallet-network">{network}</div>
        </div>
        <motion.button
          className="disconnect-btn"
          onClick={disconnect}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Disconnect
        </motion.button>
      </div>
    );
  }

  return (
    <div className="wallet-connect bitcoin-wallet">
      <motion.button
        className="wallet-connect-btn"
        onClick={() => setShowOptions(!showOptions)}
        disabled={loading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {loading ? 'Connecting...' : 'Connect BTC Wallet'}
      </motion.button>

      {showOptions && (
        <motion.div
          className="wallet-options"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <button
            onClick={async () => {
              try {
                await connectUnisat();
                setShowOptions(false);
              } catch (err) {
                console.error('Failed to connect Unisat:', err);
              }
            }}
            className="wallet-option unisat"
          >
            🟠 Unisat
          </button>
          <button
            onClick={async () => {
              try {
                await connectXverse();
                setShowOptions(false);
              } catch (err) {
                console.error('Failed to connect Xverse:', err);
              }
            }}
            className="wallet-option xverse"
          >
            🔵 Xverse
          </button>
        </motion.div>
      )}

      {error && (
        <div className="wallet-error">
          {error}
        </div>
      )}
    </div>
  );
};

export default BitcoinWalletButton;
