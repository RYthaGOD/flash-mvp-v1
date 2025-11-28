import React from 'react';
import SimpleDemo from './SimpleDemo';
import './TabbedInterface.css';

function TabbedInterface() {
  return (
    <div className="tabbed-interface">
      {/* Simple Bridge Interface */}
      <SimpleDemo />

      <div className="warning-box">
        ⚠️ <strong>MVP Demo Only</strong> — Not production-ready. No audit. Do not use with real funds.
      </div>
    </div>
  );
}

export default TabbedInterface;

