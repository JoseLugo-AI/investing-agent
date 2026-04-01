import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SymbolSearch } from '../SymbolSearch';

vi.mock('../../api', () => ({
  api: {
    searchAssets: vi.fn(() => Promise.resolve([
      { id: '1', symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', status: 'active', tradable: true },
      { id: '2', symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', status: 'active', tradable: true },
    ])),
  },
}));

describe('SymbolSearch', () => {
  it('renders search input', () => {
    render(<SymbolSearch onSelect={vi.fn()} />);
    expect(screen.getByPlaceholderText('Search symbol...')).toBeDefined();
  });

  it('shows results after typing', async () => {
    render(<SymbolSearch onSelect={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Search symbol...'), { target: { value: 'AA' } });
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeDefined();
    });
  });

  it('calls onSelect when result clicked', async () => {
    const onSelect = vi.fn();
    render(<SymbolSearch onSelect={onSelect} />);
    fireEvent.change(screen.getByPlaceholderText('Search symbol...'), { target: { value: 'AA' } });
    await waitFor(() => { screen.getByText('AAPL'); });
    fireEvent.click(screen.getByText('AAPL'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'AAPL' }));
  });
});
