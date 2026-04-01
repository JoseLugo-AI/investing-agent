import Alpaca from '@alpacahq/alpaca-trade-api';
import { ALPACA_PAPER_URL, ALPACA_LIVE_URL } from '../shared/constants';

export interface AlpacaClient {
  getAccount: () => Promise<any>;
  getPositions: () => Promise<any[]>;
  getOrders: () => Promise<any[]>;
  getBars: (symbol: string, timeframe: string, limit?: number) => Promise<any[]>;
  createOrder: (order: { symbol: string; qty: number; side: string; type: string; time_in_force: string; limit_price?: number }) => Promise<any>;
  cancelOrder: (orderId: string) => Promise<void>;
  getQuote: (symbol: string) => Promise<any>;
  getPortfolioHistory: (period: string, timeframe: string) => Promise<any>;
  searchAssets: (query: string) => Promise<any[]>;
  isPaper: boolean;
}

export function createAlpacaClient(keyId: string, secretKey: string, paper: boolean = true): AlpacaClient {
  const alpaca = new Alpaca({
    keyId,
    secretKey,
    paper,
    baseUrl: paper ? ALPACA_PAPER_URL : ALPACA_LIVE_URL,
  });

  return {
    isPaper: paper,
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
    createOrder: (order) => alpaca.createOrder(order),
    cancelOrder: (orderId) => alpaca.cancelOrder(orderId),
    getQuote: (symbol) => alpaca.getSnapshot(symbol),
    getPortfolioHistory: (period, timeframe) =>
      alpaca.getPortfolioHistory({ period, timeframe }),
    searchAssets: async (query) => {
      const assets = await alpaca.getAssets({ status: 'active', search: query });
      return assets
        .filter((a: any) => a.tradable)
        .slice(0, 10);
    },
  };
}
