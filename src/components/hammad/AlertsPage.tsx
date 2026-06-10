'use client';

import { useAppStore } from '@/lib/store';
import { fmtTime } from '@/lib/utils';

export default function AlertsPage() {
  const { alerts, clearAlerts } = useAppStore();

  const colMap: Record<string, string> = {
    profit: '#00d4aa',
    alert: '#ff4757',
    ai: '#a855f7',
    info: '#4ecdc4',
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center px-3 py-2.5 border-b border-[#1c2a3e]">
        <span className="text-[12px] font-bold uppercase">🔔 التنبيهات</span>
        <button
          onClick={clearAlerts}
          className="bg-[#1a2535] border border-[#1c2a3e] rounded-md px-2.5 py-1 text-[9px] text-[#6b7a99] cursor-pointer hover:border-[#ff4757] hover:text-[#ff4757] transition-all"
        >
          مسح الكل
        </button>
      </div>

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <div className="text-center py-12 text-[#3a4560] text-[12px] leading-7">لا توجد تنبيهات</div>
      ) : (
        <div>
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`flex items-start gap-2.5 px-3 py-2.5 border-b border-[#1c2a3e]/60 transition-all hover:bg-[#141d2a] ${
                !a.read ? 'bg-[#141d2a]/50' : ''
              }`}
            >
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style={{ background: colMap[a.type] || '#4ecdc4' }}
              />
              <div>
                <div className="text-[11px] font-semibold text-[#dde3f0]">{a.title}</div>
                <div className="text-[9px] text-[#6b7a99] mt-0.5">{a.body}</div>
                <div className="text-[8px] text-[#3a4560] mt-0.5">{fmtTime(a.time)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
