import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWatchlistStore, WatchlistStore } from '../watchlist-store';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.join('/tmp', 'test-watchlist.db');

describe('WatchlistStore', () => {
  let store: WatchlistStore;

  beforeEach(() => {
    store = createWatchlistStore(TEST_DB_PATH);
  });

  afterEach(() => {
    store.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('returns empty list initially', () => {
    expect(store.getAll()).toEqual([]);
  });

  it('adds a symbol to watchlist', () => {
    store.add('AAPL', 'Apple Inc.');
    const items = store.getAll();
    expect(items).toHaveLength(1);
    expect(items[0].symbol).toBe('AAPL');
    expect(items[0].name).toBe('Apple Inc.');
  });

  it('does not duplicate symbols', () => {
    store.add('AAPL', 'Apple Inc.');
    store.add('AAPL', 'Apple Inc.');
    expect(store.getAll()).toHaveLength(1);
  });

  it('removes a symbol', () => {
    store.add('AAPL', 'Apple Inc.');
    store.add('MSFT', 'Microsoft Corp.');
    store.remove('AAPL');
    const items = store.getAll();
    expect(items).toHaveLength(1);
    expect(items[0].symbol).toBe('MSFT');
  });

  it('returns items sorted by added_at desc', () => {
    store.add('AAPL', 'Apple Inc.');
    store.add('MSFT', 'Microsoft Corp.');
    store.add('GOOGL', 'Alphabet Inc.');
    const items = store.getAll();
    expect(items[0].symbol).toBe('GOOGL');
    expect(items[2].symbol).toBe('AAPL');
  });
});
