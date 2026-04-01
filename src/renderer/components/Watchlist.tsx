import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { SymbolSearch } from './SymbolSearch';
import type { WatchlistItem, Asset } from '../types';

interface WatchlistItemWithPrice extends WatchlistItem {
  lastPrice: number | null;
}

interface Props {
  onTrade: (symbol: string, lastPrice: number) => void;
}

export function Watchlist({ onTrade }: Props): React.ReactElement {
  const [items, setItems] = useState<WatchlistItemWithPrice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWatchlist = useCallback(async () => {
    const watchlist = await api.getWatchlist();
    const withPrices = await Promise.all(
      watchlist.map(async (item) => {
        try {
          const quote = await api.getQuote(item.symbol);
          return { ...item, lastPrice: quote.last.price };
        } catch {
          return { ...item, lastPrice: null };
        }
      })
    );
    setItems(withPrices);
    setLoading(false);
  }, []);

  useEffect(() => { fetchWatchlist(); }, [fetchWatchlist]);

  const handleAdd = async (asset: Asset) => {
    await api.addToWatchlist(asset.symbol, asset.name);
    fetchWatchlist();
  };

  const handleRemove = async (symbol: string) => {
    await api.removeFromWatchlist(symbol);
    setItems((prev) => prev.filter((i) => i.symbol !== symbol));
  };

  if (loading) return <div className="watchlist">Loading...</div>;

  return (
    <div className="watchlist">
      <div className="watchlist-header">
        <h2>Watchlist</h2>
        <SymbolSearch onSelect={handleAdd} />
      </div>
      {items.length === 0 ? (
        <div className="empty-state">No symbols in watchlist</div>
      ) : (
        <ul className="watchlist-items">
          {items.map((item) => (
            <li key={item.symbol} className="watchlist-item">
              <div className="watchlist-item-info">
                <span className="watchlist-symbol">{item.symbol}</span>
                <span className="watchlist-name">{item.name}</span>
              </div>
              <span className="watchlist-price">
                {item.lastPrice !== null ? `$${item.lastPrice.toFixed(2)}` : '—'}
              </span>
              <div className="watchlist-actions">
                <button className="btn btn-sm btn-primary" onClick={() => item.lastPrice && onTrade(item.symbol, item.lastPrice)}>
                  Trade
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => handleRemove(item.symbol)}>
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
