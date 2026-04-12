/**
 * Crypto strategy engine — lazy accumulation based on Fear & Greed + regime + sentiment.
 *
 * Research basis:
 * - Fear & Greed DCA: 1,145% over 7 years (2018-2025), beats buy-and-hold by 99pp
 * - LLM sentiment edge: signal fusion, not price prediction (CryptoTrade, EMNLP 2024)
 * - 95% of active crypto bots lose money within 90 days — fewer trades = better results
 *
 * Core logic: buy fear, hold conviction, trim greed. Daily timeframe.
 */

import type { FearGreedResult } from './fear-greed';
import type { RegimeResult } from './regime-detector';
import type { SentimentResult } from './sentiment-analyzer';
import {
  FNG_EXTREME_FEAR,
  FNG_FEAR,
  FNG_GREED,
  FNG_EXTREME_GREED,
  CRYPTO_DCA_CHUNK_PCT,
  CRYPTO_EXTREME_FEAR_CHUNK_PCT,
  CRYPTO_GREED_TRIM_PCT,
  BTC_DOMINANCE_ALT_THRESHOLD,
} from '../shared/risk-constants';

export type CryptoAction = 'dca_buy' | 'hold' | 'trim' | 'cash';

export interface CryptoStrategySignal {
  action: CryptoAction;
  symbol: 'BTC/USD' | 'ETH/USD';
  sizePct: number;        // % of crypto budget to deploy
  reasoning: string[];
  confidence: 'high' | 'medium' | 'low';
  fearGreedValue: number;
  regimeLabel: string;
  sentimentScore: number;
}

export interface CryptoStrategyInput {
  fearGreed: FearGreedResult;
  regime: RegimeResult;
  sentiment: SentimentResult;
  btcDominanceApprox: number; // BTC market share approximation (0-1)
  hasBtcPosition: boolean;
  hasEthPosition: boolean;
  btcPositionValue: number;
  ethPositionValue: number;
  cryptoBudget: number;       // total available crypto allocation
}

export function evaluateCryptoStrategy(input: CryptoStrategyInput): CryptoStrategySignal[] {
  const {
    fearGreed, regime, sentiment,
    btcDominanceApprox, hasBtcPosition, hasEthPosition,
    btcPositionValue, ethPositionValue, cryptoBudget,
  } = input;

  const signals: CryptoStrategySignal[] = [];
  const fng = fearGreed.value;
  const reasoning: string[] = [];

  reasoning.push(`Fear & Greed: ${fng} (${fearGreed.label})`);
  reasoning.push(`Regime: ${regime.regime.toUpperCase()} (${regime.confidence})`);
  reasoning.push(`Sentiment: ${sentiment.score.toFixed(2)} (${sentiment.label})`);
  reasoning.push(`BTC dominance approx: ${(btcDominanceApprox * 100).toFixed(0)}%`);

  // === CRISIS: Move to cash ===
  if (regime.regime === 'crisis') {
    reasoning.push('CRISIS regime detected — no new buys, preserve capital');
    signals.push({
      action: 'cash',
      symbol: 'BTC/USD',
      sizePct: 0,
      reasoning: [...reasoning],
      confidence: 'high',
      fearGreedValue: fng,
      regimeLabel: regime.regime,
      sentimentScore: sentiment.score,
    });
    return signals;
  }

  // === EXTREME GREED: Trim positions ===
  if (fng >= FNG_EXTREME_GREED) {
    reasoning.push(`Extreme greed (${fng}) — trimming positions`);

    if (hasBtcPosition) {
      signals.push({
        action: 'trim',
        symbol: 'BTC/USD',
        sizePct: CRYPTO_GREED_TRIM_PCT,
        reasoning: [...reasoning, `Trim ${(CRYPTO_GREED_TRIM_PCT * 100).toFixed(0)}% of BTC position`],
        confidence: 'high',
        fearGreedValue: fng,
        regimeLabel: regime.regime,
        sentimentScore: sentiment.score,
      });
    }
    if (hasEthPosition) {
      signals.push({
        action: 'trim',
        symbol: 'ETH/USD',
        sizePct: CRYPTO_GREED_TRIM_PCT,
        reasoning: [...reasoning, `Trim ${(CRYPTO_GREED_TRIM_PCT * 100).toFixed(0)}% of ETH position`],
        confidence: 'high',
        fearGreedValue: fng,
        regimeLabel: regime.regime,
        sentimentScore: sentiment.score,
      });
    }
    if (signals.length === 0) {
      signals.push({
        action: 'hold',
        symbol: 'BTC/USD',
        sizePct: 0,
        reasoning: [...reasoning, 'No positions to trim'],
        confidence: 'medium',
        fearGreedValue: fng,
        regimeLabel: regime.regime,
        sentimentScore: sentiment.score,
      });
    }
    return signals;
  }

  // === GREED: Pause buying ===
  if (fng >= FNG_GREED) {
    reasoning.push(`Greed zone (${fng}) — pausing buys, holding positions`);
    signals.push({
      action: 'hold',
      symbol: 'BTC/USD',
      sizePct: 0,
      reasoning: [...reasoning],
      confidence: 'high',
      fearGreedValue: fng,
      regimeLabel: regime.regime,
      sentimentScore: sentiment.score,
    });
    return signals;
  }

  // === EXTREME FEAR: Large DCA buy ===
  if (fng <= FNG_EXTREME_FEAR) {
    // Sentiment doesn't need to confirm — extreme fear is the signal
    // But negative sentiment makes us even more confident (contrarian)
    const chunk = CRYPTO_EXTREME_FEAR_CHUNK_PCT;
    reasoning.push(`Extreme fear (${fng}) — large DCA buy (${(chunk * 100).toFixed(0)}% of budget)`);

    // BTC always
    signals.push({
      action: 'dca_buy',
      symbol: 'BTC/USD',
      sizePct: btcDominanceApprox >= BTC_DOMINANCE_ALT_THRESHOLD ? chunk : chunk * 0.7,
      reasoning: [...reasoning, 'BTC is the primary accumulation target'],
      confidence: 'high',
      fearGreedValue: fng,
      regimeLabel: regime.regime,
      sentimentScore: sentiment.score,
    });

    // ETH only if BTC dominance is below threshold
    if (btcDominanceApprox < BTC_DOMINANCE_ALT_THRESHOLD) {
      signals.push({
        action: 'dca_buy',
        symbol: 'ETH/USD',
        sizePct: chunk * 0.3,
        reasoning: [...reasoning, `BTC dominance ${(btcDominanceApprox * 100).toFixed(0)}% < ${(BTC_DOMINANCE_ALT_THRESHOLD * 100).toFixed(0)}% — adding ETH`],
        confidence: 'medium',
        fearGreedValue: fng,
        regimeLabel: regime.regime,
        sentimentScore: sentiment.score,
      });
    }
    return signals;
  }

  // === FEAR: Small DCA buy (needs sentiment confirmation) ===
  if (fng <= FNG_FEAR && sentiment.score >= 0.1) {
    const chunk = CRYPTO_DCA_CHUNK_PCT;
    reasoning.push(`Fear zone (${fng}) with positive sentiment — small DCA buy`);

    signals.push({
      action: 'dca_buy',
      symbol: 'BTC/USD',
      sizePct: chunk,
      reasoning: [...reasoning],
      confidence: sentiment.score >= 0.3 ? 'high' : 'medium',
      fearGreedValue: fng,
      regimeLabel: regime.regime,
      sentimentScore: sentiment.score,
    });
    return signals;
  }

  // === NEUTRAL: Hold, do nothing ===
  reasoning.push(`Neutral zone (F&G=${fng}) — no action`);
  signals.push({
    action: 'hold',
    symbol: 'BTC/USD',
    sizePct: 0,
    reasoning: [...reasoning],
    confidence: 'medium',
    fearGreedValue: fng,
    regimeLabel: regime.regime,
    sentimentScore: sentiment.score,
  });
  return signals;
}

export function formatCryptoSignalForLog(signal: CryptoStrategySignal): string {
  return `[Crypto] ${signal.action.toUpperCase()} ${signal.symbol} ` +
    `(F&G=${signal.fearGreedValue}, regime=${signal.regimeLabel}, sent=${signal.sentimentScore.toFixed(2)}) ` +
    `size=${(signal.sizePct * 100).toFixed(1)}% conf=${signal.confidence}`;
}
