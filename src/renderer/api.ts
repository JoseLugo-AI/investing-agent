import type { Account, Position, Order, Bar, OrderRequest, Quote, PortfolioHistory, Asset, WatchlistItem, RiskCheck, RiskStatus, AnalysisResult } from './types';

const isElectron = typeof window !== 'undefined' && !!window.api;

// Fetch helper for web mode
async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

// Web API (fetch-based)
const webApi = {
  getAccount: () => get<Account>('/api/account'),
  getPositions: () => get<Position[]>('/api/positions'),
  getOrders: () => get<Order[]>('/api/orders'),
  getBars: (symbol: string, timeframe: string) =>
    get<Bar[]>(`/api/bars/${symbol}?timeframe=${timeframe}`),
  saveApiKeys: async (_keyId: string, _secretKey: string) => {
    // In web mode, keys come from env vars — no-op
  },
  hasApiKeys: () => get<boolean>('/api/has-keys'),
  clearApiKeys: async () => { /* no-op in web mode */ },
  createOrder: (order: OrderRequest) => post<Order>('/api/orders', order),
  cancelOrder: (orderId: string) => del<void>(`/api/orders/${orderId}`),
  getQuote: (symbol: string) => get<Quote>(`/api/quote/${symbol}`),
  getPortfolioHistory: (period: string, timeframe: string) =>
    get<PortfolioHistory>(`/api/portfolio-history?period=${period}&timeframe=${timeframe}`),
  searchAssets: (query: string) => get<Asset[]>(`/api/search?q=${encodeURIComponent(query)}`),
  getWatchlist: () => get<WatchlistItem[]>('/api/watchlist'),
  addToWatchlist: (symbol: string, name: string) =>
    post<void>('/api/watchlist', { symbol, name }),
  removeFromWatchlist: (symbol: string) =>
    del<void>(`/api/watchlist/${symbol}`),
  validateOrder: (order: OrderRequest, currentPrice: number) =>
    post<RiskCheck>('/api/validate-order', { order, currentPrice }),
  getRiskStatus: () => get<RiskStatus>('/api/risk-status'),
  analyzePosition: (symbol: string) => get<AnalysisResult>(`/api/analyze/${symbol}`),
  saveClaudeKey: async (_apiKey: string) => { /* no-op in web mode */ },
  hasClaudeKey: () => get<boolean>('/api/has-claude-key'),
  clearClaudeKey: async () => { /* no-op in web mode */ },
};

// Electron API (IPC-based)
const electronApi = {
  getAccount: () => window.api.getAccount(),
  getPositions: () => window.api.getPositions(),
  getOrders: () => window.api.getOrders(),
  getBars: (symbol: string, timeframe: string) => window.api.getBars(symbol, timeframe),
  saveApiKeys: (keyId: string, secretKey: string) => window.api.saveApiKeys(keyId, secretKey),
  hasApiKeys: () => window.api.hasApiKeys(),
  clearApiKeys: () => window.api.clearApiKeys(),
  createOrder: (order: OrderRequest) => window.api.createOrder(order),
  cancelOrder: (orderId: string) => window.api.cancelOrder(orderId),
  getQuote: (symbol: string) => window.api.getQuote(symbol),
  getPortfolioHistory: (period: string, timeframe: string) =>
    window.api.getPortfolioHistory(period, timeframe),
  searchAssets: (query: string) => window.api.searchAssets(query),
  getWatchlist: () => window.api.getWatchlist(),
  addToWatchlist: (symbol: string, name: string) => window.api.addToWatchlist(symbol, name),
  removeFromWatchlist: (symbol: string) => window.api.removeFromWatchlist(symbol),
  validateOrder: (order: OrderRequest, currentPrice: number) =>
    window.api.validateOrder(order, currentPrice),
  getRiskStatus: () => window.api.getRiskStatus(),
  analyzePosition: (symbol: string) => window.api.analyzePosition(symbol),
  saveClaudeKey: (apiKey: string) => window.api.saveClaudeKey(apiKey),
  hasClaudeKey: () => window.api.hasClaudeKey(),
  clearClaudeKey: () => window.api.clearClaudeKey(),
};

export const api = isElectron ? electronApi : webApi;
