import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { AccountSummary } from './AccountSummary';
import { PositionsTable } from './PositionsTable';
import { OrdersTable } from './OrdersTable';
import { PriceChart } from './PriceChart';
import { StatusBar } from './StatusBar';
import { POLL_INTERVAL_MS } from '@shared/constants';
import type { Account, Position, Order, Bar } from '../types';

export function Dashboard(): React.ReactElement {
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

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

  return (
    <div className="dashboard">
      <StatusBar connected={connected} lastUpdated={lastUpdated} error={error} />
      <AccountSummary account={account} />
      <div className="dashboard-grid">
        <div className="dashboard-panel">
          <h2>Positions</h2>
          <PositionsTable positions={positions} onSelectSymbol={setSelectedSymbol} />
        </div>
        <div className="dashboard-panel">
          <PriceChart symbol={selectedSymbol} bars={bars} />
        </div>
      </div>
      <div className="dashboard-panel">
        <h2>Recent Orders</h2>
        <OrdersTable orders={orders} />
      </div>
    </div>
  );
}
