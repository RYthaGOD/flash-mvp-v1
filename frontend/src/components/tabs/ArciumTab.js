import React, { useEffect, useState } from 'react';
import apiClient from '../../services/apiClient';
import './TabStyles.css';

function ArciumTab() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    apiClient.getArciumStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  return (
    <div className="tab-content-wrapper">
      <h2>Arcium MPC</h2>
      <p className="tab-description">
        FLASH Bridge still ships with the Arcium MXE artifacts so we can run private computations (amount
        encryption, proof generation, BTC address escrow). The current BTC → SOL flow does not require any of those
        MPC calls, but they remain available for future upgrades.
      </p>

      <div className="info-card">
        <h3>Runtime status</h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Enabled:</span>
            <span className="info-value">
              {status?.enabled ? '✅ yes' : '⚠️ simulated'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Mode:</span>
            <span className="info-value">
              {status?.simulated ? 'Simulated Node' : 'Real MPC Cluster'}
            </span>
          </div>
        </div>
        <p className="helper-text">
          Toggle `ARCIUM_SIMULATED` / `ARCIUM_USE_REAL_SDK` in the backend `.env` when you are ready to run the
          secure node again.
        </p>
      </div>

      <div className="action-card">
        <h3>Planned MPC hooks</h3>
        <ul className="feature-list">
          <li>• Encrypt BTC addresses for private withdrawals</li>
          <li>• Verify deposits without revealing the amount to operators</li>
          <li>• Generate auditable proofs for institutional users</li>
        </ul>
        <p className="helper-text">
          These flows are disabled while the product focuses on deterministic SOL payouts. We will re-enable them
          once BTC redemptions return.
        </p>
      </div>
    </div>
  );
}

export default ArciumTab;

