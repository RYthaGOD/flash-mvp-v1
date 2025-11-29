import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';
import { default as WalletGenerator } from '../utils/wallet-generator/index.js';
import './BridgeFlow.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function BridgeFlow() {
  const { publicKey, connected } = useWallet();
  const [step, setStep] = useState(1); // 1: Generate BTC, 2: Input Form, 3: Process
  const [btcWallet, setBtcWallet] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [btcAmount, setBtcAmount] = useState('');
  const [btcTxHash, setBtcTxHash] = useState('');
  const [processSteps, setProcessSteps] = useState([]);
  const [error, setError] = useState(null);

  // Screen 1: Generate BTC Wallet
  const handleGenerateBTC = async () => {
    setGenerating(true);
    setError(null);
    
    try {
      const generator = new WalletGenerator();
      const result = await generator.generateAllWallets();
      
      if (result.success && result.wallets?.bitcoin) {
        setBtcWallet(result.wallets.bitcoin);
        setStep(2);
      } else {
        setError(result.error || 'Failed to generate BTC wallet. Please try again.');
      }
    } catch (err) {
      console.error('Wallet generation error:', err);
      setError(err.message || 'Failed to generate BTC wallet. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Screen 2: Input Form
  const handleSubmitAmount = () => {
    if (!btcAmount || parseFloat(btcAmount) <= 0) {
      setError('Please enter a valid BTC amount');
      return;
    }
    
    if (!btcTxHash.trim()) {
      setError('Please enter a Bitcoin transaction hash');
      return;
    }
    
    if (!connected || !publicKey) {
      setError('Please connect your Solana wallet first');
      return;
    }
    
    setStep(3);
    startBridgeProcess();
  };

  // Screen 3: Backend Process
  const startBridgeProcess = async () => {
    setError(null);
    setProcessSteps([
      { id: 1, name: 'Verifying BTC Transaction', status: 'active', time: null },
      { id: 2, name: 'Shielding to Zcash', status: 'pending', time: null },
      { id: 3, name: 'Encrypting with Arcium MPC', status: 'pending', time: null },
      { id: 4, name: 'Minting zenZEC on Solana', status: 'pending', time: null },
      { id: 5, name: 'Completing Bridge', status: 'pending', time: null }
    ]);

    try {
      // Step 1: Verify BTC
      await updateStep(1, 'completed');
      await delay(1500);
      
      // Step 2: Shield to Zcash
      await updateStep(2, 'active');
      await delay(2000);
      await updateStep(2, 'completed');
      
      // Step 3: Encrypt
      await updateStep(3, 'active');
      await delay(1800);
      await updateStep(3, 'completed');
      
      // Step 4: Mint
      await updateStep(4, 'active');
      const response = await axios.post(`${API_URL}/api/bridge/`, {
        solanaAddress: publicKey.toString(),
        bitcoinTxHash: btcTxHash.trim(),
        amount: parseFloat(btcAmount),
        swapToSol: false,
      });
      await updateStep(4, 'completed');
      
      // Step 5: Complete
      await updateStep(5, 'active');
      await delay(1000);
      await updateStep(5, 'completed');
      
      // Success - could navigate to success screen or show result
      console.log('Bridge completed:', response.data);
      
    } catch (err) {
      console.error('Bridge error:', err);
      setError(err.response?.data?.error || 'Bridge process failed');
      setProcessSteps(prev => prev.map(step => 
        step.status === 'active' ? { ...step, status: 'error' } : step
      ));
    }
  };

  const updateStep = async (stepId, status) => {
    setProcessSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, time: new Date().toLocaleTimeString() }
        : step
    ));
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const resetFlow = () => {
    setStep(1);
    setBtcWallet(null);
    setBtcAmount('');
    setBtcTxHash('');
    setProcessSteps([]);
    setError(null);
  };

  return (
    <div className="bridge-flow">
      {/* Screen 1: Generate BTC */}
      {step === 1 && (
        <div className="flow-screen generate-screen">
          <div className="screen-content">
            <h1 className="screen-title">Generate Bitcoin Wallet</h1>
            <p className="screen-subtitle">Create a testnet wallet to bridge BTC</p>
            
            {!btcWallet && !generating && (
              <button 
                className="primary-btn generate-btn"
                onClick={handleGenerateBTC}
              >
                Generate BTC Wallet
              </button>
            )}
            
            {generating && (
              <div className="loading-container">
                <div className="loading-roller"></div>
                <p className="loading-text">Generating secure wallet...</p>
              </div>
            )}
            
            {error && (
              <div className="error-message">
                {error}
                <button onClick={() => setError(null)}>Dismiss</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Screen 2: Input Form */}
      {step === 2 && (
        <div className="flow-screen input-screen">
          <div className="screen-content">
            <h1 className="screen-title">Bridge Configuration</h1>
            <p className="screen-subtitle">Enter the amount and transaction details</p>
            
            {btcWallet && (
              <div className="wallet-info-card">
                <div className="wallet-info-header">
                  <span className="wallet-label">BTC Address:</span>
                  <button 
                    className="copy-btn"
                    onClick={() => navigator.clipboard.writeText(btcWallet.address)}
                  >
                    Copy
                  </button>
                </div>
                <code className="wallet-address">{btcWallet.address}</code>
              </div>
            )}
            
            <div className="input-group">
              <label htmlFor="btcAmount">BTC Amount</label>
              <input
                id="btcAmount"
                type="number"
                step="0.00000001"
                min="0"
                value={btcAmount}
                onChange={(e) => setBtcAmount(e.target.value)}
                placeholder="0.00"
                className="amount-input"
              />
            </div>
            
            <div className="input-group">
              <label htmlFor="btcTxHash">Bitcoin Transaction Hash</label>
              <input
                id="btcTxHash"
                type="text"
                value={btcTxHash}
                onChange={(e) => setBtcTxHash(e.target.value)}
                placeholder="Enter BTC transaction hash..."
                className="tx-input"
              />
            </div>
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            <div className="form-actions">
              <button 
                className="secondary-btn"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button 
                className="primary-btn"
                onClick={handleSubmitAmount}
                disabled={!btcAmount || !btcTxHash || !connected}
              >
                Start Bridge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen 3: Process Modal */}
      {step === 3 && (
        <div className="process-modal-overlay">
          <div className="process-modal">
            <div className="process-header">
              <h2>Bridge in Progress</h2>
              <button className="close-btn" onClick={resetFlow}>×</button>
            </div>
            
            <div className="process-content">
              <div className="process-steps">
                {processSteps.map((step) => (
                  <div 
                    key={step.id} 
                    className={`process-step ${step.status}`}
                  >
                    <div className="step-indicator">
                      {step.status === 'completed' && <span className="check">✓</span>}
                      {step.status === 'active' && <div className="spinner"></div>}
                      {step.status === 'pending' && <span className="number">{step.id}</span>}
                      {step.status === 'error' && <span className="error">✕</span>}
                    </div>
                    <div className="step-content">
                      <div className="step-name">{step.name}</div>
                      {step.time && <div className="step-time">{step.time}</div>}
                    </div>
                  </div>
                ))}
              </div>
              
              {error && (
                <div className="error-message">
                  {error}
                  <button onClick={resetFlow}>Start Over</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BridgeFlow;

