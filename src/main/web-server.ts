import express from 'express';
import cors from 'cors';
import path from 'path';
import { createAlpacaClient } from './alpaca-client';
import { createWatchlistStore } from './watchlist-store';
import { validateOrder, checkDailyLoss, checkDrawdown, getDefaultRiskConfig } from './risk-engine';
import { analyzePosition } from './claude-analyzer';

const PORT = parseInt(process.env.WEB_PORT || '3100', 10);

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

export function startWebServer(): void {
  const keyId = requireEnv('ALPACA_KEY_ID');
  const secretKey = requireEnv('ALPACA_SECRET_KEY');
  const claudeKey = process.env.ANTHROPIC_API_KEY || '';

  const client = createAlpacaClient(keyId, secretKey);
  const dbPath = path.join(process.cwd(), 'watchlist.db');
  const watchlist = createWatchlistStore(dbPath);

  const app = express();
  app.use(cors());
  app.use(express.json());

  // --- Account & Portfolio ---
  app.get('/api/account', async (_req, res) => {
    try { res.json(await client.getAccount()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/positions', async (_req, res) => {
    try { res.json(await client.getPositions()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/orders', async (_req, res) => {
    try { res.json(await client.getOrders()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/portfolio-history', async (req, res) => {
    try {
      const period = (req.query.period as string) || '1M';
      const timeframe = (req.query.timeframe as string) || '1D';
      res.json(await client.getPortfolioHistory(period, timeframe));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Market Data ---
  app.get('/api/bars/:symbol', async (req, res) => {
    try {
      const tf = (req.query.timeframe as string) || '1Day';
      res.json(await client.getBars(req.params.symbol, tf));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/quote/:symbol', async (req, res) => {
    try { res.json(await client.getQuote(req.params.symbol)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/search', async (req, res) => {
    try {
      const q = (req.query.q as string) || '';
      res.json(await client.searchAssets(q));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Orders ---
  app.post('/api/orders', async (req, res) => {
    try { res.json(await client.createOrder(req.body)); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/orders/:id', async (req, res) => {
    try { await client.cancelOrder(req.params.id); res.json({ ok: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Watchlist ---
  app.get('/api/watchlist', (_req, res) => {
    try { res.json(watchlist.getAll()); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/watchlist', (req, res) => {
    try { watchlist.add(req.body.symbol, req.body.name); res.json({ ok: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/watchlist/:symbol', (req, res) => {
    try { watchlist.remove(req.params.symbol); res.json({ ok: true }); }
    catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Risk Engine ---
  app.post('/api/validate-order', async (req, res) => {
    try {
      const { order, currentPrice } = req.body;
      const [account, positions] = await Promise.all([client.getAccount(), client.getPositions()]);
      res.json(validateOrder(order, account, positions, currentPrice, getDefaultRiskConfig()));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/risk-status', async (_req, res) => {
    try {
      const [account, positions] = await Promise.all([client.getAccount(), client.getPositions()]);
      const portfolioValue = parseFloat(account.portfolio_value);
      const daily = checkDailyLoss(account);
      const peakEquity = Math.max(parseFloat(account.equity), parseFloat(account.last_equity));
      const dd = checkDrawdown(peakEquity, parseFloat(account.equity));
      const largestPosition = positions.reduce((max: number, p: any) =>
        Math.max(max, parseFloat(p.market_value || '0')), 0);
      res.json({
        dailyLossPercent: daily.lossPercent,
        dailyLossHalted: daily.halted,
        drawdownPercent: dd.percent,
        drawdownLevel: dd.level,
        largestPositionPercent: portfolioValue > 0 ? largestPosition / portfolioValue : 0,
        positionCount: positions.length,
        portfolioValue,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Claude AI Analysis ---
  app.get('/api/analyze/:symbol', async (req, res) => {
    try {
      if (!claudeKey) throw new Error('ANTHROPIC_API_KEY not set');
      const [account, positions, bars] = await Promise.all([
        client.getAccount(),
        client.getPositions(),
        client.getBars(req.params.symbol, '1Day', 20),
      ]);
      const position = positions.find((p: any) => p.symbol === req.params.symbol) || null;
      res.json(await analyzePosition(claudeKey, req.params.symbol, position, account, bars));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Key status (web mode reads from env, so always "true") ---
  app.get('/api/has-keys', (_req, res) => res.json(true));
  app.get('/api/has-claude-key', (_req, res) => res.json(!!claudeKey));

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Investing Agent API running on http://0.0.0.0:${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT} (via Vite proxy)`);
  });
}

// Run directly
startWebServer();
