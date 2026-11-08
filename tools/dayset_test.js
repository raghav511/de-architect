/* Checks the daily set (F9): one item per section with work, chosen once a day and kept, at most one carried item per
   section, One more, the full-set bonus and streak day, the live mock by weekday, and that the old minute settings are kept.
   node tools/dayset_test.js [baseUrl] */
const { chromium } = require(process.env.PW || 'playwright');
const BASE = process.argv[2] || 'http://localhost:8811/';
(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const cx = await b.newContext(); await cx.route('http://127.0.0.1:8765/**', r => r.abort()); /* never reach a real grader on this Mac */
  const p = await cx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '#/today'); await p.waitForSelector('.plan', { timeout: 60000 }); await p.waitForTimeout(800);
  const out = await p.evaluate(() => {
    const out = [], t = iso(new Date()), y = dayAdd(t, -1), y2 = dayAdd(t, -2), y3 = dayAdd(t, -3);
    S.settings.capWd = 77; S.settings.ivWe = 33; /* old minute settings: never changed or used */
    /* 1. one item per section with work, and every item has minutes and XP */
    let items = daySet(t);
    const per = {}; items.forEach(x => { per[x.s] = (per[x.s] || 0) + 1; if (!(x.mins > 0) || !(x.xp > 0)) out.push('item without minutes or XP: ' + x.id); });
    DAY_SECS.forEach(([, s]) => { const has = dayCands(s, t, schedule()).length > 0; if (has && per[s] !== 1) out.push('section ' + s + ' has ' + (per[s] || 0) + ' items'); if (!has && per[s]) out.push('section ' + s + ' has no work but ' + per[s] + ' items'); });
    ['learn', 'practice', 'interview'].forEach(tab => { if (!items.some(x => x.tab === tab)) out.push('no ' + tab + ' items'); });
    /* 2. the set is kept for the day: finishing an item adds nothing, and the same ids come back */
    const ids = items.map(x => x.id).join();
    const u = items.find(x => x.unit); if (u) { S.done[u.unit.uid] = t; schedFlush(); }
    const after = daySet(t).map(x => x.id).join(); if (after !== ids) out.push('the set changed after finishing an item: ' + after.replace(ids, '…'));
    if (u) { delete S.done[u.unit.uid]; schedFlush(); }
    /* 3. carry-over: at most one carried item per section a day, the oldest first; the rest wait */
    S.live = S.live || {}; S.live[y] = { kind: 'one', qs: [{ q: 'x' }], ans: {}, i: 0 };
    S.dayset[y] = { items: [{ s: 'loop', id: 'loop:r2:' + y }, { s: 'live', id: 'live:' + y }] };
    S.dayset[y2] = { items: [{ s: 'loop', id: 'loop:r5:' + y2 }] };
    S.dayset[y3] = { items: [{ s: 'loop', id: 'loop:r9:' + y3 }] };
    delete S.dayset[t]; items = daySet(t);
    const carried = {}; items.filter(x => x.carried).forEach(x => { carried[x.s] = (carried[x.s] || 0) + 1; });
    Object.entries(carried).forEach(([s, n]) => { if (n > 1) out.push(n + ' carried items in ' + s); });
    const lc = items.find(x => x.s === 'loop' && x.carried); if (!lc || lc.carried !== y3) out.push('the oldest unfinished loop drill did not carry: ' + (lc && lc.id));
    if (!items.some(x => x.s === 'live' && x.carried === y)) out.push('yesterday\'s started live question did not carry');
    /* 4. One more adds the next item of a section, marked as extra */
    const n0 = daySet(t).length; const lesson = DAY_SECS.find(s => s[1] === 'lesson');
    if (lesson && dayCands('lesson', t, schedule()).length > 1) { const save0 = window.route; window.route = () => {}; dayMore(t, 'lesson'); window.route = save0; const n1 = daySet(t); if (n1.length !== n0 + 1 || !n1.some(x => x.more)) out.push('One more did not add one item'); }
    /* 5. the full set: +20 XP once and a streak day */
    const x0 = gameXP();
    const st = S.dayset[t]; st.full = Date.now();
    if (gameXP() !== x0 + DAY_BONUS) out.push('full-set bonus is not +' + DAY_BONUS);
    if (!gameDays().has(t)) out.push('a full set is not a streak day');
    st.full = undefined; if (gameDays().has(t)) out.push('a day without a full set counts as a streak day');
    /* 6. live mock by weekday: one question Monday to Friday, the full mock Saturday, the boss round Sunday */
    const mon = '2026-11-09', sat = '2026-11-14', sun = '2026-11-15';
    if (liveMode(mon) !== 'one' || liveMode(sat) !== 'full' || liveMode(sun) !== 'boss') out.push('live modes: ' + [liveMode(mon), liveMode(sat), liveMode(sun)].join());
    if (liveWeekend(sat) || !liveWeekend(sun)) out.push('only Sunday is the boss round');
    /* 7. module XP and no daily limit text */
    if (!/^\d+ \/ \d+ XP$/.test(modXP(MODS[dayCurIdx(schedule())] || MODS[0]))) out.push('module XP missing');
    if (S.settings.capWd !== 77 || S.settings.ivWe !== 33) out.push('old minute settings changed');
    return out;
  });
  /* the page: XP and minutes on the tabs and the day, no budget text */
  await p.evaluate(() => route()); await p.waitForTimeout(600);
  const txt = await p.$eval('.plan', e => e.textContent).catch(() => '');
  if (!/\d+ of \d+ XP · about/.test(txt)) out.push('the day does not show XP and minutes');
  if (/min over|minute day|of your \d+/.test(txt)) out.push('budget text still on Today: ' + (txt.match(/.{20}(min over|minute day|of your \d+).{10}/) || [''])[0]);
  const tabs = await p.$$eval('.plan .dsum', bs => bs.map(x => x.getAttribute('aria-label')));
  if (tabs.length !== 3 || !tabs.every(x => /XP, \d+ minutes/.test(x))) out.push('tabs: ' + tabs.join(' | '));
  await b.close();
  out.push(...errs.map(e => 'page error: ' + e));
  out.forEach(x => console.log('FAIL ' + x));
  console.log(out.length + ' failures');
  process.exit(out.length ? 1 : 0);
})();
