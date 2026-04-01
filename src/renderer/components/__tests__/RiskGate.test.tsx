import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RiskGate } from '../RiskGate';
import type { OrderRequest, RiskCheck } from '../../types';

const mockValidateOrder = vi.fn();

vi.mock('../../api', () => ({
  api: {
    validateOrder: (...args: any[]) => mockValidateOrder(...args),
  },
}));

const baseOrder: OrderRequest = {
  symbol: 'AAPL',
  qty: 5,
  side: 'buy',
  type: 'market',
  time_in_force: 'day',
};

describe('RiskGate', () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading while validating', () => {
    mockValidateOrder.mockReturnValue(new Promise(() => {}));
    render(<RiskGate order={baseOrder} lastPrice={178.25} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText(/checking risk/i)).toBeInTheDocument();
  });

  it('shows green checkmark and confirm when order is allowed', async () => {
    mockValidateOrder.mockResolvedValue({
      allowed: true,
      warnings: [],
      errors: [],
    });

    render(<RiskGate order={baseOrder} lastPrice={178.25} onConfirm={onConfirm} onCancel={onCancel} />);

    await waitFor(() => {
      expect(screen.getByText(/order passes/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  it('shows warnings but still allows confirmation', async () => {
    mockValidateOrder.mockResolvedValue({
      allowed: true,
      warnings: ['Risks 2.5% of capital per trade (limit: 2%).'],
      errors: [],
    });

    render(<RiskGate order={baseOrder} lastPrice={178.25} onConfirm={onConfirm} onCancel={onCancel} />);

    await waitFor(() => {
      expect(screen.getByText(/2\.5%/)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  it('shows errors and blocks confirmation', async () => {
    mockValidateOrder.mockResolvedValue({
      allowed: false,
      warnings: [],
      errors: ['Daily loss limit reached (4.0%). Trading halted for today.'],
      suggestedQty: 0,
    });

    render(<RiskGate order={baseOrder} lastPrice={178.25} onConfirm={onConfirm} onCancel={onCancel} />);

    await waitFor(() => {
      expect(screen.getByText(/Daily loss limit/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument();
  });

  it('shows suggested quantity when order is too large', async () => {
    mockValidateOrder.mockResolvedValue({
      allowed: false,
      warnings: [],
      errors: ['Total position size exceeds max.'],
      suggestedQty: 10,
    });

    render(<RiskGate order={baseOrder} lastPrice={178.25} onConfirm={onConfirm} onCancel={onCancel} />);

    await waitFor(() => {
      expect(screen.getByText(/suggested.*10/i)).toBeInTheDocument();
    });
  });

  it('calls onConfirm when confirm button clicked', async () => {
    mockValidateOrder.mockResolvedValue({
      allowed: true,
      warnings: [],
      errors: [],
    });

    render(<RiskGate order={baseOrder} lastPrice={178.25} onConfirm={onConfirm} onCancel={onCancel} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', async () => {
    mockValidateOrder.mockResolvedValue({
      allowed: true,
      warnings: [],
      errors: [],
    });

    render(<RiskGate order={baseOrder} lastPrice={178.25} onConfirm={onConfirm} onCancel={onCancel} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
