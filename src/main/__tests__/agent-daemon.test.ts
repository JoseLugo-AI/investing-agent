import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isMarketOpen, calculateTierAllocations } from '../agent-daemon';
import type { TierConfig } from '../../shared/agent-types';

describe('isMarketOpen', () => {
  it('returns true during market hours (Monday 10:30 AM ET)', () => {
    // April 7, 2025 is a Monday; 10:30 AM ET = 14:30 UTC
    const monday1030 = new Date('2025-04-07T14:30:00Z');
    expect(isMarketOpen(monday1030)).toBe(true);
  });

  it('returns false before market open (Monday 9:00 AM ET)', () => {
    const monday0900 = new Date('2025-04-07T13:00:00Z');
    expect(isMarketOpen(monday0900)).toBe(false);
  });

  it('returns false after market close (Monday 4:30 PM ET)', () => {
    const monday1630 = new Date('2025-04-07T20:30:00Z');
    expect(isMarketOpen(monday1630)).toBe(false);
  });

  it('returns false on Saturday', () => {
    const saturday = new Date('2025-04-05T15:00:00Z');
    expect(isMarketOpen(saturday)).toBe(false);
  });

  it('returns false on Sunday', () => {
    const sunday = new Date('2025-04-06T15:00:00Z');
    expect(isMarketOpen(sunday)).toBe(false);
  });
});

describe('calculateTierAllocations', () => {
  const tiers: TierConfig[] = [
    { id: 'conservative', label: 'Conservative', target_pct: 0.4, scan_interval_min: 390, symbols: ['VOO', 'QQQ'], updated_at: '' },
    { id: 'moderate', label: 'Moderate', target_pct: 0.35, scan_interval_min: 120, symbols: ['NVDA', 'AMZN'], updated_at: '' },
    { id: 'aggressive', label: 'Aggressive', target_pct: 0.25, scan_interval_min: 30, symbols: ['PLTR', 'COIN'], updated_at: '' },
  ];

  const mockStore = {
    getRecentDecisions: vi.fn().mockReturnValue([]),
  };

  it('maps positions to tiers by universe symbols', () => {
    const positions = [
      { symbol: 'VOO', market_value: '20000' },
      { symbol: 'NVDA', market_value: '15000' },
      { symbol: 'PLTR', market_value: '10000' },
    ];

    const allocations = calculateTierAllocations(tiers, positions, 100000, mockStore as any);

    expect(allocations.find(a => a.id === 'conservative')!.current_value).toBe(20000);
    expect(allocations.find(a => a.id === 'moderate')!.current_value).toBe(15000);
    expect(allocations.find(a => a.id === 'aggressive')!.current_value).toBe(10000);
  });

  it('calculates available budget correctly', () => {
    const positions = [{ symbol: 'VOO', market_value: '30000' }];
    const allocations = calculateTierAllocations(tiers, positions, 100000, mockStore as any);

    const conservative = allocations.find(a => a.id === 'conservative')!;
    expect(conservative.target_value).toBe(40000);
    expect(conservative.current_value).toBe(30000);
    expect(conservative.available).toBe(10000);
  });

  it('caps available at zero when over-allocated', () => {
    const positions = [{ symbol: 'VOO', market_value: '50000' }];
    const allocations = calculateTierAllocations(tiers, positions, 100000, mockStore as any);

    const conservative = allocations.find(a => a.id === 'conservative')!;
    expect(conservative.available).toBe(0); // 50K > 40K target, capped at 0
  });

  it('handles empty positions', () => {
    const allocations = calculateTierAllocations(tiers, [], 100000, mockStore as any);
    expect(allocations.every(a => a.current_value === 0)).toBe(true);
    expect(allocations.find(a => a.id === 'conservative')!.available).toBe(40000);
  });
});
