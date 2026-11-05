/**
 * NIGHTLINE · Railway Edition — panel front-end
 * Vanilla ES module, no build step, no framework. Every string is dual
 * language (fa/en) and toggled with html[data-lang].
 */

const S = {
  state: null,
  boot: null,
  tab: 'dashboard',
  editing: null,      // inbound id being edited
  logSource: 'xray',
  logTimer: null,
  refreshTimer: null,
  busy: false,
};

/* ── tiny helpers ────────────────────────────────────────────────────── */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const t = (fa, en) => `<span class="fa">${fa}</span><span class="en">${en}</span>`;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (name, cls = 'ic') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;

function fmtBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[i]}`;
}

function fmtDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toISOString().slice(0, 10);
}

function fmtUptime(ms) {
  if (!ms || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function relTime(ms) {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  if (diff < 60000) return `${Math.max(1, Math.floor(diff / 1000))}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

function toast(message, kind = 'ok') {
  const el = $('#toast');
  el.hidden = false;
  el.textContent = message;
  el.className = `toast ${kind}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 3200);
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}

function copyText(text) {
  navigator.clipboard?.writeText(text).then(
    () => toast('copied', 'ok'),
    () => toast('copy failed', 'warn'),
  );
}

function qrInto(el, text) {
  if (!el || !text) return;
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    el.innerHTML = qr.createSvgTag({ cellSize: 2, margin: 4, scalable: true });
  } catch {
    el.textContent = 'QR error';
  }
}

/* ── theme & language ────────────────────────────────────────────────── */

const LANG_KEY = 'nl-lang';
const THEME_KEY = 'nl-theme';

function applyLang(lang) {
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  $('#btn-lang') && ($('#btn-lang').textContent = lang === 'fa' ? 'EN' : 'فا');
  $('#auth-lang') && ($('#auth-lang').textContent = lang === 'fa' ? 'EN' : 'فا');
  localStorage.setItem(LANG_KEY, lang);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $$('.t-pick').forEach((b) => b.classList.toggle('active', b.dataset.th === theme));
  localStorage.setItem(THEME_KEY, theme);
}

/* ── status bar & nav ────────────────────────────────────────────────── */

function coreBadge(status) {
  const map = {
    running: ['ok', t('در حال اجرا', 'RUNNING')],
    starting: ['ok', t('راه‌اندازی', 'STARTING')],
    stopped: ['bad', t('خاموش', 'STOPPED')],
    crashed: ['bad', t('کرش', 'CRASHED')],
    invalid: ['bad', t('کانفیگ نامعتبر', 'INVALID')],
    missing: ['bad', t('باینری نیست', 'NO BINARY')],
    error: ['bad', t('خطا', 'ERROR')],
  };
  const [cls, label] = map[status] || ['bad', esc(status)];
  return `<span class="badge ${cls}">${label}</span>`;
}

function renderStatusBar() {
  const st = S.state;
  if (!st) return;
  const x = st.cores.xray;
  const sb = st.cores.singbox;
  const mt = st.cores.mtproto;
  $('#ledger-items').innerHTML = [
    `<span><b>XRAY</b> ${x.status.toUpperCase()}</span>`,
    `<span><b>SING-BOX</b> ${sb.status.toUpperCase()}</span>`,
    `<span><b>MTPROTO</b> ${mt.status.toUpperCase()}</span>`,
    `<span><b>TCP</b> ${st.facts.tcpReady ? `${esc(st.facts.tcpHost)}:${st.facts.tcpPort}` : 'OFF'}</span>`,
    `<span><b>HTTPS</b> ${st.facts.publicHost ? esc(st.facts.publicHost) : 'OFF'}</span>`,
  ].join('');
  $('#top-region').textContent = `RAILWAY · ${(st.facts.region || 'auto').toUpperCase()}`;
  $('#edition').textContent = `EDITION V${st.app.version}`;
  $('#mode-pill').textContent = `FREE & OPEN · V${st.app.version}`;

  const ticks = [
    'XRAY + SING-BOX DUAL CORE',
    'REALITY · XHTTP · ANYTLS',
    'TELEGRAM MTProto PROXY',
    'SOCKS5 + HTTP WEB PROXY',
    'ONE TCP PORT MULTIPLEXER',
    'RAILWAY FREE PLAN',
    '100% FREE · NOT FOR SALE',
  ];
  $('#ticker-track').innerHTML = [...ticks, ...ticks].map((x) => `<span>${x}</span>`).join('');
}

const TABS = [
  { id: 'dashboard', icon: 'gauge', fa: 'داشبورد', en: 'DASHBOARD' },
  { id: 'easy', icon: 'bolt', fa: 'تنظیم آسان', en: 'EASY SETUP' },
  { id: 'railynx', icon: 'radar', fa: 'Railynx', en: 'RAILYNX' },
  { id: 'inbounds', icon: 'layers', fa: 'پروتکل‌ها', en: 'PROTOCOLS' },
  { id: 'users', icon: 'users', fa: 'کاربران', en: 'USERS' },
  { id: 'delivery', icon: 'send', fa: 'تحویل و ساب', en: 'DELIVERY' },
  { id: 'telegram', icon: 'telegram', fa: 'تلگرام', en: 'TELEGRAM' },
  { id: 'cores', icon: 'cpu', fa: 'هسته‌ها', en: 'CORES' },
  { id: 'settings', icon: 'sliders', fa: 'تنظیمات', en: 'SETTINGS' },
];

/* ── easy setup ──────────────────────────────────────────────────────── */

const EASY_CACHE = { data: null, at: 0 };

async function loadEasy(force = false) {
  if (!force && EASY_CACHE.data && Date.now() - EASY_CACHE.at < 15000) return EASY_CACHE.data;
  const data = await api('/api/easy-setup');
  EASY_CACHE.data = data;
  EASY_CACHE.at = Date.now();
  return data;
}

function easyBadge(kind) {
  const map = {
    good: { fa: 'پایدار', en: 'ROBUST', cls: 'ok' },
    risky: { fa: 'متغیر', en: 'UNSTABLE', cls: 'warn' },
    off: { fa: 'خاموش', en: 'OFF', cls: 'off' },
    edge: { fa: 'دامنهٔ ریلوی', en: 'RAILWAY EDGE', cls: 'warn' },
    tcp: { fa: 'پورت TCP', en: 'TCP PORT', cls: 'ok' },
  };
  const item = map[kind] || map.risky;
  return `<span class="pill ${item.cls}">${t(item.fa, item.en)}</span>`;
}

function renderEasy() {
  const pane = $('#pane-easy');
  const data = EASY_CACHE.data;
  if (!data) {
    pane.innerHTML = `<div class="card"><p class="kicker">${icon('bolt')}${t('تحلیل شبکه', 'NETWORK ANALYSIS')}</p>
      <p class="muted">${t('در حال تحلیل…', 'Analysing…')}</p></div>`;
    loadEasy(true).then(() => { if (S.tab === 'easy') renderEasy(); }).catch((err) => toast(err.message, 'warn'));
    return;
  }
  const a = data.analysis;
  const st = S.state;
  // `data.users` is optional: an apply response carries the analysis only.
  const users = Array.isArray(data.users) ? data.users : (st.users || []).map((u) => ({
    id: u.id, name: u.name, status: u.status, links: (u.links || []).length,
    subUrl: u.subUrl, portalUrl: u.portalUrl,
  }));
  const okCount = a.checks.filter((c) => c.ok).length;
  const verdict = okCount === a.checks.length
    ? t('همه‌چیز آماده است؛ فقط لینک را بردار.', 'All set — just take the link.')
    : t(`${a.checks.length - okCount} مورد نیاز به توجه دارد.`, `${a.checks.length - okCount} item(s) need attention.`);

  pane.innerHTML = `
  <div class="cols">
    <div class="card easy-hero">
      <p class="kicker">${icon('bolt')}${t('تنظیم آسان برای شبکهٔ ایران', 'EASY SETUP FOR IRANIAN NETWORKS')}</p>
      <p class="lede">${t(
        'این بخش شبکه را تحلیل می‌کند، روش‌هایی را که در ایران دوام می‌آورند انتخاب می‌کند و همه را در یک لینک اشتراک می‌گذارد.',
        'This pane analyses the network, picks the methods that survive in Iran, and puts them all in one subscription link.',
      )}</p>
      <div class="easy-stats">
        <div class="stat"><span class="tnum">${a.counts.enabled}</span><span>${t('روش فعال', 'ENABLED')}</span></div>
        <div class="stat"><span class="tnum">${a.counts.tcp}</span><span>${t('روی پورت TCP', 'OVER TCP')}</span></div>
        <div class="stat"><span class="tnum">${a.counts.edge}</span><span>${t('از دامنه', 'VIA DOMAIN')}</span></div>
        <div class="stat"><span class="tnum">${a.counts.telegram}</span><span>${t('سرویس تلگرام', 'TELEGRAM')}</span></div>
      </div>
      <p class="hint">${verdict}</p>
      <div class="profiles">
        ${a.profiles.map((p) => `
          <div class="profile ${(st.settings.easySetup || {}).profile === p.id ? 'current' : ''}">
            <div class="profile-head">
              <strong>${t(p.fa, p.en)}</strong>
              <span class="pill">${p.count} ${t('روش', 'WAYS')}</span>
            </div>
            <p class="muted">${t(p.taglineFa, p.taglineEn)}</p>
            <ul class="ticks">
              ${(p.notesFa || []).map((n, i) => `<li>${t(esc(n), esc((p.notesEn || [])[i] || ''))}</li>`).join('')}
            </ul>
            <button class="btn sm-btn primary" data-act="easy-apply" data-arg="${p.id}" type="button">
              ${icon('check', 'ic ic-sm')}${t('اعمال و ساخت لینک', 'APPLY & BUILD LINK')}
            </button>
          </div>`).join('')}
      </div>
    </div>

    <div class="card">
      <p class="kicker">${icon('gauge')}${t('تحلیل شبکه', 'NETWORK ANALYSIS')}</p>
      <div class="stack-sm">
        ${a.checks.map((c) => `<div class="check ${c.ok ? 'ok' : 'warn'}">
          <span class="dot"></span><span>${t(esc(c.fa), esc(c.en))}</span></div>`).join('')}
      </div>
      <div class="dashed"></div>
      <table class="tbl">
        <thead><tr>
          <th>${t('روش', 'METHOD')}</th><th>${t('مسیر', 'ROUTE')}</th><th>${t('وضعیت در ایران', 'IRAN')}</th>
        </tr></thead>
        <tbody>
          ${a.rows.filter((r) => r.enabled).map((r) => `<tr>
            <td>${esc(r.label)}</td>
            <td>${easyBadge(r.via)}</td>
            <td>${easyBadge(r.iran)}</td>
          </tr>`).join('') || `<tr><td colspan="3" class="muted">${t('هیچ روشی فعال نیست', 'Nothing enabled')}</td></tr>`}
        </tbody>
      </table>
      <p class="hint">${t('هر روشی که فعال باشد، خودکار در همان یک لینک اشتراک می‌آید.', 'Every enabled method lands in the same one subscription link.')}</p>
    </div>
  </div>

  <div class="cols">
    <div class="card">
      <p class="kicker">${icon('send')}${t('لینک اشتراک کاربران', 'USER SUBSCRIPTION LINKS')}</p>
      ${users.length ? users.map((u) => `
        <div class="row-line">
          <div>
            <strong>${esc(u.name)}</strong>
            <p class="muted tnum">${u.links} ${t('روش در یک لینک', 'methods in one link')}</p>
          </div>
          <div class="actions">
            <button class="btn sm-btn" data-act="copy" data-arg="${esc(u.subUrl)}" type="button">${icon('copy', 'ic ic-sm')}${t('کپی', 'COPY')}</button>
            <button class="btn sm-btn ghost" data-act="open" data-arg="${esc(u.portalUrl)}" type="button">${icon('globe', 'ic ic-sm')}${t('پورتال', 'PORTAL')}</button>
          </div>
        </div>
        <code class="uri">${esc(u.subUrl)}</code>`).join('')
        : `<p class="muted">${t('اول یک کاربر بساز.', 'Create a user first.')}</p>`}
      <div class="actions">
        <button class="btn sm-btn ghost" data-act="easy-refresh" type="button">${icon('refresh', 'ic ic-sm')}${t('تحلیل دوباره', 'RE-ANALYSE')}</button>
        <button class="btn sm-btn ghost" data-act="tab" data-arg="delivery" type="button">${icon('qr', 'ic ic-sm')}${t('همهٔ فرمت‌ها', 'ALL FORMATS')}</button>
      </div>
    </div>

    <div class="card">
      <p class="kicker">${icon('shield')}${t('نکات ضد فیلتر (ایران)', 'ANTI-FILTER NOTES (IRAN)')}</p>
      <ol class="tips">
        ${a.tips.map((tip) => `<li>${t(esc(tip.fa), esc(tip.en))}</li>`).join('')}
      </ol>
      <p class="hint">${t('این‌ها توصیهٔ عمومی‌اند، نه تضمین؛ شرایط اپراتورها متفاوت است.', 'General guidance, not a guarantee — ISPs differ.')}</p>
    </div>
  </div>`;
}

/* ── railynx · clean ip scanner ──────────────────────────────────────── */

const RAILYNX = { data: null, timer: null, link: '' };

async function railynxPoll() {
  try {
    RAILYNX.data = await api('/api/railynx');
    renderRailynx();
    if (!RAILYNX.data.running) stopRailynxPolling();
  } catch {
    stopRailynxPolling();
  }
}

function startRailynxPolling() {
  if (RAILYNX.timer) return;
  RAILYNX.timer = setInterval(railynxPoll, 1200);
}

function stopRailynxPolling() {
  if (RAILYNX.timer) clearInterval(RAILYNX.timer);
  RAILYNX.timer = null;
}

function railynxVlessChoices() {
  const out = [];
  for (const user of (S.state.users || [])) {
    for (const link of (user.links || [])) {
      if (link.protocol === 'vless' && (link.transport === 'ws')) {
        out.push({ label: `${user.name} · ${link.label.split('·').slice(-1)[0].trim()}`, uri: link.uri });
      }
    }
  }
  return out;
}

function renderRailynx() {
  const pane = $('#pane-railynx');
  if (!pane) return;
  const d = RAILYNX.data || { running: false, total: 0, checked: 0, alive: 0, failed: 0, results: [], recent: [], cidr: '', concurrency: 12 };
  const choices = railynxVlessChoices();
  const pct = d.total ? Math.round((d.checked / d.total) * 100) : 0;
  const elapsed = d.startedAt ? Math.max(0, ((d.finishedAt || Date.now()) - d.startedAt) / 1000) : 0;
  const defaults = d.defaults || { cidr: '69.46.46.0/24', concurrency: 12 };

  pane.innerHTML = `
  <div class="cols">
    <div class="card">
      <p class="kicker">${icon('radar')}${t('Railynx · اسکنر آی‌پی تمیز ریلوی', 'RAILYNX · RAILWAY CLEAN-IP SCANNER')}</p>
      <p class="lede">${t(
        'یک لینک VLESS می‌گیرد، رنج آی‌پی را می‌گردد و فقط آی‌پی‌هایی را نگه می‌دارد که سه بار پشت سر هم هندشیک کامل TLS + WebSocket + VLESS را با پاسخ ۲۰۴ رد کنند. فقط آدرس عوض می‌شود؛ بقیهٔ لینک دست‌نخورده می‌ماند.',
        'Takes a VLESS link, sweeps a CIDR block, and keeps only addresses that pass a full TLS + WebSocket + VLESS round trip three times in a row. Only the address changes; the rest of the link stays as it is.',
      )}</p>

      <label class="fld-label">${t('لینک VLESS (نوع WS)', 'VLESS LINK (WS)')}</label>
      ${choices.length ? `<select id="rl-pick" class="rl-select">
          <option value="">${t('— انتخاب از لینک‌های کاربران —', '— pick one of the user links —')}</option>
          ${choices.map((c) => `<option value="${esc(c.uri)}">${esc(c.label)}</option>`).join('')}
        </select>` : ''}
      <textarea id="rl-link" class="raw-box rl-link" spellcheck="false" dir="ltr" placeholder="vless://uuid@host:443?security=tls&type=ws&host=...&path=/...">${esc(RAILYNX.link)}</textarea>

      <div class="field-grid">
        <div>
          <label class="fld-label">${t('رنج اسکن (CIDR)', 'SCAN RANGE (CIDR)')}</label>
          <input type="text" id="rl-cidr" dir="ltr" value="${esc(d.cidr || defaults.cidr)}" placeholder="${esc(defaults.cidr)}">
        </div>
        <div>
          <label class="fld-label">${t('ورکر موازی', 'PARALLEL WORKERS')}</label>
          <input type="number" id="rl-workers" min="1" max="32" value="${esc(d.concurrency || defaults.concurrency)}">
        </div>
      </div>
      <p class="hint">${t('هر آی‌پی ۳ پروب با فاصلهٔ ۶۰ میلی‌ثانیه می‌گیرد؛ اگر یکی بیفتد حذف می‌شود. تایم‌اوت اتصال ۲۴۰۰ میلی‌ثانیه است.', 'Each address gets 3 probes 60 ms apart; one miss drops it. Connect timeout is 2400 ms.')}</p>

      <div class="actions">
        <button class="btn primary" data-act="rl-start" type="button" ${d.running ? 'disabled' : ''}>
          ${icon('radar', 'ic ic-sm')}${t('شروع اسکن', 'START SCAN')}</button>
        <button class="btn ghost" data-act="rl-cancel" type="button" ${d.running ? '' : 'disabled'}>
          ${icon('ban', 'ic ic-sm')}${t('لغو (نتایج تا اینجا می‌ماند)', 'CANCEL (keeps results)')}</button>
      </div>

      ${d.running ? `<div class="rl-progress">
        <div class="rl-bar"><span style="width:${pct}%"></span></div>
        <p class="muted tnum">${d.checked} / ${d.total} · ${pct}% · ${t('سالم', 'alive')}: ${d.alive} · ${t('زمان', 'elapsed')}: ${elapsed.toFixed(0)}s</p>
      </div>` : d.checked ? `<p class="muted tnum">${t('آخرین اسکن', 'LAST SCAN')}: ${d.checked} ${t('آی‌پی', 'IPs')} · ${d.alive} ${t('سالم', 'alive')} · ${d.failed} ${t('رد', 'dropped')} · ${d.cidr}</p>` : ''}
    </div>

    <div class="card">
      <p class="kicker">${icon('check')}${t('آی‌پی‌های تمیز', 'CLEAN ADDRESSES')}</p>
      ${d.results.length ? `
        <table class="tbl">
          <thead><tr>
            <th>${t('تأخیر', 'LATENCY')}</th><th>IP</th><th></th>
          </tr></thead>
          <tbody>
            ${d.results.map((r) => `<tr>
              <td class="mono tnum">${r.latency} ms</td>
              <td class="mono" dir="ltr">${esc(r.ip)}</td>
              <td><button class="mini" data-act="copy" data-arg="${esc(r.link)}" type="button" title="copy">${icon('copy', 'ic ic-sm')}</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="actions">
          <button class="btn sm-btn primary" data-act="copy" data-arg="${esc(d.results[0].link)}" type="button">
            ${icon('copy', 'ic ic-sm')}${t('کپی بهترین لینک', 'COPY BEST LINK')}</button>
          <button class="btn sm-btn ghost" data-act="copy" data-arg="${esc(d.results.map((r) => r.link).join('\n'))}" type="button">
            ${icon('file', 'ic ic-sm')}${t('کپی همه', 'COPY ALL')}</button>
        </div>`
        : `<p class="muted">${t('هنوز آی‌پی سالمی پیدا نشده. اگر همه رد شدند، دامنه/SNI لینک یا رنج را عوض کن.', 'No clean address yet. If everything is dropped, try another SNI/domain or range.')}</p>`}
      <div class="dashed"></div>
      <p class="kicker">${icon('trace-dash')}${t('آخرین پروب‌ها', 'LATEST PROBES')}</p>
      <div class="rl-recent">
        ${(d.recent || []).slice(0, 12).map((r) => `<span class="chip ${r.ok ? 'ok' : ''}" dir="ltr">${esc(r.ip)}${r.ok ? ` · ${r.latency}ms` : ` · ${esc(r.reason || 'fail')}`}</span>`).join('')
          || `<span class="muted">${t('—', '—')}</span>`}
      </div>
    </div>
  </div>

  <div class="card" style="margin-top:14px">
    <p class="kicker">${icon('info')}${t('چطور کار می‌کند', 'HOW IT WORKS')}</p>
    <ol class="tips">
      <li>${t('اتصال TCP به آی‌پی کاندید روی پورت لینک (پیش‌فرض ۴۴۳)، تایم‌اوت ۲۴۰۰ میلی‌ثانیه.', 'TCP connect to the candidate IP on the link port (443 by default), 2400 ms timeout.')}</li>
      <li>${t('هندشیک TLS با SNI برابر دامنهٔ لینک (نه خود آی‌پی)، ALPN روی http/1.1 و پذیرش همهٔ گواهی‌ها.', 'TLS handshake with SNI = the link domain (not the IP), ALPN http/1.1, certificates accepted.')}</li>
      <li>${t('آپگرید WebSocket روی مسیر لینک با Host برابر دامنه؛ پاسخ باید ۱۰۱ باشد.', 'WebSocket upgrade on the link path with the domain as Host; the answer must be 101.')}</li>
      <li>${t('هدر باینری VLESS (نسخه ۰، UUID، کامند ۱، پورت ۸۰، دامنه www.google.com) داخل فریم ماسک‌شده، سپس درخواست GET /generate_204.', 'A binary VLESS header (version 0, UUID, cmd 1, port 80, www.google.com) inside a masked frame, then GET /generate_204.')}</li>
      <li>${t('موفقیت فقط با دیدن «HTTP/1.1 204» یا «204 No Content»؛ تأخیر = میانگین سه پروب.', 'Success only on “HTTP/1.1 204” / “204 No Content”; latency = mean of three probes.')}</li>
    </ol>
    <p class="hint">${t('این اسکن سمت سرور اجرا می‌شود (سوکت خام TLS با SNI سفارشی) — مرورگر چنین دسترسی‌ای ندارد.', 'The scan runs server-side (raw TLS socket with a custom SNI) — a browser cannot do this.')}</p>
  </div>`;
}

function renderNav() {
  const st = S.state;
  const counts = {
    inbounds: st.inbounds.filter((i) => i.enabled).length,
    users: st.users.length,
    telegram: [st.telegram.mtproto.enabled, st.telegram.socks.enabled, st.telegram.http.enabled].filter(Boolean).length,
  };
  $('#nav').innerHTML = TABS.map((tab) => `
    <button class="tab-btn ${S.tab === tab.id ? 'active' : ''}" data-act="tab" data-arg="${tab.id}" type="button">
      <span class="tab-lbl">${icon(tab.icon, 'ic ic-sm')}${t(tab.fa, tab.en)}</span>
      ${counts[tab.id] !== undefined ? `<span class="tnum">${counts[tab.id]}</span>` : ''}
    </button>`).join('');
}

function switchTab(id) {
  S.tab = id;
  S.editing = null;
  $$('.tab-pane').forEach((pane) => { pane.hidden = pane.dataset.pane !== id; });
  renderNav();
  if (id === 'easy') { loadEasy().then(() => { if (S.tab === 'easy') renderEasy(); }).catch(() => {}); }
  if (id === 'railynx') { railynxPoll(); }
  if (id !== 'railynx') stopRailynxPolling();
  if (id === 'cores') startLogPolling(); else stopLogPolling();
  if (id === 'dashboard' || id === 'cores') refreshLogs();
}

/* ── dashboard ───────────────────────────────────────────────────────── */

function sparkline(samples) {
  if (!samples.length) return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none"><path d="M0 15 L100 15" stroke="var(--ink)" stroke-width=".6" stroke-dasharray="2 2"/></svg>`;
  const points = samples.slice(-40);
  let max = 1;
  for (const p of points) max = Math.max(max, p.up + p.down + (p.tg || 0));
  const step = points.length > 1 ? 100 / (points.length - 1) : 100;
  const path = points.map((p, i) => {
    const total = p.up + p.down + (p.tg || 0);
    const y = 29 - (total / max) * 26;
    return `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
  const area = `${path} L100 30 L0 30 Z`;
  return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none">
    <path d="${area}" fill="var(--ink)" opacity=".10"/>
    <path d="${path}" fill="none" stroke="var(--ink)" stroke-width=".9" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

function renderDashboard() {
  const st = S.state;
  const activeUsers = st.users.filter((u) => u.status === 'active').length;
  const totalUp = st.users.reduce((sum, u) => sum + u.usage.up, 0);
  const totalDown = st.users.reduce((sum, u) => sum + u.usage.down, 0);
  const mux = st.cores.mux;
  const tgTraffic = (mux.up || 0) + (mux.down || 0);
  const uptime = Date.now() - st.cores.bootedAt;

  const kpi = (label, value, sub, ic) => `
    <div class="kpi">
      <p class="lbl">${icon(ic, 'ic ic-sm')}${label}</p>
      <span class="val">${value}</span>
      <span class="sub">${sub}</span>
    </div>`;

  $('#pane-dashboard').innerHTML = `
    <div class="kpi-grid">
      ${kpi(t('کاربران فعال', 'ACTIVE USERS'), `${activeUsers}/${st.users.length}`, `${st.limits.maxUsers} max`, 'users')}
      ${kpi(t('اینباند فعال', 'LIVE INBOUNDS'), String(st.inbounds.filter((i) => i.enabled).length), `${st.inbounds.length} installed`, 'layers')}
      ${kpi(t('ترافیک هسته', 'CORE TRAFFIC'), fmtBytes(totalUp + totalDown), `↑${fmtBytes(totalUp)} ↓${fmtBytes(totalDown)}`, 'traffic')}
      ${kpi(t('ترافیک پروکسی تلگرام', 'TELEGRAM TRAFFIC'), fmtBytes(tgTraffic), `${mux.total} conns`, 'telegram')}
      ${kpi(t('آپ‌تایم پنل', 'PANEL UPTIME'), fmtUptime(uptime), st.facts.region || 'railway', 'clock')}
      ${kpi(t('صف پورت TCP', 'TCP MUX'), mux.listening ? 'ON' : 'OFF', `:${st.facts.muxPort}`, 'plug')}
    </div>

    <div class="cols">
      <div class="card">
        <p class="kicker">${icon('chart')}${t('نمودار ترافیک', 'TRAFFIC CHART')}</p>
        ${sparkline(st.traffic)}
        <div class="stat-strip" style="margin-top:8px;font-size:11px">
          <span class="mono">${t('نمونه‌ها', 'SAMPLES')}: ${st.traffic.length}</span>
          <span class="mono">${st.traffic.length ? new Date(st.traffic[st.traffic.length - 1].t).toISOString().slice(11, 19) + 'Z' : '—'}</span>
        </div>
        <div class="dashed"></div>
        <p class="hint">
          ${t('هر نمونه تجمعی از شمارندهٔ کاربران Xray است؛ پروتکل‌های sing-box تابع محدودیت آمار رسمی هسته هستند.', 'Samples come from Xray per-user counters; sing-box inbounds are limited by the core\'s official stats support.')}
        </p>
      </div>

      <div class="card card-subtle">
        <p class="kicker">${icon('globe')}${t('آدرس‌های اتصال', 'CONNECTION ENDPOINTS')}</p>
        ${endpointRow('HTTPS', st.facts.panelUrl || '—', st.facts.panelUrl)}
        ${endpointRow('TCP', st.facts.tcpReady ? `${st.facts.tcpHost}:${st.facts.tcpPort}` : '—', st.facts.tcpReady ? `${st.facts.tcpHost}:${st.facts.tcpPort}` : '')}
        ${endpointRow('MUX', `127.0.0.1:${st.facts.muxPort}`, '')}
        <p class="hint" style="margin-top:10px">
          ${t('همهٔ پروتکل‌های TCP و سه پروکسی تلگرام روی همان یک پورت TCP سرو می‌شوند؛ تقسیم‌بندی با SNI و نوع دست‌دادن انجام می‌شود.', 'Every TCP protocol and all three Telegram proxies share that single TCP port; routing happens by SNI and handshake shape.')}
        </p>
      </div>
    </div>

    <div class="cols">
      <div class="card">
        <p class="kicker">${icon('cpu')}${t('وضعیت هسته‌ها', 'CORE STATUS')}</p>
        ${coreRow('Xray-core', st.cores.xray)}
        ${coreRow('sing-box', st.cores.singbox)}
        ${coreRow('mtg (MTProto)', st.cores.mtproto)}
        <div class="actions">
          <button class="btn sm-btn" data-act="apply" type="button">${icon('refresh', 'ic ic-sm')}${t('اعمال کانفیگ', 'APPLY CONFIG')}</button>
          <button class="btn sm-btn ghost" data-act="tab" data-arg="cores" type="button">${icon('terminal', 'ic ic-sm')}${t('گزارش زنده', 'LIVE LOGS')}</button>
        </div>
      </div>

      <div class="card">
        <p class="kicker">${icon('pulse')}${t('رویدادهای اخیر', 'RECENT EVENTS')}</p>
        <div class="node-list" style="max-height:260px">
          ${st.events.length ? st.events.map((ev) => `
            <div class="node-row">
              <span class="node-title"><span class="badge">${esc(ev.kind)}</span>${esc(ev.message)}</span>
              <span class="mono" style="font-size:10px;opacity:.7">${relTime(ev.t)}</span>
            </div>`).join('') : `<p class="hint">${t('رویدادی ثبت نشده است.', 'No events yet.')}</p>`}
        </div>
      </div>
    </div>
    ${freeStrip()}`;
}

function freeStrip(extraFa = '', extraEn = '') {
  return `
    <div class="free-strip">
      ${icon('shield', 'ic ic-sm')}
      <span><strong>${t('رایگان و غیرقابل فروش', 'FREE &amp; NOT FOR SALE')}</strong> — ${t(
        'این پنل نرم‌افزار آزاد است؛ فروش سورس، پنل یا لینک ساخته‌شده با آن ممنوع است.',
        'open-source software; selling the source, the panel or links built with it is prohibited.',
      )}${extraFa ? ' ' + extraFa : ''}${extraEn ? ' ' + extraEn : ''}</span>
      <span class="mono">NIGHTLINE · RAILWAY</span>
    </div>`;
}

function endpointRow(key, value, copyValue) {
  return `
    <div class="endpoint">
      <span class="ep-key">${key}</span>
      <span class="ep-val">${esc(value)}</span>
      ${copyValue ? `<button class="mini" data-act="copy" data-arg="${esc(copyValue)}" type="button" title="copy">${icon('copy', 'ic ic-sm')}</button>` : ''}
    </div>`;
}

function coreRow(name, core) {
  return `
    <div class="node-row" style="margin-top:6px">
      <span class="node-title"><b>${name}</b> ${coreBadge(core.status)}</span>
      <span class="mono" style="font-size:10px;opacity:.75">${core.status === 'running' ? fmtUptime(core.uptimeMs) : (core.lastError ? esc(core.lastError).slice(0, 40) : '—')}</span>
    </div>`;
}

/* ── inbounds ────────────────────────────────────────────────────────── */

function inboundIcon(ib) {
  if (ib.protocol === 'shadowsocks') return 'shield';
  if (ib.protocol === 'anytls' || ib.protocol === 'shadowtls') return 'lock';
  if (ib.protocol === 'hysteria2' || ib.protocol === 'tuic') return 'bolt';
  if (ib.protocol === 'wireguard') return 'globe';
  return 'link';
}

function renderInbounds() {
  const st = S.state;
  const cards = st.inbounds.map((ib) => {
    const editing = S.editing === ib.id;
    const badgeCore = ib.core === 'xray' ? 'xray' : 'singbox';
    const reach = ib.reachable
      ? `<span class="chip ok">${t('قابل استفاده', 'USABLE')}</span>`
      : `<span class="chip warn">${t('غیرفعال روی ریلوی', 'BLOCKED')}</span>`;
    return `
      <div class="proto-card ${ib.enabled ? '' : 'is-off'}">
        <div class="proto-head">
          <div class="proto-name">${icon(inboundIcon(ib), 'ic')}${t(esc(ib.title.fa), esc(ib.title.en))}</div>
          <label class="tgl">
            <input type="checkbox" data-act="toggle-inbound" data-arg="${ib.id}" ${ib.enabled ? 'checked' : ''}>
            <span class="track"></span>
          </label>
        </div>
        <div class="chips">
          <span class="chip ${badgeCore}">${ib.core}</span>
          <span class="chip">${esc(ib.protocol)}</span>
          <span class="chip">${esc(ib.transport)}</span>
          <span class="chip">${ib.edge === 'http' ? 'HTTPS' : 'TCP'}</span>
          ${ib.security !== 'none' ? `<span class="chip">${esc(ib.security)}</span>` : ''}
          ${reach}
        </div>
        <div class="proto-meta">
          <span>${ib.edge === 'http' ? 'path' : 'listen'} : <b>${esc(ib.edge === 'http' ? '/\u200e' + ib.routeKey : '127.0.0.1:' + ib.port)}</b></span>
          ${ib.params.sni ? `<span>sni : <b>${esc(ib.params.sni)}</b></span>` : ''}
          ${ib.params.dest ? `<span>reality dest : <b>${esc(ib.params.dest)}</b></span>` : ''}
          ${ib.params.method ? `<span>cipher : <b>${esc(ib.params.method)}</b></span>` : ''}
        </div>
        ${ib.reason ? `<div class="note-inline">${t(esc(ib.reason.fa), esc(ib.reason.en))}</div>` : ''}
        ${editing ? renderInboundEditor(ib) : ''}
        <div class="proto-acts">
          <button class="btn sm-btn ghost" data-act="edit-inbound" data-arg="${ib.id}" type="button">${icon('edit', 'ic ic-sm')}${t('تنظیمات', 'EDIT')}</button>
          ${ib.edge === 'http' && ib.enabled ? `<button class="btn sm-btn ghost" data-act="copy" data-arg="${esc(`${st.facts.panelUrl}/${ib.routeKey}`)}" type="button">${icon('copy', 'ic ic-sm')}${t('مسیر', 'PATH')}</button>` : ''}
          <button class="btn sm-btn danger" data-act="del-inbound" data-arg="${ib.id}" type="button">${icon('trash', 'ic ic-sm')}</button>
        </div>
      </div>`;
  }).join('');

  const groups = [
    { core: 'xray', title: t('هستهٔ Xray', 'XRAY CORE') },
    { core: 'singbox', title: t('هستهٔ sing-box', 'SING-BOX CORE') },
  ];

  const directory = groups.map((group) => `
    <div class="preset-group">
      <h3>${icon(group.core === 'xray' ? 'xray' : 'singbox', 'ic ic-sm')}${group.title}</h3>
      <div class="preset-list">
        ${st.presets.filter((p) => p.core === group.core).map((p) => {
          const installed = st.inbounds.filter((i) => i.presetId === p.id).length;
          return `
            <div class="preset-row">
              <div class="pr-main">
                <div class="pr-title">
                  ${t(esc(p.title.fa), esc(p.title.en))}
                  <span class="chip">${esc(p.transport)}</span>
                  <span class="chip">${p.edge === 'http' ? 'HTTPS' : 'TCP'}</span>
                  ${p.udp ? `<span class="chip warn">UDP</span>` : ''}
                  ${p.featured ? `<span class="chip ok">${t('پیشنهادی', 'FEATURED')}</span>` : ''}
                </div>
                <div class="pr-desc">${t(esc(p.desc.fa), esc(p.desc.en))}</div>
                ${p.note ? `<div class="note-inline">${t(esc(p.note.fa), esc(p.note.en))}</div>` : ''}
              </div>
              <button class="btn sm-btn ${installed ? 'ghost' : ''}" data-act="add-inbound" data-arg="${p.id}" type="button">
                ${icon('plus', 'ic ic-sm')}${installed ? t('افزودن دوباره', 'ADD AGAIN') : t('افزودن', 'ADD')}
                ${installed ? `<span class="chip">${installed}</span>` : ''}
              </button>
            </div>`;
        }).join('')}
      </div>
    </div>`).join('');

  $('#pane-inbounds').innerHTML = `
    <div class="spread">
      <p class="kicker" style="margin:0">${icon('layers')}${t('اینباندهای نصب‌شده', 'INSTALLED INBOUNDS')}</p>
      <span class="mono" style="font-size:10.5px;opacity:.7">${st.inbounds.length} INBOUNDS · ${st.inbounds.filter((i) => i.enabled).length} ON</span>
    </div>
    <div class="proto-grid">${cards || ''}</div>

    <div class="cols" style="margin-top:18px">
      <div class="card card-subtle">
        <p class="kicker">${icon('plus')}${t('افزودن پروتکل از فهرست', 'ADD A PROTOCOL')}</p>
        <p class="hint" style="margin-top:0">
          ${t('هر ردیف یک «دستور پخت» کامل است: هسته، ترانسپورت، لایهٔ امنیت و نوع دسترسی مشخص شده‌اند. پروتکل‌های UDP روی ریلوی قابل انتشار نیستند و فقط برای نودهای دیگر تولید می‌شوند.', 'Each row is a full recipe: core, transport, security layer and how clients reach it. UDP protocols cannot be published by Railway and are generated for other nodes only.')}
        </p>
        ${directory}
      </div>
      <div class="card">
        <p class="kicker">${icon('plug')}${t('نقشهٔ پورت‌ها', 'PORT MAP')}</p>
        <table class="tbl">
          <thead><tr><th>${t('لایه', 'LAYER')}</th><th>${t('مسیر', 'ENTRY')}</th><th>${t('مقصد', 'TARGET')}</th></tr></thead>
          <tbody>
            <tr><td>HTTPS</td><td class="mono">:443</td><td class="mono">${esc(st.facts.publicHost || '—')}</td></tr>
            ${st.inbounds.filter((i) => i.edge === 'http' && i.enabled).map((ib) => `
              <tr><td>WS/XHTTP</td><td class="mono">/${esc(ib.routeKey)}</td><td class="mono">127.0.0.1:${ib.port}</td></tr>`).join('')}
            <tr><td>TCP proxy</td><td class="mono">:${st.facts.tcpPort || '—'}</td><td class="mono">SNI mux :${st.facts.muxPort}</td></tr>
            ${Object.entries(st.plan.sniMap || {}).map(([sni, target]) => `
              <tr><td>TLS SNI</td><td class="mono">${esc(sni)}</td><td class="mono">127.0.0.1:${target.port}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ${freeStrip()}`;
}

function renderInboundEditor(ib) {
  const fields = ib.fields || [];
  if (!fields.length) {
    return `<p class="hint">${t('این پروتکل پارامتر قابل تنظیمی ندارد.', 'This protocol has no tunable parameters.')}</p>`;
  }
  return `
    <div class="stack-sm" style="border-top:1px dashed var(--ink);padding-top:9px;margin-top:2px">
      ${fields.map((field) => {
        const value = ib.params[field.key] ?? '';
        const label = `<label class="fld-label">${t(esc(field.label.fa), esc(field.label.en))}</label>`;
        if (field.type === 'select') {
          return `<div>${label}<select data-param="${field.key}" data-id="${ib.id}">
            ${field.options.map((opt) => `<option value="${esc(opt)}" ${String(value) === String(opt) ? 'selected' : ''}>${esc(opt || '—')}</option>`).join('')}
          </select></div>`;
        }
        const type = field.type === 'number' ? 'number' : 'text';
        return `<div>${label}<input type="${type}" class="${field.mono ? '' : 'fa-inp'}" data-param="${field.key}" data-id="${ib.id}" value="${esc(value)}"></div>`;
      }).join('')}
      <div class="row">
        <button class="btn sm-btn primary" data-act="save-inbound" data-arg="${ib.id}" type="button">${icon('save', 'ic ic-sm')}${t('ذخیره', 'SAVE')}</button>
        <button class="btn sm-btn ghost" data-act="edit-inbound" data-arg="${ib.id}" type="button">${t('بستن', 'CLOSE')}</button>
      </div>
    </div>`;
}

/* ── users ───────────────────────────────────────────────────────────── */

function userStatusBadge(user) {
  const map = {
    active: ['ok', t('فعال', 'ACTIVE')],
    disabled: ['bad', t('غیرفعال', 'DISABLED')],
    expired: ['bad', t('منقضی', 'EXPIRED')],
    quota: ['bad', t('اتمام حجم', 'QUOTA')],
  };
  const [cls, label] = map[user.status] || ['bad', esc(user.status)];
  return `<span class="badge ${cls}">${label}</span>`;
}

function renderUsers() {
  const st = S.state;
  const cards = st.users.map((user) => {
    const quota = user.quotaBytes || 0;
    const percent = quota ? Math.min(100, Math.round((user.usage.total / quota) * 100)) : 0;
    return `
      <div class="user-card">
        <div class="user-head">
          <span class="user-name">${icon('users', 'ic')}${esc(user.name)} ${userStatusBadge(user)}</span>
          <span class="mono" style="font-size:10.5px;opacity:.7">${esc(user.id)} · ${user.links.length} ${t('لینک', 'LINKS')}</span>
        </div>
        <div class="user-meta">
          <div><span>${t('مصرف', 'USAGE')}</span><b>${fmtBytes(user.usage.total)}</b></div>
          <div><span>${t('سهمیه', 'QUOTA')}</span><b>${quota ? fmtBytes(quota) : '∞'}</b></div>
          <div><span>${t('انقضا', 'EXPIRES')}</span><b>${fmtDate(user.expiresAt)}</b></div>
          <div><span>${t('آخرین فعالیت', 'LAST SEEN')}</span><b>${user.lastSeen ? relTime(user.lastSeen) : '—'}</b></div>
        </div>
        ${quota ? `<div class="meter ${percent > 85 ? 'warn' : ''}"><i style="width:${percent}%"></i></div>` : ''}
        <div class="actions" style="margin-top:2px">
          <button class="btn sm-btn" data-act="show-links" data-arg="${user.id}" type="button">${icon('link', 'ic ic-sm')}${t('لینک‌ها و QR', 'LINKS & QR')}</button>
          <button class="btn sm-btn ghost" data-act="toggle-user" data-arg="${user.id}" data-value="${user.enabled ? '0' : '1'}" type="button">
            ${icon(user.enabled ? 'ban' : 'check', 'ic ic-sm')}${user.enabled ? t('غیرفعال', 'DISABLE') : t('فعال', 'ENABLE')}
          </button>
          <button class="btn sm-btn ghost" data-act="reset-user" data-arg="${user.id}" type="button">${icon('refresh', 'ic ic-sm')}${t('صفر کردن مصرف', 'RESET USAGE')}</button>
          <button class="btn sm-btn ghost" data-act="rotate-user" data-arg="${user.id}" type="button">${icon('key', 'ic ic-sm')}${t('تعویض کلید', 'ROTATE')}</button>
          <button class="btn sm-btn danger" data-act="del-user" data-arg="${user.id}" type="button">${icon('trash', 'ic ic-sm')}</button>
        </div>
      </div>`;
  }).join('');

  $('#pane-users').innerHTML = `
    <div class="cols">
      <div class="card">
        <p class="kicker">${icon('plus')}${t('کاربر جدید', 'NEW SUBSCRIBER')}</p>
        <div class="field-grid">
          <div><label class="fld-label">${t('نام', 'NAME')}</label><input type="text" class="fa-inp" id="nu-name" placeholder="ali"></div>
          <div><label class="fld-label">${t('حجم (GB)', 'QUOTA (GB)')}</label><input type="number" id="nu-quota" min="0" step="1" placeholder="0 = ∞"></div>
          <div><label class="fld-label">${t('روز اعتبار', 'DAYS')}</label><input type="number" id="nu-days" min="0" step="1" placeholder="0 = ∞"></div>
          <div><label class="fld-label">${t('محدودیت IP', 'IP LIMIT')}</label><input type="number" id="nu-ip" min="0" step="1" placeholder="0 = ∞"></div>
          <div class="field-full"><label class="fld-label">${t('یادداشت', 'NOTE')}</label><input type="text" class="fa-inp" id="nu-note"></div>
        </div>
        <div class="actions">
          <button class="btn primary" data-act="create-user" type="button">${icon('plus', 'ic ic-sm')}${t('ساخت کاربر', 'CREATE USER')}</button>
        </div>
        <p class="hint">${t('هر کاربر به‌صورت خودکار در همهٔ اینباندهای فعال با کلید اختصاصی (UUID، رمز، کلید SS-2022) ثبت می‌شود.', 'Every user is automatically provisioned on all enabled inbounds with a unique UUID, password and SS-2022 key.')}</p>
      </div>
      <div class="card card-subtle">
        <p class="kicker">${icon('info')}${t('قواعد شمارش', 'ACCOUNTING RULES')}</p>
        <ul class="check-list" style="grid-template-columns:1fr">
          <li class="chk">${icon('traffic', 'ic ic-sm')}${t('حجم هر کاربر از شمارندهٔ Xray خوانده می‌شود (هر ۲۰ ثانیه).', 'Per-user volume is read from Xray counters every 20 s.')}</li>
          <li class="chk">${icon('clock', 'ic ic-sm')}${t('با رسیدن به سهمیه یا تاریخ انقضا، کاربر خودکار از همهٔ کانفیگ‌ها حذف می‌شود.', 'On quota/expiry the user is removed from every live config automatically.')}</li>
          <li class="chk">${icon('key', 'ic ic-sm')}${t('تعویض کلید، لینک‌های قبلی را برای همیشه باطل می‌کند.', 'Rotating keys invalidates every previous link instantly.')}</li>
        </ul>
      </div>
    </div>
    <div class="user-list">${cards || `<p class="hint">${t('هنوز کاربری ساخته نشده است.', 'No subscribers yet.')}</p>`}</div>
    ${freeStrip()}`;
}

function showUserLinks(userId) {
  const st = S.state;
  const user = st.users.find((u) => u.id === userId);
  if (!user) return;
  const body = `
    ${user.subUrl ? `
      <div class="endpoint">
        <span class="ep-key">SUB</span>
        <span class="ep-val">${esc(user.subUrl)}</span>
        <button class="mini" data-act="copy" data-arg="${esc(user.subUrl)}" type="button">${icon('copy', 'ic ic-sm')}</button>
      </div>` : ''}
    <div class="grid-2" style="margin-top:10px">
      <div class="qr-center">
        <div class="qrbox qr"><div id="modal-qr"></div></div>
        <p class="mono" style="font-size:10px;margin-top:6px">${esc(user.name)} · ${user.links.length} LINKS</p>
      </div>
      <div class="stack-sm">
        <p class="hint" style="margin:0">${t('فرمت‌های آمادهٔ اشتراک:', 'Ready formats:')}</p>
        ${['links', 'base64', 'xray', 'singbox', 'clash'].map((fmt) => `
          <a class="btn sm-btn ghost" href="${esc(user.subUrl)}/${fmt}" target="_blank" rel="noopener" download>
            ${icon('download', 'ic ic-sm')}<span class="mono">${fmt.toUpperCase()}</span>
          </a>`).join('')}
        ${user.portalUrl ? `<a class="btn sm-btn ghost" href="${esc(user.portalUrl)}" target="_blank" rel="noopener">${icon('external', 'ic ic-sm')}${t('صفحهٔ کاربر', 'USER PAGE')}</a>` : ''}
      </div>
    </div>
    <div class="dashed"></div>
    <p class="kicker" style="margin-bottom:6px">${icon('link')}${t('لینک مستقیم هر پروتکل', 'PER-PROTOCOL LINKS')}</p>
    <div class="user-links" style="max-height:260px;overflow:auto">
      ${user.links.map((link) => `
        <div class="link-row">
          <span class="lk-name">${esc(link.protocol.toUpperCase())} · ${esc(link.transport)}</span>
          <span class="lk-uri">${esc(link.uri)}</span>
          <button class="mini" data-act="copy" data-arg="${esc(link.uri)}" type="button" title="copy">${icon('copy', 'ic ic-sm')}</button>
          <button class="mini" data-act="qr" data-arg="${esc(link.uri)}" type="button" title="qr">${icon('qr', 'ic ic-sm')}</button>
        </div>`).join('')}
    </div>`;
  openModal(`${esc(user.name)} — ${user.links.length} ${t('لینک', 'LINKS')}`, body, true);
  qrInto($('#modal-qr'), user.subUrl || (user.links[0] && user.links[0].uri) || '');
}

/* ── delivery ────────────────────────────────────────────────────────── */

const CLIENTS = [
  { name: 'v2rayNG', file: 'v2rayng.png', url: 'https://github.com/2dust/v2rayNG/releases', os: 'Android' },
  { name: 'Hiddify', file: 'hiddify.svg', url: 'https://github.com/hiddify/hiddify-app/releases', os: 'Android · iOS · Desktop' },
  { name: 'sing-box', file: 'sing-box.svg', url: 'https://github.com/SagerNet/sing-box/releases', os: 'iOS · Desktop' },
  { name: 'Clash Verge', file: 'clash-verge.svg', url: 'https://github.com/clash-verge-rev/clash-verge-rev/releases', os: 'Desktop' },
  { name: 'Karing', file: 'karing.png', url: 'https://github.com/KaringX/karing/releases', os: 'Multi' },
  { name: 'v2rayN', file: 'v2rayn.png', url: 'https://github.com/2dust/v2rayN/releases', os: 'Windows' },
];

function renderDelivery() {
  const st = S.state;
  const rows = st.users.map((user) => `
    <tr>
      <td><b>${esc(user.name)}</b><br><span class="mono muted" style="font-size:10px">${esc(user.id)}</span></td>
      <td class="mono" style="font-size:10px;max-width:230px;overflow-wrap:anywhere">${esc(user.subUrl || '—')}</td>
      <td class="mono">${user.links.length}</td>
      <td>
        <div class="row">
          <button class="mini" data-act="copy" data-arg="${esc(user.subUrl)}" type="button">${icon('copy', 'ic ic-sm')}</button>
          <button class="mini" data-act="qr" data-arg="${esc(user.subUrl)}" type="button">${icon('qr', 'ic ic-sm')}</button>
          <button class="mini" data-act="show-links" data-arg="${user.id}" type="button">${icon('link', 'ic ic-sm')}</button>
        </div>
      </td>
      <td>
        <div class="pill-group">
          ${['links', 'xray', 'singbox', 'clash'].map((fmt) => `<a class="pill" href="${esc(user.subUrl)}/${fmt}" target="_blank" rel="noopener">${fmt}</a>`).join('')}
        </div>
      </td>
    </tr>`).join('');

  $('#pane-delivery').innerHTML = `
    <div class="cols">
      <div class="card">
        <p class="kicker">${icon('send')}${t('نحوهٔ تحویل اشتراک', 'HOW DELIVERY WORKS')}</p>
        <p class="labor">${t('هر کاربر یک آدرس اشتراک اختصاصی دارد که با امضای HMAC ساخته می‌شود؛ بدون ورود، بدون کوکی. همان آدرس پنج فرمت می‌دهد و کلاینت با هر بار تازه‌سازی، کانفیگ به‌روز را می‌گیرد.', 'Every subscriber owns an HMAC-signed subscription URL — no login, no cookie. One URL serves five formats, so clients always refresh into the current config.')}</p>
        <table class="tbl">
          <thead><tr><th>${t('فرمت', 'FORMAT')}</th><th>${t('کاربرد', 'USE')}</th><th>PATH</th></tr></thead>
          <tbody>
            <tr><td class="mono">links</td><td>${t('فهرست خام لینک‌ها', 'Raw link list')}</td><td class="mono">/sub/:token/links</td></tr>
            <tr><td class="mono">base64</td><td>${t('سازگار با v2rayNG/NekoBox', 'v2rayNG / NekoBox compatible')}</td><td class="mono">/sub/:token</td></tr>
            <tr><td class="mono">xray</td><td>${t('کانفیگ کامل Xray', 'Full Xray client config')}</td><td class="mono">/sub/:token/xray</td></tr>
            <tr><td class="mono">singbox</td><td>${t('کانفیگ کامل sing-box', 'Full sing-box client config')}</td><td class="mono">/sub/:token/singbox</td></tr>
            <tr><td class="mono">clash</td><td>${t('YAML برای Mihomo/Clash', 'YAML for Mihomo/Clash')}</td><td class="mono">/sub/:token/clash</td></tr>
          </tbody>
        </table>
        <p class="hint">${t('هدر Subscription-Userinfo ارسال می‌شود تا کلاینت حجم و انقضا را نشان دهد.', 'Subscription-Userinfo is sent so clients can show quota and expiry.')}</p>
      </div>
      <div class="card card-subtle">
        <p class="kicker">${icon('download')}${t('کلاینت‌های سازگار', 'COMPATIBLE CLIENTS')}</p>
        <div class="client-os-grid">
          ${CLIENTS.map((c) => `
            <a class="client-link" href="${c.url}" target="_blank" rel="noopener">
              <img class="client-logo" src="/assets/${c.file}" alt="${c.name}">
              <span>${c.name}<br><small class="muted" style="font-size:9.5px">${c.os}</small></span>
              ${icon('external', 'ic ic-sm')}
            </a>`).join('')}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <p class="kicker">${icon('users')}${t('آدرس اشتراک کاربران', 'SUBSCRIBER URLS')}</p>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr>
            <th>${t('کاربر', 'USER')}</th><th>${t('آدرس اشتراک', 'SUBSCRIPTION')}</th>
            <th>${t('لینک‌ها', 'LINKS')}</th><th>QR</th><th>${t('فرمت‌ها', 'FORMATS')}</th>
          </tr></thead>
          <tbody>${rows || `<tr><td colspan="5" class="muted">${t('کاربری وجود ندارد', 'no subscribers')}</td></tr>`}</tbody>
        </table>
      </div>
    </div>
    ${freeStrip()}`;
}

/* ── telegram ────────────────────────────────────────────────────────── */

function renderTelegram() {
  const st = S.state;
  const tg = st.telegram;
  const mux = st.cores.mux;
  const ready = st.facts.tcpReady;

  const qrBlock = (text) => text
    ? `<div class="qr-center qr-inline"><div class="qrbox qr"><div data-qr="${esc(text)}"></div></div></div>`
    : `<p class="note-inline">${t('ابتدا پروکسی TCP ریلوی را فعال کنید.', 'Enable the Railway TCP proxy first.')}</p>`;

  $('#pane-telegram').innerHTML = `
    <div class="card">
      <p class="kicker">${icon('plug')}${t('مالتی‌پلکسر تک‌پورت', 'SINGLE-PORT MULTIPLEXER')}</p>
      <p class="labor">${t('ریلوی فقط یک پورت TCP عمومی می‌دهد. پنل روی همان پورت، TLS را با SNI، SOCKS5 را با کد اول، HTTP CONNECT را با متد و MTProto را با دست‌دادن مبهم تشخیص می‌دهد؛ بنابراین همهٔ روش‌ها هم‌زمان روی یک host:port کار می‌کنند.', 'Railway gives exactly one public TCP port. On that port the panel separates TLS by SNI, SOCKS5 by its greeting byte, HTTP CONNECT by method, and MTProto by obfuscated handshake — so every method works on the same host:port.')}</p>
      <div class="kpi-grid">
        ${[
          ['TLS → REALITY', mux.tls, 'shield'],
          ['SOCKS5', mux.socks, 'plug'],
          ['HTTP PROXY', (st.cores.http && st.cores.http.conns) || 0, 'http'],
          ['MTPROTO', mux.mtproto, 'telegram'],
        ].map(([label, value, ic]) => `
          <div class="kpi"><p class="lbl">${icon(ic, 'ic ic-sm')}${label}</p><span class="val">${value || 0}</span>
          <span class="sub">conns</span></div>`).join('')}
      </div>
      <div class="endpoint" style="margin-top:10px">
        <span class="ep-key">${t('پورت', 'PORT')}</span>
        <span class="ep-val">${ready ? esc(`${st.facts.tcpHost}:${st.facts.tcpPort}`) : '—'}</span>
        ${ready ? `<button class="mini" data-act="copy" data-arg="${esc(`${st.facts.tcpHost}:${st.facts.tcpPort}`)}" type="button">${icon('copy', 'ic ic-sm')}</button>` : ''}
      </div>
      ${!ready ? `<div class="note-inline">${t('در ریلوی: Settings → Networking → TCP Proxy را روی پورت ۸۴۴۳ تنظیم کنید.', 'On Railway: Settings → Networking → TCP Proxy targeting port 8443.')}</div>` : ''}
    </div>

    <div class="cols" style="margin-top:14px">
      <div class="card">
        <p class="kicker">${icon('telegram')}${t('پروکسی MTProto (mtg)', 'MTPROTO PROXY (MTG)')}</p>
        <div class="spread">
          <label class="tgl">
            <input type="checkbox" data-act="toggle-mtproto" ${tg.mtproto.enabled ? 'checked' : ''}>
            <span class="track"></span>
            <span>${t('فعال', 'ENABLED')}</span>
          </label>
          ${coreBadge(tg.mtproto.state.status)}
        </div>
        <div class="field-grid" style="margin-top:10px">
          <div>
            <label class="fld-label">${t('دامنهٔ FakeTLS', 'FAKETLS DOMAIN')}</label>
            <input type="text" id="tg-faketls" value="${esc(tg.mtproto.faketlsHost)}" placeholder="www.microsoft.com">
          </div>
          <div>
            <label class="fld-label">${t('کد کشور تبلیغ (اختیاری)', 'AD TAG (OPTIONAL)')}</label>
            <input type="text" id="tg-adtag" value="${esc(tg.mtproto.adTag || '')}" placeholder="—">
          </div>
        </div>
        <div class="actions">
          <button class="btn sm-btn primary" data-act="save-mtproto" type="button">${icon('save', 'ic ic-sm')}${t('ذخیره و اجرا', 'SAVE & RUN')}</button>
          <button class="btn sm-btn ghost" data-act="regen-secret" type="button">${icon('refresh', 'ic ic-sm')}${t('ساخت سکرت تازه', 'NEW SECRET')}</button>
          <button class="btn sm-btn ghost" data-act="restart-core" data-arg="mtproto" type="button">${icon('power', 'ic ic-sm')}${t('ری‌استارت', 'RESTART')}</button>
        </div>
        ${tg.mtproto.conflict ? `<div class="note-inline">${t('دامنهٔ FakeTLS با SNI یک اینباند REALITY/TLS یکسان است؛ مالتی‌پلکسر آن SNI را به هسته می‌دهد و MTProto کار نمی‌کند. یکی از دو دامنه را تغییر دهید.', 'This FakeTLS domain collides with the SNI of a REALITY/TLS inbound: the multiplexer routes that SNI to the core, so MTProto will not answer. Change one of the two domains.')}</div>` : ''}
        <div class="dashed"></div>
        <label class="fld-label">SECRET</label>
        <div class="code-line">${esc(tg.mtproto.secret || '—')}</div>
        ${tg.mtproto.links && tg.mtproto.links.app ? `
          <div class="link-stack">
            <div class="endpoint"><span class="ep-key">TG</span><span class="ep-val">${esc(tg.mtproto.links.app)}</span>
              <button class="mini" data-act="copy" data-arg="${esc(tg.mtproto.links.app)}" type="button">${icon('copy', 'ic ic-sm')}</button></div>
            <div class="endpoint"><span class="ep-key">WEB</span><span class="ep-val">${esc(tg.mtproto.links.web)}</span>
              <button class="mini" data-act="copy" data-arg="${esc(tg.mtproto.links.web)}" type="button">${icon('copy', 'ic ic-sm')}</button></div>
          </div>
          <div class="proxy-qr-row">
            ${qrBlock(tg.mtproto.links.web)}
            <p class="hint">${t('لینک tg:// را در تلگرام باز کنید؛ برای اشتراک‌گذاری نسخهٔ t.me را بفرستید.', 'Open the tg:// link inside Telegram; share the t.me form with others.')}</p>
          </div>` : ''}
      </div>

      <div class="card">
        <p class="kicker">${icon('plug')}${t('پروکسی SOCKS5', 'SOCKS5 PROXY')}</p>
        <div class="spread">
          <label class="tgl">
            <input type="checkbox" data-act="toggle-socks" ${tg.socks.enabled ? 'checked' : ''}>
            <span class="track"></span><span>${t('فعال', 'ENABLED')}</span>
          </label>
          <span class="mono" style="font-size:10.5px">${st.cores.socks5.conns} conns · ↑${fmtBytes(st.cores.socks5.up)} ↓${fmtBytes(st.cores.socks5.down)}</span>
        </div>
        <div class="field-grid" style="margin-top:10px">
          <div><label class="fld-label">${t('نام کاربری', 'USERNAME')}</label><input type="text" id="tg-socks-user" value="${esc(tg.socks.user)}"></div>
          <div><label class="fld-label">${t('گذرواژه', 'PASSWORD')}</label><input type="text" id="tg-socks-pass" value="${esc(tg.socks.pass)}"></div>
        </div>
        <div class="actions">
          <button class="btn sm-btn primary" data-act="save-socks" type="button">${icon('save', 'ic ic-sm')}${t('ذخیره', 'SAVE')}</button>
        </div>
        ${tg.socks.link ? `
          <div class="dashed"></div>
          <div class="link-stack">
            <div class="endpoint"><span class="ep-key">TG</span><span class="ep-val">${esc(tg.socks.link)}</span>
              <button class="mini" data-act="copy" data-arg="${esc(tg.socks.link)}" type="button">${icon('copy', 'ic ic-sm')}</button></div>
          </div>
          <div class="proxy-qr-row">
            ${qrBlock(tg.socks.link)}
            <p class="hint">${t('در تلگرام: Settings → Data and Storage → Proxy → Add Proxy → SOCKS5. لینک t.me/socks را مستقیم روی موبایل باز کنید.', 'Telegram: Settings → Data and Storage → Proxy → Add Proxy → SOCKS5. Open the t.me/socks link directly on mobile.')}</p>
          </div>` : ''}
      </div>
    </div>

    <div class="cols" style="margin-top:14px">
      <div class="card">
        <p class="kicker">${icon('http')}${t('پروکسی وب / HTTP', 'WEB / HTTP PROXY')}</p>
        <div class="spread">
          <label class="tgl">
            <input type="checkbox" data-act="toggle-http" ${tg.http.enabled ? 'checked' : ''}>
            <span class="track"></span><span>${t('فعال', 'ENABLED')}</span>
          </label>
          <span class="mono" style="font-size:10.5px">${st.cores.http.conns} conns · ↑${fmtBytes(st.cores.http.up)} ↓${fmtBytes(st.cores.http.down)}</span>
        </div>
        <div class="field-grid" style="margin-top:10px">
          <div><label class="fld-label">${t('نام کاربری', 'USERNAME')}</label><input type="text" id="tg-http-user" value="${esc(tg.http.user)}"></div>
          <div><label class="fld-label">${t('گذرواژه', 'PASSWORD')}</label><input type="text" id="tg-http-pass" value="${esc(tg.http.pass)}"></div>
        </div>
        <div class="actions">
          <button class="btn sm-btn primary" data-act="save-http" type="button">${icon('save', 'ic ic-sm')}${t('ذخیره', 'SAVE')}</button>
        </div>
        ${tg.http.link ? `
          <div class="dashed"></div>
          <div class="endpoint"><span class="ep-key">HTTP</span><span class="ep-val">${esc(tg.http.link)}</span>
            <button class="mini" data-act="copy" data-arg="${esc(tg.http.link)}" type="button">${icon('copy', 'ic ic-sm')}</button></div>
          <p class="hint">${t('در تلگرام دسکتاپ همین آدرس را به‌عنوان «HTTP Proxy» وارد کنید؛ مرورگر هم با همان آدرس عبور می‌کند. برای تلگرام وب کافی است پروکسی سیستم یا افزونهٔ مرورگر روی همین آدرس باشد.', 'Use this as Telegram Desktop\'s “HTTP Proxy”; browsers can use it too. Telegram Web works through the same address via the system or a browser proxy extension.')}</p>` : ''}
      </div>

      <div class="card card-subtle">
        <p class="kicker">${icon('shield')}${t('نکته‌های امنیتی', 'SECURITY NOTES')}</p>
        <ul class="check-list" style="grid-template-columns:1fr">
          <li class="chk">${icon('info', 'ic ic-sm')}${t('رمزنگاری MTProto بین کلاینت و سرور تلگرام سرتاسری است؛ پروکسی فقط ترافیک را عبور می‌دهد.', 'MTProto encryption stays end-to-end between client and Telegram; the proxy only forwards.')}</li>
          <li class="chk">${icon('key', 'ic ic-sm')}${t('سکرت MTProto فقط یک بار نمایش داده می‌شود؛ در صورت لو رفتن، سکرت تازه بسازید.', 'Regenerate the MTProto secret if it ever leaks — old links stop working instantly.')}</li>
          <li class="chk">${icon('trace-dash', 'ic ic-sm')}${t('SOCKS5 و HTTP هر دو نام کاربری/گذرواژه دارند و روی همان پورت مالتی‌پلکس سرو می‌شوند.', 'SOCKS5 and HTTP both require credentials and share the multiplexed port.')}</li>
          <li class="chk">${icon('alert', 'ic ic-sm')}${t('ریلوی آزاد نیست: پهنای‌باند و ساعت مصرف رایگان محدود است؛ پروکسی تلگرام را برای حلقهٔ کوچک استفاده کنید.', 'Railway is not unlimited: free-plan hours and egress are capped — keep the Telegram proxy for a small circle.')}</li>
        </ul>
        ${freeStrip(t('لینک‌های پروکسی تلگرام هم رایگان‌اند؛ فروش آن‌ها تخلف است.', 'Telegram proxy links built here are free too — selling them is a violation.'), '')}
      </div>
    </div>`;
  $$('[data-qr]').forEach((el) => qrInto(el, el.dataset.qr));
}

/* ── cores ───────────────────────────────────────────────────────────── */

function coreCard(title, core, extra = '') {
  return `
    <div class="card">
      <p class="kicker">${icon('cpu')}${title}</p>
      <div class="spread">
        ${coreBadge(core.status)}
        <span class="mono" style="font-size:10.5px">${esc(core.version || 'not found')}</span>
      </div>
      <table class="tbl" style="margin-top:8px">
        <tbody>
          <tr><th>PID</th><td class="mono">${core.pid || '—'}</td></tr>
          <tr><th>${t('آپ‌تایم', 'UPTIME')}</th><td class="mono">${core.uptimeMs ? fmtUptime(core.uptimeMs) : '—'}</td></tr>
          <tr><th>${t('ری‌استارت‌ها', 'RESTARTS')}</th><td class="mono">${core.restarts || 0}</td></tr>
          <tr><th>${t('مسیر باینری', 'BINARY')}</th><td class="mono" style="overflow-wrap:anywhere">${esc(core.bin || '—')}</td></tr>
          ${extra}
        </tbody>
      </table>
      ${core.lastError ? `<div class="note-inline">${esc(core.lastError)}</div>` : ''}
      <div class="actions">
        <button class="btn sm-btn" data-act="restart-core" data-arg="${core.id || ''}" type="button">${icon('power', 'ic ic-sm')}${t('ری‌استارت', 'RESTART')}</button>
      </div>
    </div>`;
}

function renderCores() {
  const st = S.state;
  const x = st.cores.xray;
  const sb = st.cores.singbox;
  const mt = st.cores.mtproto;
  const mux = st.cores.mux;

  $('#pane-cores').innerHTML = `
    <div class="grid-3">
      ${coreCard('XRAY-CORE', { ...x, id: 'xray' }, `<tr><th>${t('اینباند', 'INBOUNDS')}</th><td class="mono">${(x.routes || []).length}</td></tr>`)}
      ${coreCard('SING-BOX', { ...sb, id: 'singbox' }, `<tr><th>${t('اینباند', 'INBOUNDS')}</th><td class="mono">${(sb.routes || []).length}</td></tr>`)}
      ${coreCard('MTG · MTPROTO', { ...mt, id: 'mtproto' }, `<tr><th>PORT</th><td class="mono">127.0.0.1:${mt.port}</td></tr>`)}
    </div>

    <div class="cols" style="margin-top:14px">
      <div class="card">
        <div class="spread">
          <p class="kicker" style="margin:0">${icon('terminal')}${t('گزارش زنده', 'LIVE LOG')}</p>
          <div class="pill-group">
            ${['xray', 'singbox', 'mtproto'].map((source) => `
              <button class="pill ${S.logSource === source ? 'active' : ''}" data-act="log-source" data-arg="${source}" type="button">${source}</button>`).join('')}
          </div>
        </div>
        <div class="console" id="log-console" style="margin-top:10px">…</div>
        <div class="actions">
          <button class="btn sm-btn ghost" data-act="refresh-logs" type="button">${icon('refresh', 'ic ic-sm')}${t('تازه‌سازی', 'REFRESH')}</button>
          <a class="btn sm-btn ghost" href="/api/logs?source=${S.logSource}" target="_blank" rel="noopener">${icon('external', 'ic ic-sm')}${t('خام', 'RAW')}</a>
        </div>
      </div>

      <div class="card card-subtle">
        <p class="kicker">${icon('pulse')}${t('سنجه‌های ران‌تایم', 'RUNTIME METRICS')}</p>
        <table class="tbl">
          <tbody>
            <tr><th>${t('آپ‌تایم پنل', 'PANEL UPTIME')}</th><td class="mono">${fmtUptime(Date.now() - st.cores.bootedAt)}</td></tr>
            <tr><th>${t('آپ‌تایم Xray', 'XRAY UPTIME')}</th><td class="mono">${st.cores.sys.uptime ? `${st.cores.sys.uptime}s` : '—'}</td></tr>
            <tr><th>Goroutines</th><td class="mono">${st.cores.sys.goroutines || '—'}</td></tr>
            <tr><th>Heap</th><td class="mono">${st.cores.sys.alloc ? fmtBytes(st.cores.sys.alloc) : '—'}</td></tr>
            <tr><th>${t('کل اتصال‌ها (mux)', 'MUX CONNECTIONS')}</th><td class="mono">${mux.total}</td></tr>
            <tr><th>${t('فعال', 'ACTIVE')}</th><td class="mono">${mux.active}</td></tr>
            <tr><th>${t('ترافیک mux', 'MUX TRAFFIC')}</th><td class="mono">↑${fmtBytes(mux.up)} ↓${fmtBytes(mux.down)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <p class="kicker">${icon('file')}${t('کانفیگ تولیدشده', 'GENERATED CONFIG')}</p>
      <p class="hint" style="margin-top:0">${t('پنل در هر تغییر، کانفیگ کامل هر دو هسته را از نو می‌سازد و قبل از اجرا با ابزار خود هسته اعتبارسنجی می‌کند. فایل‌ها در مسیر دادهٔ سرویس ذخیره می‌شوند.', 'Every change rebuilds both configs and validates them with the core\'s own checker before restarting. Files are kept inside the service data directory.')}</p>
      <div class="row">
        <span class="chip">state/xray.json</span>
        <span class="chip">state/sing-box.json</span>
        <button class="btn sm-btn ghost" data-act="raw-open" data-arg="xray" type="button">${icon('edit', 'ic ic-sm')}Xray ${t('ویرایش آزاد', 'RAW EDIT')}</button>
        <button class="btn sm-btn ghost" data-act="raw-open" data-arg="singbox" type="button">${icon('edit', 'ic ic-sm')}sing-box ${t('ویرایش آزاد', 'RAW EDIT')}</button>
        <button class="btn sm-btn" data-act="apply" type="button">${icon('refresh', 'ic ic-sm')}${t('بازسازی و اعمال', 'REBUILD & APPLY')}</button>
      </div>
      <p class="hint">${t('با «ویرایش آزاد» می‌توانی JSON کامل هسته را دستی تغییر دهی؛ اگر هسته آن را رد کند، پنل خودکار به کانفیگ ساختهٔ خودش برمی‌گردد.', 'Raw edit lets you hand-tune the full core JSON. If the core rejects it, the panel falls back to its generated config automatically.')}</p>
      ${freeStrip()}
    </div>`;
  refreshLogs();
}

async function refreshLogs() {
  const consoleEl = $('#log-console');
  if (!consoleEl) return;
  try {
    const data = await api(`/api/logs?source=${S.logSource}`);
    const lines = (data.lines || []).slice(-150);
    consoleEl.innerHTML = lines.length
      ? lines.map((line) => `<span class="ln ${/error|fail|cannot|denied/i.test(line) ? 'err' : /warn/i.test(line) ? 'warn' : ''}">${esc(line)}</span>`).join('')
      : '<span class="ln">—</span>';
    consoleEl.scrollTop = consoleEl.scrollHeight;
  } catch {
    consoleEl.textContent = 'log unavailable';
  }
}

function startLogPolling() {
  stopLogPolling();
  S.logTimer = setInterval(() => { if (S.tab === 'cores') refreshLogs(); }, 4000);
}

function stopLogPolling() {
  if (S.logTimer) clearInterval(S.logTimer);
  S.logTimer = null;
}

/* ── settings ────────────────────────────────────────────────────────── */

function renderSettings() {
  const st = S.state;
  $('#pane-settings').innerHTML = `
    <div class="cols">
      <div class="card">
        <p class="kicker">${icon('globe')}${t('میزبان و پورت‌ها', 'HOSTS & PORTS')}</p>
        <div class="field-grid">
          <div><label class="fld-label">${t('دامنهٔ عمومی (HTTPS)', 'PUBLIC HOST (HTTPS)')}</label>
            <input type="text" id="s-public" value="${esc(st.settings.publicHost)}" placeholder="${esc(st.facts.publicHost || 'app.up.railway.app')}"></div>
          <div><label class="fld-label">${t('دامنهٔ پروکسی TCP', 'TCP PROXY HOST')}</label>
            <input type="text" id="s-tcphost" value="${esc(st.settings.tcpHost)}" placeholder="${esc(st.facts.tcpHost || 'roundhouse.proxy.rlwy.net')}"></div>
          <div><label class="fld-label">${t('پورت پروکسی TCP', 'TCP PROXY PORT')}</label>
            <input type="number" id="s-tcpport" value="${esc(st.settings.tcpPort || '')}" placeholder="${st.facts.tcpPort || ''}"></div>
          <div><label class="fld-label">${t('سطح لاگ Xray', 'XRAY LOG LEVEL')}</label>
            <select id="s-loglevel">
              ${['warning', 'info', 'debug', 'error', 'none'].map((lvl) => `<option value="${lvl}" ${st.settings.logLevel === lvl ? 'selected' : ''}>${lvl}</option>`).join('')}
            </select></div>
        </div>
        <p class="hint">${t('مقادیر خالی یعنی «خودکار از متغیرهای ریلوی». اگر روی دامنهٔ اختصاصی هستید، همان را وارد کنید.', 'Empty fields mean “auto from Railway variables”. On a custom domain, type it here.')}</p>
        <div class="actions">
          <button class="btn primary" data-act="save-settings" type="button">${icon('save', 'ic ic-sm')}${t('ذخیره', 'SAVE')}</button>
        </div>
      </div>

      <div class="card">
        <p class="kicker">${icon('cpu')}${t('هسته‌ها', 'CORES')}</p>
        <div class="stack-sm">
          <label class="chk"><input type="checkbox" id="s-core-xray" ${st.settings.cores.xray.enabled ? 'checked' : ''}>
            ${t('اجرای Xray-core', 'Run Xray-core')}</label>
          <label class="chk"><input type="checkbox" id="s-core-singbox" ${st.settings.cores.singbox.enabled ? 'checked' : ''}>
            ${t('اجرای sing-box', 'Run sing-box')}</label>
          <label class="chk"><input type="checkbox" id="s-core-lazy" ${st.settings.cores.singbox.lazy ? 'checked' : ''}>
            ${t('sing-box فقط وقتی اینباند دارد', 'Start sing-box only when it has inbounds')}</label>
          <label class="chk"><input type="checkbox" id="s-lowmem" ${st.settings.lowMemory ? 'checked' : ''}>
            ${t('حالت کم‌مصرف (پلن رایگان)', 'Low-memory mode (free plan)')}</label>
        </div>
        <div class="actions ${''}">
          <button class="btn sm-btn primary" data-act="save-cores" type="button">${icon('save', 'ic ic-sm')}${t('ذخیره', 'SAVE')}</button>
        </div>
        <div class="dashed"></div>
        <p class="kicker">${icon('lock')}${t('تغییر گذرواژهٔ مدیر', 'CHANGE ADMIN PASSWORD')}</p>
        <div class="field-grid">
          <div><label class="fld-label">${t('گذرواژهٔ فعلی', 'CURRENT')}</label><input type="password" id="s-pass-cur"></div>
          <div><label class="fld-label">${t('گذرواژهٔ جدید', 'NEW')}</label><input type="password" id="s-pass-new"></div>
        </div>
        <div class="actions">
          <button class="btn sm-btn" data-act="change-pass" type="button">${icon('key', 'ic ic-sm')}${t('تغییر', 'UPDATE')}</button>
        </div>
      </div>
    </div>

    <div class="cols" style="margin-top:14px">
      <div class="card">
        <p class="kicker">${icon('download')}${t('پشتیبان‌گیری', 'BACKUP & RESTORE')}</p>
        <p class="labor">${t('تمام کاربران، اینباندها و کلیدها در یک فایل JSON هستند. قبل از هر ارتقا یک نسخه بگیرید.', 'Users, inbounds and keys live in one JSON file. Take a copy before every upgrade.')}</p>
        <div class="actions">
          <a class="btn sm-btn" href="/api/backup" download>${icon('download', 'ic ic-sm')}${t('دریافت پشتیبان', 'DOWNLOAD BACKUP')}</a>
          <label class="btn sm-btn ghost" style="cursor:pointer">
            ${icon('upload', 'ic ic-sm')}${t('بازیابی', 'RESTORE')}
            <input type="file" id="restore-file" accept="application/json" hidden>
          </label>
        </div>
        <div class="dashed"></div>
        <p class="kicker">${icon('search')}${t('آزمون اتصال', 'CONNECTIVITY PROBE')}</p>
        <div class="field-grid">
          <div><label class="fld-label">${t('میزبان', 'HOST')}</label><input type="text" id="s-probe-host" placeholder="${esc(st.facts.tcpHost || 'example.com')}"></div>
          <div><label class="fld-label">PORT</label><input type="number" id="s-probe-port" value="${st.facts.tcpPort || 443}"></div>
        </div>
        <div class="actions">
          <button class="btn sm-btn ghost" data-act="probe" type="button">${icon('radar', 'ic ic-sm')}${t('آزمایش', 'TEST')}</button>
        </div>
        <div id="probe-result"></div>
      </div>

      <div class="card card-subtle">
        <p class="kicker">${icon('railway')}${t('دربارهٔ این نصب', 'ABOUT THIS DEPLOYMENT')}</p>
        <table class="tbl">
          <tbody>
            <tr><th>${t('پروژه', 'PROJECT')}</th><td class="mono">${esc(st.facts.projectName || '—')}</td></tr>
            <tr><th>${t('سرویس', 'SERVICE')}</th><td class="mono">${esc(st.facts.serviceName || '—')}</td></tr>
            <tr><th>Region</th><td class="mono">${esc(st.facts.region || 'auto')}</td></tr>
            <tr><th>${t('مسیر داده', 'DATA DIR')}</th><td class="mono" style="overflow-wrap:anywhere">${esc(st.facts.dataDir)}</td></tr>
            <tr><th>Volume</th><td class="mono" style="overflow-wrap:anywhere">${esc(st.facts.volume || '—')}</td></tr>
            <tr><th>PORT</th><td class="mono">${st.facts.port}</td></tr>
            <tr><th>MUX</th><td class="mono">${st.facts.muxPort}</td></tr>
            <tr><th>Xray</th><td class="mono" style="overflow-wrap:anywhere">${esc(st.facts.bins.xray)}</td></tr>
            <tr><th>sing-box</th><td class="mono" style="overflow-wrap:anywhere">${esc(st.facts.bins.singbox)}</td></tr>
            <tr><th>mtg</th><td class="mono" style="overflow-wrap:anywhere">${esc(st.facts.bins.mtg)}</td></tr>
          </tbody>
        </table>
        <div class="actions">
          <a class="btn sm-btn ghost" href="${esc(st.app.repo)}" target="_blank" rel="noopener">${icon('external', 'ic ic-sm')}${t('مخزن پروژه', 'REPOSITORY')}</a>
          <a class="btn sm-btn ghost" href="${esc(st.app.telegram)}" target="_blank" rel="noopener">${icon('telegram', 'ic ic-sm')}${t('پشتیبانی', 'SUPPORT')}</a>
        </div>
        ${freeStrip()}
      </div>
    </div>`;
}

/* ── modal ───────────────────────────────────────────────────────────── */

/**
 * Modal title. `title` is plain text by default (safe for user data);
 * pass `true` as the third argument when the caller already built bilingual
 * markup with t(), so it is not escaped into visible source code.
 */
function openModal(title, body, asHtml = false) {
  if (asHtml) $('#modal-title').innerHTML = title;
  else $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = body;
  $('#modal').hidden = false;
}

function closeModal() {
  $('#modal').hidden = true;
  $('#modal-body').innerHTML = '';
}

/* ── actions ─────────────────────────────────────────────────────────── */

function busy(on) {
  S.busy = on;
  document.body.style.cursor = on ? 'progress' : '';
}

async function withState(fn) {
  if (S.busy) return;
  busy(true);
  try {
    const res = await fn();
    if (res && res.state) {
      S.state = res.state;
      renderAll();
    }
  } catch (err) {
    if (err.status === 401) return showAuth();
    toast(err.message, 'warn');
  } finally {
    busy(false);
  }
}

function paramValues(id) {
  const out = {};
  $$(`[data-param][data-id="${id}"]`).forEach((el) => {
    out[el.dataset.param] = el.value;
  });
  return out;
}

async function onAction(act, arg, el) {
  const st = S.state;
  switch (act) {
    case 'tab':
      return switchTab(arg);
    case 'copy':
      return copyText(arg);
    case 'qr':
      return openModal('QR', `<div class="qr-center"><div class="qrbox qr"><div id="modal-qr"></div></div><p class="code-line" style="margin-top:8px;max-height:80px;overflow:auto">${esc(arg)}</p></div>`) || qrInto($('#modal-qr'), arg);
    case 'apply':
      return withState(async () => {
        const res = await api('/api/apply', { method: 'POST' });
        toast('configs applied');
        return res;
      });
    case 'add-inbound':
      return withState(() => api('/api/inbounds', { method: 'POST', body: { presetId: arg } }));
    case 'toggle-inbound':
      return withState(() => api(`/api/inbounds/${arg}`, { method: 'PATCH', body: { enabled: el.checked } }));
    case 'edit-inbound':
      S.editing = S.editing === arg ? null : arg;
      return renderInbounds();
    case 'save-inbound': {
      const params = paramValues(arg);
      return withState(() => api(`/api/inbounds/${arg}`, { method: 'PATCH', body: { params } }));
    }
    case 'del-inbound':
      if (!confirm('delete inbound?')) return;
      return withState(() => api(`/api/inbounds/${arg}`, { method: 'DELETE' }));
    case 'create-user': {
      const body = {
        name: $('#nu-name')?.value || '',
        quotaGb: Number($('#nu-quota')?.value || 0),
        days: Number($('#nu-days')?.value || 0),
        ipLimit: Number($('#nu-ip')?.value || 0),
        note: $('#nu-note')?.value || '',
      };
      return withState(async () => {
        const res = await api('/api/users', { method: 'POST', body });
        toast('user created');
        return res;
      });
    }
    case 'toggle-user':
      return withState(() => api(`/api/users/${arg}`, { method: 'PATCH', body: { enabled: el.dataset.value === '1' } }));
    case 'reset-user':
      return withState(() => api(`/api/users/${arg}/resettraffic`, { method: 'POST' }));
    case 'rotate-user':
      if (!confirm('rotate keys? old links stop working')) return;
      return withState(() => api(`/api/users/${arg}/rotate`, { method: 'POST' }));
    case 'del-user':
      if (!confirm('delete user?')) return;
      return withState(() => api(`/api/users/${arg}`, { method: 'DELETE' }));
    case 'show-links':
      return showUserLinks(arg);
    case 'toggle-mtproto':
      return withState(() => api('/api/telegram', { method: 'POST', body: { mtproto: { enabled: el.checked } } }));
    case 'save-mtproto':
      return withState(() => api('/api/telegram', {
        method: 'POST',
        body: { mtproto: { enabled: true, faketlsHost: $('#tg-faketls')?.value || 'www.microsoft.com', adTag: $('#tg-adtag')?.value || '' } },
      }));
    case 'regen-secret':
      if (!confirm('generate a new secret? current links stop working')) return;
      return withState(() => api('/api/telegram/secret', { method: 'POST' }));
    case 'toggle-socks':
      return withState(() => api('/api/telegram', { method: 'POST', body: { socks: { enabled: el.checked } } }));
    case 'save-socks':
      return withState(() => api('/api/telegram', {
        method: 'POST',
        body: { socks: { enabled: true, user: $('#tg-socks-user')?.value || 'nl', pass: $('#tg-socks-pass')?.value || '' } },
      }));
    case 'toggle-http':
      return withState(() => api('/api/telegram', { method: 'POST', body: { http: { enabled: el.checked } } }));
    case 'save-http':
      return withState(() => api('/api/telegram', {
        method: 'POST',
        body: { http: { enabled: true, user: $('#tg-http-user')?.value || 'nl', pass: $('#tg-http-pass')?.value || '' } },
      }));
    case 'rl-start': {
      const link = ($('#rl-link')?.value || RAILYNX.link || '').trim();
      if (!link) return toast(t('اول یک لینک VLESS بده.', 'Paste a VLESS link first.'), 'warn');
      RAILYNX.link = link;
      busy(true);
      try {
        RAILYNX.data = await api('/api/railynx/scan', {
          method: 'POST',
          body: { link, cidr: $('#rl-cidr')?.value || '', concurrency: Number($('#rl-workers')?.value || 12) },
        });
        startRailynxPolling();
        renderRailynx();
        toast(t('اسکن شروع شد.', 'Scan started.'));
      } catch (err) {
        toast(err.message, 'warn');
      } finally {
        busy(false);
      }
      return;
    }
    case 'rl-cancel':
      busy(true);
      try {
        RAILYNX.data = await api('/api/railynx/cancel', { method: 'POST' });
        renderRailynx();
        toast(t('اسکن لغو شد؛ نتایج تا این لحظه ماند.', 'Scan cancelled — results so far are kept.'));
      } catch (err) {
        toast(err.message, 'warn');
      } finally {
        busy(false);
      }
      return;
    case 'modal-close':
      closeModal();
      return;
    case 'raw-open': {
      const core = arg;
      busy(true);
      try {
        const raw = await api('/api/raw');
        const text = raw.active[core] || raw.generated[core] || '';
        const flagged = raw.override[core] ? t('کانفیگ دستی فعال است', 'Manual config is active') : t('کانفیگ خودکار', 'Generated config');
        openModal(`${icon('edit', 'ic ic-sm')} ${core} · ${t('ویرایش خام', 'RAW CONFIG')}`, `
          <p class="hint" style="margin-top:0">${esc(flagged)}${raw.notes && raw.notes[core] ? ` — ${esc(raw.notes[core])}` : ''}</p>
          <textarea id="raw-box" class="raw-box" spellcheck="false" dir="ltr">${esc(text)}</textarea>
          <div class="actions">
            <button class="btn sm-btn primary" data-act="raw-save" data-arg="${core}" type="button">${icon('save', 'ic ic-sm')}${t('ذخیره و اعمال', 'SAVE & APPLY')}</button>
            <button class="btn sm-btn ghost" data-act="raw-reset" data-arg="${core}" type="button">${icon('refresh', 'ic ic-sm')}${t('بازگشت به خودکار', 'BACK TO AUTO')}</button>
            <button class="btn sm-btn ghost" data-act="modal-close" type="button">${t('بستن', 'CLOSE')}</button>
          </div>`, true);
      } catch (err) {
        toast(err.message, 'warn');
      } finally {
        busy(false);
      }
      return;
    }
    case 'raw-save': {
      const text = $('#raw-box')?.value || '';
      busy(true);
      try {
        const res = await api('/api/raw', { method: 'POST', body: { core: arg, config: text } });
        S.state = res.state;
        renderAll();
        closeModal();
        toast(t('کانفیگ ذخیره و اعمال شد.', 'Config saved and applied.'));
      } catch (err) {
        toast(err.message, 'warn');
      } finally {
        busy(false);
      }
      return;
    }
    case 'raw-reset': {
      busy(true);
      try {
        const res = await api('/api/raw', { method: 'POST', body: { core: arg, config: '' } });
        S.state = res.state;
        renderAll();
        closeModal();
        toast(t('به کانفیگ خودکار برگشت.', 'Back to the generated config.'));
      } catch (err) {
        toast(err.message, 'warn');
      } finally {
        busy(false);
      }
      return;
    }
    case 'easy-refresh':
      EASY_CACHE.data = null;
      await loadEasy(true);
      renderEasy();
      return;
    case 'open':
      window.open(arg, '_blank', 'noopener');
      return;
    case 'easy-apply': {
      busy(true);
      try {
        const res = await api('/api/easy-setup/apply', { method: 'POST', body: { profile: arg } });
        S.state = await api('/api/state');
        EASY_CACHE.data = await api('/api/easy-setup');
        EASY_CACHE.at = Date.now();
        renderAll();
        S.tab = 'easy';
        switchTab('easy');
        toast(t('پروفایل اعمال شد؛ لینک آماده است.', 'Profile applied — link is ready.'));
        if (res.subUrl) copyText(res.subUrl);
      } catch (err) {
        toast(err.message, 'warn');
      } finally {
        busy(false);
      }
      return;
    }
    case 'restart-core':
      return withState(async () => {
        const res = await api(`/api/cores/${arg}/restart`, { method: 'POST' });
        toast(`${arg} restarted`);
        return res;
      });
    case 'log-source':
      S.logSource = arg;
      renderCores();
      return;
    case 'refresh-logs':
      return refreshLogs();
    case 'save-settings':
      return withState(() => api('/api/settings', {
        method: 'POST',
        body: {
          publicHost: $('#s-public')?.value || '',
          tcpHost: $('#s-tcphost')?.value || '',
          tcpPort: Number($('#s-tcpport')?.value || 0),
          logLevel: $('#s-loglevel')?.value || 'warning',
        },
      }));
    case 'save-cores':
      return withState(() => api('/api/settings', {
        method: 'POST',
        body: {
          lowMemory: $('#s-lowmem')?.checked ?? true,
          cores: {
            xray: { enabled: $('#s-core-xray')?.checked ?? true },
            singbox: { enabled: $('#s-core-singbox')?.checked ?? true, lazy: $('#s-core-lazy')?.checked ?? true },
          },
        },
      }));
    case 'change-pass':
      return withState(async () => {
        await api('/api/admin/password', {
          method: 'POST',
          body: { current: $('#s-pass-cur')?.value || '', password: $('#s-pass-new')?.value || '' },
        });
        toast('password updated');
        return null;
      });
    case 'probe': {
      const host = $('#s-probe-host')?.value || '';
      const port = Number($('#s-probe-port')?.value || 443);
      const res = await api('/api/tools/probe', { method: 'POST', body: { host, port } });
      const box = $('#probe-result');
      if (box) {
        box.innerHTML = `<div class="${res.ok ? 'ok-msg' : 'err'}" style="margin-top:10px">
          ${res.ok ? `OPEN · ${res.ms}ms` : `FAILED · ${esc(res.error)}`} — ${esc(host)}:${port}
        </div>`;
      }
      return;
    }
    default:
      return undefined;
  }
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'toggle-inbound' || act === 'toggle-mtproto' || act === 'toggle-socks' || act === 'toggle-http') return; // handled on change
  ev.preventDefault();
  onAction(act, el.dataset.arg, el);
});

document.addEventListener('change', (ev) => {
  if (ev.target.id === 'rl-pick') {
    const box = $('#rl-link');
    if (box && ev.target.value) {
      box.value = ev.target.value;
      RAILYNX.link = ev.target.value;
    }
    return;
  }
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  if (['toggle-inbound', 'toggle-mtproto', 'toggle-socks', 'toggle-http'].includes(el.dataset.act)) {
    onAction(el.dataset.act, el.dataset.arg, el);
  }
});

/* ── auth flow ───────────────────────────────────────────────────────── */

function showAuth() {
  $('#boot').hidden = true;
  $('#app').hidden = true;
  $('#auth').hidden = false;
  const needsSetup = S.boot.needsSetup;
  $('#auth-pass2-wrap').hidden = !needsSetup;
  $('#auth-kicker').textContent = needsSetup ? 'ساخت حساب مدیر' : 'ورود مدیر';
  $('#auth-kicker-en').textContent = needsSetup ? 'CREATE OPERATOR' : 'OPERATOR SIGN-IN';
  $('#auth-title').innerHTML = needsSetup
    ? t('رمز و نام کاربری مدیر را تعیین کنید', 'Choose the operator credentials')
    : t('به ایستگاه نایت‌لاین خوش آمدید', 'Welcome back to NightLine');
  $('#auth-submit-fa').textContent = needsSetup ? 'ساخت پنل' : 'ورود به پنل';
  $('#auth-submit-en').textContent = needsSetup ? 'CREATE PANEL' : 'ENTER PANEL';
  $('#auth-env').textContent = (S.boot.facts.isRailway ? 'RAILWAY' : 'LOCAL') + ' · ' + (S.boot.app.version || '');
}

async function submitAuth(ev) {
  ev.preventDefault();
  const errBox = $('#auth-err');
  errBox.hidden = true;
  const username = $('#auth-user').value.trim();
  const password = $('#auth-pass').value;
  const needsSetup = S.boot.needsSetup;
  try {
    if (needsSetup) {
      if (password !== $('#auth-pass2').value) throw new Error('passwords do not match');
      if (password.length < 8) throw new Error('password must be at least 8 characters');
      await api('/api/setup', { method: 'POST', body: { username, password } });
    } else {
      await api('/api/login', { method: 'POST', body: { username, password } });
    }
    await loadState();
  } catch (err) {
    errBox.hidden = false;
    errBox.textContent = err.message;
  }
}

/* ── boot & refresh ──────────────────────────────────────────────────── */

function renderAll() {
  $('#boot').hidden = true;
  $('#auth').hidden = true;
  $('#app').hidden = false;
  renderStatusBar();
  renderNav();
  renderDashboard();
  renderEasy();
  renderRailynx();
  renderInbounds();
  renderUsers();
  renderDelivery();
  renderTelegram();
  renderCores();
  renderSettings();
  $$('.tab-pane').forEach((pane) => { pane.hidden = pane.dataset.pane !== S.tab; });
}

async function loadState() {
  S.state = await api('/api/state');
  applyTheme(S.state.settings.theme || 'dark');
  applyLang(S.state.settings.lang || 'fa');
  renderAll();
  if (S.tab === 'cores') startLogPolling();
}

async function boot() {
  document.title = 'NIGHTLINE · RAILWAY — FREE & NOT FOR SALE';
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  applyLang(localStorage.getItem(LANG_KEY) || 'fa');

  $('#btn-lang')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.lang === 'fa' ? 'en' : 'fa';
    applyLang(next);
    if (S.state) { S.state.settings.lang = next; }
    renderAll();
  });
  $('#auth-lang')?.addEventListener('click', () => {
    applyLang(document.documentElement.dataset.lang === 'fa' ? 'en' : 'fa');
    if (S.boot) showAuth();
  });
  $$('.t-pick').forEach((btn) => btn.addEventListener('click', () => applyTheme(btn.dataset.th)));
  $('#auth-form')?.addEventListener('submit', submitAuth);
  $('#modal-close')?.addEventListener('click', closeModal);
  $('#modal')?.addEventListener('click', (ev) => { if (ev.target.id === 'modal') closeModal(); });
  $('#btn-apply')?.addEventListener('click', () => onAction('apply'));
  $('#btn-reload')?.addEventListener('click', () => loadState().catch((err) => toast(err.message, 'warn')));
  $('#btn-logout')?.addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' }).catch(() => {});
    location.reload();
  });
  document.addEventListener('change', (ev) => {
    if (ev.target.id !== 'restore-file') return;
    const file = ev.target.files?.[0];
    if (!file) return;
    file.text().then((text) => withState(async () => {
      const res = await api('/api/restore', { method: 'POST', body: JSON.parse(text) });
      toast('backup restored');
      return res;
    })).catch((err) => toast(err.message, 'warn'));
  });

  try {
    S.boot = await api('/api/bootstrap');
  } catch (err) {
    $('#boot').innerHTML = `<div class="card"><div class="err">${esc(err.message)}</div></div>`;
    return;
  }

  if (!S.boot.loggedIn) {
    showAuth();
    return;
  }
  try {
    await loadState();
  } catch (err) {
    showAuth();
  }

  // light background refresh so counters stay alive without touching inputs
  S.refreshTimer = setInterval(async () => {
    if (document.hidden || S.busy || !S.state) return;
    if (['telegram', 'cores', 'dashboard'].includes(S.tab)) {
      try {
        S.state = await api('/api/state');
        renderStatusBar();
        if (S.tab === 'dashboard') renderDashboard();
        if (S.tab === 'telegram') renderTelegram();
      } catch { /* ignore */ }
    }
  }, 15000);
}

boot();
