import Database from 'better-sqlite3';

export interface WatchlistStore {
  getAll: () => { symbol: string; name: string; added_at: string }[];
  add: (symbol: string, name: string) => void;
  remove: (symbol: string) => void;
  close: () => void;
}

export function createWatchlistStore(dbPath: string): WatchlistStore {
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS watchlist (
      symbol TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      added_at TEXT NOT NULL
    )
  `);

  const stmtGetAll = db.prepare('SELECT symbol, name, added_at FROM watchlist ORDER BY added_at DESC');
  const stmtAdd = db.prepare('INSERT OR IGNORE INTO watchlist (symbol, name, added_at) VALUES (?, ?, ?)');
  const stmtRemove = db.prepare('DELETE FROM watchlist WHERE symbol = ?');

  return {
    getAll: () => stmtGetAll.all() as { symbol: string; name: string; added_at: string }[],
    add: (symbol, name) => stmtAdd.run(symbol, name, new Date().toISOString()),
    remove: (symbol) => stmtRemove.run(symbol),
    close: () => db.close(),
  };
}
