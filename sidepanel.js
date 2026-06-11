'use strict';

let portfolio = null;
let aiAnalyses = [];
let alerts = [];
let currentTab = 'home';
let apiSaved = false;

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

const DEMO_PRICES = {
  BTC:{p:68450,c:2.34},ETH:{p:3890,c:1.87},SOL:{p:182,c:3.5},
  BNB:{p:610,c:-0.9},KAT:{p:0.0245,c:-0.85},PI:{p:2.35,c:5.2},
  OFC:{p:0.0012,c:12.5},BASED:{p:0.00045,c:-2.1},CHIP:{p:0.0089,c:8.7},
  XRP:{p:0.58,c:1.2},ADA:{p:0.47,c:-1.5},TON:{p:7.2,c:4.1},
  LTC:{p:88,c:0.6},DOT:{p:7.8,c:-2.3},
};

function meta(sym) {
  const s = sym.toUpperCase().replace(/-USDT$|,-USD$/g,'');
  return COIN_META[s] || {bg:'#4ecdc4', icon:s.charAt(0)};
}

function fmt(n, d=2) {
  if (isNaN(n)||n===null) return '0';
  return parseFloat(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
}

function fmtPrice(p) {
  p = parseFloat(p);
  if (p >= 1000) return fmt(p,0);
  if (p >= 1)    return fmt(p,2);
  if (p >= 0.01) return fmt(p,4);
  return fmt(p,6);
}

function fmtTime(d) {
  return new Date(d).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
}

// ── API Status ─────────────────────────────────────────
function updateApiStatus(saved) {
  apiSaved = saved;
  const badge = document.getElementById('apiStatusBadge');
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  if (badge) {
    badge.className = 'api-status ' + (saved ? 'saved' : 'not-saved');
    badge.textContent = saved ? 'محفوظ ✓' : 'غير محفوظ';
  }
  if (statusBadge) {
    statusBadge.className = 'status-badge ' + (saved ? 'connected' : 'disconnected');
  }
  if (statusText) {
    statusText.textContent = saved ? 'متصل' : 'غير متصل';
  }
}

function checkApiStatus() {
  chrome.runtime.sendMessage({type:'CHECK_CREDENTIALS'}, res => {
    if (chrome.runtime.lastError) { updateApiStatus(false); return; }
    updateApiStatus(res?.hasCredentials || false);
  });
}

// ── Tabs ───────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  document.getElementById('page-'+tab).classList.add('on');
  document.getElementById('tab-'+tab).classList.add('on');
  currentTab = tab;
  document.getElementById('content').scrollTop = 0;
  if (tab==='ai') loadAI();
  if (tab==='alerts') renderAlerts();
  if (tab==='settings') loadSettings();
}

// ── Portfolio ──────────────────────────────────────────
function loadPortfolio() {
  chrome.runtime.sendMessage({type:'GET_PORTFOLIO'}, res => {
    if (chrome.runtime.lastError || !res?.data) { renderNoCreds(); return; }
    portfolio = res.data;
    renderHome();
    updateApiStatus(true);
  });
}

function renderHome() {
  if (!portfolio) { renderNoCreds(); return; }
  const {total, profit, egpRate, assets} = portfolio;
  const egp = total * (egpRate||50.8);
  const todayPnl = assets.reduce((s,a)=>s+(a.value*(a.dailyChangePct/100)||0),0);

  const rows = assets.map(a => {
    const m = meta(a.sym);
    const pos = a.unrealizedPnL >= 0;
    return `
    <div class="asset-row">
      <div class="ar-ico" style="background:${m.bg}18;color:${m.bg};border-color:${m.bg}40">${m.icon}</div>
      <div class="ar-mid">
        <div class="ar-sym">${a.sym}</div>
        <div class="ar-sub">
          ${fmt(a.qty,4)} · avg $${fmtPrice(a.avgBuy||a.price)} · ${a.dailyChangePct>=0?'▲':'▼'} ${Math.abs(a.dailyChangePct).toFixed(2)}%
        </div>
        <div class="ar-bar"><div class="ar-bar-fill" style="width:${a.allocPct.toFixed(1)}%"></div></div>
      </div>
      <div class="ar-right">
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
          <div class="port-total-lbl">إجمالي المحفظة</div>
          <div class="port-total">$${fmt(total,2)}</div>
          <div class="port-egp">ج.م ${fmt(egp,0)}</div>
        </div>
        <div class="port-badge">
          <div class="pb-lbl">صافي الربح</div>
          <div class="pb-val ${profit>=0?'green':'red'}">${profit>=0?'+':''}$${fmt(profit,0)}</div>
        </div>
      </div>
      <div class="port-stats">
        <div class="ps">
          <div class="ps-lbl">ربح اليوم</div>
          <div class="ps-val ${todayPnl>=0?'green':'red'}">${todayPnl>=0?'+':''}$${fmt(todayPnl,2)}</div>
        </div>
        <div class="ps">
          <div class="ps-lbl">عدد العملات</div>
          <div class="ps-val" style="color:var(--cyan)">${assets.length}</div>
        </div>
        <div class="ps">
          <div class="ps-lbl">سعر الدولار</div>
          <div class="ps-val gold">ج.م ${(egpRate||50.8).toFixed(1)}</div>
        </div>
      </div>
    </div>
    <div class="assets-hdr">
      <span class="assets-hdr-txt">الأصول النشطة</span>
      <span class="badge-sm">${assets.length} عملة</span>
    </div>
    ${rows}`;
}

function renderNoCreds() {
  document.getElementById('homeContent').innerHTML = `
    <div class="empty" style="padding:50px 16px">
      <div style="font-size:40px;margin-bottom:14px">🔑</div>
      <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:10px">أضف مفاتيح OKX API</div>
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:20px;line-height:1.8">اذهب إلى الإعدادات وأدخل<br>بيانات OKX API للبدء</div>
      <button class="btn btn-green" id="btnGoSettings" style="margin:0 auto">⚙️ فتح الإعدادات</button>
    </div>`;
  document.getElementById('btnGoSettings')?.addEventListener('click',()=>switchTab('settings'));
  updateApiStatus(false);
}

// ── AI ─────────────────────────────────────────────────
function loadAI() {
  chrome.runtime.sendMessage({type:'GET_AI'}, res => {
    if (chrome.runtime.lastError) return;
    if (res?.data?.length) {
      aiAnalyses = res.data;
      document.getElementById('aiLastTxt').textContent = 'آخر تحديث: '+fmtTime(res.lastUpdate||Date.now());
      renderAI();
    } else {
      document.getElementById('aiContent').innerHTML = '<div class="empty">اضغط "تحليل الآن" لبدء التحليل</div>';
      document.getElementById('aiLastTxt').textContent = 'لم يتم التحليل بعد';
    }
  });
}

function renderAI() {
  if (!aiAnalyses.length) {
    document.getElementById('aiContent').innerHTML = '<div class="empty">لا يوجد تحليل</div>';
    return;
  }
  document.getElementById('aiContent').innerHTML = aiAnalyses.map(a => {
    const m = meta(a.sym);
    const sig = a.signal||'hold';
    const conf = a.confidence||50;
    const bull = a.bullScore||50;
    const bear = a.bearScore||50;
    const sigLabel = sig==='buy'?'🟢 شراء':sig==='sell'?'🔴 بيع':'🟡 انتظار';
    return `
    <div class="ai-card">
      <div class="ai-card-hdr">
        <div class="ai-card-ico" style="background:${m.bg}18;color:${m.bg};border-color:${m.bg}40">${m.icon}</div>
        <div>
          <div class="ai-sym">${a.sym}</div>
          <div class="ai-price">$${fmtPrice(a.price)} · ${a.trend||'محايد'}</div>
        </div>
        <span class="sig ${sig}">${sigLabel}</span>
      </div>
      <div class="ai-body">
        <div class="ai-reason">${a.reason||'لا يوجد تحليل متاح'}</div>
        <div class="ai-scores">
          <div class="sc">
            <div class="sc-l">الثقة</div>
            <div class="sc-v" style="color:var(--cyan)">${conf}%</div>
            <div class="sc-bar"><div class="sc-fill" style="width:${conf}%;background:var(--cyan)"></div></div>
          </div>
          <div class="sc">
            <div class="sc-l">صعودي</div>
            <div class="sc-v green">${bull}%</div>
            <div class="sc-bar"><div class="sc-fill" style="width:${bull}%;background:var(--accent)"></div></div>
          </div>
          <div class="sc">
            <div class="sc-l">هبوطي</div>
            <div class="sc-v red">${bear}%</div>
            <div class="sc-bar"><div class="sc-fill" style="width:${bear}%;background:var(--danger)"></div></div>
          </div>
        </div>
        ${a.support ? `
        <div class="ai-levels">
          <div class="ai-lv-item"><div class="ai-lv-dot" style="background:var(--accent)"></div><span class="green">دعم: $${fmtPrice(a.support)}</span></div>
          <div class="ai-lv-item"><div class="ai-lv-dot" style="background:var(--danger)"></div><span class="red">مقاومة: $${fmtPrice(a.resistance||0)}</span></div>
          <div class="ai-lv-item"><div class="ai-lv-dot" style="background:var(--gold)"></div><span class="gold">وقف: $${fmtPrice(a.stopLoss||0)}</span></div>
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function runAI() {
  const btn = document.getElementById('btnRunAI');
  btn.disabled = true;
  btn.textContent = '⏳ جاري التحليل...';
  document.getElementById('aiContent').innerHTML = '<div class="loading"><div class="spinner"></div><div class="ld-txt">جاري تحليل العملات...</div></div>';
  document.getElementById('aiLastTxt').textContent = 'جاري التحليل...';
  chrome.runtime.sendMessage({type:'RUN_AI'}, () => {
    setTimeout(() => {
      loadAI();
      btn.disabled = false;
      btn.textContent = 'تحليل الآن ▶';
    }, 4000);
  });
}

// ── Alerts ─────────────────────────────────────────────
function addAlert(title, body, type='info') {
  alerts.unshift({id:Date.now(),title,body,type,time:new Date(),read:false});
  chrome.storage.local.set({popup_alerts:alerts});
  if (currentTab==='alerts') renderAlerts();
}

function renderAlerts() {
  const el = document.getElementById('alertsContent');
  if (!alerts.length) { el.innerHTML='<div class="empty">لا توجد تنبيهات</div>'; return; }
  const col={profit:'var(--accent)',alert:'var(--danger)',ai:'var(--purple)',info:'var(--info)'};
  el.innerHTML = alerts.map(a=>`
    <div class="al-item ${a.read?'':'unread'}">
      <div class="al-dot-el" style="background:${col[a.type]||'var(--info)'}"></div>
      <div>
        <div class="al-ttl">${a.title}</div>
        <div class="al-msg">${a.body}</div>
        <div class="al-time">${fmtTime(a.time)}</div>
      </div>
    </div>`).join('');
}

// ── Settings ───────────────────────────────────────────
function loadSettings() {
  chrome.storage.local.get('tickerCoins', r => {
    const v = r.tickerCoins||'BTC,ETH,SOL,BNB,KAT,PI,OFC';
    const el = document.getElementById('tickerCoinsInp');
    if (el) el.value = v;
  });
  // Check and show API status
  checkApiStatus();
}

function saveCreds() {
  const api   = document.getElementById('inp_api').value.trim();
  const sec   = document.getElementById('inp_sec').value.trim();
  const pass  = document.getElementById('inp_pass').value.trim();
  if (!api||!sec||!pass) { showConn('fail','⚠️ يرجى ملء الحقول الثلاثة'); return; }
  chrome.runtime.sendMessage({type:'SAVE_CREDENTIALS',creds:{apiKey:api,secretKey:sec,passphrase:pass}}, res=>{
    if (res?.ok) {
      showConn('ok','✅ تم الحفظ بنجاح — المفاتيح محفوظة على جهازك فقط');
      updateApiStatus(true);
      addAlert('🔑 OKX','تم حفظ بيانات API','info');
      setTimeout(loadPortfolio, 2000);
    }
  });
}

function removeCreds() {
  if (!confirm('هل تريد حذف بيانات OKX API؟')) return;
  chrome.runtime.sendMessage({type:'REMOVE_CREDENTIALS'}, res=>{
    if (res?.ok) {
      showConn('fail','🗑️ تم حذف البيانات');
      updateApiStatus(false);
      // Clear input fields
      document.getElementById('inp_api').value = '';
      document.getElementById('inp_sec').value = '';
      document.getElementById('inp_pass').value = '';
    }
  });
}

async function testConn() {
  showConn('fail','⏳ جاري الاختبار...');
  const api  = document.getElementById('inp_api').value.trim();
  const sec  = document.getElementById('inp_sec').value.trim();
  const pass = document.getElementById('inp_pass').value.trim();
  if (!api||!sec||!pass) { showConn('fail','⚠️ أدخل البيانات أولاً'); return; }
  try {
    const ts   = new Date().toISOString();
    const path = '/api/v5/account/balance';
    const k    = new TextEncoder().encode(sec);
    const m    = new TextEncoder().encode(ts+'GET'+path);
    const ck   = await crypto.subtle.importKey('raw',k,{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const sig  = await crypto.subtle.sign('HMAC',ck,m);
    const sign = btoa(String.fromCharCode(...new Uint8Array(sig)));
    const res  = await fetch('https://www.okx.com'+path,{
      headers:{'OK-ACCESS-KEY':api,'OK-ACCESS-SIGN':sign,'OK-ACCESS-TIMESTAMP':ts,'OK-ACCESS-PASSPHRASE':pass,'Content-Type':'application/json'}
    });
    showConn(res.ok?'ok':'fail', res.ok?'🟢 الاتصال بـ OKX ناجح!':'🔴 بيانات غير صحيحة');
    if (res.ok) updateApiStatus(true);
  } catch { showConn('fail','⚠️ فشل الاتصال — تحقق من الشبكة'); }
}

function showConn(type, msg) {
  const el = document.getElementById('connMsg');
  el.textContent = msg;
  el.className = 'conn-msg '+type;
}

// ── Coins Bar ──────────────────────────────────────────
function initCoinsBar() {
  chrome.storage.local.get('tickerCoins', r => {
    const stored = r.tickerCoins||'BTC,ETH,SOL,BNB,KAT,PI,OFC';
    const el = document.getElementById('tickerCoinsInp');
    if (el) el.value = stored;
    renderCoinsBar(stored);
  });
}

function renderCoinsBar(coinsStr) {
  const coins = coinsStr.split(',').map(c=>c.trim().toUpperCase()).filter(Boolean);
  document.getElementById('coins-bar').innerHTML = coins.map(sym=>{
    const d = DEMO_PRICES[sym]||{p:(Math.random()*100).toFixed(4),c:((Math.random()-.5)*10).toFixed(2)};
    const up = parseFloat(d.c) >= 0;
    return `<span class="coin-pill" data-sym="${sym}">
      <span class="cp-sym">${sym}</span>
      <span class="cp-price">$${fmtPrice(d.p)}</span>
      <span class="cp-chg ${up?'up':'dn'}">${up?'+':''}${parseFloat(d.c).toFixed(2)}%</span>
    </span>`;
  }).join('');
}

function refreshCoinsBarPrices() {
  document.querySelectorAll('.coin-pill').forEach(el=>{
    const sym = el.dataset.sym;
    const d   = DEMO_PRICES[sym]; if (!d) return;
    d.c = parseFloat(d.c) + (Math.random()-.5)*.4;
    const up  = d.c >= 0;
    const chg = el.querySelector('.cp-chg');
    if (chg) { chg.textContent=(up?'+':'')+d.c.toFixed(2)+'%'; chg.className='cp-chg '+(up?'up':'dn'); }
  });
}

function updateTicker() {
  const v = document.getElementById('tickerCoinsInp').value.trim();
  if (v) { chrome.storage.local.set({tickerCoins:v}); renderCoinsBar(v); }
}

function updateCoinsFromPortfolio(assets) {
  assets.forEach(a => {
    if (DEMO_PRICES[a.sym]) { DEMO_PRICES[a.sym].p=a.price; DEMO_PRICES[a.sym].c=a.dailyChangePct; }
  });
  const bar = document.getElementById('coins-bar');
  const existing = [...bar.querySelectorAll('.coin-pill')].map(e=>e.dataset.sym);
  renderCoinsBar(existing.join(','));
}

// ── Refresh ────────────────────────────────────────────
function doRefresh() {
  const btn = document.getElementById('refreshBtn');
  btn.classList.add('spin');
  chrome.runtime.sendMessage({type:'FORCE_REFRESH'}, ()=>{
    setTimeout(()=>{ btn.classList.remove('spin'); loadPortfolio(); }, 2000);
  });
}

// ── Background messages ────────────────────────────────
chrome.runtime.onMessage.addListener(msg=>{
  if (msg.type==='PORTFOLIO_UPDATED') {
    portfolio = msg.data;
    if (currentTab==='home') renderHome();
    updateApiStatus(true);
    if (msg.data?.assets) updateCoinsFromPortfolio(msg.data.assets);
  }
  if (msg.type==='AI_UPDATED') {
    aiAnalyses = msg.data;
    if (currentTab==='ai') renderAI();
    document.getElementById('aiLastTxt').textContent = 'آخر تحديث: '+fmtTime(Date.now());
  }
});

// ── Init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Tabs
  document.querySelectorAll('.tab').forEach(t=>{
    t.addEventListener('click', ()=>switchTab(t.dataset.tab));
  });

  // Buttons
  document.getElementById('refreshBtn').addEventListener('click', doRefresh);
  document.getElementById('btnRunAI').addEventListener('click', runAI);
  document.getElementById('btnClearAlerts').addEventListener('click', ()=>{
    alerts=[]; chrome.storage.local.set({popup_alerts:[]}); renderAlerts();
  });
  document.getElementById('btnSave').addEventListener('click', saveCreds);
  document.getElementById('btnTest').addEventListener('click', testConn);
  document.getElementById('btnRemove').addEventListener('click', removeCreds);
  document.getElementById('btnUpdateTicker').addEventListener('click', updateTicker);

  // Init data
  initCoinsBar();
  loadPortfolio();
  checkApiStatus();

  chrome.storage.local.get('popup_alerts', r=>{
    alerts = r.popup_alerts || [{
      id:1, title:'🎉 مرحباً بك',
      body:'أضف مفاتيح OKX API من الإعدادات للبدء',
      type:'info', time:new Date(), read:false
    }];
  });

  // Refresh coins bar every 5s
  setInterval(refreshCoinsBarPrices, 5000);
});
