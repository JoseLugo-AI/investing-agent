import {
  MAX_CAPITAL_PER_TRADE_PCT,
  DAILY_LOSS_LIMIT_PCT,
  MAX_DRAWDOWN_PCT,
  MAX_POSITION_PCT,
  MAX_SHORT_POSITION_PCT,
  KELLY_FRACTION,
  DRAWDOWN_THRESHOLDS,
} from '../shared/risk-constants';

export interface RiskConfig {
  maxCapitalPerTradePct: number;
  dailyLossLimitPct: number;
  weeklyDrawdownLimitPct: number;
  maxDrawdownPct: number;
  maxPositionPct: number;
  maxSectorPct: number;
  kellyFraction: number;
}

export interface RiskCheck {
  allowed: boolean;
  warnings: string[];
  errors: string[];
  suggestedQty?: number;
}

export interface OrderInput {
  symbol: string;
  qty: number;
  side: string;
  type: string;
  time_in_force: string;
  limit_price?: number;
}

export interface AccountInput {
  portfolio_value: string;
  equity: string;
  buying_power: string;
  cash: string;
  last_equity: string;
}

export interface PositionInput {
  symbol: string;
  qty: string;
  current_price: string;
  market_value: string;
  side: string;
}

export function getDefaultRiskConfig(): RiskConfig {
  return {
    maxCapitalPerTradePct: MAX_CAPITAL_PER_TRADE_PCT,
    dailyLossLimitPct: DAILY_LOSS_LIMIT_PCT,
    weeklyDrawdownLimitPct: 0.05,
    maxDrawdownPct: MAX_DRAWDOWN_PCT,
    maxPositionPct: MAX_POSITION_PCT,
    maxSectorPct: 0.30,
    kellyFraction: KELLY_FRACTION,
  };
}

/**
 * Pre-trade validation against all risk limits.
 * Pure function — no side effects.
 */
export function validateOrder(
  order: OrderInput,
  account: AccountInput,
  positions: PositionInput[],
  currentPrice: number,
  config: RiskConfig
): RiskCheck {
  const warnings: string[] = [];
  const errors: string[] = [];

  const portfolioValue = parseFloat(account.portfolio_value);
  const equity = parseFloat(account.equity);
  const lastEquity = parseFloat(account.last_equity);
  const buyingPower = parseFloat(account.buying_power);

  const orderValue = order.qty * currentPrice;
  const maxPositionValue = portfolioValue * config.maxPositionPct;
  const maxCapitalRisk = portfolioValue * config.maxCapitalPerTradePct;

  // 1. Check daily loss limit
  const dailyLoss = checkDailyLoss({ equity: account.equity, last_equity: account.last_equity } as AccountInput);
  if (dailyLoss.halted && order.side === 'buy') {
    errors.push(`Daily loss limit reached (${(dailyLoss.lossPercent * 100).toFixed(1)}%). Trading halted for today.`);
  }

  // 2. Check buying power (buy orders only)
  if (order.side === 'buy' && orderValue > buyingPower) {
    errors.push(`Order value ($${orderValue.toFixed(2)}) exceeds buying power ($${buyingPower.toFixed(2)}).`);
  }

  // 3. Check max position size (3% of portfolio)
  // Include existing position in the same symbol
  const existingPosition = positions.find(p => p.symbol === order.symbol);
  const existingValue = existingPosition ? parseFloat(existingPosition.market_value) : 0;
  const totalPositionValue = order.side === 'buy' ? existingValue + orderValue : existingValue - orderValue;

  if (order.side === 'buy' && totalPositionValue > maxPositionValue) {
    errors.push(`Total position size ($${totalPositionValue.toFixed(2)}) exceeds max position limit of ${(config.maxPositionPct * 100).toFixed(0)}% ($${maxPositionValue.toFixed(2)}).`);
  }

  // 4. Check capital risk per trade (2%)
  if (order.side === 'buy' && orderValue > maxCapitalRisk) {
    warnings.push(`Order risks ${((orderValue / portfolioValue) * 100).toFixed(1)}% of capital risk per trade (limit: ${(config.maxCapitalPerTradePct * 100).toFixed(0)}%).`);
  }

  // 5. Calculate suggested quantity if order is too large
  let suggestedQty: number | undefined;
  if (order.side === 'buy' && (totalPositionValue > maxPositionValue || orderValue > buyingPower)) {
    const maxFromPosition = Math.max(0, maxPositionValue - existingValue);
    const maxFromBuyingPower = buyingPower;
    const maxValue = Math.min(maxFromPosition, maxFromBuyingPower);
    suggestedQty = Math.max(0, Math.floor(maxValue / currentPrice));
  }

  const allowed = errors.length === 0;

  return { allowed, warnings, errors, suggestedQty };
}

/**
 * Calculate position size using fractional Kelly Criterion.
 * Returns dollar amount to invest.
 */
export function calculateKellySize(
  winRate: number,
  avgWin: number,
  avgLoss: number,
  capital: number,
  fraction: number = KELLY_FRACTION
): number {
  if (avgWin <= 0 || avgLoss <= 0 || winRate <= 0 || winRate >= 1) return 0;

  // Kelly formula: f = (p * b - q) / b
  // where p = win probability, q = loss probability, b = win/loss ratio
  const b = avgWin / avgLoss;
  const q = 1 - winRate;
  const kelly = (winRate * b - q) / b;

  if (kelly <= 0) return 0;

  // Apply fraction (half-Kelly for safety)
  const fractionalKelly = kelly * fraction;

  // Dollar amount
  const dollarSize = capital * fractionalKelly;

  // Cap at max position size (3% of capital)
  const maxPosition = capital * MAX_POSITION_PCT;
  return Math.min(dollarSize, maxPosition);
}

/**
 * Check daily loss against limit.
 */
export function checkDailyLoss(account: Pick<AccountInput, 'equity' | 'last_equity'>): {
  halted: boolean;
  lossPercent: number;
} {
  const equity = parseFloat(account.equity);
  const lastEquity = parseFloat(account.last_equity);

  if (equity >= lastEquity) {
    return { halted: false, lossPercent: 0 };
  }

  const lossPercent = (lastEquity - equity) / lastEquity;
  return {
    halted: lossPercent >= DAILY_LOSS_LIMIT_PCT,
    lossPercent,
  };
}

/**
 * Check drawdown level relative to peak equity.
 */
export function checkDrawdown(
  peakEquity: number,
  currentEquity: number
): { level: 'ok' | 'warning' | 'halt' | 'kill'; percent: number } {
  if (currentEquity >= peakEquity) {
    return { level: 'ok', percent: 0 };
  }

  const percent = (peakEquity - currentEquity) / peakEquity;

  if (percent >= DRAWDOWN_THRESHOLDS.kill) return { level: 'kill', percent };
  if (percent >= DRAWDOWN_THRESHOLDS.halt) return { level: 'halt', percent };
  if (percent >= DRAWDOWN_THRESHOLDS.warning) return { level: 'warning', percent };
  return { level: 'ok', percent };
}

/**
 * Pre-trade validation for short sell orders.
 * Checks position size against the tighter short limit (1.5% vs 3% for longs).
 */
export function validateShortOrder(
  order: OrderInput,
  account: AccountInput,
  positions: PositionInput[],
  currentPrice: number
): RiskCheck {
  const warnings: string[] = [];
  const errors: string[] = [];

  const portfolioValue = parseFloat(account.portfolio_value);
  const orderValue = order.qty * currentPrice;
  const maxShortValue = portfolioValue * MAX_SHORT_POSITION_PCT;

  // 1. Check daily loss limit
  const dailyLoss = checkDailyLoss({ equity: account.equity, last_equity: account.last_equity } as AccountInput);
  if (dailyLoss.halted) {
    errors.push(`Daily loss limit reached (${(dailyLoss.lossPercent * 100).toFixed(1)}%). Trading halted.`);
  }

  // 2. Check short position size (1.5% of portfolio)
  if (orderValue > maxShortValue) {
    errors.push(`Short position size ($${orderValue.toFixed(2)}) exceeds max short limit of ${(MAX_SHORT_POSITION_PCT * 100).toFixed(1)}% ($${maxShortValue.toFixed(2)}).`);
  }

  // 3. Suggest reduced qty if too large
  let suggestedQty: number | undefined;
  if (orderValue > maxShortValue) {
    suggestedQty = Math.max(0, Math.floor(maxShortValue / currentPrice));
  }

  return { allowed: errors.length === 0, warnings, errors, suggestedQty };
}

/**
 * Check if a single position's concentration is within limits.
 */
export function checkPositionConcentration(
  positionValue: number,
  portfolioValue: number,
  config: RiskConfig
): { ok: boolean; percent: number } {
  const percent = positionValue / portfolioValue;
  return {
    ok: percent <= config.maxPositionPct,
    percent,
  };
}
