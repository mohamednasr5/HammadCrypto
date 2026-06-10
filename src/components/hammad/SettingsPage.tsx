'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { safeBase64Encode, safeBase64Decode } from '@/lib/utils';

export default function SettingsPage() {
  const {
    saveCredentials,
    removeCredentials,
    testConnection,
    getCredentials,
    setConnected,
    setConnMsg,
    connMsg,
    connMsgType,
    addAlert,
    fetchPortfolio,
    tickerCoins,
    setTickerCoins,
    installPrompt,
  } = useAppStore();

  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [tickerInput, setTickerInput] = useState(tickerCoins);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    if (!apiKey || !secretKey || !passphrase) {
      setConnMsg('⚠️ يرجى ملء الحقول الثلاثة', 'fail');
      return;
    }
    setSaving(true);
    saveCredentials({ apiKey, secretKey, passphrase });
    setConnMsg('✅ تم الحفظ — المفاتيح على جهازك فقط', 'ok');
    setConnected(true);
    addAlert('🔑 OKX', 'تم حفظ بيانات API', 'info');
    setTimeout(() => fetchPortfolio(), 2000);
    setSaving(false);
  };

  const handleTest = async () => {
    if (!apiKey || !secretKey || !passphrase) {
      setConnMsg('⚠️ أدخل البيانات أولاً', 'fail');
      return;
    }
    setTesting(true);
    setConnMsg('⏳ جاري الاختبار...', 'fail');
    const ok = await testConnection({ apiKey, secretKey, passphrase });
    if (ok) {
      setConnMsg('🟢 الاتصال بـ OKX ناجح!', 'ok');
      setConnected(true);
    } else {
      setConnMsg('🔴 بيانات غير صحيحة', 'fail');
    }
    setTesting(false);
  };

  const handleRemove = () => {
    if (!confirm('هل تريد حذف بيانات OKX API؟')) return;
    removeCredentials();
    setConnMsg('🗑️ تم حذف البيانات', 'fail');
    setConnected(false);
    setApiKey('');
    setSecretKey('');
    setPassphrase('');
  };

  const handleUpdateTicker = () => {
    if (tickerInput.trim()) {
      setTickerCoins(tickerInput.trim());
    }
  };

  const handleInstallPWA = () => {
    const promptEvent = installPrompt as BeforeInstallPromptEvent | null;
    if (promptEvent) {
      promptEvent.prompt();
    }
  };

  return (
    <div className="p-2.5 space-y-2.5">
      {/* OKX API Credentials */}
      <div className="block border border-[#1c2a3e] rounded-[10px] p-3.5 bg-gradient-to-br from-[#141d2a]/80 to-[#1a2535]/60">
        <div className="text-[11px] font-bold text-[#00d4aa] mb-2.5 uppercase tracking-wide">
          🔑 بيانات OKX API
        </div>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API Key"
          autoComplete="off"
          className="w-full bg-[#141d2a]/80 border border-[#253448] rounded-lg px-3 py-2 text-[12px] text-[#dde3f0] mb-2 ltr outline-none transition-all shadow-[0_2px_8px_rgba(0,0,0,0.2)] focus:border-[#00d4aa] focus:shadow-[0_0_12px_rgba(0,212,170,0.2)]"
          dir="ltr"
        />
        <input
          type="password"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder="Secret Key"
          autoComplete="off"
          className="w-full bg-[#141d2a]/80 border border-[#253448] rounded-lg px-3 py-2 text-[12px] text-[#dde3f0] mb-2 ltr outline-none transition-all shadow-[0_2px_8px_rgba(0,0,0,0.2)] focus:border-[#00d4aa] focus:shadow-[0_0_12px_rgba(0,212,170,0.2)]"
          dir="ltr"
        />
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Passphrase"
          autoComplete="off"
          className="w-full bg-[#141d2a]/80 border border-[#253448] rounded-lg px-3 py-2 text-[12px] text-[#dde3f0] mb-2 ltr outline-none transition-all shadow-[0_2px_8px_rgba(0,0,0,0.2)] focus:border-[#00d4aa] focus:shadow-[0_0_12px_rgba(0,212,170,0.2)]"
          dir="ltr"
        />

        <div className="flex gap-1.5 flex-wrap mt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-gradient-to-br from-[#00d4aa] to-[#4ecdc4] border-none rounded-lg px-3 py-2 text-[11px] font-semibold text-black cursor-pointer transition-all hover:-translate-y-0.5 shadow-[0_4px_15px_rgba(0,212,170,0.3)] disabled:opacity-50"
          >
            💾 حفظ
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex-1 bg-[#1a2535] border border-[#1c2a3e] rounded-lg px-3 py-2 text-[11px] font-semibold text-[#6b7a99] cursor-pointer transition-all hover:border-[#00d4aa] hover:text-[#00d4aa] disabled:opacity-50"
          >
            🔌 اختبار
          </button>
          <button
            onClick={handleRemove}
            className="flex-1 bg-[#ff4757]/15 border border-[#ff4757]/40 rounded-lg px-3 py-2 text-[11px] font-semibold text-[#ff4757] cursor-pointer transition-all hover:bg-[#ff4757]/25"
          >
            🗑️ حذف
          </button>
        </div>

        {connMsg && (
          <div
            className={`mt-2 text-[10px] px-2 py-1 rounded-lg ${
              connMsgType === 'ok'
                ? 'bg-[#00d4aa]/10 border border-[#00d4aa]/30 text-[#00d4aa]'
                : 'bg-[#ff4757]/10 border border-[#ff4757]/30 text-[#ff4757]'
            }`}
          >
            {connMsg}
          </div>
        )}
      </div>

      {/* Ticker Coins */}
      <div className="block border border-[#1c2a3e] rounded-[10px] p-3.5 bg-gradient-to-br from-[#141d2a]/80 to-[#1a2535]/60">
        <div className="text-[11px] font-bold text-[#4ecdc4] mb-2.5 uppercase tracking-wide">
          📊 عملات شريط الأسعار
        </div>
        <input
          value={tickerInput}
          onChange={(e) => setTickerInput(e.target.value)}
          placeholder="BTC,ETH,SOL,..."
          dir="ltr"
          className="w-full bg-[#141d2a]/80 border border-[#253448] rounded-lg px-3 py-2 text-[12px] text-[#dde3f0] mb-2 outline-none transition-all shadow-[0_2px_8px_rgba(0,0,0,0.2)] focus:border-[#00d4aa]"
        />
        <button
          onClick={handleUpdateTicker}
          className="w-full bg-gradient-to-br from-[#00d4aa] to-[#4ecdc4] border-none rounded-lg px-3 py-2 text-[11px] font-semibold text-black cursor-pointer transition-all hover:-translate-y-0.5 shadow-[0_4px_15px_rgba(0,212,170,0.3)]"
        >
          تحديث الشريط
        </button>
      </div>

      {/* PWA Install */}
      {installPrompt && (
        <div className="block border border-[#1c2a3e] rounded-[10px] p-3.5 bg-gradient-to-br from-[#141d2a]/80 to-[#1a2535]/60">
          <div className="text-[11px] font-bold text-[#a855f7] mb-2.5 uppercase tracking-wide">
            📱 تثبيت التطبيق
          </div>
          <p className="text-[10px] text-[#6b7a99] mb-2">
            ثبّت Hammad Crypto على جهازك للوصول السريع والعمل بدون إنترنت
          </p>
          <button
            onClick={handleInstallPWA}
            className="w-full bg-gradient-to-br from-[#a855f7] to-[#6366f1] border-none rounded-lg px-3 py-2 text-[11px] font-semibold text-white cursor-pointer transition-all hover:-translate-y-0.5 shadow-[0_4px_15px_rgba(168,85,247,0.3)]"
          >
            📲 تثبيت التطبيق
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-3 text-[#3a4560] text-[9px] border-t border-[#1c2a3e] leading-6">
        برمجة وتطوير بكل ❤️ المهندس محمد حماد
        <br />
        <span className="text-[#00d4aa]">Hammad Crypto v3.2 Pro — PWA</span>
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
