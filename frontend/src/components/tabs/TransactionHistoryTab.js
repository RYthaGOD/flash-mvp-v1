import React, { useState, useEffect, useCallback } from 'react';
import './TabStyles.css';

function TransactionHistoryTab({ publicKey, connected, connection }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTransactions = useCallback(async () => {
    if (!connection || !publicKey) return;

    setLoading(true);
    setError(null);

    try {
      // Get signatures for the user's address
      const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 20 });
      
      // Get transaction details
      const txDetails = await Promise.all(
        signatures.slice(0, 10).map(async (sig) => {
          try {
            const tx = await connection.getTransaction(sig.signature, {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 0,
            });
            
            return {
              signature: sig.signature,
              blockTime: sig.blockTime,
              slot: sig.slot,
              err: sig.err,
              memo: tx?.meta?.logMessages?.find(msg => msg.includes('mint') || msg.includes('burn')) || null,
            };
          } catch (err) {
            return {
              signature: sig.signature,
              blockTime: sig.blockTime,
              slot: sig.slot,
              err: sig.err,
              error: err.message,
            };
          }
        })
      );

      setTransactions(txDetails);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchTransactions();
    }
  }, [connected, publicKey, fetchTransactions]);

  return (
    <div className="tab-content-wrapper">
      <h2>Transaction History</h2>
      <p className="tab-description">
        View your recent Solana transactions related to the bridge.
      </p>

      {loading && (
        <div className="message info-message">
          <p>Loading transactions...</p>
        </div>
      )}

      {error && (
        <div className="message error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!connected && (
        <div className="message info-message">
          <p>Connect your wallet to view transaction history</p>
        </div>
      )}

      {connected && transactions.length === 0 && !loading && (
        <div className="message info-message">
          <p>No transactions found</p>
        </div>
      )}

      {connected && transactions.length > 0 && (
        <div className="transactions-list">
          {transactions.map((tx, index) => (
            <div key={index} className={`transaction-item ${tx.err ? 'transaction-error' : ''}`}>
              <div className="transaction-header">
                <span className="transaction-signature">
                  <a 
                    href={`https://solscan.io/tx/${tx.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tx.signature.substring(0, 16)}...
                  </a>
                </span>
                <span className={`transaction-status ${tx.err ? 'status-error' : 'status-success'}`}>
                  {tx.err ? 'Failed' : 'Success'}
                </span>
              </div>
              <div className="transaction-details">
                <div className="transaction-detail">
                  <span className="detail-label">Time:</span>
                  <span className="detail-value">
                    {tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div className="transaction-detail">
                  <span className="detail-label">Slot:</span>
                  <span className="detail-value">{tx.slot || 'N/A'}</span>
                </div>
                {tx.memo && (
                  <div className="transaction-detail">
                    <span className="detail-label">Action:</span>
                    <span className="detail-value">{tx.memo}</span>
                  </div>
                )}
                {tx.err && (
                  <div className="transaction-detail">
                    <span className="detail-label">Error:</span>
                    <span className="detail-value error-text">{JSON.stringify(tx.err)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <button 
        className="secondary-button"
        onClick={fetchTransactions}
        disabled={loading || !connected}
      >
        Refresh
      </button>
    </div>
  );
}

export default TransactionHistoryTab;

