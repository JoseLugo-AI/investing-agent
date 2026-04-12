/**
 * Position monitor — checks trailing stops every 5 minutes.
 * Zero Claude calls. Pure Alpaca API + math.
 *
 * For each position:
 * 1. Fetch current price from Alpaca
 * 2. Calculate trailing stop: highest high(22) - 3 * ATR(22)
 * 3. If price < trailing stop → sell immediately
 * 4. Also checks hard stop: entry - 2 * ATR(14)
 */

import type { AlpacaClient } from './alpaca-client';
import { isCrypto } from './alpaca-client';
import type { AgentStore } from './agent-store';
import { calculateATR } from './technical-indicators';
import { CRYPTO_ATR_STOP_MULTIPLIER } from '../shared/risk-constants';

const MONITOR_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface PositionMonitor {
  start(): void;
  stop(): void;
  isRunning(): boolean;
}

export function createPositionMonitor(
  alpaca: AlpacaClient,
  store: AgentStore
): PositionMonitor {
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let checking = false;

  // Track last effective stop per symbol to avoid redundant logs/orders
  const lastEffectiveStop = new Map<string, number>();
  // Track symbols with pending stop-sell orders to avoid duplicate submissions
  const pendingStopSells = new Set<string>();

  async function checkPositions(): Promise<void> {
    if (!running || checking) return;
    checking = true;

    try {
      const positions = await alpaca.getPositions();
      if (positions.length === 0) return;

      // Clean up tracking for positions we no longer hold
      const heldSymbols = new Set(positions.map(p => p.symbol));
      Array.from(lastEffectiveStop.keys()).forEach(sym => {
        if (!heldSymbols.has(sym)) {
          lastEffectiveStop.delete(sym);
          pendingStopSells.delete(sym);
        }
      });

      for (const pos of positions) {
        const symbol = pos.symbol;
        const currentPrice = parseFloat(pos.current_price);
        const entryPrice = parseFloat(pos.avg_entry_price);
        const qty = isCrypto(symbol) ? parseFloat(pos.qty) : parseInt(pos.qty, 10);
        const isCryptoAsset = isCrypto(symbol);

        if (qty <= 0 || currentPrice <= 0) continue;

        // Fetch bars for ATR calculation (crypto uses different endpoint)
        let bars;
        try {
          bars = isCryptoAsset
            ? await alpaca.getCryptoBars(symbol, '1Day', 30)
            : await alpaca.getBars(symbol, '1Day', 30);
        } catch {
          continue; // skip if can't get bars
        }

        if (bars.length < 15) continue;

        // Calculate ATR(14) for hard stop
        const atr14 = calculateATR(bars, 14);
        if (atr14 === null) continue;

        // ATR multiplier: crypto uses wider stops (3x) vs equity (2x)
        const atrMult = isCryptoAsset ? CRYPTO_ATR_STOP_MULTIPLIER : 2;

        // Hard stop: entry - atrMult * ATR(14)
        const hardStop = entryPrice - atrMult * atr14;

        // Trailing stop: highest high(22) - (atrMult+1) * ATR(22)
        const recent22 = bars.slice(-22);
        const highestHigh = Math.max(...recent22.map(b => b.h));
        const atr22 = calculateATR(bars, Math.min(22, bars.length - 1)) || atr14;
        const trailingStopMult = isCryptoAsset ? atrMult + 1 : 3; // crypto: 4x ATR trailing, equity: 3x
        const trailingStop = highestHigh - trailingStopMult * atr22;

        // Use the higher of the two stops (more protective)
        const effectiveStop = Math.max(hardStop, trailingStop);

        // Skip if effective stop hasn't changed (within 1 cent)
        const prevStop = lastEffectiveStop.get(symbol);
        if (prevStop !== undefined && Math.abs(effectiveStop - prevStop) < 0.01) {
          continue;
        }
        lastEffectiveStop.set(symbol, effectiveStop);

        if (currentPrice < effectiveStop) {
          // Skip if we already submitted a stop sell for this symbol
          if (pendingStopSells.has(symbol)) continue;

          // SELL — stop triggered
          const stopType = currentPrice < hardStop ? 'hard stop' : 'trailing stop';
          store.logActivity(
            'trade',
            `STOP SELL ${qty} ${symbol} @ ~$${currentPrice.toFixed(2)} (${stopType} at $${effectiveStop.toFixed(2)})`,
            null,
            symbol,
            JSON.stringify({ stopType, effectiveStop, hardStop, trailingStop, atr14, atr22 })
          );

          pendingStopSells.add(symbol);
          try {
            await alpaca.createOrder({
              symbol,
              qty,
              side: 'sell',
              type: 'market',
              time_in_force: isCryptoAsset ? 'gtc' : 'day',
            });
          } catch (err: any) {
            // Order failed — allow retry on next cycle
            pendingStopSells.delete(symbol);
            store.logActivity('error', `Stop sell failed for ${symbol}: ${err.message}`, null, symbol);
          }
        }
      }
    } catch (err: any) {
      // Don't spam the activity log — just log once if the whole check fails
      store.logActivity('error', `Position monitor check failed: ${err.message}`);
    } finally {
      checking = false;
    }
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      // Check immediately, then every 5 minutes
      checkPositions();
      timer = setInterval(checkPositions, MONITOR_INTERVAL_MS);
      store.logActivity('agent_start', 'Position monitor started (trailing stops every 5min)');
    },

    stop(): void {
      if (!running) return;
      running = false;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },

    isRunning(): boolean {
      return running;
    },
  };
}
