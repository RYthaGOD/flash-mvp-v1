import React, { useState } from 'react';
import { default as WalletGenerator } from '../utils/wallet-generator/index.js';

const TestnetWalletGenerator = ({ onWalletsGenerated, onClose }) => {
  const [wallets, setWallets] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPrivateKeys, setShowPrivateKeys] = useState({});

  const generator = new WalletGenerator();

  const handleGenerateWallets = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await generator.generateAllWallets();

      if (result.success) {
        setWallets(result.wallets);

        // Notify parent component
        if (onWalletsGenerated) {
          onWalletsGenerated(result.wallets);
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePrivateKey = (chain) => {
    setShowPrivateKeys(prev => ({
      ...prev,
      [chain]: !prev[chain]
    }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  const getExplorerUrl = (wallet) => {
    if (wallet.type === 'bitcoin') {
      return `https://mempool.space/testnet/address/${wallet.address}`;
    }
    return '#';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wallet-generator-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>₿ Generate Bitcoin Testnet Wallet</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {!wallets && !loading && (
            <div className="generator-intro">
              <p>
                Generate a Bitcoin testnet wallet to demonstrate the FLASH Bridge BTC → zenZEC flow
                with real testnet transactions.
              </p>

              <div className="security-notice">
                <h4>🔒 Security Notice</h4>
                <ul>
                  <li>Private keys are generated client-side only</li>
                  <li>Never share your private keys with anyone</li>
                  <li>This is a testnet wallet - funds have no real value</li>
                  <li>Back up your private key securely</li>
                </ul>
              </div>

              <button
                className="primary-button generate-button"
                onClick={handleGenerateWallets}
                disabled={loading}
              >
                🎯 Generate Bitcoin Testnet Wallet
              </button>
            </div>
          )}

          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Generating secure testnet wallets...</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <h4>❌ Generation Failed</h4>
              <p>{error}</p>
              <button onClick={() => setError(null)}>Try Again</button>
            </div>
          )}

          {wallets && (
            <div className="wallets-display">
              <h3>✅ Bitcoin Testnet Wallet Generated!</h3>
              <p>Use this address to test the FLASH Bridge BTC → zenZEC flow.</p>

              {/* Bitcoin Wallet */}
              <div className="wallet-card bitcoin-wallet">
                <div className="wallet-header">
                  <h4>₿ Bitcoin Testnet Wallet</h4>
                  <a
                    href={getExplorerUrl(wallets.bitcoin)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="explorer-link"
                  >
                    🔍 View on Mempool Explorer
                  </a>
                </div>

                <div className="wallet-address">
                  <label>Receiving Address:</label>
                  <div className="address-display">
                    <code>{wallets.bitcoin.address}</code>
                    <button onClick={() => copyToClipboard(wallets.bitcoin.address)}>
                      📋 Copy
                    </button>
                  </div>
                  <p className="address-note">Send testnet BTC to this address to test the bridge</p>
                </div>

                <div className="wallet-private-key">
                  <label>Private Key (WIF Format):</label>
                  <div className="key-display">
                    <input
                      type={showPrivateKeys.bitcoin ? "text" : "password"}
                      value={wallets.bitcoin.wif}
                      readOnly
                    />
                    <button onClick={() => togglePrivateKey('bitcoin')}>
                      {showPrivateKeys.bitcoin ? '🙈 Hide' : '👁️ Show'}
                    </button>
                    <button onClick={() => copyToClipboard(wallets.bitcoin.wif)}>
                      📋 Copy
                    </button>
                  </div>
                  <p className="key-warning">⚠️ Save this private key securely!</p>
                </div>
              </div>

              <div className="demo-instructions">
                <h4>🚀 Test the Bridge</h4>
                <ol>
                  <li><strong>Get testnet BTC:</strong> Visit <a href="https://mempool.space/testnet/faucet" target="_blank" rel="noopener noreferrer">Mempool Faucet</a></li>
                  <li><strong>Send to address:</strong> Use the address above</li>
                  <li><strong>Wait for confirmations:</strong> ~10 minutes for 6+ confirmations</li>
                  <li><strong>Bridge to zenZEC:</strong> Come back here and paste the TX hash</li>
                  <li><strong>Watch it work:</strong> Real BTC → zenZEC transaction!</li>
                </ol>

                <div className="demo-note">
                  <p><strong>💡 This proves FLASH Bridge works with real blockchain transactions!</strong></p>
                  <p>All transactions are publicly verifiable on testnet explorers.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="secondary-button" onClick={onClose}>
            Close
          </button>
          {wallets && (
            <button className="primary-button" onClick={() => setWallets(null)}>
              Generate New Bitcoin Wallet
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestnetWalletGenerator;
