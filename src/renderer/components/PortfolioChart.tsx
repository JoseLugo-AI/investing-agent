import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api } from '../api';
import { PORTFOLIO_PERIODS } from '@shared/constants';
import type { PortfolioHistory } from '../types';

interface ChartPoint { date: string; equity: number; pl: number; }

function toChartData(history: PortfolioHistory): ChartPoint[] {
  return history.timestamp.map((ts, i) => ({
    date: new Date(ts * 1000).toLocaleDateString(),
    equity: history.equity[i],
    pl: history.profit_loss[i],
  }));
}

const TIMEFRAME_MAP: Record<string, string> = {
  '1D': '5Min', '1W': '15Min', '1M': '1D', '3M': '1D', '1Y': '1D',
};

export function PortfolioChart(): React.ReactElement {
  const [period, setPeriod] = useState('1M');
  const [data, setData] = useState<ChartPoint[]>([]);

  useEffect(() => {
    api.getPortfolioHistory(period, TIMEFRAME_MAP[period])
      .then((h) => setData(toChartData(h)))
      .catch(() => setData([]));
  }, [period]);

  const isPositive = data.length > 0 && data[data.length - 1].pl >= 0;

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
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
          <XAxis dataKey="date" tick={{ fill: '#8b8fa3', fontSize: 10 }} />
          <YAxis tick={{ fill: '#8b8fa3', fontSize: 10 }} domain={['auto', 'auto']} />
          <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', color: '#e1e4ea' }} />
          <Line type="monotone" dataKey="equity" stroke={isPositive ? '#22c55e' : '#ef4444'} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
