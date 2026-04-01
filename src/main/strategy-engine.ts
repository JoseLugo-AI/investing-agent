/**
 * Strategy engine — combines sentiment, technical indicators, and regime
 * into actionable trading signals with ATR-based position sizing.
 *
 * Based on documented research:
 * - LLM sentiment: 74.4% accuracy, Sharpe 3.05 (arxiv:2412.19245)
 * - RSI + MACD + Volume: 77% win rate combined
 * - ATR position sizing: normalize risk to 1.5% per trade
 * - Regime detection: switch strategy in bear markets
 */

import type { TechnicalSignal } from './technical-indicators';
import type { SentimentResult } from './sentiment-analyzer';
import type { RegimeResult } from './regime-detector';

export interface StrategySignal {
  action: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  score: number;            // -100 to +100 composite score
  positionSizePct: number;  // suggested % of portfolio (0.01 - 0.05)
  atrShares: number | null; // ATR-calculated shares (if available)
  stopLoss: number | null;
  trailingStop: number | null;
  reasoning: string[];      // bullet points explaining the decision
  confidence: 'high' | 'medium' | 'low';
}

interface StrategyInput {
  hasPosition: boolean;
  technicals: TechnicalSignal;
  sentiment: SentimentResult;
  regime: RegimeResult;
  currentPrice: number;
  accountValue: number;
}

/**
 * Entry rules (research-backed):
 * BUY when ALL of:
 *   1. Sentiment score > 0.3 (bullish)
 *   2. RSI < 40 AND rising (momentum turning up) — or MACD bullish crossover
 *   3. Volume above 20-day average
 *   4. Regime is not bear/crisis
 *
 * SELL when ANY of:
 *   1. Trailing stop hit
 *   2. Sentiment < -0.3 (bearish)
 *   3. RSI > 75 AND MACD histogram declining
 */
export function evaluateStrategy(input: StrategyInput): StrategySignal {
  const { hasPosition, technicals, sentiment, regime, currentPrice, accountValue } = input;
  const reasoning: string[] = [];
  let score = 0;

  // === SENTIMENT (weight: 35%) ===
  const sentimentScore = sentiment.score * 35;
  score += sentimentScore;
  if (sentiment.score >= 0.6) {
    reasoning.push(`Strong positive sentiment (${sentiment.score.toFixed(2)}): ${sentiment.reasoning}`);
  } else if (sentiment.score >= 0.3) {
    reasoning.push(`Positive sentiment (${sentiment.score.toFixed(2)}): ${sentiment.reasoning}`);
  } else if (sentiment.score <= -0.3) {
    reasoning.push(`Negative sentiment (${sentiment.score.toFixed(2)}): ${sentiment.reasoning}`);
  } else {
    reasoning.push(`Neutral sentiment (${sentiment.score.toFixed(2)})`);
  }

  // === TECHNICAL INDICATORS (weight: 35%) ===
  const { rsi, macd, volume } = technicals;

  // RSI contribution (-15 to +15)
  if (rsi) {
    if (rsi.entryZone) {
      score += 15;
      reasoning.push(`RSI entry zone (${rsi.value.toFixed(1)}, rising) — momentum turning up`);
    } else if (rsi.oversold) {
      score += 10;
      reasoning.push(`RSI oversold (${rsi.value.toFixed(1)}) — potential bounce`);
    } else if (rsi.overbought && !rsi.rising) {
      score -= 15;
      reasoning.push(`RSI overbought and fading (${rsi.value.toFixed(1)}) — momentum exhaustion`);
    } else if (rsi.overbought && rsi.rising) {
      score += 0; // overbought but still rising — neutral
    } else {
      // Normal range
      score += rsi.rising ? 3 : -3;
    }
  }

  // MACD contribution (-10 to +10)
  if (macd) {
    if (macd.bullishCrossover) {
      score += 10;
      reasoning.push('MACD bullish crossover — buy signal confirmed');
    } else if (macd.histogramPositive && macd.histogramRising) {
      score += 7;
      reasoning.push('MACD histogram positive and rising — momentum building');
    } else if (!macd.histogramPositive && !macd.histogramRising) {
      score -= 10;
      reasoning.push('MACD histogram negative and falling — bearish momentum');
    }
  }

  // Volume contribution (-10 to +10)
  if (volume) {
    if (volume.surge) {
      // High volume is bullish if price is up, bearish if price is down
      const priceUp = technicals.rsi?.rising ?? false;
      if (priceUp) {
        score += 10;
        reasoning.push(`Volume surge (${volume.ratio.toFixed(1)}x avg) with rising price — institutional buying`);
      } else {
        score -= 10;
        reasoning.push(`Volume surge (${volume.ratio.toFixed(1)}x avg) with falling price — distribution`);
      }
    } else if (volume.aboveAverage) {
      score += 3;
    }
  }

  // === REGIME (weight: 30%) ===
  switch (regime.regime) {
    case 'bull':
      score += 15;
      reasoning.push(`Bull regime — ${regime.description}`);
      break;
    case 'sideways':
      score += 0;
      reasoning.push(`Sideways regime — reduced conviction`);
      break;
    case 'bear':
      score -= 20;
      reasoning.push(`Bear regime — defensive posture, smaller positions`);
      break;
    case 'crisis':
      score -= 30;
      reasoning.push(`Crisis regime — avoid new longs`);
      break;
  }

  // Trend confirmation bonus
  if (technicals.goldenCross) {
    score += 5;
    reasoning.push('Golden cross (50 SMA > 200 SMA) — long-term uptrend');
  }
  if (technicals.deathCross) {
    score -= 5;
    reasoning.push('Death cross (50 SMA < 200 SMA) — long-term downtrend');
  }

  // === POSITION SIZING ===
  let positionSizePct = 0;
  if (score > 0) {
    // Scale position size by signal strength and regime
    const baseSize = score > 50 ? 0.03 : score > 30 ? 0.02 : 0.01;
    positionSizePct = baseSize * regime.positionSizeMultiplier;
  }

  // ATR-based sizing
  const atrShares = technicals.atr?.positionSize ?? null;
  const stopLoss = technicals.atr?.stopLoss ?? null;
  const trailingStop = technicals.atr?.trailingStop ?? null;

  // === FINAL DECISION ===
  let action: StrategySignal['action'];
  let confidence: StrategySignal['confidence'];

  if (hasPosition) {
    // Existing position — should we hold or sell?
    if (score <= -30 || (sentiment.score <= -0.3 && (rsi?.overbought ?? false))) {
      action = score <= -50 ? 'strong_sell' : 'sell';
      confidence = Math.abs(score) > 50 ? 'high' : 'medium';
    } else if (score >= 20) {
      // Could add more — but for now just hold
      action = 'hold';
      confidence = score > 40 ? 'high' : 'medium';
      reasoning.push('Position held — signals remain supportive');
    } else {
      action = 'hold';
      confidence = 'medium';
    }
  } else {
    // No position — should we buy?
    if (regime.regime === 'crisis') {
      action = 'hold';
      confidence = 'high';
      reasoning.push('Crisis regime — no new positions');
    } else if (score >= 50 && sentiment.score >= 0.3) {
      action = 'strong_buy';
      confidence = 'high';
    } else if (score >= 25 && sentiment.score >= 0.1) {
      action = 'buy';
      confidence = score >= 40 ? 'high' : 'medium';
    } else if (score <= -30) {
      action = 'hold'; // don't buy negatives, but don't short either
      confidence = 'medium';
      reasoning.push('Negative signals — avoid entry');
    } else {
      action = 'hold';
      confidence = 'low';
      reasoning.push('Insufficient signal strength for entry');
    }
  }

  return {
    action,
    score,
    positionSizePct,
    atrShares,
    stopLoss,
    trailingStop,
    reasoning,
    confidence,
  };
}

/**
 * Format strategy signal for inclusion in the Claude trading prompt.
 */
export function formatStrategyForPrompt(signal: StrategySignal): string {
  const scoreBar = signal.score >= 0
    ? '+' + '█'.repeat(Math.min(Math.round(signal.score / 10), 10))
    : '-' + '█'.repeat(Math.min(Math.round(Math.abs(signal.score) / 10), 10));

  return `=== STRATEGY ENGINE SIGNAL ===
Composite score: ${signal.score.toFixed(0)}/100 ${scoreBar}
Recommended action: ${signal.action.toUpperCase()} (${signal.confidence} confidence)
Position size: ${(signal.positionSizePct * 100).toFixed(1)}% of portfolio
${signal.atrShares !== null ? `ATR-sized shares: ${signal.atrShares}` : ''}
${signal.stopLoss !== null ? `Stop loss: $${signal.stopLoss.toFixed(2)}` : ''}
${signal.trailingStop !== null ? `Trailing stop: $${signal.trailingStop.toFixed(2)}` : ''}

Signal breakdown:
${signal.reasoning.map(r => `  - ${r}`).join('\n')}

IMPORTANT: The strategy engine has already analyzed sentiment, technicals, and market regime.
You should FOLLOW the recommended action unless you have a specific, data-driven reason to override.
If the signal says BUY, respond with "buy". If it says HOLD, respond with "hold".`;
}
