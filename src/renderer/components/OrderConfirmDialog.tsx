import React from 'react';
import type { OrderRequest } from '../types';

interface Props {
  order: OrderRequest;
  lastPrice: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function OrderConfirmDialog({ order, lastPrice, onConfirm, onCancel }: Props): React.ReactElement {
  const estimatedCost = order.qty * (order.limit_price ?? lastPrice);
  const formatUsd = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <h3>Confirm Order</h3>
        <div className="dialog-summary">
          <span className={`order-action ${order.side}`}>
            {order.side.toUpperCase()} {order.qty} {order.symbol}
          </span>
        </div>
        <div className="dialog-details">
          <div className="dialog-row">
            <span>Type</span>
            <span>{order.type === 'market' ? 'Market Order' : 'Limit Order'}</span>
          </div>
          {order.type === 'limit' && order.limit_price && (
            <div className="dialog-row">
              <span>Limit Price</span>
              <span>{formatUsd(order.limit_price)}</span>
            </div>
          )}
          <div className="dialog-row">
            <span>Est. {order.side === 'buy' ? 'Cost' : 'Proceeds'}</span>
            <span>~{formatUsd(estimatedCost)}</span>
          </div>
          <div className="dialog-row">
            <span>Time in Force</span>
            <span>{order.time_in_force.toUpperCase()}</span>
          </div>
        </div>
        <div className="dialog-paper-badge">Paper Trading — No Real Money</div>
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onCancel}>Go Back</button>
          <button className={`btn ${order.side === 'buy' ? 'btn-buy' : 'btn-sell'}`} onClick={onConfirm}>Place Order</button>
        </div>
      </div>
    </div>
  );
}
