import express from 'express';
import cors from 'cors';
import path from 'path';
import { createAlpacaClient } from './alpaca-client';
import { createWatchlistStore } from './watchlist-store';
import { createAgentStore } from './agent-store';
import { createAgentDaemon, calculateTierAllocations } from './agent-daemon';
import { validateOrder, checkDailyLoss, checkDrawdown, getDefaultRiskConfig } from './risk-engine';
import { analyzePosition } from './claude-analyzer';
import type { TierId } from '../shared/agent-types';

const PORT = parseInt(process.env.WEB_PORT || '3100', 10);

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

export function startWebServer(): void {
  const keyId = requireEnv('ALPACA_KEY_ID');
  const secretKey = requireEnv('ALPACA_SECRET_KEY');

  const paper = process.env.ALPACA_LIVE !== 'true';
  if (!paper) {
    console.warn('*** LIVE TRADING MODE — real money at risk ***');
  }
  const client = createAlpacaClient(keyId, secretKey, paper);
  const dbPath = path.join(process.cwd(), 'watchlist.db');
  const watchlist = createWatchlistStore(dbPath);

  // Agent daemon
  const agentDbPath = path.join(process.cwd(), 'agent.db');
  const agentStore = createAgentStore(agentDbPath);
  const agentDaemon = createAgentDaemon(client, agentStore);

  // Auto-start if previously enabled
  if (agentStore.getConfig('auto_start') === 'true') {
    console.log('Auto-starting trading agent...');
    agentDaemon.start();
  }

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

  // --- Claude AI Analysis (via Claude Code CLI) ---
  app.get('/api/analyze/:symbol', async (req, res) => {
    try {
      const [account, positions, bars] = await Promise.all([
        client.getAccount(),
        client.getPositions(),
        client.getBars(req.params.symbol, '1Day', 20),
      ]);
      const position = positions.find((p: any) => p.symbol === req.params.symbol) || null;
      res.json(await analyzePosition(req.params.symbol, position, account, bars));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Key status and trading mode ---
  app.get('/api/has-keys', (_req, res) => res.json(true));
  app.get('/api/has-claude-key', (_req, res) => res.json(true));
  app.get('/api/trading-mode', (_req, res) => res.json({ paper: client.isPaper }));

  // --- Agent API ---
  app.get('/api/agent/status', async (_req, res) => {
    try {
      const status = agentDaemon.getStatus();
      const [account, positions] = await Promise.all([client.getAccount(), client.getPositions()]);
      const tiers = agentStore.getTiers();
      const allocations = calculateTierAllocations(tiers, positions, parseFloat(account.portfolio_value), agentStore);
      res.json({
        ...status,
        tiers: allocations,
        total_trades: agentStore.getTotalTrades(),
        total_analyses: agentStore.getTotalAnalyses(),
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/agent/start', (_req, res) => {
    try {
      agentDaemon.start();
      agentStore.setConfig('auto_start', 'true');
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/agent/stop', (_req, res) => {
    try {
      agentDaemon.stop();
      agentStore.setConfig('auto_start', 'false');
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/agent/activity', (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const tierId = req.query.tier as TierId | undefined;
      res.json(agentStore.getActivity(limit, offset, tierId));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/agent/trades', (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const tierId = req.query.tier as TierId | undefined;
      const symbol = req.query.symbol as string | undefined;
      const decisions = agentStore.getRecentDecisions(limit, offset, tierId, symbol);
      // Join with analysis reasoning
      const enriched = decisions.map(d => {
        const analyses = agentStore.getRecentAnalyses(1000);
        const analysis = analyses.find(a => a.id === d.analysis_id);
        return {
          ...d,
          analysis_reasoning: analysis?.reasoning ?? null,
          analysis_confidence: analysis?.confidence ?? null,
          analysis_risks: analysis?.risks ?? [],
        };
      });
      res.json(enriched);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/agent/tiers', async (_req, res) => {
    try {
      const [account, positions] = await Promise.all([client.getAccount(), client.getPositions()]);
      const tiers = agentStore.getTiers();
      const allocations = calculateTierAllocations(tiers, positions, parseFloat(account.portfolio_value), agentStore);
      res.json(allocations);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/agent/analyses/:symbol', (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      res.json(agentStore.getAnalysesForSymbol(req.params.symbol, limit));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // --- Server startup ---
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Investing Agent API running on http://0.0.0.0:${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT} (via Vite proxy)`);
    console.log(`Agent: ${agentDaemon.isRunning() ? 'RUNNING' : 'stopped'}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('Shutting down...');
    agentDaemon.stop();
    agentStore.close();
    watchlist.close();
    server.close();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Run directly
startWebServer();
