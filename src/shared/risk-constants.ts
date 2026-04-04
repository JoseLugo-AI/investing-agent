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

// --- Short selling risk limits (Phase 1) ---

/** Max single short position as % of portfolio */
export const MAX_SHORT_POSITION_PCT = 0.015;

/** Max concurrent short positions */
export const MAX_CONCURRENT_SHORTS = 3;

/** Max total short exposure as % of portfolio */
export const MAX_SHORT_EXPOSURE_PCT = 0.10;

/** Daily short loss cap as % of portfolio */
export const DAILY_SHORT_LOSS_CAP_PCT = 0.015;

/** Weekly short loss cap as % of portfolio */
export const WEEKLY_SHORT_LOSS_CAP_PCT = 0.03;

/** Monthly short loss kill switch as % of portfolio — disables shorting until manual re-enable */
export const MONTHLY_SHORT_KILL_PCT = 0.05;

/** Short time stop — max trading days to hold a short */
export const SHORT_TIME_STOP_DAYS = 5;

/** Short hard stop — max % price can rise above entry before forced cover */
export const SHORT_HARD_STOP_PCT = 0.10;

/** RSI(2) threshold for short entry — must be above this (lowered from 90 to widen the entry window) */
export const SHORT_RSI2_ENTRY = 80;

/** RSI(2) threshold for short exit (take profit) — cover when below this */
export const SHORT_RSI2_EXIT = 50;
