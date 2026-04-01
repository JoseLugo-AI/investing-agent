import React from 'react';

interface Props {
  connected: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

export function StatusBar({ connected, lastUpdated, error }: Props): React.ReactElement {
  return (
    <div className="status-bar">
      <span className="paper-badge">PAPER TRADING</span>
      <span className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
        {connected ? 'Connected' : 'Disconnected'}
      </span>
      {error && <span className="status-error">{error}</span>}
      {lastUpdated && (
        <span className="last-updated">
          Updated: {lastUpdated.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
