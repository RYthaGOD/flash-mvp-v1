import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import apiClient from '../../services/apiClient';
import './TabStyles.css';

function ArciumTab({ publicKey, connected }) {
  const [arciumStatus, setArciumStatus] = useState(null);
  const [btcAddress, setBtcAddress] = useState('');
  const [encryptedResult, setEncryptedResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchArciumStatus();
  }, []);

  const fetchArciumStatus = async () => {
    try {
      const status = await apiClient.getArciumStatus();
      setArciumStatus(status);
    } catch (err) {
      console.error('Error fetching Arcium status:', err);
    }
  };

  const handleEncryptBTCAddress = async (e) => {
    e.preventDefault();

    if (!btcAddress || !publicKey) {
      setError('Please provide BTC address and connect wallet');
      return;
    }

    // Basic BTC address validation
    if (!btcAddress.match(/^(bc1|[13])[a-km-zA-HJ-NP-Z1-9]{25,62}$/)) {
      setError('Invalid Bitcoin address format');
      return;
    }

    setLoading(true);
    setError(null);
    setEncryptedResult(null);

    try {
      const result = await apiClient.encryptBTCAddress({
        btcAddress: btcAddress.trim(),
        solanaAddress: publicKey.toString(),
      });

      setEncryptedResult(result);
      setBtcAddress('');

    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Encryption failed');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="tab-content-wrapper">
      <h2>🔐 Arcium MPC Privacy</h2>
      <p className="tab-description">
        Encrypt your BTC address using Arcium Multi-Party Computation for privacy-preserving redemptions.
      </p>

      {/* Arcium Status */}
      {arciumStatus && (
        <div className="info-card" style={{ marginBottom: '2rem' }}>
          <h3>Arcium Status</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Status:</span>
              <span className={`info-value ${arciumStatus.enabled ? 'status-active' : 'status-inactive'}`}>
                {arciumStatus.enabled ? '✅ Enabled' : '❌ Disabled'}
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Mode:</span>
              <span className="info-value">
                {arciumStatus.simulated ? '🔧 Simulated' : '🚀 Real MPC'}
              </span>
            </div>
          </div>
        </div>
      )}

      {!connected && (
        <div className="message warning-message" style={{ marginBottom: '1rem' }}>
          <strong>⚠️ Wallet Not Connected</strong>
          <p>Please connect your Solana wallet to use Arcium encryption.</p>
        </div>
      )}

      {/* BTC Address Encryption */}
      <div className="action-card">
        <h3>₿ Encrypt BTC Address</h3>
        <p className="helper-text">
          Encrypt your Bitcoin address for privacy-preserving ZEC→BTC redemptions.
          Only you can decrypt it using Arcium MPC.
        </p>

        <form onSubmit={handleEncryptBTCAddress}>
          <div className="form-group">
            <label htmlFor="btcAddress">
              Bitcoin Address
              <span className="required">*</span>
            </label>
            <input
              id="btcAddress"
              type="text"
              value={btcAddress}
              onChange={(e) => setBtcAddress(e.target.value)}
              placeholder="Enter your BTC address (bc1... or 1... or 3...)"
              disabled={loading}
              required
            />
            <small style={{ color: '#ccc' }}>
              Your BTC address will be encrypted and stored on-chain.
              It can only be decrypted by you using Arcium MPC.
            </small>
          </div>

          <div className="privacy-notice" style={{
            backgroundColor: '#0a2a0a',
            border: '2px solid #00cc00',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
            textAlign: 'center',
            color: '#00cc00'
          }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              🔒 FULL PRIVACY - Encrypted via Arcium MPC
            </div>
            <p style={{ margin: 0, color: '#ccc' }}>
              Your BTC address is encrypted using Multi-Party Computation.
              No single party can decrypt it without your authorization.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !connected || !btcAddress.trim()}
            className="primary-button"
            style={{
              backgroundColor: '#00cc00',
              border: '2px solid #00cc00',
              fontSize: '1.1rem',
              padding: '0.75rem 1.5rem'
            }}
          >
            {loading ? '🔐 Encrypting...' : '🔐 Encrypt BTC Address'}
          </button>
        </form>
      </div>

      {/* Encryption Result */}
      {encryptedResult && (
        <div className="message success-message" style={{ marginTop: '1rem' }}>
          <h3>✅ BTC Address Encrypted Successfully!</h3>
          <div className="result-details">
            <p><strong>Status:</strong> {encryptedResult.status || 'Encrypted'}</p>
            <p><strong>Privacy:</strong> 🔒 Full MPC encryption applied</p>
            <p><strong>Next:</strong> Transfer ZEC to treasury for automatic redemption</p>
            {encryptedResult.computationId && (
              <p><strong>Computation ID:</strong> {encryptedResult.computationId}</p>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="message error-message" style={{ marginTop: '1rem' }}>
          <strong>❌ Encryption Error</strong>
          <p>{error}</p>
        </div>
      )}

      {/* Redemption Instructions */}
      <div className="redemption-instructions" style={{
        marginTop: '2rem',
        padding: '1.5rem',
        border: '2px solid #00cc00',
        borderRadius: '8px',
        backgroundColor: '#0a2a0a'
      }}>
        <h3 style={{ color: '#00cc00', marginBottom: '1rem' }}>🔄 How ZEC→BTC Redemption Works</h3>
        <div className="instruction-steps" style={{ color: '#ccc' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong style={{ color: '#00cc00' }}>1.</strong> Encrypt BTC Address (This form)
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong style={{ color: '#00cc00' }}>2.</strong> Transfer native ZEC tokens to the treasury address
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong style={{ color: '#00cc00' }}>3.</strong> System automatically detects transfer and decrypts your BTC address
          </div>
          <div>
            <strong style={{ color: '#00cc00' }}>4.</strong> BTC is sent to your address with full privacy
          </div>
        </div>
      </div>
    </div>
  );
}

export default ArciumTab;

