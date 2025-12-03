import React from 'react';
import './TabStyles.css';

function TokenManagementTab({ solBalance }) {
  return (
    <div className="tab-content-wrapper">
      <h2>Treasury Overview</h2>
      <p className="tab-description">
        Every bridge payout is settled in SOL from the FLASH treasury. The legacy zenZEC minting and burn flows
        have been retired, so there is nothing for you to manage or burn in this tab.
      </p>

      <div className="info-card">
        <h3>Your Wallet Snapshot</h3>
        <div className="balance-grid">
          <div className="balance-item-large">
            <span className="balance-label">SOL Balance:</span>
            <span className="balance-value-large">
              {solBalance !== null ? solBalance.toFixed(4) : '—'}
            </span>
          </div>
        </div>
        <p className="helper-text">
          To receive more SOL, bridge a BTC deposit from the Bridge tab or re-run the automated workflow script.
        </p>
      </div>

      <div className="action-card">
        <h3>What happened to zenZEC?</h3>
        <p className="helper-text">
          Earlier prototypes minted a placeholder token called <strong>zenZEC</strong>. The current system pays out
          native SOL directly, which simplifies treasury management and matches the demo environment. There is no
          token to burn, swap, or redeem in this version of FLASH Bridge.
        </p>
        <ul className="feature-list">
          <li>✓ Monitor BTC deposits via <code>/api/bridge/check-btc-deposits</code></li>
          <li>✓ Claim deposits via <code>/api/bridge</code> (or the UI Bridge tab)</li>
          <li>✓ Download proofs for audits from the Proof endpoints</li>
        </ul>
      </div>

      <div className="message info-message">
        <p>
          Looking for withdrawals or burn flows? Those APIs have been removed. Once BTC redemption is reintroduced,
          this tab will host the new controls.
        </p>
      </div>
    </div>
  );
}

export default TokenManagementTab;

