/* End-to-end test of the coach loop against tools/coach/fake_sync.py.
   node tools/coach/e2e_test.js user  [appUrl] [syncUrl]   play a day as the learner, then Sync
   node tools/coach/e2e_test.js check [appUrl] [syncUrl]   Sync again and check the coach report reached the app
   Between the two, run the coach (fetch, digest, write coach.json, post). The browser profile persists in /tmp/da-e2e-profile. */
const { chromium } = require(process.env.PW || 'playwright');
const [phase, APP = 'http://localhost:8811/', SYNC = 'http://127.0.0.1:8812/exec?k=testkey'] = process.argv.slice(2);
const ok = (c, m) => { if (!c) { console.log('FAIL', m); process.exitCode = 1; } else console.log('PASS', m); };
(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/da-e2e-profile', Object.assign({ viewport: { width: 1280, height: 900 } }, process.env.CHROME ? { executablePath: process.env.CHROME } : {}));
  const p = ctx.pages()[0] || await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const go = async (h, w) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(w || 600); };
  await p.goto(APP + '#/today'); await p.waitForTimeout(1500);
  const sync = async () => { await p.evaluate(() => doSync()); await p.waitForTimeout(2500); return p.$eval('.toast', e => e.textContent).catch(() => ''); };
  if (phase === 'user') {
    await p.evaluate(u => { S.settings.syncUrl = u; save(); }, SYNC);
    /* struggle with a DSA problem: all hints and the solution */
    await p.evaluate(() => { S.secs.d024 = 1000; save(); });
    await go('#/dsa/d024', 900);
    for (let i = 0; i < 6; i++) { const b = await p.$('button.btn.dark:not([disabled])'); if (!b) break; await b.click(); await p.waitForTimeout(150); }
    await p.fill('textarea.code', 'def two_sum(numbers, target):\n    return [0, 1]');
    await p.click('button.btn.pri:has-text("Run")');
    await p.waitForFunction(() => { const v = document.querySelector('.verdict'); return v && v.style.display !== 'none' && v.textContent.trim(); }, null, { timeout: 120000 });
    /* a quiz with some wrong answers */
    await go('#/today');
    await p.evaluate(async () => { const s = await sprint('p01'); const st = S.quiz.p01 = { a: {}, sub: false, i: 0 }; s.quiz.forEach((q, k) => { if (q.TYPE === 'mcq') st.a[k] = k % 3 === 0 ? (q.ANS === 'A' ? 'B' : 'A') : q.ANS; else if (q.TYPE === 'fill') st.a[k] = k % 2 ? 'wrong' : q.ANS.split('|')[0]; }); st.sub = true; save(); });
    await go('#/quiz/p01', 900);
    ok(/Score:/.test(await p.textContent('#page')), 'quiz scored');
    /* today's mock interview */
    await go('#/mock', 500);
    await p.waitForSelector('#page textarea', { timeout: 15000 });
    const n = await p.$$eval('#page textarea', t => t.length);
    ok(n === 3 || n === 5, 'mock shows ' + n + ' questions');
    const answers = [
      'I would put a set in front of the list so the membership check is O(1). Keep a seen set and an output list, append on first sight. Time O(n), space O(n). For a stream I would bound the set with a TTL.',
      'A generator yields one item at a time and keeps its state, so memory stays flat. For a 50 GB file I read lines lazily, parse and filter with generator stages, and write in batches of a few thousand rows.',
      'At my last company I led the move of our reporting tables to a new pipeline. I compared old and new counts daily and we cut over after two weeks. It went fine.',
      'Kafka keeps order within a partition, so key by trip id.', 'I would design it with Kafka, Spark and Iceberg.'];
    const tas = await p.$$('#page textarea');
    for (let i = 0; i < tas.length; i++) await tas[i].fill(answers[i]);
    await p.click('button:has-text("Submit for grading")'); await p.click('.dialog button:has-text("Submit")'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => Object.values(S.mock).some(m => m.sub && m.qs.length >= 3)), 'mock submitted');
    const t = await sync(); ok(/Progress synced/.test(t), 'synced: ' + t);
  } else {
    const t = await sync(); ok(/Coach report/.test(t), 'sync brought the coach report: ' + t);
    await go('#/today', 900);
    const card = await p.textContent('#page');
    ok(/Coach/.test(card) && !/not run yet/.test(card), 'coach card shows the last run');
    const st = await p.evaluate(() => ({ coach: !!S.coach, due: revDue().map(x => x.id), mockDates: Object.keys(S.mock || {}) }));
    ok(st.coach, 'coach stored');
    ok(st.due.includes('d024'), 'struggled problem is due for review today: ' + st.due.join(','));
    const d = st.mockDates.sort().pop();
    await go('#/mock/' + d, 1200);
    const page = await p.textContent('#page');
    ok(/\/ 5/.test(page) && /Feedback:/.test(page), 'mock feedback with scores is visible');
    await go('#/coach', 800);
    ok(/Targeted practice/.test(await p.textContent('#page')), 'coach report page lists targeted practice');
  }
  errs.forEach(e => ok(false, 'page error ' + e));
  await ctx.close();
})();
