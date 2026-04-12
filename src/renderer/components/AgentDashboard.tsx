import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import type { AgentStatus, AgentActivity, AgentTrade } from '../types';
import { AgentTierAllocation } from './AgentTierAllocation';
import { AgentActivityFeed } from './AgentActivityFeed';
import { AgentTradeLog } from './AgentTradeLog';
import { FearGreedIndicator } from './FearGreedIndicator';

const POLL_INTERVAL = 5000;

export function AgentDashboard(): React.ReactElement {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [trades, setTrades] = useState<AgentTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [s, a, t] = await Promise.all([
        api.getAgentStatus(),
        api.getAgentActivity(30),
        api.getAgentTrades(20),
      ]);
      setStatus(s);
      setActivities(a);
      setTrades(t);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agent data');
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleToggle = async () => {
    if (!status) return;
    setLoading(true);
    try {
      if (status.running) {
        await api.stopAgent();
      } else {
        await api.startAgent();
      }
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="agent-dashboard">
      {/* Header */}
      <div className="agent-header">
        <div className="agent-status-row">
          <span className={`agent-status-dot ${status?.running ? 'running' : 'stopped'}`} />
          <span className="agent-status-text">
            {status?.running ? 'Agent Running' : 'Agent Stopped'}
          </span>
          {status?.started_at && (
            <span className="agent-uptime">
              since {new Date(status.started_at).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="agent-header-stats">
          <span>{status?.total_trades ?? 0} trades</span>
          <span>{status?.total_analyses ?? 0} analyses</span>
        </div>
        <button
          className={`btn ${status?.running ? 'btn-danger' : 'btn-primary'}`}
          onClick={handleToggle}
          disabled={loading}
        >
          {loading ? '...' : status?.running ? 'Stop Agent' : 'Start Agent'}
        </button>
      </div>

      {error && <div className="agent-error">{error}</div>}

      {/* Fear & Greed Index (crypto strategy signal) */}
      <FearGreedIndicator />

      {/* Tier Allocations */}
      <div className="dashboard-panel">
        <h2>Tier Allocations</h2>
        {status?.tiers && <AgentTierAllocation tiers={status.tiers} />}
      </div>

      {/* Two-column layout */}
      <div className="agent-grid">
        {/* Activity Feed */}
        <div className="dashboard-panel">
          <h2>Activity Feed</h2>
          <AgentActivityFeed activities={activities} />
        </div>

        {/* Trade Log */}
        <div className="dashboard-panel">
          <h2>Trade Log</h2>
          <AgentTradeLog trades={trades} />
        </div>
      </div>

      {/* Next Scans */}
      {status?.running && status.next_scans?.length > 0 && (
        <div className="agent-next-scans">
          {status.next_scans.map(s => (
            <span key={s.tier_id} className="agent-next-scan">
              {s.tier_id}: next scan {new Date(s.at).toLocaleTimeString()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
