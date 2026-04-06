import type { AlpacaClient } from './alpaca-client';
import type { AgentStore } from './agent-store';
import type { TierId, TierConfig, TierAllocation, AgentAnalysisResult, ShortPosition } from '../shared/agent-types';
import { scanTier } from './agent-scanner';
import { buildAgentPrompt } from './agent-context-builder';
import { executeDecision, executeShortEntry, executeShortExit } from './agent-executor';
import { runClaude } from './run-claude';
import { parseAnalysisResponse } from './claude-analyzer';
import { checkDailyLoss, checkDrawdown, validateShortOrder } from './risk-engine';
import { calculateAllIndicators, calculateRSI, sma } from './technical-indicators';
import { detectRegime, type RegimeResult } from './regime-detector';
import { analyzeSentiment } from './sentiment-analyzer';
import { evaluateStrategy } from './strategy-engine';
import { createPositionMonitor } from './position-monitor';
import { screenShortEntry, checkShortExit, checkShortRiskLimits, calculateShortSize } from './short-engine';
import { MAX_SHORT_POSITION_PCT } from '../shared/risk-constants';

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
  // Extract ET time components directly using Intl formatter
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')!.value;
  if (weekday === 'Sat' || weekday === 'Sun') return false; // weekend

  const hours = parseInt(parts.find(p => p.type === 'hour')!.value, 10);
  const minutes = parseInt(parts.find(p => p.type === 'minute')!.value, 10);
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

  // Track open shorts in-memory (rebuilt from Alpaca positions on startup)
  const activeShorts = new Map<string, ShortPosition>();

  /**
   * Rebuild active shorts from Alpaca positions on startup.
   * Short positions have negative qty in Alpaca.
   */
  async function rebuildActiveShorts(): Promise<void> {
    const positions = await alpaca.getPositions();
    const decisions = store.getRecentDecisions(100);

    for (const pos of positions) {
      const qty = parseInt(pos.qty, 10);
      if (qty < 0) {
        const shortDecision = decisions.find(
          (d: any) => d.symbol === pos.symbol && d.action === 'short_sell' && d.order_id
        );
        activeShorts.set(pos.symbol, {
          symbol: pos.symbol,
          entryPrice: parseFloat(pos.avg_entry_price),
          qty: Math.abs(qty),
          entryDate: shortDecision?.created_at ?? new Date().toISOString(),
          orderId: shortDecision?.order_id ?? 'unknown',
          tierId: (shortDecision?.tier_id as TierId) ?? 'moderate',
        });
      }
    }

    if (activeShorts.size > 0) {
      store.logActivity('agent_start', `Rebuilt ${activeShorts.size} active short position(s)`);
    }
  }

  /**
   * Count trading days between two dates (weekdays only).
   */
  function countTradingDays(fromDate: string, toDate: Date): number {
    const from = new Date(fromDate);
    let count = 0;
    const current = new Date(from);
    while (current < toDate) {
      current.setDate(current.getDate() + 1);
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  }

  /**
   * Run short exit checks for all active shorts.
   */
  async function checkShortExits(regime: RegimeResult): Promise<void> {
    if (activeShorts.size === 0) return;

    const [account, positions] = await Promise.all([
      alpaca.getAccount(),
      alpaca.getPositions(),
    ]);

    const portfolioValue = parseFloat(account.portfolio_value);
    const tiers = store.getTiers();
    const allocations = calculateTierAllocations(tiers, positions, portfolioValue, store);

    for (const [symbol, short] of activeShorts) {
      try {
        const bars = await alpaca.getBars(symbol, '1Day', 30);
        if (bars.length < 5) continue;

        const closes = bars.map((b: any) => b.c);
        const rsi2Result = calculateRSI(closes, 2);
        const currentPrice = closes[closes.length - 1];
        const tradingDaysHeld = countTradingDays(short.entryDate, new Date());

        const exitCheck = checkShortExit(short, {
          currentPrice,
          rsi2: rsi2Result?.value ?? 50,
          regime: regime.regime,
          tradingDaysHeld,
        });

        if (exitCheck.shouldExit) {
          const tierAllocation = allocations.find(a => a.id === short.tierId)!;
          await executeShortExit(symbol, short.qty, currentPrice, exitCheck.reason!, short.tierId, {
            alpaca,
            store,
            account,
            positions,
            tierAllocation,
          });
          activeShorts.delete(symbol);
        }
      } catch (err: any) {
        store.logActivity('error', `Short exit check failed for ${symbol}: ${err.message}`, null, symbol);
      }
    }
  }

  /**
   * Scan for new short entry opportunities across conservative and moderate tiers.
   * Only runs when regime is BEAR or CRISIS.
   */
  async function scanForShorts(regime: RegimeResult): Promise<void> {
    if (regime.regime !== 'bear' && regime.regime !== 'crisis') return;

    const [account, positions] = await Promise.all([
      alpaca.getAccount(),
      alpaca.getPositions(),
    ]);

    const portfolioValue = parseFloat(account.portfolio_value);
    const shortingEnabled = store.getConfig('shorting_enabled') !== 'false';

    // Approximate loss tracking from cover decisions
    const recentDecisions = store.getRecentDecisions(200);
    const shortDecisions = recentDecisions.filter(
      (d: any) => d.action === 'short_sell' || d.action === 'cover'
    );

    let dailyShortLoss = 0;
    let weeklyShortLoss = 0;
    let monthlyShortLoss = 0;

    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now); monthStart.setDate(monthStart.getDate() - 30);

    for (const d of shortDecisions) {
      if (d.action !== 'cover' || !d.price) continue;
      const entry = shortDecisions.find(
        (e: any) => e.symbol === d.symbol && e.action === 'short_sell' && e.order_id && new Date(e.created_at) < new Date(d.created_at)
      );
      if (!entry || !entry.price || !d.qty) continue;

      const loss = (d.price - entry.price) * d.qty;
      if (loss <= 0) continue;

      const coverDate = new Date(d.created_at);
      if (coverDate >= dayStart) dailyShortLoss += loss;
      if (coverDate >= weekStart) weeklyShortLoss += loss;
      if (coverDate >= monthStart) monthlyShortLoss += loss;
    }

    const currentShortCount = activeShorts.size;
    const totalShortExposure = Array.from(activeShorts.values()).reduce(
      (sum, s) => sum + s.entryPrice * s.qty, 0
    );

    const riskLimits = checkShortRiskLimits({
      portfolioValue,
      currentShortCount,
      totalShortExposure,
      dailyShortLoss,
      weeklyShortLoss,
      monthlyShortLoss,
      shortingEnabled,
    });

    if (riskLimits.killSwitch) {
      store.setConfig('shorting_enabled', 'false');
      store.logActivity('short_kill', 'Monthly short loss kill switch triggered — shorting disabled');
      return;
    }

    if (!riskLimits.allowed) {
      store.logActivity('skip', `Short scan skipped: ${riskLimits.rejections[0]}`);
      return;
    }

    // Scan conservative and moderate tier symbols
    const shortableTiers = store.getTiers().filter(t => t.id !== 'aggressive');
    const scannedSymbols = new Set<string>();

    for (const tier of shortableTiers) {
      for (const symbol of tier.symbols) {
        if (scannedSymbols.has(symbol) || activeShorts.has(symbol)) continue;
        scannedSymbols.add(symbol);

        // Skip if we already have a long position
        const hasLong = positions.find((p: any) => p.symbol === symbol && parseInt(p.qty, 10) > 0);
        if (hasLong) continue;

        try {
          const bars = await alpaca.getBars(symbol, '1Day', 250);
          if (bars.length < 201) continue;

          const closes = bars.map((b: any) => b.c);
          const currentPrice = closes[closes.length - 1];

          const rsi2Result = calculateRSI(closes, 2);
          const technicals = calculateAllIndicators(bars, currentPrice, portfolioValue);
          const sma200 = sma(closes, 200);

          if (!rsi2Result || sma200 === null) continue;

          // Check easy to borrow
          let easyToBorrow = false;
          try {
            const asset = await alpaca.getAsset(symbol);
            easyToBorrow = asset.easy_to_borrow && asset.shortable;
          } catch {
            continue;
          }

          // Get sentiment (from cache or fresh)
          let sentiment;
          const cached = store.getCachedSentiment(symbol);
          if (cached) {
            sentiment = JSON.parse(cached);
          } else {
            await sleep(CLAUDE_CALL_DELAY_MS);
            sentiment = await analyzeSentiment(symbol, currentPrice);
            // Only cache successful parses — failed ones retry next scan
            if (!(sentiment as any)._parseFailed) {
              store.cacheSentiment(symbol, JSON.stringify(sentiment));
            }
          }

          // Screen for short entry
          const screen = screenShortEntry({
            regime: regime.regime,
            rsi2: rsi2Result.value,
            priceBelowSma200: currentPrice < sma200,
            macdHistogramDeclining: technicals.macd?.histogramRising === false,
            easyToBorrow,
            tierId: tier.id,
            sentimentScore: sentiment.score,
          });

          if (!screen.approved) continue;

          // Calculate size and validate
          const size = calculateShortSize(portfolioValue, currentPrice);
          if (size.qty <= 0) continue;

          const riskCheck = validateShortOrder(
            { symbol, qty: size.qty, side: 'sell', type: 'market', time_in_force: 'day' },
            account,
            positions,
            currentPrice
          );

          if (!riskCheck.allowed) {
            store.logActivity('skip', `Short risk blocked ${symbol}: ${riskCheck.errors[0]}`, tier.id, symbol);
            continue;
          }

          const finalQty = riskCheck.suggestedQty ?? size.qty;

          const analysisId = store.saveAnalysis({
            scanId: 0,
            tierId: tier.id,
            symbol,
            recommendation: 'sell',
            confidence: 'high',
            reasoning: `Short entry: RSI(2)=${rsi2Result.value.toFixed(1)}, price below SMA200, MACD declining, sentiment=${sentiment.score.toFixed(2)}`,
            risks: ['Short squeeze risk', 'Mean reversion may not occur in time'],
            targetAllocationPct: MAX_SHORT_POSITION_PCT,
            urgency: 'high',
            rawResponse: '',
          });

          store.logActivity('analysis', `${symbol}: SHORT candidate (RSI2=${rsi2Result.value.toFixed(1)}, sent=${sentiment.score.toFixed(2)})`, tier.id, symbol);

          const freshPositions = await alpaca.getPositions();
          const freshAccount = await alpaca.getAccount();
          const freshAllocations = calculateTierAllocations(store.getTiers(), freshPositions, parseFloat(freshAccount.portfolio_value), store);
          const tierAllocation = freshAllocations.find(a => a.id === tier.id)!;

          const result = await executeShortEntry(symbol, finalQty, currentPrice, tier.id, analysisId, {
            alpaca,
            store,
            account: freshAccount,
            positions: freshPositions,
            tierAllocation,
          });

          if (result.orderId) {
            activeShorts.set(symbol, {
              symbol,
              entryPrice: currentPrice,
              qty: finalQty,
              entryDate: new Date().toISOString(),
              orderId: result.orderId,
              tierId: tier.id,
            });
          }
        } catch (err: any) {
          store.logActivity('error', `Short scan failed for ${symbol}: ${err.message}`, tier.id, symbol);
        }
      }
    }
  }

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
            // Only cache successful parses — failed ones retry next scan
            if (!(sentiment as any)._parseFailed) {
              store.cacheSentiment(candidate.symbol, JSON.stringify(sentiment));
            }
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

      // Check short exits on every scan cycle
      await checkShortExits(regime);

      // Scan for new shorts (only in bear/crisis)
      await scanForShorts(regime);

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

      // Rebuild active shorts from Alpaca positions
      rebuildActiveShorts().catch(err => {
        store.logActivity('error', `Failed to rebuild active shorts: ${err.message}`);
      });

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
