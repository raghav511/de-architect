/* Redesign 2026-11 (canvas: tools/redesign/README.md): one group of cases per screen, written before the screen is built.
   node tools/redesign_test.js [baseUrl] [group]   groups: today, path, practice, interview, module, quiz, live, progress (more join as each screen is rebuilt)
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
async function practice(p) { await p.goto(BASE + '#/practice'); await p.waitForSelector('#page h1, .tabs', { timeout: 60000 }); await p.waitForTimeout(900); }
async function ihub(p) { await p.goto(BASE + '#/interview'); await p.waitForSelector('#page h1, #page h2', { timeout: 60000 }); await p.waitForTimeout(900); }
async function learn(p, path) { await p.goto(BASE + '#/today'); await p.waitForFunction(() => typeof MOD !== 'undefined' && MOD.s05 && DATA.sprints && DATA.sprints.s05, null, { timeout: 60000 }); await p.goto(BASE + '#/learn/' + path); await p.waitForSelector('.modhead, #page h1', { timeout: 60000 }); await p.waitForTimeout(1500); }
async function quiz(p) { await p.goto(BASE + '#/quiz/s05'); await p.waitForSelector('.opt, .qtop', { timeout: 60000 }); await p.waitForTimeout(900); }
async function live(p) { await p.addInitScript(() => { window.macCall = async () => ({ text: '{}' }); }); await p.goto(BASE + '#/live'); await p.waitForSelector('#page .card, #page section', { timeout: 60000 }); await p.waitForTimeout(1500); }
async function prog(p) { await p.goto(BASE + '#/progress'); await p.waitForSelector('#page section', { timeout: 60000 }); await p.waitForTimeout(1000); }
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
  }),
  /* ---------- Practice: the ladder, reviews, four banks, build and design ---------- */
  T('practice', 'PR1 Practice opens on the next unsolved ladder problem with Start on the first iPhone screen', async b => {
    const p = await page(b, { width: 390, height: 844 }); await practice(p);
    const h = await p.evaluate(() => { const c = document.querySelector('.ladderhero'); if (!c) return null;
      let nx = null; for (let i = 0; i < 168 && !nx; i++) nx = dayProblems(i).find(x => !x.auto) || null;
      const go = c.querySelector('.lh-start'), r = go && go.getBoundingClientRect(), tb = document.querySelector('.tabbar');
      return { kicker: (c.querySelector('.lh-kicker') || {}).textContent || '', title: (c.querySelector('.lh-title') || {}).textContent, want: nx && nx.t, href: go && go.getAttribute('href'), wantHref: nx && nx.href, bottom: r ? r.bottom : 9999, limit: innerHeight - (tb ? tb.getBoundingClientRect().height : 0) }; });
    if (!h) throw new Error('no .ladderhero');
    if (!/Next on the ladder/i.test(h.kicker)) throw new Error('kicker: ' + h.kicker);
    if (h.title !== h.want || h.href !== h.wantHref) throw new Error('ladder hero shows ' + h.title + ' ' + h.href + ', want ' + h.want + ' ' + h.wantHref);
    if (h.bottom > h.limit) throw new Error('Start is below the first screen');
  }),
  T('practice', 'PR2 reviews due today are listed under the ladder, each opening its review; none due says so', async b => {
    const p = await page(b, { width: 390, height: 844 }); await practice(p);
    const none = await p.evaluate(() => ({ n: document.querySelectorAll('.revdue a.revrow').length, txt: (document.querySelector('.revdue') || {}).textContent || '' }));
    if (none.n !== 0 || !/Nothing due/i.test(none.txt)) throw new Error('with nothing due: ' + JSON.stringify(none));
    const id = await p.evaluate(() => { const x = DATA.dsa[0]; S.rev = S.rev || {}; S.rev[x.id] = { box: 0, due: iso(new Date()) }; save(); route(); return x.id; });
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => ({ rows: [...document.querySelectorAll('.revdue a.revrow')].map(a => a.getAttribute('href')), head: (document.querySelector('.revdue h2') || {}).textContent || '' }));
    if (r.rows.length !== 1 || r.rows[0] !== '#/dsa/' + id + '/review') throw new Error('due rows: ' + JSON.stringify(r.rows));
    if (!/Reviews due · 1/.test(r.head)) throw new Error('heading: ' + r.head);
  }),
  T('practice', 'PR3 four bank tiles show solved of total from the banks, an easy/medium/hard mix, and open their lists', async b => {
    const p = await page(b, { width: 390, height: 844 }); await practice(p);
    const t = await p.evaluate(() => [...document.querySelectorAll('.banktile')].map(a => ({ bank: a.dataset.bank, href: a.getAttribute('href'), n: (a.querySelector('.bt-n') || {}).textContent || '', mix: a.querySelectorAll('.mix i').length,
      want: DATA[a.dataset.bank] ? DATA[a.dataset.bank].filter(x => S.solved[x.id]).length + ' / ' + DATA[a.dataset.bank].length : '?' })));
    if (t.map(x => x.bank).join() !== 'dsa,py,sql,spark') throw new Error('tiles: ' + t.map(x => x.bank).join());
    for (const x of t) { if (x.n !== x.want) throw new Error(x.bank + ' says ' + x.n + ', want ' + x.want); if (x.href !== '#/practice/' + x.bank) throw new Error(x.bank + ' opens ' + x.href); if (x.mix !== 3) throw new Error(x.bank + ' mix has ' + x.mix + ' parts'); }
  }),
  T('practice', 'PR4 solving the ladder problem moves the hero on and counts on its tile', async b => {
    const p = await page(b, { width: 390, height: 844 }); await practice(p);
    const a = await p.evaluate(() => ({ t: document.querySelector('.ladderhero .lh-title').textContent, n: document.querySelector('.banktile[data-bank=dsa] .bt-n').textContent }));
    await p.evaluate(() => { let nx = null; for (let i = 0; i < 168 && !nx; i++) nx = dayProblems(i).find(x => !x.auto) || null; S.solved[nx.id] = Date.now(); save(); route(); });
    await p.waitForTimeout(500);
    const c = await p.evaluate(() => ({ t: document.querySelector('.ladderhero .lh-title').textContent, all: [...document.querySelectorAll('.banktile .bt-n')].map(e => e.textContent).join() }));
    if (c.t === a.t) throw new Error('the hero still shows the solved problem');
    if (!/^1 \//.test(c.all.split(',').find(x => /^1 \//.test(x)) || '')) throw new Error('no tile counted the solve: ' + c.all);
  }),
  T('practice', 'PR5 Build and design links the simulator, design problems, projects, Git labs and the terminal', async b => {
    const p = await page(b, { width: 390, height: 844 }); await practice(p);
    const hs = await p.evaluate(() => [...document.querySelectorAll('.buildlinks a')].map(a => a.getAttribute('href')));
    for (const h of ['#/sim', '#/design', '#/projects', '#/git', '#/terminal']) if (!hs.some(x => x === h || x.startsWith(h + '/'))) throw new Error('missing ' + h + ' in ' + hs.join());
  }),
  T('practice', 'PR6 a bank list still opens with its filters and a way back to Practice; desktop has no page errors', async b => {
    const p = await page(b, { width: 1440, height: 900 }); await p.goto(BASE + '#/practice/sql'); await p.waitForSelector('.tabs', { timeout: 60000 }); await p.waitForTimeout(600);
    const r = await p.evaluate(() => ({ items: document.querySelectorAll('a.item').length, back: !!document.querySelector('.tabs [role=tab][data-f=home]') }));
    if (!r.items) throw new Error('the SQL list is empty');
    if (!r.back) throw new Error('no Practice tab back to the hub');
    await p.click('.tabs [data-f=home]'); await p.waitForTimeout(600);
    if (!await p.$('.ladderhero')) throw new Error('the Practice tab did not open the hub');
    if (p.errs.length) throw new Error('page errors: ' + p.errs.join(' | '));
  }),
  /* ---------- Interview: today's mock, the ladder and the loop ---------- */
  T('interview', 'I1 the Interview tab opens the hub, with today\'s live mock and Start on the first iPhone screen', async b => {
    const p = await page(b, { width: 390, height: 844 }); await today(p);
    const tab = await p.evaluate(() => { const a = [...document.querySelectorAll('.tabbar a')].find(x => /Interview/.test(x.textContent)); return a && a.getAttribute('href'); });
    if (tab !== '#/interview') throw new Error('the Interview tab opens ' + tab);
    await ihub(p);
    const h = await p.evaluate(() => { const c = document.querySelector('.livehero'); if (!c) return null; const go = c.querySelector('.lv-start'), r = go && go.getBoundingClientRect(), tb = document.querySelector('.tabbar'), k = iso(new Date()), m = liveMode(k);
      return { kicker: (c.querySelector('.lv-kicker') || {}).textContent || '', mode: (c.querySelector('.lv-mode') || {}).textContent || '', want: m === 'boss' ? /7 questions/ : m === 'full' ? /5 questions/ : /1 question/, href: go && go.getAttribute('href'), k, bottom: r ? r.bottom : 9999, limit: innerHeight - (tb ? tb.getBoundingClientRect().height : 0) }; });
    if (!h) throw new Error('no .livehero');
    if (!/Today's live mock/.test(h.kicker)) throw new Error('kicker: ' + h.kicker);
    if (!/question/.test(h.mode)) throw new Error('mode line: ' + h.mode);
    if (h.href !== '#/live/' + h.k) throw new Error('Start opens ' + h.href);
    if (h.bottom > h.limit) throw new Error('Start is below the first screen');
  }),
  T('interview', 'I2 the week strip shows Monday to Sunday with today marked, the full mock on Saturday and the boss round on Sunday', async b => {
    const p = await page(b, { width: 390, height: 844 }); await ihub(p);
    const w = await p.evaluate(() => [...document.querySelectorAll('.wkmock .wd')].map(d => ({ n: (d.querySelector('b') || {}).textContent, v: (d.querySelector('span') || {}).textContent, today: d.classList.contains('today') })));
    if (w.length !== 7 || w[0].n !== 'Mon' || w[6].n !== 'Sun') throw new Error('days: ' + w.map(d => d.n).join());
    if (w.filter(d => d.today).length !== 1) throw new Error('today is not marked once');
    const sat = w[5], sun = w[6];
    if (!sat.today && sat.v !== '5 q') throw new Error('Saturday says ' + sat.v);
    if (!sun.today && sun.v !== 'Boss') throw new Error('Sunday says ' + sun.v);
  }),
  T('interview', 'I3 the ladder card names your level and the next, with XP and what promotion needs', async b => {
    const p = await page(b, { width: 390, height: 844 }); await ihub(p);
    const r = await p.evaluate(() => { const c = document.querySelector('.laddercard'); if (!c) return null; const L = gameLevel(gameXP()), nx = LADDER[Math.min(L.i + 1, LADDER.length - 1)];
      return { txt: c.textContent, cur: LADDER[L.i][0], next: nx[0], xp: gameXP(), need: nx[1] }; });
    if (!r) throw new Error('no .laddercard');
    if (!r.txt.includes(r.cur) || !r.txt.includes(r.next)) throw new Error('ladder: ' + r.txt.slice(0, 120));
    if (!r.txt.includes(r.xp.toLocaleString('en-US') + ' / ' + r.need.toLocaleString('en-US') + ' XP')) throw new Error('no XP line in ' + r.txt.slice(0, 160));
  }),
  T('interview', 'I4 the loop lists nine rounds with readiness from real work, each opening its round', async b => {
    const p = await page(b, { width: 390, height: 844 }); await ihub(p); await p.waitForSelector('.lround', { timeout: 30000 });
    const r = await p.evaluate(async () => { const D = await loopData(), rd = loopReady(D); return [...document.querySelectorAll('.lround')].map(a => ({ href: a.getAttribute('href'), pct: (a.querySelector('.lr-pct') || {}).textContent, want: rd[a.dataset.r] + '%' })); });
    if (r.length !== 9) throw new Error(r.length + ' rounds');
    for (const x of r) { if (!/^#\/loop\/r[1-9]$/.test(x.href)) throw new Error('round opens ' + x.href); if (x.pct !== x.want) throw new Error(x.href + ' says ' + x.pct + ', want ' + x.want); }
  }),
  T('interview', 'I5 a company chip shows that company\'s loop in its order, and All rounds brings the nine back', async b => {
    const p = await page(b, { width: 390, height: 844 }); await ihub(p); await p.waitForSelector('.cochips button', { timeout: 30000 });
    const co = await p.evaluate(async () => (await loopData()).companies[0]);
    await p.click('.cochips button[data-co="' + co[0] + '"]'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({ ids: [...document.querySelectorAll('.lround')].map(a => a.dataset.r), pressed: document.querySelector('.cochips button[aria-pressed=true]').dataset.co }));
    if (r.ids.join() !== co[2].join() || r.pressed !== co[0]) throw new Error(co[0] + ' shows ' + r.ids.join() + ', want ' + co[2].join());
    await p.click('.cochips button[data-co=all]'); await p.waitForTimeout(300);
    if (await p.$$eval('.lround', a => a.length) !== 9) throw new Error('All rounds did not bring nine back');
  }),
  T('interview', 'I6 the hub links recall, asked this week and the coach; module interview sets still open; desktop has no errors', async b => {
    const p = await page(b, { width: 1440, height: 900 }); await ihub(p);
    const hs = await p.evaluate(() => [...document.querySelectorAll('.alsotoday a')].map(a => a.getAttribute('href')));
    for (const h of ['#/recall', '#/recent', '#/coach']) if (!hs.includes(h)) throw new Error('missing ' + h + ' in ' + hs.join());
    await p.goto(BASE + '#/interview/s05'); await p.waitForTimeout(1500);
    if (!/Interview set/.test(await p.textContent('body'))) throw new Error('the module interview set no longer opens');
    if (p.errs.length) throw new Error('page errors: ' + p.errs.join(' | '));
  }),
  /* ---------- Module page: header, one row of tabs, Continue always on screen ---------- */
  T('module', 'M1 a module page opens with its header: label, title, the Meridian line and steps done', async b => {
    const p = await page(b, { width: 390, height: 844 }); await learn(p, 's05');
    const h = await p.evaluate(() => { const c = document.querySelector('.modhead'); if (!c) return null; const sp = schedule().span.s05;
      return { title: (c.querySelector('.mh-title') || {}).textContent, want: modTitle('s05'), chip: (c.querySelector('.chip') || {}).textContent || '', steps: (c.querySelector('.mh-steps') || {}).textContent || '', wantSteps: sp.done + ' of ' + sp.n + ' steps' }; });
    if (!h) throw new Error('no .modhead');
    if (h.title !== h.want) throw new Error('title ' + h.title);
    if (!/Module 5/.test(h.chip) && !/5/.test(h.chip)) throw new Error('chip ' + h.chip);
    if (h.steps !== h.wantSteps) throw new Error('steps "' + h.steps + '", want "' + h.wantSteps + '"');
  }),
  T('module', 'M2 one row of tabs: Read, Readings, Labs, Warm-ups, Quiz and Interview, the current one marked', async b => {
    const p = await page(b, { width: 390, height: 844 }); await learn(p, 's05/readings');
    const t = await p.evaluate(() => [...document.querySelectorAll('.modtabs a')].map(a => ({ n: a.textContent.trim(), href: a.getAttribute('href'), cur: a.getAttribute('aria-current') })));
    const names = t.map(x => x.n.replace(/\s.*$/, ''));
    for (const n of ['Read', 'Readings', 'Labs', 'Warm-ups', 'Quiz', 'Interview']) if (!names.includes(n)) throw new Error('missing tab ' + n + ' in ' + names.join());
    const q = t.find(x => /^Quiz/.test(x.n)), iv = t.find(x => /^Interview/.test(x.n)), cur = t.filter(x => x.cur === 'page');
    if (q.href !== '#/quiz/s05' || iv.href !== '#/interview/s05') throw new Error('quiz ' + q.href + ' interview ' + iv.href);
    if (cur.length !== 1 || !/^Readings/.test(cur[0].n)) throw new Error('current tab: ' + JSON.stringify(cur));
  }),
  T('module', 'M3 Continue is always on screen and opens the module\'s next open step', async b => {
    const p = await page(b, { width: 390, height: 844 }); await learn(p, 's05');
    await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(300);
    const c = await p.evaluate(() => { const a = document.querySelector('.modcta a'); if (!a) return null; const r = a.getBoundingClientRect(), nx = schedule().units.find(u => u.mid === 's05' && !u.isDone);
      return { href: a.getAttribute('href'), want: nx ? nx.href : '#/quiz/s05', vis: r.top >= 0 && r.bottom <= innerHeight, txt: a.textContent }; });
    if (!c) throw new Error('no Continue bar');
    if (c.href !== c.want) throw new Error('Continue opens ' + c.href + ', want ' + c.want);
    if (!c.vis) throw new Error('Continue is off screen after scrolling');
  }),
  T('module', 'M4 when every step is done, Continue says Take the quiz; the desktop page has no errors', async b => {
    const p = await page(b, { width: 1440, height: 900 }); await learn(p, 's05');
    await p.evaluate(() => { const d = iso(new Date()); schedule().units.filter(u => u.mid === 's05').forEach(u => { S.done[u.uid] = d; }); save(); route(); }); await p.waitForTimeout(800);
    const c = await p.evaluate(() => { const a = document.querySelector('.modcta a'); return a && { href: a.getAttribute('href'), txt: a.textContent }; });
    if (!c || c.href !== '#/quiz/s05' || !/quiz/i.test(c.txt)) throw new Error('Continue: ' + JSON.stringify(c));
    if (p.errs.length) throw new Error('page errors: ' + p.errs.join(' | '));
  }),
  /* ---------- Quiz: one question at a time, a flag to revisit, results that lead with the score and the misses ---------- */
  T('quiz', 'Q1 a strip shows one segment per question: the current one marked, answered ones filled', async b => {
    const p = await page(b, { width: 390, height: 844 }); await quiz(p);
    await p.click('.opt'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const qs = DATA.sprints.s05.quiz; return { n: qs.length, segs: document.querySelectorAll('.qsegs i').length, cur: document.querySelectorAll('.qsegs i.cur').length, ans: document.querySelectorAll('.qsegs i.ans').length }; });
    if (r.segs !== r.n) throw new Error(r.segs + ' segments for ' + r.n + ' questions');
    if (r.cur !== 1 || r.ans < 1) throw new Error('current ' + r.cur + ', answered ' + r.ans);
  }),
  T('quiz', 'Q2 Revisit later flags a question, is kept, and shows on the question picker', async b => {
    const p = await page(b, { width: 390, height: 844 }); await quiz(p);
    await p.click('.qflag'); await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({ pressed: document.querySelector('.qflag').getAttribute('aria-pressed'), kept: !!((S.quiz[qk('s05')].flag || {})[S.quiz[qk('s05')].i]) }));
    if (r.pressed !== 'true' || !r.kept) throw new Error('flag: ' + JSON.stringify(r));
    await p.click('.qpos'); await p.waitForTimeout(300);
    if (!await p.$('.qsheet .pal button.flag')) throw new Error('the picker does not show the flag');
  }),
  T('quiz', 'Q3 on a phone the picker opens from "n / total" as a sheet, and a number jumps to that question', async b => {
    const p = await page(b, { width: 390, height: 844 }); await quiz(p);
    const pos = await p.textContent('.qpos');
    if (!/^1 \/ \d+$/.test(pos.trim())) throw new Error('position button says ' + pos);
    await p.click('.qpos'); await p.waitForTimeout(300);
    if (!await p.$('.qsheet[role=dialog]')) throw new Error('no picker sheet');
    await p.click('.qsheet .pal button:nth-child(3)'); await p.waitForTimeout(300);
    if ((await p.textContent('.qpos')).trim().split(' ')[0] !== '3') throw new Error('did not jump to question 3');
    if (await p.$('.qsheet')) throw new Error('the sheet stayed open');
  }),
  T('quiz', 'Q4 results lead with a score ring, then only the misses with your answer, the right one and why, going to recall', async b => {
    const p = await page(b, { width: 390, height: 844 }); await quiz(p);
    await p.evaluate(() => { const w = qk('s05'), qs = DATA.sprints.s05.quiz, st = S.quiz[w]; qs.forEach((q, k) => { if (q.TYPE === 'mcq') st.a[k] = k === 0 ? q.opts.find(o => o[0] !== q.ANS)[0] : q.ANS; }); st.sub = true; save(); route(); });
    await p.waitForTimeout(800);
    const r = await p.evaluate(() => ({ ring: (document.querySelector('.qscore') || {}).textContent || '', miss: [...document.querySelectorAll('.qmiss .qm')].map(m => ({ y: !!m.querySelector('.yours'), r: !!m.querySelector('.right') })), recall: /recall/i.test((document.querySelector('.qmiss') || {}).textContent || ''), retake: !!document.querySelector('.qretake') }));
    if (!/\d+\s*\/\s*\d+/.test(r.ring)) throw new Error('score ring: ' + r.ring);
    if (r.miss.length < 1 || !r.miss.every(m => m.y && m.r)) throw new Error('misses: ' + JSON.stringify(r.miss));
    if (!r.recall || !r.retake) throw new Error('recall note ' + r.recall + ', retake ' + r.retake);
    if (p.errs.length) throw new Error('page errors: ' + p.errs.join(' | '));
  }),
  /* ---------- Live mock: a start screen that says who asks and how it is scored, step dots, a scorecard that leads with the average ---------- */
  T('live', 'L1 the start screen is a hero: today\'s live mock, Start on the first iPhone screen, and how it is scored', async b => {
    const p = await page(b, { width: 390, height: 844 }); await live(p);
    const h = await p.evaluate(() => { const c = document.querySelector('.livestart'); if (!c) return null; const go = c.querySelector('.ls-start'), r = go && go.getBoundingClientRect(), tb = document.querySelector('.tabbar');
      return { kicker: (c.querySelector('.ls-kicker') || {}).textContent || '', bottom: r ? r.bottom : 9999, limit: innerHeight - (tb ? tb.getBoundingClientRect().height : 0), how: (document.querySelector('.lhow') || {}).textContent || '' }; });
    if (!h) throw new Error('no .livestart');
    if (!/live mock/i.test(h.kicker)) throw new Error('kicker ' + h.kicker);
    if (h.bottom > h.limit) throw new Error('Start is below the first screen');
    for (const w of ['Correct', 'Depth', 'Trade-offs', 'Clear', 'rejected']) if (!h.how.includes(w)) throw new Error('how it is scored misses ' + w + ': ' + h.how);
  }),
  T('live', 'L2 after Start, step dots show one per question plus the scorecard, the first one current', async b => {
    const p = await page(b, { width: 390, height: 844 }); await live(p);
    await p.click('.ls-start'); await p.waitForTimeout(800);
    const r = await p.evaluate(() => { const m = S.live[iso(new Date())]; return { n: m.qs.length + 1, dots: document.querySelectorAll('.lsteps i').length, cur: [...document.querySelectorAll('.lsteps i')].findIndex(i => i.classList.contains('cur')) }; });
    if (r.dots !== r.n) throw new Error(r.dots + ' dots, want ' + r.n);
    if (r.cur !== 0) throw new Error('current dot ' + r.cur);
  }),
  T('live', 'L3 the scorecard leads with the average of 4 and the level, and says AI can be wrong', async b => {
    const p = await page(b, { width: 390, height: 844 }); await live(p);
    const want = await p.evaluate(() => { const m = S.live[iso(new Date())]; m.qs.forEach((q, i) => { m.ans[i] = { sc: { correct: 4, depth: 3, trade: 3, clear: 3 }, fb: 'Name the limit.', by: 'ai', checks: { rejected: true } }; }); m.i = m.qs.length; m.done = true; save(); route();
      const av = m.qs.map((q, i) => liveAvg(m.ans[i])); return (av.reduce((a, b) => a + b, 0) / av.length).toFixed(1); });
    await p.waitForTimeout(800);
    const r = await p.evaluate(() => { const c = document.querySelector('.lsc-hero'); return c && { avg: (c.querySelector('.lsc-avg') || {}).textContent, txt: c.textContent }; });
    if (!r) throw new Error('no .lsc-hero');
    if (r.avg !== want) throw new Error('average ' + r.avg + ', want ' + want);
    if (!/of 4/.test(r.txt) || !/can be wrong/i.test(r.txt)) throw new Error('hero text: ' + r.txt);
    if (p.errs.length) throw new Error('page errors: ' + p.errs.join(' | '));
  }),
  /* ---------- Progress: the ladder as a hero you can tap, and four weeks of streak ---------- */
  T('progress', 'G1 the ladder hero names your level, shows all seven levels, and a tap on a level says what it takes', async b => {
    const p = await page(b, { width: 390, height: 844 }); await prog(p);
    const r = await p.evaluate(() => { const c = document.querySelector('.proghero'); if (!c) return null; const L = gameLevel(gameXP());
      return { name: (c.querySelector('.pg-level') || {}).textContent, want: LADDER[L.i][0], n: c.querySelectorAll('.lvdots button').length, want7: LADDER.length, cur: [...c.querySelectorAll('.lvdots button')].findIndex(x => x.getAttribute('aria-checked') === 'true'), i: L.i }; });
    if (!r) throw new Error('no .proghero');
    if (r.name !== r.want) throw new Error('level ' + r.name + ', want ' + r.want);
    if (r.n !== r.want7) throw new Error(r.n + ' level buttons');
    if (r.cur !== r.i) throw new Error('selected ' + r.cur + ', want ' + r.i);
    await p.click('.lvdots button >> nth=4'); await p.waitForTimeout(200);
    const g = await p.evaluate(() => ({ txt: (document.querySelector('.lv-gate') || {}).textContent || '', need: LADDER[4][1].toLocaleString('en-US'), boss: LADDER[4][2] }));
    if (!g.txt.includes(g.need) || (g.boss && !g.txt.includes(g.boss.toFixed(1)))) throw new Error('gate for ' + 'level 5: ' + g.txt);
  }),
  T('progress', 'G2 four weeks of streak: 28 days from Monday, today outlined, later days empty, a full set marked', async b => {
    const p = await page(b, { width: 390, height: 844 }); await prog(p);
    await p.evaluate(() => { const k = iso(new Date()); S.dayset = S.dayset || {}; const y = dayAdd(k, -1); S.dayset[y] = Object.assign({}, S.dayset[y] || { items: [] }, { full: Date.now() }); save(); route(); });
    await p.waitForTimeout(600);
    const r = await p.evaluate(() => { const ds = [...document.querySelectorAll('.streakcal .day')], k = iso(new Date()), y = dayAdd(k, -1);
      return { n: ds.length, today: ds.filter(d => d.classList.contains('today')).map(d => d.dataset.k), future: ds.filter(d => d.dataset.k > k).every(d => d.classList.contains('future')), y: (ds.find(d => d.dataset.k === y) || { className: '' }).className, mon: new Date((ds[0] || {}).dataset ? ds[0].dataset.k + 'T00:00:00' : 0).getDay(), legend: !!document.querySelector('.streaklegend') }; });
    if (r.n !== 28) throw new Error(r.n + ' days');
    if (r.mon !== 1) throw new Error('the calendar does not start on a Monday');
    if (r.today.length !== 1) throw new Error('today marked ' + r.today.length + ' times');
    if (!r.future) throw new Error('later days are not empty');
    if (!/\bfull\b/.test(r.y)) throw new Error('yesterday (a full set) shows as ' + r.y);
    if (!r.legend) throw new Error('no legend');
  }),
  T('progress', 'G3 the streak number matches the streak rules, and the page has no errors on desktop', async b => {
    const p = await page(b, { width: 1440, height: 900 }); await prog(p);
    const r = await p.evaluate(() => ({ shown: (document.querySelector('.st-n') || {}).textContent || '', want: gameStreak().n }));
    if (!new RegExp('^' + r.want + '-day streak').test(r.shown)) throw new Error('streak says "' + r.shown + '", want ' + r.want);
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
