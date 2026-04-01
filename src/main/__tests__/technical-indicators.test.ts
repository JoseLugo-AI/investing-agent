import { describe, it, expect } from 'vitest';
import { sma, calculateRSI, calculateMACD, calculateATR, calculateATRSizing, analyzeVolume, calculateAllIndicators } from '../technical-indicators';

// Generate test bars with a known pattern
function makeBars(closes: number[], baseVolume = 1000000) {
  return closes.map((c, i) => ({
    t: `2026-03-${String(i + 1).padStart(2, '0')}T04:00:00Z`,
    o: c - 1,
    h: c + 2,
    l: c - 2,
    c,
    v: baseVolume + (i % 3) * 500000,
  }));
}

// Rising prices for 30 bars then declining
const risingCloses = Array.from({ length: 40 }, (_, i) => 100 + i * 0.5);
const decliningCloses = Array.from({ length: 40 }, (_, i) => 120 - i * 0.5);
const sidewaysCloses = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i * 0.3) * 3);

describe('SMA', () => {
  it('calculates simple moving average', () => {
    const result = sma([10, 20, 30, 40, 50], 3);
    expect(result).toBeCloseTo(40); // (30+40+50)/3
  });

  it('returns null when insufficient data', () => {
    expect(sma([10, 20], 5)).toBeNull();
  });
});

describe('RSI', () => {
  it('returns high RSI for rising prices', () => {
    const rsi = calculateRSI(risingCloses);
    expect(rsi).not.toBeNull();
    expect(rsi!.value).toBeGreaterThan(60);
  });

  it('returns low RSI for declining prices', () => {
    const rsi = calculateRSI(decliningCloses);
    expect(rsi).not.toBeNull();
    expect(rsi!.value).toBeLessThan(40);
  });

  it('returns null for insufficient data', () => {
    expect(calculateRSI([100, 101, 102])).toBeNull();
  });

  it('marks oversold correctly', () => {
    // Sharply declining
    const sharp = Array.from({ length: 30 }, (_, i) => 100 - i * 2);
    const rsi = calculateRSI(sharp);
    expect(rsi).not.toBeNull();
    expect(rsi!.oversold).toBe(true);
  });
});

describe('MACD', () => {
  it('shows bullish for rising prices', () => {
    const longRising = Array.from({ length: 50 }, (_, i) => 100 + i * 0.8);
    const macd = calculateMACD(longRising);
    expect(macd).not.toBeNull();
    expect(macd!.macd).toBeGreaterThan(0);
  });

  it('shows bearish for declining prices', () => {
    const longDecline = Array.from({ length: 50 }, (_, i) => 140 - i * 0.8);
    const macd = calculateMACD(longDecline);
    expect(macd).not.toBeNull();
    expect(macd!.macd).toBeLessThan(0);
  });

  it('returns null for insufficient data', () => {
    expect(calculateMACD([100, 101, 102])).toBeNull();
  });
});

describe('ATR', () => {
  it('calculates ATR from bars', () => {
    const bars = makeBars(risingCloses);
    const atr = calculateATR(bars);
    expect(atr).not.toBeNull();
    expect(atr!).toBeGreaterThan(0);
  });

  it('returns null for insufficient data', () => {
    const bars = makeBars([100, 101]);
    expect(calculateATR(bars)).toBeNull();
  });
});

describe('ATR Sizing', () => {
  it('calculates position size based on risk', () => {
    const bars = makeBars(risingCloses);
    const result = calculateATRSizing(bars, 120, 100000);
    expect(result).not.toBeNull();
    expect(result!.positionSize).toBeGreaterThan(0);
    expect(result!.stopLoss).toBeLessThan(120);
    expect(result!.trailingStop).toBeGreaterThan(0);
  });

  it('caps position at 5% of account', () => {
    // Very low ATR means huge raw shares, should be capped
    const calm = Array.from({ length: 30 }, (_, i) => 10 + i * 0.01);
    const bars = makeBars(calm);
    const result = calculateATRSizing(bars, 10, 100000);
    expect(result).not.toBeNull();
    // 5% of 100K = 5000, at $10 = 500 shares max
    expect(result!.positionSize).toBeLessThanOrEqual(500);
  });
});

describe('Volume', () => {
  it('detects above-average volume', () => {
    const bars = makeBars(risingCloses, 1000000);
    // Make last bar have high volume
    bars[bars.length - 1].v = 3000000;
    const vol = analyzeVolume(bars);
    expect(vol).not.toBeNull();
    expect(vol!.aboveAverage).toBe(true);
  });

  it('detects volume surge', () => {
    const bars = makeBars(risingCloses, 500000);
    bars[bars.length - 1].v = 2000000;
    const vol = analyzeVolume(bars);
    expect(vol).not.toBeNull();
    expect(vol!.surge).toBe(true);
  });
});

describe('calculateAllIndicators', () => {
  it('returns all indicators for sufficient data', () => {
    const bars = makeBars(risingCloses);
    const signal = calculateAllIndicators(bars, 120, 100000);
    expect(signal.rsi).not.toBeNull();
    expect(signal.macd).not.toBeNull();
    expect(signal.volume).not.toBeNull();
    expect(signal.atr).not.toBeNull();
    expect(signal.buySignalCount).toBeGreaterThanOrEqual(0);
  });

  it('counts buy signals for bullish setup', () => {
    const bars = makeBars(risingCloses, 1000000);
    bars[bars.length - 1].v = 2000000; // volume surge
    const signal = calculateAllIndicators(bars, 120, 100000);
    // Rising prices should have some buy signals
    expect(signal.buySignalCount).toBeGreaterThan(0);
  });
});
