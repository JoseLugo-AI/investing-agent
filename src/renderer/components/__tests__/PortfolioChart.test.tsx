import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PortfolioChart } from '../PortfolioChart';
import portfolioHistoryFixture from '../../../../test/fixtures/portfolio-history.json';
import React from 'react';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}));

vi.mock('../../api', () => ({
  api: {
    getPortfolioHistory: vi.fn(() => Promise.resolve(portfolioHistoryFixture)),
  },
}));

describe('PortfolioChart', () => {
  it('renders period selector buttons', () => {
    render(<PortfolioChart />);
    expect(screen.getByText('1D')).toBeDefined();
    expect(screen.getByText('1W')).toBeDefined();
    expect(screen.getByText('1M')).toBeDefined();
    expect(screen.getByText('3M')).toBeDefined();
    expect(screen.getByText('1Y')).toBeDefined();
  });

  it('renders chart container after data loads', async () => {
    render(<PortfolioChart />);
    await waitFor(() => {
      expect(screen.getByTestId('chart-container')).toBeDefined();
    });
  });

  it('defaults to 1M period', () => {
    render(<PortfolioChart />);
    const btn = screen.getByText('1M');
    expect(btn.classList.contains('active')).toBe(true);
  });
});
