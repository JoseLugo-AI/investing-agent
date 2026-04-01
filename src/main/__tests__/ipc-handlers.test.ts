import { describe, it, expect, vi, beforeEach } from 'vitest';
import accountFixture from '../../../test/fixtures/account.json';
import positionsFixture from '../../../test/fixtures/positions.json';
import ordersFixture from '../../../test/fixtures/orders.json';
import orderCreatedFixture from '../../../test/fixtures/order-created.json';
import quoteFixture from '../../../test/fixtures/quote.json';
import portfolioHistoryFixture from '../../../test/fixtures/portfolio-history.json';
import assetsSearchFixture from '../../../test/fixtures/assets-search.json';

vi.mock('../keystore', () => ({
  saveKeys: vi.fn(),
  loadKeys: vi.fn(() => ({ keyId: 'PK', secretKey: 'SK' })),
  hasKeys: vi.fn(() => true),
  clearKeys: vi.fn(),
}));

vi.mock('../watchlist-store', () => ({
  createWatchlistStore: vi.fn(() => ({
    getAll: vi.fn(() => [{ symbol: 'AAPL', name: 'Apple Inc.', added_at: '2026-03-31' }]),
    add: vi.fn(),
    remove: vi.fn(),
    close: vi.fn(),
  })),
}));

const mockClient = {
  getAccount: vi.fn(() => Promise.resolve(accountFixture)),
  getPositions: vi.fn(() => Promise.resolve(positionsFixture)),
  getOrders: vi.fn(() => Promise.resolve(ordersFixture)),
  getBars: vi.fn(() => Promise.resolve([])),
  createOrder: vi.fn(() => Promise.resolve(orderCreatedFixture)),
  cancelOrder: vi.fn(() => Promise.resolve()),
  getQuote: vi.fn(() => Promise.resolve(quoteFixture)),
  getPortfolioHistory: vi.fn(() => Promise.resolve(portfolioHistoryFixture)),
  searchAssets: vi.fn(() => Promise.resolve(assetsSearchFixture)),
};

vi.mock('../alpaca-client', () => ({
  createAlpacaClient: vi.fn(() => mockClient),
}));

import { createHandlers } from '../ipc-handlers';

describe('IPC Handlers', () => {
  let handlers: Record<string, (...args: any[]) => Promise<any>>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = createHandlers();
  });

  it('get-account returns account data', async () => {
    const result = await handlers['get-account']();
    expect(result.portfolio_value).toBe('100000.00');
  });

  it('get-positions returns positions array', async () => {
    const result = await handlers['get-positions']();
    expect(result).toHaveLength(2);
  });

  it('get-orders returns orders array', async () => {
    const result = await handlers['get-orders']();
    expect(result).toHaveLength(2);
  });

  it('has-api-keys returns boolean', async () => {
    const result = await handlers['has-api-keys']();
    expect(result).toBe(true);
  });

  it('create-order places an order', async () => {
    const result = await handlers['create-order'](null, {
      symbol: 'AAPL', qty: 5, side: 'buy', type: 'market', time_in_force: 'day'
    });
    expect(result.symbol).toBe('AAPL');
  });

  it('cancel-order cancels an order', async () => {
    await handlers['cancel-order'](null, 'order-123');
  });

  it('get-quote returns quote data', async () => {
    const result = await handlers['get-quote'](null, 'AAPL');
    expect(result.symbol).toBe('AAPL');
  });

  it('get-portfolio-history returns equity data', async () => {
    const result = await handlers['get-portfolio-history'](null, '1M', '1D');
    expect(result.equity).toHaveLength(5);
  });

  it('get-watchlist returns watchlist items', async () => {
    const result = await handlers['get-watchlist']();
    expect(result).toHaveLength(1);
  });
});
