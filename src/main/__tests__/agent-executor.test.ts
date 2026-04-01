import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../risk-engine', () => ({
  validateOrder: vi.fn(),
  getDefaultRiskConfig: vi.fn(() => ({})),
}));

import { executeDecision } from '../agent-executor';
import { validateOrder } from '../risk-engine';

const mockValidateOrder = vi.mocked(validateOrder);

function makeCtx(overrides: any = {}) {
  return {
    alpaca: {
      createOrder: vi.fn().mockResolvedValue({ id: 'order-123' }),
      ...overrides.alpaca,
    },
    store: {
      saveDecision: vi.fn(),
      logActivity: vi.fn(),
      ...overrides.store,
    },
    account: { portfolio_value: '100000', equity: '100000', cash: '50000', last_equity: '100000' },
    positions: overrides.positions ?? [],
    tierAllocation: {
      id: 'moderate' as const,
      label: 'Moderate',
      target_pct: 0.35,
      target_value: 35000,
      current_value: 20000,
      available: 15000,
      position_count: 3,
      ...overrides.tierAllocation,
    },
  };
}

describe('executeDecision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs hold decisions without placing orders', async () => {
    const ctx = makeCtx();
    const result = await executeDecision(1, 'moderate', 'NVDA', {
      recommendation: 'hold',
      confidence: 'medium',
      reasoning: 'Price consolidating',
      risks: [],
      timeframe: '1 week',
    }, 900, ctx as any);

    expect(result.action).toBe('hold');
    expect(ctx.alpaca.createOrder).not.toHaveBeenCalled();
    expect(ctx.store.saveDecision).toHaveBeenCalledWith(expect.objectContaining({ action: 'hold' }));
  });

  it('places buy order when risk engine allows', async () => {
    mockValidateOrder.mockReturnValue({ allowed: true, warnings: [], errors: [] } as any);
    const ctx = makeCtx();

    const result = await executeDecision(1, 'moderate', 'NVDA', {
      recommendation: 'buy',
      confidence: 'high',
      reasoning: 'Breakout confirmed',
      risks: [],
      timeframe: '2 weeks',
      target_allocation_pct: 0.02,
    }, 900, ctx as any);

    expect(result.action).toBe('buy');
    expect(result.orderId).toBe('order-123');
    expect(ctx.alpaca.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'NVDA',
      side: 'buy',
      type: 'market',
    }));
  });

  it('skips buy when risk engine blocks', async () => {
    mockValidateOrder.mockReturnValue({ allowed: false, warnings: [], errors: ['Daily loss limit reached'] } as any);
    const ctx = makeCtx();

    const result = await executeDecision(1, 'moderate', 'NVDA', {
      recommendation: 'buy',
      confidence: 'high',
      reasoning: 'test',
      risks: [],
      timeframe: '1 week',
    }, 900, ctx as any);

    expect(result.action).toBe('skip');
    expect(result.reason).toContain('Risk engine blocked');
    expect(ctx.alpaca.createOrder).not.toHaveBeenCalled();
  });

  it('skips low confidence buys', async () => {
    const ctx = makeCtx();
    const result = await executeDecision(1, 'moderate', 'NVDA', {
      recommendation: 'buy',
      confidence: 'low',
      reasoning: 'Weak signal',
      risks: [],
      timeframe: '1 week',
    }, 900, ctx as any);

    expect(result.action).toBe('skip');
    expect(result.reason).toContain('confidence too low');
  });

  it('skips buy when tier budget exhausted', async () => {
    const ctx = makeCtx({ tierAllocation: { available: 0 } });
    const result = await executeDecision(1, 'moderate', 'NVDA', {
      recommendation: 'buy',
      confidence: 'high',
      reasoning: 'test',
      risks: [],
      timeframe: '1 week',
    }, 900, ctx as any);

    expect(result.action).toBe('skip');
    expect(result.reason).toContain('budget exhausted');
  });

  it('sells existing position', async () => {
    const ctx = makeCtx({
      positions: [{ symbol: 'NVDA', qty: '50', current_price: '900' }],
    });

    const result = await executeDecision(1, 'moderate', 'NVDA', {
      recommendation: 'sell',
      confidence: 'high',
      reasoning: 'Momentum exhausted',
      risks: [],
      timeframe: 'immediate',
    }, 900, ctx as any);

    expect(result.action).toBe('sell');
    expect(result.qty).toBe(50);
    expect(ctx.alpaca.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      symbol: 'NVDA',
      side: 'sell',
      qty: 50,
    }));
  });

  it('skips sell when no position exists', async () => {
    const ctx = makeCtx();
    const result = await executeDecision(1, 'moderate', 'NVDA', {
      recommendation: 'sell',
      confidence: 'high',
      reasoning: 'test',
      risks: [],
      timeframe: 'immediate',
    }, 900, ctx as any);

    expect(result.action).toBe('skip');
    expect(result.reason).toContain('no position held');
  });

  it('handles order placement failure', async () => {
    mockValidateOrder.mockReturnValue({ allowed: true, warnings: [], errors: [] } as any);
    const ctx = makeCtx({
      alpaca: { createOrder: vi.fn().mockRejectedValue(new Error('insufficient buying power')) },
    });

    const result = await executeDecision(1, 'moderate', 'NVDA', {
      recommendation: 'buy',
      confidence: 'high',
      reasoning: 'test',
      risks: [],
      timeframe: '1 week',
      target_allocation_pct: 0.02,
    }, 900, ctx as any);

    expect(result.action).toBe('skip');
    expect(result.reason).toContain('order failed');
  });
});
