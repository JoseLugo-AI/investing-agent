import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AIAnalysis } from '../AIAnalysis';

const mockAnalyzePosition = vi.fn();
const mockHasClaudeKey = vi.fn();

vi.mock('../../api', () => ({
  api: {
    analyzePosition: (...args: any[]) => mockAnalyzePosition(...args),
    hasClaudeKey: (...args: any[]) => mockHasClaudeKey(...args),
  },
}));

describe('AIAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasClaudeKey.mockResolvedValue(true);
  });

  it('shows prompt to select symbol when none selected', () => {
    render(<AIAnalysis symbol={null} />);
    expect(screen.getByText(/select a symbol/i)).toBeInTheDocument();
  });

  it('shows analyze button for selected symbol', () => {
    render(<AIAnalysis symbol="AAPL" />);
    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument();
  });

  it('shows analysis results after clicking analyze', async () => {
    mockAnalyzePosition.mockResolvedValue({
      recommendation: 'buy',
      confidence: 'high',
      reasoning: 'Strong upward momentum with solid fundamentals.',
      risks: ['Market volatility', 'Earnings risk'],
      timeframe: '2-4 weeks',
    });

    render(<AIAnalysis symbol="AAPL" />);

    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));

    await waitFor(() => {
      expect(screen.getByText('BUY')).toBeInTheDocument();
    });
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText(/Strong upward momentum/)).toBeInTheDocument();
    expect(screen.getByText('Market volatility')).toBeInTheDocument();
    expect(screen.getByText('2-4 weeks')).toBeInTheDocument();
  });

  it('shows loading state while analyzing', async () => {
    mockAnalyzePosition.mockReturnValue(new Promise(() => {})); // never resolves

    render(<AIAnalysis symbol="AAPL" />);
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));

    expect(screen.getByText(/analyzing/i)).toBeInTheDocument();
  });

  it('shows error on analysis failure', async () => {
    mockAnalyzePosition.mockRejectedValue(new Error('API key invalid'));

    render(<AIAnalysis symbol="AAPL" />);
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument();
    });
  });

  it('shows setup prompt when no Claude key configured', async () => {
    mockHasClaudeKey.mockResolvedValue(false);

    render(<AIAnalysis symbol="AAPL" />);

    await waitFor(() => {
      expect(screen.getByText(/configure.*claude/i)).toBeInTheDocument();
    });
  });
});
