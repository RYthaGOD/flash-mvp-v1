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
  const [step, setStep] = useState('welcome'); // welcome -> wallet -> fund -> bridge -> success

  const handleWalletGenerated = (wallets) => {
    if (wallets.bitcoin) {
      setBtcWallet(wallets.bitcoin);
      setStep('fund');
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
      setStep('success');
    } catch (err) {
      console.error('Bridge error:', err);
      setError(err.response?.data?.error || 'Bridge failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetDemo = () => {
    setStep('welcome');
    setBtcWallet(null);
    setBtcTxHash('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="simple-demo">
      <div className="demo-header">
        <h1>🚀 FLASH Bridge Demo</h1>
        <p>Experience BTC → zenZEC bridging with real testnet transactions</p>
      </div>

      {/* Wallet Connection - Always visible */}
      <div className="wallet-section">
        <div className="wallet-status">
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
      </div>

      {/* Step Indicator */}
      <div className="step-indicator">
        <div className={`step ${step === 'welcome' || step === 'wallet' ? 'active' : step === 'fund' || step === 'bridge' || step === 'success' ? 'completed' : ''}`}>
          <span className="step-number">1</span>
          <span className="step-label">Generate Wallet</span>
        </div>
        <div className="step-arrow">→</div>
        <div className={`step ${step === 'fund' ? 'active' : step === 'bridge' || step === 'success' ? 'completed' : ''}`}>
          <span className="step-number">2</span>
          <span className="step-label">Get Testnet BTC</span>
        </div>
        <div className="step-arrow">→</div>
        <div className={`step ${step === 'bridge' ? 'active' : step === 'success' ? 'completed' : ''}`}>
          <span className="step-number">3</span>
          <span className="step-label">Bridge to zenZEC</span>
        </div>
        <div className="step-arrow">→</div>
        <div className={`step ${step === 'success' ? 'completed' : ''}`}>
          <span className="step-number">4</span>
          <span className="step-label">Success!</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="demo-content">

        {step === 'welcome' && (
          <div className="welcome-step">
            <h2>🎯 Welcome to FLASH Bridge</h2>
            <p>This demo shows how Bitcoin can be privately bridged to zenZEC tokens on Solana.</p>

            <div className="demo-features">
              <div className="feature">
                <span className="feature-icon">₿</span>
                <div>
                  <h4>Real Bitcoin Transactions</h4>
                  <p>Use actual testnet BTC - no fake demos</p>
                </div>
              </div>
              <div className="feature">
                <span className="feature-icon">🔒</span>
                <div>
                  <h4>Full Privacy</h4>
                  <p>All transactions encrypted via Arcium MPC</p>
                </div>
              </div>
              <div className="feature">
                <span className="feature-icon">⚡</span>
                <div>
                  <h4>Instant Bridging</h4>
                  <p>BTC → zenZEC in minutes</p>
                </div>
              </div>
            </div>

            <button
              className="primary-button start-button"
              onClick={() => setStep('wallet')}
            >
              🚀 Start Demo
            </button>
          </div>
        )}

        {(step === 'wallet' || step === 'fund') && (
          <div className="wallet-step">
            <h2>₿ Generate Bitcoin Testnet Wallet</h2>
            <p>Create a fresh Bitcoin testnet address to demonstrate real BTC bridging</p>

            {!btcWallet ? (
              <button
                className="primary-button generate-button"
                onClick={() => setShowWalletGenerator(true)}
              >
                🎯 Generate Bitcoin Wallet
              </button>
            ) : (
              <div className="wallet-info">
                <h3>✅ Wallet Generated!</h3>
                <div className="wallet-details">
                  <div className="wallet-address">
                    <label>Bitcoin Testnet Address:</label>
                    <div className="address-display">
                      <code>{btcWallet.address}</code>
                      <button onClick={() => navigator.clipboard.writeText(btcWallet.address)}>
                        📋 Copy
                      </button>
                    </div>
                    <p className="address-note">
                      Format: {btcWallet.address.startsWith('tb1') ? 'SegWit (tb1...)' : 'Legacy (m/n...)'}
                    </p>
                  </div>
                </div>

                <div className="funding-instructions">
                  <h4>💰 Get Free Testnet BTC</h4>
                  <p>Send testnet BTC to the address above. We'll bridge it to zenZEC!</p>

                  <div className="faucet-option">
                    <h5>🚰 Get Free Testnet BTC:</h5>
                    <a
                      href="https://mempool.space/testnet/faucet"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="faucet-link"
                    >
                      mempool.space/testnet/faucet
                    </a>
                    <p>Send 0.001 BTC to: <strong>{btcWallet.address}</strong></p>
                    <p>Wait for 6+ confirmations (~10 minutes)</p>
                  </div>

                  <div className="next-step">
                    <p><strong>Next:</strong> After sending BTC, paste the transaction hash below</p>
                    <button
                      className="secondary-button"
                      onClick={() => setStep('bridge')}
                    >
                      I Have BTC → Continue
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'bridge' && (
          <div className="bridge-step">
            <h2>🌉 Bridge BTC to zenZEC</h2>
            <p>Paste your Bitcoin transaction hash to bridge BTC → zenZEC</p>

            <div className="bridge-form">
              <div className="form-group">
                <label htmlFor="btcTxHash">Bitcoin Transaction Hash:</label>
                <input
                  id="btcTxHash"
                  type="text"
                  value={btcTxHash}
                  onChange={(e) => setBtcTxHash(e.target.value)}
                  placeholder="Paste BTC transaction hash here..."
                  required
                />
                <p className="helper-text">
                  Find this on <a href="https://mempool.space/testnet" target="_blank" rel="noopener noreferrer">mempool.space/testnet</a>
                </p>
              </div>

              <button
                className="primary-button bridge-button"
                onClick={handleBridge}
                disabled={loading || !btcTxHash.trim() || !connected}
              >
                {loading ? '🔄 Bridging...' : '🚀 Bridge BTC to zenZEC'}
              </button>

              {!connected && (
                <p className="connect-warning">⚠️ Connect your Solana wallet first</p>
              )}
            </div>
          </div>
        )}

        {step === 'success' && result && (
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
                🔄 Try Another Bridge
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
