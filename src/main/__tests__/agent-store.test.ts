import { describe, it, expect, afterEach } from 'vitest';
import { createAgentStore, AgentStore } from '../agent-store';
import path from 'path';
import fs from 'fs';
import os from 'os';

function tempDb(): string {
  return path.join(os.tmpdir(), `agent-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

describe('AgentStore', () => {
  const dbs: string[] = [];
  let store: AgentStore;

  function makeStore(): AgentStore {
    const p = tempDb();
    dbs.push(p);
    store = createAgentStore(p);
    return store;
  }

  afterEach(() => {
    try { store?.close(); } catch {}
    for (const p of dbs) {
      try { fs.unlinkSync(p); } catch {}
      try { fs.unlinkSync(p + '-wal'); } catch {}
      try { fs.unlinkSync(p + '-shm'); } catch {}
    }
    dbs.length = 0;
  });

  describe('config', () => {
    it('seeds default config on creation', () => {
      makeStore();
      expect(store.getConfig('enabled')).toBe('false');
      expect(store.getConfig('auto_start')).toBe('false');
    });

    it('sets and gets config', () => {
      makeStore();
      store.setConfig('enabled', 'true');
      expect(store.getConfig('enabled')).toBe('true');
    });

    it('returns null for unknown key', () => {
      makeStore();
      expect(store.getConfig('nonexistent')).toBeNull();
    });
  });

  describe('tiers', () => {
    it('seeds 3 default tiers', () => {
      makeStore();
      const tiers = store.getTiers();
      expect(tiers).toHaveLength(3);
      expect(tiers.map(t => t.id).sort()).toEqual(['aggressive', 'conservative', 'moderate']);
    });

    it('gets a single tier by id', () => {
      makeStore();
      const tier = store.getTier('conservative');
      expect(tier).not.toBeNull();
      expect(tier!.target_pct).toBe(0.4);
      expect(tier!.symbols).toContain('VOO');
    });

    it('returns null for unknown tier', () => {
      makeStore();
      expect(store.getTier('unknown' as any)).toBeNull();
    });

    it('updates tier symbols', () => {
      makeStore();
      store.updateTierSymbols('aggressive', ['TSLA', 'GME']);
      const tier = store.getTier('aggressive');
      expect(tier!.symbols).toEqual(['TSLA', 'GME']);
    });
  });

  describe('scans', () => {
    it('starts and completes a scan', () => {
      makeStore();
      const scanId = store.startScan('moderate');
      expect(scanId).toBeGreaterThan(0);

      store.completeScan(scanId, 10, 3);
      const scans = store.getRecentScans('moderate');
      expect(scans).toHaveLength(1);
      expect(scans[0].status).toBe('completed');
      expect(scans[0].symbols_scanned).toBe(10);
      expect(scans[0].opportunities_found).toBe(3);
    });

    it('records scan failures', () => {
      makeStore();
      const scanId = store.startScan('aggressive');
      store.failScan(scanId, 'API timeout');
      const scans = store.getRecentScans('aggressive');
      expect(scans[0].status).toBe('error');
      expect(scans[0].error).toBe('API timeout');
    });
  });

  describe('analyses', () => {
    it('saves and retrieves analyses', () => {
      makeStore();
      const id = store.saveAnalysis({
        scanId: null,
        tierId: 'moderate',
        symbol: 'NVDA',
        recommendation: 'buy',
        confidence: 'high',
        reasoning: 'Strong momentum',
        risks: ['Earnings miss', 'Sector rotation'],
        targetAllocationPct: 0.05,
        urgency: 'soon',
        rawResponse: '{"test": true}',
      });
      expect(id).toBeGreaterThan(0);

      const analyses = store.getAnalysesForSymbol('NVDA');
      expect(analyses).toHaveLength(1);
      expect(analyses[0].recommendation).toBe('buy');
      expect(analyses[0].risks).toEqual(['Earnings miss', 'Sector rotation']);
    });

    it('counts total analyses', () => {
      makeStore();
      store.saveAnalysis({ scanId: null, tierId: 'moderate', symbol: 'AAPL', recommendation: 'hold', confidence: 'medium', reasoning: 'test', risks: [], targetAllocationPct: null, urgency: null, rawResponse: null });
      store.saveAnalysis({ scanId: null, tierId: 'moderate', symbol: 'MSFT', recommendation: 'buy', confidence: 'high', reasoning: 'test', risks: [], targetAllocationPct: null, urgency: null, rawResponse: null });
      expect(store.getTotalAnalyses()).toBe(2);
    });
  });

  describe('decisions', () => {
    it('saves and retrieves decisions', () => {
      makeStore();
      const analysisId = store.saveAnalysis({ scanId: null, tierId: 'aggressive', symbol: 'PLTR', recommendation: 'buy', confidence: 'high', reasoning: 'test', risks: [], targetAllocationPct: 0.03, urgency: 'immediate', rawResponse: null });
      const decisionId = store.saveDecision({
        analysisId,
        tierId: 'aggressive',
        symbol: 'PLTR',
        action: 'buy',
        reason: 'High confidence buy signal',
        qty: 50,
        price: 25.50,
        orderId: 'order-123',
        riskCheck: '{"allowed": true}',
      });
      expect(decisionId).toBeGreaterThan(0);

      const decisions = store.getRecentDecisions(10);
      expect(decisions).toHaveLength(1);
      expect(decisions[0].action).toBe('buy');
      expect(decisions[0].order_id).toBe('order-123');
    });

    it('counts only buy/sell as trades', () => {
      makeStore();
      const a1 = store.saveAnalysis({ scanId: null, tierId: 'moderate', symbol: 'AAPL', recommendation: 'buy', confidence: 'high', reasoning: 'test', risks: [], targetAllocationPct: null, urgency: null, rawResponse: null });
      const a2 = store.saveAnalysis({ scanId: null, tierId: 'moderate', symbol: 'MSFT', recommendation: 'hold', confidence: 'medium', reasoning: 'test', risks: [], targetAllocationPct: null, urgency: null, rawResponse: null });

      store.saveDecision({ analysisId: a1, tierId: 'moderate', symbol: 'AAPL', action: 'buy', reason: 'buy', qty: 10, price: 180, orderId: 'o1', riskCheck: null });
      store.saveDecision({ analysisId: a2, tierId: 'moderate', symbol: 'MSFT', action: 'hold', reason: 'hold', qty: null, price: null, orderId: null, riskCheck: null });

      expect(store.getTotalTrades()).toBe(1);
    });
  });

  describe('activity', () => {
    it('logs and retrieves activity', () => {
      makeStore();
      store.logActivity('agent_start', 'Agent started');
      store.logActivity('scan_start', 'Scanning moderate tier', 'moderate');
      store.logActivity('trade', 'Bought 10 AAPL', 'conservative', 'AAPL');

      const activity = store.getActivity(10);
      expect(activity).toHaveLength(3);
      // All inserted in same ms, so order is by rowid DESC
      expect(activity.map(a => a.type)).toContain('agent_start');
      expect(activity.map(a => a.type)).toContain('trade');
    });

    it('filters by tier', () => {
      makeStore();
      store.logActivity('scan_start', 'Scan 1', 'moderate');
      store.logActivity('scan_start', 'Scan 2', 'aggressive');

      const moderate = store.getActivity(10, 0, 'moderate');
      expect(moderate).toHaveLength(1);
      expect(moderate[0].summary).toBe('Scan 1');
    });
  });
});
