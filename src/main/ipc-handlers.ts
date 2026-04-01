import { ipcMain } from 'electron';
import { createAlpacaClient, AlpacaClient } from './alpaca-client';
import { saveKeys, loadKeys, hasKeys, clearKeys } from './keystore';

export function createHandlers(): Record<string, (...args: any[]) => Promise<any>> {
  let client: AlpacaClient | null = null;

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
  };
}

export function registerIpcHandlers(): void {
  const handlers = createHandlers();
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, handler);
  }
}
