import Alpaca from '@alpacahq/alpaca-trade-api';
import { ALPACA_PAPER_URL } from '../shared/constants';

export interface AlpacaClient {
  getAccount: () => Promise<any>;
  getPositions: () => Promise<any[]>;
  getOrders: () => Promise<any[]>;
  getBars: (symbol: string, timeframe: string, limit?: number) => Promise<any[]>;
}

export function createAlpacaClient(keyId: string, secretKey: string): AlpacaClient {
  const alpaca = new Alpaca({
    keyId,
    secretKey,
    paper: true,
    baseUrl: ALPACA_PAPER_URL,
  });

  return {
    getAccount: () => alpaca.getAccount(),
    getPositions: () => alpaca.getPositions(),
    getOrders: () => alpaca.getOrders({ status: 'all', limit: 20, direction: 'desc' }),
    getBars: async (symbol: string, timeframe: string, limit = 100) => {
      const bars: any[] = [];
      const iter = alpaca.getBarsV2(symbol, { timeframe, limit });
      for await (const bar of iter) {
        bars.push(bar);
      }
      return bars;
    },
  };
}
