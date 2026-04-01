import React, { useEffect, useState } from 'react';
import { api } from '../api';
import type { RiskStatus } from '../types';

function statusColor(level: string): string {
  switch (level) {
    case 'ok': return '#4caf50';
    case 'warning': return '#ff9800';
    case 'halt': return '#f44336';
    case 'kill': return '#b71c1c';
    default: return '#888';
  }
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function RiskPanel(): React.ReactElement {
  const [status, setStatus] = useState<RiskStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const s = await api.getRiskStatus();
        if (mounted) { setStatus(s); setError(null); }
      } catch (err) {
        if (mounted) setError('Unable to load risk status');
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return (
    <div className="risk-panel">
      <h3>Risk Monitor</h3>
      {error && <div className="risk-error">{error}</div>}
      {status && (
        <div className="risk-metrics">
          <div className="risk-metric">
            <span className="risk-label">Daily Loss</span>
            <span className="risk-value" style={{ color: status.dailyLossHalted ? '#f44336' : '#4caf50' }}>
              {formatPct(status.dailyLossPercent)}
            </span>
            {status.dailyLossHalted && <span className="risk-badge danger">HALTED</span>}
          </div>

          <div className="risk-metric">
            <span className="risk-label">Drawdown</span>
            <span className="risk-value" style={{ color: statusColor(status.drawdownLevel) }}>
              {formatPct(status.drawdownPercent)}
            </span>
            {status.drawdownLevel === 'kill' && <span className="risk-badge danger">KILL SWITCH</span>}
            {status.drawdownLevel === 'halt' && <span className="risk-badge warning">PAUSED</span>}
          </div>

          <div className="risk-metric">
            <span className="risk-label">Largest Position</span>
            <span className="risk-value">
              {formatPct(status.largestPositionPercent)}
            </span>
          </div>

          <div className="risk-metric">
            <span className="risk-label">Positions</span>
            <span className="risk-value">{status.positionCount}</span>
          </div>
        </div>
      )}
    </div>
  );
}
