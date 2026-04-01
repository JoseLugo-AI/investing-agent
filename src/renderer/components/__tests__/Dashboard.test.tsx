import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { Dashboard } from '../Dashboard';
import accountFixture from '../../../../test/fixtures/account.json';
import positionsFixture from '../../../../test/fixtures/positions.json';
import ordersFixture from '../../../../test/fixtures/orders.json';

vi.mock('../../api', () => ({
  api: {
    getAccount: vi.fn(() => Promise.resolve(accountFixture)),
    getPositions: vi.fn(() => Promise.resolve(positionsFixture)),
    getOrders: vi.fn(() => Promise.resolve(ordersFixture)),
    getBars: vi.fn(() => Promise.resolve([])),
    hasApiKeys: vi.fn(() => Promise.resolve(true)),
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
