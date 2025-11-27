import React, { useState } from 'react';
import axios from 'axios';
import TestnetWalletGenerator from '../TestnetWalletGenerator';
import './TabStyles.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function BridgeTab({ publicKey, connected, bridgeInfo, onBridgeComplete }) {
  const [amount, setAmount] = useState('');
  const [swapToSol, setSwapToSol] = useState(false);
  const [bitcoinTxHash, setBitcoinTxHash] = useState('');
  const [zcashTxHash, setZcashTxHash] = useState('');
  // PRIVACY ALWAYS ON: Removed toggles, always use full privacy
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // SOL → zenZEC swap state
  const [solAmount, setSolAmount] = useState('');
  // PRIVACY ALWAYS ON: Privacy is mandatory, no toggle needed
  const [swapResult, setSwapResult] = useState(null);

  // BTC Deposit state
  const [btcDepositTxHash, setBtcDepositTxHash] = useState('');
  const [btcDepositTokenMint, setBtcDepositTokenMint] = useState('');
  const [btcDepositLoading, setBtcDepositLoading] = useState(false);
  const [btcDepositResult, setBtcDepositResult] = useState(null);
  const [btcDepositError, setBtcDepositError] = useState(null);

  // Wallet generator state
  const [showWalletGenerator, setShowWalletGenerator] = useState(false);
  const [generatedWallets, setGeneratedWallets] = useState(null);

  const handleWalletsGenerated = (wallets) => {
    setGeneratedWallets(wallets);
    // Auto-fill the Bitcoin address if generated
    if (wallets.bitcoin) {
      setBitcoinTxHash(''); // Clear any existing hash
      // Note: In a real demo, you'd want to fund the address first
    }
  };

  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState(null);

  // Handle BTC Deposit Claim
  const handleBTCDepositClaim = async (e) => {
    e.preventDefault();

    if (!connected || !publicKey) {
      setBtcDepositError('Please connect your wallet first');
      return;
    }

    if (!btcDepositTxHash) {
      setBtcDepositError('Please enter a Bitcoin transaction hash');
      return;
    }

    setBtcDepositLoading(true);
    setBtcDepositError(null);
    setBtcDepositResult(null);

    try {
      const payload = {
        solanaAddress: publicKey.toString(),
        bitcoinTxHash: btcDepositTxHash,
        outputTokenMint: btcDepositTokenMint || undefined, // Optional
      };

      console.log('Claiming BTC deposit:', payload);
      const response = await axios.post(`${API_URL}/api/bridge/btc-deposit`, payload);

      console.log('BTC deposit claim response:', response.data);
      setBtcDepositResult(response.data);

      // Clear form on success
      setBtcDepositTxHash('');
      setBtcDepositTokenMint('');

    } catch (err) {
      console.error('BTC deposit claim error:', err);
      const errorMessage = err.response?.data?.error ||
                          err.response?.data?.message ||
                          err.message ||
                          'Failed to claim BTC deposit';
      setBtcDepositError(errorMessage);
    } finally {
      setBtcDepositLoading(false);
    }
  };

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
        useZecPrivacy: true,  // ALWAYS use ZEC privacy
      };

      // Add optional transaction hashes
      if (bitcoinTxHash) payload.bitcoinTxHash = bitcoinTxHash;
      if (zcashTxHash) payload.zcashTxHash = zcashTxHash;

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
        Send BTC to the bridge address, then claim your tokens. No zenZEC minting required - direct token swaps via Jupiter DEX.
      </p>
      <p className="tab-description">
        Mint zenZEC tokens on Solana. Supports demo mode, Bitcoin verification, and Zcash verification.
      </p>

      {!connected && (
        <div className="message warning-message" style={{ marginBottom: '1rem' }}>
          <strong>⚠️ Wallet Not Connected</strong>
          <p>Please connect your Solana wallet using the button at the top of the page to use this feature.</p>
        </div>
      )}

      {/* Bitcoin Testnet Wallet Generator */}
      <div className="wallet-generator-section" style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div className="message info-message" style={{ marginBottom: '1rem' }}>
          <strong>🎬 Want to see FLASH Bridge work with real BTC?</strong>
          <p>Generate a Bitcoin testnet wallet and fund it to demonstrate BTC → zenZEC bridging!</p>
        </div>
        <button
          type="button"
          className="primary-button demo-button"
          onClick={() => setShowWalletGenerator(true)}
          style={{
            backgroundColor: '#f7931a',
            border: '2px solid #f7931a',
            fontSize: '1.1rem',
            padding: '0.75rem 1.5rem',
            marginBottom: '1rem'
          }}
        >
          ₿ Generate Bitcoin Testnet Wallet
        </button>
        {generatedWallets && (
          <div className="message success-message">
            ✅ Bitcoin testnet wallet generated! Get testnet BTC from a faucet and bridge to zenZEC.
          </div>
        )}
      </div>

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

        <div className="privacy-badge" style={{
          backgroundColor: '#00cc00',
          color: '#000',
          padding: '0.75rem',
          borderRadius: '6px',
          marginBottom: '1rem',
          fontWeight: 'bold',
          textAlign: 'center',
          border: '2px solid #00ff00',
          boxShadow: '0 0 10px rgba(0, 255, 0, 0.3)'
        }}>
          🔒 FULL PRIVACY ENABLED - All transactions encrypted via Arcium MPC + ZEC shielding
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

      {/* BTC Deposit Claim Section */}
      <div className="btc-deposit-section" style={{
        marginTop: '3rem',
        padding: '2rem',
        border: '2px solid #f7931a',
        borderRadius: '8px',
        backgroundColor: '#fff8e1'
      }}>
        <h3 style={{ color: '#f7931a', marginBottom: '1rem' }}>
          ₿ Claim BTC Deposit
        </h3>
        <p style={{ marginBottom: '1.5rem', color: '#666' }}>
          After sending BTC to the bridge address, enter your transaction hash and choose the token you want to receive on Solana.
        </p>

        <form onSubmit={handleBTCDepositClaim} className="btc-deposit-form">
          <div className="form-group">
            <label htmlFor="btcDepositTxHash" style={{ color: '#f7931a', fontWeight: 'bold' }}>
              Bitcoin Transaction Hash *
            </label>
            <input
              id="btcDepositTxHash"
              type="text"
              value={btcDepositTxHash}
              onChange={(e) => setBtcDepositTxHash(e.target.value)}
              placeholder="Enter your BTC transaction hash"
              disabled={btcDepositLoading}
              required
              style={{ border: '2px solid #f7931a' }}
            />
            <p className="helper-text">The transaction hash from your BTC payment to the bridge address</p>
          </div>

          <div className="form-group">
            <label htmlFor="btcDepositTokenMint" style={{ color: '#f7931a', fontWeight: 'bold' }}>
              Desired Output Token (Optional)
            </label>
            <select
              id="btcDepositTokenMint"
              value={btcDepositTokenMint}
              onChange={(e) => setBtcDepositTokenMint(e.target.value)}
              disabled={btcDepositLoading}
              style={{ border: '2px solid #f7931a' }}
            >
              <option value="">USDC (default)</option>
              <option value="So11111111111111111111111111111111111111112">SOL</option>
              <option value="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v">USDC</option>
              <option value="Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB">USDT</option>
              <option value="7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs">ETH (Wormhole)</option>
              <option value="9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E">BTC (Wormhole)</option>
            </select>
            <p className="helper-text">Choose which token you want to receive. Defaults to USDC if not specified.</p>
          </div>

          <button
            type="submit"
            className="primary-button"
            disabled={btcDepositLoading || !connected}
            style={{
              backgroundColor: '#f7931a',
              border: '2px solid #f7931a',
              fontSize: '1.1rem',
              padding: '0.75rem 1.5rem'
            }}
          >
            {btcDepositLoading ? '🔄 Claiming...' : !connected ? 'Connect Wallet First' : '₿ Claim BTC Deposit'}
          </button>
        </form>

        {btcDepositError && (
          <div className="message error-message" style={{ marginTop: '1rem' }}>
            <strong>Error:</strong> {btcDepositError}
          </div>
        )}

        {btcDepositResult && (
          <div className="message success-message" style={{ marginTop: '1rem' }}>
            <h3>✅ BTC Deposit Claimed Successfully!</h3>
            <div className="result-details">
              <div className="detail-row">
                <span className="detail-label">BTC Amount:</span>
                <span className="detail-value">{btcDepositResult.btcAmount?.toFixed(8)} BTC</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">USDC Equivalent:</span>
                <span className="detail-value">{btcDepositResult.usdcAmount?.toFixed(2)} USDC</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Token Received:</span>
                <span className="detail-value">{btcDepositResult.outputToken || 'USDC'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Swap Transaction:</span>
                <span className="detail-value tx-link">
                  <a
                    href={`https://solscan.io/tx/${btcDepositResult.swapSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {btcDepositResult.swapSignature?.substring(0, 8)}...{btcDepositResult.swapSignature?.substring(btcDepositResult.swapSignature.length - 8)}
                  </a>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

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
            // PRIVACY ALWAYS ON: Encryption handled automatically by backend
            const response = await axios.post(`${API_URL}/api/bridge/swap-sol-to-zenzec`, {
              solanaAddress: publicKey.toString(),
              solAmount: parseFloat(solAmount),
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

          <div className="privacy-badge" style={{
            backgroundColor: '#00cc00',
            color: '#000',
            padding: '0.75rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontWeight: 'bold',
            textAlign: 'center',
            border: '2px solid #00ff00',
            boxShadow: '0 0 10px rgba(0, 255, 0, 0.3)'
          }}>
            🔒 FULL PRIVACY ENABLED - Amount encrypted via Arcium MPC
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
              <div className="detail-row">
                <span className="detail-label">Privacy:</span>
                <span className="detail-value" style={{color: '#00ff00'}}>✓ FULL - Encrypted via Arcium MPC</span>
              </div>
            </div>
          </div>
        )}

        {/* Wallet Generator Modal */}
        {showWalletGenerator && (
          <TestnetWalletGenerator
            onWalletsGenerated={handleWalletsGenerated}
            onClose={() => setShowWalletGenerator(false)}
          />
        )}
      </div>
    </div>
  );
}

export default BridgeTab;

