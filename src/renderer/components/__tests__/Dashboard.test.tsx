import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { Dashboard } from '../Dashboard';
import accountFixture from '../../../../test/fixtures/account.json';
import positionsFixture from '../../../../test/fixtures/positions.json';
import ordersFixture from '../../../../test/fixtures/orders.json';
import portfolioHistoryFixture from '../../../../test/fixtures/portfolio-history.json';

vi.mock('../../api', () => ({
  api: {
    getAccount: vi.fn(() => Promise.resolve(accountFixture)),
    getPositions: vi.fn(() => Promise.resolve(positionsFixture)),
    getOrders: vi.fn(() => Promise.resolve(ordersFixture)),
    getBars: vi.fn(() => Promise.resolve([])),
    hasApiKeys: vi.fn(() => Promise.resolve(true)),
    getPortfolioHistory: vi.fn(() => Promise.resolve(portfolioHistoryFixture)),
    getWatchlist: vi.fn(() => Promise.resolve([])),
    getQuote: vi.fn(() => Promise.resolve({ symbol: 'AAPL', last: { price: 178.25, size: 100, timestamp: '' }, bid: { price: 0, size: 0 }, ask: { price: 0, size: 0 } })),
    searchAssets: vi.fn(() => Promise.resolve([])),
    createOrder: vi.fn(() => Promise.resolve({ status: 'accepted' })),
    cancelOrder: vi.fn(() => Promise.resolve()),
    addToWatchlist: vi.fn(() => Promise.resolve()),
    removeFromWatchlist: vi.fn(() => Promise.resolve()),
  },
}));

// Mock lightweight-charts since it needs canvas
vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addCandlestickSeries: vi.fn(() => ({ setData: vi.fn() })),
    timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
    applyOptions: vi.fn(),
    remove: vi.fn(),
  })),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}));

describe('Dashboard', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders account summary after loading', async () => {
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('$100,000.00')).toBeDefined();
    });
  });

  it('renders positions table', async () => {
    render(<Dashboard />);
    await waitFor(() => {
      // AAPL and MSFT appear in both PositionsTable and OrdersTable
      expect(screen.getAllByText('AAPL').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('MSFT').length).toBeGreaterThanOrEqual(1);
    });
  });
});
