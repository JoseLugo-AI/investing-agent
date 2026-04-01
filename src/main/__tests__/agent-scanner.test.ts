import { describe, it, expect, vi } from 'vitest';
import { scanTier } from '../agent-scanner';
import type { TierConfig } from '../../shared/agent-types';

function makeBars(prices: number[]) {
  return prices.map((c, i) => ({
    t: `2026-04-0${i + 1}T04:00:00Z`,
    o: c - 1, h: c + 1, l: c - 2, c, v: 1000000 + i * 100000,
  }));
}

const mockAlpaca = {
  getBars: vi.fn(),
  getAccount: vi.fn(),
  getPositions: vi.fn(),
  getOrders: vi.fn(),
  createOrder: vi.fn(),
  cancelOrder: vi.fn(),
  getQuote: vi.fn(),
  getPortfolioHistory: vi.fn(),
  searchAssets: vi.fn(),
  isPaper: true,
};

describe('scanTier', () => {
  const conservativeTier: TierConfig = {
    id: 'conservative',
    label: 'Conservative',
    target_pct: 0.4,
    scan_interval_min: 390,
    symbols: ['VOO', 'QQQ', 'VTI'],
    updated_at: '2026-04-01',
  };

  it('separates existing positions from candidates', async () => {
    mockAlpaca.getBars.mockImplementation((symbol: string) =>
      Promise.resolve(makeBars([100, 101, 102]))
    );

    const positions = [{ symbol: 'VOO', qty: '10' }];
    const result = await scanTier(conservativeTier, mockAlpaca as any, positions);

    expect(result.tierId).toBe('conservative');
    expect(result.existingPositions.map(c => c.symbol)).toContain('VOO');
    expect(result.candidates.map(c => c.symbol)).not.toContain('VOO');
    expect(result.candidates.map(c => c.symbol)).toContain('QQQ');
  });

  it('handles API failures gracefully', async () => {
    mockAlpaca.getBars.mockImplementation((symbol: string) => {
      if (symbol === 'QQQ') return Promise.reject(new Error('timeout'));
      return Promise.resolve(makeBars([100, 101, 102]));
    });

    const result = await scanTier(conservativeTier, mockAlpaca as any, []);
    // QQQ should be skipped, others present
    expect(result.candidates.find(c => c.symbol === 'QQQ')).toBeUndefined();
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('skips symbols with insufficient bars', async () => {
    mockAlpaca.getBars.mockImplementation((symbol: string) => {
      if (symbol === 'VTI') return Promise.resolve([{ t: '2026-04-01', o: 100, h: 101, l: 99, c: 100, v: 1000 }]);
      return Promise.resolve(makeBars([100, 101, 102]));
    });

    const result = await scanTier(conservativeTier, mockAlpaca as any, []);
    expect(result.candidates.find(c => c.symbol === 'VTI')).toBeUndefined();
  });

  it('limits candidates to top 5', async () => {
    const manySymbols: TierConfig = {
      ...conservativeTier,
      symbols: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    };
    mockAlpaca.getBars.mockResolvedValue(makeBars([100, 101, 102]));

    const result = await scanTier(manySymbols, mockAlpaca as any, []);
    expect(result.candidates.length).toBeLessThanOrEqual(5);
  });
});
