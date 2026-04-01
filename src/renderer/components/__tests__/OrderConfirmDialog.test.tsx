import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrderConfirmDialog } from '../OrderConfirmDialog';

describe('OrderConfirmDialog', () => {
  const defaultProps = {
    order: { symbol: 'AAPL', qty: 5, side: 'buy' as const, type: 'market' as const, time_in_force: 'day' as const },
    lastPrice: 178.25,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('shows order summary', () => {
    render(<OrderConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Confirm Order')).toBeDefined();
    expect(screen.getByText('BUY 5 AAPL')).toBeDefined();
  });

  it('shows estimated cost for buy', () => {
    render(<OrderConfirmDialog {...defaultProps} />);
    expect(screen.getByText('~$891.25')).toBeDefined();
  });

  it('shows market order type', () => {
    render(<OrderConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Market Order')).toBeDefined();
  });

  it('shows limit price for limit orders', () => {
    render(<OrderConfirmDialog {...defaultProps} order={{ ...defaultProps.order, type: 'limit', limit_price: 175 }} />);
    expect(screen.getByText('$175.00')).toBeDefined();
  });

  it('calls onConfirm when confirmed', () => {
    render(<OrderConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Place Order'));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when cancelled', () => {
    render(<OrderConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Go Back'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('shows paper trading reminder', () => {
    render(<OrderConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Paper Trading — No Real Money')).toBeDefined();
  });
});
