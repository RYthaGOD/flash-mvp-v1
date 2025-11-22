import React, { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import axios from 'axios';
import BridgeTab from './tabs/BridgeTab';
import ZcashTab from './tabs/ZcashTab';
import ArciumTab from './tabs/ArciumTab';
import TokenManagementTab from './tabs/TokenManagementTab';
import TransactionHistoryTab from './tabs/TransactionHistoryTab';
import './TabbedInterface.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const ZENZEC_MINT = process.env.REACT_APP_ZENZEC_MINT || '';

function TabbedInterface() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [activeTab, setActiveTab] = useState('bridge');
  const [bridgeInfo, setBridgeInfo] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(null);
  const [solBalance, setSolBalance] = useState(null);

  const fetchBalances = React.useCallback(async () => {
    if (!connected || !publicKey || !ZENZEC_MINT) return;

    try {
      // Fetch SOL balance
      const solBalanceLamports = await connection.getBalance(publicKey);
      setSolBalance(solBalanceLamports / 1e9);

      // Fetch zenZEC token balance
      try {
        const mintPubkey = new PublicKey(ZENZEC_MINT);
        const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
        const tokenAccount = await getAccount(connection, ata);
        setTokenBalance(Number(tokenAccount.amount) / 1e8); // zenZEC uses 8 decimals
      } catch (err) {
        // Token account doesn't exist yet
        setTokenBalance(0);
      }
    } catch (err) {
      console.error('Error fetching balances:', err);
    }
  }, [connected, publicKey, connection]);

  useEffect(() => {
    fetchBridgeInfo();
    if (connected && publicKey) {
      fetchBalances();
      // Poll balances every 5 seconds
      const interval = setInterval(fetchBalances, 5000);
      return () => clearInterval(interval);
    }
  }, [connected, publicKey, fetchBalances]);

  const fetchBridgeInfo = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/bridge/info`);
      setBridgeInfo(response.data);
    } catch (err) {
      console.error('Error fetching bridge info:', err);
    }
  };


  const tabs = [
    { id: 'bridge', name: 'Bridge', icon: '🌉' },
    { id: 'zcash', name: 'Zcash', icon: '🛡️' },
    { id: 'arcium', name: 'Privacy', icon: '🔐' },
    { id: 'tokens', name: 'Tokens', icon: '🪙' },
    { id: 'history', name: 'History', icon: '📜' },
  ];

  return (
    <div className="tabbed-interface">
      <div className="interface-header">
        <div className="header-content">
          <h1 className="app-title">FLASH Bridge</h1>
          <p className="app-subtitle">BTC → ZEC (shielded) → Solana</p>
          
          {/* Bridge Status */}
          {bridgeInfo && (
            <div className="bridge-status-bar">
              <div className="status-item">
                <span className="status-label">Network:</span>
                <span className="status-value">{bridgeInfo.network || 'devnet'}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Status:</span>
                <span className={`status-value status-${bridgeInfo.status || 'active'}`}>
                  {bridgeInfo.status || 'active'}
                </span>
              </div>
            </div>
          )}

          {/* Wallet & Balances */}
          <div className="wallet-section">
            <WalletMultiButton />
            {connected && publicKey && (
              <div className="balance-display">
                <div className="balance-item">
                  <span className="balance-label">SOL:</span>
                  <span className="balance-value">{solBalance !== null ? solBalance.toFixed(4) : '...'}</span>
                </div>
                <div className="balance-item">
                  <span className="balance-label">zenZEC:</span>
                  <span className="balance-value">{tokenBalance !== null ? tokenBalance.toFixed(4) : '...'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-name">{tab.name}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'bridge' && (
          <BridgeTab
            publicKey={publicKey}
            connected={connected}
            bridgeInfo={bridgeInfo}
            onBridgeComplete={fetchBalances}
          />
        )}
        {activeTab === 'zcash' && (
          <ZcashTab
            publicKey={publicKey}
            connected={connected}
          />
        )}
        {activeTab === 'arcium' && (
          <ArciumTab
            publicKey={publicKey}
            connected={connected}
          />
        )}
        {activeTab === 'tokens' && (
          <TokenManagementTab
            publicKey={publicKey}
            connected={connected}
            connection={connection}
            tokenBalance={tokenBalance}
            solBalance={solBalance}
            onActionComplete={fetchBalances}
          />
        )}
        {activeTab === 'history' && (
          <TransactionHistoryTab
            publicKey={publicKey}
            connected={connected}
            connection={connection}
          />
        )}
      </div>

      <div className="warning-box">
        ⚠️ <strong>MVP Demo Only</strong> — Not production-ready. No audit. Do not use with real funds.
      </div>
    </div>
  );
}

export default TabbedInterface;

