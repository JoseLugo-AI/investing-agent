import { describe, it, expect, vi, beforeEach } from 'vitest';
import accountFixture from '../../../test/fixtures/account.json';
import positionsFixture from '../../../test/fixtures/positions.json';
import ordersFixture from '../../../test/fixtures/orders.json';

const mockGetAccount = vi.fn();
const mockGetPositions = vi.fn();
const mockGetOrders = vi.fn();
const mockGetBars = vi.fn();

vi.mock('@alpacahq/alpaca-trade-api', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      getAccount: mockGetAccount,
      getPositions: mockGetPositions,
      getOrders: mockGetOrders,
      getBarsV2: mockGetBars,
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
});
