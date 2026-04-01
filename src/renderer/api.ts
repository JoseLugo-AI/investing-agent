import type { Account, Position, Order, Bar, OrderRequest, Quote, PortfolioHistory, Asset, WatchlistItem, RiskCheck, RiskStatus, AnalysisResult } from './types';

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
  createOrder: (order: OrderRequest): Promise<Order> => window.api.createOrder(order),
  cancelOrder: (orderId: string): Promise<void> => window.api.cancelOrder(orderId),
  getQuote: (symbol: string): Promise<Quote> => window.api.getQuote(symbol),
  getPortfolioHistory: (period: string, timeframe: string): Promise<PortfolioHistory> =>
    window.api.getPortfolioHistory(period, timeframe),
  searchAssets: (query: string): Promise<Asset[]> => window.api.searchAssets(query),
  getWatchlist: (): Promise<WatchlistItem[]> => window.api.getWatchlist(),
  addToWatchlist: (symbol: string, name: string): Promise<void> =>
    window.api.addToWatchlist(symbol, name),
  removeFromWatchlist: (symbol: string): Promise<void> =>
    window.api.removeFromWatchlist(symbol),
  validateOrder: (order: OrderRequest, currentPrice: number): Promise<RiskCheck> =>
    window.api.validateOrder(order, currentPrice),
  getRiskStatus: (): Promise<RiskStatus> => window.api.getRiskStatus(),
  analyzePosition: (symbol: string): Promise<AnalysisResult> =>
    window.api.analyzePosition(symbol),
  saveClaudeKey: (apiKey: string): Promise<void> =>
    window.api.saveClaudeKey(apiKey),
  hasClaudeKey: (): Promise<boolean> => window.api.hasClaudeKey(),
  clearClaudeKey: (): Promise<void> => window.api.clearClaudeKey(),
};
