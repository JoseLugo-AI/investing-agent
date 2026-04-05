import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api } from '../api';
import { PORTFOLIO_PERIODS } from '@shared/constants';
import type { PortfolioHistory } from '../types';

interface ChartPoint { date: string; equity: number; pl: number; ts: number; }

function formatTimestamp(ts: number, period: string): string {
  const d = new Date(ts * 1000);
  if (period === '1D') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (period === '1W') {
    return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString();
}

function toChartData(history: PortfolioHistory, period: string): ChartPoint[] {
  return history.timestamp.map((ts, i) => ({
    date: formatTimestamp(ts, period),
    equity: history.equity[i],
    pl: history.profit_loss[i],
    ts,
  }));
}

function formatDollar(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompact(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}k`;
  }
  return `$${value.toFixed(0)}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const equity = payload[0]?.value ?? 0;
  const point = payload[0]?.payload as ChartPoint | undefined;
  const pl = point?.pl ?? 0;
  const isPositive = pl >= 0;

  return (
    <div className="portfolio-tooltip">
      <div className="portfolio-tooltip-date">{label}</div>
      <div className="portfolio-tooltip-equity">{formatDollar(equity)}</div>
      <div className={`portfolio-tooltip-pl ${isPositive ? 'positive' : 'negative'}`}>
        {isPositive ? '+' : ''}{formatDollar(pl)} P&L
      </div>
    </div>
  );
}

const TIMEFRAME_MAP: Record<string, string> = {
  '1D': '5Min', '1W': '15Min', '1M': '1D', '3M': '1D', '1Y': '1D',
};

export function PortfolioChart(): React.ReactElement {
  const [period, setPeriod] = useState('1M');
  const [data, setData] = useState<ChartPoint[]>([]);

  useEffect(() => {
    api.getPortfolioHistory(period, TIMEFRAME_MAP[period])
      .then((h) => setData(toChartData(h, period)))
      .catch(() => setData([]));
  }, [period]);

  const isPositive = data.length > 0 && data[data.length - 1].pl >= 0;
  const lineColor = isPositive ? '#10b981' : '#ef4444';
  const gradientId = 'portfolioGradient';

  return (
    <div className="portfolio-chart">
      <div className="portfolio-chart-header">
        <h2>Portfolio</h2>
        <div className="period-selector">
          {PORTFOLIO_PERIODS.map((p) => (
            <button key={p} className={period === p ? 'active' : ''} onClick={() => setPeriod(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatCompact}
            domain={['auto', 'auto']}
            width={55}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke={lineColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: lineColor, stroke: '#0a0d14', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
