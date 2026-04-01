/**
 * Market regime detection using technical signals.
 * Determines if the market is in bull, bear, or sideways mode,
 * and adjusts strategy parameters accordingly.
 */

import { sma, calculateATR } from './technical-indicators';

export type MarketRegime = 'bull' | 'bear' | 'sideways' | 'crisis';

export interface RegimeResult {
  regime: MarketRegime;
  confidence: 'high' | 'medium' | 'low';
  description: string;
  positionSizeMultiplier: number;  // 1.0 = normal, 0.5 = half, 0 = no new longs
  stopMultiplier: number;          // 1.0 = normal, 1.5 = wider stops
  strategy: 'momentum' | 'mean_reversion' | 'defensive' | 'cash';
}

interface Bar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/**
 * Detect market regime from a broad market index (e.g., SPY/VOO bars).
 *
 * Uses:
 * 1. Price vs 200 SMA (bull/bear)
 * 2. 50 SMA vs 200 SMA (golden/death cross)
 * 3. ATR(14) vs ATR(50) ratio (volatility regime)
 * 4. Recent drawdown from high (crisis detection)
 */
export function detectRegime(bars: Bar[]): RegimeResult {
  const closes = bars.map(b => b.c);
  const currentPrice = closes[closes.length - 1];

  // Moving averages
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const sma20 = sma(closes, 20);

  // ATR-based volatility
  const atr14 = calculateATR(bars, 14);
  const atr50 = bars.length >= 51 ? calculateATR(bars, 50) : atr14;
  const volatilityRatio = atr14 && atr50 && atr50 > 0 ? atr14 / atr50 : 1;

  // Recent drawdown from 22-day high
  const recentHighs = closes.slice(-22);
  const highestRecent = Math.max(...recentHighs);
  const drawdownPct = ((currentPrice - highestRecent) / highestRecent) * 100;

  // Score each regime signal
  let bullScore = 0;
  let bearScore = 0;

  // Price vs 200 SMA
  if (sma200 !== null) {
    if (currentPrice > sma200) bullScore += 2;
    else bearScore += 2;
  }

  // Golden cross / death cross
  if (sma50 !== null && sma200 !== null) {
    if (sma50 > sma200) bullScore += 2;
    else bearScore += 2;
  }

  // Price vs 50 SMA (short-term trend)
  if (sma50 !== null) {
    if (currentPrice > sma50) bullScore += 1;
    else bearScore += 1;
  }

  // Price vs 20 SMA (very short-term)
  if (sma20 !== null) {
    if (currentPrice > sma20) bullScore += 1;
    else bearScore += 1;
  }

  // Crisis detection: sharp drawdown
  if (drawdownPct < -10) {
    return {
      regime: 'crisis',
      confidence: 'high',
      description: `Sharp drawdown of ${drawdownPct.toFixed(1)}% from recent high. Risk-off mode.`,
      positionSizeMultiplier: 0,
      stopMultiplier: 1.0,
      strategy: 'cash',
    };
  }

  if (drawdownPct < -5) {
    bearScore += 2;
  }

  // Determine regime
  const totalScore = bullScore + bearScore;
  const bullPct = totalScore > 0 ? bullScore / totalScore : 0.5;

  let regime: MarketRegime;
  let confidence: 'high' | 'medium' | 'low';
  let description: string;
  let positionSizeMultiplier: number;
  let stopMultiplier: number;
  let strategy: RegimeResult['strategy'];

  if (bullPct >= 0.7) {
    regime = 'bull';
    confidence = bullPct >= 0.85 ? 'high' : 'medium';
    description = `Bull market: price above key moving averages, uptrend confirmed.`;
    positionSizeMultiplier = 1.0;
    stopMultiplier = 1.0;
    strategy = 'momentum';
  } else if (bullPct <= 0.3) {
    regime = 'bear';
    confidence = bullPct <= 0.15 ? 'high' : 'medium';
    description = `Bear market: price below key moving averages, downtrend confirmed.`;
    positionSizeMultiplier = 0.3;
    stopMultiplier = 1.5;
    strategy = 'defensive';
  } else {
    regime = 'sideways';
    confidence = 'medium';
    description = `Sideways/mixed market: conflicting signals across timeframes.`;
    positionSizeMultiplier = 0.6;
    stopMultiplier = 1.2;
    strategy = 'mean_reversion';
  }

  // Adjust for elevated volatility
  if (volatilityRatio > 1.5) {
    positionSizeMultiplier *= 0.7;
    stopMultiplier *= 1.2;
    description += ` Elevated volatility (ATR ratio ${volatilityRatio.toFixed(1)}x).`;
  }

  return { regime, confidence, description, positionSizeMultiplier, stopMultiplier, strategy };
}

/**
 * Format regime info for inclusion in Claude prompts.
 */
export function formatRegimeForPrompt(regime: RegimeResult): string {
  return `=== MARKET REGIME ===
Regime: ${regime.regime.toUpperCase()} (${regime.confidence} confidence)
${regime.description}
Recommended strategy: ${regime.strategy}
Position size adjustment: ${(regime.positionSizeMultiplier * 100).toFixed(0)}% of normal
Stop distance adjustment: ${(regime.stopMultiplier * 100).toFixed(0)}% of normal`;
}
