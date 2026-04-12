import { describe, it, expect } from 'vitest';
import {
  screenShortEntry,
  checkShortExit,
  checkShortRiskLimits,
  calculateShortSize,
} from '../short-engine';

function makeScreenInput(overrides: Partial<Parameters<typeof screenShortEntry>[0]> = {}) {
  return {
    regime: 'bear' as const,
    rsi2: 92,
    priceBelowSma200: true,
    macdHistogramDeclining: true,
    easyToBorrow: true,
    tierId: 'moderate' as const,
    sentimentScore: -0.2,
    ...overrides,
  };
}

describe('Short Engine', () => {
  describe('screenShortEntry', () => {
    it('approves entry when all conditions met', () => {
      const result = screenShortEntry(makeScreenInput());
      expect(result.approved).toBe(true);
      expect(result.rejections).toHaveLength(0);
    });

    it('rejects when regime is bull', () => {
      const result = screenShortEntry(makeScreenInput({ regime: 'bull' }));
      expect(result.approved).toBe(false);
      expect(result.rejections).toContain('Regime must be BEAR or CRISIS');
    });

    it('rejects when regime is sideways', () => {
      const result = screenShortEntry(makeScreenInput({ regime: 'sideways' }));
      expect(result.approved).toBe(false);
    });

    it('approves crisis regime', () => {
      const result = screenShortEntry(makeScreenInput({ regime: 'crisis' }));
      expect(result.approved).toBe(true);
    });

    it('rejects when RSI(2) below 80', () => {
      const result = screenShortEntry(makeScreenInput({ rsi2: 75 }));
      expect(result.approved).toBe(false);
      expect(result.rejections).toContain('RSI(2) must be > 80');
    });

    it('rejects when RSI(2) exactly 80', () => {
      const result = screenShortEntry(makeScreenInput({ rsi2: 80 }));
      expect(result.approved).toBe(false);
    });

    it('rejects when price above 200 SMA', () => {
      const result = screenShortEntry(makeScreenInput({ priceBelowSma200: false }));
      expect(result.approved).toBe(false);
      expect(result.rejections).toContain('Price must be below 200 SMA');
    });

    it('rejects when MACD histogram not declining', () => {
      const result = screenShortEntry(makeScreenInput({ macdHistogramDeclining: false }));
      expect(result.approved).toBe(false);
      expect(result.rejections).toContain('MACD histogram must be declining');
    });

    it('rejects when not easy to borrow', () => {
      const result = screenShortEntry(makeScreenInput({ easyToBorrow: false }));
      expect(result.approved).toBe(false);
      expect(result.rejections).toContain('Stock must be easy to borrow');
    });

    it('rejects aggressive tier stocks', () => {
      const result = screenShortEntry(makeScreenInput({ tierId: 'aggressive' }));
      expect(result.approved).toBe(false);
      expect(result.rejections).toContain('Aggressive tier excluded from shorting');
    });

    it('rejects when sentiment too positive', () => {
      const result = screenShortEntry(makeScreenInput({ sentimentScore: 0.1 }));
      expect(result.approved).toBe(false);
      expect(result.rejections).toContain('Sentiment must be < -0.1');
    });

    it('rejects when sentiment exactly -0.1', () => {
      const result = screenShortEntry(makeScreenInput({ sentimentScore: -0.1 }));
      expect(result.approved).toBe(false);
    });

    it('collects all rejections when multiple conditions fail', () => {
      const result = screenShortEntry(makeScreenInput({
        regime: 'bull',
        rsi2: 50,
        easyToBorrow: false,
      }));
      expect(result.approved).toBe(false);
      expect(result.rejections.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('checkShortExit', () => {
    const basePosition = {
      symbol: 'MSFT',
      entryPrice: 400,
      qty: 5,
      entryDate: '2026-03-28',
      orderId: 'ord-1',
      tierId: 'moderate' as const,
    };

    it('triggers take-profit when RSI(2) drops below 50', () => {
      const result = checkShortExit(basePosition, {
        currentPrice: 380,
        rsi2: 45,
        regime: 'bear',
        tradingDaysHeld: 2,
      });
      expect(result.shouldExit).toBe(true);
      expect(result.reason).toContain('RSI(2) take profit');
    });

    it('does not exit when RSI(2) still above 50', () => {
      const result = checkShortExit(basePosition, {
        currentPrice: 380,
        rsi2: 65,
        regime: 'bear',
        tradingDaysHeld: 2,
      });
      expect(result.shouldExit).toBe(false);
    });

    it('triggers hard stop when price rises 10% above entry', () => {
      const result = checkShortExit(basePosition, {
        currentPrice: 441,
        rsi2: 75,
        regime: 'bear',
        tradingDaysHeld: 1,
      });
      expect(result.shouldExit).toBe(true);
      expect(result.reason).toContain('hard stop');
    });

    it('does not trigger hard stop at exactly 10%', () => {
      const result = checkShortExit(basePosition, {
        currentPrice: 440,
        rsi2: 75,
        regime: 'bear',
        tradingDaysHeld: 1,
      });
      expect(result.shouldExit).toBe(false);
    });

    it('triggers time stop after 5 trading days', () => {
      const result = checkShortExit(basePosition, {
        currentPrice: 395,
        rsi2: 70,
        regime: 'bear',
        tradingDaysHeld: 5,
      });
      expect(result.shouldExit).toBe(true);
      expect(result.reason).toContain('Time stop');
    });

    it('triggers regime exit when regime flips to bull', () => {
      const result = checkShortExit(basePosition, {
        currentPrice: 390,
        rsi2: 60,
        regime: 'bull',
        tradingDaysHeld: 1,
      });
      expect(result.shouldExit).toBe(true);
      expect(result.reason).toContain('BULL');
    });

    it('does not exit on sideways regime', () => {
      const result = checkShortExit(basePosition, {
        currentPrice: 390,
        rsi2: 60,
        regime: 'sideways',
        tradingDaysHeld: 1,
      });
      expect(result.shouldExit).toBe(false);
    });
  });

  describe('checkShortRiskLimits', () => {
    it('allows when all limits are within bounds', () => {
      const result = checkShortRiskLimits({
        portfolioValue: 100000,
        currentShortCount: 1,
        totalShortExposure: 3000,
        dailyShortLoss: 500,
        weeklyShortLoss: 1000,
        monthlyShortLoss: 2000,
        shortingEnabled: true,
      });
      expect(result.allowed).toBe(true);
      expect(result.rejections).toHaveLength(0);
    });

    it('rejects when shorting is disabled (kill switch)', () => {
      const result = checkShortRiskLimits({
        portfolioValue: 100000,
        currentShortCount: 0,
        totalShortExposure: 0,
        dailyShortLoss: 0,
        weeklyShortLoss: 0,
        monthlyShortLoss: 0,
        shortingEnabled: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.rejections).toContain('Shorting disabled (monthly kill switch)');
    });

    it('rejects when max concurrent shorts reached', () => {
      const result = checkShortRiskLimits({
        portfolioValue: 100000,
        currentShortCount: 3,
        totalShortExposure: 3000,
        dailyShortLoss: 0,
        weeklyShortLoss: 0,
        monthlyShortLoss: 0,
        shortingEnabled: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.rejections[0]).toContain('concurrent shorts');
    });

    it('rejects when total short exposure exceeds 10%', () => {
      const result = checkShortRiskLimits({
        portfolioValue: 100000,
        currentShortCount: 2,
        totalShortExposure: 11000,
        dailyShortLoss: 0,
        weeklyShortLoss: 0,
        monthlyShortLoss: 0,
        shortingEnabled: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.rejections[0]).toContain('exposure');
    });

    it('rejects when daily short loss cap hit', () => {
      const result = checkShortRiskLimits({
        portfolioValue: 100000,
        currentShortCount: 0,
        totalShortExposure: 0,
        dailyShortLoss: 1600,
        weeklyShortLoss: 0,
        monthlyShortLoss: 0,
        shortingEnabled: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.rejections[0]).toContain('Daily short loss');
    });

    it('rejects when weekly short loss cap hit', () => {
      const result = checkShortRiskLimits({
        portfolioValue: 100000,
        currentShortCount: 0,
        totalShortExposure: 0,
        dailyShortLoss: 0,
        weeklyShortLoss: 3100,
        monthlyShortLoss: 0,
        shortingEnabled: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.rejections[0]).toContain('Weekly short loss');
    });

    it('triggers kill switch when monthly loss exceeds 5%', () => {
      const result = checkShortRiskLimits({
        portfolioValue: 100000,
        currentShortCount: 0,
        totalShortExposure: 0,
        dailyShortLoss: 0,
        weeklyShortLoss: 0,
        monthlyShortLoss: 5100,
        shortingEnabled: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.killSwitch).toBe(true);
      expect(result.rejections[0]).toContain('kill switch');
    });
  });

  describe('calculateShortSize', () => {
    it('calculates qty from 1.5% position size', () => {
      const result = calculateShortSize(100000, 200);
      expect(result.qty).toBe(7);
      expect(result.dollarValue).toBe(1400);
    });

    it('returns 0 qty when price is too high', () => {
      const result = calculateShortSize(100000, 2000);
      expect(result.qty).toBe(0);
    });

    it('respects portfolio value', () => {
      const result = calculateShortSize(50000, 100);
      expect(result.qty).toBe(7);
    });
  });
});
