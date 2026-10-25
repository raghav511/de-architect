/* Runs every bank question's and coding test's reference solution through the in-browser editor (Pyodide)
   and checks the app reports a pass.   node tools/editor_test.js [baseUrl] [--only=sql|dsa|spark|test] */
const { chromium } = require(process.env.PW || 'playwright');
const BASE = (process.argv[2] && !process.argv[2].startsWith('--')) ? process.argv[2] : 'http://localhost:8811/';
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '#/today'); await p.waitForTimeout(1500);
  const items = await p.evaluate(() => {
    const out = [];
    ['dsa', 'sql', 'spark', 'py'].forEach(k => DATA[k].forEach(x => out.push({ k, id: x.id, t: x.t, sol: x.sol })));
    MODS.forEach(m => (DATA.sprints[m].coding || []).forEach((c, i) => out.push({ k: 'test', id: m + '/' + i, t: c.TITLE, sol: c.CODE })));
    return out;
  });
  const fails = []; let n = 0, ran = 0, t0 = Date.now(); /* ran: solutions actually executed; the first waits for Python to load */
  for (const it of items) {
    if (ONLY && it.k !== ONLY) continue;
    n++;
    await p.evaluate(h => { location.hash = h; }, '#/' + it.k + '/' + it.id);
    await p.waitForSelector('textarea.code', { timeout: 15000 });
    const NEG = process.env.NEG; if (NEG && (n % 6 || (it.k !== 'sql' && !/return /.test(it.sol) && /def /.test(it.sol)))) continue;
    await p.fill('textarea.code', NEG ? ((it.k === 'sql' || (it.k === 'test' && !/def |import /.test(it.sol))) ? 'SELECT 1 AS x' : it.k === 'spark' ? 'result = spark.range(3)' : it.sol.replace(/return /, 'return None and ')) : it.sol);
    const run = p.locator('button.btn.pri', { hasText: /^Run/ }).first();
    await run.click(); ran++;
    try {
      await p.waitForFunction(() => { const v = document.querySelector('.verdict'); const r = Array.from(document.querySelectorAll('button.btn.pri')).find(x => /Running/.test(x.textContent)); return !r && v && v.style.display !== 'none' && v.textContent.trim(); }, null, { timeout: ran === 1 ? 120000 : 40000 });
    } catch (e) { fails.push(it.k + ' ' + it.id + ' ' + it.t + ' :: no verdict'); continue; }
    const v = await p.$eval('.verdict', e => e.textContent.trim());
    const detail = await p.$eval('.out .body', e => e.innerText.slice(0, 300)).catch(() => '');
    if (NEG ? v === 'All checks pass' : v !== 'All checks pass') fails.push((NEG ? 'WRONG ANSWER ACCEPTED ' : '') + it.k + ' ' + it.id + ' ' + it.t + ' :: ' + v + ' :: ' + detail.replace(/\n/g, ' '));
    // leave without the exit dialog: reset state so the next item starts clean
  }
  errs.forEach(e => fails.push('pageerror ' + e));
  console.log(n + ' solutions run in ' + Math.round((Date.now() - t0) / 1000) + 's');
  fails.forEach(f => console.log('FAIL', f));
  console.log(fails.length + ' failures');
  await b.close(); process.exit(fails.length ? 1 : 0);
})();
