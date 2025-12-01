import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';
import './BridgeFlow.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function BridgeFlow() {
  const { publicKey, connected } = useWallet();
  const [btcTxHash, setBtcTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleBridge = async (e) => {
    e.preventDefault();
    if (!btcTxHash || !publicKey) {
      setError('Please provide a Bitcoin transaction hash and connect your wallet');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Single unified API call for BTC → Native ZEC bridging
      const response = await axios.post(`${API_URL}/api/bridge`, {
        solanaAddress: publicKey.toString(),
        bitcoinTxHash: btcTxHash.trim(),
        useZecPrivacy: true, // Always use privacy
      });

      setResult(response.data);
      setBtcTxHash('');
    } catch (err) {
      setError(err.response?.data?.error || 'Bridge transaction failed');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="bridge-flow">
      <div className="bridge-header">
        <h1>🚀 FLASH Bridge</h1>
        <p>Bridge Bitcoin to native ZEC tokens on Solana with full privacy protection</p>
      </div>

      {!connected && (
        <div className="connection-warning">
          <h3>⚠️ Wallet Connection Required</h3>
          <p>Please connect your Solana wallet to use the bridge.</p>
        </div>
      )}

      <div className="bridge-form-container">
        <form onSubmit={handleBridge} className="bridge-form">
          <div className="form-section">
            <h3>📥 Step 1: Send BTC</h3>
            <div className="btc-info">
              <p><strong>Bridge BTC Address:</strong></p>
              <p className="address">tb1qug4w70zdr40clj9qecy67tx58e24lk90whzy9l</p>
              <p className="note">Send BTC to this address on Bitcoin testnet</p>
            </div>
          </div>

          <div className="form-section">
            <h3>🔗 Step 2: Bridge Transaction</h3>
            <div className="form-group">
              <label htmlFor="btcTxHash">
                Bitcoin Transaction Hash
                <span className="required">*</span>
              </label>
              <input
                type="text"
                id="btcTxHash"
                value={btcTxHash}
                onChange={(e) => setBtcTxHash(e.target.value)}
                placeholder="Paste your BTC transaction hash here..."
                required
                disabled={loading}
                className="tx-hash-input"
              />
              <small>
                After sending BTC to the bridge address, paste the transaction hash here.
                The bridge will verify your payment and send equivalent native ZEC to your Solana wallet.
              </small>
            </div>

            <button
              type="submit"
              disabled={loading || !connected || !btcTxHash.trim()}
              className="bridge-submit-btn"
            >
              {loading ? '🔄 Processing Bridge Transaction...' : '🚀 Bridge BTC → ZEC'}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="error-message">
          <h3>❌ Bridge Error</h3>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="success-message">
          <h3>✅ Bridge Successful!</h3>
          <div className="result-details">
            <p><strong>Transaction ID:</strong> {result.solanaTxSignature || result.transactionId}</p>
            <p><strong>Status:</strong> Native ZEC transferred to your wallet</p>
            <p><strong>Privacy:</strong> Full MPC encryption applied</p>
          </div>
          <details>
            <summary>View Full Response</summary>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      )}

      <div className="bridge-features">
        <h3>🔐 Bridge Features</h3>
        <div className="features-grid">
          <div className="feature">
            <h4>🚀 Fast Bridging</h4>
            <p>Instant BTC to ZEC conversion</p>
          </div>
          <div className="feature">
            <h4>🔒 Privacy First</h4>
            <p>Arcium MPC encryption for all transactions</p>
          </div>
          <div className="feature">
            <h4>💎 Native Tokens</h4>
            <p>Receive official ZEC tokens on Solana</p>
          </div>
          <div className="feature">
            <h4>🔄 DEX Ready</h4>
            <p>ZEC tokens ready for Jupiter/Raydium trading</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BridgeFlow;
