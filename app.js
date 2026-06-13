'use strict';
// ============================================================
// Hammad Crypto PWA — app.js v3.8 WITH SOUND NOTIFICATIONS
// Storage: localStorage (persistent across sessions)
// ============================================================

// ── Constants ──────────────────────────────────────────────
const OKX_BASE = 'https://www.okx.com';
const AI_ENDPOINT = 'https://text.pollinations.ai/';
const DEFAULT_COINS = 'BTC,ETH,SOL,BNB,KAT,PI,OFC';
const STORAGE_KEY_CREDS = 'hc_okx_creds';         // persists forever
const STORAGE_KEY_PORTFOLIO = 'hc_portfolio';      // cached portfolio
const STORAGE_KEY_AI = 'hc_ai_analyses';
const STORAGE_KEY_ALERTS = 'hc_alerts';
const STORAGE_KEY_TICKER = 'hc_ticker_coins';
const STORAGE_KEY_PREV_PROFIT = 'hc_prev_profit';
const STORAGE_KEY_NOTIF = 'hc_notifications';
const STORAGE_KEY_THRESHOLD = 'hc_profit_threshold';

// ── State ──────────────────────────────────────────────────
let portfolio = null;
let aiAnalyses = [];
let alerts = [];
let currentTab = 'home';
let carouselAssets = [];
let carouselIdx = 0;
let carouselTimer = null;
let deferredInstall = null;
let notifGranted = false;
let refreshTimer = null;

// ── Coin metadata ──────────────────────────────────────────
const COIN_META = {
  BTC:{bg:'#f7931a',icon:'₿'},ETH:{bg:'#627eea',icon:'Ξ'},
  USDT:{bg:'#26a17b',icon:'$'},USDC:{bg:'#2775ca',icon:'$'},
  BNB:{bg:'#f3ba2f',icon:'B'},SOL:{bg:'#9945ff',icon:'◎'},
  XRP:{bg:'#346aa9',icon:'X'},ADA:{bg:'#627eea',icon:'A'},
  TON:{bg:'#0088cc',icon:'T'},KAT:{bg:'#ff6b35',icon:'K'},
  PI:{bg:'#8b4513',icon:'π'},OFC:{bg:'#4ecdc4',icon:'O'},
  BASED:{bg:'#0052ff',icon:'B'},CHIP:{bg:'#a855f7',icon:'C'},
  LTC:{bg:'#bfbbbb',icon:'Ł'},DOT:{bg:'#e6007a',icon:'●'},
};

function meta(sym) {
  const s = sym.toUpperCase().replace(/-USDT$|-USD$/g,'');
  return COIN_META[s] || {bg:'#4ecdc4', icon:s.charAt(0)};
}

// ── localStorage helpers ───────────────────────────────────
// All data persists permanently — never cleared on app exit
function lsGet(key, def=null) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
  catch { return def; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch(e) { console.warn('lsSet error', key, e); return false; }
}
function lsDel(key) { try { localStorage.removeItem(key); } catch {} }

// ── Credentials (encrypted via btoa, never cleared) ────────
function encodeCreds(obj) { return btoa(encodeURIComponent(JSON.stringify(obj))); }
function decodeCreds(s) {
  try { return JSON.parse(decodeURIComponent(atob(s))); } catch { return null; }
}
function saveCreds(creds) { lsSet(STORAGE_KEY_CREDS, encodeCreds(creds)); }
function getCreds() {
  const enc = lsGet(STORAGE_KEY_CREDS);
  return enc ? decodeCreds(enc) : null;
}
function hasCreds() { const c = getCreds(); return !!(c?.apiKey && c?.secretKey && c?.passphrase); }
function removeCreds() { lsDel(STORAGE_KEY_CREDS); }

// ── Formatters ─────────────────────────────────────────────
function fmt(n,d=2){ if(isNaN(n)||n===null)return '0'; return parseFloat(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); }
function fmtPrice(p){ p=parseFloat(p); if(p>=1000)return fmt(p,0); if(p>=1)return fmt(p,2); if(p>=0.01)return fmt(p,4); return fmt(p,6); }
function fmtTime(d){ return new Date(d).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}); }

// ── HMAC-SHA256 ────────────────────────────────────────────
async function hmac256(key, msg) {
  const k = new TextEncoder().encode(key);
  const m = new TextEncoder().encode(msg);
  const ck = await crypto.subtle.importKey('raw',k,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig = await crypto.subtle.sign('HMAC',ck,m);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function okxHeaders(method, path, body='') {
  const c = getCreds(); if(!c) return null;
  const ts = new Date().toISOString();
  const sign = await hmac256(c.secretKey, ts+method.toUpperCase()+path+body);
  return {
    'OK-ACCESS-KEY': c.apiKey, 'OK-ACCESS-SIGN': sign,
    'OK-ACCESS-TIMESTAMP': ts, 'OK-ACCESS-PASSPHRASE': c.passphrase,
    'Content-Type': 'application/json'
  };
}

// ── OKX API ────────────────────────────────────────────────
async function fetchBalance() {
  const h = await okxHeaders('GET','/api/v5/account/balance'); if(!h) return null;
  try {
    const r = await fetch(`${OKX_BASE}/api/v5/account/balance`,{headers:h});
    const d = await r.json();
    return d.code==='0' ? d.data : null;
  } catch { return null; }
}

async function fetchTicker(instId) {
  try {
    const r = await fetch(`${OKX_BASE}/api/v5/market/ticker?instId=${instId}`);
    const d = await r.json();
    return d.code==='0' && d.data?.[0] ? d.data[0] : null;
  } catch { return null; }
}

async function fetchOrderHistory(instId) {
  const path = `/api/v5/trade/orders-history?instType=SPOT&instId=${instId}&limit=50`;
  const h = await okxHeaders('GET', path); if(!h) return [];
  try {
    const r = await fetch(`${OKX_BASE}${path}`,{headers:h});
    const d = await r.json();
    return d.code==='0' ? d.data : [];
  } catch { return []; }
}

function computeAvgBuy(orders) {
  let cost=0, qty=0;
  for(const o of orders)
    if(o.side==='buy'&&o.state==='filled'){ qty+=parseFloat(o.fillSz||0); cost+=parseFloat(o.fillSz||0)*parseFloat(o.avgPx||0); }
  return qty>0?cost/qty:0;
}

async function fetchEGPRate() {
  try {
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const d = await r.json(); return d.rates?.EGP||50.8;
  } catch { return 50.8; }
}

// ── SOUND NOTIFICATIONS 🔊 ────────────────────────────────
function playNotificationSound(type = 'success') {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;
    
    if (type === 'success') {
      // صوت الربح - نغمات صاعدة 📈
      const notes = [
        { freq: 523.25, time: 0 },    // C5
        { freq: 659.25, time: 0.1 },  // E5
        { freq: 783.99, time: 0.2 }   // G5
      ];
      
      notes.forEach(note => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.value = note.freq;
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0.3, now + note.time);
        gain.gain.exponentialRampToValueAtTime(0.01, now + note.time + 0.08);
        
        osc.start(now + note.time);
        osc.stop(now + note.time + 0.08);
      });
    } else if (type === 'warning') {
      // صوت التحذير - نغمات هابطة 📉
      const notes = [
        { freq: 659.25, time: 0 },    // E5
        { freq: 523.25, time: 0.1 },  // C5
        { freq: 392, time: 0.2 }      // G4
      ];
      
      notes.forEach(note => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.value = note.freq;
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0.3, now + note.time);
        gain.gain.exponentialRampToValueAtTime(0.01, now + note.time + 0.08);
        
        osc.start(now + note.time);
        osc.stop(now + note.time + 0.08);
      });
    } else if (type === 'notification') {
      // صوت التنبيه - نغمة بسيطة 🔵
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.frequency.value = 600;
      osc.type = 'sine';
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch (e) {
    console.warn('Audio context error:', e);
  }
}

// ── Build Portfolio ────────────────────────────────────────
async function buildPortfolio() {
  const balData = await fetchBalance();
  if(!balData?.[0]) return null;
  const details = balData[0].details||[];
  const assets = [];
  let totalVal = 0;
  const valid = details.filter(d=>d.ccy!=='USDT'&&parseFloat(d.eq||0)>0);
  for(const d of valid) {
    const sym = d.ccy;
    const qty = parseFloat(d.eq||0);
    let ticker = await fetchTicker(sym+'-USDT');
    if(!ticker) ticker = await fetchTicker(sym+'-USD');
    if(!ticker) continue;
    const price = parseFloat(ticker.last);
    const value = qty*price;
    if(value<1) continue;
    const open24h = parseFloat(ticker.open24h||price);
    const dailyChangePct = open24h>0?((price-open24h)/open24h)*100:0;
    const orders = await fetchOrderHistory(sym+'-USDT');
    const avgBuy = computeAvgBuy(orders);
    const costBasis = avgBuy*qty;
    const unrealizedPnL = value-costBasis;
    const unrealizedPnLPct = costBasis>0?(unrealizedPnL/costBasis)*100:0;
    assets.push({sym,qty,price,value,avgBuy,costBasis,unrealizedPnL,unrealizedPnLPct,dailyChangePct});
    totalVal += value;
  }
  for(const a of assets) a.allocPct = totalVal>0?(a.value/totalVal)*100:0;
  const totalInvested = assets.reduce((s,a)=>s+(a.costBasis||a.value),0);
  const egpRate = await fetchEGPRate();
  return {total:totalVal,invested:totalInvested,profit:totalVal-totalInvested,egpRate,assets,ts:Date.now()};
}

// ── Direct ticker prices (no auth needed) ─────────────────
async function fetchDirectPrice(sym) {
  for(const id of [sym+'-USDT',sym+'-USD']) {
    try {
      const r = await fetch(`${OKX_BASE}/api/v5/market/ticker?instId=${id}`);
      const d = await r.json();
      if(d.code==='0'&&d.data?.[0]) {
        const t=d.data[0], p=parseFloat(t.last), o=parseFloat(t.open24h||p);
        return {p, c:o>0?((p-o)/o)*100:0};
      }
    } catch {}
  }
  return null;
}

// ── Tabs ───────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('on'));
  document.getElementById('page-'+tab).classList.add('on');
  document.querySelector(`.nav-item[data-tab=\"${tab}\"]`).classList.add('on');
  document.getElementById('scroll').scrollTop = 0;
  currentTab = tab;
  if(tab==='ai') loadAI();
  if(tab==='alerts') { markAlertsRead(); renderAlerts(); }
  if(tab==='settings') loadSettings();
}

// ── API Status ─────────────────────────────────────────────
function updateApiStatus(ok) {
  const badge = document.getElementById('statusBadge');
  const txt = document.getElementById('statusTxt');
  badge.className = 'status-badge '+(ok?'on':'off');
  txt.textContent = ok?'متصل':'غير متصل';
  const apiBadge = document.getElementById('apiBadge');
  if(apiBadge){ apiBadge.className='api-badge '+(ok?'ok':'no'); apiBadge.textContent=ok?'محفوظ ✓':'غير محفوظ'; }
}

// ── Portfolio render ───────────────────────────────────────
function renderNoCreds() {
  document.getElementById('homeContent').innerHTML = `
    <div class="empty">
      <div style="font-size:48px;margin-bottom:12px">🔑</div>
      <div style="font-size:14px;color:var(--text2);margin-bottom:8px">أضف مفاتيح OKX API</div>
      <div style="font-size:11px;color:var(--text3)">اذهب إلى الإعدادات وأضف بياناتك<br>المفاتيح تُحفظ على جهازك فقط</div>
      <button class="btn btn-g" style="margin-top:20px" onclick="switchTab('settings')">⚙️ إعدادات</button>
    </div>`;
  updateApiStatus(false);
}

function renderHome() {
  if(!portfolio){ renderNoCreds(); return; }
  const {total,profit,egpRate,assets} = portfolio;
  initAssetCarousel(assets);
  const egp = total*(egpRate||50.8);
  const todayPnl = assets.reduce((s,a)=>s+(a.value*(a.dailyChangePct/100)||0),0);
  const rows = assets.map(a=>{
    const m=meta(a.sym); const pos=a.unrealizedPnL>=0;
    return `<div class="asset-row">
      <div class="ar-ico" style="background:${m.bg}18;color:${m.bg};border-color:${m.bg}40">${m.icon}</div>
      <div class="ar-mid">
        <div class="ar-sym">${a.sym}</div>
        <div class="ar-sub">${fmt(a.qty,4)} · avg $${fmtPrice(a.avgBuy||a.price)} · ${a.dailyChangePct>=0?'▲':'▼'} ${Math.abs(a.dailyChangePct).toFixed(2)}%</div>
        <div class="ar-bar"><div class="ar-fill" style="width:${a.allocPct.toFixed(1)}%"></div></div>
      </div>
      <div class="ar-r">
        <div class="ar-val">$${fmt(a.value,2)}</div>
        <div class="ar-pnl ${pos?'green':'red'}">${pos?'+':''}${fmt(a.unrealizedPnL,2)}</div>
        <div class="ar-day ${pos?'green':'red'}">${pos?'+':''}${fmt(a.unrealizedPnLPct,1)}%</div>
      </div>
    </div>`;
  }).join('');
  document.getElementById('homeContent').innerHTML = `
    <div class="port-card">
      <div class="port-top">
        <div>
          <div class="port-lbl">إجمالي المحفظة</div>
          <div class="port-total">$${fmt(total,2)}</div>
          <div class="port-egp">ج.م ${fmt(egp,0)}</div>
        </div>
        <div class="port-badge">
          <div class="pb-lbl">صافي الربح</div>
          <div class="pb-val ${profit>=0?'green':'red'}">${profit>=0?'+':''}$${fmt(profit,0)}</div>
        </div>
      </div>
      <div class="port-stats">
        <div class="ps"><div class="ps-lbl">ربح اليوم</div><div class="ps-val ${todayPnl>=0?'green':'red'}">${todayPnl>=0?'+':''}$${fmt(todayPnl,2)}</div></div>
        <div class="ps"><div class="ps-lbl">عدد العملات</div><div class="ps-val" style="color:var(--cyan)">${assets.length}</div></div>
        <div class="ps"><div class="ps-lbl">سعر الدولار</div><div class="ps-val gold">ج.م ${(egpRate||50.8).toFixed(1)}</div></div>
      </div>
    </div>
    <div class="assets-hdr">
      <span class="assets-hdr-txt">الأصول النشطة</span>
      <span class="badge-sm">${assets.length} عملة</span>
    </div>
    ${rows}
    <div style="height:8px"></div>`;
}

async function loadPortfolio() {
  if(!hasCreds()){ renderNoCreds(); return; }
  // Show cached first for instant load
  const cached = lsGet(STORAGE_KEY_PORTFOLIO);
  if(cached){ portfolio=cached; renderHome(); updateApiStatus(true); }
  else { document.getElementById('homeContent').innerHTML='<div class="loading"><div class="spinner"></div><div class="ld-txt">جاري تحميل المحفظة...</div></div>'; }
  // Then fetch fresh
  try {
    const fresh = await buildPortfolio();
    if(fresh){
      const prevProfit = lsGet(STORAGE_KEY_PREV_PROFIT,0);
      portfolio = fresh;
      lsSet(STORAGE_KEY_PORTFOLIO, fresh);
      renderHome();
      updateApiStatus(true);
      // Check profit/loss alerts
      checkProfitAlerts(fresh.profit, prevProfit);
      lsSet(STORAGE_KEY_PREV_PROFIT, fresh.profit);
      // Update app badge
      updateAppBadge(fresh.profit);
    }
  } catch(e){ console.error('loadPortfolio error', e); }
}

// ── App Badge (native badge on PWA icon) ──────────────────
function updateAppBadge(profit) {
  if('setAppBadge' in navigator) {
    const abs = Math.abs(profit||0);
    const count = Math.min(99, Math.round(abs));
    navigator.setAppBadge(count).catch(()=>{});
  }
  // Also notify service worker for badge + notifications
  if(navigator.serviceWorker?.controller) {
    const prevProfit = lsGet(STORAGE_KEY_PREV_PROFIT, 0);
    navigator.serviceWorker.controller.postMessage({type:'UPDATE_BADGE', profit, prevProfit});
  }
}

// ── Profit/Loss Alerts WITH SOUND ────────────────────────
function checkProfitAlerts(profit, prevProfit) {
  const threshold = parseInt(lsGet(STORAGE_KEY_THRESHOLD, 50));
  const change = profit - prevProfit;
  if(Math.abs(change) >= threshold) {
    const isProfit = change > 0;
    const title = isProfit ? '🚀 ربح جديد!' : '⚠️ تنبيه خسارة';
    const body = isProfit
      ? `ارتفع ربحك بمقدار +$${Math.abs(change).toFixed(0)} 💰`
      : `انخفضت محفظتك بمقدار -$${Math.abs(change).toFixed(0)}`;
    addAlert(title, body, isProfit?'profit':'alert');
    
    // شغّل الصوت المناسب 🔊
    if(isProfit) {
      playNotificationSound('success');
    } else {
      playNotificationSound('warning');
    }
    
    sendPushNotification(title, body);
  }
}

// ── Push Notifications WITH SOUND ────────────────────────
async function requestNotifPermission() {
  if(!('Notification' in window)) return false;
  if(Notification.permission==='granted'){ notifGranted=true; return true; }
  if(Notification.permission==='denied') return false;
  const p = await Notification.requestPermission();
  notifGranted = p==='granted';
  return notifGranted;
}

function sendPushNotification(title, body, icon='icons/icon192.png') {
  const enabled = lsGet(STORAGE_KEY_NOTIF, false);
  if(!enabled) return;
  if(Notification.permission!=='granted') return;
  
  // شغّل الصوت المناسب 🔊
  if(title.includes('ربح') || title.includes('Profit')) {
    playNotificationSound('success');
  } else if(title.includes('خسارة') || title.includes('Loss') || title.includes('⚠️')) {
    playNotificationSound('warning');
  } else {
    playNotificationSound('notification');
  }
  
  try {
    if(navigator.serviceWorker?.ready) {
      navigator.serviceWorker.ready.then(reg=>{
        reg.showNotification(title,{body,icon,badge:'icons/icon48.png',
          vibrate:[200,100,200],tag:'crypto-alert',renotify:true});
      });
    } else {
      new Notification(title,{body,icon});
    }
  } catch(e){ console.warn('Notification error',e); }
}

// ── AI Page ───────────────────────────────────────────────
function loadAI() {
  const saved = lsGet(STORAGE_KEY_AI);
  if(saved && saved.length) {
    aiAnalyses = saved;
    renderAI();
    const ts = lsGet('hc_ai_ts');
    if(ts) document.getElementById('aiLastTxt').textContent = 'آخر تحديث: '+fmtTime(ts);
  }
}

function getLocalAnalysis(asset) {
  const pct=asset.dailyChangePct||0, p=asset.price||0;
  const support=p*0.95, resistance=p*1.05, stopLoss=p*0.92;
  let trend,signal,reason,bull,bear,conf;
  if(pct>3){trend='صاعد';signal='buy';bull=75;bear=25;conf=65;reason=`${asset.sym} يظهر ارتفاعاً قوياً بنسبة ${pct.toFixed(1)}%. الاتجاه الصاعد واضح مع زخم إيجابي. يُنصح بالشراء مع وقف خسارة عند $${fmtPrice(stopLoss)}.`;}
  else if(pct>1){trend='صاعد';signal='hold';bull=60;bear=40;conf=55;reason=`${asset.sym} يرتفع بنسبة ${pct.toFixed(1)}% اليوم. الاتجاه إيجابي لكن الزخم غير كافٍ. يُفضل الاحتفاظ بالمراكز الحالية.`;}
  else if(pct<-3){trend='هبوطي';signal='sell';bull=20;bear=80;conf=60;reason=`${asset.sym} يهبط بنسبة ${Math.abs(pct).toFixed(1)}%. الضغط البيعي قوي. يُنصح بتفعيل وقف الخسارة عند $${fmtPrice(stopLoss)}.`;}
  else if(pct<-1){trend='هبوطي';signal='hold';bull=35;bear=65;conf=50;reason=`${asset.sym} ينخفض بنسبة ${Math.abs(pct).toFixed(1)}%. الاتجاه سلبي لكن غير حاد. يُفضل الانتظار حتى يستقر السعر.`;}
  else{trend='محايد';signal='hold';bull=50;bear=50;conf=45;reason=`${asset.sym} يتحرك بشكل محايد بتغير ${pct.toFixed(1)}%. لا توجد إشارات واضحة. يُنصح بالانتظار.`;}
  return{trend,signal,reason,support,resistance,stopLoss,confidence:conf,bullScore:bull,bearScore:bear};
}

async function analyzeAssetDirect(sym,price,dailyChangePct) {
  const prompt=`أنت خبير تداول عملات رقمية محترف.\\nالعملة: ${sym}\\nالسعر: $${price}\\nالتغير اليومي: ${dailyChangePct>=0?'+':''}${dailyChangePct.toFixed(2)}%\\nأجب بـ JSON فقط:\\n{\"trend\":\"صاعد أو هابط أو محايد\",\"signal\":\"buy أو sell أو hold\",\"reason\":\"تحليل عربي 2-3 جمل\",\"support\":0.0,\"resistance\":0.0,\"stopLoss\":0.0,\"confidence\":75,\"bullScore\":70,\"bearScore\":30}`;
  try {
    const ctrl=new AbortController();
    const to=setTimeout(()=>ctrl.abort(),30000);
    const r=await fetch(AI_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({messages:[{role:'system',content:'أجب بـ JSON فقط.'},{role:'user',content:prompt}],
      model:'openai',temperature:0.7,seed:Math.floor(Math.random()*99999)}),signal:ctrl.signal});
    clearTimeout(to);
    if(!r.ok) return getLocalAnalysis({sym,price,dailyChangePct});
    const txt=await r.text();
    const m=txt.match(/\{[\s\S]*?\}/);
    if(!m) return getLocalAnalysis({sym,price,dailyChangePct});
    return JSON.parse(m[0]);
  } catch { return getLocalAnalysis({sym,price,dailyChangePct}); }
}

async function runAI() {
  const btn=document.getElementById('btnRunAI');
  btn.disabled=true; btn.textContent='⏳ جاري...';
  document.getElementById('aiContent').innerHTML='<div class="loading"><div class="spinner"></div><div class="ld-txt">جاري التحليل...</div></div>';
  try {
    if(!portfolio?.assets?.length){
      document.getElementById('aiContent').innerHTML='<div class="empty">لا توجد أصول. أضف مفاتيح OKX API أولاً.</div>';
      return;
    }
    const analyses=[];
    for(let i=0;i<portfolio.assets.length;i++){
      const a=portfolio.assets[i];
      document.getElementById('aiContent').innerHTML=`<div class="loading"><div class="spinner"></div><div class="ld-txt">تحليل ${a.sym} (${i+1}/${portfolio.assets.length})...</div></div>`;
      const analysis=await analyzeAssetDirect(a.sym,a.price,a.dailyChangePct);
      analyses.push({sym:a.sym,price:a.price,dailyChangePct:a.dailyChangePct,qty:a.qty,
        value:a.value,avgBuy:a.avgBuy||a.price,unrealizedPnL:a.unrealizedPnL||0,
        unrealizedPnLPct:a.unrealizedPnLPct||0,allocPct:a.allocPct||0,...analysis});
    }
    aiAnalyses=analyses;
    lsSet(STORAGE_KEY_AI,analyses);
    lsSet('hc_ai_ts',Date.now());
    document.getElementById('aiLastTxt').textContent='آخر تحديث: '+fmtTime(Date.now());
    renderAI();
  } catch(e){ document.getElementById('aiContent').innerHTML=`<div class="empty">حدث خطأ: ${e.message}</div>`; }
  finally{ btn.disabled=false; btn.textContent='تحليل ▶'; }
}

function renderAI() {
  if(!aiAnalyses.length){ document.getElementById('aiContent').innerHTML='<div class="empty">اضغط "تحليل" للبدء</div>'; return; }
  const sigMap={buy:'🟢 شراء',sell:'🔴 بيع',hold:'🟡 انتظار'};
  document.getElementById('aiContent').innerHTML = aiAnalyses.map(a=>{
    const m=meta(a.sym); const bull=a.bullScore||50; const bear=a.bearScore||50; const conf=a.confidence||50;
    return `<div class="ai-card">
      <div class="ai-card-hdr">
        <div class="ai-card-ico" style="background:${m.bg}18;color:${m.bg};border-color:${m.bg}40">${m.icon}</div>
        <div><div class="ai-sym">${a.sym}</div><div class="ai-price">$${fmtPrice(a.price)} · ${a.dailyChangePct>=0?'▲':'▼'} ${Math.abs(a.dailyChangePct).toFixed(2)}%</div></div>
        <span class="sig ${a.signal||'hold'}">${sigMap[a.signal]||'🟡 انتظار'}</span>
      </div>
      <div class="ai-body">
        <div class="ai-reason">${a.reason||''}</div>
        <div class="ai-scores">
          <div class="sc"><div class="sc-l">ثقة</div><div class="sc-v" style="color:var(--accent)">${conf}%</div><div class="sc-bar"><div class="sc-fill" style="width:${conf}%;background:var(--accent)"></div></div></div>
          <div class="sc"><div class="sc-l">صعودي</div><div class="sc-v green">${bull}%</div><div class="sc-bar"><div class="sc-fill" style="width:${bull}%;background:var(--accent)"></div></div></div>
          <div class="sc"><div class="sc-l">هبوطي</div><div class="sc-v red">${bear}%</div><div class="sc-bar"><div class="sc-fill" style="width:${bear}%;background:var(--danger)"></div></div></div>
        </div>
        ${a.support?`<div class="ai-levels">
          <div class="ai-lv-item"><div class="ai-lv-dot" style="background:var(--accent)"></div><span class="green">دعم: $${fmtPrice(a.support)}</span></div>
          <div class="ai-lv-item"><div class="ai-lv-dot" style="background:var(--danger)"></div><span class="red">مقاومة: $${fmtPrice(a.resistance||0)}</span></div>
          <div class="ai-lv-item"><div class="ai-lv-dot" style="background:var(--gold)"></div><span class="gold">وقف: $${fmtPrice(a.stopLoss||0)}</span></div>
        </div>`:''}\
      </div>
    </div>`;
  }).join('');
}

// ── Alerts ────────────────────────────────────────────────
function addAlert(title, body, type='info') {
  alerts.unshift({id:Date.now(),title,body,type,time:new Date().toISOString(),read:false});
  lsSet(STORAGE_KEY_ALERTS, alerts);
  updateAlertBadge();
  if(currentTab==='alerts') renderAlerts();
}

function markAlertsRead() {
  let changed=false;
  alerts.forEach(a=>{ if(!a.read){ a.read=true; changed=true; } });
  if(changed){ lsSet(STORAGE_KEY_ALERTS,alerts); updateAlertBadge(); }
}

function updateAlertBadge() {
  const unread = alerts.filter(a=>!a.read).length;
  const badge = document.getElementById('alertBadge');
  if(unread>0){ badge.textContent=unread>9?'9+':unread; badge.classList.add('show'); }
  else { badge.classList.remove('show'); }
}

function renderAlerts() {
  const el=document.getElementById('alertsContent');
  if(!alerts.length){ el.innerHTML='<div class="empty">لا توجد تنبيهات</div>'; return; }
  const col={profit:'var(--accent)',alert:'var(--danger)',ai:'var(--purple)',info:'var(--info)'};
  el.innerHTML=alerts.map(a=>`
    <div class="al-item ${a.read?'':'unread'}">
      <div class="al-dot" style="background:${col[a.type]||'var(--info)'};"></div>
      <div>
        <div class="al-ttl">${a.title}</div>
        <div class="al-msg">${a.body}</div>
        <div class="al-time">${fmtTime(a.time)}</div>
      </div>
    </div>`).join('');
}

// ── Settings ──────────────────────────────────────────────
function loadSettings() {
  updateApiStatus(hasCreds());
  const coins = lsGet(STORAGE_KEY_TICKER, DEFAULT_COINS);
  document.getElementById('tickerInp').value = coins;
  const notif = lsGet(STORAGE_KEY_NOTIF, false);
  document.getElementById('notifToggle').checked = notif;
  const thresh = lsGet(STORAGE_KEY_THRESHOLD, 50);
  document.getElementById('profitThreshold').value = thresh;
  // Show saved API keys (masked)
  if(hasCreds()){
    const c = getCreds();
    document.getElementById('inp_api').value='';
    document.getElementById('inp_sec').value='';
    document.getElementById('inp_pass').value='';
    document.getElementById('inp_api').placeholder=maskStr(c.apiKey);
    document.getElementById('inp_sec').placeholder=maskStr(c.secretKey);
    document.getElementById('inp_pass').placeholder=maskStr(c.passphrase);
  }
}

function maskStr(s){ if(!s||s.length<8)return '***'; return s.slice(0,4)+'···'+s.slice(-4); }

function saveCredsUI() {
  const api=document.getElementById('inp_api').value.trim();
  const sec=document.getElementById('inp_sec').value.trim();
  const pass=document.getElementById('inp_pass').value.trim();
  if(!api||!sec||!pass){ showConn('fail','⚠️ يرجى ملء الحقول الثلاثة'); return; }
  saveCreds({apiKey:api,secretKey:sec,passphrase:pass});
  showConn('ok','✅ تم الحفظ — المفاتيح محفوظة محلياً على هاتفك فقط');
  updateApiStatus(true);
  addAlert('🔑 OKX API','تم حفظ بيانات API بنجاح','info');
  // Hide inputs and show masked placeholders
  setTimeout(()=>{ document.getElementById('inp_api').value=''; document.getElementById('inp_sec').value=''; document.getElementById('inp_pass').value=''; loadSettings(); }, 1500);
  setTimeout(loadPortfolio, 2000);
}

function removeCredsUI() {
  if(!confirm('هل تريد حذف بيانات OKX API؟')) return;
  removeCreds();
  showConn('fail','🗑️ تم حذف البيانات');
  updateApiStatus(false);
  document.getElementById('inp_api').value='';
  document.getElementById('inp_sec').value='';
  document.getElementById('inp_pass').value='';
  document.getElementById('inp_api').placeholder='API Key';
  document.getElementById('inp_sec').placeholder='Secret Key';
  document.getElementById('inp_pass').placeholder='Passphrase';
  portfolio=null;
  renderNoCreds();
}

async function testConnUI() {
  showConn('fail','⏳ جاري الاختبار...');
  // Try with existing saved creds first, fallback to inputs
  let creds = getCreds();
  const inpApi=document.getElementById('inp_api').value.trim();
  const inpSec=document.getElementById('inp_sec').value.trim();
  const inpPass=document.getElementById('inp_pass').value.trim();
  if(inpApi&&inpSec&&inpPass) creds={apiKey:inpApi,secretKey:inpSec,passphrase:inpPass};
  if(!creds){ showConn('fail','⚠️ أدخل البيانات أولاً'); return; }
  try {
    const ts=new Date().toISOString(), path='/api/v5/account/balance';
    const sign=await hmac256(creds.secretKey, ts+'GET'+path);
    const r=await fetch(OKX_BASE+path,{headers:{\
      'OK-ACCESS-KEY':creds.apiKey,'OK-ACCESS-SIGN':sign,\
      'OK-ACCESS-TIMESTAMP':ts,'OK-ACCESS-PASSPHRASE':creds.passphrase,'Content-Type':'application/json'\
    }});
    showConn(r.ok?'ok':'fail', r.ok?'🟢 الاتصال بـ OKX ناجح!':'🔴 بيانات غير صحيحة');
    if(r.ok) updateApiStatus(true);
  } catch { showConn('fail','⚠️ فشل الاتصال — تحقق من الشبكة'); }
}

function showConn(type,msg){
  const el=document.getElementById('connMsg');
  el.textContent=msg; el.className='conn-msg '+type;
}

// ── Carousel ──────────────────────────────────────────────
function buildCarousel() {
  if(!carouselAssets.length){
    document.getElementById('asset-carousel').innerHTML='<div style="color:var(--text3);font-size:12px;text-align:center">⏳ جاري التحميل...</div>';
    document.getElementById('carousel-dots').innerHTML=''; return;
  }
  const n=carouselAssets.length;
  document.getElementById('asset-carousel').innerHTML=carouselAssets.map((a,i)=>{
    const m=meta(a.sym), up=parseFloat(a.dailyChangePct||0)>=0;
    let cls='c-hide';
    if(n===1) cls='c-active';
    else if(i===carouselIdx) cls='c-active';
    else if(i===(carouselIdx-1+n)%n) cls='c-prev';
    else if(i===(carouselIdx+1)%n) cls='c-next';
    return `<div class="asset-card ${cls}" data-idx="${i}" onclick="carouselGoTo(${i})"
      style="background:linear-gradient(135deg,${m.bg}22,rgba(12,16,24,0.95));border-color:${m.bg}55;box-shadow:0 8px 32px ${m.bg}22">
      <div class="ac-sym" style="color:${m.bg}">${a.sym}</div>
      <div class="ac-price">$${fmtPrice(a.price||0)}</div>
      <div class="ac-row">
        <span class="ac-chg ${up?'up':'dn'}"><span class="ac-arr ${up?'':'dn'}">${up?'▲':'▼'}</span>${Math.abs(parseFloat(a.dailyChangePct||0)).toFixed(2)}%</span>
        <span class="ac-val">$${fmt(a.value,2)}</span>
      </div>
    </div>`;
  }).join('');
  document.getElementById('carousel-dots').innerHTML=n>1?carouselAssets.map((_,i)=>\
    `<div class="c-dot ${i===carouselIdx?'on':''}" onclick="carouselGoTo(${i})"></div>`\
  ).join(''):'';\
}

window.carouselGoTo = function(idx){ carouselIdx=idx; buildCarousel(); resetCarouselTimer(); };

function carouselNext(){ if(!carouselAssets.length)return; carouselIdx=(carouselIdx+1)%carouselAssets.length; buildCarousel(); }
function resetCarouselTimer(){ if(carouselTimer)clearInterval(carouselTimer); if(carouselAssets.length>1) carouselTimer=setInterval(carouselNext,3500); }
function initAssetCarousel(assets){ if(!assets?.length)return; carouselAssets=assets; carouselIdx=0; buildCarousel(); resetCarouselTimer(); }

// ── Ticker bar (no-auth prices) ────────────────────────────
async function refreshTickerBar() {
  if(carouselAssets.length>0) return; // portfolio loaded, skip
  const coins = lsGet(STORAGE_KEY_TICKER,DEFAULT_COINS).split(',').map(c=>c.trim().toUpperCase());
  const assets=[];
  await Promise.allSettled(coins.map(async sym=>{
    const d=await fetchDirectPrice(sym);
    if(d) assets.push({sym,price:d.p,dailyChangePct:d.c,value:0,qty:0});
  }));
  if(assets.length&&!carouselAssets.length){ carouselAssets=assets; buildCarousel(); resetCarouselTimer(); }
}

// ── Refresh ────────────────────────────────────────────────
async function doRefresh() {
  const btn=document.getElementById('refreshBtn');
  btn.classList.add('spin');
  try { await loadPortfolio(); } finally { setTimeout(()=>btn.classList.remove('spin'),800); }
}

// ── Settings Notifications Toggle ────────────────────────
async function toggleNotif(checked) {
  if(checked) {
    const ok=await requestNotifPermission();
    if(!ok){
      document.getElementById('notifToggle').checked=false;
      alert('يرجى السماح بالإشعارات من إعدادات المتصفح');
      return;
    }
    notifGranted=true;
  }
  lsSet(STORAGE_KEY_NOTIF, checked);
}

// ── PWA Install ───────────────────────────────────────────
function showInstallBanner() {
  const banner=document.getElementById('install-banner');
  banner.classList.add('show');
  document.getElementById('btnInstall').onclick=()=>{
    banner.classList.remove('show');
    if(deferredInstall){ deferredInstall.prompt(); deferredInstall.userChoice.then(()=>deferredInstall=null); }
  };
  document.getElementById('btnDismiss').onclick=()=>{
    banner.classList.remove('show');
    lsSet('hc_install_dismissed',true);
  };
}

// ── Service Worker ────────────────────────────────────────
async function registerSW() {
  if(!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js',{scope:'./'});
    console.log('SW registered', reg.scope);
  } catch(e) { console.warn('SW registration failed', e); }
}

// ── Handle SPA redirect from 404 page ────────────────────
function handleSpaRedirect() {
  const redir = sessionStorage.getItem('spa_redirect');
  if(redir) {
    sessionStorage.removeItem('spa_redirect');
    const hash = redir.split('#')[1];
    if(hash && ['home','ai','alerts','settings'].includes(hash)) switchTab(hash);
  }
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  // Register Service Worker
  await registerSW();

  // Handle SPA redirect
  handleSpaRedirect();

  // Load persisted alerts (never cleared)
  alerts = lsGet(STORAGE_KEY_ALERTS) || [{
    id:1,title:'🎉 مرحباً بك في Hammad Crypto PWA',
    body:'أضف مفاتيح OKX API من الإعدادات للبدء. بياناتك تُحفظ محلياً على هاتفك.',
    type:'info',time:new Date().toISOString(),read:false
  }];
  updateAlertBadge();

  // Bottom nav
  document.querySelectorAll('.nav-item').forEach(n=>{
    n.addEventListener('click',()=>switchTab(n.dataset.tab));
  });

  // Refresh button
  document.getElementById('refreshBtn').addEventListener('click', doRefresh);

  // AI button
  document.getElementById('btnRunAI').addEventListener('click', runAI);

  // Clear alerts
  document.getElementById('btnClear').addEventListener('click',()=>{
    alerts=[]; lsSet(STORAGE_KEY_ALERTS,[]); renderAlerts(); updateAlertBadge();
  });

  // Settings buttons
  document.getElementById('btnSave').addEventListener('click', saveCredsUI);
  document.getElementById('btnTest').addEventListener('click', testConnUI);
  document.getElementById('btnRemove').addEventListener('click', removeCredsUI);

  document.getElementById('btnUpdateTicker').addEventListener('click',()=>{
    const v=document.getElementById('tickerInp').value.trim();
    if(!v) return;
    lsSet(STORAGE_KEY_TICKER,v);
    carouselAssets=[]; carouselIdx=0;
    if(carouselTimer) clearInterval(carouselTimer);
    refreshTickerBar();
    showConn('ok','✅ تم تحديث شريط الأسعار');
  });

  document.getElementById('notifToggle').addEventListener('change',e=>toggleNotif(e.target.checked));

  document.getElementById('profitThreshold').addEventListener('change',e=>{
    lsSet(STORAGE_KEY_THRESHOLD, parseInt(e.target.value)||50);
  });

  document.getElementById('btnTestNotif').addEventListener('click',async()=>{
    const ok=await requestNotifPermission();
    if(!ok){ alert('السماح بالإشعارات مطلوب'); return; }
    lsSet(STORAGE_KEY_NOTIF, true);
    document.getElementById('notifToggle').checked=true;
    playNotificationSound('notification');
    sendPushNotification('🔔 Hammad Crypto','هذا إشعار تجريبي — التنبيهات تعمل بشكل صحيح ✅');
    addAlert('🔔 اختبار الإشعار','تم إرسال إشعار تجريبي بنجاح','info');
  });

  // Check notification permission on start
  if(Notification.permission==='granted') notifGranted=true;

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferredInstall=e;
    const dismissed=lsGet('hc_install_dismissed',false);
    if(!dismissed) setTimeout(showInstallBanner, 3000);
  });

  // Load portfolio & ticker
  await loadPortfolio();
  await refreshTickerBar();
  updateApiStatus(hasCreds());

  // Auto refresh every 60 seconds
  refreshTimer = setInterval(async()=>{
    if(hasCreds()) await loadPortfolio();
    else await refreshTickerBar();
  }, 60000);

  // App visibility: re-check when app comes to foreground
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible') {
      if(hasCreds()) loadPortfolio();
    }
  });
});