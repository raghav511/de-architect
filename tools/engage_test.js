/* ENGAGE 7 and 8: a hard stop and a forgiving streak. The finished day shows no next item and nothing opens by itself (One more
   is an opt-in); today's reels from Today stop after three with "That's today's reels"; a missed day counts again in the streak
   when within 48 hours a full set is done plus One more in each tab, once per repair day; the note on Today never warns.
   node tools/engage_test.js [baseUrl] */
const { chromium } = require(process.env.PW || 'playwright');
const { blockExternal } = require('./testnet');
const BASE = process.argv[2] || 'http://localhost:8811/';
(async () => {
  const b = await chromium.launch(); const cx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await blockExternal(cx); await cx.route('http://127.0.0.1:8765/**', r => r.abort());
  const p = await cx.newPage(); const errs = [], out = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => { if (!c) out.push(m); };
  await p.goto(BASE + '#/today'); await p.waitForSelector('.plan', { timeout: 60000 }); await p.waitForTimeout(800);
  /* 1. the hard stop on Today: when the set is done, no next item, nothing navigates, One more only on request */
  const before = await p.evaluate(() => location.hash);
  await p.evaluate(() => { const t = iso(new Date()); S.xdone = S.xdone || {}; S.xdone[t] = S.xdone[t] || {}; daySet(t).forEach(x => { if (x.unit) S.done[x.unit.uid] = t; else S.xdone[t][x.id] = Date.now(); }); save(); route(); });
  await p.waitForTimeout(3000);
  const st = await p.evaluate(() => ({ hash: location.hash, up: !!document.querySelector('.upnext .unit.cur'), done: /Daily set done/.test(document.querySelector('.plan').textContent), more: document.querySelectorAll('.plan button').length && [...document.querySelectorAll('.plan button')].some(x => /One more/.test(x.textContent)), n: daySet(iso(new Date())).length }));
  ok(st.hash === before && !st.up && st.done && st.more, 'the finished day is not a hard stop: ' + JSON.stringify(st));
  ok(await p.evaluate(n => daySet(iso(new Date())).length === n, st.n), 'items were added without asking');
  /* 2. today's reels from Today: three, then a stop */
  const href = await p.evaluate(() => { const x = daySet(iso(new Date())).find(i => i.s === 'reels'); return x && x.x.href; });
  ok(href === '#/reels/today', 'the Reels row does not open today\'s reels: ' + href);
  await p.evaluate(() => { location.hash = '#/reels/today'; }); await p.waitForSelector('.rslide', { timeout: 30000 }); await p.waitForTimeout(800);
  const n = await p.$$eval('.rslide:not(.rend)', s => s.length); ok(n >= 1 && n <= 3, 'today\'s reels are not at most three: ' + n);
  ok(await p.$('.rslide.rend'), 'no end card after today\'s reels');
  await p.evaluate(k => window.reelGo(k), n); await p.waitForTimeout(1500);
  const end = await p.evaluate(() => { const e = document.querySelector('.rslide.rend'), r = e.getBoundingClientRect(); return { text: e.innerText, inView: r.top < innerHeight / 2 && r.bottom > innerHeight / 2, count: (document.querySelector('.rcount') || {}).textContent }; });
  ok(/That's today's reels/.test(end.text) && /Back to Today/.test(end.text) && /Keep watching/.test(end.text) && end.inView, 'the end card is not shown: ' + JSON.stringify(end));
  ok(await p.evaluate(() => [...document.querySelectorAll('audio')].every(a => a.paused)), 'a reel keeps playing on the end card');
  /* 3. the forgiving streak */
  const r = await p.evaluate(() => { const t = iso(new Date()), y = dayAdd(t, -1), y2 = dayAdd(t, -2);
    S.dayset[y2] = { items: [{ s: 'lesson', id: 'gone' }] }; S.dayset[y] = { items: [{ s: 'lesson', id: 'gone2' }], full: Date.now() };
    const missed0 = !gameDays().has(y2), hint = repairHint(t);
    /* a full set alone does not repair */
    S.dayset[t].full = Date.now(); const half = gameDays().has(y2);
    /* plus One more in each tab: repaired */
    S.xdone[t] = S.xdone[t] || {}; ['learn', 'practice', 'interview'].forEach(tab => { const sec = DAY_SECS.find(s => s[0] === tab && dayCands(s[1], t, schedule()).some(c => !S.dayset[t].items.some(z => z.id === c.id)));
      if (!sec) return; const c = dayCands(sec[1], t, schedule()).find(c => !S.dayset[t].items.some(z => z.id === c.id)); S.dayset[t].items.push(Object.assign({}, c, { m: 1 }));
      const it = dayItem(c, t, schedule()); if (it && it.unit) S.done[it.unit.uid] = t; else S.xdone[t][c.id] = Date.now(); });
    schedFlush();
    return { missed0, hint, half, after: gameDays().has(y2), hint2: repairHint(t) }; });
  ok(r.missed0 && /You can still count .* in your streak/.test(r.hint || '') && !/lose|lost|break|broken|hurry|!/i.test(r.hint || ''), 'the repair note is missing or warns: ' + r.hint);
  ok(!r.half, 'a full set alone repaired the missed day');
  ok(r.after && !r.hint2, 'One more in each tab did not repair the missed day: ' + JSON.stringify(r));
  await b.close();
  out.push(...errs.map(e => 'page error: ' + e));
  out.forEach(x => console.log('FAIL ' + x)); console.log(out.length + ' failures'); process.exit(out.length ? 1 : 0);
})();
