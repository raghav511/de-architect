/* Redesign 2026-11 (canvas: tools/redesign/README.md): one group of cases per screen, written before the screen is built.
   node tools/redesign_test.js [baseUrl] [group]   groups: today (more join as each screen is rebuilt)
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
  }),
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
