import type { AlpacaClient } from './alpaca-client';
import type { AgentStore } from './agent-store';
import type { TierId, TierConfig, TierAllocation, AgentAnalysisResult } from '../shared/agent-types';
import { scanTier } from './agent-scanner';
import { buildAgentPrompt } from './agent-context-builder';
import { executeDecision } from './agent-executor';
import { runClaude } from './run-claude';
import { parseAnalysisResponse } from './claude-analyzer';
import { checkDailyLoss, checkDrawdown } from './risk-engine';
import { calculateAllIndicators } from './technical-indicators';
import { detectRegime, type RegimeResult } from './regime-detector';
import { analyzeSentiment } from './sentiment-analyzer';
import { evaluateStrategy } from './strategy-engine';
import { createPositionMonitor } from './position-monitor';

export interface AgentDaemon {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  getStatus(): {
    running: boolean;
    startedAt: string | null;
    nextScans: { tier_id: TierId; at: string }[];
  };
}

const CLAUDE_CALL_DELAY_MS = 2000;

/**
 * Check if US stock market is currently open.
 * Market hours: 9:30 AM - 4:00 PM ET, Monday-Friday.
 */
export function isMarketOpen(now: Date = new Date()): boolean {
  // Convert to ET
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etStr);

  const day = et.getDay();
  if (day === 0 || day === 6) return false; // weekend

  const hours = et.getHours();
  const minutes = et.getMinutes();
  const timeMinutes = hours * 60 + minutes;

  // 9:30 AM = 570 min, 4:00 PM = 960 min
  return timeMinutes >= 570 && timeMinutes < 960;
}

/**
 * Calculate tier allocations from current positions.
 */
export function calculateTierAllocations(
  tiers: TierConfig[],
  positions: any[],
  portfolioValue: number,
  store: AgentStore
): TierAllocation[] {
  // Map positions to tiers based on decision history
  const positionTierMap = new Map<string, TierId>();
  for (const tier of tiers) {
    // Check recent decisions to see which tier owns each position
    const decisions = store.getRecentDecisions(100, 0, tier.id);
    for (const d of decisions) {
      if (d.action === 'buy' && d.order_id) {
        positionTierMap.set(d.symbol, tier.id);
      }
      if (d.action === 'sell' && d.order_id) {
        positionTierMap.delete(d.symbol);
      }
    }
  }

  // For positions not in decision history (manual trades or pre-existing),
  // assign based on which tier's universe they belong to
  for (const pos of positions) {
    if (!positionTierMap.has(pos.symbol)) {
      for (const tier of tiers) {
        if (tier.symbols.includes(pos.symbol)) {
          positionTierMap.set(pos.symbol, tier.id);
          break;
        }
      }
    }
  }

  return tiers.map(tier => {
    const tierPositions = positions.filter((p: any) => positionTierMap.get(p.symbol) === tier.id);
    const currentValue = tierPositions.reduce((sum: number, p: any) => sum + parseFloat(p.market_value || '0'), 0);
    const targetValue = portfolioValue * tier.target_pct;

    return {
      id: tier.id,
      label: tier.label,
      target_pct: tier.target_pct,
      target_value: targetValue,
      current_value: currentValue,
      available: Math.max(0, targetValue - currentValue),
      position_count: tierPositions.length,
    };
  });
}

export function createAgentDaemon(
  alpaca: AlpacaClient,
  store: AgentStore
): AgentDaemon {
  const timers = new Map<TierId, NodeJS.Timeout>();
  let running = false;
  let startedAt: string | null = null;
  const scanningTiers = new Set<TierId>(); // per-tier scan lock
  const nextScanTimes = new Map<TierId, Date>();
  const positionMonitor = createPositionMonitor(alpaca, store);

  async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run one scan cycle for a tier.
   * Initial scans always run (orders queue for market open).
   * Recurring scans only run during market hours.
   */
  async function runScanCycle(tier: TierConfig, isInitial = false): Promise<void> {
    if (!running || scanningTiers.has(tier.id)) return;

    // Recurring scans check market hours; initial scans always run
    if (!isInitial && !isMarketOpen()) {
      store.logActivity('skip', `Market closed — skipping ${tier.label} scan`, tier.id);
      return;
    }

    // Check risk status
    try {
      const account = await alpaca.getAccount();
      const daily = checkDailyLoss(account);
      if (daily.halted) {
        store.logActivity('skip', `Daily loss halt (${daily.lossPercent.toFixed(1)}%) — skipping ${tier.label} scan`, tier.id);
        return;
      }
      const peakEquity = Math.max(parseFloat(account.equity), parseFloat(account.last_equity));
      const dd = checkDrawdown(peakEquity, parseFloat(account.equity));
      if (dd.level === 'kill') {
        store.logActivity('skip', `Max drawdown kill switch — skipping ${tier.label} scan`, tier.id);
        return;
      }
    } catch (err: any) {
      store.logActivity('error', `Failed to check risk status: ${err.message}`, tier.id);
      return;
    }

    scanningTiers.add(tier.id);
    const scanId = store.startScan(tier.id);
    store.logActivity('scan_start', `Starting ${tier.label} tier scan`, tier.id);

    try {
      const [account, positions] = await Promise.all([
        alpaca.getAccount(),
        alpaca.getPositions(),
      ]);

      const portfolioValue = parseFloat(account.portfolio_value);
      const tiers = store.getTiers();
      const allocations = calculateTierAllocations(tiers, positions, portfolioValue, store);
      const tierAllocation = allocations.find(a => a.id === tier.id)!;

      // Detect market regime using broad market index (VOO)
      let regime: RegimeResult;
      try {
        const marketBars = await alpaca.getBars('VOO', '1Day', 250);
        regime = detectRegime(marketBars);
        store.logActivity('analysis', `Regime: ${regime.regime.toUpperCase()} (${regime.confidence}) — ${regime.strategy}`, tier.id);
      } catch {
        regime = { regime: 'sideways', confidence: 'low', description: 'Could not detect regime', positionSizeMultiplier: 0.6, stopMultiplier: 1.2, strategy: 'mean_reversion' };
      }

      // Scan for candidates
      const scanResult = await scanTier(tier, alpaca, positions);
      const allSymbols = [...scanResult.existingPositions, ...scanResult.candidates];

      let opportunities = 0;

      // Analyze each symbol with full strategy engine
      for (const candidate of allSymbols) {
        if (!running) break;

        const position = positions.find((p: any) => p.symbol === candidate.symbol) || null;
        const previousAnalyses = store.getAnalysesForSymbol(candidate.symbol, 5);
        const recentTierTrades = store.getRecentDecisions(10, 0, tier.id);

        const daily = checkDailyLoss(account);
        const peakEquity = Math.max(parseFloat(account.equity), parseFloat(account.last_equity));
        const dd = checkDrawdown(peakEquity, parseFloat(account.equity));

        try {
          // 1. Calculate technical indicators (zero tokens — pure math)
          const technicals = calculateAllIndicators(candidate.bars, candidate.currentPrice, portfolioValue);

          // 2. Get sentiment — check cache first (2-hour TTL)
          let sentiment;
          const cached = store.getCachedSentiment(candidate.symbol);
          if (cached) {
            sentiment = JSON.parse(cached);
          } else {
            await sleep(CLAUDE_CALL_DELAY_MS);
            sentiment = await analyzeSentiment(candidate.symbol, candidate.currentPrice);
            store.cacheSentiment(candidate.symbol, JSON.stringify(sentiment));
          }

          // 3. Run strategy engine (zero tokens — pure math)
          const strategySignal = evaluateStrategy({
            hasPosition: position !== null,
            technicals,
            sentiment,
            regime,
            currentPrice: candidate.currentPrice,
            accountValue: portfolioValue,
          });

          // 4. Skip Claude call if technicals are flat and no position
          //    Score between -15 and +15 with no position = nothing interesting
          if (!position && strategySignal.score > -15 && strategySignal.score < 15) {
            store.logActivity('skip', `${candidate.symbol}: flat signal (score=${strategySignal.score.toFixed(0)}) — skipping Claude call`, tier.id, candidate.symbol);
            continue;
          }

          // 5. Build context-rich prompt with all signals for Claude's final decision
          await sleep(CLAUDE_CALL_DELAY_MS);
          const prompt = buildAgentPrompt({
            symbol: candidate.symbol,
            tier,
            tierAllocation,
            position,
            account,
            allPositions: positions,
            recentBars: candidate.bars,
            previousAnalyses,
            recentTierTrades,
            riskStatus: { dailyLossPercent: daily.lossPercent, drawdownLevel: dd.level },
            strategySignal,
            sentiment,
            regime,
          });

          const rawResponse = await runClaude(prompt);
          const analysis = parseAnalysisResponse(rawResponse) as AgentAnalysisResult;

          // Override position size with strategy engine's ATR-based sizing
          if (strategySignal.atrShares !== null && analysis.recommendation === 'buy') {
            analysis.target_allocation_pct = strategySignal.positionSizePct;
          }

          // Save analysis
          const analysisId = store.saveAnalysis({
            scanId,
            tierId: tier.id,
            symbol: candidate.symbol,
            recommendation: analysis.recommendation,
            confidence: analysis.confidence,
            reasoning: analysis.reasoning,
            risks: analysis.risks,
            targetAllocationPct: analysis.target_allocation_pct ?? null,
            urgency: analysis.urgency ?? null,
            rawResponse,
          });

          const signalStr = `score=${strategySignal.score.toFixed(0)} sent=${sentiment.score.toFixed(2)}`;
          store.logActivity('analysis', `${candidate.symbol}: ${analysis.recommendation.toUpperCase()} (${analysis.confidence}) [${signalStr}]`, tier.id, candidate.symbol);

          if (analysis.recommendation !== 'hold') {
            opportunities++;
          }

          // Execute decision — refresh allocations after each trade
          const freshPositions = await alpaca.getPositions();
          const freshAccount = await alpaca.getAccount();
          const freshAllocations = calculateTierAllocations(tiers, freshPositions, parseFloat(freshAccount.portfolio_value), store);
          const freshTierAlloc = freshAllocations.find(a => a.id === tier.id)!;

          await executeDecision(analysisId, tier.id, candidate.symbol, analysis, candidate.currentPrice, {
            alpaca,
            store,
            account: freshAccount,
            positions: freshPositions,
            tierAllocation: freshTierAlloc,
          });

        } catch (err: any) {
          store.logActivity('error', `Analysis failed for ${candidate.symbol}: ${err.message}`, tier.id, candidate.symbol);
        }
      }

      store.completeScan(scanId, allSymbols.length, opportunities);
      store.logActivity('scan_complete', `${tier.label} scan complete: ${allSymbols.length} symbols, ${opportunities} opportunities`, tier.id);

    } catch (err: any) {
      store.failScan(scanId, err.message);
      store.logActivity('error', `${tier.label} scan failed: ${err.message}`, tier.id);
    } finally {
      scanningTiers.delete(tier.id);
    }
  }

  function scheduleNextScan(tier: TierConfig): void {
    if (!running) return;

    const intervalMs = tier.scan_interval_min * 60 * 1000;
    const nextTime = new Date(Date.now() + intervalMs);
    nextScanTimes.set(tier.id, nextTime);

    const timer = setTimeout(async () => {
      await runScanCycle(tier);
      if (running) scheduleNextScan(tier); // reschedule
    }, intervalMs);

    timers.set(tier.id, timer);
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      startedAt = new Date().toISOString();

      store.setConfig('enabled', 'true');
      store.logActivity('agent_start', 'Trading agent started');

      // Start position monitor (trailing stops every 5 min, zero tokens)
      positionMonitor.start();

      const tiers = store.getTiers();

      // Run initial scan for tiers that haven't scanned today, then schedule recurring
      for (const tier of tiers) {
        const alreadyScanned = store.hasCompletedScanToday(tier.id);
        if (alreadyScanned) {
          store.logActivity('skip', `${tier.label} already scanned today — scheduling next cycle`, tier.id);
          scheduleNextScan(tier);
          continue;
        }
        // Stagger initial scans by 5 seconds per tier
        const delay = tiers.indexOf(tier) * 5000;
        setTimeout(async () => {
          if (!running) return;
          await runScanCycle(tier, true);
          if (running) scheduleNextScan(tier);
        }, delay);
      }
    },

    stop(): void {
      if (!running) return;
      running = false;
      startedAt = null;

      for (const [, timer] of timers) {
        clearTimeout(timer);
      }
      timers.clear();
      nextScanTimes.clear();
      positionMonitor.stop();

      store.setConfig('enabled', 'false');
      store.logActivity('agent_stop', 'Trading agent stopped');
    },

    isRunning(): boolean {
      return running;
    },

    getStatus() {
      const nextScans: { tier_id: TierId; at: string }[] = [];
      for (const [tierId, time] of nextScanTimes) {
        nextScans.push({ tier_id: tierId, at: time.toISOString() });
      }

      return {
        running,
        startedAt,
        nextScans,
      };
    },
  };
}
