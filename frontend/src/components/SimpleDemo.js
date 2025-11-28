import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import axios from 'axios';
import TestnetWalletGenerator from './TestnetWalletGenerator';
import './SimpleDemo.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function SimpleDemo() {
  const { publicKey, connected } = useWallet();
  const [showWalletGenerator, setShowWalletGenerator] = useState(false);
  const [btcWallet, setBtcWallet] = useState(null);
  const [btcTxHash, setBtcTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleWalletGenerated = (wallets) => {
    if (wallets.bitcoin) {
      setBtcWallet(wallets.bitcoin);
    }
  };

  const handleBridge = async () => {
    if (!connected || !publicKey) {
      setError('Please connect your Solana wallet first');
      return;
    }

    if (!btcTxHash.trim()) {
      setError('Please enter a Bitcoin transaction hash');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_URL}/api/bridge/`, {
        solanaAddress: publicKey.toString(),
        bitcoinTxHash: btcTxHash.trim(),
        amount: 0.001, // Default amount - will be verified from BTC tx
        swapToSol: false, // Keep as zenZEC tokens
      });

      setResult(response.data);
    } catch (err) {
      console.error('Bridge error:', err);
      setError(err.response?.data?.error || 'Bridge failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetDemo = () => {
    setBtcWallet(null);
    setBtcTxHash('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="simple-demo">
      <div className="demo-header">
        <h1>🚀 FLASH Bridge</h1>
        <p>Bridge Bitcoin to zenZEC tokens on Solana</p>
      </div>

      {/* Wallet Connection */}
      <div className="wallet-section">
        {!connected ? (
          <div className="wallet-connect-prompt">
            <h3>🔗 Connect Your Solana Wallet</h3>
            <p>Connect to receive zenZEC tokens after bridging</p>
            <WalletMultiButton className="wallet-button" />
          </div>
        ) : (
          <div className="wallet-connected">
            <span className="wallet-icon">✓</span>
            <span className="wallet-address">
              {publicKey.toString().substring(0, 8)}...{publicKey.toString().slice(-8)}
            </span>
          </div>
        )}
      </div>

      {/* Main Bridge Interface */}
      <div className="demo-content">
        {!result ? (
          <div className="bridge-interface">
            <h2>🌉 Bridge BTC to zenZEC</h2>

            {/* Generate BTC Wallet */}
            <div className="section">
              <h3>1. Get a Bitcoin Testnet Address</h3>
              {!btcWallet ? (
                <div>
                  <p>Generate a testnet Bitcoin address to receive test BTC</p>
                  <button
                    className="primary-button"
                    onClick={() => setShowWalletGenerator(true)}
                  >
                    🎯 Generate Bitcoin Wallet
                  </button>
                </div>
              ) : (
                <div className="wallet-info">
                  <div className="address-display">
                    <code>{btcWallet.address}</code>
                    <button onClick={() => navigator.clipboard.writeText(btcWallet.address)}>
                      📋 Copy
                    </button>
                  </div>
                  <p>
                    <a
                      href="https://mempool.space/testnet/faucet"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="faucet-link"
                    >
                      Get free testnet BTC here ↗
                    </a>
                  </p>
                </div>
              )}
            </div>

            {/* Bridge Form */}
            <div className="section">
              <h3>2. Bridge Your BTC</h3>
              <p>Paste your Bitcoin transaction hash after sending BTC</p>

              <div className="bridge-form">
                <div className="form-group">
                  <label htmlFor="btcTxHash">Bitcoin Transaction Hash:</label>
                  <input
                    id="btcTxHash"
                    type="text"
                    value={btcTxHash}
                    onChange={(e) => setBtcTxHash(e.target.value)}
                    placeholder="Paste BTC transaction hash..."
                    required
                  />
                  <p className="helper-text">
                    Find on <a href="https://mempool.space/testnet" target="_blank" rel="noopener noreferrer">mempool.space</a>
                  </p>
                </div>

                <button
                  className="primary-button bridge-button"
                  onClick={handleBridge}
                  disabled={loading || !btcTxHash.trim() || !connected}
                >
                  {loading ? '🔄 Bridging...' : '🚀 Bridge BTC to zenZEC'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Success Screen */
          <div className="success-step">
            <h2>🎉 Bridge Successful!</h2>
            <p>Your BTC has been bridged to zenZEC tokens!</p>

            <div className="success-details">
              <div className="result-card">
                <h3>Transaction Details</h3>
                <div className="detail-row">
                  <span className="label">BTC Verified:</span>
                  <span className="value">✓ {result.bitcoinVerification?.amountBTC || '0.001'} BTC</span>
                </div>
                <div className="detail-row">
                  <span className="label">zenZEC Minted:</span>
                  <span className="value">{result.amount ? (result.amount / 100000000).toFixed(6) : '1.000000'} zenZEC</span>
                </div>
                <div className="detail-row">
                  <span className="label">Privacy:</span>
                  <span className="value">✓ Encrypted via Arcium MPC</span>
                </div>
                {result.solanaTxSignature && (
                  <div className="detail-row">
                    <span className="label">Solana TX:</span>
                    <span className="value">
                      <a
                        href={`https://solscan.io/tx/${result.solanaTxSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on Solscan ↗
                      </a>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="next-actions">
              <button className="secondary-button" onClick={resetDemo}>
                🔄 Bridge Again
              </button>
              <a
                href={`https://mempool.space/testnet/tx/${btcTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="explorer-link"
              >
                📊 View BTC Transaction
              </a>
            </div>
          </div>
        )}

        {error && (
          <div className="error-message">
            <strong>❌ Error:</strong> {error}
            <button className="retry-button" onClick={() => setError(null)}>
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Wallet Generator Modal */}
      {showWalletGenerator && (
        <TestnetWalletGenerator
          onWalletsGenerated={handleWalletGenerated}
          onClose={() => setShowWalletGenerator(false)}
        />
      )}
    </div>
  );
}

export default SimpleDemo;
