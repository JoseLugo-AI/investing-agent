import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PositionsTable } from '../PositionsTable';

const mockPositions = [
  {
    symbol: 'AAPL', qty: '10', avg_entry_price: '172.50',
    current_price: '178.25', market_value: '1782.50',
    unrealized_pl: '57.50', unrealized_plpc: '0.0333', side: 'long',
  },
  {
    symbol: 'MSFT', qty: '5', avg_entry_price: '410.00',
    current_price: '415.80', market_value: '2079.00',
    unrealized_pl: '29.00', unrealized_plpc: '0.0141', side: 'long',
  },
];

describe('PositionsTable', () => {
  it('renders all positions', () => {
    render(<PositionsTable positions={mockPositions} onSelectSymbol={() => {}} />);
    expect(screen.getByText('AAPL')).toBeDefined();
    expect(screen.getByText('MSFT')).toBeDefined();
  });

  it('shows unrealized P&L', () => {
    render(<PositionsTable positions={mockPositions} onSelectSymbol={() => {}} />);
    expect(screen.getByText('$57.50')).toBeDefined();
  });

  it('renders empty state', () => {
    render(<PositionsTable positions={[]} onSelectSymbol={() => {}} />);
    expect(screen.getByText('No open positions')).toBeDefined();
  });
});
