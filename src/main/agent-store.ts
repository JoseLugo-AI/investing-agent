import Database from 'better-sqlite3';
import type {
  TierId, TierConfig, AgentScan, AgentAnalysis, AgentDecision,
  AgentActivity, ActivityType, DecisionAction,
} from '../shared/agent-types';
import { DEFAULT_TIERS } from '../shared/agent-types';

export interface AgentStore {
  // Config
  getConfig(key: string): string | null;
  setConfig(key: string, value: string): void;

  // Tiers
  getTiers(): TierConfig[];
  getTier(id: TierId): TierConfig | null;
  updateTierSymbols(id: TierId, symbols: string[]): void;

  // Scans
  startScan(tierId: TierId): number;
  completeScan(scanId: number, symbolsScanned: number, opportunitiesFound: number): void;
  failScan(scanId: number, error: string): void;
  getRecentScans(tierId: TierId, limit?: number): AgentScan[];
  hasCompletedScanToday(tierId: TierId): boolean;

  // Analyses
  saveAnalysis(params: {
    scanId: number | null;
    tierId: TierId;
    symbol: string;
    recommendation: string;
    confidence: string;
    reasoning: string;
    risks: string[];
    targetAllocationPct: number | null;
    urgency: string | null;
    rawResponse: string | null;
  }): number;
  getAnalysesForSymbol(symbol: string, limit?: number): AgentAnalysis[];
  getRecentAnalyses(limit?: number): AgentAnalysis[];
  getTotalAnalyses(): number;

  // Decisions
  saveDecision(params: {
    analysisId: number;
    tierId: TierId;
    symbol: string;
    action: DecisionAction;
    reason: string;
    qty: number | null;
    price: number | null;
    orderId: string | null;
    riskCheck: string | null;
  }): number;
  getRecentDecisions(limit?: number, offset?: number, tierId?: TierId, symbol?: string): AgentDecision[];
  getTotalTrades(): number;

  // Sentiment cache
  getCachedSentiment(symbol: string, maxAgeMs?: number): string | null;
  cacheSentiment(symbol: string, data: string): void;

  // Activity
  logActivity(type: ActivityType, summary: string, tierId?: TierId | null, symbol?: string | null, details?: string | null): void;
  getActivity(limit?: number, offset?: number, tierId?: TierId): AgentActivity[];

  close(): void;
}

export function createAgentStore(dbPath: string): AgentStore {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_tiers (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      target_pct REAL NOT NULL,
      scan_interval_min INTEGER NOT NULL,
      symbols TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tier_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      symbols_scanned INTEGER NOT NULL DEFAULT 0,
      opportunities_found INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'running',
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id INTEGER,
      tier_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      confidence TEXT NOT NULL,
      reasoning TEXT NOT NULL,
      risks TEXT NOT NULL,
      target_allocation_pct REAL,
      urgency TEXT,
      raw_response TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id INTEGER NOT NULL,
      tier_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT NOT NULL,
      qty INTEGER,
      price REAL,
      order_id TEXT,
      risk_check TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      tier_id TEXT,
      symbol TEXT,
      summary TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sentiment_cache (
      symbol TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      cached_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_activity_created ON agent_activity(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_analyses_symbol ON agent_analyses(symbol, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_decisions_symbol ON agent_decisions(symbol, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_scans_tier ON agent_scans(tier_id, started_at DESC);
  `);

  // Seed default tiers if empty
  const tierCount = db.prepare('SELECT COUNT(*) as cnt FROM agent_tiers').get() as { cnt: number };
  if (tierCount.cnt === 0) {
    const insertTier = db.prepare(
      'INSERT INTO agent_tiers (id, label, target_pct, scan_interval_min, symbols, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const now = new Date().toISOString();
    for (const tier of DEFAULT_TIERS) {
      insertTier.run(tier.id, tier.label, tier.target_pct, tier.scan_interval_min, JSON.stringify(tier.symbols), now);
    }
  }

  // Seed default config if empty
  const configCount = db.prepare('SELECT COUNT(*) as cnt FROM agent_config').get() as { cnt: number };
  if (configCount.cnt === 0) {
    const now = new Date().toISOString();
    const insertConfig = db.prepare('INSERT OR IGNORE INTO agent_config (key, value, updated_at) VALUES (?, ?, ?)');
    insertConfig.run('enabled', 'false', now);
    insertConfig.run('auto_start', 'false', now);
  }

  // Prepared statements
  const stmtGetConfig = db.prepare('SELECT value FROM agent_config WHERE key = ?');
  const stmtSetConfig = db.prepare('INSERT OR REPLACE INTO agent_config (key, value, updated_at) VALUES (?, ?, ?)');

  const stmtGetTiers = db.prepare('SELECT * FROM agent_tiers ORDER BY target_pct DESC');
  const stmtGetTier = db.prepare('SELECT * FROM agent_tiers WHERE id = ?');
  const stmtUpdateTierSymbols = db.prepare('UPDATE agent_tiers SET symbols = ?, updated_at = ? WHERE id = ?');

  const stmtStartScan = db.prepare('INSERT INTO agent_scans (tier_id, started_at, status) VALUES (?, ?, ?)');
  const stmtCompleteScan = db.prepare('UPDATE agent_scans SET completed_at = ?, symbols_scanned = ?, opportunities_found = ?, status = ? WHERE id = ?');
  const stmtFailScan = db.prepare('UPDATE agent_scans SET completed_at = ?, error = ?, status = ? WHERE id = ?');
  const stmtRecentScans = db.prepare('SELECT * FROM agent_scans WHERE tier_id = ? ORDER BY started_at DESC LIMIT ?');
  const stmtCompletedScanToday = db.prepare("SELECT COUNT(*) as cnt FROM agent_scans WHERE tier_id = ? AND status = 'completed' AND symbols_scanned > 0 AND started_at >= ?");

  const stmtSaveAnalysis = db.prepare(`
    INSERT INTO agent_analyses (scan_id, tier_id, symbol, recommendation, confidence, reasoning, risks, target_allocation_pct, urgency, raw_response, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const stmtAnalysesForSymbol = db.prepare('SELECT * FROM agent_analyses WHERE symbol = ? ORDER BY created_at DESC LIMIT ?');
  const stmtRecentAnalyses = db.prepare('SELECT * FROM agent_analyses ORDER BY created_at DESC LIMIT ?');
  const stmtTotalAnalyses = db.prepare('SELECT COUNT(*) as cnt FROM agent_analyses');

  const stmtSaveDecision = db.prepare(`
    INSERT INTO agent_decisions (analysis_id, tier_id, symbol, action, reason, qty, price, order_id, risk_check, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const stmtRecentDecisions = db.prepare('SELECT * FROM agent_decisions ORDER BY created_at DESC LIMIT ? OFFSET ?');
  const stmtRecentDecisionsByTier = db.prepare('SELECT * FROM agent_decisions WHERE tier_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?');
  const stmtRecentDecisionsBySymbol = db.prepare('SELECT * FROM agent_decisions WHERE symbol = ? ORDER BY created_at DESC LIMIT ? OFFSET ?');
  const stmtTotalTrades = db.prepare("SELECT COUNT(*) as cnt FROM agent_decisions WHERE action IN ('buy', 'sell')");

  const stmtGetCachedSentiment = db.prepare('SELECT data, cached_at FROM sentiment_cache WHERE symbol = ?');
  const stmtCacheSentiment = db.prepare('INSERT OR REPLACE INTO sentiment_cache (symbol, data, cached_at) VALUES (?, ?, ?)');

  const stmtLogActivity = db.prepare('INSERT INTO agent_activity (type, tier_id, symbol, summary, details, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  const stmtGetActivity = db.prepare('SELECT * FROM agent_activity ORDER BY created_at DESC LIMIT ? OFFSET ?');
  const stmtGetActivityByTier = db.prepare('SELECT * FROM agent_activity WHERE tier_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?');

  function parseTierRow(row: any): TierConfig {
    return {
      ...row,
      symbols: JSON.parse(row.symbols),
    };
  }

  function parseAnalysisRow(row: any): AgentAnalysis {
    return {
      ...row,
      risks: JSON.parse(row.risks),
    };
  }

  return {
    getConfig(key: string): string | null {
      const row = stmtGetConfig.get(key) as { value: string } | undefined;
      return row?.value ?? null;
    },

    setConfig(key: string, value: string): void {
      stmtSetConfig.run(key, value, new Date().toISOString());
    },

    getTiers(): TierConfig[] {
      return (stmtGetTiers.all() as any[]).map(parseTierRow);
    },

    getTier(id: TierId): TierConfig | null {
      const row = stmtGetTier.get(id) as any;
      return row ? parseTierRow(row) : null;
    },

    updateTierSymbols(id: TierId, symbols: string[]): void {
      stmtUpdateTierSymbols.run(JSON.stringify(symbols), new Date().toISOString(), id);
    },

    startScan(tierId: TierId): number {
      const result = stmtStartScan.run(tierId, new Date().toISOString(), 'running');
      return Number(result.lastInsertRowid);
    },

    completeScan(scanId: number, symbolsScanned: number, opportunitiesFound: number): void {
      stmtCompleteScan.run(new Date().toISOString(), symbolsScanned, opportunitiesFound, 'completed', scanId);
    },

    failScan(scanId: number, error: string): void {
      stmtFailScan.run(new Date().toISOString(), error, 'error', scanId);
    },

    getRecentScans(tierId: TierId, limit = 10): AgentScan[] {
      return stmtRecentScans.all(tierId, limit) as AgentScan[];
    },

    hasCompletedScanToday(tierId: TierId): boolean {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const row = stmtCompletedScanToday.get(tierId, today.toISOString()) as { cnt: number };
      return row.cnt > 0;
    },

    saveAnalysis(params): number {
      const result = stmtSaveAnalysis.run(
        params.scanId, params.tierId, params.symbol,
        params.recommendation, params.confidence, params.reasoning,
        JSON.stringify(params.risks), params.targetAllocationPct,
        params.urgency, params.rawResponse, new Date().toISOString()
      );
      return Number(result.lastInsertRowid);
    },

    getAnalysesForSymbol(symbol: string, limit = 5): AgentAnalysis[] {
      return (stmtAnalysesForSymbol.all(symbol, limit) as any[]).map(parseAnalysisRow);
    },

    getRecentAnalyses(limit = 20): AgentAnalysis[] {
      return (stmtRecentAnalyses.all(limit) as any[]).map(parseAnalysisRow);
    },

    getTotalAnalyses(): number {
      return (stmtTotalAnalyses.get() as { cnt: number }).cnt;
    },

    saveDecision(params): number {
      const result = stmtSaveDecision.run(
        params.analysisId, params.tierId, params.symbol,
        params.action, params.reason, params.qty, params.price,
        params.orderId, params.riskCheck, new Date().toISOString()
      );
      return Number(result.lastInsertRowid);
    },

    getRecentDecisions(limit = 20, offset = 0, tierId?: TierId, symbol?: string): AgentDecision[] {
      if (symbol) return stmtRecentDecisionsBySymbol.all(symbol, limit, offset) as AgentDecision[];
      if (tierId) return stmtRecentDecisionsByTier.all(tierId, limit, offset) as AgentDecision[];
      return stmtRecentDecisions.all(limit, offset) as AgentDecision[];
    },

    getTotalTrades(): number {
      return (stmtTotalTrades.get() as { cnt: number }).cnt;
    },

    getCachedSentiment(symbol: string, maxAgeMs = 2 * 60 * 60 * 1000): string | null {
      const row = stmtGetCachedSentiment.get(symbol) as { data: string; cached_at: string } | undefined;
      if (!row) return null;
      const age = Date.now() - new Date(row.cached_at).getTime();
      if (age > maxAgeMs) return null;
      return row.data;
    },

    cacheSentiment(symbol: string, data: string): void {
      stmtCacheSentiment.run(symbol, data, new Date().toISOString());
    },

    logActivity(type: ActivityType, summary: string, tierId?: TierId | null, symbol?: string | null, details?: string | null): void {
      stmtLogActivity.run(type, tierId ?? null, symbol ?? null, summary, details ?? null, new Date().toISOString());
    },

    getActivity(limit = 50, offset = 0, tierId?: TierId): AgentActivity[] {
      if (tierId) return stmtGetActivityByTier.all(tierId, limit, offset) as AgentActivity[];
      return stmtGetActivity.all(limit, offset) as AgentActivity[];
    },

    close(): void {
      db.close();
    },
  };
}
