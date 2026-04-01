import React from 'react';
import type { AgentActivity } from '../types';

interface Props {
  activities: AgentActivity[];
}

const TYPE_ICONS: Record<string, string> = {
  scan_start: '[SCAN]',
  scan_complete: '[DONE]',
  analysis: '[AI]',
  trade: '[TRADE]',
  hold: '[HOLD]',
  skip: '[SKIP]',
  error: '[ERR]',
  agent_start: '[START]',
  agent_stop: '[STOP]',
  rebalance: '[REBAL]',
};

const TYPE_COLORS: Record<string, string> = {
  trade: '#22c55e',
  error: '#ef4444',
  agent_start: '#4f8ff7',
  agent_stop: '#f59e0b',
  analysis: '#a78bfa',
  skip: '#6b7280',
};

const TIER_COLORS: Record<string, string> = {
  conservative: '#4f8ff7',
  moderate: '#f59e0b',
  aggressive: '#ef4444',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function AgentActivityFeed({ activities }: Props): React.ReactElement {
  if (activities.length === 0) {
    return (
      <div className="agent-activity-feed">
        <div className="empty-state">No agent activity yet. Start the agent to begin trading.</div>
      </div>
    );
  }

  return (
    <div className="agent-activity-feed">
      {activities.map(a => (
        <div key={a.id} className="agent-activity-item">
          <span className="agent-activity-time">{formatTime(a.created_at)}</span>
          <span className="agent-activity-type" style={{ color: TYPE_COLORS[a.type] || '#8b8fa3' }}>
            {TYPE_ICONS[a.type] || `[${a.type}]`}
          </span>
          {a.tier_id && (
            <span className="agent-activity-tier" style={{ color: TIER_COLORS[a.tier_id] }}>
              {a.tier_id.slice(0, 3).toUpperCase()}
            </span>
          )}
          {a.symbol && <span className="agent-activity-symbol">{a.symbol}</span>}
          <span className="agent-activity-summary">{a.summary}</span>
        </div>
      ))}
    </div>
  );
}
