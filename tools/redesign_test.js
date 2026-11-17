/* Redesign 2026-11 (canvas: tools/redesign/README.md): one group of cases per screen, written before the screen is built.
   node tools/redesign_test.js [baseUrl] [group]   groups: today, path (more join as each screen is rebuilt)
   Runs on Chromium at iPhone size (390 x 844) and desktop size (1440 x 900). */
const { chromium } = require(process.env.PW || 'playwright');
const { blockExternal } = require('./testnet');
const BASE = (process.argv[2] && /^http/.test(process.argv[2])) ? process.argv[2] : 'http://localhost:8811/';
const GROUP = process.argv.slice(2).find(a => !/^http/.test(a)) || '';
const results = [];

async function page(b, vp) {
  const c = await b.newContext({ viewport: vp });
  await blockExternal(c); await c.route('http://127.0.0.1:8765/**', r => r.abort());
  const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  return p;
}
async function path(p) { await p.goto(BASE + '#/path'); await p.waitForSelector('main, #page', { timeout: 60000 }); await p.waitForTimeout(800); }
async function today(p) { await p.goto(BASE + '#/today'); await p.waitForSelector('.plan', { timeout: 60000 }); await p.waitForTimeout(600); }
function T(group, name, fn) { return { group, name, fn }; }

const CASES = [
  /* ---------- Today: the Focus home ---------- */
  T('today', 'T1 Up next is one hero card: "Up next · part", a title, minutes and XP, and a Start button on the first iPhone screen', async b => {
    const p = await page(b, { width: 390, height: 844 }); await today(p);
    const h = await p.evaluate(() => {
      const c = document.querySelector('.focushero'); if (!c) return { missing: true };
      const st = c.querySelector('.fh-start'), tb = document.querySelector('.tabbar'), r = st && st.getBoundingClientRect();
      return { kicker: (c.querySelector('.fh-kicker') || {}).textContent || '', title: (c.querySelector('.fh-title') || {}).textContent || '',
        meta: (c.querySelector('.fh-meta') || {}).textContent || '', href: st && st.getAttribute('href'),
        bottom: r ? r.bottom : 9999, limit: innerHeight - (tb ? tb.getBoundingClientRect().height : 0) };
    });
    if (h.missing) throw new Error('no .focushero on Today');
    if (!/^Up next · (Learn|Practice|Interview)/.test(h.kicker)) throw new Error('kicker: ' + h.kicker);
    if (!h.title.trim()) throw new Error('no title');
    if (!/\d+ min · \+\d+ XP/.test(h.meta)) throw new Error('meta: ' + h.meta);
    if (!h.href) throw new Error('Start has no link');
    if (h.bottom > h.limit) throw new Error('Start sits below the first screen: ' + Math.round(h.bottom) + ' > ' + Math.round(h.limit));
  }),
  T('today', 'T2 the hero wears the theme: a gradient from the colour theme, and it changes with the theme', async b => {
    const p = await page(b, { width: 390, height: 844 }); await today(p);
    const a = await p.evaluate(() => getComputedStyle(document.querySelector('.focushero')).backgroundImage);
    if (!/gradient/.test(a)) throw new Error('no gradient: ' + a);
    await p.evaluate(() => { S.settings.palette = 'sunset'; applyTheme(); });
    const c = await p.evaluate(() => getComputedStyle(document.querySelector('.focushero')).backgroundImage);
    if (c === a) throw new Error('the hero did not follow the colour theme');
  }),
  T('today', 'T3 the tick on the hero marks the item done and the hero moves on to the next item', async b => {
    const p = await page(b, { width: 390, height: 844 }); await today(p);
    const t0 = await p.textContent('.focushero .fh-title');
    await p.click('.focushero .fh-done'); await p.waitForTimeout(700);
    const t1 = await p.evaluate(() => { const t = document.querySelector('.focushero .fh-title'); return t ? t.textContent : ''; });
    if (t1 === t0) throw new Error('the hero still shows the item just ticked: ' + t0);
    const n = await p.evaluate(() => daySet(iso(new Date())).filter(x => x.done).length);
    if (n < 1) throw new Error('nothing was marked done');
  }),
  T('today', 'T4 each part tab is a bar: one segment per item, filled for each one done, and "n of m done"', async b => {
    const p = await page(b, { width: 390, height: 844 }); await today(p);
    await p.click('.focushero .fh-done'); await p.waitForTimeout(700);
    const tabs = await p.evaluate(() => [...document.querySelectorAll('.plan .daysum .dsum')].map(t => ({ segs: t.querySelectorAll('.segs i').length, on: t.querySelectorAll('.segs i.on').length, txt: (t.querySelector('.dsum-n') || {}).textContent || '', id: t.id })));
    const want = await p.evaluate(() => { const xs = daySet(iso(new Date())), m = { learn: 'tab-grp-hour', practice: 'tab-grp-coding', interview: 'tab-grp-interview' }, o = {};
      xs.forEach(x => { const k = m[x.tab]; o[k] = o[k] || [0, 0]; o[k][0]++; if (x.done) o[k][1]++; }); return o; });
    if (!tabs.length) throw new Error('no part tabs');
    for (const t of tabs) { const w = want[t.id] || [0, 0];
      if (t.segs !== w[0] || t.on !== w[1]) throw new Error(t.id + ': ' + t.on + '/' + t.segs + ' segments, want ' + w[1] + '/' + w[0]);
      if (t.txt !== w[1] + ' of ' + w[0] + ' done') throw new Error(t.id + ' says "' + t.txt + '"'); }
  }),
  T('today', 'T5 Start on the hero opens the item, and the level chip opens Progress', async b => {
    const p = await page(b, { width: 390, height: 844 }); await today(p);
    if (!await p.$('.greet a.gmini[href="#/progress"]')) throw new Error('the level chip does not link to Progress');
    await p.click('.focushero .fh-start'); await p.waitForTimeout(800);
    const h = await p.evaluate(() => location.hash);
    if (/^#\/today/.test(h) || !h) throw new Error('Start stayed on Today: ' + h);
  }),
  T('today', 'T6 desktop: the hero and the module card share the first row, and nothing on Today errors', async b => {
    const p = await page(b, { width: 1440, height: 900 }); await today(p);
    const r = await p.evaluate(() => { const h = document.querySelector('.focushero'), m = document.querySelector('.todaymod'); if (!h || !m) return null;
      const a = h.getBoundingClientRect(), c = m.getBoundingClientRect(); return { sameRow: Math.abs(a.top - c.top) < 4 && c.left > a.left, hTop: a.top }; });
    if (!r) throw new Error('missing .focushero or .todaymod');
    if (!r.sameRow) throw new Error('the module card is not beside the hero');
    if (p.errs.length) throw new Error('page errors: ' + p.errs.join(' | '));
  }),,
/* ---------- Path: the whole course in seven stages ---------- */
  T('path', 'P1 You are here: the current module, its steps done, and Continue to the next step on the first iPhone screen', async b => {
    const p = await page(b, { width: 390, height: 844 }); await path(p);
    const h = await p.evaluate(() => { const c = document.querySelector('.pathhero'); if (!c) return null; const sc = schedule(), nx = sc.units.find(u => u.mid === sc.cur && !u.isDone), go = c.querySelector('.ph-go'), r = go && go.getBoundingClientRect(), tb = document.querySelector('.tabbar');
      return { title: (c.querySelector('.ph-title') || {}).textContent, want: modTitle(sc.cur), steps: (c.querySelector('.ph-steps') || {}).textContent || '', href: go && go.getAttribute('href'), next: nx && nx.href, bottom: r ? r.bottom : 9999, limit: innerHeight - (tb ? tb.getBoundingClientRect().height : 0) }; });
    if (!h) throw new Error('no .pathhero');
    if (h.title !== h.want) throw new Error('hero shows "' + h.title + '", want "' + h.want + '"');
    if (!/^\d+ of \d+ steps$/.test(h.steps)) throw new Error('steps: ' + h.steps);
    if (h.href !== h.next) throw new Error('Continue goes to ' + h.href + ', want ' + h.next);
    if (h.bottom > h.limit) throw new Error('Continue is below the first screen');
  }),
  T('path', 'P2 seven stages (and the Claude Code track beside them) hold every module once, and the stage with the current module is open and marked Now', async b => {
    const p = await page(b, { width: 390, height: 844 }); await path(p);
    const r = await p.evaluate(() => ({ stages: document.querySelectorAll('.stage').length, rows: [...document.querySelectorAll('.stage .prow')].map(a => a.dataset.mid), mods: MODS.slice(), cur: schedule().cur,
      now: [...document.querySelectorAll('.stage.now')].map(s => ({ open: s.querySelector('.stage-h').getAttribute('aria-expanded'), has: !!s.querySelector('.prow[data-mid="' + schedule().cur + '"]'), tag: /Now/.test(s.querySelector('.stage-h').textContent) })) }));
    if (r.stages !== 7 + (r.mods.some(m => /^c/.test(m)) ? 1 : 0)) throw new Error(r.stages + ' stages, want 7 and the Claude Code track');
    const miss = r.mods.filter(m => r.rows.filter(x => x === m).length !== 1);
    if (miss.length) throw new Error('modules not listed exactly once: ' + miss.join(', '));
    if (r.now.length !== 1 || r.now[0].open !== 'true' || !r.now[0].has || !r.now[0].tag) throw new Error('current stage: ' + JSON.stringify(r.now));
  }),
  T('path', 'P3 a finished stage folds to one line that says Done, and opens again on a tap', async b => {
    const p = await page(b, { width: 390, height: 844 }); await path(p);
    await p.evaluate(() => { const d = iso(new Date()), st = document.querySelector('.stage'), ms = [...st.querySelectorAll('.prow')].map(a => a.dataset.mid); schedule().units.filter(u => ms.includes(u.mid)).forEach(u => { S.done[u.uid] = d; }); save(); route(); });
    await p.waitForTimeout(600);
    const a = await p.evaluate(() => { const st = document.querySelector('.stage'), h = st.querySelector('.stage-h'), body = st.querySelector('.stage-b'); return { exp: h.getAttribute('aria-expanded'), done: /Done/.test(h.textContent), hidden: !body || body.hidden }; });
    if (a.exp !== 'false' || !a.done || !a.hidden) throw new Error('finished stage: ' + JSON.stringify(a));
    await p.click('.stage .stage-h'); await p.waitForTimeout(200);
    const o = await p.evaluate(() => { const st = document.querySelector('.stage'); return st.querySelector('.stage-h').getAttribute('aria-expanded') === 'true' && !st.querySelector('.stage-b').hidden; });
    if (!o) throw new Error('a tap did not open the finished stage');
  }),
  T('path', 'P4 track chips filter the modules, and All shows them all again', async b => {
    const p = await page(b, { width: 390, height: 844 }); await path(p);
    await p.click('.trackchips button[data-track="python"]'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const vis = [...document.querySelectorAll('.stage .prow')].filter(a => !a.hidden).map(a => a.dataset.mid);
      return { vis, want: MODS.filter(m => trackOf(m) === 'python'), pressed: document.querySelector('.trackchips button[data-track="python"]').getAttribute('aria-pressed') }; });
    if (r.pressed !== 'true') throw new Error('Python chip not pressed');
    if (r.vis.join() !== r.want.join()) throw new Error('Python shows ' + r.vis.join() + ', want ' + r.want.join());
    await p.click('.trackchips button[data-track="all"]'); await p.waitForTimeout(300);
    const n = await p.evaluate(() => [...document.querySelectorAll('.stage .prow')].filter(a => !a.hidden).length === MODS.length);
    if (!n) throw new Error('All did not bring every module back');
  }),
  T('path', 'P5 a module row opens that module, and desktop Path has no page errors', async b => {
    const p = await page(b, { width: 1440, height: 900 }); await path(p);
    const mid = await p.evaluate(() => { const a = document.querySelector('.stage.now .prow'); return a && a.dataset.mid; });
    if (!mid) throw new Error('no module rows');
    await p.click('.stage.now .prow[data-mid="' + mid + '"]'); await p.waitForTimeout(600);
    const h = await p.evaluate(() => location.hash);
    if (h !== '#/path/' + mid) throw new Error('row opened ' + h);
    if (p.errs.length) throw new Error('page errors: ' + p.errs.join(' | '));
  })
];

(async () => {
  const b = await chromium.launch();
  for (const c of CASES.filter(c => !GROUP || c.group === GROUP)) {
    const t = Date.now();
    try { await c.fn(b); results.push(['PASS', c.name, '']); } catch (e) { results.push(['FAIL', c.name, e.message.split('\n')[0]]); }
    results[results.length - 1].push(Math.round((Date.now() - t) / 1000));
  }
  await b.close();
  for (const [s, n, m, t] of results) console.log(s.padEnd(5), n, '(' + t + ' s)' + (m ? '\n      ' + m : ''));
  const f = results.filter(r => r[0] === 'FAIL').length;
  console.log((results.length - f) + ' passed, ' + f + ' failed');
  process.exit(f ? 1 : 0);
})();
