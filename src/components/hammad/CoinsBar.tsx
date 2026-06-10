'use client';

import { useAppStore } from '@/lib/store';
import { DEMO_PRICES, fmtPrice } from '@/lib/utils';
import { useEffect, useState } from 'react';

export default function CoinsBar() {
  const { tickerCoins } = useAppStore();
  const [tickData, setTickData] = useState(DEMO_PRICES);

  useEffect(() => {
    // Simulate live price updates
    const interval = setInterval(() => {
      setTickData((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          next[key] = {
            ...next[key],
            c: parseFloat((next[key].c + (Math.random() - 0.5) * 0.4).toFixed(2)),
          };
        }
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const coins = tickerCoins
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  return (
    <div className="flex-shrink-0 bg-gradient-to-r from-[#0f1420]/60 to-[#141d2a]/60 border-b border-[#1c2a3e] px-3 py-2 overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 min-w-max">
        {coins.map((sym) => {
          const d = tickData[sym] || {
            p: parseFloat((Math.random() * 100).toFixed(4)),
            c: parseFloat(((Math.random() - 0.5) * 10).toFixed(2)),
          };
          const up = d.c >= 0;
          return (
            <div
              key={sym}
              className="flex items-center gap-1.5 bg-gradient-to-br from-[#141d2a]/70 to-[#1a2535]/70 border border-[#1c2a3e] rounded-lg px-2.5 py-1.5 whitespace-nowrap transition-all hover:border-[#00d4aa] hover:bg-[#00d4aa]/10 hover:-translate-y-0.5 cursor-default"
            >
              <span className="text-[11px] font-bold text-[#dde3f0] min-w-[35px]">{sym}</span>
              <span className="text-[10px] text-[#6b7a99]">${fmtPrice(d.p)}</span>
              <span className={`text-[10px] font-semibold min-w-[40px] text-left ${up ? 'text-[#00d4aa]' : 'text-[#ff4757]'}`}>
                {up ? '+' : ''}{d.c.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
