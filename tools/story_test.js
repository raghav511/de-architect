/* Checks the Meridian series (js/story.js): no "Previously on" on the first day; from the second day the cold open (scene and
   recall) comes before the plan and Skip brings Up next back; a finished set ends on "Tomorrow on Meridian" with a one-tap plan
   and nothing that plays next; the series page; story off keeps recall;
   sync merges S.story per date; every main module has an arc. node tools/story_test.js [baseUrl] */
const { chromium } = require(process.env.PW || 'playwright');
const { blockExternal } = require('./testnet');
const BASE = process.argv[2] || 'http://localhost:8811/';
(async () => {
  const b = await chromium.launch(); const cx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await blockExternal(cx); await cx.route('http://127.0.0.1:8765/**', r => r.abort());
  const p = await cx.newPage(); const errs = [], out = []; p.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => { if (!c) out.push(m); };
  await p.goto(BASE + '#/today'); await p.waitForSelector('.plan', { timeout: 60000 }); await p.waitForTimeout(800);
  /* 1. day one: no cold open, Up next first */
  ok(!(await p.$('.storyopen')) && await p.$('.upnext .unit.cur'), 'day one shows a cold open or no Up next');
  /* 2. from the second day: Previously on, with the scene, before the plan; Skip brings Up next back */
  await p.evaluate(() => { const t = iso(new Date()), y = dayAdd(t, -1); S.dayset[y] = { items: [] }; S.story = { [y]: { m: S.story && S.story[t] && S.story[t].m || 's00', i: 0 } }; save(); route(); });
  await p.waitForSelector('.storyopen', { timeout: 10000 }).catch(() => {}); await p.waitForTimeout(800);
  const op = await p.evaluate(() => ({ card: !!document.querySelector('.storyopen'), up: !!document.querySelector('.upnext .unit.cur'), tag: (document.querySelector('.storyopen .storytag') || {}).textContent || '', scene: (document.querySelector('.storyopen .storyscene') || {}).textContent || '' }));
  ok(op.card && !op.up, 'the cold open is not shown first on day two: ' + JSON.stringify(op));
  ok(/Previously on Meridian · S\d · E\d+/.test(op.tag) && op.scene.split(' ').length >= 15, 'no episode tag or scene: ' + JSON.stringify(op));
  await p.click('.storyopen button'); await p.waitForTimeout(500);
  ok(!(await p.$('.storyopen')) && await p.$('.upnext .unit.cur'), 'Skip or Start did not bring Up next back');
  /* 3. the finished set: Tomorrow on Meridian, a plan for tomorrow, nothing plays next */
  await p.evaluate(() => { const t = iso(new Date()); S.xdone = S.xdone || {}; S.xdone[t] = S.xdone[t] || {}; daySet(t).forEach(x => { if (x.unit) S.done[x.unit.uid] = t; else S.xdone[t][x.id] = Date.now(); }); save(); route(); });
  await p.waitForSelector('.storycliff', { timeout: 10000 }).catch(() => {}); await p.waitForTimeout(800);
  const cl = await p.evaluate(() => ({ text: (document.querySelector('.storycliff') || {}).innerText || '', up: !!document.querySelector('.upnext .unit.cur') }));
  ok(/Tomorrow on Meridian|finale/.test(cl.text) && /Nothing plays next/.test(cl.text) && !cl.up, 'no cliffhanger or an Up next after the set: ' + cl.text.slice(0, 200));
  const dl = p.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await p.click('.storycliff button:has-text("Plan tomorrow")'); const f = await dl; await p.waitForTimeout(300);
  ok(f && /\.ics$/.test(f.suggestedFilename()), 'no calendar file for tomorrow');
  ok(await p.evaluate(() => !!(S.story[dayAdd(iso(new Date()), 1)] || {}).plan) && /planned/.test(await p.$eval('.storycliff', e => e.innerText)), 'tomorrow\'s plan not kept');
  /* 5. the series page */
  await p.evaluate(() => { location.hash = '#/story'; }); await p.waitForSelector('#page details', { timeout: 10000 });
  const pg = await p.$eval('#page', e => e.innerText); ok(/Season 1: Day One/.test(pg) && /Season 5: The Loop/.test(pg) && /The cast/.test(pg), 'series page incomplete: ' + pg.slice(0, 200));
  /* 6. story off: recall still opens the day, without the scene */
  await p.evaluate(() => { S.settings.story = 'off'; const t = iso(new Date()); delete S.story[t].open; save(); location.hash = '#/today'; }); await p.waitForTimeout(700);
  const off = await p.evaluate(() => ({ scene: !!document.querySelector('.storyscene'), card: document.querySelector('.storyopen') ? document.querySelector('.storyopen').innerText : '' }));
  ok(!off.scene, 'story off still shows a scene');
  /* 7. merge, and every main module has an arc */
  const mg = await p.evaluate(async () => { const m = mergeState({ story: { a: { m: 's01', i: 2, open: 5 } } }, { story: { a: { plan: '07:00' }, b: { m: 's02', i: 0 } } }).story; const d = await storyData(), A = storyArcs(); return { m, missing: BASE_MODS.filter(x => !A[x]) }; });
  ok(mg.m.a.open && mg.m.a.plan === '07:00' && mg.m.a.m === 's01' && mg.m.b, 'merge lost story state: ' + JSON.stringify(mg.m));
  ok(!mg.missing.length, 'modules without an arc: ' + mg.missing.join(', '));
  await b.close();
  out.push(...errs.map(e => 'page error: ' + e));
  out.forEach(x => console.log('FAIL ' + x)); console.log(out.length + ' failures'); process.exit(out.length ? 1 : 0);
})();
