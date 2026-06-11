// ============================================================
// Hammad Crypto — Background Service Worker v3
// ============================================================

const OKX_BASE = 'https://www.okx.com';
const AI_ENDPOINT = 'https://taybat-ai.studegy8.workers.dev/';
const REFRESH_INTERVAL_MINUTES = 1;
const AI_INTERVAL_MINUTES = 3;

// ---- btoa آمن مع Unicode ----
function safeBase64Encode(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
    (_, p1) => String.fromCharCode(parseInt(p1, 16))));
}
function safeBase64Decode(b64) {
  return decodeURIComponent(atob(b64).split('').map(
    c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
}

// ---- Side Panel Setup ----
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
  runRefresh();
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Hammad Crypto مُثبَّت ✅',
    message: 'اضغط الأيقونة لفتح الشريط الجانبي الثابت',
    priority: 1
  });
});

chrome.runtime.onStartup.addListener(async () => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
  await runRefresh();
  const { data } = await getPortfolioCache();
  if (data) updateBadge(data);
});

// ---- HMAC-SHA256 ----
async function hmacSHA256(key, msg) {
  const k = new TextEncoder().encode(key);
  const m = new TextEncoder().encode(msg);
  const cryptoKey = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, m);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function getOKXHeaders(method, path, body = '') {
  const creds = await getCredentials();
  if (!creds) return null;
  const ts = new Date().toISOString();
  const preSign = ts + method.toUpperCase() + path + body;
  const sign = await hmacSHA256(creds.secretKey, preSign);
  return {
    'OK-ACCESS-KEY': creds.apiKey,
    'OK-ACCESS-SIGN': sign,
    'OK-ACCESS-TIMESTAMP': ts,
    'OK-ACCESS-PASSPHRASE': creds.passphrase,
    'Content-Type': 'application/json'
  };
}

// ---- Storage ----
async function getCredentials() {
  const result = await chrome.storage.local.get('okx_creds_enc');
  if (!result.okx_creds_enc) return null;
  try { return JSON.parse(safeBase64Decode(result.okx_creds_enc)); } catch { return null; }
}

async function hasCredentials() {
  const creds = await getCredentials();
  return !!creds && !!creds.apiKey && !!creds.secretKey && !!creds.passphrase;
}

async function savePortfolioCache(data) {
  await chrome.storage.local.set({ portfolio_cache: data, portfolio_last_update: Date.now() });
}

async function getPortfolioCache() {
  const r = await chrome.storage.local.get(['portfolio_cache', 'portfolio_last_update']);
  return { data: r.portfolio_cache, lastUpdate: r.portfolio_last_update };
}

// ---- OKX Fetch ----
async function fetchBalance() {
  const headers = await getOKXHeaders('GET', '/api/v5/account/balance');
  if (!headers) return null;
  try {
    const res = await fetch(`${OKX_BASE}/api/v5/account/balance`, { headers });
    const data = await res.json();
    return data.code === '0' ? data.data : null;
  } catch { return null; }
}

async function fetchTicker(instId) {
  try {
    const res = await fetch(`${OKX_BASE}/api/v5/market/ticker?instId=${instId}`);
    const data = await res.json();
    return data.code === '0' ? data.data[0] : null;
  } catch { return null; }
}

async function fetchOrderHistory(instId) {
  const path = `/api/v5/trade/orders-history?instType=SPOT&instId=${instId}&limit=50`;
  const headers = await getOKXHeaders('GET', path);
  if (!headers) return [];
  try {
    const res = await fetch(`${OKX_BASE}${path}`, { headers });
    const data = await res.json();
    return data.code === '0' ? data.data : [];
  } catch { return []; }
}

function computeAvgBuy(orders) {
  let totalCost = 0, totalQty = 0;
  for (const o of orders) {
    if (o.side === 'buy' && o.state === 'filled') {
      const qty = parseFloat(o.fillSz || 0);
      const price = parseFloat(o.avgPx || 0);
      totalCost += qty * price;
      totalQty += qty;
    }
  }
  return totalQty > 0 ? totalCost / totalQty : 0;
}

async function fetchEGPRate() {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await res.json();
    return data.rates?.EGP || 50.8;
  } catch { return 50.8; }
}

// ---- Build Portfolio ----
async function buildPortfolio() {
  const balData = await fetchBalance();
  if (!balData || !balData[0]) return null;
  const details = balData[0].details || [];
  const assets = [];
  let totalVal = 0;
  const validAssets = details.filter(d => d.ccy !== 'USDT' && parseFloat(d.eq || 0) > 0);
  for (const d of validAssets) {
    const sym = d.ccy;
    const qty = parseFloat(d.eq || 0);
    const ticker = await fetchTicker(sym + '-USDT');
    if (!ticker) continue;
    const price = parseFloat(ticker.last);
    const value = qty * price;
    if (value < 1) continue;
    const open24h = parseFloat(ticker.open24h || price);
    const dailyChangePct = open24h > 0 ? ((price - open24h) / open24h) * 100 : 0;
    const orders = await fetchOrderHistory(sym + '-USDT');
    const avgBuy = computeAvgBuy(orders);
    const costBasis = avgBuy * qty;
    const unrealizedPnL = value - costBasis;
    const unrealizedPnLPct = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;
    assets.push({ sym, qty, price, value, avgBuy, costBasis, unrealizedPnL, unrealizedPnLPct, dailyChangePct });
    totalVal += value;
  }
  for (const a of assets) a.allocPct = totalVal > 0 ? (a.value / totalVal) * 100 : 0;
  const totalInvested = assets.reduce((s, a) => s + (a.costBasis || a.value), 0);
  const egpRate = await fetchEGPRate();
  return { total: totalVal, invested: totalInvested, profit: totalVal - totalInvested, egpRate, assets, ts: Date.now() };
}

// ---- AI Analysis ----
async function analyzeAsset(asset) {
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
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) { console.error('AI HTTP error:', res.status); return {}; }
    const data = await res.json();
    let txt = '';
    if (data.content && Array.isArray(data.content)) {
      txt = data.content.find(b => b.type === 'text')?.text || '';
    } else if (data.text) {
      txt = data.text;
    } else if (typeof data === 'string') {
      txt = data;
    }
    if (!txt) { console.error('AI empty response for', asset.sym); return {}; }
    const jsonMatch = txt.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) { console.error('AI no JSON in response:', txt); return {}; }
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed;
  } catch (e) {
    console.error('analyzeAsset error for', asset.sym, ':', e.message || e);
    return {};
  }
}

// ---- Alerts ----
async function checkProfitAlerts(portfolio) {
  const stored = await chrome.storage.local.get(['prev_profit', 'alerted_thresholds', 'profit_threshold']);
  const threshold = stored.profit_threshold || 50;
  const prevProfit = stored.prev_profit || 0;
  const alertedThresholds = new Set(stored.alerted_thresholds || []);
  const profit = portfolio.profit;
  const level = Math.floor(profit / threshold) * threshold;
  if (level > 0 && !alertedThresholds.has(level) && profit > prevProfit) {
    alertedThresholds.add(level);
    await chrome.storage.local.set({ prev_profit: profit, alerted_thresholds: [...alertedThresholds] });
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon128.png', title: '🎉 Hammad Crypto — ربح جديد!', message: `وصل ربحك إلى +$${level} 💰`, priority: 2 });
  }
  await chrome.storage.local.set({ prev_profit: profit });
}

async function checkPriceAlerts(portfolio) {
  const stored = await chrome.storage.local.get('price_alerts');
  const priceAlerts = stored.price_alerts || [];
  for (const alert of priceAlerts) {
    if (alert.triggered) continue;
    const asset = portfolio.assets.find(a => a.sym === alert.sym);
    if (!asset) continue;
    let triggered = false;
    if (alert.type === 'above' && asset.price >= alert.price) triggered = true;
    if (alert.type === 'below' && asset.price <= alert.price) triggered = true;
    if (alert.type === 'pct' && Math.abs(asset.dailyChangePct) >= alert.pct) triggered = true;
    if (triggered) {
      alert.triggered = true;
      chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon128.png', title: `🔔 تنبيه — ${alert.sym}`, message: `${alert.sym} وصل إلى $${asset.price.toFixed(4)}`, priority: 2 });
    }
  }
  await chrome.storage.local.set({ price_alerts: priceAlerts });
}

function updateBadge(portfolio) {
  if (!portfolio) { chrome.action.setBadgeText({ text: '' }); return; }
  const profit = portfolio.profit;
  const abs = Math.abs(profit);
  let text = abs >= 1000 ? (profit >= 0 ? '+' : '-') + Math.round(abs / 1000) + 'K'
           : abs >= 1 ? (profit >= 0 ? '+' : '') + Math.round(profit) : profit >= 0 ? '+' : '-';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: profit >= 0 ? '#10b981' : '#ef4444' });
}

async function broadcastToTabs(msg) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
  }
}

async function runRefresh() {
  const portfolio = await buildPortfolio();
  if (!portfolio) return;
  await savePortfolioCache(portfolio);
  await checkProfitAlerts(portfolio);
  await checkPriceAlerts(portfolio);
  updateBadge(portfolio);
  chrome.runtime.sendMessage({ type: 'PORTFOLIO_UPDATED', data: portfolio }).catch(() => {});
  broadcastToTabs({ type: 'PORTFOLIO_UPDATED', data: portfolio });
}

async function runAITask() {
  const { data: portfolio } = await getPortfolioCache();
  if (!portfolio || !portfolio.assets?.length) return;
  const analyses = [];
  for (const asset of portfolio.assets) {
    const analysis = await analyzeAsset(asset);
    analyses.push({ ...asset, ...analysis });
  }
  await chrome.storage.local.set({ ai_analyses: analyses, ai_last_update: Date.now() });
  chrome.runtime.sendMessage({ type: 'AI_UPDATED', data: analyses }).catch(() => {});
  broadcastToTabs({ type: 'AI_UPDATED', data: analyses });
}

// ---- Alarms ----
chrome.alarms.create('refresh', { periodInMinutes: REFRESH_INTERVAL_MINUTES });
chrome.alarms.create('ai_analysis', { periodInMinutes: AI_INTERVAL_MINUTES });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refresh') runRefresh();
  if (alarm.name === 'ai_analysis') runAITask();
});

// ---- Message Handler ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_PORTFOLIO') {
    getPortfolioCache().then(({ data, lastUpdate }) => sendResponse({ data, lastUpdate }));
    return true;
  }
  if (msg.type === 'GET_AI') {
    chrome.storage.local.get(['ai_analyses', 'ai_last_update']).then(r => sendResponse({ data: r.ai_analyses, lastUpdate: r.ai_last_update }));
    return true;
  }
  if (msg.type === 'CHECK_CREDENTIALS') {
    hasCredentials().then(has => sendResponse({ hasCredentials: has }));
    return true;
  }
  if (msg.type === 'SAVE_CREDENTIALS') {
    const enc = safeBase64Encode(JSON.stringify(msg.creds));
    chrome.storage.local.set({ okx_creds_enc: enc }).then(() => { runRefresh(); sendResponse({ ok: true }); });
    return true;
  }
  if (msg.type === 'REMOVE_CREDENTIALS') {
    chrome.storage.local.remove(['okx_creds_enc', 'portfolio_cache']).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'FORCE_REFRESH') {
    runRefresh().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'RUN_AI') {
    runAITask().then(() => sendResponse({ ok: true }));
    return true;
  }
});
