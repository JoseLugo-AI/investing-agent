import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriceChart } from '../PriceChart';

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addCandlestickSeries: vi.fn(() => ({ setData: vi.fn() })),
    timeScale: vi.fn(() => ({ fitContent: vi.fn() })),
    applyOptions: vi.fn(),
    remove: vi.fn(),
  })),
}));

describe('PriceChart', () => {
  it('renders chart container with symbol label', () => {
    render(<PriceChart symbol="AAPL" bars={[]} />);
    expect(screen.getByText('AAPL')).toBeDefined();
  });

  it('renders placeholder when no symbol selected', () => {
    render(<PriceChart symbol={null} bars={[]} />);
    expect(screen.getByText('Select a position to view chart')).toBeDefined();
  });
});
