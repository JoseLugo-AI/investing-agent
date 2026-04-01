export interface Account {
  portfolio_value: string;
  equity: string;
  buying_power: string;
  cash: string;
  last_equity: string;
  daytrade_count: number;
  pattern_day_trader: boolean;
}

export interface Position {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  market_value: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  side: string;
}

export interface Order {
  id: string;
  symbol: string;
  qty: string;
  side: string;
  type: string;
  status: string;
  filled_avg_price: string | null;
  limit_price?: string;
  submitted_at: string;
  filled_at: string | null;
}

export interface Bar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface Quote {
  symbol: string;
  last: { price: number; size: number; timestamp: string };
  bid: { price: number; size: number };
  ask: { price: number; size: number };
}

export interface PortfolioHistory {
  timestamp: number[];
  equity: number[];
  profit_loss: number[];
  profit_loss_pct: number[];
  base_value: number;
  timeframe: string;
}

export interface OrderRequest {
  symbol: string;
  qty: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  time_in_force: 'day' | 'gtc';
  limit_price?: number;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  status: string;
  tradable: boolean;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  added_at: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

// Risk Engine types
export interface RiskCheck {
  allowed: boolean;
  warnings: string[];
  errors: string[];
  suggestedQty?: number;
}

export interface RiskStatus {
  dailyLossPercent: number;
  dailyLossHalted: boolean;
  drawdownPercent: number;
  drawdownLevel: 'ok' | 'warning' | 'halt' | 'kill';
  largestPositionPercent: number;
  positionCount: number;
  portfolioValue: number;
}

export interface RiskConfig {
  maxCapitalPerTradePct: number;
  dailyLossLimitPct: number;
  weeklyDrawdownLimitPct: number;
  maxDrawdownPct: number;
  maxPositionPct: number;
  maxSectorPct: number;
  kellyFraction: number;
}

// Claude AI Analysis types
export interface AnalysisResult {
  recommendation: 'buy' | 'sell' | 'hold';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  risks: string[];
  timeframe: string;
}

export interface ElectronAPI {
  getAccount: () => Promise<Account>;
  getPositions: () => Promise<Position[]>;
  getOrders: () => Promise<Order[]>;
  getBars: (symbol: string, timeframe: string) => Promise<Bar[]>;
  saveApiKeys: (keyId: string, secretKey: string) => Promise<void>;
  hasApiKeys: () => Promise<boolean>;
  clearApiKeys: () => Promise<void>;
  createOrder: (order: OrderRequest) => Promise<Order>;
  cancelOrder: (orderId: string) => Promise<void>;
  getQuote: (symbol: string) => Promise<Quote>;
  getPortfolioHistory: (period: string, timeframe: string) => Promise<PortfolioHistory>;
  searchAssets: (query: string) => Promise<Asset[]>;
  getWatchlist: () => Promise<WatchlistItem[]>;
  addToWatchlist: (symbol: string, name: string) => Promise<void>;
  removeFromWatchlist: (symbol: string) => Promise<void>;
  validateOrder: (order: OrderRequest, currentPrice: number) => Promise<RiskCheck>;
  getRiskStatus: () => Promise<RiskStatus>;
  analyzePosition: (symbol: string) => Promise<AnalysisResult>;
  saveClaudeKey: (apiKey: string) => Promise<void>;
  hasClaudeKey: () => Promise<boolean>;
  clearClaudeKey: () => Promise<void>;
}

// Agent types (frontend versions)
export type TierId = 'conservative' | 'moderate' | 'aggressive';

export interface TierAllocation {
  id: TierId;
  label: string;
  target_pct: number;
  target_value: number;
  current_value: number;
  available: number;
  position_count: number;
}

export interface AgentStatus {
  running: boolean;
  started_at: string | null;
  tiers: TierAllocation[];
  next_scans: { tier_id: TierId; at: string }[];
  total_trades: number;
  total_analyses: number;
}

export interface AgentActivity {
  id: number;
  type: string;
  tier_id: TierId | null;
  symbol: string | null;
  summary: string;
  details: string | null;
  created_at: string;
}

export interface AgentTrade {
  id: number;
  analysis_id: number;
  tier_id: TierId;
  symbol: string;
  action: string;
  reason: string;
  qty: number | null;
  price: number | null;
  order_id: string | null;
  created_at: string;
  analysis_reasoning: string | null;
  analysis_confidence: string | null;
  analysis_risks: string[];
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
