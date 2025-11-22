import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TabStyles.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function ArciumTab({ publicKey, connected }) {
  const [arciumStatus, setArciumStatus] = useState(null);
  const [amount, setAmount] = useState('');
  const [encryptedResult, setEncryptedResult] = useState(null);
  const [privateBridgeResult, setPrivateBridgeResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchArciumStatus();
  }, []);

  const fetchArciumStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/arcium/status`);
      setArciumStatus(response.data);
    } catch (err) {
      console.error('Error fetching Arcium status:', err);
    }
  };

  const handleEncryptAmount = async (e) => {
    e.preventDefault();
    if (!amount || !publicKey) return;

    setLoading(true);
    setEncryptedResult(null);

    try {
      const response = await axios.post(`${API_URL}/api/arcium/encrypt-amount`, {
        amount: parseFloat(amount),
        recipientPubkey: publicKey.toString(),
      });
      setEncryptedResult(response.data);
    } catch (err) {
      setEncryptedResult({
        success: false,
        error: err.response?.data?.error || 'Encryption failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrivateBridge = async (e) => {
    e.preventDefault();
    if (!amount || !publicKey) return;

    setLoading(true);
    setPrivateBridgeResult(null);

    try {
      const response = await axios.post(`${API_URL}/api/arcium/bridge/private`, {
        solanaAddress: publicKey.toString(),
        amount: parseFloat(amount),
        useEncryption: true,
      });
      setPrivateBridgeResult(response.data);
    } catch (err) {
      setPrivateBridgeResult({
        success: false,
        error: err.response?.data?.error || 'Private bridge failed',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-content-wrapper">
      <h2>Arcium MPC Privacy</h2>
      <p className="tab-description">
        Encrypted bridge transactions using Multi-Party Computation for complete privacy.
      </p>

      {/* Arcium Status */}
      {arciumStatus && (
        <div className="info-card">
          <h3>MPC Network Status</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Connected:</span>
              <span className={`info-value ${arciumStatus.connected ? 'status-active' : 'status-inactive'}`}>
                {arciumStatus.connected ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">MPC Enabled:</span>
              <span className={`info-value ${arciumStatus.mpcEnabled ? 'status-active' : 'status-inactive'}`}>
                {arciumStatus.mpcEnabled ? 'Yes' : 'No'}
              </span>
            </div>
            {arciumStatus.features && (
              <>
                <div className="info-item">
                  <span className="info-label">Encrypted Amounts:</span>
                  <span className={`info-value ${arciumStatus.features.encryptedAmounts ? 'status-active' : 'status-inactive'}`}>
                    {arciumStatus.features.encryptedAmounts ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Private Verification:</span>
                  <span className={`info-value ${arciumStatus.features.privateVerification ? 'status-active' : 'status-inactive'}`}>
                    {arciumStatus.features.privateVerification ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Encrypt Amount */}
      <div className="action-card">
        <h3>Encrypt Amount</h3>
        <p className="helper-text">Encrypt an amount using MPC without revealing the value</p>
        <form onSubmit={handleEncryptAmount}>
          <div className="form-group">
            <label htmlFor="encryptAmount">Amount</label>
            <input
              id="encryptAmount"
              type="number"
              step="0.000001"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              disabled={loading || !connected}
              required
            />
          </div>
          <button type="submit" className="primary-button" disabled={loading || !connected}>
            {loading ? 'Encrypting...' : 'Encrypt Amount'}
          </button>
        </form>

        {encryptedResult && (
          <div className={`message ${encryptedResult.success ? 'success-message' : 'error-message'}`}>
            {encryptedResult.success ? (
              <>
                <h4>✓ Amount Encrypted</h4>
                <p className="helper-text">Encrypted data: {JSON.stringify(encryptedResult.encrypted).substring(0, 100)}...</p>
              </>
            ) : (
              <p><strong>Error:</strong> {encryptedResult.error}</p>
            )}
          </div>
        )}
      </div>

      {/* Private Bridge */}
      <div className="action-card">
        <h3>Private Bridge Transaction</h3>
        <p className="helper-text">Create a bridge transaction with encrypted amounts</p>
        <form onSubmit={handlePrivateBridge}>
          <div className="form-group">
            <label htmlFor="privateAmount">Amount (zenZEC)</label>
            <input
              id="privateAmount"
              type="number"
              step="0.000001"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              disabled={loading || !connected}
              required
            />
          </div>
          <button type="submit" className="primary-button" disabled={loading || !connected}>
            {loading ? 'Creating...' : 'Create Private Bridge'}
          </button>
        </form>

        {privateBridgeResult && (
          <div className={`message ${privateBridgeResult.success ? 'success-message' : 'error-message'}`}>
            {privateBridgeResult.success ? (
              <>
                <h4>✓ Private Bridge Created</h4>
                <p className="helper-text">{privateBridgeResult.message}</p>
              </>
            ) : (
              <p><strong>Error:</strong> {privateBridgeResult.error}</p>
            )}
          </div>
        )}
      </div>

      {!arciumStatus?.mpcEnabled && (
        <div className="message info-message">
          <p><strong>Note:</strong> Arcium MPC is not enabled. Set ENABLE_ARCIUM_MPC=true in backend .env to enable full privacy features.</p>
        </div>
      )}
    </div>
  );
}

export default ArciumTab;

