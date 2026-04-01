import { describe, it, expect } from 'vitest';
import { buildAgentPrompt } from '../agent-context-builder';

const baseParams = {
  symbol: 'NVDA',
  tier: { id: 'moderate' as const, label: 'Moderate', target_pct: 0.35, scan_interval_min: 120, symbols: ['NVDA', 'AMZN'], updated_at: '2026-04-01' },
  tierAllocation: { id: 'moderate' as const, label: 'Moderate', target_pct: 0.35, target_value: 35000, current_value: 20000, available: 15000, position_count: 3 },
  position: null,
  account: { portfolio_value: '100000', equity: '100000', cash: '50000', last_equity: '100000' },
  allPositions: [],
  recentBars: [
    { t: '2026-03-31', o: 880, h: 895, l: 875, c: 890, v: 5000000 },
    { t: '2026-04-01', o: 890, h: 910, l: 885, c: 905, v: 6000000 },
  ],
  previousAnalyses: [],
  recentTierTrades: [],
  riskStatus: { dailyLossPercent: -0.5, drawdownLevel: 'ok' },
};

describe('buildAgentPrompt', () => {
  it('includes tier mandate and strategy', () => {
    const prompt = buildAgentPrompt(baseParams);
    expect(prompt).toContain('Moderate');
    expect(prompt).toContain('35%');
    expect(prompt).toContain('Swing trading');
  });

  it('includes portfolio state', () => {
    const prompt = buildAgentPrompt(baseParams);
    expect(prompt).toContain('$100,000');
    expect(prompt).toContain('$15,000'); // available
  });

  it('includes symbol and price data', () => {
    const prompt = buildAgentPrompt(baseParams);
    expect(prompt).toContain('NVDA');
    expect(prompt).toContain('No current position');
    expect(prompt).toContain('905.00');
  });

  it('includes existing position info when present', () => {
    const prompt = buildAgentPrompt({
      ...baseParams,
      position: { symbol: 'NVDA', qty: '50', avg_entry_price: '880', current_price: '905', unrealized_pl: '1250', market_value: '45250', side: 'long' },
    });
    expect(prompt).toContain('50 shares');
    expect(prompt).toContain('880.00');
    expect(prompt).toContain('1250.00');
  });

  it('includes previous analyses as memory', () => {
    const prompt = buildAgentPrompt({
      ...baseParams,
      previousAnalyses: [{
        id: 1, scan_id: null, tier_id: 'moderate', symbol: 'NVDA',
        recommendation: 'buy', confidence: 'high', reasoning: 'Strong breakout above resistance',
        risks: ['Earnings miss'], target_allocation_pct: 0.03, urgency: 'soon',
        raw_response: null, created_at: '2026-03-30T15:00:00Z',
      }],
    });
    expect(prompt).toContain('PREVIOUS ANALYSES');
    expect(prompt).toContain('Strong breakout above resistance');
    expect(prompt).toContain('BUY');
  });

  it('includes recent tier trades', () => {
    const prompt = buildAgentPrompt({
      ...baseParams,
      recentTierTrades: [{
        id: 1, analysis_id: 1, tier_id: 'moderate', symbol: 'AMZN',
        action: 'buy', reason: 'Momentum confirmed', qty: 20, price: 190.50,
        order_id: 'ord-1', risk_check: null, created_at: '2026-03-31T10:00:00Z',
      }],
    });
    expect(prompt).toContain('RECENT TRADES');
    expect(prompt).toContain('AMZN');
    expect(prompt).toContain('Momentum confirmed');
  });

  it('includes risk constraints', () => {
    const prompt = buildAgentPrompt(baseParams);
    expect(prompt).toContain('3%');
    expect(prompt).toContain('PAPER TRADING');
  });

  it('includes JSON response format', () => {
    const prompt = buildAgentPrompt(baseParams);
    expect(prompt).toContain('"recommendation"');
    expect(prompt).toContain('"target_allocation_pct"');
    expect(prompt).toContain('"urgency"');
  });
});
