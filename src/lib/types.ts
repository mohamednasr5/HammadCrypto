export interface CoinMeta {
  bg: string;
  icon: string;
}

export interface Asset {
  sym: string;
  qty: number;
  price: number;
  value: number;
  avgBuy: number;
  costBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  dailyChangePct: number;
  allocPct: number;
}

export interface Portfolio {
  total: number;
  invested: number;
  profit: number;
  egpRate: number;
  assets: Asset[];
  ts: number;
}

export interface AIAnalysis {
  sym: string;
  price: number;
  dailyChangePct: number;
  trend: string;
  signal: 'buy' | 'sell' | 'hold';
  reason: string;
  support: number;
  resistance: number;
  stopLoss: number;
  confidence: number;
  bullScore: number;
  bearScore: number;
}

export interface AlertItem {
  id: number;
  title: string;
  body: string;
  type: 'profit' | 'alert' | 'ai' | 'info';
  time: string;
  read: boolean;
}

export interface OKXCreds {
  apiKey: string;
  secretKey: string;
  passphrase: string;
}

export type TabType = 'home' | 'ai' | 'alerts' | 'settings';
