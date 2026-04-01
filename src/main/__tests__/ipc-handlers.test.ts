import { describe, it, expect, vi, beforeEach } from 'vitest';
import accountFixture from '../../../test/fixtures/account.json';
import positionsFixture from '../../../test/fixtures/positions.json';
import ordersFixture from '../../../test/fixtures/orders.json';

vi.mock('../keystore', () => ({
  saveKeys: vi.fn(),
  loadKeys: vi.fn(() => ({ keyId: 'PK', secretKey: 'SK' })),
  hasKeys: vi.fn(() => true),
  clearKeys: vi.fn(),
}));

const mockClient = {
  getAccount: vi.fn(() => Promise.resolve(accountFixture)),
  getPositions: vi.fn(() => Promise.resolve(positionsFixture)),
  getOrders: vi.fn(() => Promise.resolve(ordersFixture)),
  getBars: vi.fn(() => Promise.resolve([])),
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
});
