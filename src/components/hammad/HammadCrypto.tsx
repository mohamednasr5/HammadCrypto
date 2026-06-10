'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import CoinsBar from './CoinsBar';
import HomePage from './HomePage';
import AIPage from './AIPage';
import AlertsPage from './AlertsPage';
import SettingsPage from './SettingsPage';

const TABS = [
  { id: 'home' as const, icon: '🏠', label: 'الرئيسية' },
  { id: 'ai' as const, icon: '🤖', label: 'تحليل' },
  { id: 'alerts' as const, icon: '🔔', label: 'تنبيهات' },
  { id: 'settings' as const, icon: '⚙️', label: 'إعدادات' },
];

export default function HammadCrypto() {
  const { currentTab, setCurrentTab, connected, forceRefresh, loadingRefresh, initApp, setInstallPrompt } =
    useAppStore();

  // Init app on mount
  useEffect(() => {
    initApp();

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('SW registered'))
        .catch(() => {});
    }

    // PWA install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Auto refresh every 60 seconds
    const interval = setInterval(() => {
      forceRefresh();
    }, 60000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearInterval(interval);
    };
  }, [initApp, setInstallPrompt, forceRefresh]);

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0a0e17] text-[#dde3f0] font-['Segoe_UI','Cairo',Tahoma,sans-serif] overflow-hidden">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-br from-[#0f1420]/80 to-[#141d2a]/80 border-b border-[#1c2a3e] backdrop-blur-[10px]">
        <div className="flex items-center gap-2">
          <div className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-[#00d4aa] to-[#4ecdc4] flex items-center justify-center text-base font-black text-black shadow-[0_0_15px_rgba(0,212,170,0.3)] animate-[float_3s_ease-in-out_infinite]">
            ₿
          </div>
          <span className="text-sm font-extrabold bg-gradient-to-r from-[#00d4aa] to-[#00c9ff] bg-clip-text text-transparent tracking-wide">
            HAMMAD CRYPTO
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              connected
                ? 'bg-[#00d4aa] shadow-[0_0_8px_#00d4aa,inset_0_0_8px_rgba(0,212,170,0.4)] animate-[pulse_2s_infinite]'
                : 'bg-[#ff4757] shadow-[0_0_8px_#ff4757]'
            }`}
          />
          <button
            onClick={() => forceRefresh()}
            className={`bg-white/5 border border-[#253448] rounded-md w-7 h-7 flex items-center justify-center text-sm text-[#6b7a99] cursor-pointer transition-all backdrop-blur-[5px] hover:border-[#00d4aa] hover:text-[#00d4aa] hover:bg-[#00d4aa]/10 hover:scale-105 ${
              loadingRefresh ? 'animate-[spin_0.7s_linear_infinite]' : ''
            }`}
            title="تحديث"
          >
            ↻
          </button>
        </div>
      </header>

      {/* Coins Ticker Bar */}
      <CoinsBar />

      {/* Tab Navigation */}
      <nav className="shrink-0 flex bg-[#0f1420] border-b border-[#1c2a3e]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCurrentTab(tab.id)}
            className={`flex-1 py-2.5 text-center text-[10px] cursor-pointer border-b-[3px] transition-all select-none relative ${
              currentTab === tab.id
                ? 'border-b-[#00d4aa] text-[#00d4aa] bg-[#00d4aa]/[0.03]'
                : 'border-b-transparent text-[#3a4560] hover:text-[#6b7a99] hover:bg-white/[0.02]'
            }`}
          >
            <span className="text-base block mb-0.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
        <div className={currentTab === 'home' ? 'block' : 'hidden'}>
          <HomePage />
        </div>
        <div className={currentTab === 'ai' ? 'block' : 'hidden'}>
          <AIPage />
        </div>
        <div className={currentTab === 'alerts' ? 'block' : 'hidden'}>
          <AlertsPage />
        </div>
        <div className={currentTab === 'settings' ? 'block' : 'hidden'}>
          <SettingsPage />
        </div>
      </main>
    </div>
  );
}
