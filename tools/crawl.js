/* Data Architect button crawler: visits every screen and clicks every visible button, link, tab, toggle and menu item once.
   node tools/crawl.js [BASE] [--engine chromium|webkit] [--state fresh|mid] [--quick] [--only REGEX] [--report]
   Chromium runs as the Mac (1440x900), WebKit as an iPhone 13. Fresh = first run; mid = five weeks in, with ticks, scores,
   solved problems, a playbook, a simulator pass and a stub sync server. Each control is clicked from the screen as it was
   (state and route restored), and the crawler records what visibly happened: route change, DOM change, dialog, toast,
   aria-expanded/selected/pressed change, focus moved, popup, download, file picker, sound. It also records page errors,
   console errors, CSP violations, dead controls, tap targets under 44 px on the iPhone, text overflowing its box and
   controls without an accessible name. Destructive controls (Reset, Delete, Sign out…) are skipped and logged.
   Regression checks for fixed bugs run at the end (REGRESS). Results: tools/crawl/<engine>-<state>.json; --report
   (or a run of all four) writes tools/crawl/REPORT.md. Exit 1 on any issue.
   Never reaches the real grader (127.0.0.1:8765), api.anthropic.com (stubbed) or a real sync URL (https://sync.test stub). */
const fs = require('fs'), path = require('path');
const pw = require(process.env.PW || 'playwright');
const args = process.argv.slice(2);
const arg = k => args.includes(k) ? args[args.indexOf(k) + 1] : null;
const BASE = (args.find(a => /^http/.test(a)) || 'http://localhost:8811/').replace(/\/?$/, '/');
const QUICK = args.includes('--quick');
const ONLY = arg('--only') ? new RegExp(arg('--only')) : null;
const ENGINES = arg('--engine') ? [arg('--engine')] : ['chromium', 'webkit'];
const STATES = arg('--state') ? [arg('--state')] : ['fresh', 'mid'];
const OUT = path.join(__dirname, 'crawl');
const T = +(process.env.CRAWL_SLOW || 1); /* timeout multiplier for a busy Mac */
const DESTRUCTIVE = /^(reset|delete|remove|clear|sign out|start over|erase|forget|wipe|restore|import)\b|reset and exit|delete wire|remove this design/i;
/* tap-target exceptions, listed in the report: the simulator canvas (boxes and wires scale with zoom; pinch to enlarge)
   and Progress's 84-square DSA heat-map (an overview; every problem is also a full-size row in Practice) */
const TAP_EXEMPT = '.simnode, .simedge, .dsa-grid a';
const CHROME = '.side, .tabbar, header.top, .coachfab, .fab'; /* shared on every screen: crawled once, on Today */
const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const AI = r => { if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: H }); const fu = /ONE follow-up/.test(r.request().postData() || ''); return r.fulfill({ headers: H, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: fu ? '{"followup":"What changes at 100 times the data?"}' : '{"scores":{"correct":3,"depth":3,"trade":2,"clear":3},"rejected":true,"limits":true,"operate":false,"feedback":"Name the limit.","better":"A stronger answer."}' }] }) }); };
const SYNC = r => r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: H }) : r.request().method() === 'POST' ? r.fulfill({ headers: H, contentType: 'application/json', body: '{"ok":true}' }) : r.fulfill({ headers: H, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { start: '2026-10-05', done: {}, solved: {}, updated: 1 } }) });

/* runs in the page before the app: CSP violations, popups, sound, mutations */
const INIT = () => {
  window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || '')));
  window.__open = 0; const wo = window.open; window.open = function () { window.__open++; return null; };
  window.__snd = 0; const A = window.Audio; if (A) { window.Audio = function (...a) { const x = new A(...a); const pl = x.play.bind(x); x.play = () => { window.__snd++; return pl().catch(() => {}); }; return x; }; window.Audio.prototype = A.prototype; }
  if (window.speechSynthesis) { const sp = window.speechSynthesis.speak.bind(window.speechSynthesis); window.speechSynthesis.speak = u => { window.__snd++; try { sp(u); } catch (e) { } }; }
  window.__mut = 0; new MutationObserver(l => { window.__mut += l.length; }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  try { if (navigator.clipboard) navigator.clipboard.writeText = async () => { window.__clip = (window.__clip || 0) + 1; }; } catch (e) { }
};

/* mid-program learner: five weeks in, most earlier steps done, some scores and history */
const MID = () => {
  const d = new Date(); d.setDate(d.getDate() - 35); S.start = iso(d); S.since = iso(d);
  const today = iso(new Date()), sc = scheduleNow(), past = sc.units.filter(u => u.day < today);
  past.forEach((u, i) => { if (i % 7 !== 3) { S.done[u.uid] = u.day; S.cv.units[u.uid] = unitHash(u); } });
  (sc.byDay[today] || []).slice(0, 1).forEach(u => { S.done[u.uid] = today; S.cv.units[u.uid] = unitHash(u); });
  const ids = [].concat(...['py', 'dsa', 'sql', 'spark'].map(k => (DATA[k] || []).slice(0, 3).map(x => x.id)));
  ids.slice(0, 12).forEach((id, i) => { S.solved[id] = 1; if (i < 3) { S.rev = S.rev || {}; S.rev[id] = { n: 1, due: today }; } });
  S.settings.syncUrl = 'https://sync.test/exec?k=test'; S.lastSync = Date.now() - 3600e3;
  S.settings.name = 'Sam';
  save();
};

function sigOf(c, loose) { return [c.tag, c.role, c.cls, loose ? '' : c.label.replace(/\d+/g, '#').slice(0, 40), (c.href || '').replace(/\d+/g, '#').replace(/\/[a-z]\d\d\b/g, '/M').replace(/#sec.*/, '#sec')].join('|'); }

async function crawl(browser, engine, state) {
  const iphone = engine === 'webkit';
  const opt = Object.assign(iphone ? Object.assign({}, pw.devices['iPhone 13']) : { viewport: { width: 1440, height: 900 } }, { serviceWorkers: 'block', acceptDownloads: true });
  const ctx = await browser.newContext(opt);
  await ctx.route(u => !u.href.startsWith(BASE) && u.host !== 'cdn.jsdelivr.net' && /^https?:/.test(u.protocol), r => {
    const u = r.request().url();
    if (/api\.anthropic\.com/.test(u)) return AI(r);
    if (/sync\.test/.test(u)) return SYNC(r);
    return r.abort();
  });
  await ctx.route('http://127.0.0.1:8765/**', r => r.abort());
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  const R = { engine, state, base: BASE, at: new Date().toISOString(), routes: [], controls: [], issues: [], skipped: [] };
  const ev = { errs: [], dlg: 0, dl: 0, fc: 0, popup: 0 };
  const sameOrigin = u => !u || u.startsWith(BASE) || u.startsWith('blob:') || u.startsWith('data:');
  page.on('pageerror', e => ev.errs.push('pageerror: ' + e.message.slice(0, 200)));
  page.on('console', m => {
    if (m.type() !== 'error') return; const t = m.text(), loc = (m.location() || {}).url || '';
    if (/Failed to preconnect|Failed to load resource|net::ERR|ERR_FAILED|blocked by CORS|Access-Control/.test(t) && !sameOrigin(loc)) return; /* our own stubs aborting third-party requests */
    if (/Content Security Policy|Refused to/.test(t)) return ev.errs.push('csp: ' + t.slice(0, 200));
    ev.errs.push('console: ' + t.slice(0, 200));
  });
  page.on('dialog', d => { ev.dlg++; d.dismiss().catch(() => {}); });
  page.on('download', d => { ev.dl++; d.cancel().catch(() => {}); });
  page.on('filechooser', () => { ev.fc++; });
  page.on('popup', p => { ev.popup++; p.close().catch(() => {}); });
  const issue = (route, kind, what, ctl) => R.issues.push({ route, kind, what, ctl: ctl || '' });

  const ready = async () => { await page.waitForFunction(() => document.querySelector('h1') && !/^\s*Loading/.test((document.querySelector('#page') || document.body).innerText.slice(0, 40)), null, { timeout: 30000 * T }).catch(() => {}); await page.waitForTimeout(400 * T); };
  async function full(route, seed) {
    await page.goto('about:blank').catch(() => {}); /* a same-URL goto with only a new hash would not reload */
    await page.goto(BASE + route, { timeout: 60000 * T }).catch(() => {});
    await ready();
    if (seed) { await page.evaluate(seed).catch(e => issue(route, 'seed', e.message)); await page.evaluate(() => { saveT && clearTimeout(saveT); saveT = null; localStorage.setItem('keystone:v1', JSON.stringify(S)); }); await page.reload(); await ready(); }
  }

  /* first run: boot, accept the first-run state as the app writes it; mid: seed */
  await page.goto(BASE + '#/today', { timeout: 60000 * T }); await ready();
  if (state === 'mid') await full('#/today', MID);
  const snap = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));

  /* every route to crawl, read from the app itself */
  const routes = await page.evaluate(quick => {
    const cur = curMid(), out = [], add = h => { if (h && !out.includes(h)) out.push(h); };
    ['#/today'].concat(NAV.map(x => x[0]), NAV_GROUPS.flatMap(g => g[2]), TABS.map(x => x[0])).forEach(h => add(h.replace('/0', '/' + cur)));
    add('#/profile'); add('#/path/' + cur); add('#/today/1'); add('#/warm'); add('#/live/' + iso(new Date())); add('#/interview/' + cur);
    ['all', 'review', 'py', 'model', 'dsa', 'sql', 'spark', 'opt', 'tests'].forEach(k => add('#/practice/' + k));
    (quick ? [cur, MODS[0], 's05'] : MODS_ALL).forEach(m => TABS2.forEach(([k]) => add('#/learn/' + m + '/' + k)));
    add('#/quiz/' + cur); add('#/mock/' + cur);
    if (typeof SIM_SC !== 'undefined' && SIM_SC.length) { add('#/sim/sc/' + SIM_SC[0].id); add('#/sim/sc/' + SIM_SC[0].id + '/exam'); }
    if (typeof SIM_TEACH !== 'undefined') add('#/sim/teach/' + Object.keys(SIM_TEACH)[0]);
    return out;
  }, QUICK);
  /* one coding problem of each kind, one project, design problem, git lesson and reel, found from their list pages */
  if (!ONLY || /practice|py|dsa|project|design|git|cc|reels/.test(ONLY.source)) for (const [list, re] of [['#/practice/all', /^#\/(py|dsa|sql|spark|test)\//], ['#/projects', /^#\/project\//], ['#/design', /^#\/design\/./], ['#/git', /^#\/git\/./], ['#/coach', /^#\/cc\//]]) {
    await full(list); const hs = await page.$$eval('a[href^="#/"]', as => as.map(a => a.getAttribute('href')));
    const kinds = {}; hs.filter(h => re.test(h)).forEach(h => { const k = h.split('/')[1]; if (!kinds[k]) { kinds[k] = 1; routes.push(h); } });
  }
  const reel = ONLY && !/reels/.test(ONLY.source) ? null : await page.evaluate(async () => { const r = (await reelsFor('s05')).find(x => x.beats && x.beats.length > 1); return r && r.id; }).catch(() => null);
  if (reel) routes.push('#/reels/' + reel);
  const todo0 = routes.filter((h, i) => routes.indexOf(h) === i && (!ONLY || ONLY.test(h)));
  /* five weeks in, module text is the same as on the first run: only the current module's tabs are crawled again */
  const cur = await page.evaluate(() => curMid());
  const todo = state === 'mid' ? todo0.filter(h => !/^#\/learn\/[a-z]\d\d\//.test(h) || h.startsWith('#/learn/' + cur + '/')) : todo0; console.log(`[${engine}/${state}] ${todo.length} routes`);

  /* restore the screen as it was before a click: same storage, same in-memory state, same route */
  async function soft(route) {
    try {
      const ok = await page.evaluate(([s, r]) => {
        if (typeof S === 'undefined' || typeof route !== 'function') return false;
        localStorage.clear(); Object.entries(JSON.parse(s)).forEach(([k, v]) => localStorage.setItem(k, v));
        saveT && clearTimeout(saveT); saveT = null; S = load(); lastWrite = localStorage.getItem('keystone:v1');
        document.querySelectorAll('body > .scrim, body > .toast, body > .sheetwrap, body > dialog').forEach(x => x.remove());
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        if (location.hash !== r) history.replaceState(null, '', r); route(); window.scrollTo(0, 0); return true;
      }, [snap, route]);
      if (!ok) throw new Error('no app');
      await page.waitForTimeout(250 * T);
      if (!(await page.$('h1'))) throw new Error('no heading');
    } catch (e) { if (process.env.DEBUG) console.log('    soft reset failed:', e.message.split('\n')[0]); await full(route); }
  }
  /* wait until the screen stops changing (async parts of a screen render after route() returns) */
  async function settle() { for (let i = 0; i < 15; i++) { const a = await page.evaluate(() => window.__mut).catch(() => 0); await page.waitForTimeout(200); const b = await page.evaluate(() => window.__mut).catch(() => 0); if (b - a <= 2) return; } }
  /* every visible control, in document order, with what the crawler needs to judge it */
  const enumerate = (skipChrome) => page.evaluate(([skip, CHROME, EX]) => {
    const list = [...document.querySelectorAll(window.__crawlSEL)].filter(e => window.__crawlVis(e) && !(skip && e.closest(CHROME)) && !e.closest('.xterm, .cm-editor, .CodeMirror'));
    const counts = {};
    return list.map(e => {
      const b = e.getBoundingClientRect(), tag = e.tagName.toLowerCase(), cs = getComputedStyle(e);
      const key = window.__crawlKey(e), label = key.slice(tag.length + 1); counts[key] = (counts[key] || 0) + 1;
      /* inline text links are exempt from the tap-target rule (WCAG 2.5.8) */
      const inline = tag === 'a' && cs.display === 'inline' && e.parentElement && /^(P|LI|TD|SPAN|EM|STRONG|B|DIV|LABEL|SMALL)$/.test(e.parentElement.tagName) && (e.parentElement.innerText || '').trim().length > (e.innerText || '').trim().length + 3;
      let over = false;
      if (tag !== 'select' && cs.overflowX === 'visible' && !/ellipsis/.test(cs.textOverflow)) { over = e.scrollWidth > e.clientWidth + 6 && e.clientWidth > 0; /* a few px is an enlarged tap area (::after), not text */ if (!over && e.innerText && !e.querySelector('.sr')) { const r = document.createRange(); r.selectNodeContents(e); const rb = r.getBoundingClientRect(); over = rb.width > 0 && (rb.right > b.right + 2 || rb.left < b.left - 2) && b.width < rb.width; } }
      return { key, n: counts[key], tag, role: e.getAttribute('role') || '', cls: (e.className && e.className.baseVal === undefined ? e.className : '').split(' ').slice(0, 2).join('.'), label, named: !!label, href: e.getAttribute('href') || '', target: e.getAttribute('target') || '', w: Math.round(b.width), h: Math.round(b.height), inline, over, disabled: !!e.disabled || e.getAttribute('aria-disabled') === 'true', exempt: !!e.closest(EX), term: !!e.closest('.xtkeys'), here: (e.getAttribute('aria-current') || 'false') !== 'false' || (e.getAttribute('href') || '').replace(/\/$/, '') === location.hash.replace(/\/$/, ''), tablike: e.getAttribute('role') === 'tab' || e.hasAttribute('aria-expanded') || tag === 'summary' || e.hasAttribute('aria-controls') };
    });
  }, [skipChrome, CHROME, TAP_EXEMPT]);
  const find = (key, n) => page.evaluateHandle(([key, n, CHROME]) => window.__crawlFind(key, n), [key, n, CHROME]);
  /* effective tap target: the 44x44 box around the control's centre lands on the control (padding or ::after count) */
  async function tapTarget(h) {
    return h.evaluate(e => {
      e.scrollIntoView({ block: 'center', inline: 'center' }); const b = e.getBoundingClientRect();
      if (b.width >= 44 && b.height >= 44) return true;
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2, own = x => x && (x === e || e.contains(x) || x.contains(e) && x.closest('label') === e.closest('label') && !!e.closest('label'));
      const pts = [[cx - 21, cy], [cx + 21, cy], [cx, cy - 21], [cx, cy + 21]].filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight);
      return pts.every(([x, y]) => own(document.elementFromPoint(x, y)));
    }).catch(() => true);
  }
  const before = () => page.evaluate(() => {
    let hsh = 0; const s = [...document.body.children].filter(e => e.tagName !== 'SCRIPT').map(e => e.innerHTML).join(''); for (let i = 0; i < s.length; i++) hsh = (hsh * 31 + s.charCodeAt(i)) | 0;
    return { hash: location.hash, dom: hsh + ':' + s.length, scrim: document.querySelectorAll('.scrim, [role=dialog], dialog[open]').length, toast: [...document.querySelectorAll('.toast')].map(t => t.innerText).join('|'), mut: window.__mut, snd: window.__snd, open: window.__open, clip: window.__clip || 0, y: Math.round(scrollY), focus: document.activeElement ? document.activeElement.outerHTML.slice(0, 80) : '', body: document.body.children.length, csp: window.__csp.length };
  }).catch(() => null);
  const ctlState = h => h.evaluate(e => [e.getAttribute('aria-expanded'), e.getAttribute('aria-selected'), e.getAttribute('aria-pressed'), e.getAttribute('aria-checked'), e.checked, e.open, e.closest('details') ? e.closest('details').open : null, e.value, e.className, e.getAttribute('style'), (e.textContent || '').slice(0, 60)].join('|')).catch(() => 'gone');

  const FINDER = () => {
    window.__crawlSEL = 'button, a[href], summary, select, input[type=checkbox], input[type=radio], [role=button], [role=tab], [role=switch], [role=menuitem], [role=checkbox], [role=link], [tabindex="0"][onclick]';
    window.__crawlVis = e => { const b = e.getBoundingClientRect(), s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[hidden], [aria-hidden="true"]') && !e.closest('details:not([open]) > :not(summary)') && parseFloat(s.opacity) > 0.01; }; /* Chromium gives a closed <details>' content a box */
    const txt = e => (e.innerText || '').trim() || (e.textContent || '').trim();
    window.__crawlName = e => {
      const l = e.getAttribute('aria-label'); if (l && l.trim()) return l.trim();
      const lb = e.getAttribute('aria-labelledby'); if (lb) { const t = lb.split(/\s+/).map(i => (document.getElementById(i) || {}).textContent || '').join(' ').trim(); if (t) return t; }
      if (e.labels && e.labels.length) { const t = [...e.labels].map(x => txt(x)).join(' ').trim(); if (t) return t; }
      if (e.tagName === 'SUMMARY' || e.tagName === 'BUTTON' || e.tagName === 'A' || e.getAttribute('role')) { const t = txt(e); if (t) return t; const im = e.querySelector('img[alt]'); if (im && im.alt) return im.alt; const st = e.querySelector('svg title'); if (st) return st.textContent.trim(); }
      if (e.title && e.title.trim()) return e.title.trim();
      if ((e.tagName === 'SELECT' || e.type === 'checkbox' || e.type === 'radio') && e.closest('label') && txt(e.closest('label'))) return txt(e.closest('label'));
      if (e.tagName === 'INPUT' && e.placeholder) return e.placeholder;
      return '';
    };
    window.__crawlKey = e => e.tagName.toLowerCase() + '|' + (window.__crawlName(e) || '').replace(/\s+/g, ' ').slice(0, 80);
    window.__crawlFind = (key, n) => { let c = 0; for (const e of document.querySelectorAll(window.__crawlSEL)) { if (!window.__crawlVis(e)) continue; if (window.__crawlKey(e) === key && ++c === n) return e; } return null; };
  };
  await page.addInitScript(FINDER); await page.evaluate(FINDER);

  const famSeen = {}, sigSeen = {};
  const familyOf = r => { const p = r.split('/'); return p[1] === 'learn' ? 'learn/' + (p[3] || '') : /^(py|dsa|sql|spark|test)$/.test(p[1]) ? 'code' : p[1] === 'practice' ? 'practice' : p.slice(1, 3).join('/'); };

  for (let ri = 0; ri < todo.length; ri++) {
    const route = todo[ri], t0 = Date.now(), fam = familyOf(route);
    ev.errs.length = 0;
    await full(route); await page.evaluate(FINDER).catch(() => {});
    if (ev.errs.length) ev.errs.splice(0).forEach(e => issue(route, /^csp/.test(e) ? 'csp' : 'error', 'on load: ' + e));
    /* page-level checks */
    const pg = await page.evaluate(() => {
      const over = document.documentElement.scrollWidth - innerWidth;
      const boxes = []; document.querySelectorAll('.card, .item, .chip, .lbl, .unit, h1, h2, h3, td, th, .btn, .tab, p').forEach(e => { const s = getComputedStyle(e); if (s.overflowX === 'visible' && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 2 && !e.closest('pre, .xterm, .tblwrap, .scroll, table, svg, .cm-editor, .rfeed')) boxes.push((e.innerText || e.className).replace(/\s+/g, ' ').slice(0, 50) + ' (' + (e.scrollWidth - e.clientWidth) + 'px)'); });
      return { title: (document.querySelector('.top .title b') || {}).textContent || '', over, boxes: boxes.slice(0, 5), csp: window.__csp.slice() };
    }).catch(() => ({ title: '', over: 0, boxes: [], csp: [] }));
    if (pg.title === 'Something went wrong') issue(route, 'error', 'error page on load');
    if (pg.over > 2) issue(route, 'overflow', 'page scrolls sideways by ' + pg.over + 'px');
    pg.boxes.forEach(b => issue(route, 'overflow', 'text wider than its box: ' + b));
    pg.csp.forEach(c => issue(route, 'csp', c));
    const ctls = await enumerate(route !== '#/today');
    const rr = { route, controls: ctls.length, clicked: 0, ms: 0 };
    R.routes.push(rr);
    /* per-control static checks: name, tap target, overflow */
    for (const c of ctls) {
      const sg = sigOf(c);
      if (!c.named) issue(route, 'name', 'control has no accessible name', c.tag + '.' + c.cls + (c.href ? ' ' + c.href : ''));
      if (c.over) issue(route, 'overflow', 'text overflows the control', c.label);
      if (iphone && !c.inline && !c.exempt && (c.w < 44 || c.h < 44) && !sigSeen['tap|' + sg]) {
        const h = await find(c.key, c.n); const el = h.asElement();
        if (el && !(await tapTarget(el))) issue(route, 'tap', `tap target ${c.w}x${c.h}px (under 44)`, c.label || c.tag);
        sigSeen['tap|' + sg] = 1;
      }
    }
    /* click every control once (the same control in the same kind of screen is clicked at most twice across routes) */
    const queue = ctls.map(c => ({ c, prefix: [] }));
    const seenKeys = new Set(ctls.map(c => c.key + '#' + c.n));
    let subStates = 0;
    const deadline = Date.now() + 8 * 60e3 * T; /* one screen never holds up the whole crawl */
    while (queue.length) { if (Date.now() > deadline) { issue(route, 'crawler', 'stopped after 8 minutes; ' + queue.length + ' controls not clicked'); break; } try {
      /* chapter text repeats the same kinds of control under every heading (reel, details, figure steps): in module
         tabs a kind of control is clicked three times in all, ignoring its label; elsewhere each label twice */
      const loose = fam.startsWith('learn/'), { c, prefix } = queue.shift(), sg = (loose ? 'learn' : fam) + '|' + sigOf(c, loose);
      sigSeen[sg] = (sigSeen[sg] || 0) + 1;
      if (sigSeen[sg] > (loose ? 3 : c.href && c.href.startsWith('#/') ? 1 : 2)) continue;
      if (DESTRUCTIVE.test(c.label)) { R.skipped.push({ route, label: c.label, why: 'destructive' }); continue; }
      if (c.disabled) { R.controls.push({ route, label: c.label, tag: c.tag, effect: 'disabled' }); continue; }
      if (c.target === '_blank' || (/^https?:/.test(c.href) && !c.href.startsWith(BASE))) { R.controls.push({ route, label: c.label, tag: c.tag, effect: 'external link (not opened)' }); continue; }
      await soft(route); await page.evaluate(FINDER).catch(() => {});
      await settle();
      for (const pk of prefix) { const ph = (await find(pk.key, pk.n)).asElement(); if (ph && !(await ph.evaluate(e => (e.tagName === 'SUMMARY' && e.parentElement.open) || e.getAttribute('aria-expanded') === 'true' || e.getAttribute('aria-selected') === 'true').catch(() => false))) { /* already open: a second tap would close it */ await ph.evaluate(e => e.scrollIntoView({ block: 'center' })).catch(() => {}); await ph.click({ timeout: 3000 * T }).catch(() => {}); await page.waitForTimeout(250 * T); } }
      const h = (await find(c.key, c.n)).asElement();
      if (!h) { R.controls.push({ route, label: c.label, tag: c.tag, effect: 'not found after restore' }); continue; }
      ev.errs.length = 0; const e0 = { dlg: ev.dlg, dl: ev.dl, fc: ev.fc, popup: ev.popup };
      const st0 = await ctlState(h);
      await page.waitForTimeout(200 * T);
      const b0 = await before(); if (!b0) continue;
      const mutBase = (await page.evaluate(() => window.__mut).catch(() => 0)) - b0.mut; /* animation noise over 200 ms */
      const b1 = await before();
      let clickErr = '';
      try {
        if (c.tag === 'select') { const vals = await h.evaluate(e => [...e.options].map(o => o.value)); const cur = await h.evaluate(e => e.value); await h.selectOption(vals.find(v => v !== cur) || cur, { timeout: 3000 * T }); }
        else { await h.evaluate(e => e.scrollIntoView({ block: 'center', inline: 'nearest' })); await h.click({ timeout: 3000 * T }).catch(async e => {
          /* the restored screen can differ from a fresh load: retry once from a full reload before calling it a bug */
          await full(route); await settle(); for (const pk of prefix) { const ph = (await find(pk.key, pk.n)).asElement(); if (ph && !(await ph.evaluate(x => (x.tagName === 'SUMMARY' && x.parentElement.open) || x.getAttribute('aria-expanded') === 'true' || x.getAttribute('aria-selected') === 'true'))) { await ph.click({ timeout: 3000 * T }).catch(() => {}); await page.waitForTimeout(300 * T); } }
          const h2 = (await find(c.key, c.n)).asElement(); if (!h2) throw e; await h2.evaluate(x => x.scrollIntoView({ block: 'center' })); await h2.click({ timeout: 3000 * T }); }); }
      } catch (e) { const by = (e.message.match(/<[^>]{0,80}> (?:from <[^>]{0,60}> subtree )?intercepts pointer events/) || [''])[0]; clickErr = (by ? 'covered: ' + by : e.message.split('\n')[0]).slice(0, 160); if (process.env.DEBUG) console.log(e.message.split('\n').slice(0, 12).join('\n')); }
      await page.waitForTimeout(450 * T);
      const a = await before();
      const st1 = a ? await ctlState(h) : 'gone';
      const fx = [];
      if (!a) fx.push('page reloaded');
      else {
        if (a.hash !== b1.hash) fx.push('route ' + a.hash);
        if (a.scrim > b1.scrim) fx.push('dialog');
        if (a.toast && a.toast !== b1.toast) fx.push('toast "' + a.toast.slice(0, 50) + '"');
        if (st1 !== st0) fx.push(st1 === 'gone' ? 'redrawn' : 'state');
        if (a.snd > b1.snd) fx.push('sound');
        if (a.open > b1.open || ev.popup > e0.popup) fx.push('popup');
        if (a.clip > b1.clip) fx.push('copied');
        if (ev.dl > e0.dl) fx.push('download');
        if (ev.fc > e0.fc) fx.push('file picker');
        if (ev.dlg > e0.dlg) { fx.push('native dialog'); issue(route, 'dialog', 'native browser dialog (blocked on iPhone home-screen apps)', c.label); }
        if (a.y !== b1.y && Math.abs(a.y - b1.y) > 20 && !fx.length) fx.push('scrolled');
        if (a.focus !== b1.focus && !/^<(button|a|summary|select|input)/i.test(a.focus) && !fx.length) fx.push('focus moved');
        if (!fx.length && (a.dom !== b1.dom || a.body !== b1.body) && (a.mut - b1.mut) > mutBase * 2) fx.push('content changed');
      }
      if (clickErr) issue(route, 'click', 'cannot click: ' + clickErr, c.label);
      else if (!fx.length && c.here) fx.push('already here');
      else if (!fx.length && /\|(true)\|/.test('|' + st0.split('|').slice(1, 4).join('|') + '|')) fx.push('already selected');
      if (!clickErr && !fx.length && a) { /* slow effects (a download after an image renders, a fetch): look again after a second */
        await page.waitForTimeout(1200 * T); const a2 = await before();
        if (ev.dl > e0.dl) fx.push('download'); else if (ev.popup > e0.popup || (a2 && a2.open > b1.open)) fx.push('popup');
        else if (a2 && (a2.hash !== b1.hash || a2.scrim > b1.scrim || (a2.toast && a2.toast !== b1.toast) || a2.dom !== a.dom)) fx.push('changed after a second');
      }
      if (!clickErr && !fx.length && c.term) fx.push('sent to the terminal (drawn on its canvas; see the terminal journeys)');
      if (!clickErr && !fx.length) issue(route, 'dead', 'nothing visible happened', c.label || c.tag);
      ev.errs.splice(0).forEach(e => issue(route, /^csp/.test(e) ? 'csp' : 'error', 'after click: ' + e, c.label));
      if (a) { const t = await page.evaluate(() => (document.querySelector('.top .title b') || {}).textContent).catch(() => ''); if (t === 'Something went wrong') issue(route, 'error', 'click leads to the error page', c.label); }
      R.controls.push({ route, label: c.label, tag: c.tag, effect: clickErr ? 'error' : fx.join(', ') || 'none', prefix: prefix.map(p => p.key.split('|')[1]).join(' › ') });
      rr.clicked++;
      if (process.env.DEBUG) console.log('   ', new Date().toTimeString().slice(0, 8), c.label.slice(0, 40), '→', R.controls[R.controls.length - 1].effect, clickErr);
      /* a tab or expander that revealed new controls: crawl those too (two levels deep) */
      if (a && c.tablike && prefix.length < 2 && subStates < 12 && a.hash === b1.hash) {
        const now = await enumerate(route !== '#/today');
        const fresh = now.filter(x => !seenKeys.has(x.key + '#' + x.n));
        if (fresh.length) { subStates++; fresh.forEach(x => { seenKeys.add(x.key + '#' + x.n); queue.push({ c: x, prefix: prefix.concat([{ key: c.key, n: c.n }]) }); });
          for (const x of fresh) { if (!x.named) issue(route, 'name', 'control has no accessible name', x.tag + '.' + x.cls + ' (after ' + c.label + ')'); if (iphone && !x.inline && !x.exempt && (x.w < 44 || x.h < 44) && !sigSeen['tap|' + sigOf(x)]) { sigSeen['tap|' + sigOf(x)] = 1; const hx = (await find(x.key, x.n)).asElement(); if (hx && !(await tapTarget(hx))) issue(route, 'tap', `tap target ${x.w}x${x.h}px (under 44)`, x.label || x.tag); } if (x.over) issue(route, 'overflow', 'text overflows the control', x.label); } }
    }
    } catch (e) { issue(route, 'crawler', 'crawler error (not the app): ' + e.message.split('\n')[0].slice(0, 120)); await full(route).catch(() => {}); } }
    rr.ms = Date.now() - t0;
    fs.writeFileSync(path.join(OUT, engine + '-' + state + (ONLY ? '-only' : '') + '.json'), JSON.stringify(R, null, 1)); /* partial results survive a stopped run */
    console.log(`[${engine}/${state}] ${ri + 1}/${todo.length} ${route}: ${ctls.length} controls, ${rr.clicked} clicked, ${Math.round(rr.ms / 1000)}s, issues so far ${R.issues.length}`);
  }

  /* regression checks for bugs this crawler found (each one names the bug it guards) */
  for (const [name, fn] of REGRESS) {
    try { await full('#/today'); const m = await fn(page, { iphone, engine, full, ready }); if (m) issue('regress', 'regress', name + ': ' + m); }
    catch (e) { issue('regress', 'regress', name + ': ' + e.message.split('\n')[0]); }
  }
  await ctx.close();
  return R;
}

/* fixed bugs: return a message when the bug is back */
const REGRESS = [
  ['Today\'s "This week" heading and the design round timer keep their text on one line on a phone (1.36.2)', async (p, o) => {
    if (!o.iphone) return; const out = [];
    for (const [h, t] of [['#/today', 'This week'], ['#/design', 'Round timer']]) {
      await o.full(h); await p.waitForTimeout(1500);
      const r = await p.evaluate(t => { const e = [...document.querySelectorAll('h2, .lbl')].find(x => x.textContent.trim() === t); const b = e && (e.closest('.grow') || e); return b ? b.scrollWidth - b.clientWidth : null; }, t);
      if (r === null) out.push(t + ' not found'); else if (r > 2) out.push(t + ' overflows by ' + r + 'px');
    }
    return out.join('; ');
  }],
  ['an empty Send in the coach panel puts the cursor in the message box (1.36.2)', async p => {
    await p.click('.coachfab, .fab, [aria-label*="coach" i]').catch(() => {}); await p.waitForTimeout(400);
    const b = p.locator('.coach button', { hasText: /^Send$/ }).first(); if (!(await b.count())) return 'no Send button in the coach panel';
    await b.click(); await p.waitForTimeout(200);
    return (await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label'))) === 'Message the coach' ? '' : 'focus did not move to the message box';
  }],
  ['every reel picture builds (written flows with steps or nodes instead of items crashed the player, 1.32.1)', async p => {
    const r = await p.evaluate(async () => { let n = 0; const bad = []; for (const m of MODS_ALL) for (const x of await reelsFor(m)) for (const b of x.beats || []) { if (!b.show) continue; n++; try { FX.build(b.show).stop(); } catch (e) { if (bad.length < 3) bad.push(x.id + ': ' + e.message); } } return { n, bad }; });
    return r.bad.length ? r.bad.join(' | ') : r.n < 100 ? 'only ' + r.n + ' pictures found' : '';
  }],
  ['the Sign in button shows its whole label on a phone (1.36.1)', async (p, o) => {
    if (!o.iphone) return; await o.full('#/quiz/s00');
    const r = await p.evaluate(() => { const b = document.querySelector('.authtop'); return b ? { sw: b.scrollWidth, cw: b.clientWidth } : null; });
    return r && r.sw > r.cw + 1 ? `label ${r.sw}px in a ${r.cw}px button` : '';
  }],
  ['the reel title is not hidden under the Shuffle filter row (1.36.1)', async (p, o) => {
    await p.evaluate(() => { S.settings.reelMode = 'shuffle'; save(); }); await o.full('#/reels'); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => { const f = document.querySelector('.rfilters'), fd = document.querySelector('.rfeed'), s = fd && [...document.querySelectorAll('.rslide')].find(x => Math.abs(x.getBoundingClientRect().top - fd.getBoundingClientRect().top) < 5), h = s && s.querySelector('.rhead'); const fb = f && f.querySelector('button'); return fb && h ? { f: fb.getBoundingClientRect().bottom, h: h.getBoundingClientRect().top } : null; /* the visible chips, not their tap padding */ });
    return !r ? 'no filter row or reel title found' : r.h < r.f - 1 ? `title starts at ${Math.round(r.h)}px, filters end at ${Math.round(r.f)}px` : '';
  }]
];

function dedupe(issues) { const m = new Map(); issues.forEach(i => { const k = i.kind + '|' + i.what + '|' + i.ctl; if (!m.has(k)) m.set(k, Object.assign({ routes: [] }, i)); const x = m.get(k); if (!x.routes.includes(i.route)) x.routes.push(i.route); }); return [...m.values()]; }
function report() {
  const runs = fs.readdirSync(OUT).filter(f => /^(chromium|webkit)-(fresh|mid)\.json$/.test(f)).map(f => JSON.parse(fs.readFileSync(path.join(OUT, f))));
  const esc = s => String(s || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  let md = '# Button crawl report\n\nWritten by `node tools/crawl.js BASE --report` (see the header of `tools/crawl.js`). Chromium = Mac 1440x900; WebKit = iPhone 13. Fresh = first run; mid = five weeks in with progress and a stub sync server.\n\n';
  md += '| Run | When | Screens | Controls found | Clicked | Skipped (destructive) | Issues |\n|---|---|---|---|---|---|---|\n';
  runs.forEach(r => { md += `| ${r.engine} / ${r.state} | ${r.at.slice(0, 16).replace('T', ' ')} | ${r.routes.length} | ${r.routes.reduce((a, x) => a + x.controls, 0)} | ${r.controls.length} | ${r.skipped.length} | ${dedupe(r.issues).length} |\n`; });
  const all = dedupe([].concat(...runs.map(r => r.issues.map(i => Object.assign({ run: r.engine + '/' + r.state }, i)))));
  md += '\n## Issues\n\n' + (all.length ? '| Kind | Control | What | Screens |\n|---|---|---|---|\n' + all.map(i => `| ${i.kind} | ${esc(i.ctl)} | ${esc(i.what)} | ${esc(i.routes.slice(0, 4).join(', ') + (i.routes.length > 4 ? ' +' + (i.routes.length - 4) : ''))} |`).join('\n') + '\n' : 'None.\n');
  const sk = new Map(); runs.forEach(r => r.skipped.forEach(s => { const k = s.label; sk.set(k, (sk.get(k) || new Set()).add(s.route)); }));
  md += '\n## Tap-target exceptions\n\nThe simulator canvas (`.simnode`, `.simedge`: boxes and wires scale with zoom, and the toolbar zooms in) and the 84-square DSA heat-map on Progress (`.dsa-grid`: an overview; every problem is also a full-size row in Practice) are not held to 44 px.\n';
  md += '\n## Skipped on purpose (destructive)\n\n' + (sk.size ? '| Control | Screens |\n|---|---|\n' + [...sk].map(([l, rs]) => `| ${esc(l)} | ${esc([...rs].slice(0, 5).join(', '))} |`).join('\n') + '\n' : 'None.\n');
  const fx = {}; runs.forEach(r => r.controls.forEach(c => { const k = c.effect.split(/[ ,"]/)[0] || 'none'; fx[k] = (fx[k] || 0) + 1; }));
  md += '\n## What clicks did\n\n| Effect | Clicks |\n|---|---|\n' + Object.entries(fx).sort((a, b) => b[1] - a[1]).map(([k, n]) => `| ${k} | ${n} |`).join('\n') + '\n';
  runs.forEach(r => { md += `\n## Screens: ${r.engine} / ${r.state}\n\n| Screen | Controls | Clicked | Seconds |\n|---|---|---|---|\n` + r.routes.map(x => `| ${esc(x.route)} | ${x.controls} | ${x.clicked} | ${Math.round(x.ms / 1000)} |`).join('\n') + '\n'; });
  const wf = path.join(OUT, 'WORKFLOWS.md'); if (fs.existsSync(wf)) md += '\n' + fs.readFileSync(wf, 'utf8');
  fs.writeFileSync(path.join(OUT, 'REPORT.md'), md);
  console.log('wrote', path.join(OUT, 'REPORT.md'));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  if (args.includes('--report') && args.length === 1) return report();
  let n = 0;
  for (const engine of ENGINES) {
    const browser = await pw[engine].launch();
    for (const state of STATES) {
      const R = await crawl(browser, engine, state);
      fs.writeFileSync(path.join(OUT, engine + '-' + state + (ONLY ? '-only' : '') + '.json'), JSON.stringify(R, null, 1));
      const d = dedupe(R.issues); n += d.length;
      d.forEach(i => console.log(`ISSUE [${engine}/${state}] ${i.kind} ${i.ctl ? '"' + i.ctl + '" ' : ''}${i.what} @ ${i.routes.slice(0, 3).join(', ')}`));
      console.log(`[${engine}/${state}] ${R.controls.length} clicks, ${R.skipped.length} skipped, ${d.length} issues`);
    }
    await browser.close();
  }
  if (args.includes('--report') || (ENGINES.length === 2 && STATES.length === 2 && !ONLY)) report();
  process.exit(n ? 1 : 0);
})();
