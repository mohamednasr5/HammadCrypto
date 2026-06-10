import { CoinMeta } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const COIN_META: Record<string, CoinMeta> = {
  BTC: { bg: '#f7931a', icon: '₿' },
  ETH: { bg: '#627eea', icon: 'Ξ' },
  USDT: { bg: '#26a17b', icon: '$' },
  USDC: { bg: '#2775ca', icon: '$' },
  BNB: { bg: '#f3ba2f', icon: 'B' },
  SOL: { bg: '#9945ff', icon: '◎' },
  XRP: { bg: '#346aa9', icon: 'X' },
  ADA: { bg: '#627eea', icon: 'A' },
  TON: { bg: '#0088cc', icon: 'T' },
  KAT: { bg: '#ff6b35', icon: 'K' },
  PI: { bg: '#8b4513', icon: 'π' },
  OFC: { bg: '#4ecdc4', icon: 'O' },
  BASED: { bg: '#0052ff', icon: 'B' },
  CHIP: { bg: '#a855f7', icon: 'C' },
  LTC: { bg: '#bfbbbb', icon: 'Ł' },
  DOT: { bg: '#e6007a', icon: '●' },
};

export const DEMO_PRICES: Record<string, { p: number; c: number }> = {
  BTC: { p: 68450, c: 2.34 },
  ETH: { p: 3890, c: 1.87 },
  SOL: { p: 182, c: 3.5 },
  BNB: { p: 610, c: -0.9 },
  KAT: { p: 0.0245, c: -0.85 },
  PI: { p: 2.35, c: 5.2 },
  OFC: { p: 0.0012, c: 12.5 },
  BASED: { p: 0.00045, c: -2.1 },
  CHIP: { p: 0.0089, c: 8.7 },
  XRP: { p: 0.58, c: 1.2 },
  ADA: { p: 0.47, c: -1.5 },
  TON: { p: 7.2, c: 4.1 },
  LTC: { p: 88, c: 0.6 },
  DOT: { p: 7.8, c: -2.3 },
};

export function getCoinMeta(sym: string): CoinMeta {
  const s = sym.toUpperCase().replace(/-USDT$|,-USD$/g, '');
  return COIN_META[s] || { bg: '#4ecdc4', icon: s.charAt(0) };
}

export function fmt(n: number, d = 2): string {
  if (isNaN(n) || n === null) return '0';
  return parseFloat(String(n)).toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function fmtPrice(p: number): string {
  p = parseFloat(String(p));
  if (p >= 1000) return fmt(p, 0);
  if (p >= 1) return fmt(p, 2);
  if (p >= 0.01) return fmt(p, 4);
  return fmt(p, 6);
}

export function fmtTime(d: string | Date): string {
  return new Date(d).toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Safe base64 encoding for Unicode
export function safeBase64Encode(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

export function safeBase64Decode(b64: string): string {
  return decodeURIComponent(
    atob(b64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

// LocalStorage helpers
export function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export function lsSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}
