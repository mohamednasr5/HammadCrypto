'use client';

import { useAppStore } from '@/lib/store';
import { getCoinMeta, fmt, fmtPrice } from '@/lib/utils';

export default function HomePage() {
  const { portfolio, loadingPortfolio, setCurrentTab } = useAppStore();

  if (loadingPortfolio) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 border-3 border-[#253448] border-t-[#00d4aa] rounded-full animate-spin" />
        <div className="text-[12px] text-[#6b7a99] font-medium">جاري تحميل المحفظة...</div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 gap-3">
        <div className="text-4xl mb-3">🔑</div>
        <div className="text-[13px] font-semibold text-[#dde3f0] mb-2">أضف مفاتيح OKX API</div>
        <div className="text-[11px] text-[#6b7a99] leading-7 text-center mb-4">
          اذهب إلى الإعدادات وأدخل
          <br />
          بيانات OKX API للبدء
        </div>
        <button
          onClick={() => setCurrentTab('settings')}
          className="bg-gradient-to-br from-[#00d4aa] to-[#4ecdc4] text-black font-bold text-[11px] px-5 py-2.5 rounded-lg shadow-[0_4px_15px_rgba(0,212,170,0.3)] hover:-translate-y-0.5 transition-transform"
        >
          ⚙️ فتح الإعدادات
        </button>
      </div>
    );
  }

  const { total, profit, egpRate, assets } = portfolio;
  const egp = total * (egpRate || 50.8);
  const todayPnl = assets.reduce((s, a) => s + (a.value * (a.dailyChangePct / 100) || 0), 0);

  return (
    <div className="pb-4">
      {/* Portfolio Card */}
      <div className="mx-3 mt-3 bg-gradient-to-br from-[#0d1828]/60 to-[#0f2035]/60 border border-[#253448] rounded-[14px] p-4 backdrop-blur-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-[10px] text-[#6b7a99] font-semibold uppercase tracking-wide mb-1">
              إجمالي المحفظة
            </div>
            <div className="text-[28px] font-black bg-gradient-to-r from-white to-[#dde3f0] bg-clip-text text-transparent leading-none">
              ${fmt(total, 2)}
            </div>
            <div className="text-[11px] text-[#f0b429] mt-1">ج.م {fmt(egp, 0)}</div>
          </div>
          <div className="bg-gradient-to-br from-[#00d4aa]/15 to-[#4ecdc4]/15 border border-[#00d4aa]/40 rounded-[10px] px-3 py-1.5 text-center shadow-[0_0_15px_rgba(0,212,170,0.1)]">
            <div className="text-[9px] text-[#6b7a99] font-semibold uppercase">صافي الربح</div>
            <div className={`text-[15px] font-extrabold ${profit >= 0 ? 'text-[#00d4aa]' : 'text-[#ff4757]'}`}>
              {profit >= 0 ? '+' : ''}${fmt(profit, 0)}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="group bg-gradient-to-br from-[#141d2a]/80 to-[#1a2535]/60 border border-[#1c2a3e] rounded-[10px] p-2.5 transition-all hover:-translate-y-1 hover:border-[#00d4aa] hover:shadow-[0_12px_24px_rgba(0,212,170,0.2)]">
            <div className="text-[9px] text-[#3a4560] font-semibold uppercase tracking-wide mb-1">ربح اليوم</div>
            <div className={`text-[14px] font-extrabold ${todayPnl >= 0 ? 'text-[#00d4aa]' : 'text-[#ff4757]'}`}>
              {todayPnl >= 0 ? '+' : ''}${fmt(todayPnl, 2)}
            </div>
          </div>
          <div className="group bg-gradient-to-br from-[#141d2a]/80 to-[#1a2535]/60 border border-[#1c2a3e] rounded-[10px] p-2.5 transition-all hover:-translate-y-1 hover:border-[#4ecdc4] hover:shadow-[0_12px_24px_rgba(78,205,196,0.2)]">
            <div className="text-[9px] text-[#3a4560] font-semibold uppercase tracking-wide mb-1">عدد العملات</div>
            <div className="text-[14px] font-extrabold text-[#4ecdc4]">{assets.length}</div>
          </div>
          <div className="group bg-gradient-to-br from-[#141d2a]/80 to-[#1a2535]/60 border border-[#1c2a3e] rounded-[10px] p-2.5 transition-all hover:-translate-y-1 hover:border-[#f0b429] hover:shadow-[0_12px_24px_rgba(240,180,41,0.2)]">
            <div className="text-[9px] text-[#3a4560] font-semibold uppercase tracking-wide mb-1">سعر الدولار</div>
            <div className="text-[14px] font-extrabold text-[#f0b429]">ج.م {(egpRate || 50.8).toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Assets Header */}
      <div className="flex justify-between items-center px-3 mt-3 mb-1">
        <span className="text-[11px] font-bold text-[#6b7a99] uppercase tracking-wide">الأصول النشطة</span>
        <span className="text-[9px] bg-gradient-to-br from-[#00d4aa]/15 to-[#4ecdc4]/15 border border-[#00d4aa]/40 rounded-md px-2 py-0.5 text-[#00d4aa] font-semibold">
          {assets.length} عملة
        </span>
      </div>

      {/* Assets List */}
      <div>
        {assets.map((a, i) => {
          const m = getCoinMeta(a.sym);
          const pos = a.unrealizedPnL >= 0;
          return (
            <div
              key={i}
              className="grid grid-cols-[40px_1fr_auto] gap-2.5 items-center px-3 py-2.5 border-b border-[#1c2a3e]/60 transition-all hover:bg-[#00d4aa]/5 hover:pl-4 relative group"
            >
              {/* Left accent line */}
              <div className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-transparent via-[#00d4aa] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold border-2 shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.3)] relative overflow-hidden transition-transform group-hover:scale-110"
                style={{
                  background: `${m.bg}20`,
                  color: m.bg,
                  borderColor: `${m.bg}50`,
                }}
              >
                {m.icon}
                <div className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent)]" />
              </div>

              {/* Middle */}
              <div className="min-w-0">
                <div className="text-[13px] font-extrabold text-[#dde3f0] tracking-wide">{a.sym}</div>
                <div className="text-[9px] text-[#6b7a99] mt-0.5 truncate">
                  {fmt(a.qty, 4)} · avg ${fmtPrice(a.avgBuy || a.price)} ·{' '}
                  <span className={a.dailyChangePct >= 0 ? 'text-[#00d4aa]' : 'text-[#ff4757]'}>
                    {a.dailyChangePct >= 0 ? '▲' : '▼'} {Math.abs(a.dailyChangePct).toFixed(2)}%
                  </span>
                </div>
                <div className="h-[3px] bg-[#1c2a3e] rounded mt-1 overflow-hidden">
                  <div
                    className="h-full rounded bg-gradient-to-r from-[#00d4aa] to-[#4ecdc4] transition-all duration-700"
                    style={{ width: `${a.allocPct.toFixed(1)}%` }}
                  />
                </div>
              </div>

              {/* Right */}
              <div className="text-left shrink-0 px-1">
                <div className="text-[13px] font-extrabold text-[#dde3f0] tracking-wide">${fmt(a.value, 2)}</div>
                <div className={`text-[10px] mt-0.5 font-semibold ${pos ? 'text-[#00d4aa]' : 'text-[#ff4757]'}`}>
                  {pos ? '+' : ''}${fmt(a.unrealizedPnL, 2)}
                </div>
                <div className={`text-[9px] mt-0.5 ${pos ? 'text-[#00d4aa]' : 'text-[#ff4757]'}`}>
                  {pos ? '+' : ''}{fmt(a.unrealizedPnLPct, 1)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
