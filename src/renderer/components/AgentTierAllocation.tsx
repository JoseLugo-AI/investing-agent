import React from 'react';
import type { TierAllocation } from '../types';

interface Props {
  tiers: TierAllocation[];
}

const TIER_COLORS: Record<string, string> = {
  conservative: '#4f8ff7',
  moderate: '#f59e0b',
  aggressive: '#ef4444',
};

export function AgentTierAllocation({ tiers }: Props): React.ReactElement {
  return (
    <div className="agent-tiers">
      {tiers.map(tier => {
        const pct = tier.target_value > 0 ? (tier.current_value / tier.target_value) * 100 : 0;
        const color = TIER_COLORS[tier.id] || '#888';

        return (
          <div key={tier.id} className="agent-tier-card">
            <div className="agent-tier-header">
              <span className="agent-tier-badge" style={{ borderColor: color, color }}>{tier.label}</span>
              <span className="agent-tier-target">{(tier.target_pct * 100).toFixed(0)}% target</span>
            </div>
            <div className="agent-tier-bar-bg">
              <div
                className="agent-tier-bar-fill"
                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
              />
            </div>
            <div className="agent-tier-stats">
              <span>${tier.current_value.toLocaleString(undefined, { maximumFractionDigits: 0 })} / ${tier.target_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span>{tier.position_count} positions</span>
              <span className="agent-tier-available">${tier.available.toLocaleString(undefined, { maximumFractionDigits: 0 })} available</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
