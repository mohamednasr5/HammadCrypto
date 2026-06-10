import { NextRequest, NextResponse } from 'next/server';

const OKX_BASE = 'https://www.okx.com';
const AI_ENDPOINT = 'https://taybat-ai.studegy8.workers.dev/';

// Safe base64 for Unicode
function safeBase64Decode(b64: string): string {
  return decodeURIComponent(
    atob(b64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

function getCredentialsFromHeader(req: NextRequest): {
  apiKey: string;
  secretKey: string;
  passphrase: string;
} | null {
  const enc = req.headers.get('x-okx-creds');
  if (!enc) return null;
  try {
    return JSON.parse(safeBase64Decode(enc));
  } catch {
    return null;
  }
}

// HMAC-SHA256 signing
async function hmacSHA256(key: string, msg: string): Promise<string> {
  const k = new TextEncoder().encode(key);
  const m = new TextEncoder().encode(msg);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    k,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, m);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function getOKXHeaders(
  method: string,
  path: string,
  creds: { apiKey: string; secretKey: string; passphrase: string },
  body = ''
) {
  const ts = new Date().toISOString();
  const preSign = ts + method.toUpperCase() + path + body;
  const sign = await hmacSHA256(creds.secretKey, preSign);
  return {
    'OK-ACCESS-KEY': creds.apiKey,
    'OK-ACCESS-SIGN': sign,
    'OK-ACCESS-TIMESTAMP': ts,
    'OK-ACCESS-PASSPHRASE': creds.passphrase,
    'Content-Type': 'application/json',
  };
}

// Fetch OKX Balance
async function fetchBalance(creds: {
  apiKey: string;
  secretKey: string;
  passphrase: string;
}) {
  const path = '/api/v5/account/balance';
  const headers = await getOKXHeaders('GET', path, creds);
  try {
    const res = await fetch(`${OKX_BASE}${path}`, { headers });
    const data = await res.json();
    return data.code === '0' ? data.data : null;
  } catch {
    return null;
  }
}

// Fetch Ticker
async function fetchTicker(instId: string) {
  try {
    const res = await fetch(`${OKX_BASE}/api/v5/market/ticker?instId=${instId}`);
    const data = await res.json();
    return data.code === '0' ? data.data[0] : null;
  } catch {
    return null;
  }
}

// Fetch Order History
async function fetchOrderHistory(
  instId: string,
  creds: { apiKey: string; secretKey: string; passphrase: string }
) {
  const path = `/api/v5/trade/orders-history?instType=SPOT&instId=${instId}&limit=50`;
  const headers = await getOKXHeaders('GET', path, creds);
  try {
    const res = await fetch(`${OKX_BASE}${path}`, { headers });
    const data = await res.json();
    return data.code === '0' ? data.data : [];
  } catch {
    return [];
  }
}

function computeAvgBuy(orders: { side: string; state: string; fillSz?: string; avgPx?: string }[]) {
  let totalCost = 0;
  let totalQty = 0;
  for (const o of orders) {
    if (o.side === 'buy' && o.state === 'filled') {
      const qty = parseFloat(o.fillSz || '0');
      const price = parseFloat(o.avgPx || '0');
      totalCost += qty * price;
      totalQty += qty;
    }
  }
  return totalQty > 0 ? totalCost / totalQty : 0;
}

// Fetch EGP Rate
async function fetchEGPRate(): Promise<number> {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await res.json();
    return data.rates?.EGP || 50.8;
  } catch {
    return 50.8;
  }
}

// Build Portfolio
async function buildPortfolio(creds: {
  apiKey: string;
  secretKey: string;
  passphrase: string;
}) {
  const balData = await fetchBalance(creds);
  if (!balData || !balData[0]) return null;
  const details = balData[0].details || [];
  const assets = [];
  let totalVal = 0;
  const validAssets = details.filter(
    (d: { ccy: string; eq: string }) => d.ccy !== 'USDT' && parseFloat(d.eq || '0') > 0
  );

  for (const d of validAssets) {
    const sym = d.ccy;
    const qty = parseFloat(d.eq || '0');
    const ticker = await fetchTicker(sym + '-USDT');
    if (!ticker) continue;
    const price = parseFloat(ticker.last);
    const value = qty * price;
    if (value < 1) continue;
    const open24h = parseFloat(ticker.open24h || String(price));
    const dailyChangePct = open24h > 0 ? ((price - open24h) / open24h) * 100 : 0;
    const orders = await fetchOrderHistory(sym + '-USDT', creds);
    const avgBuy = computeAvgBuy(orders);
    const costBasis = avgBuy * qty;
    const unrealizedPnL = value - costBasis;
    const unrealizedPnLPct = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;
    assets.push({
      sym,
      qty,
      price,
      value,
      avgBuy,
      costBasis,
      unrealizedPnL,
      unrealizedPnLPct,
      dailyChangePct,
    });
    totalVal += value;
  }

  for (const a of assets) a.allocPct = totalVal > 0 ? (a.value / totalVal) * 100 : 0;
  const totalInvested = assets.reduce((s: number, a: { costBasis: number; value: number }) => s + (a.costBasis || a.value), 0);
  const egpRate = await fetchEGPRate();

  return {
    total: totalVal,
    invested: totalInvested,
    profit: totalVal - totalInvested,
    egpRate,
    assets,
    ts: Date.now(),
  };
}

// AI Analysis
async function analyzeAsset(asset: {
  sym: string;
  price: number;
  dailyChangePct: number;
  avgBuy: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  allocPct: number;
}): Promise<Record<string, unknown>> {
  const prompt = `أنت محلل تداول خبير. حلل العملة الرقمية بالبيانات التالية وأعط توصية واضحة.

العملة: ${asset.sym}
السعر الحالي: $${asset.price}
التغير اليومي: ${asset.dailyChangePct.toFixed(2)}%
متوسط سعر الشراء: $${asset.avgBuy || asset.price}
الربح/الخسارة غير المحققة: ${asset.unrealizedPnL >= 0 ? '+' : ''}$${asset.unrealizedPnL.toFixed(2)} (${asset.unrealizedPnLPct.toFixed(1)}%)
نسبة التخصيص في المحفظة: ${asset.allocPct.toFixed(1)}%

أجب بـ JSON فقط بدون أي نص إضافي:
{"trend":"صاعد أو هابط أو محايد","signal":"buy أو sell أو hold","reason":"تحليل مختصر باللغة العربية 2-3 جمل","support":0.0,"resistance":0.0,"stopLoss":0.0,"confidence":75,"bullScore":70,"bearScore":30}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return {};
    const data = await res.json();
    let txt = '';
    if (data.content && Array.isArray(data.content)) {
      txt = data.content.find((b: { type: string }) => b.type === 'text')?.text || '';
    } else if (data.text) {
      txt = data.text;
    } else if (typeof data === 'string') {
      txt = data;
    }
    if (!txt) return {};
    const jsonMatch = txt.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return {};
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {};
  }
}

// ========= ROUTE HANDLERS =========

// GET: /api/okx/portfolio  — Get portfolio
// GET: /api/okx/ai — Get AI analyses
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  // Portfolio
  if (action === 'portfolio' || url.pathname.endsWith('/portfolio')) {
    const creds = getCredentialsFromHeader(req);
    if (!creds) {
      return NextResponse.json({ error: 'No credentials' }, { status: 401 });
    }
    const portfolio = await buildPortfolio(creds);
    return NextResponse.json({ portfolio });
  }

  // AI
  if (action === 'ai' || url.pathname.endsWith('/ai')) {
    const creds = getCredentialsFromHeader(req);
    if (!creds) {
      return NextResponse.json({ error: 'No credentials' }, { status: 401 });
    }
    const portfolio = await buildPortfolio(creds);
    if (!portfolio || !portfolio.assets?.length) {
      return NextResponse.json({ analyses: [] });
    }
    const analyses = [];
    for (const asset of portfolio.assets) {
      const analysis = await analyzeAsset(asset);
      analyses.push({ ...asset, ...analysis });
    }
    return NextResponse.json({ analyses, lastUpdate: Date.now() });
  }

  // Test connection
  if (action === 'test' || url.pathname.endsWith('/test')) {
    const creds = getCredentialsFromHeader(req);
    if (!creds) {
      return NextResponse.json({ error: 'No credentials' }, { status: 401 });
    }
    const path = '/api/v5/account/balance';
    const headers = await getOKXHeaders('GET', path, creds);
    try {
      const res = await fetch(`${OKX_BASE}${path}`, { headers });
      return NextResponse.json({ ok: res.ok, status: res.status });
    } catch {
      return NextResponse.json({ ok: false, error: 'Network error' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// POST: /api/okx/portfolio — Build & return portfolio
// POST: /api/okx/ai — Run AI analysis
// POST: /api/okx/test — Test connection
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  let creds: { apiKey: string; secretKey: string; passphrase: string } | null = null;

  // Try to get creds from header or body
  const headerCreds = getCredentialsFromHeader(req);
  if (headerCreds) {
    creds = headerCreds;
  } else {
    try {
      const body = await req.json();
      if (body.apiKey && body.secretKey && body.passphrase) {
        creds = body;
      }
    } catch {
      // no body
    }
  }

  // Test connection
  if (action === 'test' || url.pathname.endsWith('/test')) {
    if (!creds) {
      return NextResponse.json({ ok: false, error: 'No credentials provided' }, { status: 400 });
    }
    const path = '/api/v5/account/balance';
    const headers = await getOKXHeaders('GET', path, creds);
    try {
      const res = await fetch(`${OKX_BASE}${path}`, { headers });
      const data = await res.json();
      return NextResponse.json({ ok: data.code === '0', status: res.status });
    } catch {
      return NextResponse.json({ ok: false, error: 'Network error' }, { status: 500 });
    }
  }

  // Portfolio
  if (action === 'portfolio' || url.pathname.endsWith('/portfolio')) {
    if (!creds) {
      return NextResponse.json({ error: 'No credentials' }, { status: 401 });
    }
    const portfolio = await buildPortfolio(creds);
    return NextResponse.json({ portfolio });
  }

  // AI analysis
  if (action === 'ai' || url.pathname.endsWith('/ai')) {
    if (!creds) {
      return NextResponse.json({ error: 'No credentials' }, { status: 401 });
    }
    const portfolio = await buildPortfolio(creds);
    if (!portfolio || !portfolio.assets?.length) {
      return NextResponse.json({ analyses: [] });
    }
    const analyses = [];
    for (const asset of portfolio.assets) {
      const analysis = await analyzeAsset(asset);
      analyses.push({ ...asset, ...analysis });
    }
    return NextResponse.json({ analyses, lastUpdate: Date.now() });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
