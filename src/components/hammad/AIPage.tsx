'use client';

import { useAppStore } from '@/lib/store';
import { getCoinMeta, fmtPrice, fmtTime } from '@/lib/utils';

export default function AIPage() {
  const { aiAnalyses, aiLastUpdate, loadingAI, runAI } = useAppStore();

  return (
    <div>
      {/* Top Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2.5 bg-gradient-to-r from-[#a855f7]/8 to-[#00d4aa]/8 border-b border-[#1c2a3e]">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-br from-[#a855f7] to-[#6366f1] rounded-md px-2 py-0.5 text-[9px] font-bold text-white shadow-[0_4px_12px_rgba(168,85,247,0.3)]">
            AI
          </span>
          <span className="text-[12px] font-bold uppercase tracking-wide text-[#dde3f0]">
            التحليل الذكي
          </span>
        </div>
        <span className="text-[9px] text-[#6b7a99]">
          {aiLastUpdate ? `آخر تحديث: ${fmtTime(new Date(aiLastUpdate))}` : '—'}
        </span>
        <button
          onClick={runAI}
          disabled={loadingAI}
          className="bg-gradient-to-br from-[#00d4aa] to-[#4ecdc4] border-none rounded-lg px-3 py-1.5 text-[10px] font-bold text-black cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,212,170,0.4)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-[0_4px_15px_rgba(0,212,170,0.3)]"
        >
          {loadingAI ? '⏳ جاري التحليل...' : 'تحليل الآن ▶'}
        </button>
      </div>

      {/* Content */}
      {loadingAI ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-3 border-[#253448] border-t-[#a855f7] rounded-full animate-spin" />
          <div className="text-[12px] text-[#6b7a99] font-medium">جاري تحليل العملات بالذكاء الاصطناعي...</div>
        </div>
      ) : aiAnalyses.length === 0 ? (
        <div className="text-center py-14 px-6 text-[#3a4560] text-[12px] leading-7">
          🤖 اضغط &quot;تحليل الآن&quot; لبدء تحليل العملات بالذكاء الاصطناعي
        </div>
      ) : (
        <div className="p-2.5 space-y-2.5">
          {aiAnalyses.map((a, i) => {
            const m = getCoinMeta(a.sym);
            const sig = a.signal || 'hold';
            const conf = a.confidence || 50;
            const bull = a.bullScore || 50;
            const bear = a.bearScore || 50;
            const sigLabel = sig === 'buy' ? '🟢 شراء' : sig === 'sell' ? '🔴 بيع' : '🟡 انتظار';

            return (
              <div
                key={i}
                className="bg-gradient-to-br from-[#141d2a]/90 to-[#1a2535]/70 border border-[#253448] rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all hover:-translate-y-1.5 hover:border-[#00d4aa] hover:shadow-[0_12px_40px_rgba(0,212,170,0.25)] relative group"
              >
                {/* Top glow line */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00d4aa] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Card Header */}
                <div className="flex items-center gap-2.5 px-3.5 py-3 bg-gradient-to-br from-[#141d2a]/80 to-[#1a2535]/60 border-b border-[#1c2a3e] relative z-10">
                  <div
                    className="w-9 h-9 rounded-[10px] flex items-center justify-center text-sm font-bold border-2 shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.3)] relative overflow-hidden transition-transform group-hover:scale-110 group-hover:rotate-3"
                    style={{
                      background: `${m.bg}20`,
                      color: m.bg,
                      borderColor: `${m.bg}50`,
                    }}
                  >
                    {m.icon}
                    <div className="absolute inset-0 rounded-[10px] bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-extrabold tracking-wide">{a.sym}</div>
                    <div className="text-[10px] text-[#6b7a99] mt-0.5">
                      ${fmtPrice(a.price)} · {a.trend || 'محايد'}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-bold mr-auto ${
                      sig === 'buy'
                        ? 'bg-[#00d4aa]/20 border border-[#00d4aa]/50 text-[#00d4aa]'
                        : sig === 'sell'
                        ? 'bg-[#ff4757]/20 border border-[#ff4757]/50 text-[#ff4757]'
                        : 'bg-[#f0b429]/20 border border-[#f0b429]/50 text-[#f0b429]'
                    }`}
                  >
                    {sigLabel}
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-3.5 relative z-10">
                  <div className="text-[10px] text-[#6b7a99] leading-6 mb-2.5 p-2 bg-black/20 border-r-3 border-[#00d4aa] rounded">
                    {a.reason || 'لا يوجد تحليل متاح'}
                  </div>

                  {/* Scores */}
                  <div className="grid grid-cols-3 gap-2 mb-2.5">
                    <div className="bg-black/30 border border-[#1c2a3e] rounded-lg p-2 text-center transition-all hover:border-[#00d4aa] hover:bg-[#00d4aa]/5">
                      <div className="text-[8px] text-[#3a4560] font-semibold uppercase mb-1">الثقة</div>
                      <div className="text-[14px] font-extrabold text-[#4ecdc4]">{conf}%</div>
                      <div className="h-[3px] bg-[#1c2a3e] rounded mt-1 overflow-hidden">
                        <div className="h-full rounded bg-[#4ecdc4] transition-all" style={{ width: `${conf}%` }} />
                      </div>
                    </div>
                    <div className="bg-black/30 border border-[#1c2a3e] rounded-lg p-2 text-center transition-all hover:border-[#00d4aa] hover:bg-[#00d4aa]/5">
                      <div className="text-[8px] text-[#3a4560] font-semibold uppercase mb-1">صعودي</div>
                      <div className="text-[14px] font-extrabold text-[#00d4aa]">{bull}%</div>
                      <div className="h-[3px] bg-[#1c2a3e] rounded mt-1 overflow-hidden">
                        <div className="h-full rounded bg-[#00d4aa] transition-all" style={{ width: `${bull}%` }} />
                      </div>
                    </div>
                    <div className="bg-black/30 border border-[#1c2a3e] rounded-lg p-2 text-center transition-all hover:border-[#00d4aa] hover:bg-[#00d4aa]/5">
                      <div className="text-[8px] text-[#3a4560] font-semibold uppercase mb-1">هبوطي</div>
                      <div className="text-[14px] font-extrabold text-[#ff4757]">{bear}%</div>
                      <div className="h-[3px] bg-[#1c2a3e] rounded mt-1 overflow-hidden">
                        <div className="h-full rounded bg-[#ff4757] transition-all" style={{ width: `${bear}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Levels */}
                  {a.support ? (
                    <div className="flex gap-2 flex-wrap text-[9px] bg-black/20 rounded-lg p-2 border border-[#1c2a3e]">
                      <div className="flex items-center gap-1 flex-1 min-w-[80px]">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00d4aa] shrink-0" />
                        <span className="text-[#00d4aa]">دعم: ${fmtPrice(a.support)}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-1 min-w-[80px]">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#ff4757] shrink-0" />
                        <span className="text-[#ff4757]">مقاومة: ${fmtPrice(a.resistance || 0)}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-1 min-w-[80px]">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#f0b429] shrink-0" />
                        <span className="text-[#f0b429]">وقف: ${fmtPrice(a.stopLoss || 0)}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
