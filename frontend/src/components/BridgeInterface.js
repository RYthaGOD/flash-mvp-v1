import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import axios from 'axios';
import './BridgeInterface.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function BridgeInterface() {
  const { publicKey, connected } = useWallet();
  const [amount, setAmount] = useState('');
  const [swapToSol, setSwapToSol] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [bridgeInfo, setBridgeInfo] = useState(null);
  const [workflowStep, setWorkflowStep] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  // Fetch bridge info on mount
  useEffect(() => {
    fetchBridgeInfo();
  }, []);

  const fetchBridgeInfo = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/bridge/info`);
      setBridgeInfo(response.data);
    } catch (err) {
      console.error('Error fetching bridge info:', err);
    }
  };

  const handleBridge = async (e) => {
    e.preventDefault();
    
    if (!connected || !publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setWorkflowStep('initiating');
    setStatusMessage('Initiating bridge request...');

    try {
      // Step 1: Initiate bridge
      setWorkflowStep('processing');
      setStatusMessage('Processing bridge request...');
      
      const response = await axios.post(`${API_URL}/api/bridge`, {
        solanaAddress: publicKey.toString(),
        amount: parseFloat(amount),
        swapToSol: swapToSol,
      });

      setResult(response.data);
      
      // Update workflow step based on response
      if (response.data.solanaTxSignature) {
        setWorkflowStep('minting');
        setStatusMessage('Minting zenZEC tokens on Solana...');
        
        // Wait a bit then check status
        setTimeout(() => {
          setWorkflowStep('completed');
          setStatusMessage('Bridge completed successfully!');
        }, 2000);
      } else {
        setWorkflowStep('pending');
        setStatusMessage('Bridge request submitted (demo mode)');
      }
      
      setAmount('');
    } catch (err) {
      console.error('Bridge error:', err);
      setError(err.response?.data?.error || 'Failed to process bridge request');
      setWorkflowStep('error');
      setStatusMessage('Bridge request failed');
    } finally {
      setLoading(false);
    }
  };

  const getWorkflowSteps = () => {
    const isRequesting = workflowStep === 'initiating' || workflowStep === 'processing';
    const isMinting = workflowStep === 'minting';
    const isCompleted = workflowStep === 'completed';
    
    const steps = [
      { 
        id: 1, 
        name: 'Connect Wallet', 
        status: connected ? 'completed' : 'pending' 
      },
      { 
        id: 2, 
        name: 'Enter Amount', 
        status: amount && parseFloat(amount) > 0 ? 'completed' : 'pending' 
      },
      { 
        id: 3, 
        name: 'Bridge Request', 
        status: isRequesting ? 'active' : isCompleted || isMinting ? 'completed' : 'pending' 
      },
      { 
        id: 4, 
        name: 'Mint zenZEC', 
        status: isMinting ? 'active' : isCompleted ? 'completed' : 'pending' 
      },
      { 
        id: 5, 
        name: swapToSol ? 'Swap to SOL' : 'Hold zenZEC', 
        status: isCompleted && swapToSol ? 'pending' : isCompleted ? 'completed' : 'pending' 
      },
    ];
    return steps;
  };

  return (
    <div className="bridge-container">
      <div className="bridge-card">
        <h1 className="bridge-title">FLASH Bridge</h1>
        <p className="bridge-subtitle">BTC → ZEC (shielded) → Solana</p>

        {/* Bridge Info */}
        {bridgeInfo && (
          <div className="bridge-info-box">
            <h3>Bridge Status</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Network:</span>
                <span className="info-value">{bridgeInfo.network || 'devnet'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Status:</span>
                <span className="info-value status-active">{bridgeInfo.status || 'active'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Workflow Steps */}
        <div className="workflow-steps">
          <h3>Workflow</h3>
          <div className="steps-container">
            {getWorkflowSteps().map((step, index) => (
              <div key={step.id} className={`workflow-step ${step.status}`}>
                <div className="step-number">{step.status === 'completed' ? '✓' : step.status === 'active' ? '→' : step.id}</div>
                <div className="step-name">{step.name}</div>
                {index < getWorkflowSteps().length - 1 && <div className="step-connector"></div>}
              </div>
            ))}
          </div>
        </div>

        <div className="wallet-section">
          <WalletMultiButton />
        </div>

        {connected && (
          <>
            <div className="info-box">
              <p><strong>Connected Wallet:</strong></p>
              <p className="wallet-address">{publicKey.toString()}</p>
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
                className="bridge-button"
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Bridge to Solana'}
              </button>
            </form>

            {error && (
              <div className="message error-message">
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Status Message */}
            {statusMessage && (
              <div className={`status-message ${workflowStep === 'error' ? 'error' : workflowStep === 'completed' ? 'success' : 'info'}`}>
                {statusMessage}
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
                  <div className="detail-row">
                    <span className="detail-label">Status:</span>
                    <span className={`detail-value status-${result.status}`}>{result.status}</span>
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
                  {result.demoMode && (
                    <div className="detail-row">
                      <span className="detail-label">Mode:</span>
                      <span className="detail-value">Demo (No TX verification)</span>
                    </div>
                  )}
                  {result.swapToSol && (
                    <div className="detail-row">
                      <span className="detail-label">Next Step:</span>
                      <span className="detail-value">Call burn_and_emit to swap to SOL</span>
                    </div>
                  )}
                </div>
                <p className="helper-text">{result.message}</p>
              </div>
            )}
          </>
        )}

        {!connected && (
          <div className="info-box">
            <p>Connect your Solana wallet to start bridging</p>
            <ul className="feature-list">
              <li>✓ Mock BTC payment via Cash App/Lightning</li>
              <li>✓ Shield BTC into ZEC (conceptual)</li>
              <li>✓ Mint zenZEC tokens on Solana</li>
              <li>✓ Optional: Burn zenZEC to receive SOL</li>
            </ul>
          </div>
        )}

        <div className="warning-box">
          ⚠️ <strong>MVP Demo Only</strong> — Not production-ready. No audit. Do not use with real funds.
        </div>
      </div>
    </div>
  );
}

export default BridgeInterface;
