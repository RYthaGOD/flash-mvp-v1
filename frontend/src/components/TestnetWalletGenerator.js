import React, { useState, useEffect } from 'react';
import { default as WalletGenerator } from '../utils/wallet-generator/index.js';
import WalletStorage from '../utils/wallet-storage.js';

const TestnetWalletGenerator = ({ onWalletsGenerated, onClose }) => {
  const [wallets, setWallets] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPrivateKeys, setShowPrivateKeys] = useState({});
  const [showImport, setShowImport] = useState(false);
  const [importWIF, setImportWIF] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  const generator = new WalletGenerator();

  // Load wallets from localStorage on mount
  useEffect(() => {
    const loadStoredWallets = () => {
      const storedWallets = WalletStorage.loadWallets();
      if (storedWallets && storedWallets.bitcoin) {
        // Reconstruct wallet object from stored data
        const restoredWallets = {
          bitcoin: storedWallets.bitcoin
        };
        setWallets(restoredWallets);
        
        // Notify parent if callback exists
        if (onWalletsGenerated) {
          onWalletsGenerated(restoredWallets);
        }
      }
    };

    loadStoredWallets();
  }, [onWalletsGenerated]);

  const handleGenerateWallets = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await generator.generateAllWallets();

      if (result.success) {
        // Add timestamp
        const walletsWithTimestamp = {
          ...result.wallets,
          bitcoin: {
            ...result.wallets.bitcoin,
            createdAt: new Date().toISOString()
          }
        };
        
        setWallets(walletsWithTimestamp);

        // Save to localStorage
        WalletStorage.saveWallets(walletsWithTimestamp);

        // Notify parent component
        if (onWalletsGenerated) {
          onWalletsGenerated(walletsWithTimestamp);
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportWallet = async (e) => {
    e.preventDefault();
    setImportLoading(true);
    setError(null);

    try {
      if (!importWIF.trim()) {
        setError('Please enter a WIF private key');
        setImportLoading(false);
        return;
      }

      const result = generator.importWallet('bitcoin', importWIF.trim());

      if (result.success) {
        const walletsWithTimestamp = {
          bitcoin: {
            ...result.wallet,
            createdAt: new Date().toISOString()
          }
        };
        
        setWallets(walletsWithTimestamp);
        
        // Save to localStorage
        WalletStorage.saveWallets(walletsWithTimestamp);

        // Notify parent component
        if (onWalletsGenerated) {
          onWalletsGenerated(walletsWithTimestamp);
        }

        // Reset import form
        setImportWIF('');
        setShowImport(false);
      } else {
        setError(result.error || 'Invalid private key format');
      }
    } catch (err) {
      setError(err.message || 'Failed to import wallet');
    } finally {
      setImportLoading(false);
    }
  };

  const togglePrivateKey = (chain) => {
    setShowPrivateKeys(prev => ({
      ...prev,
      [chain]: !prev[chain]
    }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  const downloadPrivateKey = (chain) => {
    const wallet = wallets?.[chain];
    if (!wallet?.wif) return;

    const blob = new Blob([wallet.wif], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `flash-${chain}-testnet-private-key.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getExplorerUrl = (wallet) => {
    if (wallet.type === 'bitcoin') {
      return `https://mempool.space/testnet/address/${wallet.address}`;
    }
    return '#';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wallet-generator-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>₿ Generate Bitcoin Testnet Wallet</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {!wallets && !loading && !showImport && (
            <div className="generator-intro">
              <p>
                Generate a Bitcoin testnet wallet to demonstrate the FLASH Bridge BTC → zenZEC flow
                with real testnet transactions.
              </p>

              <div className="security-notice">
                <h4>🔒 Security Notice</h4>
                <ul>
                  <li>Private keys are generated client-side only</li>
                  <li>Never share your private keys with anyone</li>
                  <li>This is a testnet wallet - funds have no real value</li>
                  <li>Back up your private key securely</li>
                  <li>Wallets are saved in your browser's localStorage</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  className="primary-button generate-button"
                  onClick={handleGenerateWallets}
                  disabled={loading}
                >
                  🎯 Generate New Wallet
                </button>
                <button
                  className="secondary-button"
                  onClick={() => setShowImport(true)}
                  disabled={loading}
                >
                  📥 Import Existing Wallet
                </button>
              </div>
            </div>
          )}

          {!wallets && !loading && showImport && (
            <div className="import-wallet-form">
              <h3>Import Bitcoin Testnet Wallet</h3>
              <p>Enter your WIF (Wallet Import Format) private key to restore an existing wallet.</p>
              
              <form onSubmit={handleImportWallet}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="importWIF">Private Key (WIF Format):</label>
                  <input
                    id="importWIF"
                    type="password"
                    value={importWIF}
                    onChange={(e) => setImportWIF(e.target.value)}
                    placeholder="Enter WIF private key (starts with c, L, K, or 5)"
                    disabled={importLoading}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem' }}
                  />
                  <p className="helper-text" style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                    Your wallet will be restored and saved to localStorage
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setShowImport(false);
                      setImportWIF('');
                      setError(null);
                    }}
                    disabled={importLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={importLoading || !importWIF.trim()}
                  >
                    {importLoading ? 'Importing...' : 'Import Wallet'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Generating secure testnet wallets...</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <h4>❌ Generation Failed</h4>
              <p>{error}</p>
              <button onClick={() => setError(null)}>Try Again</button>
            </div>
          )}

          {wallets && (
            <div className="wallets-display">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3>✅ Bitcoin Testnet Wallet {wallets.bitcoin.createdAt ? '(Restored)' : '(New)'}</h3>
                  <p>Use this address to test the FLASH Bridge BTC → zenZEC flow.</p>
                </div>
                {wallets.bitcoin.createdAt && (
                  <div style={{ fontSize: '0.85rem', color: '#666' }}>
                    Created: {new Date(wallets.bitcoin.createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Bitcoin Wallet */}
              <div className="wallet-card bitcoin-wallet">
                <div className="wallet-header">
                  <h4>₿ Bitcoin Testnet Wallet</h4>
                  <a
                    href={getExplorerUrl(wallets.bitcoin)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="explorer-link"
                  >
                    🔍 View on Mempool Explorer
                  </a>
                </div>

                <div className="wallet-address">
                  <label>Receiving Address:</label>
                  <div className="address-display">
                    <code>{wallets.bitcoin.address}</code>
                    <button onClick={() => copyToClipboard(wallets.bitcoin.address)}>
                      📋 Copy
                    </button>
                  </div>
                  <p className="address-note">Send testnet BTC to this address to test the bridge</p>
                </div>

                <div className="wallet-private-key">
                  <label>Private Key (WIF Format):</label>
                  {wallets.bitcoin?.wif ? (
                    <div className="key-display">
                      <input
                        type={showPrivateKeys.bitcoin ? "text" : "password"}
                        value={wallets.bitcoin.wif}
                        readOnly
                      />
                      <button onClick={() => togglePrivateKey('bitcoin')}>
                        {showPrivateKeys.bitcoin ? '🙈 Hide' : '👁️ Show'}
                      </button>
                      <button onClick={() => copyToClipboard(wallets.bitcoin.wif)}>
                        📋 Copy
                      </button>
                      <button onClick={() => downloadPrivateKey('bitcoin')}>
                        💾 Download
                      </button>
                    </div>
                  ) : (
                    <div className="key-display security-warning">
                      <div className="security-notice">
                        🔒 <strong>SECURITY NOTICE:</strong> Private keys are not persisted in browser storage.
                        <br />
                        Generate a new wallet or import an existing WIF to view the key.
                      </div>
                    </div>
                  )}
                  <p className="key-warning">
                    🚨 CRITICAL: Save your private key immediately - it will not be recoverable after refresh!
                  </p>
                </div>
              </div>

              <div className="demo-instructions">
                <h4>🚀 Test the Bridge</h4>
                <ol>
                  <li><strong>Get testnet BTC:</strong> Visit <a href="https://mempool.space/testnet/faucet" target="_blank" rel="noopener noreferrer">Mempool Faucet</a></li>
                  <li><strong>Send to address:</strong> Use the address above</li>
                  <li><strong>Wait for confirmations:</strong> ~10 minutes for 6+ confirmations</li>
                  <li><strong>Bridge to zenZEC:</strong> Come back here and paste the TX hash</li>
                  <li><strong>Watch it work:</strong> Real BTC → zenZEC transaction!</li>
                </ol>

                <div className="demo-note">
                  <p><strong>💡 This proves FLASH Bridge works with real blockchain transactions!</strong></p>
                  <p>All transactions are publicly verifiable on testnet explorers.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="secondary-button" onClick={onClose}>
            Close
          </button>
          {wallets && (
            <>
              <button 
                className="secondary-button" 
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this wallet from storage? You can always import it again using the private key.')) {
                    WalletStorage.clearWallets();
                    setWallets(null);
                  }
                }}
                style={{ backgroundColor: '#dc3545', color: 'white' }}
              >
                🗑️ Delete Wallet
              </button>
              <button className="primary-button" onClick={() => {
                setWallets(null);
                setShowImport(false);
                setError(null);
              }}>
                Generate New Wallet
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestnetWalletGenerator;
