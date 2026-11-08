/* Checks ENGAGE 6 and 9 (js/story.js): the cast asks the staff questions in a live mock; the weekend round names its interviewer
   (Priya or Sam, fictional) and tells the AI; the coach speaks as Grace; case files open after a full set Monday to Saturday,
   announced beforehand, never on Sunday, never worth XP, kept in S.cases and merged per date; story off drops the names but keeps
   the case files. node tools/engage3_test.js [baseUrl] */
const { chromium } = require(process.env.PW || 'playwright');
const { blockExternal } = require('./testnet');
const BASE = process.argv[2] || 'http://localhost:8811/';
(async () => {
  const b = await chromium.launch(); const cx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await blockExternal(cx); await cx.route('http://127.0.0.1:8765/**', r => r.abort());
  const p = await cx.newPage(); const mon = new Date(); mon.setDate(mon.getDate() + ((8 - mon.getDay()) % 7 || 7)); mon.setHours(10, 0, 0, 0);
  if (p.clock) await p.clock.setFixedTime(mon); /* a Monday, so the case file after a full set is checked every run */
  const errs = [], out = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => { if (!c) out.push(m); };
  await p.goto(BASE + '#/today'); await p.waitForSelector('.plan', { timeout: 60000 }); await p.waitForTimeout(1000);
  /* 1. the cast: every staff kind has a canon asker; the interviewer and the coach */
  const c = await p.evaluate(() => { const canon = ['Marcus Bell', 'Asha Iyer', 'Dev Malhotra', 'Lena Park', 'Mei Chen', 'Tom Reyes', 'Kofi Mensah', 'Grace Okafor', 'Victor Hale'];
    const kinds = Object.keys(DATA.staff.kinds), miss = kinds.filter(k => !/asks:$/.test(storyAsker(k)) || !canon.some(n => storyAsker(k).startsWith(n)));
    const iv = LIVE_STYLES.map(s => storyInterviewer({ style: s })), sys = liveSystem({ style: 'Meta', level: 'staff' });
    return { miss, iv: iv.map(x => x && x.line), names: iv.map(x => x && x.name), sys, coach: storyCoachName() }; });
  ok(!c.miss.length, 'staff kinds with no cast asker: ' + c.miss.join(', '));
  ok(c.names.every(n => n === 'Priya' || n === 'Sam') && c.iv.every(l => /^Your interviewer: (Priya|Sam) · \w+-style (product sense|system design) round$/.test(l)), 'interviewers wrong: ' + JSON.stringify(c.iv));
  ok(/^Your name is Priya\. You are a Meta-style interviewer/.test(c.sys), 'the AI interviewer is not told its name: ' + c.sys.slice(0, 80));
  ok(c.coach === 'Grace, your coach', 'coach not Grace: ' + c.coach);
  /* 2. the asker shows on a live staff question */
  const lq = await p.evaluate(() => { const k = iso(new Date()); S.live = S.live || {}; S.live[k] = { kind: 'wd', mins: 20, per: 4, level: 'staff', style: '', week: [schedule().cur], mod: schedule().cur, qs: [{ slot: 'cost', label: DATA.staff.kinds.cost, q: 'Cut the bill by a third.', model: '', points: ['x'], m: schedule().cur, src: 'staff-level bank' }], ans: {}, i: 0, t: Date.now() }; save(); location.hash = '#/live/' + k; return k; });
  await p.waitForSelector('.lq', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(400);
  ok(/^Mei Chen, FinOps, reading the bill, asks:$/.test(await p.evaluate(() => (document.querySelector('.lasker') || {}).textContent || '')), 'no cast asker on the live question');
  /* 3. case files: announced before, open after a full set on Monday to Saturday, none on Sunday, no XP */
  const sched = await p.evaluate(() => [0, 1, 2, 3, 4, 5, 6].map(g => { let d = iso(new Date()); while (new Date(d + 'T00:00:00').getDay() !== g) d = dayAdd(d, 1); return [g, caseKind(d)]; }));
  ok(sched.every(([g, k]) => g === 0 ? !k : !!k) && new Set(sched.map(x => x[1]).filter(Boolean)).size === 3, 'case file days wrong: ' + JSON.stringify(sched));
  await p.evaluate(() => { delete S.live[iso(new Date())]; save(); location.hash = '#/today'; route(); }); await p.waitForTimeout(800);
  const sun = await p.evaluate(() => new Date().getDay() === 0); ok(!sun || !p.clock, 'the test clock is not on a Monday');
  const pre = await p.evaluate(() => (document.querySelector('.plan .hint') || {}).textContent || '');
  ok(sun ? !/case file/.test(pre) : /a full set also opens a case file/.test(pre), 'the case file is not announced: ' + pre);
  ok(!(await p.$('.casefile')), 'a case file before the set is done');
  const xp0 = await p.evaluate(() => { const t = iso(new Date()); S.xdone = S.xdone || {}; S.xdone[t] = S.xdone[t] || {}; daySet(t).forEach(x => { if (x.unit) S.done[x.unit.uid] = t; else S.xdone[t][x.id] = Date.now(); }); save(); route(); return gameXP(); });
  await p.waitForTimeout(1200);
  if (!sun) {
    ok(await p.$('.casefile'), 'no case file after a full set');
    await p.click('.casefile summary'); await p.waitForTimeout(1500);
    const cf = await p.evaluate(() => ({ head: (document.querySelector('.casefile .casehead') || {}).textContent || '', body: (document.querySelector('.casefile') || {}).innerText || '', seen: S.cases && S.cases[iso(new Date())], xp: gameXP() }));
    ok(/^(The harder follow-up|Field report|From the architect's lens): \S/.test(cf.head) && cf.body.length > 80 && !/Opening…/.test(cf.body), 'case file empty: ' + JSON.stringify(cf).slice(0, 300));
    ok(cf.seen && cf.seen.open, 'opening the case file was not kept');
    ok(cf.xp === xp0, 'a case file changed XP: ' + xp0 + ' → ' + cf.xp);
  }
  /* the lens case file on the diagnostic (no interview set of its own) borrows the next module's */
  ok(await p.evaluate(async () => { S.story[dayAdd(iso(new Date()), 2)] = { m: 's00', i: 0 }; const c = storyCase(dayAdd(iso(new Date()), 2)); document.body.appendChild(c); await new Promise(z => setTimeout(z, 2000)); const r = c.isConnected && /^From the architect's lens: \S/.test(c.querySelector('.casehead').textContent); c.remove(); delete S.story[dayAdd(iso(new Date()), 2)]; return r; }), 'the lens case file on the diagnostic is empty');
  /* every kind fills on any day: render each into the page */
  const kinds = await p.evaluate(async () => { const r = {}; for (const g of [1, 2, 3]) { let d = iso(new Date()); while (new Date(d + 'T00:00:00').getDay() !== g) d = dayAdd(d, 1);
    const c = storyCase(d); document.body.appendChild(c); c.open = true; await new Promise(z => setTimeout(z, 1200)); r[caseKind(d)] = c.querySelector('.casehead').textContent + ' | ' + c.innerText.length; c.remove(); } return r; });
  ok(['follow', 'field', 'lens'].every(k => kinds[k] && !/: $/.test(kinds[k].split(' | ')[0]) && +kinds[k].split(' | ')[1] > 80), 'a case file kind is empty: ' + JSON.stringify(kinds));
  /* links in a field report are https only and open in a new tab */
  ok(await p.evaluate(() => [...document.querySelectorAll('.casefile a[href]')].every(a => /^https:/.test(a.href) && a.rel.includes('noopener'))), 'unsafe case file link');
  /* 4. merge per date keeps the first open */
  const mg = await p.evaluate(() => mergeState({ cases: { a: { kind: 'lens', open: 5 } } }, { cases: { a: { kind: 'lens', open: 9 }, b: { kind: 'field', open: 3 } } }).cases);
  ok(mg.a.open === 5 && mg.b, 'merge lost case files: ' + JSON.stringify(mg));
  /* 5. story off: no names, case files stay */
  const off = await p.evaluate(() => { S.settings.story = 'off'; save(); return { a: storyAsker('cost'), i: storyInterviewer({ style: 'Meta' }), c: storyCoachName(), sys: liveSystem({ style: 'Meta', level: 'staff' }), k: caseKind('2026-11-09') }; });
  ok(!off.a && !off.i && off.c === 'Your coach' && /^You are a Meta-style/.test(off.sys) && off.k, 'story off still names the cast: ' + JSON.stringify(off));
  await b.close();
  out.push(...errs.map(e => 'page error: ' + e));
  out.forEach(x => console.log('FAIL ' + x)); console.log(out.length + ' failures'); process.exit(out.length ? 1 : 0);
})();
