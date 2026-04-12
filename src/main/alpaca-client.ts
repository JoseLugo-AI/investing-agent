import Alpaca from '@alpacahq/alpaca-trade-api';
import { ALPACA_PAPER_URL, ALPACA_LIVE_URL } from '../shared/constants';

export interface AlpacaClient {
  getAccount: () => Promise<any>;
  getPositions: () => Promise<any[]>;
  getOrders: () => Promise<any[]>;
  getBars: (symbol: string, timeframe: string, limit?: number) => Promise<any[]>;
  getCryptoBars: (symbol: string, timeframe: string, limit?: number) => Promise<any[]>;
  getCryptoSnapshot: (symbol: string) => Promise<any>;
  createOrder: (order: { symbol: string; qty: number; side: string; type: string; time_in_force: string; limit_price?: number }) => Promise<any>;
  cancelOrder: (orderId: string) => Promise<void>;
  getQuote: (symbol: string) => Promise<any>;
  getPortfolioHistory: (period: string, timeframe: string) => Promise<any>;
  searchAssets: (query: string) => Promise<any[]>;
  getAsset: (symbol: string) => Promise<{ symbol: string; easy_to_borrow: boolean; shortable: boolean; tradable: boolean }>;
  isPaper: boolean;
}

export function isCrypto(symbol: string): boolean {
  return symbol.includes('/USD');
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
    getOrders: () => (alpaca as any).getOrders({ status: 'all', limit: 20, direction: 'desc' }),
    getBars: async (symbol: string, timeframe: string, limit = 100) => {
      const bars: any[] = [];
      // getBarsV2 needs explicit start date; no end date to avoid SIP restrictions
      const start = new Date();
      start.setDate(start.getDate() - 60);
      const iter = alpaca.getBarsV2(symbol, {
        timeframe,
        start: start.toISOString(),
        limit: 10000,
        feed: 'iex',
      });
      for await (const bar of iter) {
        bars.push({
          t: bar.Timestamp,
          o: bar.OpenPrice,
          h: bar.HighPrice,
          l: bar.LowPrice,
          c: bar.ClosePrice,
          v: bar.Volume,
        });
      }
      return bars;
    },
    getCryptoBars: async (symbol: string, timeframe: string, _limit = 100) => {
      const start = new Date();
      start.setDate(start.getDate() - 365); // crypto needs longer history for SMA200
      const barsMap = await (alpaca as any).getCryptoBars([symbol], {
        timeframe,
        start: start.toISOString(),
        limit: 10000,
      });
      const rawBars = barsMap.get(symbol) || [];
      return rawBars.map((bar: any) => ({
        t: bar.Timestamp,
        o: bar.Open,
        h: bar.High,
        l: bar.Low,
        c: bar.Close,
        v: bar.Volume,
      }));
    },
    getCryptoSnapshot: async (symbol: string) => {
      const snapshots = await (alpaca as any).getCryptoSnapshots([symbol]);
      return snapshots.get(symbol) ?? null;
    },
    createOrder: (order) => alpaca.createOrder(order),
    cancelOrder: (orderId) => alpaca.cancelOrder(orderId),
    getQuote: (symbol) => alpaca.getSnapshot(symbol),
    getPortfolioHistory: (period, timeframe) =>
      (alpaca as any).getPortfolioHistory({ period, timeframe }),
    searchAssets: async (query) => {
      const assets = await alpaca.getAssets({ status: 'active', search: query });
      return assets
        .filter((a: any) => a.tradable)
        .slice(0, 10);
    },
    getAsset: async (symbol: string) => {
      const asset = await alpaca.getAsset(symbol);
      return {
        symbol: asset.symbol,
        easy_to_borrow: asset.easy_to_borrow,
        shortable: asset.shortable,
        tradable: asset.tradable,
      };
    },
  };
}
