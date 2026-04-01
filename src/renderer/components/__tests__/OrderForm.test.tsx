import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrderForm } from '../OrderForm';

describe('OrderForm', () => {
  const defaultProps = {
    symbol: 'AAPL',
    lastPrice: 178.25,
    buyingPower: 75420.50,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders with symbol and price', () => {
    render(<OrderForm {...defaultProps} />);
    expect(screen.getByText('AAPL')).toBeDefined();
    expect(screen.getByText('$178.25')).toBeDefined();
  });

  it('defaults to market buy', () => {
    render(<OrderForm {...defaultProps} />);
    const buyBtn = screen.getByText('Buy');
    expect(buyBtn.classList.contains('active')).toBe(true);
  });

  it('shows limit price input when limit selected', () => {
    render(<OrderForm {...defaultProps} />);
    fireEvent.click(screen.getByText('Limit'));
    expect(screen.getByPlaceholderText('Limit price')).toBeDefined();
  });

  it('calculates estimated cost', () => {
    render(<OrderForm {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('Quantity'), { target: { value: '10' } });
    expect(screen.getByText('~$1,782.50')).toBeDefined();
  });

  it('calls onSubmit with order details', () => {
    render(<OrderForm {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('Quantity'), { target: { value: '5' } });
    fireEvent.click(screen.getByText('Review Order'));
    expect(defaultProps.onSubmit).toHaveBeenCalledWith({
      symbol: 'AAPL', qty: 5, side: 'buy', type: 'market', time_in_force: 'day',
    });
  });

  it('disables submit when qty is 0', () => {
    render(<OrderForm {...defaultProps} />);
    expect(screen.getByText('Review Order').closest('button')?.disabled).toBe(true);
  });

  it('warns when estimated cost exceeds buying power', () => {
    render(<OrderForm {...defaultProps} buyingPower={500} />);
    fireEvent.change(screen.getByPlaceholderText('Quantity'), { target: { value: '10' } });
    expect(screen.getByText('Exceeds buying power')).toBeDefined();
  });
});
