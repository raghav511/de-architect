/* Trust and data-safety regression tests from the QA lead review (2026-11-07). node tools/qa_trust.js [baseUrl] [filter]
   Each case is a way the app could lose data, mislead, show stale data or fail silently; it runs in a fresh browser
   context against the real app. The sync server is a stub on https://sync.test (never the learner's real one). */
const { chromium } = require(process.env.PW || 'playwright');
const BASE = (process.argv[2] && /^http/.test(process.argv[2])) ? process.argv[2] : 'http://localhost:8811/';
const FILTER = process.argv.find(a => !/^http/.test(a) && a !== process.argv[0] && a !== process.argv[1]) || '';
const results = [];
let browser;
function ok(cond, msg) { if (!cond) throw new Error(msg); }
async function T(id, name, fn, opt) {
  if (FILTER && !(id + ' ' + name).toLowerCase().includes(FILTER.toLowerCase())) return;
  const c = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 860 }, acceptDownloads: true }, opt || {}));
  await c.route('http://127.0.0.1:8765/**', r => r.abort()); /* never reach a real grader on this Mac */
  const p = await c.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message)); p.on('dialog', d => { p.errs.push('native dialog: ' + d.message()); d.dismiss(); });
  try { await fn(p, c); if (p.errs.length) throw new Error('page errors: ' + p.errs.join(' | ')); results.push(['PASS', id, name]); }
  catch (e) { results.push(['FAIL', id, name, e.message.split('\n')[0]]); }
  await c.close();
}
const boot = async (p, h) => { await p.goto(BASE + (h || '#/today')); await p.waitForSelector('h1', { timeout: 30000 }); await p.waitForTimeout(600); };
const seed = async (p, fn, arg) => { await p.evaluate(fn, arg); await p.evaluate(() => { clearTimeout(saveT); saveT = null; localStorage.setItem('keystone:v1', JSON.stringify(S)); }); await p.reload(); await p.waitForSelector('h1', { timeout: 30000 }); await p.waitForTimeout(500); };
const toasts = p => p.$$eval('.toast', ts => ts.map(t => t.innerText).join(' | ')).catch(() => '');
/* a stub sync server: GET ?action=load returns `remote`, POST saves into it */
async function syncStub(c, remote, opts) {
  const log = { gets: 0, posts: 0, saved: null };
  await c.route('https://sync.test/**', async r => {
    const q = r.request();
    if (q.method() === 'POST') { log.posts++; log.saved = JSON.parse(JSON.parse(q.postData()).data ? q.postData() : '{}').data; return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
    log.gets++;
    if (opts && opts.load) return opts.load(r);
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: remote }) });
  });
  return log;
}
const syncNow = async p => { await p.evaluate(() => { S.settings.syncUrl = 'https://sync.test/exec?k=test'; return doSync(); }); await p.waitForTimeout(400); };

(async () => {
  browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});

  await T('Q01', 'sync keeps the other device\'s live mocks, reel checks, playbook, ticks, tabs, Git labs and streak days', async (p, c) => {
    await boot(p);
    const remote = { start: '2026-10-19', done: {}, solved: {}, updated: 1, live: { '2026-11-05': { done: true, t: 5 } }, reels: { 'p03-p31-w0': { seen: '2026-11-05', ans: 1, ok: true, at: 5 } }, playbook: { 'p03-p31-w0': { title: 'iPhone save', items: ['a'] } }, xdone: { '2026-11-05': { 'rq:x': 5 } }, rq: { q1: 1 }, tabs: { 'p01:chapter': 'h1' }, gitlab: { 3: 1 }, game: { days: { '2026-11-05': { step: 2 } }, shipped: { p01: 1 }, warm: {} } };
    const log = await syncStub(c, remote);
    await p.evaluate(() => { S.live = { '2026-11-06': { done: true, t: 6 } }; S.reels = { 's05-52-0': { seen: '2026-11-06' } }; S.playbook = { 's05-52-0': { title: 'Mac save', items: ['b'] } }; S.xdone = { '2026-11-06': { 'rq:y': 6 } }; S.rq = { q2: 1 }; S.tabs = { 'p02:chapter': 'h2' }; S.gitlab = { 4: 1 }; S.game = { days: { '2026-11-06': { step: 1 } }, shipped: {}, warm: {} }; save(); });
    await syncNow(p);
    const s = await p.evaluate(() => S), up = log.saved || {};
    for (const [k, a, b] of [['live', '2026-11-05', '2026-11-06'], ['reels', 'p03-p31-w0', 's05-52-0'], ['playbook', 'p03-p31-w0', 's05-52-0'], ['xdone', '2026-11-05', '2026-11-06'], ['rq', 'q1', 'q2'], ['tabs', 'p01:chapter', 'p02:chapter'], ['gitlab', '3', '4']])
      ok(s[k] && s[k][a] && s[k][b] && up[k] && up[k][a] && up[k][b], k + ': one device\'s entry was dropped: ' + JSON.stringify(s[k]));
    ok(s.game.days['2026-11-05'] && s.game.days['2026-11-06'] && s.game.shipped.p01, 'streak days or shipped modules dropped');
  });

  await T('Q02', 'a sync whose download fails never uploads this device\'s copy over the server\'s', async (p, c) => {
    await boot(p);
    const log = await syncStub(c, null, { load: r => r.fulfill({ status: 500, contentType: 'text/html', body: '<html>Service unavailable</html>' }) });
    await syncNow(p);
    ok(log.posts === 0, 'uploaded ' + log.posts + ' time(s) without reading the server first');
    ok(/Sync failed/.test(await toasts(p)), 'no failure message: ' + await toasts(p));
  });

  await T('Q03', 'two open tabs: a tick in one is not wiped out by a save in the other', async (p, c) => {
    await boot(p);
    const p2 = await c.newPage(); await p2.goto(BASE + '#/today'); await p2.waitForSelector('h1'); await p2.waitForTimeout(600);
    await p.evaluate(() => { S.done['s00:S001'] = iso(new Date()); S.doneAt['s00:S001'] = Date.now(); save(); }); await p.waitForTimeout(400);
    await p2.evaluate(() => { S.settings.reelSpeed = 1; save(); }); await p2.waitForTimeout(400);
    const kept = await p.evaluate(() => !!JSON.parse(localStorage.getItem('keystone:v1')).done['s00:S001']);
    ok(kept, 'the other tab saved its stale copy over the tick');
  });

  await T('Q04', 'Export progress leaves out the API key and the sync URL with its key', async p => {
    await boot(p, '#/progress');
    await p.evaluate(() => { S.settings.aiKey = 'sk-ant-test-secret'; S.settings.syncUrl = 'https://sync.test/exec?k=topsecret'; save(); });
    const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => exportProgress())]);
    const t = require('fs').readFileSync(await dl.path(), 'utf8');
    ok(!/sk-ant-test-secret|topsecret/.test(t), 'the backup file contains the API key or sync key');
    ok(/"done"/.test(t), 'backup lost the progress');
  });

  await T('Q05', 'restoring a backup keeps this device\'s API key and sync URL', async p => {
    await boot(p, '#/progress');
    await p.evaluate(() => { S.settings.aiKey = 'sk-ant-mine'; S.settings.syncUrl = 'https://sync.test/exec?k=mine'; save(); });
    const f = '/tmp/qa_backup.json'; require('fs').writeFileSync(f, JSON.stringify({ start: '2026-10-19', done: { 's00:S001': '2026-10-20' }, solved: {}, settings: { aiKey: '', syncUrl: 'https://other/exec?k=old', theme: 'dark' } }));
    await p.evaluate(() => { const i = document.createElement('input'); i.type = 'file'; i.id = 'qaimp'; i.onchange = importProgress; document.body.appendChild(i); });
    await p.setInputFiles('#qaimp', f); await p.waitForTimeout(500);
    const s = await p.evaluate(() => [S.settings.aiKey, S.settings.syncUrl, !!S.done['s00:S001']]);
    ok(s[0] === 'sk-ant-mine' && /k=mine/.test(s[1]) && s[2], 'restore replaced this device\'s secrets: ' + JSON.stringify(s.slice(0, 2)));
  });

  await T('Q06', 'scraped interview text cannot run code in the app (company questions page)', async (p, c) => {
    await c.route('**/data/recent.json*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ updated: '2026-11-07', items: [{ id: 'x1', mid: 'p01', company: 'Evil', found: '2026-11-07', TAG: 'py', Q: 'Q <img src=x onerror="window.__pwn=1">', A: 'A <script>window.__pwn=2</script><a href="javascript:window.__pwn=3">x</a>', src: 's', url: 'https://example.com' }] }) }));
    await boot(p, '#/recent'); await p.waitForTimeout(500);
    await p.$$eval('details', ds => ds.forEach(d => d.open = true)); await p.$$eval('a[href^="javascript"]', as => as.forEach(a => a.click())).catch(() => {}); await p.waitForTimeout(300);
    ok(!(await p.evaluate(() => window.__pwn)), 'HTML in the question ran: ' + await p.evaluate(() => window.__pwn));
    ok(!(await p.$('a[href^="javascript"]')), 'a javascript: link was kept');
  });

  await T('Q07', 'a question found 10 days ago is not labelled "Asked this week"', async (p, c) => {
    const old = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
    await c.route('**/data/recent.json*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ updated: old, items: [{ id: 'old1', mid: 's00', company: 'Acme', found: old, TAG: 'py', Q: 'An older question', A: 'a', src: 's', url: 'https://example.com' }] }) }));
    await boot(p); await p.waitForTimeout(800);
    const row = await p.evaluate(() => { let e = [...document.querySelectorAll('#page *')].find(x => x.children.length === 0 && /Acme: An older question/.test(x.textContent)); for (let i = 0; e && i < 5 && !/Asked|Found/.test(e.innerText); i++) e = e.parentElement; return e ? e.innerText : ''; });
    ok(row, 'the question is not on Today');
    ok(!/Asked this week/.test(row), 'labelled as this week: ' + row.replace(/\s+/g, ' '));
  });

  await T('Q08', 'a reel recording that never arrives (bad signal) does not freeze the reel', async (p, c) => {
    await c.route('**/audio/reels/**', () => { /* never answers */ });
    await boot(p, '#/reels/s05-52-0'); await p.waitForTimeout(800);
    await p.click('.rstart');
    const cap = () => p.$eval('.rslide.playing .rcap', e => e.innerText).catch(() => '');
    const b0 = await cap(); await p.waitForTimeout(30000); const b1 = await cap();
    ok(b0 && b0 !== b1, 'still on the first line after 30 s');
  });

  await T('Q09', 'a review scheduled on a reel that was rewritten moves to its new reel', async p => {
    await boot(p);
    const ids = await p.evaluate(async () => (await reelsFor('p03')).filter(r => /^p03-p31-/.test(r.id)).map(r => r.id));
    ok(ids.length, 'no reels for P3.1');
    const today = await p.evaluate(() => iso(new Date()));
    await seed(p, t => { S.reels = { 'p03-p31-0': { seen: '2026-11-01', ans: 2, ok: false, box: 0, due: t } }; }, today);
    const q = await p.evaluate(async () => { for (const k in reelCache) delete reelCache[k]; return (await reelQueue()).map(r => r.id); });
    const s = await p.evaluate(() => S.reels);
    ok(q.some(id => /^p03-p31-/.test(id)) && Object.keys(s).some(k => /^p03-p31-w/.test(k) && s[k].due), 'the review disappeared: ' + JSON.stringify(s));
  });

  await T('Q10', 'an answer saved for an older version of a reel\'s check is not shown on the new question', async p => {
    await boot(p);
    const id = await p.evaluate(async () => (await reelsFor('s05')).find(r => r.check).id);
    await seed(p, i => { S.reels = { [i]: { seen: '2026-11-01', ans: 0, ok: false, q: 'an old question' } }; }, id);
    await p.evaluate(i => { location.hash = '#/reels/' + i; }, id); await p.waitForTimeout(1200);
    await p.evaluate(() => { for (let i = 0; i < 8; i++) document.querySelector('.rslide.on') && reelGo; });
    const marked = await p.evaluate(i => { const r = reelCache.s05.find(x => x.id === i); const d = document.createElement('div'); d.append(...reelEnd(r, () => {}, () => {})); return d.querySelectorAll('.ropt.ok,.ropt.no').length; }, id);
    ok(marked === 0, marked + ' option(s) marked from the old question');
  });

  await T('Q11', 'turning on update notifications when the browser has blocked them says so and turns the switch off', async p => {
    await p.addInitScript(() => { Object.defineProperty(window, 'Notification', { value: Object.assign(function () { }, { permission: 'denied', requestPermission: () => Promise.resolve('denied') }) }); });
    await boot(p, '#/profile'); await p.click('#pt_look').catch(() => {}); await p.click('#pt_sync').catch(() => {});
    const box = await p.$('#st_notify'); ok(box, 'no notification switch');
    await box.click(); await p.waitForTimeout(600);
    const s = await p.evaluate(() => S.settings.notifyUpdates);
    ok(!s && /blocked|not allowed/i.test(await toasts(p)), 'switch stayed on silently: ' + s + ' ' + await toasts(p));
  });

  await T('Q12', 'an AI score reply with missing numbers is not turned into a silent 1 of 4', async p => {
    await boot(p);
    const r = await p.evaluate(async () => { window.liveAsk = async () => '{"scores":{"correct":4,"depth":"great"},"feedback":"ok"}'; try { const x = await liveScore({ level: 'staff' }, { q: 'q', points: ['a'], model: '' }, { a: 'answer' }); return JSON.stringify(x.sc); } catch (e) { return 'threw'; } });
    ok(r === 'threw', 'partial reply scored as ' + r);
  });

  await T('Q13', 'AI scorecards say the scores come from an AI that can be wrong', async p => {
    await boot(p);
    const t = await p.evaluate(() => { const d = document.createElement('div'); liveCard(d, iso(new Date()), { level: 'staff', route: 'key', qs: [{ label: 'Concept', q: 'What is a WAL?', points: ['p'], model: '' }], ans: { 0: { a: 'x', sc: { correct: 4, depth: 4, trade: 4, clear: 4 }, checks: {}, fb: 'good' } } }); return d.innerText; });
    ok(/AI|can be wrong/i.test(t) && /can be wrong/i.test(t), 'no caveat on the AI verdict');
  });

  await T('Q14', 'HTML in an AI interviewer\'s "better answer" cannot run code', async p => {
    await boot(p);
    await p.evaluate(() => { const d = document.createElement('div'); document.body.appendChild(d); liveCard(d, iso(new Date()), { level: 'staff', qs: [{ label: 'C', q: 'q', points: [], model: 'm' }], ans: { 0: { a: 'x', sc: { correct: 2, depth: 2, trade: 2, clear: 2 }, checks: {}, fb: 'f', better: 'Try <img src=x onerror="window.__ai=1"> this' } } }); d.querySelectorAll('details').forEach(x => x.open = true); });
    await p.waitForTimeout(400);
    ok(!(await p.evaluate(() => window.__ai)), 'AI output ran as code');
  });

  await T('Q15', 'when the browser cannot save (storage full or private mode), the learner is told', async p => {
    await boot(p);
    await p.evaluate(() => { Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); }; S.done['s00:S001'] = iso(new Date()); save(); });
    await p.waitForTimeout(500);
    ok(/Could not save/.test(await toasts(p)), 'no message: ' + await toasts(p));
  });

  await T('Q16', 'the week number is right the day after clocks go back (US daylight saving ends 1 Nov 2026)', async p => {
    await p.clock.install({ time: new Date('2026-11-02T08:30:00-08:00') });
    await boot(p);
    const r = await p.evaluate(() => { S.start = '2026-10-26'; S.week = null; return [dayIndex(), curWeek(), curDay()]; });
    ok(r[0] === 7 && r[1] === 2 && r[2] === 0, 'day index, week, day = ' + r);
  }, { timezoneId: 'America/Los_Angeles' });

  await T('Q17', 'Reels open even when the reel scripts cannot load (offline on first visit)', async (p, c) => {
    await c.route('**/data/reels.json*', r => r.abort());
    await boot(p, '#/reels'); await p.waitForTimeout(1500);
    const n = await p.$$eval('.reelv .rslide', s => s.length), t = await p.$eval('#page', e => e.innerText);
    ok(n > 0 || /No reels/i.test(t), 'no reels and no message: ' + t.slice(0, 200));
  });

  await T('Q18', 'the Weak spots filter with nothing weak explains itself instead of showing an empty feed', async p => {
    await boot(p);
    await seed(p, () => { S.reels = {}; S.settings.reelMode = 'shuffle'; S.settings.reelFilter = 'weak'; });
    await p.evaluate(() => { location.hash = '#/reels'; }); await p.waitForTimeout(1500);
    ok(/Nothing matches that filter/i.test(await toasts(p)) && await p.$('.reelv .rslide'), 'no explanation, or no feed: ' + await toasts(p));
  });

  await T('Q19', 'an empty playbook says how to fill it', async p => {
    await boot(p, '#/playbook'); await p.waitForTimeout(500);
    ok(/♥|heart|save/i.test(await p.$eval('#page', e => e.innerText)), 'empty playbook gives no hint');
  });

  await T('Q20', 'restoring a file that is not a backup changes nothing and says so', async p => {
    await boot(p, '#/progress');
    await p.evaluate(() => { S.done['s00:S001'] = '2026-10-20'; save(); });
    const f = '/tmp/qa_notbackup.json'; require('fs').writeFileSync(f, '{"hello": "world"}');
    await p.evaluate(() => { const i = document.createElement('input'); i.type = 'file'; i.id = 'qaimp'; i.onchange = importProgress; document.body.appendChild(i); });
    await p.setInputFiles('#qaimp', f); await p.waitForTimeout(500);
    ok(await p.evaluate(() => !!S.done['s00:S001'] && !S.hello), 'state changed'); ok(/not a Data Architect backup/.test(await toasts(p)), 'no message');
  });

  await T('Q21', 'a row ticked on Today and later unticked on another device stays unticked after sync', async (p, c) => {
    await boot(p);
    const k = await p.evaluate(() => iso(new Date()));
    const log = await syncStub(c, { start: '2026-10-19', done: {}, solved: {}, updated: 1, xdone: { [k]: { 'rq:z': 1000 } } });
    await p.evaluate(k => { S.xdone = { [k]: { 'rq:z': -Date.now() } }; save(); }, k);
    await syncNow(p);
    ok(await p.evaluate(k => !xDone(k, { id: 'rq:z' }), k), 'the untick was undone by the other device\'s old tick');
  });

  await T('Q22', 'company questions page says it is refreshed daily (the routine runs every evening)', async p => {
    await boot(p, '#/recent');
    ok(!/refreshed weekly/i.test(await p.$eval('body', e => e.innerText)), 'still says weekly');
  });

  await T('Q23', 'a reel with no recording yet is read aloud by a device voice, not played silently', async p => {
    await p.addInitScript(() => { window.__spoke = []; const fake = { speaking: false, speak: u => { window.__spoke.push(u.text); setTimeout(() => u.onend && u.onend(), 300); }, cancel: () => { }, getVoices: () => [], addEventListener: () => { } }; Object.defineProperty(window, 'speechSynthesis', { value: fake }); window.SpeechSynthesisUtterance = function (t) { this.text = t; }; });
    await boot(p);
    const id = await p.evaluate(async () => { const all = []; for (const m of ['p03', 's05', 'a01']) (await reelsFor(m)).forEach(r => all.push(r)); const r = all.find(x => x.beats && x.beats.every(b => !b.audio)); return r && r.id; });
    ok(id, 'no reel without a recording to test with');
    await p.evaluate(i => { location.hash = '#/reels/' + i; }, id); await p.waitForTimeout(1200);
    await p.click('.rstart'); await p.waitForTimeout(1500);
    ok(await p.evaluate(() => window.__spoke.length > 0), 'the reel played silently');
  });

  await T('Q24', 'the page refuses scripts that were not shipped with the app (Content-Security-Policy)', async p => {
    await boot(p);
    const r = await p.evaluate(async () => { const s = document.createElement('script'); s.textContent = 'window.__inl = 1'; document.head.appendChild(s); const x = document.createElement('script'); x.src = 'https://example.com/evil.js'; document.head.appendChild(x); await new Promise(r => setTimeout(r, 800)); return [!!document.querySelector('meta[http-equiv="Content-Security-Policy"]'), window.__inl || 0]; });
    p.errs = p.errs.filter(e => !/Content Security Policy|Refused/.test(e));
    ok(r[0] && !r[1], 'no policy, or an injected inline script ran: ' + r);
  });

  await T('Q25', 'the public repository holds no keys, sync URLs or personal data (tools/secret_scan.py --all)', async () => {
    const r = require('child_process').spawnSync('python3', ['tools/secret_scan.py', '--all'], { encoding: 'utf8' });
    ok(r.status === 0, (r.stdout || r.stderr).slice(0, 300));
  });

  /* a stand-in for Google's button: clicking it hands the app an ID token for learner@example.com */
  const fakeGoogle = () => { const b64 = o => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); const tok = n => b64({ alg: 'none' }) + '.' + b64(Object.assign({ email: 'learner@example.com', given_name: 'Sam', aud: 'test-client' }, n ? { nonce: n } : {})) + '.sig';
    window.google = { accounts: { id: { initialize: o => { window.__gcb = o.callback; window.__gnonce = o.nonce; }, renderButton: el => { const b = document.createElement('button'); b.className = 'gsi-fake'; b.textContent = 'Sign in with Google'; b.onclick = () => window.__gcb({ credential: tok(window.__gnonce) }); el.appendChild(b); const o = document.createElement('button'); o.className = 'gsi-other'; o.textContent = 'token from another app'; o.onclick = () => window.__gcb({ credential: tok('') }); el.appendChild(o); }, disableAutoSelect: () => { }, prompt: () => { } } } }; };
  const authStub = async c => { const log = { logins: 0, sess: [] }; await c.route('https://sync.test/**', r => { const b = JSON.parse(r.request().postData() || '{}'); if (b.action === 'login') { log.logins++; return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, session: 'sess' + log.logins, exp: Date.now() + 864e5 }) }); } if (b.session) log.sess.push(b.action + ':' + b.session); if (b.session && log.expired) return r.fulfill({ contentType: 'application/json', body: '{"ok":false,"error":"session expired: sign in again"}' }); return r.fulfill({ contentType: 'application/json', body: JSON.stringify(b.action === 'load' ? { ok: true, data: { start: '2026-10-19', done: { 'other:step': '2026-11-01' }, solved: {}, updated: 1 } } : { ok: true }) }); }); return log; };

  await T('Q26', 'Sign in with Google: the top right offers it, Profile signs in, and sync then uses the 24-hour session', async (p, c) => {
    await p.addInitScript(fakeGoogle); const log = await authStub(c);
    await boot(p); await p.evaluate(() => { S.settings.googleClientId = 'test-client'; S.settings.syncUrl = 'https://sync.test/exec'; save(); route(); }); await p.waitForTimeout(300);
    ok(await p.$('.authtop'), 'no Sign in button at the top right');
    await p.click('.authtop'); await p.waitForSelector('.authprof .gsi-fake'); await p.click('.authprof .gsi-fake'); await p.waitForTimeout(800);
    const a = await p.evaluate(() => authGet());
    ok(a && a.email === 'learner@example.com' && a.session === 'sess1' && a.exp > Date.now() + 23 * 36e5, 'not signed in for 24 hours: ' + JSON.stringify(a));
    ok(log.sess.includes('load:sess1') && log.sess.includes('save:sess1'), 'sync did not use the session: ' + log.sess);
    ok(!(await p.$('.authtop')) && /Signed in as learner@example.com/.test(await p.$eval('.authprof', e => e.innerText)), 'Profile does not show who is signed in');
  });

  await T('Q27', 'after 24 hours the app signs out and asks to sign in; signing in again continues the same progress', async (p, c) => {
    await p.addInitScript(fakeGoogle); const log = await authStub(c);
    await boot(p);
    await seed(p, () => { S.settings.googleClientId = 'test-client'; S.settings.syncUrl = 'https://sync.test/exec'; S.done['s00:S001'] = '2026-11-06'; localStorage.setItem('da:auth', JSON.stringify({ email: 'learner@example.com', session: 'old', exp: Date.now() - 1000, at: Date.now() - 25 * 36e5 })); });
    ok(/Sign in again to continue/.test(await p.$eval('body', e => e.innerText)) && !(await p.$('.tabbar')), 'no sign-in screen after 24 hours');
    await p.click('.authgate .gsi-fake'); await p.waitForTimeout(900);
    const s = await p.evaluate(() => [authLive(), !!S.done['s00:S001'], !!S.done['other:step'], !!document.querySelector('.tabbar')]);
    ok(s[0] && s[1] && s[2] && s[3], 'after signing in again: live, kept, merged, app shown = ' + s);
  });

  await T('Q28', 'a session the server no longer accepts signs out without losing progress', async (p, c) => {
    await p.addInitScript(fakeGoogle); const log = await authStub(c); log.expired = true;
    await boot(p);
    await p.evaluate(() => { S.settings.googleClientId = 'test-client'; S.settings.syncUrl = 'https://sync.test/exec'; S.done['s00:S001'] = '2026-11-06'; localStorage.setItem('da:auth', JSON.stringify({ email: 'learner@example.com', session: 'gone', exp: Date.now() + 36e5, at: Date.now() })); save(); return doSync(); });
    await p.waitForTimeout(600);
    ok(await p.evaluate(() => !authLive() && !!S.done['s00:S001']), 'still signed in, or progress lost');
    ok(/Sign in again to continue/.test(await p.$eval('body', e => e.innerText)), 'did not ask to sign in again');
  });

  await T('Q29', 'a download that stalls on start-up shows Still loading with a Reload button, not Loading forever', async (p, c) => {
    await c.route('**/data/bank/dsa.json*', () => { /* never answers */ });
    await p.goto(BASE + '#/today'); await p.waitForTimeout(13500);
    ok(/Still loading/.test(await p.$eval('#root', e => e.innerText)) && await p.$('#root button:has-text("Reload")'), 'still says Loading with nothing to do');
  });

  await T('Q30', 'updating Data Architect leaves another app\'s offline caches on the same address alone', async p => {
    await boot(p);
    const ks = await p.evaluate(async () => { await caches.open('gpscavy-v1'); await caches.open('data-architect-0.0.1'); window.__reload = location.reload; try { applyUpdate(); } catch (e) { } await new Promise(r => setTimeout(r, 400)); return caches.keys(); });
    ok(ks.includes('gpscavy-v1') && !ks.includes('data-architect-0.0.1'), 'caches after update: ' + ks.join(', '));
  });

  await T('Q31', 'a Google token issued to another app (no Data Architect marker) does not sign in here', async (p, c) => {
    await p.addInitScript(fakeGoogle); await authStub(c);
    await boot(p); await p.evaluate(() => { S.settings.googleClientId = 'test-client'; S.settings.syncUrl = 'https://sync.test/exec'; save(); location.hash = '#/profile'; }); await p.waitForSelector('.authprof .gsi-other');
    await p.click('.authprof .gsi-other'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => !authLive()), 'signed in with another app\'s token');
  });

  await T('Q32', 'the sync script refuses a sign-in without the Data Architect marker, and accepts one with it (sync/Code.gs)', async () => {
    const vm = require('vm'), fs = require('fs'); let src = fs.readFileSync('sync/Code.gs', 'utf8').replace("const CLIENT_ID = '';", "const CLIENT_ID = 'cid';").replace('const OWNERS = [];', "const OWNERS = ['me@example.com'];");
    const props = {}; const info = n => JSON.stringify({ aud: 'cid', email: 'me@example.com', email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 600), nonce: n });
    const ctx = { UrlFetchApp: { fetch: u => ({ getResponseCode: () => 200, getContentText: () => info(decodeURIComponent(u.split('id_token=')[1])) }) }, PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) }, LockService: { getScriptLock: () => ({ waitLock: () => { }, releaseLock: () => { } }) }, Utilities: { getUuid: () => Math.random().toString(36).slice(2) }, ContentService: { createTextOutput: s => ({ setMimeType: () => s }), MimeType: { JSON: 'json' } }, DriveApp: {} };
    vm.createContext(ctx); vm.runInContext(src + '\nthis.login_ = login_;', ctx);
    const other = ctx.login_(''), mine = ctx.login_('da-abc');
    ok(!other.ok && /another app/.test(other.error) && mine.ok && mine.session, 'other: ' + JSON.stringify(other) + ' mine: ' + JSON.stringify(mine));
  });

  await browser.close();
  for (const r of results) console.log(r[0].padEnd(5), r[1], r[2], r[3] ? '\n      ' + r[3] : '');
  console.log(results.filter(r => r[0] === 'PASS').length + ' passed, ' + results.filter(r => r[0] === 'FAIL').length + ' failed');
  process.exit(results.some(r => r[0] === 'FAIL') ? 1 : 0);
})();
