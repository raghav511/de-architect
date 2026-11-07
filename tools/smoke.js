/* Every-feature smoke test: each feature used the way the learner uses it, checking what a person would notice
   (a reel makes sound and moves on, code prints output, a quiz scores), on Chromium (Mac) and WebKit (iPhone).
   node tools/smoke.js [baseUrl] [filter] [--engine chromium|webkit]
   Run before every ship against the local server and after every ship against the live site (tools/improve/LOOP.md).
   Stubs: the AI interviewer (api.anthropic.com) and the sync server (https://sync.test); never the real ones. */
const pw = require(process.env.PW || 'playwright');
const args = process.argv.slice(2);
const BASE = (args.find(a => /^http/.test(a)) || 'http://localhost:8811/').replace(/\/?$/, '/');
const FILTER = (args.find(a => !/^http|^--|^(chromium|webkit)$/.test(a)) || '').toLowerCase();
const ONLY = args.includes('--engine') ? [args[args.indexOf('--engine') + 1]] : ['chromium', 'webkit'];
const results = [];
function ok(c, m) { if (!c) throw new Error(m); }
const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
const AI = r => { if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: H }); const fu = /ONE follow-up/.test(r.request().postData() || ''); return r.fulfill({ headers: H, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: fu ? '{"followup":"What changes at 100 times the data?"}' : '{"scores":{"correct":3,"depth":3,"trade":2,"clear":3},"rejected":true,"limits":true,"operate":false,"feedback":"Name the limit.","better":"A stronger answer."}' }] }) }); };
/* records every Audio the page creates and every line a device voice speaks, so "it made sound" can be checked */
const SOUND = () => { window.__auds = []; const A = window.Audio; window.Audio = function (...a) { const x = new A(...a); window.__auds.push(x); return x; }; window.Audio.prototype = A.prototype;
  window.__spoke = []; const P = window.SpeechSynthesis && window.SpeechSynthesis.prototype; if (P && P.speak) { const sp = P.speak; P.speak = function (u) { window.__spoke.push(u.text); try { sp.call(this, u); } catch (e) { } setTimeout(() => { if (u.onend) u.onend(); }, 1500); }; } };

async function run(engine) {
  const browser = await pw[engine].launch();
  const opt = engine === 'webkit' ? Object.assign({}, pw.devices['iPhone 13']) : { viewport: { width: 1440, height: 900 } };
  async function S(name, fn, extra) {
    if (FILTER && !name.toLowerCase().includes(FILTER)) return;
    if (extra && extra.only && extra.only !== engine) return;
    /* Playwright's WebKit cannot route requests made under a service worker, so stubbed checks there run without it */
    const c = await browser.newContext(Object.assign({}, opt, engine === 'webkit' && extra && extra.stub ? { serviceWorkers: 'block' } : {})); await c.route('http://127.0.0.1:8765/**', r => r.abort());
    await c.route('https://api.anthropic.com/**', AI);
    const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { errs.push('native dialog'); d.dismiss(); });
    await p.addInitScript(SOUND);
    const t0 = Date.now();
    try { await fn(p, c); ok(!errs.length, 'page errors: ' + errs.slice(0, 3).join(' | ')); results.push(['PASS', engine, name, Date.now() - t0]); }
    catch (e) { results.push(['FAIL', engine, name, Date.now() - t0, e.message.split('\n')[0].slice(0, 240)]); await p.screenshot({ path: '/tmp/smoke_' + engine + '_' + name.replace(/\W+/g, '_').slice(0, 40) + '.png' }).catch(() => {}); }
    await c.close();
  }
  const boot = async (p, h) => { await p.goto(BASE + (h || '#/today')); await p.waitForSelector('h1', { timeout: 30000, state: 'attached' }); await p.waitForTimeout(700); };
  const nav = async (p, h, w) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(w || 700); };
  const txt = (p, s) => p.$eval(s || '#page', e => e.innerText).catch(() => '');
  const toast = p => p.$$eval('.toast', t => t.map(x => x.innerText).join(' | ')).catch(() => '');

  await S('Today: ticking Up next is kept after a reload, and the Coding tab shows the coding track', async p => {
    await boot(p);
    const id = await p.$eval('.upnext .unit', e => e.innerText.split('\n').find(l => l.length > 12));
    await p.click('.upnext .unit .check'); await p.waitForTimeout(500); await p.reload(); await p.waitForSelector('h1'); await p.waitForTimeout(600);
    ok(await p.evaluate(t => [...document.querySelectorAll('.unit.done')].some(u => u.innerText.includes(t)), id), 'the tick was lost: ' + id);
    if (await p.$('#tab-grp-coding')) { await p.click('#tab-grp-coding'); await p.waitForTimeout(200); ok(/Coding track/.test(await txt(p, '.plan')), 'Coding tab did not show the coding track'); }
  });

  await S('Reels: a recorded reel plays its Heart recording and moves to the next line', async p => {
    await boot(p);
    const id = await p.evaluate(async () => { for (const m of MODS) { const r = (await reelsFor(m)).find(x => x.beats.length > 1 && x.beats.every(b => b.audio)); if (r) return r.id; } return null; });
    ok(id, 'no fully recorded reel found');
    await nav(p, '#/reels/' + id, 1500); await p.click('.rstart');
    const cap0 = await txt(p, '.rslide.playing .rcap'); await p.waitForTimeout(4000);
    const heard = await p.evaluate(() => (window.__auds || []).some(a => a.currentTime > 0.5 && !a.error) || (window.__spoke || []).length > 0);
    /* Playwright's WebKit has no AAC decoder, so there only the moving on is checked; real Safari is checked in the iOS Simulator */
    if (engine !== 'webkit') ok(heard, 'no sound after 4 s (recording did not play and no device voice spoke)');
    let moved = false; for (let i = 0; i < 25 && !moved; i++) { await p.waitForTimeout(1000); moved = (await txt(p, '.rslide.playing .rcap')) !== cap0 || !!(await p.$('.rslide .rendcard')); }
    ok(moved, 'stuck on the first line for 29 s');
  });

  await S('Reels: a reel not yet recorded is spoken by a device voice', async p => {
    await boot(p);
    const id = await p.evaluate(async () => { for (const m of MODS) { const r = (await reelsFor(m)).find(x => x.beats.every(b => !b.audio)); if (r) return r.id; } return null; });
    if (!id) return; /* everything is recorded: nothing to check */
    await nav(p, '#/reels/' + id, 1500); await p.click('.rstart'); await p.waitForTimeout(2500);
    ok(await p.evaluate(() => (window.__spoke || []).length > 0 || !window.speechSynthesis), 'played silently');
  });

  await S('Reels: the heart saves the work list to My playbook', async p => {
    await boot(p);
    const id = await p.evaluate(async () => (await reelsFor('s05')).find(r => r.work).id);
    await nav(p, '#/reels/' + id, 1500); await p.click('.rslide .rheart'); await p.waitForTimeout(300);
    await p.goto(BASE + '#/playbook'); await p.waitForSelector('h1'); await p.waitForTimeout(600);
    ok(await p.evaluate(i => !!(S.playbook || {})[i], id) && (await txt(p)).length > 60, 'playbook is empty after saving');
  });

  await S('Coding: Run executes Python and prints test results', async p => {
    await boot(p, '#/py/y011'); await p.waitForTimeout(800);
    await p.locator('button', { hasText: /^Run/ }).first().click();
    let t = ''; for (let i = 0; i < 90 && !/passed|failed|Error|Traceback|✓|✗/.test(t); i++) { await p.waitForTimeout(1000); t = await p.$eval('.out, .output, #page', e => e.innerText).catch(() => ''); }
    ok(/passed|failed|Error|Traceback|✓|✗/.test(t) && !/Could not start Python/.test(t), 'no output after 90 s: ' + t.slice(-160));
  });

  await S('Quiz: answer every question, submit, and see a score', async p => {
    await boot(p, '#/quiz/a01'); await p.waitForTimeout(500);
    const n = await p.$$eval('.pal button', b => b.length); ok(n > 3, 'quiz has ' + n + ' questions');
    for (let i = 0; i < n; i++) { await p.click('.pal button >> nth=' + i); await p.waitForTimeout(80); if (await p.$('.opt')) await p.click('.opt >> nth=0'); else if (await p.$('#page input[type=text]')) await p.fill('#page input[type=text]', 'x'); else if (await p.$('#page textarea')) await p.fill('#page textarea', 'an answer'); }
    await p.click('#page button:has-text("Submit")'); await p.click('.dialog button:has-text("Submit")'); await p.waitForTimeout(700);
    ok(/\d+\s*%|\d+ of \d+|score/i.test(await txt(p)) && await p.evaluate(() => !!(S.quiz.a01 || {}).sub), 'no score after submitting');
  });

  await S('Live mock: questions, a typed answer, an AI follow-up and a score', async p => {
    await boot(p); await p.evaluate(() => { S.settings.ai = true; S.settings.aiKey = 'test-key'; S.live = {}; save(); });
    await nav(p, '#/live', 1500); await p.waitForSelector('.lslots li');
    await p.click('#page button.pri:has-text("Start")'); await p.waitForSelector('#page textarea');
    await p.fill('#page textarea', 'A log with partitions keyed by trip, idempotent sink, checkpoints.'); await p.click('#page button:has-text("Done")');
    await p.waitForSelector('.lfu, #page [role=radiogroup][aria-label=Correctness]', { timeout: 15000 });
    if (await p.$('.lfu')) { await p.fill('#page textarea', 'Add partitions, watch lag'); await p.click('#page button:has-text("Done")'); }
    else { for (const g of await p.$$('#page [role=radiogroup], #page .lrate')) { const b = await g.$('button:nth-child(3)'); if (b) await b.click(); } const sv = await p.$('#page button:has-text("Save my marks")'); if (sv) await sv.click(); }
    await p.waitForSelector('.lscore', { timeout: 15000 }); const sc = await txt(p, '.lscore'); ok(/[1-4]/.test(sc) && /correct|depth|trade|clear/i.test(sc), 'no score shown: ' + sc.slice(0, 120));
  }, { stub: true });

  await S('Simulator: open a module challenge, run it and get graded', async p => {
    await boot(p, '#/design/s10'); await p.click('.simmod .simsc'); await p.waitForSelector('#sim_check');
    await p.click('#sim_check'); await p.waitForSelector('.simresult .item', { timeout: 15000 });
    ok(/✓|✗/.test(await txt(p, '.simresult')), 'no grade');
  });

  await S('Interview loop: read the code, tap the bug line, fix it and the real Python tests pass; a STAR story saves', async p => {
    await boot(p, '#/loop/cc/cc12'); await p.waitForSelector('.lplines', { timeout: 20000 }); await p.click('.lpopt >> nth=1'); await p.click('.lpln[data-line="2"]');
    await p.fill('.lpfix', 'def page(rows, page_no, size):\n    start = (page_no - 1) * size\n    return rows[start:start + size]'); await p.click('button:has-text("Run the tests")');
    await p.waitForSelector('.badge:has-text("Tests pass")', { timeout: 90000 });
    await boot(p, '#/loop/r5/stories'); await p.click('button:has-text("+ New story")'); await p.fill('.lptitle', 'Smoke story'); await p.click('button:has-text("All stories")');
    ok(/Smoke story/.test(await txt(p, '.lpstory')), 'story not listed');
  });

  await S('Sync: progress from the other device merges in and this device uploads', async (p, c) => {
    let posted = null;
    await c.route('https://sync.test/**', r => r.request().method() === 'POST' ? (posted = JSON.parse(r.request().postData()).data, r.fulfill({ headers: H, contentType: 'application/json', body: '{"ok":true}' })) : r.fulfill({ headers: H, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { start: '2026-10-19', done: { 'other:step': '2026-11-01' }, solved: {}, updated: 1 } }) }));
    await boot(p); await p.evaluate(() => { S.settings.syncUrl = 'https://sync.test/exec?k=test'; S.done['this:step'] = '2026-11-02'; save(); return doSync(); }); await p.waitForTimeout(600);
    ok(/synced/i.test(await toast(p)) && posted && posted.done['other:step'] && posted.done['this:step'], 'sync did not merge both devices: ' + await toast(p));
  }, { stub: true });

  await S('Every section opens and shows content', async p => {
    await boot(p);
    const hs = await p.evaluate(() => { const wk = schedule().cur; return [...new Set(NAV.map(x => x[0]).concat(['#/live', '#/profile', '#/warm', '#/learn/d01', '#/path/s05', '#/interview/s05', '#/dsa/d011', '#/sql/q011', '#/news']))].map(h => h.replace('/0', '/' + wk)); });
    const bad = [];
    for (const h of hs) { await nav(p, h, h === '#/terminal' ? 1500 : 700); const t = await txt(p, 'body'); if (t.length < 80 || /Something went wrong|Could not load/.test(t)) bad.push(h); }
    ok(!bad.length, 'empty or broken: ' + bad.join(', '));
  });

  await S('Lessons: a chapter figure steps forward', async p => {
    await boot(p, '#/learn/d01'); await p.waitForTimeout(600);
    const f = await p.$('[data-fig] svg, .dfig svg'); ok(f, 'no figure in the D1 chapter');
    const before = await p.$eval('.dfig', e => e.innerHTML.length).catch(() => 0);
    const nx = await p.$('.dfig button[aria-label*="ext"], .dfig button:has-text("›")'); ok(nx, 'no next step button');
    await nx.click(); await p.waitForTimeout(300); ok(await p.$eval('.dfig', e => e.innerHTML.length).catch(() => 0) !== before, 'the figure did not change');
  });

  await S('Search: typing finds lessons and opening one goes there', async p => {
    await boot(p); await p.click('button[aria-label="Search"]'); await p.waitForTimeout(200);
    await p.keyboard.type('kafka'); await p.waitForTimeout(500);
    const n = await p.$$eval('.search a, .sresults a, [role=listbox] [role=option], [role=dialog] a', a => a.length); ok(n > 0, 'no results for kafka');
    await p.keyboard.press('Enter'); await p.waitForTimeout(600); ok(!/#\/today$/.test(p.url()), 'Enter did not open a result');
  });

  await S('Warm-up: a question appears and an answer is scored', async p => {
    await boot(p, '#/warm'); await p.waitForSelector('.gwarm .gq-q', { timeout: 10000 });
    if (await p.$('.gwarm .gopt')) await p.click('.gwarm .gopt'); else { await p.fill('.gwarm input', 'x'); await p.click('.gwarm button.pri'); }
    await p.waitForTimeout(800); await p.evaluate(() => window.warmFinish && window.warmFinish()); await p.waitForTimeout(400);
    ok(/right/.test(await txt(p, '.gwarm')), 'warm-up did not score');
  });

  await S('Profile: settings save, and Update opens the version dialog', async p => {
    await boot(p, '#/profile'); await p.click('#pt_look'); await p.fill('#st_name', 'Sam'); await p.dispatchEvent('#st_name', 'change'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => S.settings.name === 'Sam'), 'name not saved');
    const u = await p.$('button:has-text("Update")'); ok(u, 'no Update button'); await u.click(); await p.waitForTimeout(1200);
    ok(await p.$('.dialog') || /up to date|available|version/i.test(await toast(p)), 'Update did nothing');
  });

  await S('Offline: after one visit, the app reopens with no network', async (p, c) => {
    await boot(p); await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(async () => { await p.reload(); await p.waitForTimeout(2000); });
    await c.setOffline(true); await p.goto(BASE + '#/today').catch(() => p.reload()); await p.waitForSelector('h1', { timeout: 20000, state: 'attached' });
    ok(/Reading|Up next|Today/.test(await txt(p)), 'Today did not open offline');
  }, { only: 'chromium' }); /* Playwright's WebKit cannot reload a page offline ("internal error") */

  await S('Terminal: a real Linux boots and answers a command', async p => {
    await boot(p, '#/terminal');
    let t = ''; for (let i = 0; i < 120 && !/[$#] ?$|~[#$]|login/m.test(t); i++) { await p.waitForTimeout(1000); t = await p.$eval('.xterm-rows', e => e.innerText).catch(() => ''); }
    ok(/[$#]|login/.test(t), 'no shell prompt after 120 s');
  }, { only: 'chromium' });

  await browser.close();
}

(async () => {
  for (const e of ONLY) await run(e);
  for (const r of results) console.log(r[0].padEnd(5), r[1].padEnd(9), r[2], '(' + Math.round(r[3] / 1000) + ' s)' + (r[4] ? '\n      ' + r[4] : ''));
  const f = results.filter(r => r[0] === 'FAIL').length;
  console.log((results.length - f) + ' passed, ' + f + ' failed');
  process.exit(f ? 1 : 0);
})();
