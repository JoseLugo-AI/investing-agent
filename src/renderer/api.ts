import type { Account, Position, Order, Bar } from './types';

export const api = {
  getAccount: (): Promise<Account> => window.api.getAccount(),
  getPositions: (): Promise<Position[]> => window.api.getPositions(),
  getOrders: (): Promise<Order[]> => window.api.getOrders(),
  getBars: (symbol: string, timeframe: string): Promise<Bar[]> =>
    window.api.getBars(symbol, timeframe),
  saveApiKeys: (keyId: string, secretKey: string): Promise<void> =>
    window.api.saveApiKeys(keyId, secretKey),
  hasApiKeys: (): Promise<boolean> => window.api.hasApiKeys(),
  clearApiKeys: (): Promise<void> => window.api.clearApiKeys(),
};
