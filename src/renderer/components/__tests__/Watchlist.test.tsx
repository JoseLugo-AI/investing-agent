import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Watchlist } from '../Watchlist';
import React from 'react';

vi.mock('../../api', () => ({
  api: {
    getWatchlist: vi.fn(() => Promise.resolve([
      { symbol: 'AAPL', name: 'Apple Inc.', added_at: '2026-03-31' },
      { symbol: 'MSFT', name: 'Microsoft Corp.', added_at: '2026-03-30' },
    ])),
    removeFromWatchlist: vi.fn(() => Promise.resolve()),
    getQuote: vi.fn((symbol: string) => Promise.resolve({
      symbol,
      last: { price: symbol === 'AAPL' ? 178.25 : 415.80, size: 100, timestamp: '' },
      bid: { price: 0, size: 0 },
      ask: { price: 0, size: 0 },
    })),
    searchAssets: vi.fn(() => Promise.resolve([])),
    addToWatchlist: vi.fn(() => Promise.resolve()),
  },
}));

describe('Watchlist', () => {
  it('renders watchlist items', async () => {
    render(<Watchlist onTrade={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeDefined();
      expect(screen.getByText('MSFT')).toBeDefined();
    });
  });

  it('shows last price for each item', async () => {
    render(<Watchlist onTrade={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('$178.25')).toBeDefined();
    });
  });

  it('calls onTrade when trade button clicked', async () => {
    const onTrade = vi.fn();
    render(<Watchlist onTrade={onTrade} />);
    await waitFor(() => { screen.getByText('AAPL'); });
    const tradeButtons = screen.getAllByText('Trade');
    fireEvent.click(tradeButtons[0]);
    expect(onTrade).toHaveBeenCalledWith('AAPL', 178.25);
  });

  it('renders empty state', async () => {
    const { api } = await import('../../api');
    (api.getWatchlist as any).mockResolvedValueOnce([]);
    render(<Watchlist onTrade={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('No symbols in watchlist')).toBeDefined();
    });
  });
});
