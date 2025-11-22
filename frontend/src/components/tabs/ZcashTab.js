import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TabStyles.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function ZcashTab({ publicKey, connected }) {
  const [zcashInfo, setZcashInfo] = useState(null);
  const [zecPrice, setZecPrice] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [txHash, setTxHash] = useState('');
  const [address, setAddress] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [addressValidation, setAddressValidation] = useState(null);
  const [bridgeAddress, setBridgeAddress] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchZcashInfo = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/zcash/info`);
      setZcashInfo(response.data);
    } catch (err) {
      console.error('Error fetching Zcash info:', err);
    }
  };

  const fetchZecPrice = React.useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/zcash/price`);
      setZecPrice(response.data);
    } catch (err) {
      console.error('Error fetching ZEC price:', err);
      
      // If we have a previous price, keep it displayed
      setZecPrice((prevPrice) => {
        if (prevPrice && prevPrice.price) {
          console.warn('Using previous price due to fetch error');
          return prevPrice;
        }
        
        // Set error state only if we don't have any price
        return {
          success: false,
          price: null,
          error: err.response?.status === 429 
            ? 'Rate limit exceeded. Please wait a few minutes.'
            : 'Failed to fetch price',
          cached: false,
        };
      });
    }
  }, []);

  useEffect(() => {
    fetchZcashInfo();
    fetchZecPrice();
    fetchBridgeAddress();
    fetchWalletBalance();
    
    // Refresh price every 5 minutes (to match backend cache)
    const priceInterval = setInterval(() => {
      fetchZecPrice();
    }, 5 * 60 * 1000); // 5 minutes
    
    // Refresh balance every 30 seconds if wallet is enabled
    const balanceInterval = setInterval(() => {
      if (zcashInfo?.walletEnabled) {
        fetchWalletBalance();
      }
    }, 30000);
    
    return () => {
      clearInterval(priceInterval);
      clearInterval(balanceInterval);
    };
  }, [zcashInfo?.walletEnabled, fetchZecPrice]);

  const fetchBridgeAddress = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/zcash/bridge-address`);
      setBridgeAddress(response.data);
    } catch (err) {
      console.error('Error fetching bridge address:', err);
    }
  };

  const fetchWalletBalance = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/zcash/balance`);
      setWalletBalance(response.data);
    } catch (err) {
      // Balance endpoint may not be available if wallet is disabled
      if (err.response?.status !== 404) {
        console.error('Error fetching wallet balance:', err);
      }
    }
  };

  const handleVerifyTransaction = async (e) => {
    e.preventDefault();
    if (!txHash) return;

    setLoading(true);
    setVerificationResult(null);

    try {
      const response = await axios.post(`${API_URL}/api/zcash/verify-transaction`, {
        txHash,
      });
      setVerificationResult(response.data);
    } catch (err) {
      setVerificationResult({
        success: false,
        error: err.response?.data?.error || 'Verification failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleValidateAddress = async (e) => {
    e.preventDefault();
    if (!address) return;

    setLoading(true);
    setAddressValidation(null);

    try {
      const response = await axios.post(`${API_URL}/api/zcash/validate-address`, {
        address,
      });
      setAddressValidation(response.data);
    } catch (err) {
      setAddressValidation({
        success: false,
        error: err.response?.data?.error || 'Validation failed',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-content-wrapper">
      <h2>Zcash Integration</h2>
      <p className="tab-description">
        Verify Zcash transactions, check prices, and validate addresses for the privacy layer.
      </p>

      {/* Zcash Info */}
      {zcashInfo && (
        <div className="info-card">
          <h3>Network Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Network:</span>
              <span className="info-value">{zcashInfo.network || 'mainnet'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Lightwalletd:</span>
              <span className="info-value">{zcashInfo.lightwalletdUrl ? 'Connected' : 'Not configured'}</span>
            </div>
            {zcashInfo.walletEnabled && (
              <>
                <div className="info-item">
                  <span className="info-label">Wallet:</span>
                  <span className="info-value status-active">Enabled</span>
                </div>
                {zcashInfo.wallet && (
                  <>
                    <div className="info-item">
                      <span className="info-label">Balance:</span>
                      <span className="info-value">{zcashInfo.wallet.balance || 0} ZEC</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Addresses:</span>
                      <span className="info-value">{zcashInfo.wallet.shieldedAddresses || 0} shielded</span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

          {/* ZEC Price */}
          {zecPrice && (
            <div className="info-card">
              <h3>ZEC Price</h3>
              {zecPrice.success !== false ? (
                <>
                  <div className="price-display">
                    <span className="price-amount">${zecPrice.price?.toFixed(2) || 'N/A'}</span>
                    <span className="price-currency">USD</span>
                  </div>
                  <p className="helper-text">
                    Last updated: {new Date(zecPrice.timestamp).toLocaleString()}
                    {zecPrice.cached && <span className="cached-badge"> (Cached)</span>}
                  </p>
                </>
              ) : (
                <div className="message error-message">
                  <p><strong>Error:</strong> {zecPrice.error || 'Failed to fetch price'}</p>
                  {zecPrice.error?.includes('Rate limit') && (
                    <p className="helper-text">The price API is rate-limited. Please wait a few minutes and refresh.</p>
                  )}
                </div>
              )}
            </div>
          )}

      {/* Wallet Balance */}
      {walletBalance && walletBalance.total !== undefined && (
        <div className="info-card">
          <h3>Bridge Wallet Balance</h3>
          <div className="balance-grid">
            <div className="balance-item-large">
              <span className="balance-label">Total:</span>
              <span className="balance-value-large">{walletBalance.total.toFixed(6)} ZEC</span>
            </div>
            <div className="balance-item-large">
              <span className="balance-label">Confirmed:</span>
              <span className="balance-value-large">{walletBalance.confirmed.toFixed(6)} ZEC</span>
            </div>
            {walletBalance.unconfirmed > 0 && (
              <div className="balance-item-large">
                <span className="balance-label">Unconfirmed:</span>
                <span className="balance-value-large">{walletBalance.unconfirmed.toFixed(6)} ZEC</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bridge Address */}
      {bridgeAddress && (
        <div className="info-card">
          <h3>Bridge Address</h3>
          <div className="address-display">
            <code>{bridgeAddress.address || 'Not configured'}</code>
            <button 
              className="copy-button"
              onClick={() => navigator.clipboard.writeText(bridgeAddress.address)}
            >
              Copy
            </button>
          </div>
          <p className="helper-text">Send ZEC to this address to mint zenZEC</p>
        </div>
      )}

      {/* Transaction Verification */}
      <div className="action-card">
        <h3>Verify Transaction</h3>
        <form onSubmit={handleVerifyTransaction}>
          <div className="form-group">
            <label htmlFor="txHash">Transaction Hash</label>
            <input
              id="txHash"
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="Enter Zcash transaction hash"
              disabled={loading}
              required
            />
          </div>
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Transaction'}
          </button>
        </form>

        {verificationResult && (
          <div className={`message ${verificationResult.success ? 'success-message' : 'error-message'}`}>
            {verificationResult.success ? (
              <>
                <h4>✓ Transaction Verified</h4>
                {verificationResult.transaction && (
                  <div className="result-details">
                    <div className="detail-row">
                      <span className="detail-label">Amount:</span>
                      <span className="detail-value">{verificationResult.transaction.amount || 'N/A'} ZEC</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Block Height:</span>
                      <span className="detail-value">{verificationResult.transaction.blockHeight || 'N/A'}</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p><strong>Error:</strong> {verificationResult.error}</p>
            )}
          </div>
        )}
      </div>

      {/* Address Validation */}
      <div className="action-card">
        <h3>Validate Address</h3>
        <form onSubmit={handleValidateAddress}>
          <div className="form-group">
            <label htmlFor="address">Zcash Address</label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter Zcash address (t1, t3, or zs1)"
              disabled={loading}
              required
            />
          </div>
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Validating...' : 'Validate Address'}
          </button>
        </form>

        {addressValidation && (
          <div className={`message ${addressValidation.valid ? 'success-message' : 'error-message'}`}>
            {addressValidation.valid ? (
              <p>✓ Address is valid</p>
            ) : (
              <p>✗ Address is invalid</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ZcashTab;

