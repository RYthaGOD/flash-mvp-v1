import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useBitcoinWallet } from '../../contexts/BitcoinWalletContext';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../services/apiClient';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';
import './TabStyles.css';

const shortenAddress = (key) => {
  if (!key) return 'Wallet disconnected';
  const base58 = key.toBase58();
  return `${base58.slice(0, 4)}…${base58.slice(-4)}`;
};

const shortenBtcAddress = (address) => {
  if (!address) return 'Wallet disconnected';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
};

const FINAL_TRANSACTION_STATUSES = new Set(['confirmed', 'failed']);

const formatStatusLabel = (status) => {
  if (!status) return 'Unknown';
  const normalized = String(status).toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatStatusTimestamp = (timestamp) => {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function BridgeTab({ onBridgeComplete, onLightningTrigger }) {
  const { publicKey, connected } = useWallet();
  const { connected: btcConnected, address: btcAddress, sendBitcoin, loading: btcLoading } = useBitcoinWallet();
  const [bridgeInfo, setBridgeInfo] = useState(null);
  const [reserves, setReserves] = useState(null);
  const [bitcoinTxHash, setBitcoinTxHash] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(null);
  const copyTimeoutRef = useRef(null);
  const statusPollerRef = useRef(null);
  const [transactionStatus, setTransactionStatus] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [statusError, setStatusError] = useState(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const fetchBridgeData = useCallback(async () => {
    try {
      const [info, reservesData] = await Promise.all([
        apiClient.getBridgeInfo(),
        apiClient.getReserves(),
      ]);
      setBridgeInfo(info);
      setReserves(reservesData.reserves);
    } catch (err) {
      console.error('Failed to fetch bridge data:', err);
    }
  }, []);

  useEffect(() => {
    fetchBridgeData();
  }, [fetchBridgeData]);

  const stopStatusPolling = useCallback(() => {
    if (statusPollerRef.current) {
      clearInterval(statusPollerRef.current);
      statusPollerRef.current = null;
    }
  }, []);

  const pollTransactionStatus = useCallback(async (txId) => {
    if (!txId) {
      return;
    }

    try {
      const data = await apiClient.getBridgeTransaction(txId);
      if (data.transaction?.status) {
        setTransactionStatus(data.transaction.status);
      }
      setStatusHistory(Array.isArray(data.history) ? data.history : []);
      setStatusError(null);

      if (data.transaction?.status && FINAL_TRANSACTION_STATUSES.has(data.transaction.status)) {
        stopStatusPolling();
      }
    } catch (err) {
      const message = err?.response?.data?.error || err.message || 'Unable to fetch status';
      setStatusError(message);

      if (err?.response?.status === 404 || err?.response?.status === 503) {
        stopStatusPolling();
      }
    }
  }, [stopStatusPolling]);

  const startStatusPolling = useCallback((txId) => {
    if (!txId) {
      return;
    }

    stopStatusPolling();
    const runPoll = () => pollTransactionStatus(txId);
    runPoll();
    statusPollerRef.current = setInterval(runPoll, 5000);
  }, [pollTransactionStatus, stopStatusPolling]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      stopStatusPolling();
    };
  }, [stopStatusPolling]);

  const btcReserve = reserves?.btc?.reserveBTC ?? null;
  const zecReserve = reserves?.zec?.balanceZEC ?? null;

  const metrics = useMemo(() => ([
    {
      label: 'SOL Wallet',
      value: connected && publicKey ? shortenAddress(publicKey) : 'Connect wallet',
      caption: connected ? 'Ready to receive ZEC' : 'Required for payouts',
    },
    {
      label: 'BTC Wallet',
      value: btcConnected && btcAddress ? shortenBtcAddress(btcAddress) : 'Connect wallet',
      caption: btcConnected ? 'Ready to send BTC' : 'Required for deposits',
    },
    {
      label: 'Bridge Network',
      value: bridgeInfo?.network?.toUpperCase() || 'DEVNET',
      caption: 'BTC testnet → Solana',
    },
    {
      label: 'Privacy Mode',
      value: bridgeInfo?.privacy?.mode || 'Arcium MPC',
      caption: bridgeInfo?.privacy?.status || 'Encrypted flows enabled',
    },
  ]), [connected, publicKey, bridgeInfo, btcConnected, btcAddress]);

  const timeline = useMemo(() => {
    const hashReady = Boolean(bitcoinTxHash.trim());
    const amountReady = Boolean(sendAmount.trim()) && btcConnected;
    const submissionStarted = Boolean(result?.transactionId);
    const serverStatus = transactionStatus || result?.status || null;
    const latestHistoryEntry = statusHistory.length ? statusHistory[statusHistory.length - 1] : null;

    const submissionState = (() => {
      if (!connected || !btcConnected) return 'blocked';
      if (serverStatus === 'failed') return 'failed';
      if (serverStatus === 'confirmed') return 'done';
      if (serverStatus === 'processing' || serverStatus === 'pending') return 'active';
      if (loading || submissionStarted) return 'active';
      if (hashReady || amountReady) return 'waiting';
      return 'blocked';
    })();

    const mintState = (() => {
      if (serverStatus === 'failed') return 'failed';
      if (serverStatus === 'confirmed') return 'done';
      if (serverStatus === 'processing') return 'active';
      if (submissionStarted || loading) return 'waiting';
      return 'waiting';
    })();

    const submissionHelper = (() => {
      if (serverStatus === 'failed') return 'Review transaction details';
      if (serverStatus === 'confirmed') return 'Bridge confirmed on-chain';
      if (serverStatus === 'processing') return 'Treasury releasing funds';
      if (serverStatus === 'pending') return 'Awaiting relayer verification';
      if (latestHistoryEntry?.notes) return latestHistoryEntry.notes;
      if (loading) return 'Relayer verifying';
      if (submissionStarted) return 'Submitted to relayer';
      if (hashReady || amountReady) return 'Ready to submit';
      if (!btcConnected) return 'Connect BTC wallet';
      if (!connected) return 'Connect SOL wallet';
      return 'Provide the funded txid or enter amount';
    })();

    const mintHelper = (() => {
      if (serverStatus === 'failed') return 'Mint halted. Contact support.';
      if (serverStatus === 'confirmed') return 'native ZEC transferred';
      if (serverStatus === 'processing') return 'Awaiting final confirmation';
      if (submissionStarted || loading) return 'Auto after verification';
      return 'Auto after validation';
    })();

    return [
      {
        label: 'Connect SOL wallet',
        status: connected ? 'done' : 'active',
        helper: connected && publicKey ? shortenAddress(publicKey) : 'Connect to unlock payouts',
      },
      {
        label: 'Connect BTC wallet',
        status: btcConnected ? 'done' : 'active',
        helper: btcConnected && btcAddress ? shortenBtcAddress(btcAddress) : 'Connect to send BTC',
      },
      {
        label: btcConnected ? 'Send BTC or paste hash' : 'Paste BTC hash',
        status: (hashReady || amountReady) ? 'done' : (connected && btcConnected) ? 'waiting' : 'blocked',
        helper: hashReady ? 'TX hash detected' : amountReady ? 'Amount specified' : 'Provide the funded txid or enter amount',
      },
      {
        label: 'Submit bridge',
        status: submissionState,
        helper: submissionHelper,
      },
      {
        label: 'Mint native ZEC',
        status: mintState,
        helper: mintHelper,
      },
    ];
  }, [connected, publicKey, bitcoinTxHash, sendAmount, btcConnected, loading, result, statusHistory, transactionStatus]);

  const handleCopyBridgeAddress = () => {
    if (!bridgeInfo?.bitcoin?.bridgeAddress) return;
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : null;

    const showFeedback = (message) => {
      setCopyFeedback(message);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopyFeedback(null), 2200);
    };

    if (!clipboard?.writeText) {
      showFeedback('Copy not supported');
      return;
    }

    clipboard.writeText(bridgeInfo.bitcoin.bridgeAddress)
      .then(() => showFeedback('Bridge address copied'))
      .catch(() => showFeedback('Unable to copy'));
  };

  const handleDirectBridge = async (event) => {
    event.preventDefault();

    if (!connected || !publicKey) {
      setError('Please connect your Solana wallet first.');
      return;
    }

    if (!btcConnected || !btcAddress) {
      setError('Please connect your Bitcoin wallet first.');
      return;
    }

    if (!bridgeInfo?.bitcoin?.bridgeAddress) {
      setError('Bridge address not available.');
      return;
    }

    if (!sendAmount || parseFloat(sendAmount) <= 0) {
      setError('Please enter a valid BTC amount.');
      return;
    }

    const amount = parseFloat(sendAmount);
    console.log('Parsed amount:', amount, 'from sendAmount:', sendAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid positive BTC amount.');
      return;
    }
    if (amount < 0.00001) {
      setError('Minimum amount is 0.00001 BTC.');
      return;
    }

    stopStatusPolling();
    setTransactionStatus(null);
    setStatusHistory([]);
    setStatusError(null);
    setLoading(true);
    setError(null);
    setResult(null);

    let txHash = null;
    try {
      console.log('Starting one-click bridge with amount:', amount);
      console.log('Bridge address:', bridgeInfo.bitcoin.bridgeAddress);
      console.log('Wallet connected:', btcConnected);

      // Validate wallet is ready
      if (!btcConnected) {
        throw new Error('Please connect your Bitcoin wallet first');
      }
      if (!btcAddress) {
        throw new Error('Wallet address not available');
      }

      // Send BTC directly from wallet
      console.log('Calling sendBitcoin...');
      txHash = await sendBitcoin(bridgeInfo.bitcoin.bridgeAddress, amount);
      console.log('BTC transaction hash:', txHash);

      if (!txHash) {
        throw new Error('Wallet returned empty transaction hash');
      }

      setBitcoinTxHash(txHash);

      // Submit bridge transaction with the hash
      const payload = {
        solanaAddress: publicKey.toString(),
        bitcoinTxHash: txHash,
        amount: amount,
        useZecPrivacy: true,
      };
      console.log('Bridge payload:', payload);

      const response = await apiClient.bridgeTransaction(payload);
      console.log('Bridge response:', response);
      setResult(response);
      setTransactionStatus(response.status || null);

      if (response.transactionId) {
        setStatusHistory([{
          transaction_id: response.transactionId,
          transaction_type: 'bridge',
          status: response.status || 'pending',
          notes: response.message || null,
          created_at: new Date().toISOString(),
        }]);
        startStatusPolling(response.transactionId);
      }

      setSendAmount('');
      fetchBridgeData();
      onBridgeComplete?.();
    } catch (err) {
      console.error('Bridge transaction error:', err);
      console.error('Error response:', err.response?.data);
      const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Bridge transaction failed';
      setError(message);

      // If the transaction failed, still show what we have
      if (txHash) {
        setResult({
          transactionId: 'failed-' + Date.now(),
          amount: amount,
          status: 'failed',
          message: 'Transaction failed: ' + message,
          bitcoinTxHash: txHash
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBridge = async (event) => {
    event.preventDefault();

    if (!connected || !publicKey) {
      setError('Please connect your wallet first.');
      return;
    }

    if (!bitcoinTxHash.trim()) {
      setError('Please provide a Bitcoin transaction hash.');
      return;
    }

    stopStatusPolling();
    setTransactionStatus(null);
    setStatusHistory([]);
    setStatusError(null);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        solanaAddress: publicKey.toString(),
        bitcoinTxHash: bitcoinTxHash.trim(),
        useZecPrivacy: true,
      };

      const response = await apiClient.bridgeTransaction(payload);
      setResult(response);
      setTransactionStatus(response.status || null);
      if (response.transactionId) {
        setStatusHistory([{
          transaction_id: response.transactionId,
          transaction_type: 'bridge',
          status: response.status || 'pending',
          notes: response.message || null,
          created_at: new Date().toISOString(),
        }]);
        startStatusPolling(response.transactionId);
      }
      setBitcoinTxHash('');
      fetchBridgeData();
      onBridgeComplete?.();
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Bridge transaction failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-content-wrapper">
      <div className="section-header">
        <h2>Flash Bridge</h2>
        <p className="tab-description">
          Bridge Bitcoin deposits into native ZEC liquidity on Solana, protected by Arcium MPC privacy.
        </p>
      </div>

      {!connected && (
        <div className="message warning-message">
          <strong>Solana wallet not connected</strong>
          <p>Use the SOL wallet button at the top-right to authorize payouts.</p>
        </div>
      )}

      {!btcConnected && (
        <div className="message warning-message">
          <strong>Bitcoin wallet not connected</strong>
          <p>Use the BTC wallet button at the top-right to enable direct bridging.</p>
        </div>
      )}

      <div className="stats-grid">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            className="metric-card"
            initial={
              prefersReducedMotion
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: 12, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.4,
              ease: 'easeOut',
              delay: prefersReducedMotion ? 0 : index * 0.08,
            }}
            whileHover={
              prefersReducedMotion
                ? undefined
                : { scale: 1.03, boxShadow: '0 14px 30px rgba(0,0,0,0.45)' }
            }
          >
            <span className="label">{metric.label}</span>
            <span className="value">{metric.value}</span>
            <span className="caption">{metric.caption}</span>
          </motion.div>
        ))}
      </div>

      <div className="two-column">
        <motion.section
          className="glass-card"
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          whileHover={prefersReducedMotion ? undefined : { translateY: -4 }}
        >
          <div className="card-title">
            {btcConnected ? 'One-Click BTC Bridge' : 'Manual BTC Bridge'}
          </div>

          <p>
            {btcConnected
              ? 'Send BTC directly from your wallet and bridge to native ZEC automatically.'
              : 'Paste the transaction hash for your BTC transfer so the relayer can verify funds and release native ZEC to your wallet.'
            }
          </p>

          {bridgeInfo?.bitcoin?.bridgeAddress && (
            <div className="address-panel">
              <div className="label">Official bridge address ({bridgeInfo.bitcoin.network})</div>
              <code>{bridgeInfo.bitcoin.bridgeAddress}</code>
              <motion.button
                type="button"
                className="copy-button"
                onClick={handleCopyBridgeAddress}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
              >
                Copy address
              </motion.button>
              <AnimatePresence>
                {copyFeedback && (
                  <motion.span
                    className="copy-feedback-badge"
                    initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                  >
                    {copyFeedback}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          )}

          {btcConnected ? (
            // Direct bridging form
            <form onSubmit={handleDirectBridge} className="form-stack">
              <div className="input-group">
                <label htmlFor="sendAmount">BTC Amount to Send</label>
                <input
                  id="sendAmount"
                  type="number"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  placeholder="0.0001"
                  step="0.00000001"
                  min="0.00001"
                  disabled={loading || btcLoading}
                  required
                />
                <p className="helper-text">
                  Enter the amount of BTC to send to the bridge. Minimum: 0.00001 BTC. The transaction will be sent directly from your connected wallet.
                </p>
              </div>

              <motion.button
                type="submit"
                disabled={loading || btcLoading || !connected || !btcConnected || !sendAmount}
                className="primary-button"
                onClick={(e) => onLightningTrigger && onLightningTrigger(e)}
                whileHover={
                  loading || btcLoading || !connected || !btcConnected || !sendAmount || prefersReducedMotion
                    ? undefined
                    : { scale: 1.01 }
                }
                whileTap={
                  loading || btcLoading || !connected || !btcConnected || !sendAmount || prefersReducedMotion
                    ? undefined
                    : { scale: 0.97 }
                }
              >
                {loading || btcLoading ? 'Processing...' : '🚀 Bridge BTC → ZEC'}
              </motion.button>
            </form>
          ) : (
            // Manual bridging form (existing)
            <form onSubmit={handleBridge} className="form-stack">
              <div className="input-group">
                <label htmlFor="bitcoinTxHash">Bitcoin Transaction Hash</label>
                <input
                  id="bitcoinTxHash"
                  type="text"
                  value={bitcoinTxHash}
                  onChange={(e) => setBitcoinTxHash(e.target.value)}
                  placeholder="e.g. 3f05b1..."
                  disabled={loading}
                  required
                />
                <p className="helper-text">
                  Submit after your BTC transaction has at least one confirmation; the bridge will wait for the configured threshold before minting.
                </p>
              </div>

              <motion.button
                type="submit"
                disabled={loading || !connected || !bitcoinTxHash.trim()}
                className="primary-button"
                onClick={(e) => onLightningTrigger && onLightningTrigger(e)}
                whileHover={
                  loading || !connected || !bitcoinTxHash.trim() || prefersReducedMotion
                    ? undefined
                    : { scale: 1.01 }
                }
                whileTap={
                  loading || !connected || !bitcoinTxHash.trim() || prefersReducedMotion
                    ? undefined
                    : { scale: 0.97 }
                }
              >
                {loading ? 'Processing...' : 'Bridge BTC → ZEC'}
              </motion.button>
            </form>
          )}
          <div className="bridge-timeline">
            {timeline.map((step, index) => (
              <motion.div
                key={step.label}
                className={`timeline-step ${step.status}`}
                initial={
                  prefersReducedMotion
                    ? { opacity: 1, y: 0 }
                    : { opacity: 0, y: 12 }
                }
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: prefersReducedMotion ? 0 : index * 0.05 }}
              >
                <span className="timeline-label">{step.label}</span>
                <span className="timeline-helper">{step.helper}</span>
              </motion.div>
            ))}
          </div>

          {(result?.transactionId || transactionStatus || statusHistory.length > 0 || statusError) && (
            <div className="status-history-card">
              <div className="status-history-header">
                <span>Status feed</span>
                {(transactionStatus || result?.status) && (
                  <span className={`status-pill ${transactionStatus || result?.status}`}>
                    {formatStatusLabel(transactionStatus || result?.status)}
                  </span>
                )}
              </div>
              {statusError ? (
                <p className="status-history-error">{statusError}</p>
              ) : statusHistory.length > 0 ? (
                <ul className="status-history-list">
                  {statusHistory.map((entry, index) => (
                    <li key={`${entry.status}-${entry.created_at || index}`} className="status-history-item">
                      <span className="status-history-status">{formatStatusLabel(entry.status)}</span>
                      <span className="status-history-time">{formatStatusTimestamp(entry.created_at)}</span>
                      {entry.notes && <span className="status-history-notes">{entry.notes}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="status-history-empty">Awaiting bridge status...</p>
              )}
            </div>
          )}
        </motion.section>

        <motion.section
          className="glass-card compact"
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: prefersReducedMotion ? 0 : 0.05 }}
        >
          <div className="card-title">Reserve snapshot</div>
          <div className="balance-grid">
            <div className="balance-item-large">
              <span className="balance-label">BTC pool</span>
              <span className="balance-value-large">
                {btcReserve !== null ? `${btcReserve.toFixed(6)} BTC` : '—'}
              </span>
            </div>
            <div className="balance-item-large">
              <span className="balance-label">ZEC treasury</span>
              <span className="balance-value-large">
                {zecReserve !== null ? `${zecReserve.toFixed(6)} ZEC` : '—'}
              </span>
            </div>
          </div>
          <p className="helper-text">Reserves auto-refresh after each successful bridge or redemption.</p>
        </motion.section>
      </div>

      <motion.div
        className="glass-card accent"
        initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut', delay: prefersReducedMotion ? 0 : 0.08 }}
      >
        <div className="card-title">Redeem native ZEC back to BTC</div>
        <p>
          When you are ready to exit, transfer native ZEC to the treasury and the relayer will decrypt your BTC address via Arcium MPC.
        </p>
        <ol className="step-list">
          <li>Encrypt your BTC address inside the Arcium tab.</li>
          <li>Send native ZEC to the treasury account displayed above.</li>
          <li>Relayer verifies the transfer and releases BTC to your decrypted address.</li>
        </ol>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            className="message error-message"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <strong>Bridge error</strong>
            <p>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && (
          <motion.div
            className="message success-message"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.35 }}
          >
            <h3>Bridge transaction confirmed</h3>
            <div className="result-details">
              <div className="detail-row">
                <span className="detail-label">Transaction ID</span>
                <span className="detail-value">{result.transactionId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Amount</span>
                <span className="detail-value">{result.amount} ZEC</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Status</span>
                <span className={`detail-value status-${(transactionStatus || result.status || '').toLowerCase()}`}>
                  {formatStatusLabel(transactionStatus || result.status)}
                </span>
              </div>
              {result.solanaTxSignature && (
                <div className="detail-row">
                  <span className="detail-label">Solana TX</span>
                  <span className="detail-value">
                    <a
                      className="tx-link"
                      href={`https://solscan.io/tx/${result.solanaTxSignature}?cluster=${bridgeInfo?.network || 'devnet'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {result.solanaTxSignature.slice(0, 12)}…
                    </a>
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BridgeTab;

