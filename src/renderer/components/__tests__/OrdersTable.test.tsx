import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrdersTable } from '../OrdersTable';

const mockOrders = [
  {
    id: 'order-1', symbol: 'AAPL', qty: '10', side: 'buy', type: 'market',
    status: 'filled', filled_avg_price: '172.50', limit_price: undefined,
    submitted_at: '2026-03-30T14:30:00Z', filled_at: '2026-03-30T14:30:02Z',
  },
];

describe('OrdersTable', () => {
  it('renders orders', () => {
    render(<OrdersTable orders={mockOrders} />);
    expect(screen.getByText('AAPL')).toBeDefined();
    expect(screen.getByText('filled')).toBeDefined();
  });

  it('renders empty state', () => {
    render(<OrdersTable orders={[]} />);
    expect(screen.getByText('No recent orders')).toBeDefined();
  });
});
