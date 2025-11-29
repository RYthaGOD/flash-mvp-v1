import React, { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import BridgeFlow from './BridgeFlow';
import './TabbedInterface.css';

function TabbedInterface() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [solBalance, setSolBalance] = useState(null);

  const fetchBalances = React.useCallback(async () => {
    if (!connected || !publicKey) return;

    try {
      // Fetch SOL balance
      const solBalanceLamports = await connection.getBalance(publicKey);
      setSolBalance(solBalanceLamports / 1e9);
    } catch (err) {
      console.error('Error fetching balances:', err);
    }
  }, [connected, publicKey, connection]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchBalances();
      // Poll balances every 5 seconds
      const interval = setInterval(fetchBalances, 5000);
      return () => clearInterval(interval);
    }
  }, [connected, publicKey, fetchBalances]);


  // No tabs - simplified demo

  return (
    <div className="tabbed-interface">
      {/* Header Navigation */}
      <header className="app-header">
        <div className="header-container">
          <div className="logo">
            <span className="logo-text">Flash</span>
          </div>
          
          <nav className="header-nav">
            <button className="nav-link active">Bridge</button>
            <button className="nav-link">Portfolio</button>
            <button className="nav-link">History</button>
          </nav>
          
          <div className="header-actions">
            {connected && publicKey && (
              <div className="balance-info">
                <span className="balance-text">
                  {solBalance !== null ? `${solBalance.toFixed(4)} SOL` : '...'}
                </span>
              </div>
            )}
            <div className="wallet-button-wrapper">
              <WalletMultiButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <BridgeFlow />
      </main>
    </div>
  );
}

export default TabbedInterface;

