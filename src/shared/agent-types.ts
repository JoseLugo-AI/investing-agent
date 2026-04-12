// === Tier Configuration ===

export type TierId = 'conservative' | 'moderate' | 'aggressive' | 'jose_crypto';

export interface TierConfig {
  id: TierId;
  label: string;
  target_pct: number;
  scan_interval_min: number;
  symbols: string[];
  asset_class: 'equity' | 'crypto';
  updated_at: string;
}

export interface TierAllocation {
  id: TierId;
  label: string;
  target_pct: number;
  target_value: number;
  current_value: number;
  available: number;
  position_count: number;
  asset_class: 'equity' | 'crypto';
}

// === Scan Records ===

export interface AgentScan {
  id: number;
  tier_id: TierId;
  started_at: string;
  completed_at: string | null;
  symbols_scanned: number;
  opportunities_found: number;
  status: 'running' | 'completed' | 'error';
  error: string | null;
}

// === Analysis Records ===

export interface AgentAnalysis {
  id: number;
  scan_id: number | null;
  tier_id: TierId;
  symbol: string;
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  risks: string[];
  target_allocation_pct: number | null;
  urgency: 'immediate' | 'soon' | 'watch' | null;
  raw_response: string | null;
  created_at: string;
}

// === Decision Records ===

export type DecisionAction = 'buy' | 'sell' | 'hold' | 'skip' | 'short_sell' | 'cover';

/** Tracked short position for exit logic */
export interface ShortPosition {
  symbol: string;
  entryPrice: number;
  qty: number;
  entryDate: string;
  orderId: string;
  tierId: TierId;
}

export interface AgentDecision {
  id: number;
  analysis_id: number;
  tier_id: TierId;
  symbol: string;
  action: DecisionAction;
  reason: string;
  qty: number | null;
  price: number | null;
  order_id: string | null;
  risk_check: string | null;
  created_at: string;
}

// === Activity Feed ===

export type ActivityType = 'scan_start' | 'scan_complete' | 'analysis' | 'trade' | 'hold' | 'skip' | 'error' | 'agent_start' | 'agent_stop' | 'rebalance' | 'short_entry' | 'short_exit' | 'short_kill';

export interface AgentActivity {
  id: number;
  type: ActivityType;
  tier_id: TierId | null;
  symbol: string | null;
  summary: string;
  details: string | null;
  created_at: string;
}

// === Agent Status ===

export interface AgentStatus {
  running: boolean;
  started_at: string | null;
  tiers: TierAllocation[];
  next_scans: { tier_id: TierId; at: string }[];
  total_trades: number;
  total_analyses: number;
}

// === Enhanced Analysis Result (extends existing) ===

export interface AgentAnalysisResult {
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  risks: string[];
  timeframe: string;
  target_allocation_pct?: number;
  urgency?: 'immediate' | 'soon' | 'watch';
}

// === Default Tier Universes ===

export const DEFAULT_TIERS: Omit<TierConfig, 'updated_at'>[] = [
  {
    id: 'conservative',
    label: 'Conservative',
    target_pct: 0.40,
    scan_interval_min: 390, // once at market open
    symbols: ['VOO', 'QQQ', 'VTI', 'BND', 'SCHD', 'VIG', 'AAPL', 'MSFT', 'JNJ', 'PG'],
    asset_class: 'equity',
  },
  {
    id: 'moderate',
    label: 'Moderate',
    target_pct: 0.35,
    scan_interval_min: 120,
    symbols: ['NVDA', 'AMZN', 'GOOGL', 'META', 'CRM', 'ADBE', 'NOW', 'PANW', 'ANET', 'UBER'],
    asset_class: 'equity',
  },
  {
    id: 'aggressive',
    label: 'Aggressive',
    target_pct: 0.25,
    scan_interval_min: 60,
    symbols: ['SMCI', 'MSTR', 'COIN', 'PLTR', 'RKLB', 'IONQ', 'HOOD', 'SOFI', 'RIVN', 'LCID'],
    asset_class: 'equity',
  },
  {
    id: 'jose_crypto',
    label: 'Jose Crypto',
    target_pct: 1.0, // 100% of its own isolated crypto budget
    scan_interval_min: 1440, // once per day
    symbols: ['BTC/USD', 'ETH/USD'],
    asset_class: 'crypto',
  },
];
