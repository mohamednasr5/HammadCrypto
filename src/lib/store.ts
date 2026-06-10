'use client';

import { create } from 'zustand';
import { Portfolio, AIAnalysis, AlertItem, OKXCreds, TabType } from './types';
import { lsGet, lsSet, safeBase64Encode, safeBase64Decode, fmtPrice } from './utils';

interface AppState {
  // Navigation
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;

  // Portfolio
  portfolio: Portfolio | null;
  setPortfolio: (data: Portfolio | null) => void;

  // AI
  aiAnalyses: AIAnalysis[];
  aiLastUpdate: number | null;
  setAIAnalyses: (data: AIAnalysis[], lastUpdate?: number) => void;

  // Alerts
  alerts: AlertItem[];
  addAlert: (title: string, body: string, type?: AlertItem['type']) => void;
  clearAlerts: () => void;

  // Connection
  connected: boolean;
  setConnected: (v: boolean) => void;
  connMsg: string;
  connMsgType: 'ok' | 'fail' | '';
  setConnMsg: (msg: string, type: 'ok' | 'fail' | '') => void;

  // Loading states
  loadingPortfolio: boolean;
  loadingAI: boolean;
  loadingRefresh: boolean;
  setLoadingPortfolio: (v: boolean) => void;
  setLoadingAI: (v: boolean) => void;
  setLoadingRefresh: (v: boolean) => void;

  // Credentials
  getCredentials: () => OKXCreds | null;
  saveCredentials: (creds: OKXCreds) => void;
  removeCredentials: () => void;
  hasCredentials: () => boolean;

  // Ticker coins
  tickerCoins: string;
  setTickerCoins: (v: string) => void;
  tickerPrices: Record<string, { p: number; c: number }>;
  setTickerPrices: (v: Record<string, { p: number; c: number }>) => void;

  // PWA
  installPrompt: unknown;
  setInstallPrompt: (e: unknown) => void;

  // Actions
  fetchPortfolio: () => Promise<void>;
  fetchAI: () => Promise<void>;
  runAI: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  testConnection: (creds: OKXCreds) => Promise<boolean>;
  initApp: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  currentTab: 'home',
  setCurrentTab: (tab) => {
    set({ currentTab: tab });
    if (tab === 'ai') get().fetchAI();
  },

  // Portfolio
  portfolio: null,
  setPortfolio: (data) => set({ portfolio: data }),

  // AI
  aiAnalyses: [],
  aiLastUpdate: null,
  setAIAnalyses: (data, lastUpdate) =>
    set({ aiAnalyses: data, aiLastUpdate: lastUpdate || Date.now() }),

  // Alerts
  alerts: [],
  addAlert: (title, body, type = 'info') => {
    const alerts = [
      { id: Date.now(), title, body, type, time: new Date().toISOString(), read: false },
      ...get().alerts,
    ].slice(0, 50);
    set({ alerts });
    lsSet('hammad_alerts', alerts);
  },
  clearAlerts: () => {
    set({ alerts: [] });
    lsSet('hammad_alerts', []);
  },

  // Connection
  connected: false,
  setConnected: (v) => set({ connected: v }),
  connMsg: '',
  connMsgType: '',
  setConnMsg: (msg, type) => set({ connMsg: msg, connMsgType: type }),

  // Loading
  loadingPortfolio: true,
  loadingAI: false,
  loadingRefresh: false,
  setLoadingPortfolio: (v) => set({ loadingPortfolio: v }),
  setLoadingAI: (v) => set({ loadingAI: v }),
  setLoadingRefresh: (v) => set({ loadingRefresh: v }),

  // Credentials
  getCredentials: () => {
    try {
      const enc = localStorage.getItem('okx_creds_enc');
      if (!enc) return null;
      return JSON.parse(safeBase64Decode(enc));
    } catch {
      return null;
    }
  },
  saveCredentials: (creds) => {
    const enc = safeBase64Encode(JSON.stringify(creds));
    localStorage.setItem('okx_creds_enc', enc);
  },
  removeCredentials: () => {
    localStorage.removeItem('okx_creds_enc');
    localStorage.removeItem('hammad_portfolio_cache');
    set({ portfolio: null, connected: false });
  },
  hasCredentials: () => {
    try {
      return !!localStorage.getItem('okx_creds_enc');
    } catch {
      return false;
    }
  },

  // Ticker coins
  tickerCoins: 'BTC,ETH,SOL,BNB,KAT,PI,OFC',
  setTickerCoins: (v) => {
    set({ tickerCoins: v });
    lsSet('hammad_tickerCoins', v);
  },
  tickerPrices: {},
  setTickerPrices: (v) => set({ tickerPrices: v }),

  // PWA
  installPrompt: null,
  setInstallPrompt: (e) => set({ installPrompt: e }),

  // API Actions
  fetchPortfolio: async () => {
    set({ loadingPortfolio: true });
    const creds = get().getCredentials();
    if (!creds) {
      const cached = lsGet<Portfolio | null>('hammad_portfolio_cache', null);
      set({ portfolio: cached, connected: !!cached, loadingPortfolio: false });
      return;
    }
    try {
      const credsHeader = safeBase64Encode(JSON.stringify(creds));
      const res = await fetch('/api/okx?action=portfolio', {
        headers: { 'x-okx-creds': credsHeader },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.portfolio) {
          set({ portfolio: data.portfolio, connected: true });
          lsSet('hammad_portfolio_cache', data.portfolio);
        } else {
          const cached = lsGet<Portfolio | null>('hammad_portfolio_cache', null);
          set({ portfolio: cached, connected: !!cached });
        }
      } else {
        const cached = lsGet<Portfolio | null>('hammad_portfolio_cache', null);
        set({ portfolio: cached, connected: !!cached });
      }
    } catch {
      const cached = lsGet<Portfolio | null>('hammad_portfolio_cache', null);
      set({ portfolio: cached, connected: !!cached });
    }
    set({ loadingPortfolio: false });
  },

  fetchAI: async () => {
    const creds = get().getCredentials();
    if (!creds) return;
    try {
      const credsHeader = safeBase64Encode(JSON.stringify(creds));
      const res = await fetch('/api/okx?action=ai', {
        headers: { 'x-okx-creds': credsHeader },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.analyses) {
          set({ aiAnalyses: data.analyses, aiLastUpdate: data.lastUpdate || Date.now() });
          lsSet('hammad_ai_cache', { analyses: data.analyses, lastUpdate: data.lastUpdate });
        }
      } else {
        const cached = lsGet<{ analyses: AIAnalysis[]; lastUpdate: number } | null>(
          'hammad_ai_cache',
          null
        );
        if (cached) set({ aiAnalyses: cached.analyses, aiLastUpdate: cached.lastUpdate });
      }
    } catch {
      const cached = lsGet<{ analyses: AIAnalysis[]; lastUpdate: number } | null>(
        'hammad_ai_cache',
        null
      );
      if (cached) set({ aiAnalyses: cached.analyses, aiLastUpdate: cached.lastUpdate });
    }
  },

  runAI: async () => {
    set({ loadingAI: true });
    const creds = get().getCredentials();
    if (!creds) {
      set({ loadingAI: false });
      return;
    }
    try {
      const credsHeader = safeBase64Encode(JSON.stringify(creds));
      const res = await fetch('/api/okx?action=ai', {
        method: 'POST',
        headers: { 'x-okx-creds': credsHeader },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.analyses) {
          set({ aiAnalyses: data.analyses, aiLastUpdate: Date.now() });
          lsSet('hammad_ai_cache', { analyses: data.analyses, lastUpdate: Date.now() });
        }
      }
    } catch {
      // silent
    }
    set({ loadingAI: false });
  },

  forceRefresh: async () => {
    set({ loadingRefresh: true });
    await get().fetchPortfolio();
    set({ loadingRefresh: false });
    get().addAlert('🔄 تحديث', 'تم تحديث بيانات المحفظة', 'info');
  },

  testConnection: async (creds) => {
    try {
      const res = await fetch('/api/okx?action=test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      const data = await res.json();
      return data.ok === true;
    } catch {
      return false;
    }
  },

  initApp: () => {
    const savedAlerts = lsGet<AlertItem[]>('hammad_alerts', [
      {
        id: 1,
        title: '🎉 مرحباً بك',
        body: 'أضف مفاتيح OKX API من الإعدادات للبدء',
        type: 'info',
        time: new Date().toISOString(),
        read: false,
      },
    ]);
    const savedTickerCoins = lsGet<string>('hammad_tickerCoins', 'BTC,ETH,SOL,BNB,KAT,PI,OFC');
    set({ alerts: savedAlerts, tickerCoins: savedTickerCoins });
    get().fetchPortfolio();
  },
}));
