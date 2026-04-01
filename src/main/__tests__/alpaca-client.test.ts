import { describe, it, expect, vi, beforeEach } from 'vitest';
import accountFixture from '../../../test/fixtures/account.json';
import positionsFixture from '../../../test/fixtures/positions.json';
import ordersFixture from '../../../test/fixtures/orders.json';
import quoteFixture from '../../../test/fixtures/quote.json';
import portfolioHistoryFixture from '../../../test/fixtures/portfolio-history.json';
import orderCreatedFixture from '../../../test/fixtures/order-created.json';
import assetsSearchFixture from '../../../test/fixtures/assets-search.json';

const mockGetAccount = vi.fn();
const mockGetPositions = vi.fn();
const mockGetOrders = vi.fn();
const mockGetBars = vi.fn();
const mockCreateOrder = vi.fn();
const mockCancelOrder = vi.fn();
const mockGetSnapshot = vi.fn();
const mockGetPortfolioHistory = vi.fn();
const mockGetAssets = vi.fn();

vi.mock('@alpacahq/alpaca-trade-api', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      getAccount: mockGetAccount,
      getPositions: mockGetPositions,
      getOrders: mockGetOrders,
      getBarsV2: mockGetBars,
      createOrder: mockCreateOrder,
      cancelOrder: mockCancelOrder,
      getSnapshot: mockGetSnapshot,
      getPortfolioHistory: mockGetPortfolioHistory,
      getAssets: mockGetAssets,
    })),
  };
});

import { createAlpacaClient, AlpacaClient } from '../alpaca-client';

describe('AlpacaClient', () => {
  let client: AlpacaClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createAlpacaClient('PKTEST', 'SKTEST');
  });

  it('fetches account data', async () => {
    mockGetAccount.mockResolvedValue(accountFixture);
    const account = await client.getAccount();
    expect(account.portfolio_value).toBe('100000.00');
    expect(account.buying_power).toBe('75420.50');
  });

  it('fetches positions', async () => {
    mockGetPositions.mockResolvedValue(positionsFixture);
    const positions = await client.getPositions();
    expect(positions).toHaveLength(2);
    expect(positions[0].symbol).toBe('AAPL');
  });

  it('fetches recent orders', async () => {
    mockGetOrders.mockResolvedValue(ordersFixture);
    const orders = await client.getOrders();
    expect(orders).toHaveLength(2);
    expect(orders[0].status).toBe('filled');
  });

  it('throws on API error', async () => {
    mockGetAccount.mockRejectedValue(new Error('Unauthorized'));
    await expect(client.getAccount()).rejects.toThrow('Unauthorized');
  });

  it('creates a market order', async () => {
    mockCreateOrder.mockResolvedValue(orderCreatedFixture);
    const order = await client.createOrder({
      symbol: 'AAPL', qty: 5, side: 'buy', type: 'market', time_in_force: 'day',
    });
    expect(order.symbol).toBe('AAPL');
    expect(order.status).toBe('accepted');
  });

  it('cancels an order', async () => {
    mockCancelOrder.mockResolvedValue(undefined);
    await client.cancelOrder('order-123');
    expect(mockCancelOrder).toHaveBeenCalledWith('order-123');
  });

  it('gets a quote for a symbol', async () => {
    mockGetSnapshot.mockResolvedValue(quoteFixture);
    const quote = await client.getQuote('AAPL');
    expect(quote.symbol).toBe('AAPL');
    expect(quote.last.price).toBe(178.25);
  });

  it('gets portfolio history', async () => {
    mockGetPortfolioHistory.mockResolvedValue(portfolioHistoryFixture);
    const history = await client.getPortfolioHistory('1M', '1D');
    expect(history.equity).toHaveLength(5);
  });

  it('searches assets by query', async () => {
    mockGetAssets.mockResolvedValue(assetsSearchFixture);
    const assets = await client.searchAssets('AA');
    expect(assets).toHaveLength(3);
    expect(assets[0].symbol).toBe('AAPL');
  });
});
