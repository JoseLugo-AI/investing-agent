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

export interface ElectronAPI {
  getAccount: () => Promise<Account>;
  getPositions: () => Promise<Position[]>;
  getOrders: () => Promise<Order[]>;
  getBars: (symbol: string, timeframe: string) => Promise<Bar[]>;
  saveApiKeys: (keyId: string, secretKey: string) => Promise<void>;
  hasApiKeys: () => Promise<boolean>;
  clearApiKeys: () => Promise<void>;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
