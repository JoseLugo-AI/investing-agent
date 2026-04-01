import React from 'react';
import type { Position } from '../types';

interface Props {
  positions: Position[];
  onSelectSymbol: (symbol: string) => void;
}

export function PositionsTable({ positions, onSelectSymbol }: Props): React.ReactElement {
  if (positions.length === 0) {
    return <div className="empty-state">No open positions</div>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Qty</th>
          <th>Avg Entry</th>
          <th>Current</th>
          <th>Market Value</th>
          <th>P&L</th>
          <th>P&L %</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => {
          const pl = parseFloat(p.unrealized_pl);
          const plPct = (parseFloat(p.unrealized_plpc) * 100).toFixed(2);
          return (
            <tr key={p.symbol} onClick={() => onSelectSymbol(p.symbol)} className="clickable-row">
              <td className="symbol">{p.symbol}</td>
              <td>{p.qty}</td>
              <td>${parseFloat(p.avg_entry_price).toFixed(2)}</td>
              <td>${parseFloat(p.current_price).toFixed(2)}</td>
              <td>${parseFloat(p.market_value).toFixed(2)}</td>
              <td className={pl >= 0 ? 'positive' : 'negative'}>
                ${Math.abs(pl).toFixed(2)}
              </td>
              <td className={pl >= 0 ? 'positive' : 'negative'}>{plPct}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
