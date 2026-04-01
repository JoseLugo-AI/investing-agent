/**
 * Technical indicators calculated from OHLCV bar data.
 * All functions are pure — no side effects, no API calls.
 */

interface Bar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

// === Simple Moving Average ===

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function smaArray(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

// === Exponential Moving Average ===

export function emaArray(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const multiplier = 2 / (period + 1);
  const result: number[] = [];

  // Seed with SMA
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);

  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
    result.push(ema);
  }
  return result;
}

// === RSI (Relative Strength Index) ===

export interface RSIResult {
  value: number;       // 0-100
  rising: boolean;     // trending up
  oversold: boolean;   // < 30
  overbought: boolean; // > 70
  entryZone: boolean;  // < 40 and rising (momentum turning up)
}

export function calculateRSI(closes: number[], period = 14): RSIResult | null {
  if (closes.length < period + 2) return null;

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  // First average
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Smoothed averages
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  // Calculate previous RSI for trend
  const prevCloses = closes.slice(0, -1);
  const prevGains: number[] = [];
  const prevLosses: number[] = [];
  for (let i = 1; i < prevCloses.length; i++) {
    const change = prevCloses[i] - prevCloses[i - 1];
    prevGains.push(change > 0 ? change : 0);
    prevLosses.push(change < 0 ? Math.abs(change) : 0);
  }
  let prevAvgGain = prevGains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let prevAvgLoss = prevLosses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prevGains.length; i++) {
    prevAvgGain = (prevAvgGain * (period - 1) + prevGains[i]) / period;
    prevAvgLoss = (prevAvgLoss * (period - 1) + prevLosses[i]) / period;
  }
  const prevRs = prevAvgLoss === 0 ? 100 : prevAvgGain / prevAvgLoss;
  const prevRsi = 100 - (100 / (1 + prevRs));

  return {
    value: rsi,
    rising: rsi > prevRsi,
    oversold: rsi < 30,
    overbought: rsi > 70,
    entryZone: rsi < 40 && rsi > prevRsi,
  };
}

// === MACD (Moving Average Convergence Divergence) ===

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  bullishCrossover: boolean;  // MACD crosses above signal
  histogramPositive: boolean;
  histogramRising: boolean;
}

export function calculateMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDResult | null {
  if (closes.length < slowPeriod + signalPeriod) return null;

  const fastEma = emaArray(closes, fastPeriod);
  const slowEma = emaArray(closes, slowPeriod);

  // Align arrays — fastEma starts earlier, trim to match slowEma length
  const offset = fastPeriod < slowPeriod ? slowPeriod - fastPeriod : 0;
  const macdLine: number[] = [];
  for (let i = 0; i < slowEma.length; i++) {
    macdLine.push(fastEma[i + offset] - slowEma[i]);
  }

  if (macdLine.length < signalPeriod) return null;

  const signalLine = emaArray(macdLine, signalPeriod);
  const signalOffset = macdLine.length - signalLine.length;

  const macd = macdLine[macdLine.length - 1];
  const signal = signalLine[signalLine.length - 1];
  const histogram = macd - signal;

  const prevMacd = macdLine[macdLine.length - 2];
  const prevSignal = signalLine.length >= 2 ? signalLine[signalLine.length - 2] : signal;
  const prevHistogram = prevMacd - prevSignal;

  return {
    macd,
    signal,
    histogram,
    bullishCrossover: prevMacd <= prevSignal && macd > signal,
    histogramPositive: histogram > 0,
    histogramRising: histogram > prevHistogram,
  };
}

// === ATR (Average True Range) ===

export interface ATRResult {
  value: number;        // current ATR
  stopLoss: number;     // entry - 2*ATR
  trailingStop: number; // highest high(22) - 3*ATR
  positionSize: number; // shares for given risk amount
}

export function calculateATR(bars: Bar[], period = 14): number | null {
  if (bars.length < period + 1) return null;

  const trueRanges: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].h - bars[i].l,
      Math.abs(bars[i].h - bars[i - 1].c),
      Math.abs(bars[i].l - bars[i - 1].c)
    );
    trueRanges.push(tr);
  }

  // Wilder's smoothing
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return atr;
}

export function calculateATRSizing(
  bars: Bar[],
  entryPrice: number,
  accountValue: number,
  riskPercent = 0.015,
  atrMultiplier = 2,
  maxPositionPct = 0.05
): ATRResult | null {
  const atr = calculateATR(bars, 14);
  if (atr === null) return null;

  const stopLoss = entryPrice - atrMultiplier * atr;
  const riskPerShare = atrMultiplier * atr;
  const riskDollars = accountValue * riskPercent;
  const rawShares = Math.floor(riskDollars / riskPerShare);
  const maxShares = Math.floor((accountValue * maxPositionPct) / entryPrice);
  const positionSize = Math.min(rawShares, maxShares);

  // Chandelier exit: highest high over 22 periods minus 3x ATR
  const recentHighs = bars.slice(-22).map(b => b.h);
  const highestHigh = Math.max(...recentHighs);
  const atr22 = calculateATR(bars, 22) || atr;
  const trailingStop = highestHigh - 3 * atr22;

  return {
    value: atr,
    stopLoss,
    trailingStop,
    positionSize: Math.max(positionSize, 0),
  };
}

// === Volume Analysis ===

export interface VolumeResult {
  current: number;
  average: number;
  ratio: number;         // current / average
  aboveAverage: boolean; // ratio > 1.0
  surge: boolean;        // ratio > 1.5
}

export function analyzeVolume(bars: Bar[], avgPeriod = 20): VolumeResult | null {
  if (bars.length < avgPeriod) return null;

  const current = bars[bars.length - 1].v;
  const avgSlice = bars.slice(-avgPeriod - 1, -1).map(b => b.v);
  const average = avgSlice.reduce((a, b) => a + b, 0) / avgSlice.length;
  const ratio = average > 0 ? current / average : 0;

  return {
    current,
    average,
    ratio,
    aboveAverage: ratio > 1.0,
    surge: ratio > 1.5,
  };
}

// === Combined Signal ===

export interface TechnicalSignal {
  rsi: RSIResult | null;
  macd: MACDResult | null;
  atr: ATRResult | null;
  volume: VolumeResult | null;
  sma50: number | null;
  sma200: number | null;
  priceAbove200SMA: boolean;
  goldenCross: boolean;   // 50 SMA > 200 SMA
  deathCross: boolean;    // 50 SMA < 200 SMA
  buySignalCount: number; // how many indicators say buy (0-5)
  sellSignalCount: number;
}

export function calculateAllIndicators(
  bars: Bar[],
  entryPrice?: number,
  accountValue?: number
): TechnicalSignal {
  const closes = bars.map(b => b.c);
  const currentPrice = closes[closes.length - 1];

  const rsi = calculateRSI(closes);
  const macd = calculateMACD(closes);
  const volume = analyzeVolume(bars);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);

  const atr = entryPrice && accountValue
    ? calculateATRSizing(bars, entryPrice, accountValue)
    : null;

  const priceAbove200SMA = sma200 !== null && currentPrice > sma200;
  const goldenCross = sma50 !== null && sma200 !== null && sma50 > sma200;
  const deathCross = sma50 !== null && sma200 !== null && sma50 < sma200;

  // Count buy signals
  let buySignalCount = 0;
  if (rsi?.entryZone) buySignalCount++;             // RSI < 40 and rising
  if (macd?.bullishCrossover || macd?.histogramPositive) buySignalCount++;
  if (volume?.aboveAverage) buySignalCount++;         // institutional participation
  if (priceAbove200SMA) buySignalCount++;            // bull regime
  if (goldenCross) buySignalCount++;                 // trend confirmation

  // Count sell signals
  let sellSignalCount = 0;
  if (rsi?.overbought && !rsi.rising) sellSignalCount++;
  if (macd && !macd.histogramPositive && !macd.histogramRising) sellSignalCount++;
  if (deathCross) sellSignalCount++;
  if (volume?.surge && closes[closes.length - 1] < closes[closes.length - 2]) sellSignalCount++; // high volume sell-off

  return {
    rsi, macd, atr, volume,
    sma50, sma200,
    priceAbove200SMA, goldenCross, deathCross,
    buySignalCount, sellSignalCount,
  };
}
