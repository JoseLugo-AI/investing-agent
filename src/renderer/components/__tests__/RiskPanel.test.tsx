import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RiskPanel } from '../RiskPanel';

const mockGetRiskStatus = vi.fn();

vi.mock('../../api', () => ({
  api: {
    getRiskStatus: (...args: any[]) => mockGetRiskStatus(...args),
  },
}));

describe('RiskPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockGetRiskStatus.mockReturnValue(new Promise(() => {})); // never resolves
    render(<RiskPanel />);
    expect(screen.getByText('Risk Monitor')).toBeInTheDocument();
  });

  it('displays risk metrics when loaded', async () => {
    mockGetRiskStatus.mockResolvedValue({
      dailyLossPercent: 0.01,
      dailyLossHalted: false,
      drawdownPercent: 0.02,
      drawdownLevel: 'ok',
      largestPositionPercent: 0.018,
      positionCount: 2,
      portfolioValue: 100000,
    });

    render(<RiskPanel />);

    await waitFor(() => {
      expect(screen.getByText('1.0%')).toBeInTheDocument();
    });
    expect(screen.getByText('2.0%')).toBeInTheDocument();
    expect(screen.getByText('1.8%')).toBeInTheDocument();
  });

  it('shows halted status when daily loss exceeded', async () => {
    mockGetRiskStatus.mockResolvedValue({
      dailyLossPercent: 0.04,
      dailyLossHalted: true,
      drawdownPercent: 0.04,
      drawdownLevel: 'warning',
      largestPositionPercent: 0.02,
      positionCount: 2,
      portfolioValue: 100000,
    });

    render(<RiskPanel />);

    await waitFor(() => {
      expect(screen.getByText('HALTED')).toBeInTheDocument();
    });
  });

  it('shows kill switch warning at max drawdown', async () => {
    mockGetRiskStatus.mockResolvedValue({
      dailyLossPercent: 0.15,
      dailyLossHalted: true,
      drawdownPercent: 0.21,
      drawdownLevel: 'kill',
      largestPositionPercent: 0.01,
      positionCount: 1,
      portfolioValue: 79000,
    });

    render(<RiskPanel />);

    await waitFor(() => {
      expect(screen.getByText('KILL SWITCH')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    mockGetRiskStatus.mockRejectedValue(new Error('Not connected'));

    render(<RiskPanel />);

    await waitFor(() => {
      expect(screen.getByText(/unable to load/i)).toBeInTheDocument();
    });
  });
});
