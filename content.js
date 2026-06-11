// ============================================================
// Hammad Crypto — Content Script (Sidebar Injector) v3
// Professional Design
// ============================================================

(function () {
  'use strict';

  // Prevent double-injection
  if (document.getElementById('hammad-crypto-sidebar')) return;

  // ---- State ----
  let portfolio = null;
  let aiAnalyses = [];
  let alerts = [];
  let currentTab = 'home';
  let isOpen = false;
  let apiSaved = false;

  const COIN_META = {
    BTC:{bg:'#f7931a',icon:'₿'},ETH:{bg:'#627eea',icon:'Ξ'},
    USDT:{bg:'#26a17b',icon:'$'},USDC:{bg:'#2775ca',icon:'$'},
    BNB:{bg:'#f3ba2f',icon:'B'},SOL:{bg:'#9945ff',icon:'◎'},
    XRP:{bg:'#346aa9',icon:'X'},ADA:{bg:'#0d1e2d',icon:'A'},
    TON:{bg:'#0088cc',icon:'T'},KAT:{bg:'#ff6b35',icon:'K'},
    PI:{bg:'#8b4513',icon:'π'},OFC:{bg:'#4ecdc4',icon:'O'},
    BASED:{bg:'#0052ff',icon:'B'},CHIP:{bg:'#a855f7',icon:'C'},
    LTC:{bg:'#bfbbbb',icon:'Ł'},DOT:{bg:'#e6007a',icon:'●'},
  };

  function getCoinMeta(sym) {
    const s = sym.toUpperCase().replace(/-USDT$/, '').replace(/-USD$/, '');
    return COIN_META[s] || { bg: '#4ecdc4', icon: s.charAt(0) };
  }

  function fmt(n, dec = 2) {
    if (isNaN(n) || n === null) return '0';
    return parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  function fmtTime(d) {
    return new Date(d).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  }

  // ---- Build Sidebar HTML ----
  function buildSidebarHTML() {
    return `
      <div id="hc-header">
        <div id="hc-logo">
          <div id="hc-logo-icon">₿</div>
          <div>
            <span id="hc-logo-text">HAMMAD CRYPTO</span>
            <span id="hc-logo-ver">Pro</span>
          </div>
        </div>
        <div id="hc-header-right">
          <div class="hc-status-badge hc-disconnected" id="hc-statusBadge">
            <div class="hc-status-dot"></div>
            <span id="hc-statusText">غير متصل</span>
          </div>
          <button class="hc-icon-btn" id="hc-refreshBtn" title="تحديث">↻</button>
          <button class="hc-icon-btn hc-close-x" id="hc-closeBtn" title="إغلاق">✕</button>
        </div>
      </div>

      <div id="hc-ticker">
        <div id="hc-ticker-track"></div>
      </div>

      <div id="hc-tabs">
        <div class="hc-tab hc-active" data-tab="home" id="hc-tab-home">🏠<span>الرئيسية</span></div>
        <div class="hc-tab" data-tab="ai" id="hc-tab-ai">🤖<span>تحليل</span></div>
        <div class="hc-tab" data-tab="alerts" id="hc-tab-alerts">🔔<span>تنبيهات</span></div>
        <div class="hc-tab" data-tab="settings" id="hc-tab-settings">⚙️<span>إعدادات</span></div>
      </div>

      <div id="hc-body">

        <!-- HOME -->
        <div class="hc-page hc-active" id="hc-page-home">
          <div id="hc-homeContent">
            <div class="hc-loading"><div class="hc-spinner"></div><div class="hc-loading-text">جاري تحميل المحفظة...</div></div>
          </div>
        </div>

        <!-- AI -->
        <div class="hc-page" id="hc-page-ai">
          <div id="hc-ai-bar">
            <span class="hc-badge-ai">🤖 AI تحليل</span>
            <span id="hc-aiStatusText">جاري التحميل...</span>
            <button class="hc-btn hc-btn-sm hc-btn-g" id="hc-aiNowBtn">تحليل الآن</button>
          </div>
          <div id="hc-aiContent">
            <div class="hc-loading"><div class="hc-spinner"></div><div class="hc-loading-text">جاري التحليل...</div></div>
          </div>
        </div>

        <!-- ALERTS -->
        <div class="hc-page" id="hc-page-alerts">
          <div id="hc-alerts-bar">
            <span>🔔 التنبيهات</span>
            <button class="hc-btn hc-btn-sm hc-btn-gr" id="hc-clearAlertsBtn">مسح الكل</button>
          </div>
          <div id="hc-alertsContent"><div class="hc-no-data">لا توجد تنبيهات</div></div>
        </div>

        <!-- SETTINGS -->
        <div class="hc-page" id="hc-page-settings">
          <div class="hc-settings-sec hc-api-sec">
            <div class="hc-settings-title">
              <span>🔑</span> بيانات OKX API
              <span class="hc-api-status hc-not-saved" id="hc-apiStatusBadge">غير محفوظ</span>
            </div>
            <div class="hc-settings-body">
              <input class="hc-inp" type="password" id="hc-inp_api" placeholder="API Key" autocomplete="off">
              <input class="hc-inp" type="password" id="hc-inp_sec" placeholder="Secret Key" autocomplete="off">
              <input class="hc-inp" type="password" id="hc-inp_pass" placeholder="Passphrase" autocomplete="off">
              <div class="hc-btn-row">
                <button class="hc-btn hc-btn-g" id="hc-saveCredsBtn">💾 حفظ</button>
                <button class="hc-btn hc-btn-gr" id="hc-testConnBtn">🔌 اختبار</button>
                <button class="hc-btn hc-btn-r" id="hc-removeCredsBtn">🗑️</button>
              </div>
              <div class="hc-cs" id="hc-connSt" style="display:none"></div>
            </div>
          </div>
          <div class="hc-settings-sec hc-ticker-sec">
            <div class="hc-settings-title"><span>📊</span> عملات الشريط</div>
            <div class="hc-settings-body">
              <input class="hc-inp" id="hc-tickerCoinsInp" value="BTC,ETH,KAT,PI,OFC,BASED,CHIP" style="direction:ltr">
              <button class="hc-btn hc-btn-g" id="hc-updateTickerBtn" style="width:100%">تحديث الشريط</button>
            </div>
          </div>
          <div class="hc-footer">برمجة وتطوير بكل ❤️ المهندس محمد حماد<br><span style="color:#10b981">Hammad Crypto v3.2 Pro</span></div>
        </div>

      </div>
    `;
  }

  // ---- Inject Styles ----
  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'hc-internal-styles';
    style.textContent = `
      #hammad-crypto-sidebar * { box-sizing: border-box !important; font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif !important; direction: rtl !important; }

      /* Header */
      #hc-header { background: linear-gradient(180deg,rgba(12,16,24,0.95),rgba(6,8,15,0.98)); border-bottom: 1px solid #1e293b; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; position: relative; }
      #hc-header::after { content:''; position:absolute; bottom:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,#10b981,transparent); opacity:0.3; }
      #hc-logo { display: flex; align-items: center; gap: 10px; }
      #hc-logo-icon { width: 34px; height: 34px; background: linear-gradient(135deg,#10b981,#059669); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 900; color: #fff; box-shadow: 0 4px 12px rgba(16,185,129,0.3); position: relative; overflow: hidden; }
      #hc-logo-icon::before { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,0.2),transparent); border-radius:10px; }
      #hc-logo-text { font-size: 14px; font-weight: 800; background: linear-gradient(135deg,#10b981,#06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      #hc-logo-ver { font-size: 9px; color: #475569; font-weight: 700; margin-right: 4px; }
      #hc-header-right { display: flex; align-items: center; gap: 6px; }

      /* Status Badge */
      .hc-status-badge { display:flex; align-items:center; gap:5px; font-size:10px; font-weight:700; padding:4px 10px; border-radius:20px; transition:all .25s; }
      .hc-status-badge.hc-connected { background:rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.3); }
      .hc-status-badge.hc-disconnected { background:rgba(239,68,68,0.12); color:#ef4444; border:1px solid rgba(239,68,68,0.3); }
      .hc-status-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
      .hc-status-badge.hc-connected .hc-status-dot { background:#10b981; box-shadow:0 0 6px #10b981; animation:hcPulse 2s infinite; }
      .hc-status-badge.hc-disconnected .hc-status-dot { background:#ef4444; }
      @keyframes hcPulse { 0%,100%{opacity:1}50%{opacity:.4} }

      .hc-icon-btn { background:#111827; border:1px solid #1e293b; border-radius:6px; width:30px; height:30px; cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center; color:#94a3b8; transition:all .25s; }
      .hc-icon-btn:hover { border-color:#10b981; color:#10b981; background:rgba(16,185,129,0.08); }
      .hc-close-x:hover { border-color:#ef4444 !important; color:#ef4444 !important; }
      .hc-spin { animation: hcSpin .8s linear infinite; }
      @keyframes hcSpin { to { transform: rotate(360deg); } }

      /* Ticker */
      #hc-ticker { background:#0c1018; border-bottom:1px solid #1e293b; padding:6px 0; overflow:hidden; white-space:nowrap; flex-shrink:0; height:26px; }
      #hc-ticker-track { display:inline-flex; gap:16px; animation:hcScroll 22s linear infinite; padding:0 8px; }
      @keyframes hcScroll { 0%{transform:translateX(0)}100%{transform:translateX(-50%)} }
      .hc-ti { display:inline-flex; align-items:center; gap:4px; font-size:10px; }
      .hc-ti-sym { font-weight:700; color:#f1f5f9; }
      .hc-ti-p { color:#94a3b8; }
      .hc-ti-c.hc-up { color:#10b981; }
      .hc-ti-c.hc-dn { color:#ef4444; }

      /* Tabs */
      #hc-tabs { display:flex; background:#0c1018; border-bottom:1px solid #1e293b; flex-shrink:0; }
      .hc-tab { flex:1; padding:9px 2px; text-align:center; font-size:9px; color:#475569; cursor:pointer; border-bottom:2px solid transparent; transition:all .25s; display:flex; flex-direction:column; align-items:center; gap:2px; }
      .hc-tab span { font-size:9px; font-weight:700; letter-spacing:0.3px; }
      .hc-tab:first-child { font-size:13px; }
      .hc-tab.hc-active { border-bottom-color:#10b981; color:#10b981; background:rgba(16,185,129,0.04); }
      .hc-tab:hover { color:#94a3b8; background:rgba(255,255,255,0.02); }

      /* Body scroll */
      #hc-body { flex:1; overflow-y:auto; overflow-x:hidden; background:#06080f; }
      #hc-body::-webkit-scrollbar { width:3px; }
      #hc-body::-webkit-scrollbar-track { background:transparent; }
      #hc-body::-webkit-scrollbar-thumb { background:#334155; border-radius:2px; }
      .hc-page { display:none; }
      .hc-page.hc-active { display:block; animation:hcPageIn .35s ease; }
      @keyframes hcPageIn { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }

      /* Hero Card */
      .hc-hero { background:linear-gradient(145deg,#111827,#0f172a); padding:16px; margin:12px; border-radius:12px; border:1px solid #1e293b; position:relative; overflow:hidden; }
      .hc-hero::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,#10b981,#06b6d4,#10b981); opacity:0.6; }
      .hc-hero-label { font-size:11px; color:#94a3b8; margin-bottom:4px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; }
      .hc-hero-val { font-size:26px; font-weight:900; background:linear-gradient(135deg,#fff,#10b981); -webkit-background-clip:text; -webkit-text-fill-color:transparent; line-height:1.1; }
      .hc-hero-egp { font-size:11px; color:#f59e0b; margin-top:6px; font-weight:600; }
      .hc-hero-stats { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:14px; }
      .hc-hs { background:#06080f; border:1px solid #1e293b; border-radius:8px; padding:8px; text-align:center; transition:all .25s; }
      .hc-hs:hover { border-color:#10b981; transform:translateY(-2px); }
      .hc-hs-l { font-size:8px; color:#475569; margin-bottom:3px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }
      .hc-hs-v { font-size:12px; font-weight:900; }
      .hc-green { color:#10b981 !important; }
      .hc-red { color:#ef4444 !important; }
      .hc-gold { color:#f59e0b !important; }
      .hc-blue { color:#06b6d4 !important; }

      /* Sec title */
      .hc-sec-title { font-size:10px; color:#94a3b8; font-weight:800; padding:10px 14px 4px; display:flex; justify-content:space-between; align-items:center; text-transform:uppercase; letter-spacing:0.8px; }
      .hc-sec-badge { background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); border-radius:6px; padding:3px 10px; font-size:9px; color:#10b981; font-weight:700; }

      /* Asset */
      .hc-asset { display:grid; grid-template-columns:42px 1fr auto; gap:10px; align-items:center; padding:10px 12px; border-bottom:1px solid rgba(30,41,59,0.5); transition:all .2s; position:relative; }
      .hc-asset:hover { background:rgba(16,185,129,0.03); padding-right:16px; }
      .hc-asset::after { content:''; position:absolute; right:0; top:0; height:100%; width:3px; background:linear-gradient(180deg,transparent,#10b981,transparent); opacity:0; transition:opacity .2s; }
      .hc-asset:hover::after { opacity:1; }
      .hc-a-icon { width:42px; height:42px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:800; flex-shrink:0; border:2px solid; position:relative; transition:all .2s; }
      .hc-a-icon::before { content:''; position:absolute; inset:0; border-radius:8px; background:linear-gradient(135deg,rgba(255,255,255,0.15),transparent); pointer-events:none; }
      .hc-asset:hover .hc-a-icon { transform:scale(1.08); }
      .hc-a-info { flex:1; min-width:0; }
      .hc-a-name { font-size:13px; font-weight:800; color:#f1f5f9; }
      .hc-a-qty { font-size:9px; color:#94a3b8; margin-top:2px; }
      .hc-alloc-bar { height:3px; background:#1e293b; border-radius:2px; margin-top:4px; overflow:hidden; }
      .hc-alloc-fill { height:100%; background:linear-gradient(90deg,#10b981,#06b6d4); border-radius:2px; }
      .hc-a-right { text-align:left; flex-shrink:0; }
      .hc-a-val { font-size:13px; font-weight:800; color:#f1f5f9; }
      .hc-a-pnl { font-size:10px; font-weight:700; margin-top:2px; }
      .hc-a-daily { font-size:9px; color:#475569; margin-top:1px; }

      /* AI */
      #hc-ai-bar { padding:10px 12px; background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(16,185,129,0.08)); border-bottom:1px solid #1e293b; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
      .hc-badge-ai { background:linear-gradient(135deg,#8b5cf6,#6366f1); border-radius:6px; padding:4px 10px; font-size:9px; font-weight:800; color:white; box-shadow:0 4px 12px rgba(139,92,246,0.3); }
      #hc-aiStatusText { font-size:9px; color:#94a3b8; flex:1; }
      .hc-ai-card { background:#111827; border:1px solid #1e293b; border-radius:12px; margin:10px 12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.3); transition:all .25s; position:relative; }
      .hc-ai-card:hover { border-color:#10b981; }
      .hc-ai-card::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,#10b981,transparent); opacity:0; transition:opacity .25s; }
      .hc-ai-card:hover::before { opacity:1; }
      .hc-ai-top { display:flex; align-items:center; gap:10px; padding:14px 16px; background:rgba(0,0,0,0.15); border-bottom:1px solid #1e293b; }
      .hc-ai-icon { width:38px; height:38px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:800; border:2px solid; flex-shrink:0; transition:all .25s; position:relative; }
      .hc-ai-icon::before { content:''; position:absolute; inset:0; border-radius:8px; background:linear-gradient(135deg,rgba(255,255,255,0.15),transparent); pointer-events:none; }
      .hc-ai-card:hover .hc-ai-icon { transform:scale(1.1); }
      .hc-ai-name { font-size:14px; font-weight:800; color:#f1f5f9; }
      .hc-ai-trend { font-size:10px; color:#94a3b8; margin-top:2px; }
      .hc-signal { display:inline-flex; align-items:center; gap:3px; border-radius:6px; padding:5px 12px; font-size:10px; font-weight:800; margin-right:auto; }
      .hc-signal.buy { background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.4); color:#10b981; }
      .hc-signal.hold { background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.4); color:#f59e0b; }
      .hc-signal.sell { background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.4); color:#ef4444; }
      .hc-ai-reason { font-size:11px; color:#94a3b8; line-height:1.7; padding:10px 12px; background:#06080f; border-radius:6px; border-right:3px solid #10b981; margin:14px 16px; }
      .hc-scores { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; padding:0 16px 14px; }
      .hc-sc { background:#06080f; border:1px solid #1e293b; border-radius:8px; padding:8px; text-align:center; transition:all .2s; }
      .hc-sc:hover { border-color:#10b981; }
      .hc-sc-l { font-size:8px; color:#475569; margin-bottom:3px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }
      .hc-sc-v { font-size:15px; font-weight:900; }
      .hc-prog { height:3px; background:#1e293b; border-radius:2px; overflow:hidden; margin-top:4px; }
      .hc-prog-fill { height:100%; border-radius:2px; }

      /* Alerts */
      #hc-alerts-bar { padding:10px 12px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; font-size:12px; font-weight:800; color:#f1f5f9; }
      .hc-alert-item { display:flex; align-items:flex-start; gap:10px; padding:10px 12px; border-bottom:1px solid #1e293b; transition:background .2s; }
      .hc-alert-item:hover { background:rgba(255,255,255,0.02); }
      .hc-al-dot { width:8px; height:8px; border-radius:50%; margin-top:4px; flex-shrink:0; }
      .hc-al-title { font-size:11px; font-weight:700; color:#f1f5f9; }
      .hc-al-body { font-size:10px; color:#94a3b8; margin-top:2px; line-height:1.5; }
      .hc-al-time { font-size:9px; color:#475569; margin-top:2px; }
      .hc-alert-unread { background:rgba(16,185,129,0.06); border-right:3px solid #10b981; }

      /* Settings */
      .hc-settings-sec { margin:12px; background:#111827; border:1px solid #1e293b; border-radius:12px; overflow:hidden; position:relative; }
      .hc-settings-sec::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; }
      .hc-api-sec::before { background:linear-gradient(90deg,#10b981,#06b6d4); }
      .hc-ticker-sec::before { background:linear-gradient(90deg,#3b82f6,#06b6d4); }
      .hc-settings-title { font-size:12px; font-weight:800; padding:12px 14px; display:flex; align-items:center; gap:8px; border-bottom:1px solid #1e293b; background:rgba(0,0,0,0.15); }
      .hc-settings-body { padding:14px; }
      .hc-inp { width:100%; background:#06080f; border:1px solid #1e293b; border-radius:8px; padding:10px 12px; color:#f1f5f9; font-size:12px; margin-bottom:10px; direction:ltr; outline:none; transition:all .25s; }
      .hc-inp:focus { border-color:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,0.12); }
      .hc-inp::placeholder { color:#475569; }
      .hc-btn { border:none; border-radius:8px; padding:8px 14px; font-size:10px; font-weight:700; cursor:pointer; transition:all .25s; }
      .hc-btn-g { background:linear-gradient(135deg,#10b981,#059669); color:#fff; box-shadow:0 4px 15px rgba(16,185,129,0.3); }
      .hc-btn-g:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(16,185,129,0.4); }
      .hc-btn-g:active { transform:translateY(0); }
      .hc-btn-r { background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.4); color:#ef4444; }
      .hc-btn-r:hover { background:rgba(239,68,68,0.2); }
      .hc-btn-gr { background:#1e293b; border:1px solid #334155; color:#94a3b8; }
      .hc-btn-gr:hover { border-color:#10b981; color:#10b981; }
      .hc-btn-sm { font-size:9px; padding:5px 10px; }
      .hc-btn-row { display:flex; gap:8px; }

      /* API Status Badge */
      .hc-api-status { display:inline-flex; align-items:center; font-size:9px; font-weight:700; padding:3px 8px; border-radius:20px; margin-right:auto; }
      .hc-api-status.hc-saved { background:rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.3); }
      .hc-api-status.hc-not-saved { background:rgba(239,68,68,0.12); color:#ef4444; border:1px solid rgba(239,68,68,0.3); }

      .hc-cs { display:flex; align-items:center; gap:4px; font-size:11px; font-weight:600; padding:8px 12px; border-radius:8px; margin-top:8px; }
      .hc-cs.ok { background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); color:#10b981; }
      .hc-cs.fail { background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); color:#ef4444; }

      /* Loading / No-data */
      .hc-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px; gap:10px; }
      .hc-spinner { width:36px; height:36px; border:3px solid #1e293b; border-top-color:#10b981; border-radius:50%; animation:hcSpin .8s linear infinite; }
      .hc-loading-text { font-size:12px; color:#94a3b8; font-weight:600; }
      .hc-no-data { text-align:center; padding:30px; color:#475569; font-size:12px; line-height:1.7; }

      /* Footer */
      .hc-footer { text-align:center; padding:14px; color:#475569; font-size:9px; border-top:1px solid #1e293b; margin-top:8px; line-height:1.8; }

      /* Sync pulse */
      .hc-sync-flash { animation:hcFlash .5s ease; }
      @keyframes hcFlash { 0%{background:rgba(16,185,129,0.1)}100%{background:transparent} }
    `;
    document.head.appendChild(style);
  }

  // ---- Create DOM ----
  function createSidebar() {
    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'hc-toggle-btn';
    toggleBtn.innerHTML = '◀ HC';
    toggleBtn.title = 'Hammad Crypto';
    document.body.appendChild(toggleBtn);

    // Sidebar
    const sidebar = document.createElement('div');
    sidebar.id = 'hammad-crypto-sidebar';
    sidebar.innerHTML = buildSidebarHTML();
    document.body.appendChild(sidebar);

    // Events
    toggleBtn.addEventListener('click', toggleSidebar);
    sidebar.querySelector('#hc-closeBtn').addEventListener('click', closeSidebar);
    sidebar.querySelector('#hc-refreshBtn').addEventListener('click', doRefresh);
    sidebar.querySelector('#hc-aiNowBtn').addEventListener('click', triggerAI);
    sidebar.querySelector('#hc-clearAlertsBtn').addEventListener('click', clearAlerts);
    sidebar.querySelector('#hc-saveCredsBtn').addEventListener('click', saveCreds);
    sidebar.querySelector('#hc-testConnBtn').addEventListener('click', testConn);
    sidebar.querySelector('#hc-removeCredsBtn').addEventListener('click', removeCreds);
    sidebar.querySelector('#hc-updateTickerBtn').addEventListener('click', updateTicker);

    // Tab clicks
    sidebar.querySelectorAll('.hc-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
  }

  // ---- Toggle ----
  function toggleSidebar() {
    isOpen ? closeSidebar() : openSidebar();
  }

  function openSidebar() {
    isOpen = true;
    document.getElementById('hammad-crypto-sidebar').classList.add('hc-open');
    document.getElementById('hc-toggle-btn').classList.add('hc-open');
    document.getElementById('hc-toggle-btn').innerHTML = '▶';
    initTicker();
    loadPortfolio();
    checkApiStatus();
  }

  function closeSidebar() {
    isOpen = false;
    document.getElementById('hammad-crypto-sidebar').classList.remove('hc-open');
    document.getElementById('hc-toggle-btn').classList.remove('hc-open');
    document.getElementById('hc-toggle-btn').innerHTML = '◀ HC';
  }

  // ---- API Status ----
  function updateApiStatus(saved) {
    apiSaved = saved;
    const badge = document.getElementById('hc-apiStatusBadge');
    const statusBadge = document.getElementById('hc-statusBadge');
    const statusText = document.getElementById('hc-statusText');
    if (badge) {
      badge.className = 'hc-api-status ' + (saved ? 'hc-saved' : 'hc-not-saved');
      badge.textContent = saved ? 'محفوظ ✓' : 'غير محفوظ';
    }
    if (statusBadge) {
      statusBadge.className = 'hc-status-badge ' + (saved ? 'hc-connected' : 'hc-disconnected');
    }
    if (statusText) {
      statusText.textContent = saved ? 'متصل' : 'غير متصل';
    }
  }

  function checkApiStatus() {
    chrome.runtime.sendMessage({ type: 'CHECK_CREDENTIALS' }, (res) => {
      if (chrome.runtime.lastError) { updateApiStatus(false); return; }
      updateApiStatus(res?.hasCredentials || false);
    });
  }

  // ---- Tab Navigation ----
  function switchTab(tab) {
    document.querySelectorAll('.hc-page').forEach(p => p.classList.remove('hc-active'));
    document.querySelectorAll('.hc-tab').forEach(t => t.classList.remove('hc-active'));
    document.getElementById('hc-page-' + tab).classList.add('hc-active');
    document.getElementById('hc-tab-' + tab).classList.add('hc-active');
    currentTab = tab;
    if (tab === 'ai') loadAI();
    if (tab === 'alerts') renderAlerts();
    if (tab === 'settings') checkApiStatus();
  }

  // ---- Portfolio ----
  function loadPortfolio() {
    chrome.runtime.sendMessage({ type: 'GET_PORTFOLIO' }, (res) => {
      if (res && res.data) {
        portfolio = res.data;
        renderHome();
        updateApiStatus(true);
      } else {
        renderNoCredentials();
      }
    });
  }

  function renderHome() {
    if (!portfolio) { renderNoCredentials(); return; }
    const { total, invested, profit, egpRate, assets } = portfolio;
    const todayPnl = assets.reduce((s, a) => s + (a.value * (a.dailyChangePct / 100) || 0), 0);
    const egpVal = total * (egpRate || 50.8);

    const el = document.getElementById('hc-homeContent');
    el.classList.add('hc-sync-flash');
    setTimeout(() => el.classList.remove('hc-sync-flash'), 600);

    el.innerHTML = `
      <div class="hc-hero">
        <div class="hc-hero-label">إجمالي المحفظة</div>
        <div class="hc-hero-val">$${fmt(total, 2)}</div>
        <div class="hc-hero-egp">ج.م ${fmt(egpVal, 0)}</div>
        <div class="hc-hero-stats">
          <div class="hc-hs"><div class="hc-hs-l">صافي الربح</div><div class="hc-hs-v ${profit >= 0 ? 'hc-green' : 'hc-red'}">${profit >= 0 ? '+' : ''}$${fmt(profit, 0)}</div></div>
          <div class="hc-hs"><div class="hc-hs-l">ربح اليوم</div><div class="hc-hs-v ${todayPnl >= 0 ? 'hc-green' : 'hc-red'}">${todayPnl >= 0 ? '+' : ''}$${fmt(todayPnl, 2)}</div></div>
          <div class="hc-hs"><div class="hc-hs-l">سعر الدولار</div><div class="hc-hs-v hc-gold">ج.م ${(egpRate || 50.8).toFixed(1)}</div></div>
        </div>
      </div>
      <div class="hc-sec-title"><span>الأصول النشطة</span><span class="hc-sec-badge">${assets.length} عملة</span></div>
      ${assets.map(a => {
        const m = getCoinMeta(a.sym);
        const pos = a.unrealizedPnL >= 0;
        return `<div class="hc-asset">
          <div class="hc-a-icon" style="background:${m.bg}18;color:${m.bg};border-color:${m.bg}40">${m.icon}</div>
          <div class="hc-a-info">
            <div class="hc-a-name">${a.sym}</div>
            <div class="hc-a-qty">${fmt(a.qty, 4)} — avg $${fmt(a.avgBuy || a.price, 4)}</div>
            <div class="hc-alloc-bar"><div class="hc-alloc-fill" style="width:${a.allocPct.toFixed(1)}%"></div></div>
          </div>
          <div class="hc-a-right">
            <div class="hc-a-val">$${fmt(a.value, 2)}</div>
            <div class="hc-a-pnl ${pos ? 'hc-green' : 'hc-red'}">${pos ? '+' : ''}${fmt(a.unrealizedPnL, 2)} (${pos ? '+' : ''}${fmt(a.unrealizedPnLPct, 1)}%)</div>
            <div class="hc-a-daily ${a.dailyChangePct >= 0 ? 'hc-green' : 'hc-red'}">${a.dailyChangePct >= 0 ? '▲' : '▼'} ${Math.abs(a.dailyChangePct).toFixed(2)}%</div>
          </div>
        </div>`;
      }).join('')}
    `;
  }

  function renderNoCredentials() {
    const el = document.getElementById('hc-homeContent');
    if (el) el.innerHTML = `
      <div class="hc-no-data" style="padding:40px 16px">
        <div style="font-size:40px;margin-bottom:14px">🔑</div>
        <div style="font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:10px">أضف مفاتيح OKX API</div>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:20px;line-height:1.8">اذهب إلى ⚙️ إعدادات وأدخل البيانات</div>
      </div>`;
    updateApiStatus(false);
  }

  // ---- AI ----
  function loadAI() {
    chrome.runtime.sendMessage({ type: 'GET_AI' }, (res) => {
      if (res && res.data && res.data.length) {
        aiAnalyses = res.data;
        document.getElementById('hc-aiStatusText').textContent = 'آخر تحديث: ' + fmtTime(res.lastUpdate || Date.now());
        renderAI();
      } else {
        document.getElementById('hc-aiContent').innerHTML = '<div class="hc-no-data">لا يوجد تحليل — اضغط "تحليل الآن"</div>';
        document.getElementById('hc-aiStatusText').textContent = 'لم يتم التحليل بعد';
      }
    });
  }

  function renderAI() {
    if (!aiAnalyses.length) {
      document.getElementById('hc-aiContent').innerHTML = '<div class="hc-no-data">لا يوجد تحليل</div>';
      return;
    }
    document.getElementById('hc-aiContent').innerHTML = aiAnalyses.map(a => {
      const m = getCoinMeta(a.sym);
      const sig = a.signal || 'hold';
      const conf = a.confidence || 50;
      const bull = a.bullScore || 50;
      const bear = a.bearScore || 50;
      return `<div class="hc-ai-card">
        <div class="hc-ai-top">
          <div class="hc-ai-icon" style="background:${m.bg}18;color:${m.bg};border-color:${m.bg}40">${m.icon}</div>
          <div><div class="hc-ai-name">${a.sym} — $${fmt(a.price, 4)}</div><div class="hc-ai-trend">${a.trend || 'محايد'}</div></div>
          <span class="hc-signal ${sig}">${sig === 'buy' ? '🟢 شراء' : sig === 'sell' ? '🔴 بيع' : '🟡 انتظار'}</span>
        </div>
        <div class="hc-ai-reason">${a.reason || 'جاري التحليل...'}</div>
        <div class="hc-scores">
          <div class="hc-sc"><div class="hc-sc-l">الثقة</div><div class="hc-sc-v hc-blue">${conf}%</div><div class="hc-prog"><div class="hc-prog-fill" style="width:${conf}%;background:#06b6d4"></div></div></div>
          <div class="hc-sc"><div class="hc-sc-l">صعودي</div><div class="hc-sc-v hc-green">${bull}%</div><div class="hc-prog"><div class="hc-prog-fill" style="width:${bull}%;background:#10b981"></div></div></div>
          <div class="hc-sc"><div class="hc-sc-l">هبوطي</div><div class="hc-sc-v hc-red">${bear}%</div><div class="hc-prog"><div class="hc-prog-fill" style="width:${bear}%;background:#ef4444"></div></div></div>
        </div>
        ${a.support ? `<div style="display:flex;gap:10px;margin:0 16px 14px;font-size:10px;flex-wrap:wrap">
          <span class="hc-green">دعم: $${fmt(a.support, 4)}</span>
          <span style="color:#475569">|</span>
          <span class="hc-red">مقاومة: $${fmt(a.resistance || 0, 4)}</span>
          <span style="color:#475569">|</span>
          <span class="hc-gold">وقف: $${fmt(a.stopLoss || 0, 4)}</span>
        </div>` : ''}
      </div>`;
    }).join('');
  }

  function triggerAI() {
    document.getElementById('hc-aiContent').innerHTML = '<div class="hc-loading"><div class="hc-spinner"></div><div class="hc-loading-text">جاري التحليل...</div></div>';
    document.getElementById('hc-aiStatusText').textContent = 'جاري التحليل...';
    chrome.runtime.sendMessage({ type: 'RUN_AI' }, () => {
      setTimeout(loadAI, 3500);
    });
  }

  // ---- Alerts ----
  function addAlert(title, body, type = 'info') {
    alerts.unshift({ id: Date.now(), title, body, type, time: new Date(), read: false });
    chrome.storage.local.set({ popup_alerts: alerts });
    if (currentTab === 'alerts') renderAlerts();
  }

  function renderAlerts() {
    const el = document.getElementById('hc-alertsContent');
    if (!el) return;
    if (!alerts.length) { el.innerHTML = '<div class="hc-no-data">لا توجد تنبيهات</div>'; return; }
    const colMap = { profit: '#10b981', alert: '#ef4444', ai: '#8b5cf6', info: '#3b82f6' };
    el.innerHTML = alerts.map(a => `
      <div class="hc-alert-item ${a.read ? '' : 'hc-alert-unread'}">
        <div class="hc-al-dot" style="background:${colMap[a.type] || '#3b82f6'}"></div>
        <div>
          <div class="hc-al-title">${a.title}</div>
          <div class="hc-al-body">${a.body}</div>
          <div class="hc-al-time">${fmtTime(a.time)}</div>
        </div>
      </div>`).join('');
  }

  function clearAlerts() {
    alerts = [];
    chrome.storage.local.set({ popup_alerts: [] });
    renderAlerts();
  }

  // ---- Settings ----
  function saveCreds() {
    const apiKey = document.getElementById('hc-inp_api').value.trim();
    const secretKey = document.getElementById('hc-inp_sec').value.trim();
    const passphrase = document.getElementById('hc-inp_pass').value.trim();
    if (!apiKey || !secretKey || !passphrase) { showCS('fail', '⚠️ يرجى ملء جميع الحقول'); return; }
    chrome.runtime.sendMessage({ type: 'SAVE_CREDENTIALS', creds: { apiKey, secretKey, passphrase } }, (res) => {
      if (res?.ok) {
        showCS('ok', '✅ تم حفظ البيانات بنجاح — محفوظة على جهازك فقط');
        updateApiStatus(true);
        addAlert('🔑 OKX', 'تم حفظ بيانات API بنجاح', 'info');
        setTimeout(() => loadPortfolio(), 2000);
      }
    });
  }

  function removeCreds() {
    if (!confirm('هل تريد حذف بيانات OKX API؟')) return;
    chrome.runtime.sendMessage({ type: 'REMOVE_CREDENTIALS' }, (res) => {
      if (res?.ok) {
        showCS('fail', '🗑️ تم حذف البيانات');
        updateApiStatus(false);
        document.getElementById('hc-inp_api').value = '';
        document.getElementById('hc-inp_sec').value = '';
        document.getElementById('hc-inp_pass').value = '';
      }
    });
  }

  async function testConn() {
    showCS('fail', '⏳ جاري الاختبار...');
    const apiKey = document.getElementById('hc-inp_api').value.trim();
    const secretKey = document.getElementById('hc-inp_sec').value.trim();
    const passphrase = document.getElementById('hc-inp_pass').value.trim();
    if (!apiKey || !secretKey || !passphrase) { showCS('fail', '⚠️ أدخل البيانات أولاً'); return; }
    try {
      const ts = new Date().toISOString();
      const path = '/api/v5/account/balance';
      const preSign = ts + 'GET' + path;
      const k = new TextEncoder().encode(secretKey);
      const m = new TextEncoder().encode(preSign);
      const ck = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sig = await crypto.subtle.sign('HMAC', ck, m);
      const sign = btoa(String.fromCharCode(...new Uint8Array(sig)));
      const res = await fetch('https://www.okx.com/api/v5/account/balance', {
        headers: { 'OK-ACCESS-KEY': apiKey, 'OK-ACCESS-SIGN': sign, 'OK-ACCESS-TIMESTAMP': ts, 'OK-ACCESS-PASSPHRASE': passphrase, 'Content-Type': 'application/json' }
      });
      showCS(res.ok ? 'ok' : 'fail', res.ok ? '🟢 الاتصال بـ OKX ناجح!' : '🔴 بيانات غير صحيحة');
      if (res.ok) updateApiStatus(true);
    } catch { showCS('fail', '⚠️ فشل الاتصال — تحقق من الشبكة'); }
  }

  function showCS(type, msg) {
    const el = document.getElementById('hc-connSt');
    if (!el) return;
    el.style.display = 'flex';
    el.className = 'hc-cs ' + type;
    el.textContent = msg;
  }

  // ---- Refresh ----
  function doRefresh() {
    const btn = document.getElementById('hc-refreshBtn');
    btn.classList.add('hc-spin');
    chrome.runtime.sendMessage({ type: 'FORCE_REFRESH' }, () => {
      setTimeout(() => {
        btn.classList.remove('hc-spin');
        loadPortfolio();
        addAlert('🔄 تحديث', 'تم تحديث بيانات المحفظة', 'info');
      }, 2000);
    });
  }

  // ---- Ticker ----
  function initTicker() {
    const stored = localStorage.getItem('hcTickerCoins') || 'BTC,ETH,KAT,PI,OFC,BASED,CHIP';
    const inp = document.getElementById('hc-tickerCoinsInp');
    if (inp) inp.value = stored;

    const demoTicker = {
      BTC:{p:68450,c:2.34},ETH:{p:3890,c:1.87},KAT:{p:0.0245,c:-0.85},
      PI:{p:2.35,c:5.2},OFC:{p:0.0012,c:12.5},BASED:{p:0.00045,c:-2.1},CHIP:{p:0.0089,c:8.7}
    };

    const coins = stored.split(',').map(c => c.trim()).filter(Boolean);
    const items = coins.map(sym => {
      const d = demoTicker[sym] || { p: Math.random() * 100, c: (Math.random() - 0.5) * 10 };
      const up = d.c >= 0;
      return `<span class="hc-ti">
        <span class="hc-ti-sym">${sym}</span>
        <span class="hc-ti-p">$${fmt(d.p, d.p < 1 ? 6 : 2)}</span>
        <span class="hc-ti-c ${up ? 'hc-up' : 'hc-dn'}">${up ? '+' : ''}${d.c.toFixed(2)}%</span>
      </span>`;
    }).join('');

    const track = document.getElementById('hc-ticker-track');
    if (track) track.innerHTML = items + items;
  }

  function updateTicker() {
    const v = document.getElementById('hc-tickerCoinsInp').value;
    localStorage.setItem('hcTickerCoins', v);
    initTicker();
  }

  // ---- Listen to background updates ----
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PORTFOLIO_UPDATED') {
      portfolio = msg.data;
      if (isOpen && currentTab === 'home') renderHome();
      updateApiStatus(true);
    }
    if (msg.type === 'AI_UPDATED') {
      aiAnalyses = msg.data;
      if (isOpen && currentTab === 'ai') renderAI();
    }
  });

  // ---- Load alerts ----
  chrome.storage.local.get('popup_alerts', (r) => {
    alerts = r.popup_alerts || [
      { id: 1, title: '🎉 مرحباً', body: 'أضف مفاتيح OKX API لبدء المتابعة', type: 'info', time: new Date(), read: false }
    ];
  });

  // ---- Ticker live update ----
  setInterval(() => {
    document.querySelectorAll('.hc-ti-c').forEach(el => {
      const v = parseFloat(el.textContent);
      const nv = (v + (Math.random() - 0.5) * 0.3).toFixed(2);
      el.textContent = (nv >= 0 ? '+' : '') + nv + '%';
      el.className = 'hc-ti-c ' + (nv >= 0 ? 'hc-up' : 'hc-dn');
    });
  }, 5000);

  // ---- INIT ----
  injectStyles();
  createSidebar();

})();
