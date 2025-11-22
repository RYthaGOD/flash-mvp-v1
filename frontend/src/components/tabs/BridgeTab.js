import React, { useState } from 'react';
import axios from 'axios';
import './TabStyles.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function BridgeTab({ publicKey, connected, bridgeInfo, onBridgeComplete }) {
  const [amount, setAmount] = useState('');
  const [swapToSol, setSwapToSol] = useState(false);
  const [bitcoinTxHash, setBitcoinTxHash] = useState('');
  const [zcashTxHash, setZcashTxHash] = useState('');
  const [useZecPrivacy, setUseZecPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // SOL → zenZEC swap state
  const [solAmount, setSolAmount] = useState('');
  const [usePrivacyForSwap, setUsePrivacyForSwap] = useState(false);
  const [swapResult, setSwapResult] = useState(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState(null);

  const handleBridge = async (e) => {
    e.preventDefault();
    console.log('Bridge button clicked', { connected, publicKey, amount });
    
    if (!connected || !publicKey) {
      console.warn('Wallet not connected');
      setError('Please connect your wallet first');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      console.warn('Invalid amount');
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        solanaAddress: publicKey.toString(),
        amount: parseFloat(amount),
        swapToSol: swapToSol,
      };

      // Add optional transaction hashes
      if (bitcoinTxHash) payload.bitcoinTxHash = bitcoinTxHash;
      if (zcashTxHash) payload.zcashTxHash = zcashTxHash;
      if (useZecPrivacy) payload.useZecPrivacy = useZecPrivacy;

      console.log('Sending bridge request:', payload);
      const response = await axios.post(`${API_URL}/api/bridge`, payload);
      console.log('Bridge response:', response.data);
      setResult(response.data);
      
      if (response.data.solanaTxSignature) {
        setTimeout(() => {
          if (onBridgeComplete) onBridgeComplete();
        }, 2000);
      }
      
      setAmount('');
      setBitcoinTxHash('');
      setZcashTxHash('');
    } catch (err) {
      console.error('Bridge error:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to process bridge request';
      console.error('Error details:', { 
        message: errorMessage, 
        status: err.response?.status,
        data: err.response?.data 
      });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-content-wrapper">
      <h2>Bridge to Solana</h2>
      <p className="tab-description">
        Mint zenZEC tokens on Solana. Supports demo mode, Bitcoin verification, and Zcash verification.
      </p>

      {!connected && (
        <div className="message warning-message" style={{ marginBottom: '1rem' }}>
          <strong>⚠️ Wallet Not Connected</strong>
          <p>Please connect your Solana wallet using the button at the top of the page to use this feature.</p>
        </div>
      )}

      <form onSubmit={handleBridge} className="bridge-form">
        <div className="form-group">
          <label htmlFor="amount">Amount (zenZEC)</label>
          <input
            id="amount"
            type="number"
            step="0.000001"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="bitcoinTxHash">Bitcoin TX Hash (Optional)</label>
          <input
            id="bitcoinTxHash"
            type="text"
            value={bitcoinTxHash}
            onChange={(e) => setBitcoinTxHash(e.target.value)}
            placeholder="Leave empty for demo mode"
            disabled={loading}
          />
          <p className="helper-text">Verify Bitcoin payment before minting</p>
        </div>

        <div className="form-group">
          <label htmlFor="zcashTxHash">Zcash TX Hash (Optional)</label>
          <input
            id="zcashTxHash"
            type="text"
            value={zcashTxHash}
            onChange={(e) => setZcashTxHash(e.target.value)}
            placeholder="Leave empty for demo mode"
            disabled={loading}
          />
          <p className="helper-text">Verify Zcash shielded transaction</p>
        </div>

        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={useZecPrivacy}
              onChange={(e) => setUseZecPrivacy(e.target.checked)}
              disabled={loading}
            />
            <span>Use ZEC Privacy Layer (BTC → ZEC conversion)</span>
          </label>
        </div>

        <div className="form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={swapToSol}
              onChange={(e) => setSwapToSol(e.target.checked)}
              disabled={loading}
            />
            <span>Swap to SOL after minting</span>
          </label>
          <p className="helper-text">
            {swapToSol 
              ? 'zenZEC will be burned and SOL sent to your wallet via relayer'
              : 'zenZEC tokens will be minted to your wallet'}
          </p>
        </div>

        <button 
          type="submit" 
          className="primary-button"
          disabled={loading || !connected}
          onClick={(e) => {
            console.log('Button clicked', { loading, connected, publicKey: publicKey?.toString() });
            if (!connected) {
              e.preventDefault();
              setError('Please connect your wallet first. Click the "Select Wallet" button at the top.');
            }
          }}
        >
          {loading ? 'Processing...' : !connected ? 'Connect Wallet First' : 'Bridge to Solana'}
        </button>
      </form>

      {error && (
        <div className="message error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="message success-message">
          <h3>✓ Bridge Request {result.status === 'confirmed' ? 'Completed' : 'Submitted'}</h3>
          <div className="result-details">
            <div className="detail-row">
              <span className="detail-label">Transaction ID:</span>
              <span className="detail-value">{result.transactionId}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Amount:</span>
              <span className="detail-value">{(result.amount / 100000000).toFixed(6)} zenZEC</span>
            </div>
            {result.solanaTxSignature && (
              <div className="detail-row">
                <span className="detail-label">Solana TX:</span>
                <span className="detail-value tx-link">
                  <a 
                    href={`https://solscan.io/tx/${result.solanaTxSignature}?cluster=${bridgeInfo?.network || 'devnet'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {result.solanaTxSignature.substring(0, 16)}...
                  </a>
                </span>
              </div>
            )}
            {result.bitcoinVerification && (
              <div className="detail-row">
                <span className="detail-label">Bitcoin Verified:</span>
                <span className="detail-value">✓ {result.bitcoinVerification.amountBTC} BTC</span>
              </div>
            )}
            {result.zcashVerification && (
              <div className="detail-row">
                <span className="detail-label">Zcash Verified:</span>
                <span className="detail-value">✓ {result.zcashVerification.amount} ZEC</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SOL → zenZEC Swap Section */}
      <div className="action-card" style={{ marginTop: '2rem', borderTop: '2px solid #333', paddingTop: '2rem' }}>
        <h3>Swap SOL → zenZEC</h3>
        <p className="tab-description">
          Swap your SOL for zenZEC tokens. Supports optional Arcium privacy encryption.
        </p>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!connected || !publicKey) {
            setSwapError('Please connect your wallet first');
            return;
          }
          if (!solAmount || parseFloat(solAmount) <= 0) {
            setSwapError('Please enter a valid SOL amount');
            return;
          }

          setSwapLoading(true);
          setSwapError(null);
          setSwapResult(null);

          try {
            // Optional: Encrypt amount if privacy enabled
            if (usePrivacyForSwap) {
              try {
                await axios.post(`${API_URL}/api/arcium/encrypt-amount`, {
                  amount: parseFloat(solAmount),
                  recipientPubkey: publicKey.toString(),
                });
                // Encryption handled by backend
              } catch (err) {
                console.warn('Arcium encryption failed, continuing without privacy:', err);
              }
            }

            const response = await axios.post(`${API_URL}/api/bridge/swap-sol-to-zenzec`, {
              solanaAddress: publicKey.toString(),
              solAmount: parseFloat(solAmount),
              usePrivacy: usePrivacyForSwap,
            });
            setSwapResult(response.data);
            if (onBridgeComplete) onBridgeComplete();
          } catch (err) {
            setSwapError(err.response?.data?.error || 'Failed to swap SOL to zenZEC');
          } finally {
            setSwapLoading(false);
          }
        }}>
          <div className="form-group">
            <label htmlFor="solAmount">SOL Amount</label>
            <input
              id="solAmount"
              type="number"
              step="0.000001"
              min="0"
              value={solAmount}
              onChange={(e) => setSolAmount(e.target.value)}
              placeholder="0.0"
              disabled={swapLoading || !connected}
              required
            />
            <p className="helper-text">
              Exchange rate: 1 SOL = {process.env.REACT_APP_SOL_TO_ZENZEC_RATE || '100'} zenZEC
            </p>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={usePrivacyForSwap}
                onChange={(e) => setUsePrivacyForSwap(e.target.checked)}
                disabled={swapLoading}
              />
              <span>Use Arcium Privacy (Encrypt amount)</span>
            </label>
          </div>

          <button 
            type="submit" 
            className="primary-button"
            disabled={swapLoading || !connected}
          >
            {swapLoading ? 'Swapping...' : 'Swap SOL → zenZEC'}
          </button>
        </form>

        {swapError && (
          <div className="message error-message">
            <strong>Error:</strong> {swapError}
          </div>
        )}

        {swapResult && (
          <div className="message success-message">
            <h4>✓ {swapResult.message}</h4>
            {swapResult.demoMode && (
              <p style={{ fontSize: '0.9rem', marginTop: '10px', fontStyle: 'italic', color: '#FFD700' }}>
                ⚡ Demo Mode: This is a mock transaction for demonstration purposes
              </p>
            )}
            <div className="result-details">
              <div className="detail-row">
                <span className="detail-label">SOL Amount:</span>
                <span className="detail-value">{swapResult.solAmount} SOL</span>
              </div>
              {swapResult.zenZECAmount && (
                <div className="detail-row">
                  <span className="detail-label">zenZEC Amount:</span>
                  <span className="detail-value">{swapResult.zenZECAmount.toFixed(6)} zenZEC</span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">Transaction:</span>
                <span className="detail-value tx-link">
                  <a 
                    href={`https://solscan.io/tx/${swapResult.solanaTxSignature}?cluster=${bridgeInfo?.network || 'devnet'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {swapResult.solanaTxSignature.substring(0, 16)}...
                  </a>
                  {swapResult.demoMode && (
                    <span style={{ fontSize: '0.8rem', marginLeft: '10px', fontStyle: 'italic', color: '#FFD700' }}>
                      (Mock)
                    </span>
                  )}
                </span>
              </div>
              {swapResult.encrypted && (
                <div className="detail-row">
                  <span className="detail-label">Privacy:</span>
                  <span className="detail-value">✓ Encrypted via Arcium MPC</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BridgeTab;

