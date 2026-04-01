/**
 * Risk management constants for the investing agent.
 * These protect a new trader from catastrophic losses.
 */

/** Max percentage of capital to risk per trade (fractional Kelly) */
export const MAX_CAPITAL_PER_TRADE_PCT = 0.02;

/** Daily loss limit as percentage of portfolio — halt trading when hit */
export const DAILY_LOSS_LIMIT_PCT = 0.03;

/** Weekly drawdown limit — pause trading */
export const WEEKLY_DRAWDOWN_LIMIT_PCT = 0.05;

/** Maximum drawdown — kill switch, stop all trading */
export const MAX_DRAWDOWN_PCT = 0.20;

/** Max single position as percentage of portfolio */
export const MAX_POSITION_PCT = 0.03;

/** Max sector exposure as percentage of portfolio */
export const MAX_SECTOR_PCT = 0.30;

/** ATR multiplier for stop-loss calculation */
export const ATR_STOP_MULTIPLIER = 2;

/** Kelly fraction — use half-Kelly for safety */
export const KELLY_FRACTION = 0.5;

/** Minimum order quantity */
export const MIN_ORDER_QTY = 1;

/** Drawdown severity levels */
export const DRAWDOWN_THRESHOLDS = {
  warning: 0.03,  // 3% — show warning
  halt: 0.05,     // 5% weekly — pause trading
  kill: 0.20,     // 20% max — kill switch
} as const;
