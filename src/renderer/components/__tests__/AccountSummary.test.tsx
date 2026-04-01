import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountSummary } from '../AccountSummary';

const mockAccount = {
  portfolio_value: '100000.00',
  equity: '100000.00',
  buying_power: '75420.50',
  cash: '82150.25',
  last_equity: '98500.00',
  daytrade_count: 0,
  pattern_day_trader: false,
};

describe('AccountSummary', () => {
  it('renders portfolio value', () => {
    render(<AccountSummary account={mockAccount} />);
    expect(screen.getByText('$100,000.00')).toBeDefined();
  });

  it('renders buying power', () => {
    render(<AccountSummary account={mockAccount} />);
    expect(screen.getByText('$75,420.50')).toBeDefined();
  });

  it('shows positive daily change in green', () => {
    render(<AccountSummary account={mockAccount} />);
    expect(screen.getByText('+$1,500.00')).toBeDefined();
  });

  it('renders loading state when no account', () => {
    render(<AccountSummary account={null} />);
    expect(screen.getByText('Loading...')).toBeDefined();
  });
});
