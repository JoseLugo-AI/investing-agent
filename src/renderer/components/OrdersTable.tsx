import React from 'react';
import type { Order } from '../types';

interface Props {
  orders: Order[];
}

export function OrdersTable({ orders }: Props): React.ReactElement {
  if (orders.length === 0) {
    return <div className="empty-state">No recent orders</div>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Side</th>
          <th>Qty</th>
          <th>Type</th>
          <th>Status</th>
          <th>Fill Price</th>
          <th>Submitted</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id}>
            <td className="symbol">{o.symbol}</td>
            <td className={o.side === 'buy' ? 'positive' : 'negative'}>{o.side}</td>
            <td>{o.qty}</td>
            <td>{o.type}</td>
            <td>{o.status}</td>
            <td>{o.filled_avg_price ? `$${parseFloat(o.filled_avg_price).toFixed(2)}` : '—'}</td>
            <td>{new Date(o.submitted_at).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
