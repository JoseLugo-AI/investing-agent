import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { SEARCH_DEBOUNCE_MS } from '@shared/constants';
import type { Asset } from '../types';

interface Props { onSelect: (asset: Asset) => void; }

export function SymbolSearch({ onSelect }: Props): React.ReactElement {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Asset[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 1) { setResults([]); setOpen(false); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const assets = await api.searchAssets(query);
      setResults(assets);
      setOpen(assets.length > 0);
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const handleSelect = (asset: Asset) => {
    onSelect(asset);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="symbol-search">
      <input type="text" placeholder="Search symbol..." value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)} />
      {open && (
        <ul className="search-results">
          {results.map((a) => (
            <li key={a.id} onClick={() => handleSelect(a)} className="search-result-item">
              <span className="search-symbol">{a.symbol}</span>
              <span className="search-name">{a.name}</span>
              <span className="search-exchange">{a.exchange}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
