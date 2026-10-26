/* End-to-end test of instant grading: relay through the (fake) sync script, the direct path on the Mac,
   practice runs, the no-grader message, and that HTML in AI output is stripped.
   Needs: fake_sync on SYNC (with key) and grader.py serve on GRADER_PORT using stub_claude.py.
   node tools/grader/e2e_grader.js BASE SYNC_URL GRADER_PORT */
const { chromium } = require(process.env.PW || 'playwright');
const [BASE, SYNC, GPORT] = [process.argv[2] || 'http://localhost:8811/', process.argv[3], process.argv[4] || '8766'];
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const ctx = await b.newContext(); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let direct = false; /* the app always calls 127.0.0.1:8765; send it to the test grader only when direct is on */
  await ctx.route('http://127.0.0.1:8765/**', async r => { if (!direct) return r.abort(); const u = r.request().url().replace(':8765', ':' + GPORT); const res = await r.fetch({ url: u }); await r.fulfill({ response: res }); });
  await p.goto(BASE + '#/today'); await p.waitForTimeout(1200);
  await p.evaluate(u => { S.settings.syncUrl = u; save(); }, SYNC); await p.waitForTimeout(300);
  const g = k => p.evaluate(k => (S.grades || {})[k] || null, k);
  const waitGrade = async (k, ms) => { const t = Date.now(); while (Date.now() - t < ms) { const x = await g(k); if (x && x.s !== 'pending') return x; await p.waitForTimeout(500); } return g(k); };

  // 1. relay: interview answer graded through the sync script; a 4 ticks the question
  await p.goto(BASE + '#/interview/a01'); await p.waitForTimeout(1500);
  await p.locator('details summary', { hasText: 'Practise: write your answer' }).first().click();
  await p.locator('textarea[aria-label="Your answer"]').first().fill('A workflow is fixed steps; an agent loops and picks tools. I use workflows by default.');
  await p.locator('button', { hasText: 'Grade my answer' }).first().click();
  let x = await waitGrade('iv:a01:0', 40000);
  ok(x && x.s === 'done' && x.r.score === 4 && x.job, 'relay: interview answer graded through the sync script (' + JSON.stringify(x && { s: x.s, err: x.err }) + ')');
  await p.waitForTimeout(500);
  ok(await p.locator('.gradebox .badge', { hasText: '4 / 5' }).count() > 0, 'relay: score shown on the page');
  ok(await p.evaluate(() => !!(S.iv.a01 || {})[0]), 'relay: a score of 4 ticks the question as ready');

  // 2. direct on the Mac: Claude Code task graded without the relay
  direct = true;
  await p.goto(BASE + '#/cc/c01/2'); await p.waitForTimeout(1500);
  ok(await p.locator('h1', { hasText: 'The right keys for the job' }).count() === 1, 'cc page shows task 2');
  await p.locator('textarea[aria-label="Your submission"]').fill('1. Esc\n2. /clear\n3. ! python3 -m unittest -q\n4. claude -c\n5. Shift+Tab plan mode\n6. /context');
  await p.locator('button', { hasText: 'Grade my work' }).click();
  x = await waitGrade('cc:c01:1', 20000);
  ok(x && x.s === 'done' && !x.job && x.r.model === 'sonnet', 'direct: cc task graded on this Mac with the bigger model');
  await p.waitForTimeout(300);
  ok(await p.locator('summary', { hasText: 'What a strong answer covers' }).count() === 1, 'cc: rubric appears after grading');
  ok(await p.evaluate(() => S.code.cc_c01_2.includes('/context')), 'cc: submission saved');
  ok(await p.evaluate(() => !/(^|\n)null(\n|$)/.test(document.querySelector('#page').innerText)), 'cc: no stray "null" text on the page');

  // 3. editing the answer marks the grade as stale
  await p.locator('textarea[aria-label="Your submission"]').fill('changed');
  await p.goto(BASE + '#/cc/c01/1'); await p.goto(BASE + '#/cc/c01/2'); await p.waitForTimeout(1200);
  ok(await p.locator('.badge', { hasText: 'You edited your answer after this grade' }).count() === 1, 'grade marked as stale after an edit');

  // 3b. the coach bubble talks to Claude Code on the Mac when there is no API key
  await p.goto(BASE + '#/today'); await p.waitForTimeout(1200);
  await p.locator('button.fab').click(); await p.locator('.coach input[type=text]').fill('How do I start the diagnostic?');
  await p.locator('.coach button', { hasText: 'Send' }).click();
  let said = ''; for (let i = 0; i < 30 && !/Stub coach/.test(said); i++) { await p.waitForTimeout(500); said = await p.evaluate(() => document.querySelector('.coach .msgs').innerText); }
  ok(/Stub coach/.test(said), 'coach bubble: answered by Claude Code on the Mac (' + said.slice(-80) + ')');
  direct = false;
  await p.locator('.coach input[type=text]').fill('And through the relay?'); await p.locator('.coach button', { hasText: 'Send' }).click();
  said = ''; for (let i = 0; i < 40 && (said.match(/Stub coach/g) || []).length < 2; i++) { await p.waitForTimeout(500); said = await p.evaluate(() => document.querySelector('.coach .msgs').innerText); }
  ok((said.match(/Stub coach/g) || []).length >= 2, 'coach bubble: answered through the sync relay too');
  direct = true;

  ok(await p.evaluate(async () => { S.settings.aiKey = 'sk-ant-revoked'; let hitApi = false; const f = window.fetch; window.fetch = (u, o) => { if (/api\.anthropic\.com/.test(u)) { hitApi = true; return Promise.resolve(new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401 })); } return f(u, o); };
    const box = document.createElement('div'); await askCoach('what is today?', { title: 'Today' }, box); const okMac = /Stub coach/.test(box.innerText) && !hitApi;
    const keep = window.macCall; window.macCall = async () => { throw new Error('nograder'); }; const box2 = document.createElement('div'); await askCoach('q', { title: 't' }, box2); window.macCall = keep; window.fetch = f; S.settings.aiKey = '';
    return okMac && /rejected/.test(box2.innerText); }), 'coach bubble: Mac answers first even with a saved key; a rejected key is explained');
  ok(await p.evaluate(async () => { const keep = window.macCall; window.macCall = async () => ({ score: 1, verdict: 'x' }); const box = document.createElement('div'); await askCoach('q', { title: 't' }, box); window.macCall = keep; return /out of date/.test(box.innerText); }), 'coach bubble: an out-of-date grader on the Mac is explained');

  // 4. practice run in Claude Code shows the answer and its cost
  await p.goto(BASE + '#/learn/c03/lab'); await p.waitForTimeout(1500);
  await p.locator('textarea[aria-label="Your prompt for Claude Code"]').fill('Why are EU amounts wrong? 3 lines.');
  await p.locator('button', { hasText: 'Run in Claude Code' }).click();
  x = await waitGrade('run:c03_lab', 20000);
  ok(x && x.s === 'done' && x.r.turns === 3 && x.r.cost === 0.0021, 'run: practice run returned turns and cost');
  await p.waitForTimeout(400);
  ok(await p.locator('.chip', { hasText: 'Cost: $0.0021' }).count() === 1 && await p.locator('.chip', { hasText: '% from cache' }).count() === 1, 'run: metrics shown, including the cache share');
  await p.locator('button', { hasText: 'Run in Claude Code' }).click(); await waitGrade('run:c03_lab', 20000); await p.waitForTimeout(400);
  ok(await p.locator('summary', { hasText: 'Compare with your earlier runs' }).count() === 1, 'run: second run offers a comparison with the first');
  ok(await p.evaluate(() => !/(^|\n)null(\n|$)/.test(document.querySelector('#page').innerText)), 'run: no stray "null" text on the page');

  // 5. HTML in AI output is stripped
  await p.goto(BASE + '#/interview/a01'); await p.waitForTimeout(1200);
  const second = p.locator('details', { hasText: 'Practise: write your answer' }).nth(1);
  await second.locator('summary').click();
  await second.locator('textarea').fill('XSS test answer');
  await second.locator('button', { hasText: 'Grade' }).click();
  await waitGrade('iv:a01:1', 20000); await p.waitForTimeout(800);
  ok(await p.evaluate(() => !window.__xss && !document.querySelector('.gradebox [onerror]') && !document.querySelector('.gradebox a[href^="javascript"]')), 'AI output: event handlers and javascript links stripped');

  // 6. no grader anywhere: a clear setup message, nothing hangs
  direct = false; await p.evaluate(() => { S.settings.syncUrl = ''; save(); });
  await p.goto(BASE + '#/design/s01'); await p.waitForTimeout(1500);
  await p.locator('textarea[aria-label="Your answer for this step"]').fill('Requirements: 2M trips a day, freshness 5 minutes.');
  await p.locator('button', { hasText: 'Grade my design' }).click();
  x = await waitGrade('design:s01', 8000); await p.waitForTimeout(300);
  ok(x && x.s === 'error' && x.err === 'nograder' && await p.locator('.why', { hasText: 'install.sh' }).count() === 1, 'no grader: setup message instead of a spinner');

  // 7. grades are merged by sync like other progress
  ok(await p.evaluate(() => { const a = { grades: { k: { s: 'pending', job: 'j1', at: 5 } } }, b = { grades: { k: { s: 'done', job: 'j1', at: 3, r: { score: 5 } } } }; return mergeState(a, b).grades.k.s === 'done' && mergeState(b, a).grades.k.s === 'done'; }), 'sync merge: a finished grade beats a pending one for the same job');
  // 8. the cc test step ticks itself once every task scores 4 or more
  ok(await p.evaluate(() => { S.grades = S.grades || {}; [0, 1, 2].forEach(i => { S.grades['cc:c02:' + i] = { s: 'done', r: { score: 4 }, at: Date.now() }; }); const u = modUnits('c02').find(u => u.kind === 'cc'); return u && u.auto(); }), 'cc test step auto-completes when all tasks pass');

  errs.forEach(e => ok(false, 'page error: ' + e));
  console.log(fails ? fails + ' failed' : 'all passed');
  await b.close(); process.exit(fails ? 1 : 0);
})();
