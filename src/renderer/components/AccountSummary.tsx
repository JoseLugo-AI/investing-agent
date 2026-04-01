import React from 'react';
import type { Account } from '../types';

function formatUsd(value: string | number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(typeof value === 'string' ? parseFloat(value) : value);
}

interface Props {
  account: Account | null;
}

export function AccountSummary({ account }: Props): React.ReactElement {
  if (!account) return <div className="account-summary">Loading...</div>;

  const portfolioValue = parseFloat(account.portfolio_value);
  const lastEquity = parseFloat(account.last_equity);
  const dailyChange = portfolioValue - lastEquity;
  const dailyChangePct = lastEquity > 0 ? (dailyChange / lastEquity) * 100 : 0;
  const isPositive = dailyChange >= 0;

  return (
    <div className="account-summary">
      <div className="stat-card">
        <span className="stat-label">Portfolio Value</span>
        <span className="stat-value">{formatUsd(account.portfolio_value)}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Daily P&L</span>
        <span className={`stat-value ${isPositive ? 'positive' : 'negative'}`}>
          <span>{isPositive ? '+' : ''}{formatUsd(dailyChange)}</span>
          <span> ({dailyChangePct.toFixed(2)}%)</span>
        </span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Buying Power</span>
        <span className="stat-value">{formatUsd(account.buying_power)}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Cash</span>
        <span className="stat-value">{formatUsd(account.cash)}</span>
      </div>
    </div>
  );
}
