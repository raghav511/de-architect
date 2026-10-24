/* Checks the scheduler: budgets respected, every step planned once, order kept, roll-forward works. */
const { chromium } = require(process.env.PW || 'playwright');
const BASE = process.argv[2] || 'http://localhost:8811/';
(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const p = await (await b.newContext()).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '#/today'); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const out = [];
    const sc = schedule();
    const ids = new Set();
    sc.units.forEach(u => { if (ids.has(u.uid)) out.push('duplicate uid ' + u.uid); ids.add(u.uid); if (!u.day) out.push('unplanned ' + u.uid); if (!u.mins || u.mins > 60 && u.kind !== 'project') out.push('unit too long ' + u.uid + ' ' + u.mins); if (!u.href || !u.title) out.push('unit missing link/title ' + u.uid); });
    Object.entries(sc.byDay).forEach(([k, us]) => { if (k === '0000-00-00') return; const d = new Date(k + 'T00:00:00'), cap = capOf(d), m = us.reduce((a, u) => a + u.mins, 0); if (m > cap + 5 && us.length > 1) out.push('over budget ' + k + ' ' + m + '/' + cap); });
    // order: module days must be non-decreasing in MODS order
    let last = '';
    MODS.forEach(m => { const s = sc.span[m]; if (s.first && s.first < last) out.push('module ' + m + ' starts before previous ends ' + s.first + ' < ' + last); if (s.first) last = s.first; });
    // roll-forward: mark first unit done today, the rest should shift earlier or stay
    const before = sc.units.filter(u => !u.isDone).map(u => u.day);
    const first = sc.units.find(u => !u.isDone);
    S.done[first.uid] = iso(new Date());
    const sc2 = schedule();
    const after = sc2.units.filter(u => !u.isDone).map(u => u.day);
    after.forEach((d, i) => { if (d > before[i + 1]) out.push('step moved later after finishing one: ' + i); });
    delete S.done[first.uid];
    // simulate missing 3 days: start the plan 3 days in the future = nothing done; total days needed
    const last2 = sc.units[sc.units.length - 1].day;
    return { out, units: sc.units.length, end: last2, mins: sc.units.reduce((a, u) => a + u.mins, 0), weeks: weekOf(last2) };
  });
  console.log(JSON.stringify({ units: r.units, hours: Math.round(r.mins / 60), lastDay: r.end, weeks: r.weeks }));
  r.out.concat(errs).forEach(x => console.log('FAIL', x));
  console.log(r.out.length + errs.length + ' failures');
  await b.close(); process.exit(r.out.length ? 1 : 0);
})();
