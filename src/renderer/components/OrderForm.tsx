import React, { useState } from 'react';
import type { OrderRequest } from '../types';

interface Props {
  symbol: string;
  lastPrice: number;
  buyingPower: number;
  onSubmit: (order: OrderRequest) => void;
  onCancel: () => void;
}

export function OrderForm({ symbol, lastPrice, buyingPower, onSubmit, onCancel }: Props): React.ReactElement {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [type, setType] = useState<'market' | 'limit'>('market');
  const [qty, setQty] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [tif, setTif] = useState<'day' | 'gtc'>('day');

  const price = type === 'limit' && limitPrice ? parseFloat(limitPrice) : lastPrice;
  const qtyNum = parseInt(qty) || 0;
  const estimatedCost = qtyNum * price;
  const exceedsBuyingPower = side === 'buy' && estimatedCost > buyingPower;
  const canSubmit = qtyNum > 0 && !exceedsBuyingPower && (type === 'market' || parseFloat(limitPrice) > 0);

  const handleSubmit = () => {
    const order: OrderRequest = { symbol, qty: qtyNum, side, type, time_in_force: tif };
    if (type === 'limit') order.limit_price = parseFloat(limitPrice);
    onSubmit(order);
  };

  const formatUsd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  return (
    <div className="order-form">
      <div className="order-form-header">
        <span className="order-symbol">{symbol}</span>
        <span className="order-price">{formatUsd(lastPrice)}</span>
      </div>
      <div className="order-side-toggle">
        <button className={`side-btn buy ${side === 'buy' ? 'active' : ''}`} onClick={() => setSide('buy')}>Buy</button>
        <button className={`side-btn sell ${side === 'sell' ? 'active' : ''}`} onClick={() => setSide('sell')}>Sell</button>
      </div>
      <div className="order-type-toggle">
        <button className={type === 'market' ? 'active' : ''} onClick={() => setType('market')}>Market</button>
        <button className={type === 'limit' ? 'active' : ''} onClick={() => setType('limit')}>Limit</button>
      </div>
      <input type="number" placeholder="Quantity" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
      {type === 'limit' && (
        <input type="number" placeholder="Limit price" step="0.01" min="0.01" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} />
      )}
      <div className="order-tif">
        <label><input type="radio" name="tif" checked={tif === 'day'} onChange={() => setTif('day')} /> Day</label>
        <label><input type="radio" name="tif" checked={tif === 'gtc'} onChange={() => setTif('gtc')} /> GTC</label>
      </div>
      <div className="order-estimate">
        <span>Est. cost:</span>
        <span>{qtyNum > 0 ? `~${formatUsd(estimatedCost)}` : '—'}</span>
      </div>
      {exceedsBuyingPower && <div className="order-warning">Exceeds buying power</div>}
      <div className="order-actions">
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className={`btn ${side === 'buy' ? 'btn-buy' : 'btn-sell'}`} disabled={!canSubmit} onClick={handleSubmit}>Review Order</button>
      </div>
    </div>
  );
}
