import { describe, it, expect } from 'vitest';
import {
  validateOrder,
  calculateKellySize,
  checkDailyLoss,
  checkDrawdown,
  checkPositionConcentration,
  getDefaultRiskConfig,
} from '../risk-engine';

const defaultConfig = getDefaultRiskConfig();

function makeAccount(overrides: Record<string, any> = {}) {
  return {
    portfolio_value: '100000.00',
    equity: '100000.00',
    buying_power: '75420.50',
    cash: '82150.25',
    last_equity: '98500.00',
    daytrade_count: 0,
    pattern_day_trader: false,
    ...overrides,
  };
}

function makePositions(overrides: any[] = []) {
  return overrides.length > 0
    ? overrides
    : [
        { symbol: 'AAPL', qty: '10', current_price: '178.25', market_value: '1782.50', side: 'long' },
        { symbol: 'MSFT', qty: '5', current_price: '415.80', market_value: '2079.00', side: 'long' },
      ];
}

describe('Risk Engine', () => {
  describe('validateOrder', () => {
    it('allows a small order within all limits', () => {
      const result = validateOrder(
        { symbol: 'GOOG', qty: 1, side: 'buy', type: 'market', time_in_force: 'day' },
        makeAccount(),
        makePositions(),
        175.00,
        defaultConfig
      );
      expect(result.allowed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('blocks order exceeding max position size (3% of portfolio)', () => {
      // 3% of 100k = $3000. At $175/share, max ~17 shares
      const result = validateOrder(
        { symbol: 'GOOG', qty: 20, side: 'buy', type: 'market', time_in_force: 'day' },
        makeAccount(),
        makePositions(),
        175.00,
        defaultConfig
      );
      expect(result.allowed).toBe(false);
      expect(result.errors.some(e => e.includes('position size'))).toBe(true);
      expect(result.suggestedQty).toBeLessThanOrEqual(17);
    });

    it('blocks order exceeding buying power', () => {
      const result = validateOrder(
        { symbol: 'GOOG', qty: 500, side: 'buy', type: 'market', time_in_force: 'day' },
        makeAccount({ buying_power: '1000.00' }),
        makePositions(),
        175.00,
        defaultConfig
      );
      expect(result.allowed).toBe(false);
      expect(result.errors.some(e => e.includes('buying power'))).toBe(true);
    });

    it('allows sell orders without buying power check', () => {
      const result = validateOrder(
        { symbol: 'AAPL', qty: 5, side: 'sell', type: 'market', time_in_force: 'day' },
        makeAccount({ buying_power: '0.00' }),
        makePositions(),
        178.25,
        defaultConfig
      );
      expect(result.allowed).toBe(true);
    });

    it('warns when order uses more than 2% capital risk', () => {
      // 2% of 100k = $2000. Order for 12 shares at $175 = $2100
      const result = validateOrder(
        { symbol: 'GOOG', qty: 12, side: 'buy', type: 'market', time_in_force: 'day' },
        makeAccount(),
        makePositions(),
        175.00,
        defaultConfig
      );
      expect(result.warnings.some(w => w.includes('capital risk'))).toBe(true);
    });

    it('blocks order when daily loss halted', () => {
      // last_equity was 100k, current equity is 96k = 4% loss > 3% limit
      const result = validateOrder(
        { symbol: 'GOOG', qty: 1, side: 'buy', type: 'market', time_in_force: 'day' },
        makeAccount({ equity: '96000.00', last_equity: '100000.00' }),
        makePositions(),
        175.00,
        defaultConfig
      );
      expect(result.allowed).toBe(false);
      expect(result.errors.some(e => e.includes('Daily loss limit'))).toBe(true);
    });

    it('suggests reduced quantity when order is too large', () => {
      const result = validateOrder(
        { symbol: 'GOOG', qty: 25, side: 'buy', type: 'market', time_in_force: 'day' },
        makeAccount(),
        makePositions(),
        175.00,
        defaultConfig
      );
      expect(result.suggestedQty).toBeDefined();
      expect(result.suggestedQty!).toBeGreaterThan(0);
      expect(result.suggestedQty!).toBeLessThan(25);
    });
  });

  describe('calculateKellySize', () => {
    it('calculates fractional Kelly position size', () => {
      // Win rate 60%, avg win $200, avg loss $100
      // Kelly = (0.6 * 200 - 0.4 * 100) / 200 = (120 - 40) / 200 = 0.4
      // Half-Kelly = 0.2, on $100k = $20k, but capped at 3% = $3000
      const size = calculateKellySize(0.6, 200, 100, 100000, 0.5);
      expect(size).toBe(3000); // capped at MAX_POSITION_PCT (3%)
    });

    it('returns 0 for negative Kelly (losing strategy)', () => {
      // Win rate 30%, avg win $100, avg loss $200
      const size = calculateKellySize(0.3, 100, 200, 100000, 0.5);
      expect(size).toBe(0);
    });

    it('caps at max position size', () => {
      // Even with great win rate, cap at 3% of capital
      const size = calculateKellySize(0.9, 500, 50, 100000, 0.5);
      // Kelly would suggest a huge position, but we cap
      expect(size).toBeLessThanOrEqual(100000 * 0.03);
    });
  });

  describe('checkDailyLoss', () => {
    it('returns not halted when within limit', () => {
      const result = checkDailyLoss(makeAccount({ equity: '99000.00', last_equity: '100000.00' }));
      expect(result.halted).toBe(false);
      expect(result.lossPercent).toBeCloseTo(0.01, 2);
    });

    it('returns halted when daily loss exceeds 3%', () => {
      const result = checkDailyLoss(makeAccount({ equity: '96000.00', last_equity: '100000.00' }));
      expect(result.halted).toBe(true);
      expect(result.lossPercent).toBeCloseTo(0.04, 2);
    });

    it('returns 0 loss when equity increased', () => {
      const result = checkDailyLoss(makeAccount({ equity: '102000.00', last_equity: '100000.00' }));
      expect(result.halted).toBe(false);
      expect(result.lossPercent).toBe(0);
    });
  });

  describe('checkDrawdown', () => {
    it('returns ok for small drawdown', () => {
      const result = checkDrawdown(100000, 99000);
      expect(result.level).toBe('ok');
      expect(result.percent).toBeCloseTo(0.01, 2);
    });

    it('returns warning at 3% drawdown', () => {
      const result = checkDrawdown(100000, 96500);
      expect(result.level).toBe('warning');
    });

    it('returns halt at 5% drawdown', () => {
      const result = checkDrawdown(100000, 94500);
      expect(result.level).toBe('halt');
    });

    it('returns kill at 20% drawdown', () => {
      const result = checkDrawdown(100000, 79000);
      expect(result.level).toBe('kill');
    });

    it('returns ok when equity above peak', () => {
      const result = checkDrawdown(100000, 105000);
      expect(result.level).toBe('ok');
      expect(result.percent).toBe(0);
    });
  });

  describe('checkPositionConcentration', () => {
    it('returns ok for small position', () => {
      const result = checkPositionConcentration(1782.50, 100000, defaultConfig);
      expect(result.ok).toBe(true);
      expect(result.percent).toBeCloseTo(0.0178, 3);
    });

    it('returns not ok when exceeding max position', () => {
      const result = checkPositionConcentration(5000, 100000, defaultConfig);
      expect(result.ok).toBe(false);
      expect(result.percent).toBeCloseTo(0.05, 2);
    });
  });
});
