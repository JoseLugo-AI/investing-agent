/**
 * Short engine — regime-gated mean reversion shorts (Phase 1).
 *
 * Entry: BEAR/CRISIS regime + RSI(2) > 90 + price < 200 SMA + MACD declining
 *        + easy_to_borrow + not aggressive tier + sentiment < -0.1
 *
 * Exit:  RSI(2) < 50 (profit) | +10% above entry (stop) | 5 days (time)
 *        | regime flips to bull (close all)
 */

import type { TierId, ShortPosition } from '../shared/agent-types';
import type { MarketRegime } from './regime-detector';
import {
  SHORT_RSI2_ENTRY,
  SHORT_RSI2_EXIT,
  SHORT_HARD_STOP_PCT,
  SHORT_TIME_STOP_DAYS,
  MAX_CONCURRENT_SHORTS,
  MAX_SHORT_EXPOSURE_PCT,
  MAX_SHORT_POSITION_PCT,
  DAILY_SHORT_LOSS_CAP_PCT,
  WEEKLY_SHORT_LOSS_CAP_PCT,
  MONTHLY_SHORT_KILL_PCT,
} from '../shared/risk-constants';

// === Entry Screening ===

export interface ShortScreenInput {
  regime: MarketRegime;
  rsi2: number;
  priceBelowSma200: boolean;
  macdHistogramDeclining: boolean;
  easyToBorrow: boolean;
  tierId: TierId;
  sentimentScore: number;
}

export interface ShortScreenResult {
  approved: boolean;
  rejections: string[];
}

/**
 * Screen a stock for short entry. ALL conditions must pass.
 */
export function screenShortEntry(input: ShortScreenInput): ShortScreenResult {
  const rejections: string[] = [];

  if (input.regime !== 'bear' && input.regime !== 'crisis') {
    rejections.push('Regime must be BEAR or CRISIS');
  }
  if (input.rsi2 <= SHORT_RSI2_ENTRY) {
    rejections.push(`RSI(2) must be > ${SHORT_RSI2_ENTRY}`);
  }
  if (!input.priceBelowSma200) {
    rejections.push('Price must be below 200 SMA');
  }
  if (!input.macdHistogramDeclining) {
    rejections.push('MACD histogram must be declining');
  }
  if (!input.easyToBorrow) {
    rejections.push('Stock must be easy to borrow');
  }
  if (input.tierId === 'aggressive') {
    rejections.push('Aggressive tier excluded from shorting');
  }
  if (input.sentimentScore >= -0.1) {
    rejections.push('Sentiment must be < -0.1');
  }

  return { approved: rejections.length === 0, rejections };
}

// === Exit Conditions ===

export interface ShortExitInput {
  currentPrice: number;
  rsi2: number;
  regime: MarketRegime;
  tradingDaysHeld: number;
}

export interface ShortExitResult {
  shouldExit: boolean;
  reason: string | null;
}

/**
 * Check if a short position should be covered. ANY condition triggers exit.
 */
export function checkShortExit(
  position: ShortPosition,
  input: ShortExitInput
): ShortExitResult {
  // 1. RSI(2) take profit
  if (input.rsi2 < SHORT_RSI2_EXIT) {
    return { shouldExit: true, reason: `RSI(2) take profit (${input.rsi2.toFixed(1)} < ${SHORT_RSI2_EXIT})` };
  }

  // 2. Hard stop — price rose 10% above entry
  const stopPrice = position.entryPrice * (1 + SHORT_HARD_STOP_PCT);
  if (input.currentPrice > stopPrice) {
    return { shouldExit: true, reason: `Price hard stop ($${input.currentPrice.toFixed(2)} > $${stopPrice.toFixed(2)})` };
  }

  // 3. Time stop — 5 trading days
  if (input.tradingDaysHeld >= SHORT_TIME_STOP_DAYS) {
    return { shouldExit: true, reason: `Time stop (${input.tradingDaysHeld} trading days >= ${SHORT_TIME_STOP_DAYS})` };
  }

  // 4. Regime flipped to bull
  if (input.regime === 'bull') {
    return { shouldExit: true, reason: 'Regime flipped to BULL — close all shorts' };
  }

  return { shouldExit: false, reason: null };
}

// === Risk Limits ===

export interface ShortRiskInput {
  portfolioValue: number;
  currentShortCount: number;
  totalShortExposure: number;
  dailyShortLoss: number;
  weeklyShortLoss: number;
  monthlyShortLoss: number;
  shortingEnabled: boolean;
}

export interface ShortRiskResult {
  allowed: boolean;
  rejections: string[];
  killSwitch?: boolean;
}

/**
 * Check all short-specific risk limits before opening a new short.
 */
export function checkShortRiskLimits(input: ShortRiskInput): ShortRiskResult {
  const rejections: string[] = [];
  let killSwitch = false;

  if (!input.shortingEnabled) {
    rejections.push('Shorting disabled (monthly kill switch)');
  }

  if (input.monthlyShortLoss > input.portfolioValue * MONTHLY_SHORT_KILL_PCT) {
    rejections.push('Monthly short loss kill switch (>5% of portfolio)');
    killSwitch = true;
  }

  if (input.currentShortCount >= MAX_CONCURRENT_SHORTS) {
    rejections.push(`Max concurrent shorts reached (${MAX_CONCURRENT_SHORTS})`);
  }

  if (input.totalShortExposure > input.portfolioValue * MAX_SHORT_EXPOSURE_PCT) {
    rejections.push(`Total short exposure exceeds ${(MAX_SHORT_EXPOSURE_PCT * 100).toFixed(0)}% of portfolio`);
  }

  if (input.dailyShortLoss > input.portfolioValue * DAILY_SHORT_LOSS_CAP_PCT) {
    rejections.push(`Daily short loss cap hit (${(DAILY_SHORT_LOSS_CAP_PCT * 100).toFixed(1)}%)`);
  }

  if (input.weeklyShortLoss > input.portfolioValue * WEEKLY_SHORT_LOSS_CAP_PCT) {
    rejections.push(`Weekly short loss cap hit (${(WEEKLY_SHORT_LOSS_CAP_PCT * 100).toFixed(0)}%)`);
  }

  return { allowed: rejections.length === 0, rejections, killSwitch };
}

// === Position Sizing ===

export interface ShortSizeResult {
  qty: number;
  dollarValue: number;
}

/**
 * Calculate short position size — fixed at MAX_SHORT_POSITION_PCT of portfolio.
 */
export function calculateShortSize(portfolioValue: number, currentPrice: number): ShortSizeResult {
  const maxDollars = portfolioValue * MAX_SHORT_POSITION_PCT;
  const qty = Math.floor(maxDollars / currentPrice);
  return { qty, dollarValue: qty * currentPrice };
}
