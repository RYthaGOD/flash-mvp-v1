import React from 'react';
import './TabStyles.css';

function ZcashTab() {
  return (
    <div className="tab-content-wrapper">
      <h2>Zcash (Legacy)</h2>
      <p className="tab-description">
        The original FLASH Bridge prototype routed BTC deposits through shielded Zcash pools and minted a
        placeholder token called zenZEC. That entire flow has been decommissioned. This page now serves as a
        reminder that only the BTC → SOL treasury workflow is available in the current build.
      </p>

      <div className="info-card">
        <h3>Current Status</h3>
        <ul className="feature-list">
          <li>• Zcash wallet daemons are turned off</li>
          <li>• `/api/zcash/*` endpoints return 404/disabled responses</li>
          <li>• All payouts settle directly in SOL from the treasury</li>
        </ul>
      </div>

      <div className="action-card">
        <h3>What to do instead</h3>
        <p className="helper-text">
          Monitor BTC deposits via the Bridge tab or CLI scripts, then trigger SOL payouts with `/api/bridge`.
          When Zcash support is reintroduced, this tab will be replaced with the new controls.
        </p>
      </div>
    </div>
  );
}

export default ZcashTab;

