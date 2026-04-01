import { ipcMain } from 'electron';
import path from 'path';
import { createAlpacaClient, AlpacaClient } from './alpaca-client';
import { saveKeys, loadKeys, hasKeys, clearKeys } from './keystore';
import { createWatchlistStore, WatchlistStore } from './watchlist-store';

export function createHandlers(dbPath?: string): Record<string, (...args: any[]) => Promise<any>> {
  let client: AlpacaClient | null = null;

  // Resolve db path: use provided path, or derive from electron app userData, or fall back to cwd
  let resolvedDbPath = dbPath;
  if (!resolvedDbPath) {
    try {
      const { app } = require('electron');
      resolvedDbPath = path.join(app.getPath('userData'), 'watchlist.db');
    } catch {
      resolvedDbPath = path.join(process.cwd(), 'watchlist.db');
    }
  }

  const watchlistStore: WatchlistStore = createWatchlistStore(resolvedDbPath);

  function getClient(): AlpacaClient {
    if (client) return client;
    const keys = loadKeys();
    if (!keys) throw new Error('API keys not configured');
    client = createAlpacaClient(keys.keyId, keys.secretKey);
    return client;
  }

  return {
    'get-account': async () => getClient().getAccount(),
    'get-positions': async () => getClient().getPositions(),
    'get-orders': async () => getClient().getOrders(),
    'get-bars': async (_e: any, symbol: string, timeframe: string) =>
      getClient().getBars(symbol, timeframe),
    'save-api-keys': async (_e: any, keyId: string, secretKey: string) => {
      saveKeys(keyId, secretKey);
      client = createAlpacaClient(keyId, secretKey);
    },
    'has-api-keys': async () => hasKeys(),
    'clear-api-keys': async () => {
      clearKeys();
      client = null;
    },
    'create-order': async (_e: any, order: any) => getClient().createOrder(order),
    'cancel-order': async (_e: any, orderId: string) => getClient().cancelOrder(orderId),
    'get-quote': async (_e: any, symbol: string) => getClient().getQuote(symbol),
    'get-portfolio-history': async (_e: any, period: string, timeframe: string) =>
      getClient().getPortfolioHistory(period, timeframe),
    'search-assets': async (_e: any, query: string) => getClient().searchAssets(query),
    'get-watchlist': async () => watchlistStore.getAll(),
    'add-to-watchlist': async (_e: any, symbol: string, name: string) => watchlistStore.add(symbol, name),
    'remove-from-watchlist': async (_e: any, symbol: string) => watchlistStore.remove(symbol),
  };
}

export function registerIpcHandlers(): void {
  const handlers = createHandlers();
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, handler);
  }
}
