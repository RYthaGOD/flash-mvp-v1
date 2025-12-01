import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './TabStyles.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function ZcashTab() {
  const [zcashInfo, setZcashInfo] = useState(null);
  const [bridgeAddress, setBridgeAddress] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [zecPrice, setZecPrice] = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const [priceError, setPriceError] = useState(null);
  const [txHash, setTxHash] = useState('');
  const [address, setAddress] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [addressValidation, setAddressValidation] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchZcashInfo = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/zcash/info`);
      setZcashInfo(data);
    } catch (error) {
      console.error('Error fetching Zcash info:', error);
    }
  }, []);

  const fetchBridgeAddress = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/zcash/bridge-address`);
      setBridgeAddress(data);
    } catch (error) {
      console.error('Error fetching bridge address:', error);
    }
  }, []);

  const fetchWalletBalance = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/zcash/balance`);
      setWalletBalance(data);
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Error fetching wallet balance:', error);
      }
    }
  }, []);

  const fetchZecPrice = useCallback(async () => {
    try {
      setPriceLoading(true);
      const { data } = await axios.get(`${API_URL}/api/zcash/price`);
      setZecPrice(data);
      setPriceError(null);
    } catch (error) {
      console.error('Error fetching ZEC price:', error);
      setPriceError(
        error.response?.status === 429
          ? 'Rate limit exceeded. Please wait a few minutes.'
          : 'Failed to fetch price'
      );
      setZecPrice((prev) => (prev?.price ? prev : null));
    } finally {
      setPriceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZcashInfo();
    fetchBridgeAddress();
    fetchWalletBalance();
    fetchZecPrice();

    const priceInterval = setInterval(fetchZecPrice, 5 * 60 * 1000);
    let balanceInterval = null;

    if (zcashInfo?.walletEnabled) {
      balanceInterval = setInterval(fetchWalletBalance, 30 * 1000);
    }

    return () => {
      clearInterval(priceInterval);
      if (balanceInterval) {
        clearInterval(balanceInterval);
      }
    };
  }, [
    fetchZcashInfo,
    fetchBridgeAddress,
    fetchWalletBalance,
    fetchZecPrice,
    zcashInfo?.walletEnabled,
  ]);

  const handleVerifyTransaction = async (event) => {
    event.preventDefault();
    if (!txHash) return;

    setActionLoading(true);
    setVerificationResult(null);

    try {
      const { data } = await axios.post(`${API_URL}/api/zcash/verify-transaction`, {
        txHash,
      });
      setVerificationResult(data);
    } catch (error) {
      setVerificationResult({
        success: false,
        error: error.response?.data?.error || 'Verification failed',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleValidateAddress = async (event) => {
    event.preventDefault();
    if (!address) return;

    setActionLoading(true);
    setAddressValidation(null);

    try {
      const { data } = await axios.post(`${API_URL}/api/zcash/validate-address`, {
        address,
      });
      setAddressValidation(data);
    } catch (error) {
      setAddressValidation({
        success: false,
        error: error.response?.data?.error || 'Validation failed',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const renderPriceSection = () => {
    if (priceLoading) {
      return <div className="helper-text">Loading price...</div>;
    }

    if (priceError && !zecPrice?.price) {
      return (
        <div className="message error-message">
          <p><strong>Error:</strong> {priceError}</p>
        </div>
      );
    }

    if (!zecPrice?.price) return null;

    return (
      <div className="price-display">
        <span className="price-amount">${zecPrice.price.toFixed(2)}</span>
        <span className="price-currency">USD</span>
        <p className="helper-text">
          Last updated: {new Date(zecPrice.timestamp || Date.now()).toLocaleString()}
          {zecPrice.cached && <span className="cached-badge"> (Cached)</span>}
        </p>
      </div>
    );
  };

  return (
    <div className="tab-content-wrapper">
      <h2>Zcash Integration</h2>
      <p className="tab-description">
        Verify Zcash transactions, monitor bridge wallets, and validate addresses for the shielded layer.
      </p>

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
              <span className="info-value">
                {zcashInfo.lightwalletdUrl ? 'Connected' : 'Not configured'}
              </span>
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
                      <span className="info-value">
                        {zcashInfo.wallet.balance || 0} ZEC
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Addresses:</span>
                      <span className="info-value">
                        {zcashInfo.wallet.shieldedAddresses || 0} shielded
                      </span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="info-card">
        <h3>ZEC Price</h3>
        {priceError && zecPrice?.price && (
          <div className="message warning-message">
            <strong>Warning:</strong> {priceError} — showing last known price.
          </div>
        )}
        {renderPriceSection()}
        <button
          className="secondary-button"
          onClick={fetchZecPrice}
          disabled={priceLoading}
        >
          {priceLoading ? 'Refreshing...' : 'Refresh Price'}
        </button>
      </div>

      {walletBalance && walletBalance.total !== undefined && (
        <div className="info-card">
          <h3>Bridge Wallet Balance</h3>
          <div className="balance-grid">
            <div className="balance-item-large">
              <span className="balance-label">Total:</span>
              <span className="balance-value-large">
                {walletBalance.total.toFixed(6)} ZEC
              </span>
            </div>
            <div className="balance-item-large">
              <span className="balance-label">Confirmed:</span>
              <span className="balance-value-large">
                {walletBalance.confirmed.toFixed(6)} ZEC
              </span>
            </div>
            {walletBalance.unconfirmed > 0 && (
              <div className="balance-item-large">
                <span className="balance-label">Unconfirmed:</span>
                <span className="balance-value-large">
                  {walletBalance.unconfirmed.toFixed(6)} ZEC
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {bridgeAddress && (
        <div className="info-card">
          <h3>Bridge Address</h3>
          <div className="address-display">
            <code>{bridgeAddress.address || 'Not configured'}</code>
            <button
              className="copy-button"
              onClick={() => navigator.clipboard.writeText(bridgeAddress.address || '')}
            >
              Copy
            </button>
          </div>
          <p className="helper-text">
            Send ZEC to this address to mint shielded zenZEC.
          </p>
        </div>
      )}

      <div className="action-card">
        <h3>Verify Transaction</h3>
        <form onSubmit={handleVerifyTransaction}>
          <div className="form-group">
            <label htmlFor="txHash">Transaction Hash</label>
            <input
              id="txHash"
              type="text"
              value={txHash}
              onChange={(event) => setTxHash(event.target.value)}
              placeholder="Enter Zcash transaction hash"
              disabled={actionLoading}
              required
            />
          </div>
          <button type="submit" className="primary-button" disabled={actionLoading}>
            {actionLoading ? 'Verifying...' : 'Verify Transaction'}
          </button>
        </form>

        {verificationResult && (
          <div
            className={`message ${
              verificationResult.success ? 'success-message' : 'error-message'
            }`}
          >
            {verificationResult.success ? (
              <>
                <h4>✓ Transaction Verified</h4>
                {verificationResult.transaction && (
                  <div className="result-details">
                    <div className="detail-row">
                      <span className="detail-label">Amount:</span>
                      <span className="detail-value">
                        {verificationResult.transaction.amount || 'N/A'} ZEC
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Block Height:</span>
                      <span className="detail-value">
                        {verificationResult.transaction.blockHeight || 'N/A'}
                      </span>
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

      <div className="action-card">
        <h3>Validate Address</h3>
        <form onSubmit={handleValidateAddress}>
          <div className="form-group">
            <label htmlFor="address">Zcash Address</label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Enter Zcash address (t1, t3, or zs1)"
              disabled={actionLoading}
              required
            />
          </div>
          <button type="submit" className="primary-button" disabled={actionLoading}>
            {actionLoading ? 'Validating...' : 'Validate Address'}
          </button>
        </form>

        {addressValidation && (
          <div
            className={`message ${
              addressValidation.valid ? 'success-message' : 'error-message'
            }`}
          >
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

