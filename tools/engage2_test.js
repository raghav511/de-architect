/* Checks ENGAGE 2, 4 and 5 (js/story.js): the episode line on Today's module card, the module's Path page and its week steps;
   a Sunday boss round under 3.0 frames the next Sunday as a rematch and says so on the scorecard (never a loss); the season map
   on the series page with tiles from real module XP; story off hides the frames. node tools/engage2_test.js [baseUrl] */
const { chromium } = require(process.env.PW || 'playwright');
const { blockExternal } = require('./testnet');
const BASE = process.argv[2] || 'http://localhost:8811/';
(async () => {
  const b = await chromium.launch(); const cx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await blockExternal(cx); await cx.route('http://127.0.0.1:8765/**', r => r.abort());
  const p = await cx.newPage(); const errs = [], out = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => { if (!c) out.push(m); };
  const txt = s => p.evaluate(s => [...document.querySelectorAll(s)].map(e => e.textContent).join(' | '), s);
  await p.goto(BASE + '#/today'); await p.waitForSelector('.plan', { timeout: 60000 }); await p.waitForTimeout(1200);
  /* 1. the module card frames the module as an episode, with the season's real XP */
  const card = await txt('.storyframe');
  ok(/Meridian · S\d · E\d+ · .+ · season \d+ \/ \d+ XP/.test(card), 'no episode line on the module card: ' + card);
  /* the head start only counts earned XP: finish a step of the next module and see it */
  const hs = await p.evaluate(async () => { await storyData(); const sc = schedule(), m = sc.cur, i = MODS.indexOf(m), n = MODS.slice(i + 1).find(x => !isCC(x)), u = sc.units.find(x => x.mid === n && x.kind !== 'learn');
    const before = storyModXP(n)[0]; if (u) { S.done[u.uid] = iso(new Date()); save(false); } return { n, before, after: storyModXP(n)[0], w: u ? (XP_KIND[u.kind] || 10) : 0 }; });
  ok(hs.before === 0 && hs.after === hs.w, 'module XP is not the earned XP: ' + JSON.stringify(hs));
  /* 2. the Path page and a week step carry the episode */
  await p.evaluate(m => { location.hash = '#/path/' + m; }, hs.n); await p.waitForTimeout(900);
  ok(/Meridian · S\d · E\d+ · .+: \S+/.test(await txt('.storyframe')), 'no logline on the Path page');
  const step = await p.evaluate(() => (schedule().units.find(u => u.step && !isCC(u.mid)) || {}).href || '');
  ok(step, 'no week step in the plan');
  if (step) { await p.evaluate(h => { location.hash = h; }, step); await p.waitForSelector('.storyframe', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(600); ok(/Meridian · S\d · E\d+/.test(await txt('.storyframe')), 'no episode on the step page ' + step); }
  /* 3. last Sunday's boss under 3.0 makes this Sunday a rematch, on the item and the scorecard */
  const rm = await p.evaluate(async () => { let d = iso(new Date()); while (new Date(d + 'T00:00:00').getDay() !== 0) d = dayAdd(d, 1); const last = dayAdd(d, -7), sat = dayAdd(d, -1);
    const sc = v => ({ sc: Object.fromEntries(LIVE_DIMS.map(x => [x[0], v])) });
    S.live = S.live || {}; S.live[sat] = { kind: 'we', done: 1, mod: schedule().cur, qs: [{ q: 'x' }], ans: { 0: sc(1) } };
    const none = storyRematch(d); S.live[last] = { kind: 'we', done: 1, mod: schedule().cur, qs: [{ q: 'x' }, { q: 'y' }], ans: { 0: sc(2), 1: sc(3) } };
    const r = storyRematch(d), line = storyBoss(d); S.live[last].ans = { 0: sc(4), 1: sc(4) }; const pass = storyRematch(d);
    return { none, r, line, pass, fail: (storyFinaleNote(d, { kind: 'we', mod: schedule().cur }, 2.4) || {}).textContent || '', win: (storyFinaleNote(d, { kind: 'we', mod: schedule().cur }, 3.6) || {}).textContent || '', sat: storyFinaleNote(sat, { kind: 'we' }, 2) }; });
  ok(!rm.none, 'a Saturday mock opened a rematch: ' + JSON.stringify(rm.none));
  ok(rm.r && Math.abs(rm.r.avg - 2.5) < 0.01 && /^Rematch: last Sunday's finale scored 2\.5/.test(rm.line), 'no rematch after a 2.5 boss: ' + JSON.stringify(rm));
  ok(!rm.pass, 'a passed boss still opened a rematch');
  ok(/rematch opens next Sunday/.test(rm.fail) && /never a loss/.test(rm.fail) && !/fail/i.test(rm.fail), 'scorecard note under 3.0 wrong: ' + rm.fail);
  ok(/Finale passed/.test(rm.win) && !rm.sat, 'scorecard note wrong for a pass or a Saturday: ' + rm.win);
  /* 4. the season map: one tile per episode, done/now states, widths from module XP */
  await p.evaluate(() => { location.hash = '#/story'; }); await p.waitForSelector('.storymap', { timeout: 10000 });
  const mp = await p.evaluate(() => { const ts = [...document.querySelectorAll('.storytile')]; return { n: ts.length, eps: Object.keys(storyArcs()).length, now: document.querySelectorAll('.storytile.now').length, bad: ts.filter(t => !/^(✓ )?E\d+$/.test(t.querySelector('b').textContent)).length, lab: ts.map(t => t.getAttribute('aria-label')).filter(l => /[1-9]\d* of \d+ XP/.test(l)).length }; });
  ok(mp.n === mp.eps && mp.n > 20, 'season map tiles ' + mp.n + ' vs episodes ' + mp.eps);
  ok(mp.now === 1 && mp.lab >= 1 && !mp.bad, 'season map has no now tile or no earned XP: ' + JSON.stringify(mp));
  /* 5. w3's fields: the cold open asks recall[i] and links to[i]; the cliffhanger links to[i + 1]; the rematch line; the calendar text to copy */
  const w3 = await p.evaluate(async () => { await storyData(); const k = iso(new Date()), y = dayAdd(k, -1), st = storyDay(k), a = storyArcs()[st.m], src = DATA.story.seasons.flatMap(s => s.modules).find(x => x.mid === st.m);
    if (!src.recall) src.recall = src.scenes.map((x, i) => 'Recall: question ' + i + '?'); if (!src.to) src.to = src.scenes.map((x, i) => '#/path/' + st.m + '?s=' + i); DATA.story.rematch = DATA.story.rematch || 'A weak weekend review is never a loss.';
    S.dayset[y] = S.dayset[y] || { items: [] }; S.story[y] = S.story[y] || { m: st.m, i: 0 }; delete S.story[k].open; save(); location.hash = '#/today'; route(); return { i: st.i, recall: src.recall[st.i], to: src.to[st.i], next: src.to[Math.min(st.i + 1, 5)] }; });
  await p.waitForSelector('.storyopen', { timeout: 10000 }).catch(() => {}); await p.waitForTimeout(800);
  const co = await p.evaluate(() => ({ q: (document.querySelector('.storyopen .storyrecall') || {}).textContent || '', go: (() => { const g = document.querySelector('.storyopen .storygo'); return g && !g.hidden ? g.getAttribute('href') : ''; })() }));
  ok(co.q === w3.recall && /^Recall: .+\?$/.test(co.q), 'cold open has no recall question: ' + JSON.stringify(co));
  ok(co.go === w3.to, 'cold open does not link the scene\'s practice: ' + JSON.stringify([co.go, w3.to]));
  const rl = await p.evaluate(() => { let d = iso(new Date()); while (new Date(d + 'T00:00:00').getDay() !== 0) d = dayAdd(d, 1); S.live[dayAdd(d, -7)].ans = { 0: { sc: Object.fromEntries(LIVE_DIMS.map(x => [x[0], 2])) } }; return storyBoss(d); });
  ok(rl.includes(await p.evaluate(() => DATA.story.rematch)), 'the boss row has no rematch line: ' + rl);
  await p.evaluate(() => { const t = iso(new Date()); S.story[t].open = Date.now(); S.xdone = S.xdone || {}; S.xdone[t] = S.xdone[t] || {}; daySet(t).forEach(x => { if (x.unit) S.done[x.unit.uid] = t; else S.xdone[t][x.id] = Date.now(); }); S.story[dayAdd(t, 1)] = { plan: '07:00' }; save(); route(); });
  await p.waitForSelector('.storycliff', { timeout: 10000 }).catch(() => {}); await p.waitForTimeout(800);
  const cf = await p.evaluate(() => { const g = document.querySelector('.storycliff .storygo'), ta = document.querySelector('.storycliff textarea.storyics'); return { go: g && !g.hidden ? g.getAttribute('href') : '', fin: /finale/.test((document.querySelector('.storycliff .storytag') || {}).textContent || ''), ics: ta ? ta.value : '' }; });
  ok(cf.fin || cf.go === w3.next, 'the cliffhanger does not link where tomorrow leads: ' + JSON.stringify([cf.go, w3.next]));
  ok(/^BEGIN:VCALENDAR[\s\S]*DTSTART:\d{8}T070000[\s\S]*END:VCALENDAR$/.test(cf.ics), 'no calendar text to copy once planned');
  /* 6. story off: no frames, no rematch wording */
  await p.evaluate(() => { S.settings.story = 'off'; save(); location.hash = '#/today'; route(); }); await p.waitForTimeout(900);
  ok(!(await p.$('.storyframe')), 'story off still frames the module card');
  ok(await p.evaluate(() => { let d = iso(new Date()); while (new Date(d + 'T00:00:00').getDay() !== 0) d = dayAdd(d, 1); return !/Rematch/.test(storyBoss(d)) && !storyFinaleNote(d, { kind: 'we' }, 2); }), 'story off still shows the rematch');
  await b.close();
  out.push(...errs.map(e => 'page error: ' + e));
  out.forEach(x => console.log('FAIL ' + x)); console.log(out.length + ' failures'); process.exit(out.length ? 1 : 0);
})();
