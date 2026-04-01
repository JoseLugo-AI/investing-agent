import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { AccountSummary } from './AccountSummary';
import { PositionsTable } from './PositionsTable';
import { OrdersTable } from './OrdersTable';
import { PriceChart } from './PriceChart';
import { StatusBar } from './StatusBar';
import { PortfolioChart } from './PortfolioChart';
import { Watchlist } from './Watchlist';
import { OrderForm } from './OrderForm';
import { OrderConfirmDialog } from './OrderConfirmDialog';
import { RiskPanel } from './RiskPanel';
import { AIAnalysis } from './AIAnalysis';
import { RiskGate } from './RiskGate';
import { ToastContainer, useToast } from './Toast';
import { POLL_INTERVAL_MS } from '@shared/constants';
import type { Account, Position, Order, Bar, OrderRequest } from '../types';

export function Dashboard(): React.ReactElement {
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const [orderSymbol, setOrderSymbol] = useState<string | null>(null);
  const [orderPrice, setOrderPrice] = useState<number>(0);
  const [pendingOrder, setPendingOrder] = useState<OrderRequest | null>(null);

  const { toasts, addToast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [acc, pos, ord] = await Promise.all([
        api.getAccount(),
        api.getPositions(),
        api.getOrders(),
      ]);
      setAccount(acc);
      setPositions(pos);
      setOrders(ord);
      setConnected(true);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!selectedSymbol) return;
    api.getBars(selectedSymbol, '1Hour').then(setBars).catch(() => setBars([]));
  }, [selectedSymbol]);

  const handleTrade = (symbol: string, lastPrice: number) => {
    setOrderSymbol(symbol);
    setOrderPrice(lastPrice);
  };

  const handleOrderSubmit = (order: OrderRequest) => {
    setPendingOrder(order);
  };

  const handleOrderConfirm = async () => {
    if (!pendingOrder) return;
    try {
      const result = await api.createOrder(pendingOrder);
      addToast({ type: 'success', title: 'Order Placed', message: `${pendingOrder.side.toUpperCase()} ${pendingOrder.qty} ${pendingOrder.symbol} — ${result.status}` });
      setPendingOrder(null);
      setOrderSymbol(null);
      fetchData();
    } catch (err) {
      addToast({ type: 'error', title: 'Order Failed', message: err instanceof Error ? err.message : 'Unknown error' });
      setPendingOrder(null);
    }
  };

  return (
    <div className="dashboard">
      <StatusBar connected={connected} lastUpdated={lastUpdated} error={error} />
      <AccountSummary account={account} />
      <PortfolioChart />

      <div className="dashboard-grid">
        <div className="dashboard-panel">
          <h2>Positions</h2>
          <PositionsTable positions={positions} onSelectSymbol={setSelectedSymbol} />
        </div>
        <div className="dashboard-panel">
          <PriceChart symbol={selectedSymbol} bars={bars} />
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-panel">
          <h2>Recent Orders</h2>
          <OrdersTable orders={orders} />
        </div>
        <div className="dashboard-panel">
          <Watchlist onTrade={handleTrade} />
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-panel">
          <RiskPanel />
        </div>
        <div className="dashboard-panel">
          <AIAnalysis symbol={selectedSymbol} />
        </div>
      </div>

      {orderSymbol && !pendingOrder && (
        <div className="dialog-overlay">
          <OrderForm
            symbol={orderSymbol}
            lastPrice={orderPrice}
            buyingPower={account ? parseFloat(account.buying_power) : 0}
            onSubmit={handleOrderSubmit}
            onCancel={() => setOrderSymbol(null)}
          />
        </div>
      )}

      {pendingOrder && (
        <div className="dialog-overlay">
          <div className="dialog">
            <OrderConfirmDialog
              order={pendingOrder}
              lastPrice={orderPrice}
              onConfirm={handleOrderConfirm}
              onCancel={() => setPendingOrder(null)}
            />
            <RiskGate
              order={pendingOrder}
              lastPrice={orderPrice}
              onConfirm={handleOrderConfirm}
              onCancel={() => setPendingOrder(null)}
            />
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
