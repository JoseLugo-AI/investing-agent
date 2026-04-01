import React, { useState } from 'react';
import type { AgentTrade } from '../types';

interface Props {
  trades: AgentTrade[];
}

const ACTION_COLORS: Record<string, string> = {
  buy: '#22c55e',
  sell: '#ef4444',
  hold: '#f59e0b',
  skip: '#6b7280',
};

const TIER_COLORS: Record<string, string> = {
  conservative: '#4f8ff7',
  moderate: '#f59e0b',
  aggressive: '#ef4444',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function AgentTradeLog({ trades }: Props): React.ReactElement {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (trades.length === 0) {
    return (
      <div className="agent-trade-log">
        <div className="empty-state">No trade decisions yet.</div>
      </div>
    );
  }

  return (
    <div className="agent-trade-log">
      <table className="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Tier</th>
            <th>Symbol</th>
            <th>Action</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {trades.map(t => (
            <React.Fragment key={t.id}>
              <tr
                className="clickable-row"
                onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
              >
                <td>{formatTime(t.created_at)}</td>
                <td>
                  <span style={{ color: TIER_COLORS[t.tier_id] }}>
                    {t.tier_id.slice(0, 3).toUpperCase()}
                  </span>
                </td>
                <td className="symbol">{t.symbol}</td>
                <td>
                  <span style={{ color: ACTION_COLORS[t.action], fontWeight: 600 }}>
                    {t.action.toUpperCase()}
                  </span>
                </td>
                <td>{t.qty ?? '—'}</td>
                <td>{t.price ? `$${t.price.toFixed(2)}` : '—'}</td>
                <td>
                  <span style={{
                    color: t.analysis_confidence === 'high' ? '#22c55e' :
                      t.analysis_confidence === 'medium' ? '#f59e0b' : '#ef4444'
                  }}>
                    {t.analysis_confidence?.toUpperCase() ?? '—'}
                  </span>
                </td>
              </tr>
              {expandedId === t.id && (
                <tr className="agent-trade-expanded">
                  <td colSpan={7}>
                    <div className="agent-trade-reasoning">
                      <strong>Reasoning:</strong> {t.analysis_reasoning || t.reason}
                      {t.analysis_risks?.length > 0 && (
                        <div className="agent-trade-risks">
                          <strong>Risks:</strong> {t.analysis_risks.join(', ')}
                        </div>
                      )}
                      {t.order_id && (
                        <div className="agent-trade-order-id">
                          <strong>Order:</strong> {t.order_id}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
