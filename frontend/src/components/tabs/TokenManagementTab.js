import React, { useState } from 'react';
import { Transaction, PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useWallet } from '@solana/wallet-adapter-react';
import { getAssociatedTokenAddress, createBurnInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import axios from 'axios';
import './TabStyles.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const ZENZEC_MINT = process.env.REACT_APP_ZENZEC_MINT || '';

function TokenManagementTab({ publicKey, connected, connection, tokenBalance, solBalance, onActionComplete }) {
  const { signTransaction } = useWallet();
  const [burnAmount, setBurnAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // zenZEC → BTC burn state
  const [btcBurnAmount, setBtcBurnAmount] = useState('');
  const [btcAddress, setBtcAddress] = useState('');
  // PRIVACY ALWAYS ON: Removed toggle, BTC addresses always encrypted
  const [btcBurnLoading, setBtcBurnLoading] = useState(false);
  const [btcBurnResult, setBtcBurnResult] = useState(null);
  const [btcBurnError, setBtcBurnError] = useState(null);

  const handleBurnAndEmit = async (e) => {
    e.preventDefault();
    
    if (!connected || !publicKey || !signTransaction) {
      setError('Please connect your wallet first');
      return;
    }

    if (!burnAmount || parseFloat(burnAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!tokenBalance || parseFloat(burnAmount) > tokenBalance) {
      setError('Insufficient zenZEC balance');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const mintPubkey = new PublicKey(ZENZEC_MINT);
      const userTokenAccount = await getAssociatedTokenAddress(mintPubkey, publicKey);

      // Load program (simplified - in production, load IDL)
      // For now, we'll use a direct instruction call
      const amountBN = new BN(Math.floor(parseFloat(burnAmount) * 1e8));

      // Create burn_and_emit instruction
      // Note: This is a simplified version. In production, use the Anchor IDL
      const transaction = new Transaction();

      // Add burn instruction
      const burnIx = createBurnInstruction(
        userTokenAccount,
        mintPubkey,
        publicKey,
        amountBN.toNumber(),
        [],
        TOKEN_PROGRAM_ID
      );
      transaction.add(burnIx);

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign and send
      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');

      setResult({
        success: true,
        signature,
        message: 'zenZEC burned successfully. Relayer will send SOL shortly.',
      });

      if (onActionComplete) onActionComplete();
    } catch (err) {
      console.error('Burn error:', err);
      setError(err.message || 'Failed to burn zenZEC');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-content-wrapper">
      <h2>Token Management</h2>
      <p className="tab-description">
        Manage your zenZEC tokens: burn tokens or swap to SOL via the relayer.
      </p>

      {/* Balance Display */}
      <div className="info-card">
        <h3>Your Balances</h3>
        <div className="balance-grid">
          <div className="balance-item-large">
            <span className="balance-label">zenZEC Balance:</span>
            <span className="balance-value-large">{tokenBalance !== null ? tokenBalance.toFixed(6) : '...'}</span>
          </div>
          <div className="balance-item-large">
            <span className="balance-label">SOL Balance:</span>
            <span className="balance-value-large">{solBalance !== null ? solBalance.toFixed(4) : '...'}</span>
          </div>
        </div>
      </div>

      {/* Burn and Emit */}
      <div className="action-card">
        <h3>Burn zenZEC & Swap to SOL</h3>
        <p className="helper-text">
          Burn your zenZEC tokens and emit an event. The relayer will automatically send SOL to your wallet.
        </p>
        <form onSubmit={handleBurnAndEmit}>
          <div className="form-group">
            <label htmlFor="burnAmount">Amount to Burn (zenZEC)</label>
            <input
              id="burnAmount"
              type="number"
              step="0.000001"
              min="0"
              max={tokenBalance || 0}
              value={burnAmount}
              onChange={(e) => setBurnAmount(e.target.value)}
              placeholder="0.0"
              disabled={loading || !connected || !tokenBalance}
              required
            />
            {tokenBalance && (
              <p className="helper-text">
                Available: {tokenBalance.toFixed(6)} zenZEC
              </p>
            )}
          </div>
          <button 
            type="submit" 
            className="primary-button"
            disabled={loading || !connected || !tokenBalance}
          >
            {loading ? 'Processing...' : 'Burn & Swap to SOL'}
          </button>
        </form>

        {error && (
          <div className="message error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="message success-message">
            <h4>✓ {result.message}</h4>
            {result.signature && (
              <div className="result-details">
                <div className="detail-row">
                  <span className="detail-label">Transaction:</span>
                  <span className="detail-value tx-link">
                    <a 
                      href={`https://solscan.io/tx/${result.signature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {result.signature.substring(0, 16)}...
                    </a>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!connected && (
        <div className="message info-message">
          <p>Connect your wallet to manage tokens</p>
        </div>
      )}

      {connected && (!tokenBalance || tokenBalance === 0) && (
        <div className="message info-message">
          <p>You don't have any zenZEC tokens. Bridge some tokens first!</p>
        </div>
      )}

      {/* Burn zenZEC for BTC */}
      <div className="action-card" style={{ marginTop: '2rem', borderTop: '2px solid #333', paddingTop: '2rem' }}>
        <h3>Burn zenZEC & Receive BTC</h3>
        <p className="helper-text">
          Burn your zenZEC tokens and receive BTC. The BTC relayer will automatically send BTC to your address.
          Full privacy enabled - your BTC address is encrypted via Arcium MPC.
        </p>
        <form onSubmit={async (e) => {
          e.preventDefault();
          
          if (!connected || !publicKey || !signTransaction) {
            setBtcBurnError('Please connect your wallet first');
            return;
          }

          if (!btcBurnAmount || parseFloat(btcBurnAmount) <= 0) {
            setBtcBurnError('Please enter a valid amount');
            return;
          }

          if (!tokenBalance || parseFloat(btcBurnAmount) > tokenBalance) {
            setBtcBurnError('Insufficient zenZEC balance');
            return;
          }

          if (!btcAddress) {
            setBtcBurnError('Please enter a Bitcoin address');
            return;
          }

          setBtcBurnLoading(true);
          setBtcBurnError(null);
          setBtcBurnResult(null);

          try {
            // PRIVACY ALWAYS ON: BTC address is encrypted automatically by backend
            // No need to encrypt on frontend - backend handles all encryption via Arcium MPC
            
            // Get transaction from backend (with proper burn_for_btc instruction)
            const txResponse = await axios.post(`${API_URL}/api/bridge/create-burn-for-btc-tx`, {
              solanaAddress: publicKey.toString(),
              amount: parseFloat(btcBurnAmount),
              btcAddress: btcAddress,  // Backend will encrypt this
            });

            if (!txResponse.data.success || !txResponse.data.transaction) {
              throw new Error('Failed to create transaction');
            }

            // Deserialize transaction from backend
            const transactionBuffer = Buffer.from(txResponse.data.transaction, 'base64');
            const transaction = Transaction.from(transactionBuffer);

            // Get recent blockhash (in case it expired)
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            // Sign and send
            const signed = await signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signed.serialize(), {
              skipPreflight: false,
            });
            
            await connection.confirmTransaction({
              signature,
              blockhash,
              lastValidBlockHeight
            }, 'confirmed');

            setBtcBurnResult({
              success: true,
              signature,
              message: 'zenZEC burned successfully. BTC relayer will send BTC shortly.',
              btcAddress: '[ENCRYPTED]',
              encrypted: true,  // Privacy is always on
            });

            if (onActionComplete) onActionComplete();
          } catch (err) {
            console.error('BTC burn error:', err);
            setBtcBurnError(err.response?.data?.error || err.message || 'Failed to burn zenZEC for BTC');
          } finally {
            setBtcBurnLoading(false);
          }
        }}>
          <div className="form-group">
            <label htmlFor="btcBurnAmount">Amount to Burn (zenZEC)</label>
            <input
              id="btcBurnAmount"
              type="number"
              step="0.000001"
              min="0"
              max={tokenBalance || 0}
              value={btcBurnAmount}
              onChange={(e) => setBtcBurnAmount(e.target.value)}
              placeholder="0.0"
              disabled={btcBurnLoading || !connected || !tokenBalance}
              required
            />
            {tokenBalance && (
              <p className="helper-text">
                Available: {tokenBalance.toFixed(6)} zenZEC
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="btcAddress">Bitcoin Address</label>
            <input
              id="btcAddress"
              type="text"
              value={btcAddress}
              onChange={(e) => setBtcAddress(e.target.value)}
              placeholder="bc1q... or 1..."
              disabled={btcBurnLoading || !connected}
              required
            />
            <p className="helper-text">
              Exchange rate: 1 zenZEC = {process.env.REACT_APP_ZENZEC_TO_BTC_RATE || '0.001'} BTC
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
            🔒 FULL PRIVACY ENABLED - BTC address encrypted via Arcium MPC
          </div>

          <button 
            type="submit" 
            className="primary-button"
            disabled={btcBurnLoading || !connected || !tokenBalance}
          >
            {btcBurnLoading ? 'Processing...' : 'Burn & Receive BTC'}
          </button>
        </form>

        {btcBurnError && (
          <div className="message error-message">
            <strong>Error:</strong> {btcBurnError}
          </div>
        )}

        {btcBurnResult && (
          <div className="message success-message">
            <h4>✓ {btcBurnResult.message}</h4>
            <div className="result-details">
              <div className="detail-row">
                <span className="detail-label">BTC Address:</span>
                <span className="detail-value">{btcBurnResult.btcAddress === '[ENCRYPTED]' ? '🔒 Encrypted' : btcBurnResult.btcAddress}</span>
              </div>
              {btcBurnResult.signature && (
                <div className="detail-row">
                  <span className="detail-label">Transaction:</span>
                  <span className="detail-value tx-link">
                    <a 
                      href={`https://solscan.io/tx/${btcBurnResult.signature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {btcBurnResult.signature.substring(0, 16)}...
                    </a>
                  </span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">Privacy:</span>
                <span className="detail-value" style={{color: '#00ff00'}}>✓ FULL - BTC address encrypted via Arcium MPC</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TokenManagementTab;

