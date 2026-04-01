import { ipcMain } from 'electron';
import path from 'path';
import { createAlpacaClient, AlpacaClient } from './alpaca-client';
import { saveKeys, loadKeys, hasKeys, clearKeys } from './keystore';
import { createWatchlistStore, WatchlistStore } from './watchlist-store';
import { validateOrder, checkDailyLoss, checkDrawdown, getDefaultRiskConfig } from './risk-engine';
import { analyzePosition } from './claude-analyzer';
import { saveClaudeKey, loadClaudeKey, hasClaudeKey, clearClaudeKey } from './claude-keystore';

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
    const paper = process.env.ALPACA_LIVE !== 'true';
    client = createAlpacaClient(keys.keyId, keys.secretKey, paper);
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
      const paper = process.env.ALPACA_LIVE !== 'true';
      client = createAlpacaClient(keyId, secretKey, paper);
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

    // Risk engine
    'validate-order': async (_e: any, order: any, currentPrice: number) => {
      const c = getClient();
      const [account, positions] = await Promise.all([c.getAccount(), c.getPositions()]);
      return validateOrder(order, account, positions, currentPrice, getDefaultRiskConfig());
    },
    'get-risk-status': async () => {
      const c = getClient();
      const [account, positions] = await Promise.all([c.getAccount(), c.getPositions()]);
      const portfolioValue = parseFloat(account.portfolio_value);
      const daily = checkDailyLoss(account);
      // Use last_equity as a simple peak proxy (Alpaca resets daily)
      const peakEquity = Math.max(parseFloat(account.equity), parseFloat(account.last_equity));
      const dd = checkDrawdown(peakEquity, parseFloat(account.equity));
      const largestPosition = positions.reduce((max: number, p: any) =>
        Math.max(max, parseFloat(p.market_value || '0')), 0);
      return {
        dailyLossPercent: daily.lossPercent,
        dailyLossHalted: daily.halted,
        drawdownPercent: dd.percent,
        drawdownLevel: dd.level,
        largestPositionPercent: portfolioValue > 0 ? largestPosition / portfolioValue : 0,
        positionCount: positions.length,
        portfolioValue,
      };
    },

    // Claude AI analysis
    'analyze-position': async (_e: any, symbol: string) => {
      const claudeKey = loadClaudeKey();
      if (!claudeKey) throw new Error('Claude API key not configured');
      const c = getClient();
      const [account, positions, bars] = await Promise.all([
        c.getAccount(),
        c.getPositions(),
        c.getBars(symbol, '1Day', 20),
      ]);
      const position = positions.find((p: any) => p.symbol === symbol) || null;
      return analyzePosition(claudeKey, symbol, position, account, bars);
    },
    'save-claude-key': async (_e: any, apiKey: string) => {
      saveClaudeKey(apiKey);
    },
    'has-claude-key': async () => hasClaudeKey(),
    'clear-claude-key': async () => {
      clearClaudeKey();
    },
  };
}

export function registerIpcHandlers(): void {
  const handlers = createHandlers();
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, handler);
  }
}
