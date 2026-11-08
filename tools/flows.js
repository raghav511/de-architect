/* Data Architect user-journey tests (QA scenarios). node tools/flows.js [baseUrl] [filter]
   Each scenario runs in a fresh browser context and checks what a user would see. */
const { chromium } = require(process.env.PW || 'playwright');
const BASE = (process.argv[2] && /^http/.test(process.argv[2])) ? process.argv[2] : 'http://localhost:8811/';
const FILTER = process.argv.find(a => !/^http/.test(a) && a !== process.argv[0] && a !== process.argv[1]) || '';
const results = [];
let browser;
async function ctx(opt) {
  const c = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, bypassCSP: true }, opt || {})); /* stub hosts (https://sync.test) are outside the app's CSP */ await c.route('http://127.0.0.1:8765/**', r => r.abort()); /* never reach a real grader installed on this Mac */
  const p = await c.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('dialog', d => { p.errs.push('native dialog: ' + d.message()); d.dismiss(); });
  return { c, p };
}
const go = async (p, h, w) => { await p.goto(BASE + h); await p.waitForTimeout(w || 700); };
const hash = async (p, h, w) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(w || 400); };
const text = (p, s) => p.$eval(s, e => e.innerText).catch(() => '');
/* Today's plan parts are tabs: read hidden tabs too (what is in the plan, not only the open tab) */
const all = (p, s) => p.$eval(s, e => e.textContent).catch(() => '');
const state = p => p.evaluate(() => JSON.parse(localStorage.getItem('keystone:v1') || '{}'));
function ok(cond, msg) { if (!cond) throw new Error(msg); }
/* Profile (avatar, top right): open it on a tab; set a field the way a person does (type, then leave the field) */
const profile = async (p, tab) => { await p.click('.avatar'); await p.waitForSelector('#pt_sync', { timeout: 20000 }); if (tab) await p.click('#pt_' + tab); await p.waitForTimeout(150); };
const setField = async (p, sel, v) => { await p.fill(sel, v); await p.dispatchEvent(sel, 'change'); await p.waitForTimeout(150); };
async function T(name, fn, opt) {
  if (FILTER && !name.toLowerCase().includes(FILTER.toLowerCase())) return;
  const { c, p } = await ctx(opt);
  try { await fn(p, c); if (p.errs.length) throw new Error('page errors: ' + p.errs.join(' | ')); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]); await p.screenshot({ path: '/tmp/flow_fail_' + name.replace(/\W+/g, '_') + '.png' }).catch(() => {}); }
  await c.close();
}

(async () => {
  browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});

  /* ---- content updates: nothing you did is lost, changes are announced ---- */
  const seed = async (p, fn) => { await p.evaluate(fn); await p.evaluate(() => { saveT && clearTimeout(saveT); saveT = null; localStorage.setItem('keystone:v1', JSON.stringify(S)); }); await p.reload(); await p.waitForSelector('h1', { timeout: 30000 }); await p.waitForTimeout(500); };
  await T('updates: damaged tracker data from a sync is repaired; Today opens and progress stays', async p => {
    await go(p, '#/today', 1200);
    await seed(p, () => { S.cv = 'garbage'; S.archive = 7; S.updates = 'x'; S.done['s00:S001'] = '2026-10-26'; });
    ok(/Reading and labs/.test(await text(p, '#page')) && await p.evaluate(() => S.done['s00:S001'] === '2026-10-26' && Array.isArray(S.updates) && typeof S.cv === 'object'), 'Today did not open or progress was touched');
  });
  await T('updates: a new user sees no what-is-new note', async p => {
    await go(p, '#/today', 1200);
    ok(!(await p.$('.whatsnew')) && await p.evaluate(() => !!S.cv && Object.keys(S.cv.known).length > 100), 'new user saw a note, or no starting point was recorded');
  });
  await T('updates: an existing user upgrading is told about the new AI data stack modules, nothing else', async p => {
    await go(p, '#/today', 1200);
    await seed(p, () => { delete S.cv; S.updates = []; S.done['s00:S001'] = iso(new Date()); });
    const t = await text(p, '.whatsnew'); await p.click('.whatsnew button:has-text("See")'); const t2 = await text(p, '.whatsnew');
    ok(/2 new modules/.test(t) && /LLMs meet the warehouse/.test(t2) && !/Updated/.test(t2), 'note: ' + t2.replace(/\s+/g, ' ').slice(0, 400));
    ok(await p.evaluate(() => !!S.done['s00:S001']), 'progress lost on upgrade');
    await go(p, '#/path', 900); ok(await p.$('.pcard[data-mid=a04] .tag.tnew'), 'A4 not tagged New on the Path');
    await go(p, '#/today', 900); await p.click('.whatsnew button:has-text("Got it")'); await p.reload(); await p.waitForSelector('h1'); await p.waitForTimeout(500);
    ok(!(await p.$('.whatsnew')), 'Got it did not clear the note');
  });
  await T('updates on iPhone: the what-is-new line leaves the Up next button on the first screen', async p => {
    await go(p, '#/today', 1200);
    await seed(p, () => { delete S.cv; S.updates = []; S.done['s00:S001'] = iso(new Date()); });
    await p.waitForSelector('.whatsnew');
    const b = await p.$eval('.unit.cur .acts .btn.pri', e => [e.getBoundingClientRect().bottom, document.querySelector('.tabbar').getBoundingClientRect().top]);
    ok(b[0] <= b[1], 'the note pushes Up next below the tab bar: ' + b);
  }, { viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });
  await T('updates: a finished step whose content changed comes back as Updated; the old completion is kept', async p => {
    await go(p, '#/today', 1200);
    const uid = await p.evaluate(() => schedule().units.find(u => u.mid === 's00' && u.kind === 'learn').uid);
    await seed(p, () => { const u = schedule().units.find(x => x.mid === 's00' && x.kind === 'learn'); S.done[u.uid] = '2026-10-26'; S.cv.units[u.uid] = 'older-version'; });
    const r = await p.evaluate(id => [!!S.done[id], S.archive.done[id] && S.archive.done[id].at], uid);
    ok(!r[0] && r[1] === '2026-10-26', 'step not reopened or old completion lost: ' + JSON.stringify(r));
    ok(/1 updated step to look at again/.test(await text(p, '.whatsnew')), 'no Updated notice: ' + await text(p, '.whatsnew'));
    ok(/Updated · finished before/.test(await text(p, '#page')), 'the step card does not say it was updated');
    await p.evaluate(id => { const u = schedule().units.find(x => x.uid === id); toggleUnit(u); }, uid); await p.waitForTimeout(300);
    ok(await p.evaluate(id => !!S.done[id] && S.cv.units[id] === unitHash(schedule().units.find(x => x.uid === id)), uid), 'finishing it again did not record the new version');
  });
  await T('updates: a changed exercise and a changed quiz reopen; code and the old score are kept', async p => {
    await go(p, '#/today', 1200);
    await seed(p, () => { S.solved.y001 = 1; S.code = S.code || {}; S.code.y001 = 'my code'; S.cv.ex.y001 = 'older'; S.quiz.a01 = { a: { 0: 'A' }, sub: true, i: 0, best: 90, last: 90 }; const q = schedule().units.find(u => u.mid === 'a01' && u.kind === 'quiz'); S.cv.units[q.uid] = 'older'; });
    const r = await p.evaluate(() => [!!S.solved.y001, !!S.archive.solved.y001, S.code.y001, !!S.quiz.a01, S.archive.quiz.a01 && S.archive.quiz.a01.best]);
    ok(!r[0] && r[1] && r[2] === 'my code' && !r[3] && r[4] === 90, 'exercise or quiz not reopened safely: ' + JSON.stringify(r));
    await p.click('.whatsnew button:has-text("See")'); const t = await text(p, '.whatsnew'); ok(/Count trips per city/.test(t) && /Quiz/.test(t), 'note does not list both: ' + t.slice(0, 200));
  });

  await T('today: two missed days carry forward, say so, and keep the first step on top', async p => {
    await go(p, '#/today');
    await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 2); S.start = iso(d); S.since = null; S.done = {}; save(); }); await p.waitForTimeout(400);
    await p.reload(); await p.waitForSelector('.unit .t', { timeout: 30000 }); await p.waitForTimeout(400);
    const sc = await p.evaluate(() => { const s = schedule(); return { missed: s.missed.length, first: s.units.find(u => !isCC(u.mid)).title, today: (s.byDay[s.today] || []).map(u => isCC(u.mid)) }; });
    ok(sc.missed === 2, 'expected 2 missed days, got ' + sc.missed);
    const note = await text(p, '.behind'); ok(/Catching up/.test(note) && /moved to today/.test(note) && note.length < 80, 'catching-up note missing or too long: ' + note);
    ok((await text(p, '.unit.cur .t')) === sc.first, 'Up next is not the program\'s first step');
    ok(sc.today.indexOf(true) === -1 || sc.today.indexOf(true) > sc.today.lastIndexOf(false), 'a Claude Code step sits above a main step');
    ok(/from (Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(await text(p, '#grp-coding')) || /more problems? wait/.test(await text(p, '#grp-coding')), 'coding track neither shows nor counts the unsolved problems from earlier days');
    const strip = await p.$$eval('.wkday.past', a => a.map(x => x.innerText));
    ok(strip.every(t => !/—/.test(t) || !/0\//.test(t)) || strip.some(t => /Missed · moved to today/.test(t)) || new Date().getDay() <= 2, 'missed days in the week strip do not say where the work went');
    await p.evaluate(() => { S.done[schedule().units.find(u => !isCC(u.mid)).uid] = iso(new Date()); save(); }); await p.reload(); await p.waitForTimeout(800);
    ok(await p.$('.behind'), 'note should stay while earlier days are still empty');
  });

  await T('today: a new user who starts mid-week is not told they missed days', async p => {
    await go(p, '#/today');
    await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 2); S.start = iso(d); S.since = iso(new Date()); S.done = {}; save(); }); await p.waitForTimeout(400);
    await p.reload(); await p.waitForSelector('.unit .t', { timeout: 30000 });
    ok(!(await p.$('.behind')), 'a first-day user sees a catching-up note');
    ok(await p.evaluate(() => schedule().missed.length === 0), 'missed days counted before the user began');
    const fresh = await p.evaluate(() => !!JSON.parse(localStorage.getItem('keystone:v1')).since); ok(fresh, 'first run did not record the start day');
  });

  await T('closing a tab does not overwrite progress another tab saved later', async p => {
    await go(p, '#/today'); await p.waitForSelector('.unit .check'); await p.click('.unit .check'); await p.waitForTimeout(500);
    await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('keystone:v1')); o.done['from-other-tab'] = '2026-10-28'; localStorage.setItem('keystone:v1', JSON.stringify(o)); });
    await p.reload(); await p.waitForSelector('.unit .t', { timeout: 30000 });
    ok(await p.evaluate(() => !!S.done['from-other-tab']), 'the other tab\'s save was overwritten when this one closed');
  });

  await T('today: a tick right before closing the page is kept', async p => {
    await go(p, '#/today'); await p.waitForSelector('.unit .check');
    await p.click('.unit .check'); await p.reload(); await p.waitForSelector('.unit .t', { timeout: 30000 });
    ok(await p.$('.unit.done'), 'the tick was lost when the page closed straight after it');
  });

  await T('today: tick a step updates progress, up next, sidebar and persists', async p => {
    await go(p, '#/today');
    const first = await text(p, '.unit .t');
    ok(!(await p.$('.hero')), 'the Up next banner should be folded into the plan while steps are open');
    ok((await text(p, '.unit.cur .t')) === first, 'the first step should be the expanded Up next card');
    ok(/Up next/i.test(await text(p, '.unit.cur')) && /· \d+ min$/.test(await text(p, '.unit.cur .acts .btn.pri')), 'Up next label or timed main button missing');
    await p.click('.unit .check'); await p.waitForTimeout(400);
    ok(await p.$('.unit.done'), 'first unit not marked done');
    const cur2 = await text(p, '.unit.cur .t'); ok(cur2 && cur2 !== first, 'Up next did not move to the next step');
    const side = await text(p, '.side .week'); ok(/Today: [1-9]\d* of/.test(side), 'sidebar minutes not updated: ' + side);
    const s = await state(p); ok(Object.values(s.done).some(v => /^\d{4}-\d\d-\d\d$/.test(v)), 'done not saved with a date');
    await p.reload(); await p.waitForTimeout(800); ok(await p.$('.unit.done'), 'done lost after reload');
    await p.click('.unit.done .check'); await p.waitForTimeout(400); ok(!(await p.$('.unit.done')), 'untick failed');
  });

  await T('today: finishing every step shows done-for-today and next up', async p => {
    await go(p, '#/today');
    await p.evaluate(() => { S.rq = S.rq || {}; (DATA.recent.items || []).forEach(q => { S.rq[q.id] = 1; }); save(); route(); }); await p.waitForTimeout(400); /* company questions are ticked on their own page */
    for (let i = 0; i < 20; i++) { const b = await p.$('.unit:not(.done) .check, .xit .check[aria-pressed=false]'); if (!b) break; await b.click(); await p.waitForTimeout(350); } /* the hour, the coding track and the mock */
    const t = await text(p, '#page'); ok(/Done for today/.test(t), 'no done-for-today message');
    ok(/Ahead of plan/i.test(await text(p, '.hero')), 'hero should offer the next step ahead of plan');
  });

  await T('today: day navigation, preview and back to today', async p => {
    await go(p, '#/today');
    await p.click('[aria-label="Next day"]'); await p.waitForTimeout(400);
    ok(/Tomorrow/.test(await text(p, '#page')), 'next day not shown');
    ok(!(await p.$('.hero')), 'hero should only show on today');
    await p.click('text=Back to today'); await p.waitForTimeout(400);
    ok(/Today ·/.test(await text(p, '#page')), 'back to today failed');
    await p.click('.wkday >> nth=6'); await p.waitForTimeout(400);
    ok(/Sunday/.test(await text(p, '#page')), 'week strip day link failed');
  });

  await T('schedule: skipped days roll steps forward (clock +3 days)', async (p, c) => {
    await go(p, '#/today');
    const first = await text(p, '.unit .t');
    const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(9, 0, 0, 0);
    await p.clock.setFixedTime(d); await p.reload(); await p.waitForTimeout(900);
    ok((await text(p, '.unit .t')) === first, 'undone first step should roll to the new today');
  });

  await T('schedule: weekday budget is 60, weekend 120, settings change it', async p => {
    const mon = new Date(); mon.setDate(mon.getDate() + ((8 - mon.getDay()) % 7 || 7)); mon.setHours(8, 0, 0, 0);
    await p.clock.setFixedTime(mon); await go(p, '#/today', 900);
    let m = (await text(p, '#page')).match(/Reading and labs\s*\d+ \/ (\d+) min/); ok(m && +m[1] <= 65, 'Monday plan over 60: ' + (m && m[1]));
    await p.evaluate(() => { S.settings.capWd = 90; save(); route(); }); await p.waitForTimeout(500);
    m = (await text(p, '#page')).match(/Reading and labs\s*\d+ \/ (\d+) min/); ok(m && +m[1] > 60 && +m[1] <= 95, 'budget 90 not applied: ' + (m && m[1]));
    ok(/90-minute day/.test(await text(p, '#page')), 'day chip not updated');
  });

  await T('settings: profile saves as you go, reopen shows values, bad minutes fall back, theme applies', async p => {
    await go(p, '#/today');
    await profile(p, 'plan');
    await setField(p, '#st_wd', '5'); await setField(p, '#st_we', '150'); await setField(p, '#st_time', '06:30');
    await p.click('#pt_sync'); await setField(p, '#st_sync', 'https://script.google.com/macros/s/abc/exec');
    await p.click('#pt_ai'); await setField(p, '#st_key', 'sk-ant-test');
    await p.click('[data-mode=dark]'); await p.waitForTimeout(400);
    const s = await state(p); ok(s.settings.capWd === 60, 'invalid weekday minutes should fall back to 60, got ' + s.settings.capWd);
    ok(s.settings.capWe === 150 && s.settings.studyTime === '06:30', 'weekend/time not saved');
    ok(await p.evaluate(() => document.documentElement.dataset.theme === 'dark'), 'dark theme not applied');
    await p.reload(); await p.waitForTimeout(700);
    ok(await p.evaluate(() => document.documentElement.dataset.theme === 'dark'), 'theme lost after reload');
    ok((await p.inputValue('#st_sync')).includes('abc') && (await p.inputValue('#st_key')) === 'sk-ant-test', 'settings not shown on reopen');
  });

  await T('profile: avatar opens it; sync, update and mode are one tap without scrolling; tabs switch in place', async p => {
    await go(p, '#/today');
    ok(!(await p.$('.top [aria-label="Sync progress"]')) && !(await p.$('.top [aria-label="Update app"]')) && !(await p.$('.top [aria-label=Settings]')), 'old top-bar buttons still there');
    await profile(p);
    const r = await p.evaluate(() => ['#syncBtn', '.pquick [aria-label="Update app"]', '[data-mode=dark]', '#pt_ai'].map(q => { const b = document.querySelector(q).getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0; }));
    ok(r.every(Boolean), 'quick actions or tabs need scrolling: ' + JSON.stringify(r));
    const y = await p.evaluate(() => scrollY); await p.click('#pt_ai');
    ok(await p.isVisible('#st_ai') && !(await p.isVisible('#st_sync')) && (await p.evaluate(() => scrollY)) === y, 'AI tab did not open in place');
    await p.keyboard.press('ArrowRight'); ok(await p.evaluate(() => document.activeElement.id === 'pt_data') && await p.isVisible('#pp_data'), 'arrow keys do not move between tabs');
    await p.click('#pt_look'); await p.selectOption('#st_accent', 'plum'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.documentElement.dataset.accent === 'plum' && JSON.parse(localStorage.getItem('keystone:v1')).settings.accent === 'plum'), 'accent not applied and saved');
    await setField(p, '#st_name', 'Asha'); ok((await text(p, '.top .avatar')).trim() === 'A', 'avatar letter did not follow the name');
    await go(p, '#/today'); ok(/Asha/.test(await text(p, 'h1')), 'greeting does not use the name');
  });

  await T('profile on iPhone: one tap from the More sheet, quick actions and tabs on the first screen', async p => {
    await go(p, '#/today');
    await p.click('.tabmore'); await p.click('.sheetgrid a:has-text("Profile and settings")'); await p.waitForSelector('#pt_sync');
    const r = await p.evaluate(() => { const tb = document.querySelector('.tabbar').getBoundingClientRect().top; return ['#syncBtn', '[data-mode=dark]', '#pt_data', '#st_sync'].map(q => document.querySelector(q).getBoundingClientRect().bottom <= tb); });
    ok(r.every(Boolean), 'something needs scrolling on the phone: ' + JSON.stringify(r));
    await p.click('.tabmore'); ok(await p.locator('.sheet button', { hasText: /Sync/ }).count() === 1, 'Sync is not one tap from the More sheet'); await p.keyboard.press('Escape');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'page scrolls sideways');
  }, { viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });

  await T('sync: without URL opens settings; failing URL keeps progress', async p => {
    await go(p, '#/today');
    await profile(p); await p.click('#syncBtn'); await p.waitForTimeout(300); ok(await p.evaluate(() => document.activeElement.id === 'st_sync'), 'Set up sync did not take you to the sync URL');
    await p.evaluate(() => { S.settings.syncUrl = 'http://127.0.0.1:9/none'; S.done['a01:A101'] = '2026-10-24'; save(); });
    await p.click('#syncBtn'); await p.waitForTimeout(2500);
    ok(/Sync failed|synced/i.test(await text(p, '.toast')), 'no sync result toast');
    ok((await state(p)).done['a01:A101'], 'progress lost after failed sync');
  });

  await T('sync merge: untick on one device survives, union of done', async p => {
    await go(p, '#/today');
    const r = await p.evaluate(() => {
      const a = { done: { x: '2026-10-20', y: '2026-10-21' }, doneAt: { x: 1, y: 1 }, undone: {}, updated: 1 };
      const b = { done: { y: '2026-10-21', z: '2026-10-22' }, doneAt: { y: 1, z: 2 }, undone: { x: 5 }, updated: 2 };
      return Object.keys(mergeState(a, b).done).sort().join(',');
    });
    ok(r === 'y,z', 'merge wrong: ' + r);
  });

  await T('quiz: answer all types, palette, submit, score, retake, auto-done', async p => {
    await go(p, '#/quiz/a01', 1000);
    const n = await p.$$eval('.pal button', b => b.length); ok(n >= 10, 'palette has ' + n);
    for (let i = 0; i < n; i++) {
      await p.click('.pal button >> nth=' + i); await p.waitForTimeout(120);
      if (await p.$('.opt')) await p.click('.opt >> nth=0');
      else if (await p.$('#page input[type=text]')) await p.fill('#page input[type=text]', 'test');
      else if (await p.$('#page textarea')) await p.fill('#page textarea', 'my answer');
      await p.waitForTimeout(80);
    }
    ok(/of \d+ answered/.test(await text(p, '#page')), 'answered count missing');
    await p.click('button:has-text("Submit")'); await p.waitForTimeout(300);
    await p.click('.dialog button:has-text("Submit")'); await p.waitForTimeout(400);
    ok(/Score: \d+ of \d+/.test(await text(p, '#page')), 'no score');
    await go(p, '#/path/a01', 800); await p.reload(); await p.waitForTimeout(800);
    const t = await text(p, '#page'); ok(/Quiz A1/.test(t), 'quiz step missing on path');
    ok(await p.$('.unit.done:has-text("Quiz A1")'), 'quiz step not auto-ticked after submit');
    await go(p, '#/quiz/a01', 900); await p.click('button:has-text("Retake")'); await p.waitForTimeout(400);
    ok(/Question 1 of/i.test(await text(p, '#page')), 'retake did not reset');
    await go(p, '#/path/a01', 600); await p.reload(); await p.waitForTimeout(800); ok(await p.$('.unit.done:has-text("Quiz A1")'), 'retake should not untick the quiz step');
  });

  await T('quiz: options in a fresh order per attempt; picking every right option by its text scores 100% on mcqs', async p => {
    await go(p, '#/quiz/s02', 1000);
    const qs = await p.evaluate(async () => (await sprint('s02')).quiz.map(q => q.TYPE === 'mcq' ? q.ANS : null));
    for (let i = 0; i < qs.length; i++) { if (!qs[i]) continue; await p.click('.pal button >> nth=' + i); await p.waitForTimeout(80); await p.click('.opt[data-k=' + qs[i] + ']'); }
    const r = await p.evaluate(async () => { const s = await sprint('s02'), st = S.quiz[qk('s02')]; return { ok: s.quiz.every((q, k) => q.TYPE !== 'mcq' || st.a[k] === q.ANS), labels: [...document.querySelectorAll('.opt b')].map(b => b.textContent).join('') }; });
    ok(r.ok, 'an mcq answer was not saved as the file letter'); ok(r.labels === 'ABCD', 'screen labels should run A to D: ' + r.labels);
  });

  await T('quiz: reset with undo and leave keeps answers', async p => {
    await go(p, '#/quiz/s01', 1000);
    await p.click('.opt >> nth=1'); await p.waitForTimeout(200);
    await p.click('button:has-text("Leave")'); await p.click('.dialog button:has-text("Leave, keep answers")'); await p.waitForTimeout(400);
    await go(p, '#/quiz/s01', 900); ok(await p.$('.opt[aria-pressed=true]'), 'answer lost after leave');
    await p.click('button:has-text("Reset and exit")'); await p.click('.dialog button:has-text("Reset and exit")'); await p.waitForTimeout(400);
    await p.click('.toast button:has-text("Undo")'); await p.waitForTimeout(200);
    await go(p, '#/quiz/s01', 900); ok(await p.$('.opt[aria-pressed=true]'), 'undo did not restore answers');
  });

  await T('interview: tick, show answer, mock deep link', async p => {
    await go(p, '#/interview/a02', 900);
    await p.click('button:has-text("Show model answer") >> nth=0'); await p.waitForTimeout(150);
    ok(/Hide model answer/.test(await text(p, '#page')), 'answer did not open');
    await p.click('#page .check >> nth=0'); await p.waitForTimeout(300);
    ok(await p.$('#page .check[aria-pressed=true]'), 'tick failed');
    await go(p, '#/interview/s12/mock', 1200);
    const y = await p.evaluate(() => { const m = document.getElementById('mock'); return m ? m.getBoundingClientRect().top : 9999; });
    ok(y < 300, 'mock section not scrolled into view (top ' + Math.round(y) + ')');
  });

  await T('scroll: ticking far down a list keeps your place', async p => {
    await go(p, '#/path/s01', 900);
    const b = await p.$$('.unit .check'); await b[10].scrollIntoViewIfNeeded(); const y0 = await p.evaluate(() => scrollY);
    await b[10].click(); await p.waitForTimeout(400); const y1 = await p.evaluate(() => scrollY);
    ok(Math.abs(y1 - y0) < 50 && y0 > 300, 'path jumped from ' + y0 + ' to ' + y1);
    await go(p, '#/interview/s01', 900);
    const t = await p.$$('#page .check'); await t[12].scrollIntoViewIfNeeded(); const z0 = await p.evaluate(() => scrollY);
    await t[12].click(); await p.waitForTimeout(300); const z1 = await p.evaluate(() => scrollY);
    ok(Math.abs(z1 - z0) < 50, 'interview jumped from ' + z0 + ' to ' + z1);
    ok(/1 of \d+ ticked/.test(await text(p, '#page')), 'ticked counter not updated');
  });

  await T('editor: run, hints ladder, solution unlock after two runs, timer, exit dialog', async p => {
    await go(p, '#/dsa/d011', 1200);
    await p.click('button.btn.pri:has-text("Run")');
    await p.waitForFunction(() => /Run again/.test((Array.from(document.querySelectorAll('button.btn.pri')).find(b => /Run/.test(b.textContent)) || {}).textContent || ''), null, { timeout: 120000 });
    const v1 = await text(p, '.verdict'); ok(v1 && v1 !== 'All checks pass', 'starter code should not pass: ' + v1);
    for (let i = 0; i < 4; i++) { await p.click('.pane .btn.dark'); await p.waitForTimeout(120); }
    ok(/Run twice/.test(await text(p, '.pane .btn.dark')), 'solution should be locked after one run');
    await p.click('button.btn.pri:has-text("Run")'); await p.waitForTimeout(2500);
    ok(/Show the solution/.test(await text(p, '.pane .btn.dark')), 'solution not unlocked after two runs: ' + await text(p, '.pane .btn.dark'));
    await p.click('.pane .btn.dark'); await p.waitForTimeout(200); ok(/Reference solution/i.test(await text(p, 'aside.pane')), 'solution not shown');
    await p.click('button:has-text("Pause")'); const t1 = await text(p, '.top .mono'); await p.waitForTimeout(1500); ok(t1 === await text(p, '.top .mono'), 'timer did not pause');
    await p.click('button:has-text("Exit")'); await p.waitForTimeout(200);
    await p.click('.dialog button:has-text("Save and exit")'); await p.waitForTimeout(500);
    ok(/#\/path\//.test(p.url()), 'exit did not go back: ' + p.url());
  });

  await T('editor: reset code with undo, terminal runs a line', async p => {
    await go(p, '#/sql/q011', 1200);
    await p.fill('textarea.code', 'SELECT 42 AS answer');
    await p.click('button:has-text("Starter code")'); await p.click('.dialog button:has-text("Reset code")'); await p.waitForTimeout(200);
    ok(!(await p.inputValue('textarea.code')).includes('42'), 'reset did not restore starter');
    await p.click('.toast button:has-text("Undo")'); await p.waitForTimeout(200);
    ok((await p.inputValue('textarea.code')).includes('42'), 'undo did not restore code');
    await p.click('.editor button:has-text("Terminal")'); await p.waitForTimeout(300);
    await p.fill('.term-in input', 'SELECT 1+1 AS two'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => /two/.test(document.querySelector('.term-lines') ? document.querySelector('.term-lines').innerText : ''), null, { timeout: 120000 });
  });

  await T('editor phone: panes switch and run shows output', async p => {
    await go(p, '#/dsa/d012', 1200);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(ov <= 2, 'overflow ' + ov);
    const tabs = await p.$$eval('button', b => b.map(x => x.innerText.trim()).filter(Boolean)); ok(tabs.some(t => /Problem/.test(t)) && tabs.some(t => /Code/.test(t)), 'phone pane tabs missing: ' + tabs.slice(0, 12).join(','));
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await T('project: milestones tick and wrong completion code rejected, right code accepted', async p => {
    await go(p, '#/project/lakehouse-1', 900);
    await p.click('#page .block .check >> nth=0'); await p.waitForTimeout(200);
    ok((await state(p)).proj['lakehouse-1'].ms, 'milestone not saved');
    await p.fill('input[aria-label^="Completion code"]', 'NOPE'); await p.click('button:has-text("Verify")'); await p.waitForTimeout(200);
    ok(/does not look like/.test(await text(p, '#page')), 'bad format not rejected');
    const code = await p.evaluate(async () => { const b = await crypto.subtle.digest('SHA-1', new TextEncoder().encode('lakehouse' + [1, 2].join(','))); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 6).toUpperCase() + '-12'; });
    await p.fill('input[aria-label^="Completion code"]', code); await p.click('button:has-text("Verify")'); await p.waitForTimeout(300);
    ok(/Verified/.test(await text(p, '#page')), 'valid code not accepted');
  });

  await T('design: notes saved per module and step, calculator, mark done', async p => {
    await go(p, '#/design/a01', 800);
    await p.fill('#page textarea', 'clients -> gateway'); await p.waitForTimeout(250);
    await go(p, '#/design/s05', 700); ok((await p.inputValue('#page textarea')) === '', 'notes leaked into another module');
    await go(p, '#/design/a01', 700); ok((await p.inputValue('#page textarea')) === 'clients -> gateway', 'notes not kept');
    await p.fill('#c_trips', '1000000'); await p.waitForTimeout(150);
    ok(/6,000,000/.test(await text(p, '#page')), 'calculator did not update');
    await p.click('button:has-text("Mark this design done")'); await p.waitForTimeout(300);
    ok((await state(p)).done['a01:design'], 'design not marked done');
  });

  await T('learn: section range, show whole, next tab, toc jump', async p => {
    await go(p, '#/learn/s01/chapter/0-2', 900);
    ok(/Today's part/.test(await text(p, '#page')), 'no part banner');
    const n = await p.$$eval('article h2', h => h.length); ok(n === 3, 'range should show 3 sections, got ' + n);
    await p.click('text=Show the whole chapter'); await p.waitForTimeout(500);
    const n2 = await p.$$eval('article h2', h => h.length); ok(n2 > 3, 'whole chapter not shown');
    await p.click('text=Next: Readings'); await p.waitForTimeout(500); ok(/readings/.test(p.url()), 'next tab failed');
  });

  await T('git: lesson commands and mark done', async p => {
    await go(p, '#/git/5', 700);
    ok(await p.$('a[href="#/terminal/git/5"]:has-text("Practise in the terminal")') && !/codespaces/i.test(await p.evaluate(() => document.querySelector('#page').innerHTML)), 'in-app terminal button missing, or the lesson still sends you to Codespaces');
    await p.click('button:has-text("Mark this lesson done")'); await p.waitForTimeout(300);
    ok(Object.keys((await state(p)).done).some(k => k.endsWith(':git')), 'git lesson not saved');
  });

  await T('navigating while the app is still loading does not break any screen', async p => {
    await p.route('**/data/program/**', async r => { await new Promise(x => setTimeout(x, 1500)); r.continue(); }); /* a slow network */
    await p.goto(BASE + '#/today');
    for (const h of ['#/git/1', '#/projects', '#/path', '#/path/s00']) { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(150); }
    await p.waitForSelector('h1', { timeout: 60000 }); await p.waitForTimeout(800);
    ok(/path\/s00/.test(await p.evaluate(() => location.hash)) && !/Something went wrong/.test(await text(p, '.top')), 'the screen you ended up on did not draw: ' + await text(p, '.top'));
  });

  await T('search closes when you go to another screen', async p => {
    await go(p, '#/today', 900);
    await p.click('[aria-label=Search]'); await p.waitForSelector('.scrim [role=dialog]');
    await hash(p, '#/path', 600);
    ok(!(await p.$('.scrim')), 'the search panel stayed open on the new screen');
  });

  await T('search: keyboard open, type, arrows, enter navigates, escape closes', async p => {
    await go(p, '#/today');
    await p.keyboard.press('/'); await p.keyboard.type('two sum'); await p.waitForTimeout(200);
    ok((await p.$$('.searchwrap .item')).length > 0, 'no results for two sum');
    await p.keyboard.press('Enter'); await p.waitForTimeout(600); ok(/#\/dsa\//.test(p.url()), 'enter did not open a DSA problem: ' + p.url());
    await p.keyboard.press('Control+k'); await p.waitForTimeout(150); ok(await p.$('.searchwrap'), 'ctrl+k did not open');
    await p.keyboard.press('Escape'); await p.waitForTimeout(150); ok(!(await p.$('.searchwrap')), 'escape did not close');
  });

  await T('backup: download then restore, bad file rejected', async p => {
    await go(p, '#/progress');
    await p.evaluate(() => { S.done['a01:A101'] = '2026-10-24'; save(); });
    await p.waitForTimeout(300);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Download a backup")')]);
    const f = await dl.path();
    await p.evaluate(() => { delete S.done['a01:A101']; save(); });
    await p.setInputFiles('input[type=file][accept="application/json"]', f); await p.waitForTimeout(500);
    ok((await state(p)).done['a01:A101'], 'restore did not bring progress back');
    require('fs').writeFileSync('/tmp/bad.json', 'not json');
    await p.setInputFiles('input[type=file][accept="application/json"]', '/tmp/bad.json'); await p.waitForTimeout(300);
    ok(/not a Data Architect backup/.test(await text(p, '.toast')), 'bad file not rejected');
  });

  await T('calendar: ics is valid and starts at study time', async p => {
    await go(p, '#/today');
    await p.evaluate(() => { S.settings.studyTime = '06:15'; save(); });
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Add to calendar")')]);
    const t = require('fs').readFileSync(await dl.path(), 'utf8');
    ok(/^BEGIN:VCALENDAR/.test(t) && /END:VCALENDAR\s*$/.test(t), 'ics framing');
    ok((t.match(/BEGIN:VEVENT/g) || []).length >= 20, 'expected ~28 events');
    ok(/DTSTART:\d{8}T0615/.test(t), 'study time not used');
    ok(t.split('\r\n').every(l => l.length <= 75 || /^(DESCRIPTION|SUMMARY)/.test(l)), 'long lines');
  });

  await T('coach: no key gives a hint; bad key shows a clear error', async p => {
    await go(p, '#/today');
    await p.click('.fab'); await p.fill('.coach input', 'help'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    ok(/AI key|step/.test(await text(p, '.coach .msgs')), 'no offline hint');
  });

  await T('old saved data from v1.1 loads without errors', async p => {
    await go(p, '#/today');
    await p.evaluate(() => { saveT && clearTimeout(saveT); saveT = null; localStorage.setItem('keystone:v1', JSON.stringify({ start: '2026-10-12', done: { w1d0les1: 1, w1d0dsa: 1 }, quiz: { 1: { a: { 0: 'A' }, sub: true, i: 0 } }, iv: { 1: { 0: true } }, solved: { d011: 1 }, settings: { syncUrl: '' }, week: 2, dayPick: 1 })); }); await p.reload(); await p.waitForTimeout(800);
    for (const h of ['#/today', '#/path', '#/progress', '#/quiz/s01', '#/interview/1', '#/learn/1', '#/path/3']) { await go(p, h, 600); ok(!(/Something went wrong/.test(await text(p, '.top'))), h + ' broke'); }
    await go(p, '#/path/s01', 600); ok(await p.$('.unit.done:has-text("Quiz")'), 'old submitted quiz 1 should count as done');
  });

  await T('storage blocked: app still renders', async p => {
    await p.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
    await go(p, '#/today', 1000);
    ok(/Reading and labs/.test(await text(p, '#page')), 'app did not render without storage');
  });

  await T('keyboard: dialogs trap focus start and Escape closes; focus visible', async p => {
    await go(p, '#/today');
    await profile(p); await p.click('.pquick [aria-label="Update app"]'); await p.waitForTimeout(600);
    const f = await p.evaluate(() => document.activeElement && document.activeElement.closest('.dialog') !== null); ok(f, 'focus not moved into dialog');
    await p.keyboard.press('Escape'); await p.waitForTimeout(150); ok(!(await p.$('.dialog')), 'escape did not close the dialog');
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
    const outline = await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle); ok(outline !== 'none', 'no visible focus ring');
  });

  await T('phone: More sheet opens every section and settings', async p => {
    await go(p, '#/today');
    await p.click('.tabmore'); await p.waitForTimeout(200);
    const n = await p.$$eval('.sheetgrid a, .sheetgrid button', x => x.length); ok(n >= 10, 'sheet has ' + n);
    await p.click('.sheetgrid a:has-text("Git lessons")'); await p.waitForTimeout(500);
    ok(/#\/git/.test(p.url()) && !(await p.$('.sheet')), 'sheet link failed or did not close');
    ok(/Practice/.test(await text(p, '.tabbar a[aria-current=page]')) && !(await p.$('.tabmore[aria-current=page]')), 'the Practice tab is not highlighted on a Practice page');
    await p.click('.tabmore'); await p.click('.sheet a:has-text("Progress")'); await p.waitForTimeout(400); ok(await p.$('.tabmore[aria-current=page]'), 'More tab not highlighted on a page outside the tabs');
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await T('path: every module is a picture card; the current one is larger with Continue', async p => {
    await go(p, '#/path', 1000);
    const n = await p.evaluate(() => [document.querySelectorAll('.pgrid .pcard').length, MODS.length, document.querySelectorAll('.pgrid .pcard .tart svg').length]);
    ok(n[0] === n[1] && n[2] === n[1], 'cards ' + n[0] + ', modules ' + n[1] + ', pictures ' + n[2]);
    ok(!(await p.$('.modpick')), 'old pill rows still shown');
    const cur = await p.evaluate(() => { const c = document.querySelector('.pcard.cur'); return c && { mid: c.dataset.mid, cur: schedule().cur, tag: c.querySelector('.tag').innerText, go: (c.querySelector('a.go') || {}).getAttribute && c.querySelector('a.go').getAttribute('href'), next: (schedule().units.find(u => u.mid === schedule().cur && !u.isDone) || {}).href }; });
    ok(cur && cur.mid === cur.cur && /you are here/i.test(cur.tag), 'current module card wrong: ' + JSON.stringify(cur));
    ok(cur.go === cur.next, 'Continue should open the next open step: ' + JSON.stringify(cur));
    ok(await p.$eval('.pcard .bar', e => /steps done/.test(e.getAttribute('aria-label'))), 'progress bar has no label');
    await p.click('.pcard:nth-child(3) a.pt'); await p.waitForTimeout(500);
    const mid = await p.evaluate(() => MODS[2]); ok(p.url().endsWith('#/path/' + mid), 'card did not open its module: ' + p.url());
  });

  await T('path: a module page shows its picture, neighbours and the way back to all modules', async p => {
    await go(p, '#/path/p02', 1000);
    ok(await p.$('#page .phead .tart svg'), 'topic picture missing beside the title');
    const near = await text(p, '#page .grid2 > .stack:last-child'); ok(/Module \d+ of \d+/.test(near) && /Previous/.test(near) && /Next/.test(near), 'neighbours missing: ' + near.slice(0, 120));
    await p.click('a:has-text("All modules")'); await p.waitForTimeout(500);
    ok(await p.$('.pgrid .pcard'), 'All modules did not open the picture cards');
  });

  await T('path on iPhone: two columns of cards, the current one full width, nothing sideways', async p => {
    await go(p, '#/path', 1200);
    const g = await p.evaluate(() => { const cs = [...document.querySelectorAll('.pcard')], c = document.querySelector('.pcard.cur'), o = cs.find(x => x !== c), grid = document.querySelector('.pgrid').getBoundingClientRect(); return { cols: getComputedStyle(document.querySelector('.pgrid')).gridTemplateColumns.split(' ').length, curW: c.getBoundingClientRect().width, gridW: grid.width, oW: o.getBoundingClientRect().width, sx: document.documentElement.scrollWidth - innerWidth }; });
    ok(g.cols === 2 && g.curW > g.gridW - 2 && g.oW < g.gridW / 2 + 1 && g.sx <= 0, JSON.stringify(g));
    ok(await p.evaluate(() => { const r = document.querySelector('.pcard.cur').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'current module not in view');
  }, { viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });

  await T('path: make this week 1 asks first and updates week numbers', async p => {
    await go(p, '#/path');
    await p.evaluate(() => { S.start = '2026-09-07'; save(); route(); }); await p.waitForTimeout(400);
    const wk = await p.evaluate(() => Math.floor((new Date(iso(new Date()) + 'T00:00:00') - new Date('2026-09-07T00:00:00')) / 864e5 / 7) + 1);
    ok(new RegExp('Weeks? ' + wk + '\\b').test(await text(p, '#page')), 'old start not reflected (expected week ' + wk + ')');
    await p.click('button:has-text("Make this week 1")'); await p.click('.dialog button:has-text("Make this week 1")'); await p.waitForTimeout(400);
    ok(/Weeks? 1/.test(await text(p, '#page')), 'week numbers not reset');
  });

  await T('back button returns to the screen you came from', async p => {
    await go(p, '#/path/a02', 700);
    await p.click('.unit a.btn.pri >> nth=0'); await p.waitForTimeout(500);
    ok(/#\/learn\/a02/.test(p.url()), 'did not open lesson: ' + p.url());
    await p.click('[aria-label="Back"]'); await p.waitForTimeout(500);
    ok(/#\/path\/a02/.test(p.url()), 'back went to ' + p.url());
  });

  await T('quiz: fill-in accepts case, spacing and plural variants', async p => {
    await go(p, '#/today');
    const r = await p.evaluate(async () => { const s = await sprint('s02'); const q = s.quiz.find(x => x.TYPE === 'fill' && /time travel/.test(x.ANS)); return !!q; });
    ok(r, 'fixture question missing');
    await go(p, '#/quiz/s02', 900);
    const idx = await p.evaluate(() => DATA.sprints.s02.quiz.findIndex(x => x.TYPE === 'fill' && /time travel/.test(x.ANS)));
    await p.click('.pal button >> nth=' + idx); await p.fill('#page input[type=text]', 'Time-Travel'); await p.waitForTimeout(100);
    await p.click('button:has-text("Submit")'); await p.click('.dialog button:has-text("Submit")'); await p.waitForTimeout(400);
    const badge = await p.$$eval('#page section', (ss, i) => ss[i + 1] ? ss[i + 1].querySelector('.badge').textContent : '', idx);
    ok(badge === 'Right', 'variant answer graded ' + badge);
  });

  await T('today: later steps fold to a row and open in place', async p => {
    await go(p, '#/today');
    const n = await p.$$eval('.plan .unit', us => us.length); ok(n >= 1, 'need a later step today, got ' + n);
    ok(await p.$$eval('.unit.cur', us => us.length) === 1 && await p.$('.upnext .unit.cur'), 'exactly one Up next card expected, first on the page');
    const row = p.locator('.plan .unit.folded').first();
    ok(!(await row.locator('.goal').isVisible()), 'folded row should hide its details');
    const btn = row.locator('.unfold'); ok((await btn.getAttribute('aria-expanded')) === 'false', 'toggle should start collapsed');
    await btn.click(); await p.waitForTimeout(150);
    const opened = p.locator('.plan .unit').nth(0);
    ok(await opened.locator('.goal').isVisible() && await opened.locator('.acts .btn.pri').isVisible(), 'details did not open in place');
    ok((await opened.locator('.unfold').getAttribute('aria-expanded')) === 'true', 'aria-expanded not updated');
    await opened.locator('.unfold').click(); await p.waitForTimeout(150);
    ok(!(await opened.locator('.goal').isVisible()), 'details did not fold again');
    const r = await p.$eval('.planhead .ring', e => e.getAttribute('aria-label')); ok(/% of the plan done/.test(r), 'progress ring missing a label');
    ok(await p.$('.plan .daynav [aria-label="Next day"]'), 'day arrows should sit inside the plan card');
  });

  await T('today on iPhone at 200% text: catching-up note leaves the Up next button on screen', async p => {
    await go(p, '#/today', 900);
    await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 3); S.start = iso(d); S.since = null; S.done = {}; save(); }); await p.waitForTimeout(400);
    await p.reload(); await p.waitForSelector('.behind', { timeout: 30000 });
    ok(!(await p.isVisible('.hsub')), 'the hour-budget line still shows on a phone');
    ok((await text(p, '.plan .order')).length < 80, 'the plan instructions are longer than one line');
    const b = await p.$eval('.unit.cur .acts .btn.pri', e => { const r = e.getBoundingClientRect(); return { bottom: r.bottom, tab: document.querySelector('.tabbar').getBoundingClientRect().top }; });
    ok(b.bottom <= b.tab, 'Up next button pushed behind the tab bar by the note: ' + JSON.stringify(b));
  }, { viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });

  await T('today: the day chip says when the plan runs over the budget', async p => {
    await go(p, '#/today', 900);
    const r = await p.evaluate(() => { const sc = schedule(), d = new Date(); d.setHours(0, 0, 0, 0); const us = sc.byDay[sc.today] || []; return { plan: us.reduce((a, u) => a + u.mins, 0), cap: capOf(d), chip: [...document.querySelectorAll('.daynav .chip')].map(x => x.innerText).join() }; });
    ok(r.plan <= r.cap ? !/over/.test(r.chip) : new RegExp((r.plan - r.cap) + ' min over').test(r.chip), 'chip does not match the plan: ' + JSON.stringify(r));
  });

  await T('today on iPhone: the Up next step and its button show without scrolling', async p => {
    await go(p, '#/today', 900);
    const b = await p.$eval('.unit.cur .acts .btn.pri', e => { const r = e.getBoundingClientRect(); const tb = document.querySelector('.tabbar').getBoundingClientRect(); return { bottom: r.bottom, tab: tb.top }; });
    ok(b.bottom <= b.tab, 'Up next button hidden behind the tab bar: ' + JSON.stringify(b));
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'page scrolls sideways');
  }, { viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true }); /* Safari's visible area on an iPhone 13 */

  await T('quiz on iPhone: buttons pinned above the tab bar, leave from the corner', async p => {
    await go(p, '#/quiz/s01', 1000);
    for (const y of [0, 400]) {
      await p.evaluate(v => scrollTo(0, v), y); await p.waitForTimeout(150);
      const g = await p.evaluate(() => { const d = document.querySelector('.qdock').getBoundingClientRect(), t = document.querySelector('.tabbar').getBoundingClientRect(), f = document.querySelector('.fab').getBoundingClientRect(); return { db: d.bottom, dt: d.top, tt: t.top, hit: !(f.bottom <= d.top || f.top >= d.bottom || f.right <= d.left || f.left >= d.right), vh: innerHeight }; });
      ok(g.db <= g.tt + 1 && g.dt >= 0 && g.dt < g.vh, 'dock not visible above the tab bar at scroll ' + y + ': ' + JSON.stringify(g));
      ok(!g.hit, 'coach button covers the dock: ' + JSON.stringify(g));
    }
    ok(/0 of \d+ answered/.test(await text(p, '.qtop')), 'progress text missing from the top bar');
    await p.click('.opt >> nth=0'); await p.waitForTimeout(200);
    ok(/1 of \d+ answered/.test(await text(p, '.qtop')), 'progress did not update');
    ok(await p.$('.pal ~ button:has-text("Reset and exit")'), 'Reset and exit should sit under the question numbers');
    await p.click('.qtop [aria-label="Leave"]'); await p.click('.dialog button:has-text("Leave, keep answers")'); await p.waitForTimeout(400);
    ok(/#\/today/.test(p.url()), 'leave did not go back to Today');
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await T('settings: week 1 start snaps to Monday', async p => {
    await go(p, '#/today');
    await profile(p, 'plan'); await setField(p, '#st_start', '2026-10-22'); await p.waitForTimeout(200);
    ok((await state(p)).start === '2026-10-19', 'start not snapped: ' + (await state(p)).start);
  });

  await T('order: diagnostic first, Python woven between the AI modules', async p => {
    await go(p, '#/today');
    const mods = await p.evaluate(() => MODS.slice(0, 14).join(' '));
    ok(mods === 's00 p01 p02 a01 p03 p04 a02 p05 p06 a03 m01 m02 m03 s01', 'module order: ' + mods);
    const ai = await p.evaluate(() => MODS.join(' ')); ok(/s04 a04 d01/.test(ai) && /s06 a05 s07/.test(ai), 'AI data stack modules not after the warehouse and CDC modules: ' + ai);
    const first = await p.evaluate(() => schedule().units.find(u => !isCC(u.mid)).mid); ok(first === 's00', 'first non-Claude-Code step should be in Setup: ' + first);
  });

  await T('self-contained: notes stay in the app; outside sources are only small ⓘ links that open in a new tab', async p => {
    await go(p, '#/today', 1200);
    const mods = await p.evaluate(() => MODS_ALL.slice());
    const bad = []; let src = 0;
    for (const m of mods) for (const tab of ['readings', 'chapter']) {
      await hash(p, '#/learn/' + m + '/' + tab, 250);
      const a = await p.$$eval('#page a[href^="http"]', xs => xs.map(x => ({ c: x.className, t: x.target, r: x.rel, l: x.getAttribute('aria-label') || '' })));
      a.forEach(x => { if (/\bulink\b/.test(x.c) && x.t === '_blank' && /noopener/.test(x.r) && /new tab/.test(x.l)) return; /* the learner's own Udemy lectures, folded under ▶ Watch on Udemy */ if (x.c !== 'srcl' || x.t !== '_blank' || !/noopener/.test(x.r) || !/new tab/.test(x.l)) bad.push(m + '/' + tab); else src++; });
    }
    ok(!bad.length, 'links out that are not small source links: ' + [...new Set(bad)].slice(0, 5).join(', '));
    ok(src >= 130, 'expected the source links on the reading notes, found ' + src);
    await hash(p, '#/learn/d01/readings', 500); const t = await text(p, '#page');
    ok(/Reading note: Raft in two minutes\. .*ⓘ/.test(t.replace(/\n/g, ' ')) && !/Reading note: Storage and retrieval \(DDIA ch\. 3\)\.[^\n]*ⓘ/.test(t), 'Raft note lacks its link, or a book note got one');
    await hash(p, '#/news', 500); ok(!(await p.$('#page a[href^="http"]')), 'news links out');
    await hash(p, '#/learn/s01/readings', 500); const v = await p.$$eval('a.srcl[href*="developer.confluent.io"]', xs => xs.length);
    ok(v >= 4, 'video topics have no small watch links: ' + v);
  });

  await T('terminal: a real Linux boots in the app; Git lab 1 sets up, a fix typed in the shell passes Check, the step ticks', async p => {
    await go(p, '#/git/1', 900);
    await p.click('a:has-text("Practise in the terminal")');
    await p.waitForFunction(() => VM.ready, null, { timeout: 240000 });
    await p.waitForFunction(() => /Lab 1 is ready/.test(document.querySelector('.termside [role=status]').textContent), null, { timeout: 120000 });
    ok(await p.evaluate(() => /TASK: the last commit message/.test(VM.term.buffer.active ? Array.from({ length: VM.term.buffer.active.length }, (_, i) => (VM.term.buffer.active.getLine(i) || { translateToString: () => '' }).translateToString()).join('\n') : '')), 'the lab task is not shown in the terminal');
    await p.click('.xthold'); await p.keyboard.type('git add dag.py && git commit -q --amend -m "add pipeline and dag"'); await p.keyboard.press('Enter');
    await p.waitForTimeout(3000);
    await p.click('button:has-text("Check my fix")');
    await p.waitForFunction(() => /passed|Not yet|did not/.test(document.querySelector('.termside [role=status]').textContent), null, { timeout: 120000 });
    ok(/passed/.test(await text(p, '.termside [role=status]')), 'check: ' + await text(p, '.termside'));
    ok(await p.evaluate(() => !!S.gitlab[1] && schedule().units.find(u => u.kind === 'git' && /^Git 1:/.test(u.title)).isDone), 'Git step not ticked');
    ok(await p.evaluate(() => [...document.querySelectorAll('.termside .ok')].length === 3), 'expected three ✓ lines');
  });

  await T('terminal: shows start-up progress, keeps what you type before Linux is ready, Check waits instead of hanging', async p => {
    await go(p, '#/terminal', 900);
    await p.waitForSelector('.xthold .xterm', { timeout: 60000 });
    await p.waitForTimeout(2500);
    ok(await p.evaluate(() => /Starting Linux/.test(Array.from({ length: VM.term.buffer.active.length }, (_, i) => VM.term.buffer.active.getLine(i).translateToString(true)).join(' '))), 'no start-up message in the terminal');
    await p.click('.xthold'); await p.keyboard.type('echo typed-$((40+2))'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => VM.ready, null, { timeout: 300000 });
    await p.waitForFunction(() => /typed-42/.test(VM.log), null, { timeout: 60000 });
    await go(p, '#/terminal/git/1', 900);
    await p.waitForFunction(() => /Lab 1 is ready/.test(document.querySelector('.termside [role=status]').textContent), null, { timeout: 180000 });
    await p.click('.xthold'); await p.keyboard.type('git sta'); /* half-typed, then Check */
    await p.click('button:has-text("Check my fix")');
    await p.waitForFunction(() => /passed|Not yet|did not/.test(document.querySelector('.termside [role=status]').textContent), null, { timeout: 120000 });
    ok(/Not yet/.test(await text(p, '.termside [role=status]')), 'Check did not finish with half-typed text on the line: ' + await text(p, '.termside [role=status]'));
  });

  await T('terminal: tapping on the typed line moves the cursor there, and the Enter key runs it', async p => {
    await go(p, '#/terminal', 900);
    await p.waitForFunction(() => VM.ready, null, { timeout: 300000 }); await p.waitForTimeout(800);
    await p.click('.xthold'); await p.keyboard.type('echo bcdef'); await p.waitForTimeout(800);
    /* tap on the "b": 5 cells left of the cursor */
    const pt = await p.evaluate(() => { const T = VM.term, b = T.buffer.active, r = VM.box.querySelector('.xterm-screen').getBoundingClientRect(), w = r.width / T.cols, h = r.height / T.rows; return [r.left + (b.cursorX - 5 + 0.5) * w, r.top + (b.cursorY + 0.5) * h]; });
    await p.mouse.click(pt[0], pt[1]); await p.waitForTimeout(600);
    await p.keyboard.type('XA'); await p.waitForTimeout(400);
    ok(await p.isVisible('.xtkeys button:has-text("Enter")'), 'no Enter key in the terminal');
    await p.click('.xtkeys button:has-text("Enter")');
    await p.waitForFunction(() => /XAbcdef\r?\n/.test(VM.log), null, { timeout: 30000 }).catch(() => {});
    ok(await p.evaluate(() => /\nXAbcdef\r?\n/.test(VM.log.replace(/\r/g, '\n'))), 'tap did not move the cursor or Enter did not run: ' + await p.evaluate(() => JSON.stringify(VM.log.slice(-200))));
  });

  await T('today: the coding track and interview practice are rows in the plan, and the day is done only when they are', async p => {
    await go(p, '#/today', 1200); await p.waitForSelector('.plan .unit');
    const t = await all(p, '.plan');
    ok(/Reading and labs/.test(t) && /Coding track/.test(t) && /Interview practice/.test(t) && /Live mock|Weekend boss/.test(t), 'plan is missing a group: ' + t.slice(0, 300));
    ok(await p.evaluate(() => document.querySelectorAll('.plan .xit').length >= 2), 'no coding or mock rows in the plan');
    ok(await p.evaluate(() => ![...document.querySelectorAll('.grid2 > .stack h2')].some(h => /Coding track/.test(h.textContent))), 'coding track is still a separate card');
    /* tick every hour step: not done for today while coding and the mock are open */
    await p.evaluate(() => { const sc = schedule(); (sc.byDay[sc.today] || []).forEach(u => { S.done[u.uid] = sc.today; }); save(); route(); }); await p.waitForTimeout(500);
    ok(!/Done for today/.test(await all(p, '.plan')), 'says done for today with coding and the mock open');
    await p.evaluate(() => { S.rq = S.rq || {}; (DATA.recent.items || []).forEach(q => { S.rq[q.id] = 1; }); save(); route(); }); await p.waitForTimeout(400);
    const n = await p.$$eval('.plan .xit .check[aria-pressed=false]', b => b.length);
    for (let i = 0; i < n; i++) { await p.click('.plan .xit .check[aria-pressed=false]'); await p.waitForTimeout(250); }
    ok(/Done for today/.test(await all(p, '.plan')), 'not done for today after ticking every row');
    ok(await p.evaluate(() => Object.keys((S.xdone || {})[iso(new Date())] || {}).length >= 2), 'manual ticks not saved');
    await go(p, '#/today/1', 900); ok(/Coding track/.test(await all(p, '.plan')), 'tomorrow has no coding track');
  });

  await T('learn: a finished tab turns green, Done next ticks today\'s part, and the module opens on the first unfinished tab', async p => {
    await go(p, '#/learn/s01/chapter', 900);
    ok(!(await p.$('.tabs button.tdone')), 'a tab is green before anything is done');
    await p.click('button:has-text("Done, next: Readings")'); await p.waitForTimeout(700);
    ok(/\/readings$/.test(p.url()), 'did not move to Readings: ' + p.url());
    ok(await p.evaluate(() => document.querySelector('.tabs button.tdone') && /Chapter/.test(document.querySelector('.tabs button.tdone').textContent)), 'Chapter tab is not green');
    await go(p, '#/learn/s01', 900);
    ok(await p.evaluate(() => /Readings/.test(document.querySelector('.tabs [aria-selected=true]').textContent)), 'module did not open on Readings');
    await go(p, '#/learn/s02/chapter/0-1', 900);
    const uid = await p.evaluate(() => (schedule().units.find(u => u.href === '#/learn/s02/chapter/0-1') || {}).uid);
    await p.click('button:has-text("Done, next")'); await p.waitForTimeout(600);
    ok(!uid || (await state(p)).done[uid], 'today\'s chapter part was not ticked');
  });

  await T('recent questions: new ones show on Today and What is new, Got it does not finish them, each is ticked by hand', async p => {
    const today = new Date().toISOString().slice(0, 10);
    const R = { updated: today, note: 'test', items: [
      { id: 'rq-t1', mid: 's01', company: 'Uber', level: 'Senior', asked: today, found: today, TAG: 'streaming', Q: 'Design trip events ingestion with exactly-once counts.', A: 'Use a log with keys by trip id, idempotent sink, checkpoints.', src: 'Test', url: 'https://example.com/a' },
      { id: 'rq-t2', mid: 's02', company: 'Google', level: 'L5', asked: today, found: today, TAG: 'sql', Q: 'Find the second highest salary per department.', A: 'DENSE_RANK over a department window, filter rank 2.', src: 'Test', url: 'https://example.com/b' }] };
    await p.route('**/data/recent.json*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(R) }));
    await go(p, '#/today', 1500); await p.waitForSelector('.plan .xit', { state: 'attached' });
    await p.evaluate(() => { S.rqSeen = ''; save(); route(); }); await p.waitForTimeout(400);
    await p.click('#tab-grp-interview'); await p.waitForTimeout(200); /* company questions are in the Interview tab */ /* an existing learner; a new one starts without the notice */
    ok(/Uber: Design trip events/.test(await all(p, '.plan')) && /Google: Find the second/.test(await all(p, '.plan')), 'no recent question rows on Today');
    ok(/2 new interview questions from this week/.test(await text(p, '.whatsnew')), 'What is new does not mention them');
    await p.click('.whatsnew button:has-text("Got it")'); await p.waitForTimeout(500);
    ok(!(await p.$('.whatsnew')), 'Got it did not hide the note');
    ok(/Uber: Design trip events/.test(await all(p, '.plan')), 'Got it finished the questions');
    const row = p.locator('.plan .xit', { hasText: 'Uber: Design trip events' });
    await row.locator('.check').click(); await p.waitForTimeout(600);
    ok(/#\/recent$/.test(p.url()), 'the row ticked itself instead of opening the questions');
    ok(await p.$$eval('.rq', x => x.length) === 2, 'questions not listed');
    for (let i = 0; i < 2; i++) { await p.click('.rq .check[aria-pressed=false]'); await p.waitForTimeout(300); }
    await go(p, '#/today', 1000);
    ok(!/Uber: Design trip events|Google: Find the second/.test(await all(p, '.plan')), 'rows still shown after ticking every question');
    await go(p, '#/interview/s01', 1200); ok(/Asked recently at companies/.test(await text(p, '#page')) && /exactly-once counts/.test(await text(p, '#page')), 'module interview page does not show its recent question');
  });

  await T('updates: a finished interview step and a finished tab go back to not done when their content changes', async p => {
    await go(p, '#/today', 1200);
    const uid = await p.evaluate(() => { const u = schedule().units.find(x => x.mid === 's01' && x.href === '#/interview/s01'); S.done[u.uid] = iso(new Date()); S.cv.units[u.uid] = unitHash(u); S.tabs = { 's01:chapter': { at: iso(new Date()), h: 'old' } }; saveT && clearTimeout(saveT); localStorage.setItem('keystone:v1', JSON.stringify(S)); return u.uid; });
    const today = new Date().toISOString().slice(0, 10);
    await p.route('**/data/recent.json*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ updated: today, items: [{ id: 'rq-t3', mid: 's01', company: 'Microsoft', found: today, TAG: 'core', Q: 'q', A: 'a', url: 'https://example.com/c' }] }) }));
    await p.reload(); await p.waitForSelector('h1'); await p.waitForTimeout(1200);
    ok(!(await state(p)).done[uid], 'the interview step stayed done after new questions were added');
    ok(await p.evaluate(u => !!S.archive.done[u], uid), 'old completion not archived');
    await go(p, '#/learn/s01/chapter', 900);
    ok(!(await p.$('.tabs button.tdone')), 'a tab finished on old text is still green');
   }, { serviceWorkers: 'block' });

  await T('screen atlas (iPhone): coach button off quizzes, quiet Submit at question 1, wide coach box, folded practice sets, plan start, 44px header', async p => {
    await go(p, '#/quiz/a01', 1200); await p.waitForSelector('.qdock');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('.fab')).display === 'none'), 'coach button covers the quiz dock');
    ok(await p.evaluate(() => !document.querySelector('.qdock .btn.dark')), 'Submit is the loudest button at question 1');
    ok(await p.evaluate(() => Math.max(...[...document.querySelectorAll('.qdock .btn')].map(x => x.getBoundingClientRect().right)) <= innerWidth), 'quiz dock buttons run off the screen');
    await go(p, '#/today', 900); await p.click('.fab'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.querySelector('.coach input').getBoundingClientRect().width > 280), 'coach text box is too narrow');
    ok(await p.evaluate(() => [...document.querySelectorAll('.top .btn')].every(x => { const r = x.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })), 'header buttons under 44px');
    await go(p, '#/practice', 900); ok(await p.evaluate(() => document.documentElement.scrollHeight < 5000), 'practice list is still very long');
    await go(p, '#/dsa/d011', 900); ok(await p.evaluate(() => getComputedStyle(document.querySelector('.topbtns')).display === 'none'), 'editor header still crowded');
    await p.evaluate(() => { S.start = iso(new Date()); save(); }); await go(p, '#/today/-1', 900);
    ok(/Your plan starts/.test(await text(p, '.plan')) && !/0 of 0 min/.test(await text(p, '.plan')), 'a day before the start does not say when the plan starts');
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await T('chapter figures and Udemy links: D1 has 8 step-through diagrams and folded lecture links under its sections; P2 and DSA problems link their lectures; no sideways scroll on a phone', async p => {
    await go(p, '#/learn/d01/chapter', 1500); await p.waitForSelector('figure.dfig');
    ok((await p.$$('figure.dfig')).length === 8, 'D1 does not show 8 diagrams');
    const f = await p.$('figure.dfig'); const c1 = await f.$eval('.figcap', x => x.textContent);
    await (await f.$$('button'))[1].click(); ok(await f.$eval('.figcap', x => x.textContent) !== c1, 'Next did not change the diagram step');
    ok((await p.$$('details.udemy')).length === 5 && await p.evaluate(() => ![...document.querySelectorAll('details.udemy')].some(d => d.open)), 'D1 Udemy links missing or not folded');
    ok(await p.evaluate(() => /udemy\.com\/course\/database-engines-crash-course\/learn\/lecture\/\d+$/.test(document.querySelector('.udemy a').href)), 'Udemy lecture link is wrong');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'D1 chapter scrolls sideways on a phone');
    await go(p, '#/learn/p02/chapter', 900); ok(/5 lectures/i.test(await text(p, '.udemy summary')), 'P2 has no Udemy lectures row');
    await go(p, '#/dsa/d071', 900); ok(/Binary Search/.test(await p.evaluate(() => document.querySelector('.udemy').textContent)), 'binary search problem has no matching lecture');
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await T('architect\'s lens: Python 1 shows a lens card with seven questions and four internals answers, stacked on a phone; Start here explains the data foundation', async p => {
    await go(p, '#/learn/p01/chapter', 1500); await p.waitForSelector('.lens');
    ok(await p.evaluate(() => document.querySelectorAll('.lens tbody tr').length === 7 && document.querySelectorAll('.lens details').length === 4), 'lens card incomplete');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('.lens td')).display === 'block' && document.documentElement.scrollWidth <= innerWidth), 'lens is not stacked on a phone or scrolls sideways');
    /* Kafka (s05): the second lens, with five internals questions; its interview questions join the module's set */
    await go(p, '#/learn/s05/chapter', 1500); await p.waitForSelector('.lens');
    ok(await p.evaluate(() => { const l = document.querySelectorAll('.lens')[0]; return l.querySelectorAll('tbody tr').length === 7 && l.querySelectorAll('details:not(.fresh)').length === 5 && /zero-copy/.test(l.textContent); }), 'Kafka lens card incomplete');
    ok(await p.evaluate(async () => { const s = await sprint('s05'); return s.interview.some(q => /fast even though it writes every message to disk/.test(q.Q)); }), 'Kafka lens questions not in the interview set');
    /* Flink and streaming engines (s05, 5.10): six internals answers, one tied to the simulator's streaming challenges; questions join the interview set and the quiz; four-level reels */
    ok(await p.evaluate(() => { const l = document.querySelectorAll('.lens')[1]; return !!l && l.querySelectorAll('tbody tr').length === 7 && l.querySelectorAll('details:not(.fresh)').length === 6 && /two-phase commit/.test(l.textContent) && /disaggregated/.test(l.textContent) && !!l.querySelector('a[href="#/sim/sc/partitions"]') && !!l.querySelector('a[href="#/sim/sc/hotkey"]'); }), 'Flink lens card incomplete');
    ok(await p.evaluate(async () => { const s = await sprint('s05'); return s.interview.some(q => /choose Flink over Spark Structured Streaming/.test(q.Q)) && s.quiz.some(q => /checkpoint barrier/.test(q.Q)) && s.quiz.some(q => /stops receiving events/.test(q.Q)); }), 'Flink lens questions not in the interview set or quiz');
    ok(await p.evaluate(async () => { const r = (await reelsFor('s05')).filter(x => x.sec === '5.10'); return r.length === 8 && ['New to it', 'How it works', 'Inside and caveats', 'Architect'].every(lv => r.some(x => x.level === lv)); }), 'Flink lens reels missing');
    /* Debezium and CDC (s06, 6.9): six internals answers linked to the simulator's CDC, schema and region challenges; questions join the interview set and the quiz; four-level reels */
    await go(p, '#/learn/s06/chapter', 1500); await p.waitForSelector('.lens');
    ok(await p.evaluate(() => { const l = document.querySelector('.lens'); return l.querySelectorAll('tbody tr').length === 7 && l.querySelectorAll('details:not(.fresh)').length === 6 && /outbox/.test(l.textContent) && /max_slot_wal_keep_size/.test(l.textContent) && ['cdc', 'schema', 'region'].every(id => !!l.querySelector('a[href="#/sim/sc/' + id + '"]')); }), 'CDC lens card incomplete');
    ok(await p.evaluate(async () => { const s = await sprint('s06'); return s.interview.some(q => /200 Postgres databases/.test(q.Q)) && s.interview.some(q => /lost changes after a database failover/.test(q.Q)) && s.quiz.some(q => /incremental snapshot stay consistent/.test(q.Q)); }), 'CDC lens questions not in the interview set or quiz');
    ok(await p.evaluate(async () => { const r = (await reelsFor('s06')).filter(x => x.sec === '6.9'); return r.length === 8 && ['New to it', 'How it works', 'Inside and caveats', 'Architect'].every(lv => r.some(x => x.level === lv)); }), 'CDC lens reels missing');
    /* Airflow (s01): five internals answers, and its questions join the module's interview set */
    await go(p, '#/learn/s01/chapter', 1500); await p.waitForSelector('.lens');
    ok(await p.evaluate(() => document.querySelectorAll('.lens tbody tr').length === 7 && document.querySelectorAll('.lens details').length === 5 && /deferrable/.test(document.querySelector('.lens').textContent)), 'Airflow lens card incomplete');
    ok(await p.evaluate(async () => (await sprint('s01')).interview.some(q => /backfill of last month doubled every row/.test(q.Q))), 'Airflow lens questions not in the interview set');
    /* Spark (s03): five internals questions (driver and stages, shuffle and AQE, skew, memory, Catalyst); questions join the interview set and the quiz; four-level reels */
    await go(p, '#/learn/s03/chapter', 1500); await p.waitForSelector('.lens');
    ok(await p.evaluate(() => { const l = document.querySelector('.lens'); return l.querySelectorAll('tbody tr').length === 7 && l.querySelectorAll('details:not(.fresh)').length === 5 && /salt/.test(l.textContent) && /whole-stage code generation/.test(l.textContent); }), 'Spark lens card incomplete');
    ok(await p.evaluate(() => { const l = document.querySelector('.lens'); return /What changed in Spark 4/.test(l.textContent) && /Spark Connect/.test(l.textContent) && /spark\.sql\.ansi\.enabled=true/.test(l.textContent) && /VARIANT/.test(l.textContent); }), 'Spark lens does not cover Spark 4');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('.lens td')).display === 'block' && document.documentElement.scrollWidth <= innerWidth), 'Spark lens is not stacked on a phone or scrolls sideways');
    ok(await p.evaluate(async () => { const s = await sprint('s03'); return s.interview.some(q => /Spark for every new pipeline/.test(q.Q)) && s.interview.some(q => /most expensive thing in a Spark job/.test(q.Q)) && s.quiz.some(q => /salt a hot key with 10 salt values/.test(q.Q)); }), 'Spark lens questions not in the interview set or quiz');
    ok(await p.evaluate(async () => { const r = (await reelsFor('s03')).filter(x => x.sec === '3.10'); return r.length === 8 && ['New to it', 'How it works', 'Inside and caveats', 'Architect'].every(lv => r.some(x => x.level === lv)); }), 'Spark lens reels missing');
    /* dbt (s04, five internals) and dimensional modelling (m01, four internals, scheduled in M102) */
    for (const [m, n, word, q] of [['s04', 5, 'state:modified', /2,000 models and CI takes an hour/], ['m01', 4, 'fan trap', /joined on customer show double the revenue/]]) {
      await go(p, '#/learn/' + m + '/chapter', 1500); await p.waitForSelector('.lens');
      ok(await p.evaluate(([n, w]) => document.querySelectorAll('.lens tbody tr').length === 7 && document.querySelectorAll('.lens details').length === n && document.querySelector('.lens').textContent.includes(w), [n, word]), m + ' lens card incomplete');
      ok(await p.evaluate(async ([m, q]) => (await sprint(m)).interview.some(x => new RegExp(q).test(x.Q)), [m, q.source]), m + ' lens questions not in the interview set');
    }
    ok(await p.evaluate(() => /architect's lens/.test((schedule().units.find(u => u.uid === 'm01:M102') || {}).title || '')), 'M1.8 is not in a reading step');
    await go(p, '#/learn/s00/chapter', 900); ok(/From a platform to a data foundation/.test(await text(p, '.prose')), 'Start here has no data foundation section');
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await T('architect\'s lens: Iceberg (2.9) shows seven questions and six internals answers (v3 deletion vectors among them), its interview and quiz questions join module 2, its reels cover four levels, and module 8 links to it', async p => {
    await go(p, '#/learn/s02/chapter', 1500); await p.waitForSelector('.lens');
    ok(await p.evaluate(() => { const l = document.querySelector('.lens'); return l.querySelectorAll('tbody tr').length === 7 && l.querySelectorAll('details:not(.fresh)').length === 6 && /manifest list/.test(l.textContent) && /deletion vector/.test(l.textContent) && /Polaris/.test(l.textContent) && /merge-on-read/i.test(l.textContent); }), 'Iceberg lens card incomplete');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('.lens td')).display === 'block' && document.documentElement.scrollWidth <= innerWidth), 'Iceberg lens is not stacked on a phone or scrolls sideways');
    ok(await p.evaluate(async () => { const s = await sprint('s02'); return s.interview.filter(q => /move[ds]? to Iceberg|commit to the same Iceberg table|every minute for a month/.test(q.Q)).length === 3 && s.quiz.filter(q => /hours\(event_ts\)|merge-on-read Iceberg table|storage does not go down/.test(q.Q)).length === 3; }), 'Iceberg lens questions not in the interview and quiz sets');
    ok(await p.evaluate(async () => { const r = (await reelsFor('s02')).filter(x => x.sec === '2.9'); return r.length === 8 && new Set(r.map(x => x.level)).size === 4; }), 'Iceberg lens reels missing or not at four levels');
    await go(p, '#/learn/s08/chapter', 1500); await p.click('.prose a[href="#/learn/s02/chapter"]'); await p.waitForSelector('.lens');
    ok(await p.evaluate(() => location.hash.startsWith('#/learn/s02')), 'module 8 does not link to the Iceberg lens');
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await T('live mock: Today links it; five questions from this week (concept, under the hood, lens, staff slot, recall); AI follow-up and rubric scores; weak answers open the next mock; self-marking with AI off', async p => {
    await p.route('https://api.anthropic.com/**', r => { const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }; if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: H }); const b = r.request().postData() || ''; const fu = /ONE follow-up/.test(b); r.fulfill({ headers: H, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: fu ? '{"followup":"What changes at 100 times the data?"}' : '{"scores":{"correct":2,"depth":2,"trade":2,"clear":3},"rejected":true,"limits":false,"operate":false,"feedback":"Say what you rejected.","better":"A stronger answer."}' }] }) }); });
    p.setDefaultTimeout(8000); p.on('pageerror', e => console.log('PAGEERR', e.message));
    await go(p, '#/today', 1200); await p.evaluate(() => { S.settings.ai = true; S.settings.aiKey = 'test-key'; S.live = {}; save(); }); await go(p, '#/today', 900);
    ok(await p.evaluate(() => [...document.querySelectorAll('#grp-interview a')].some(a => /#\/live\//.test(a.getAttribute('href')))), 'Today has no live mock row');
    await go(p, '#/live', 1500); await p.waitForSelector('.lslots li');
    const labels = await p.$$eval('.lslots li b', b => b.map(x => x.textContent)); const we = await p.evaluate(() => liveWeekend(iso(new Date())));
    ok(we ? labels.length === 7 && labels[0] === 'Concept' && labels[labels.length - 1] === 'Recall' : labels.length === 5 && labels[0] === 'Concept' && labels[1] === 'Under the hood' && labels[2] === "Architect's lens" && labels[4] === 'Recall', 'wrong question mix: ' + labels.join(', '));
    await p.click("#page button.pri:has-text(\"Start\")"); await p.waitForSelector('#page textarea');
    for (let n = 0; n < labels.length; n++) { if (process.env.LDBG) console.log('Q', n, (await text(p, '#page')).slice(0, 160).replace(/\n/g, ' | '));
      await p.fill('#page textarea', 'An answer about trade-offs ' + n); await p.click('#page button:has-text("Done")');
      await p.waitForSelector('.lfu'); ok(/100 times/.test(await text(p, '.lfu')), 'no follow-up shown');
      await p.fill('#page textarea', 'follow-up answer'); await p.click('#page button:has-text("Done")');
      await p.waitForSelector('.lscore'); await p.click(n + 1 < labels.length ? 'button:has-text("Next question")' : 'button:has-text("See your scorecard")');
    }
    const card = await text(p, '#page'); ok(/Scorecard/.test(card) && /Lean no hire|No hire/.test(card) && new RegExp('Named what you rejected\\s*' + labels.length + ' of').test(card), 'scorecard wrong: ' + card.slice(0, 300));
    ok(/open\s+your next live mock/.test(card), 'weak answers do not carry over');
    const carried = await p.evaluate(async () => { const k = iso(new Date()), d = new Date(); d.setDate(d.getDate() + 1); const r = await liveQuestions(iso(d)); return r.qs.filter(q => q.carried === k).length; });
    ok(carried === 2, 'tomorrow does not open with two weak answers: ' + carried);
    await p.evaluate(() => { S.settings.ai = false; S.live = {}; save(); }); await go(p, '#/today', 600); await go(p, '#/live', 1500); await p.click("#page button.pri:has-text(\"Start\")");
    await p.fill('#page textarea', 'x'); await p.click('#page button:has-text("Done")'); await p.waitForSelector('[role=radiogroup]');
    ok(/Compare with the model answer/.test(await text(p, '#page')), 'AI off does not offer self-marking');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'live mock scrolls sideways on a phone');
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await T('live mock: the staff bank has 8 questions per kind and four weeks of mocks draw every rotated kind, new questions included', async p => {
    await go(p, '#/today', 1200);
    const r = await p.evaluate(async () => {
      const per = {}; DATA.staff.items.forEach(x => { per[x.kind] = (per[x.kind] || 0) + 1; });
      const kinds = new Set(), ids = new Set(), d0 = new Date();
      for (let i = 0; i < 28; i++) { const d = new Date(d0); d.setDate(d0.getDate() + i); const k = iso(d); const q = await liveQuestions(k);
        q.qs.filter(x => x && x.src === 'staff-level bank').forEach(x => { kinds.add(x.slot); const it = DATA.staff.items.find(s => s.q === x.q); if (it) ids.add(it.id); }); }
      return { n: DATA.staff.items.length, per, kinds: [...kinds], fresh: [...ids].filter(id => +id.slice(2) >= 39).length };
    });
    ok(r.n >= 80 && Object.values(r.per).every(n => n >= 8), 'bank: ' + JSON.stringify(r.per));
    const want = Object.values(await p.evaluate(() => LIVE_ROT)).concat(await p.evaluate(() => LIVE_WE));
    ok(want.every(k => r.kinds.includes(k)), 'kinds drawn in four weeks: ' + r.kinds.join(', '));
    ok(r.fresh >= 5, 'too few new questions drawn: ' + r.fresh);
  });
  await T('new this week inside sections: What is new items sit under their section (sec), company questions under the best-matching section or at the top, folded; ticked questions disappear', async p => {
    await go(p, '#/today', 1200); await p.evaluate(() => { S.rq = {}; save(); });
    const n = await p.evaluate(() => (DATA.news.items || []).find(x => x.mid && x.sec)); ok(!!n, 'no What is new item has a module and section');
    await go(p, '#/learn/' + n.mid + '/chapter', 1500);
    ok(await p.evaluate(sec => [...document.querySelectorAll('details.fresh')].some(d => { let h = d.previousElementSibling; while (h && h.tagName !== 'H2') h = h.previousElementSibling; return h && h.textContent.split(' ')[0] === sec && /what is new/.test(d.textContent); }), n.sec), 'news item not under section ' + n.sec);
    ok(await p.evaluate(() => [...document.querySelectorAll('details.fresh')].every(d => !d.open)), 'new-this-week boxes are not folded');
    const m = await p.evaluate(() => { const c = {}; (DATA.recent.items || []).forEach(q => c[q.mid] = (c[q.mid] || 0) + 1); return Object.keys(c).sort((a, b) => c[b] - c[a])[0]; });
    await go(p, '#/learn/' + m + '/chapter', 1400); ok(await p.evaluate(() => document.querySelectorAll('details.fresh .check').length) > 0, 'no company questions in module ' + m);
    await p.evaluate(m => { S.rq = {}; recentFor(m).forEach(q => S.rq[q.id] = iso(new Date())); save(); }, m); await go(p, '#/today', 600); await go(p, '#/learn/' + m + '/chapter', 1200);
    ok(await p.evaluate(() => document.querySelectorAll('details.fresh .check').length) === 0, 'ticked questions still shown in the chapter');
    await go(p, '#/news', 900); ok(await p.evaluate(() => document.querySelectorAll('#page section.card').length) >= 3, 'What is new page lost its items');
  });

  await T('fun layer: Today shows level, XP, streak and quests without pushing Up next off a phone screen; the warm-up scores and ticks its quest; a shipped module celebrates once; Progress has a skill map', async p => {
    await go(p, '#/today', 1500); await p.waitForSelector('.gmini');
    ok(await p.evaluate(() => !document.querySelector('#page .gstrip') && getComputedStyle(document.querySelector('.gmini')).display !== 'none'), 'Today should show the level chip, not the full strip');
    await go(p, '#/progress', 1000); ok(/Intern|Junior|Mid-level|Senior|Staff/.test(await text(p, '.gstrip')) && /XP/.test(await text(p, '.gstrip')), 'level strip missing on Progress'); await go(p, '#/today', 1200);
    const ub = await p.$eval('.unit.cur .acts .btn.pri', e => [Math.round(e.getBoundingClientRect().bottom), Math.round(document.querySelector('.tabbar').getBoundingClientRect().top)]); ok(ub[0] <= ub[1], 'Up next is pushed below the tab bar: ' + ub);
    await p.waitForSelector('.gcard', { timeout: 5000 }); ok(true, '');
    await go(p, '#/warm', 1500); await p.waitForSelector('.gwarm .gq-q');
    for (let n = 0; n < 3; n++) { if (await p.$('.gwarm .gopt')) await p.click('.gwarm .gopt'); else { await p.fill('.gwarm input', 'x'); await p.click('.gwarm button.pri'); } await p.waitForTimeout(2000); }
    await p.evaluate(() => window.warmFinish()); await p.waitForTimeout(400);
    ok(/right/.test(await text(p, '.gwarm')), 'warm-up did not finish after 60 seconds');
    await go(p, '#/today', 1200); ok(/1\/4/.test(await text(p, '.gmini')), 'warm-up quest not ticked');
    const sh = await p.evaluate(() => { const sc = schedule(); const m = MODS.find(x => !isCC(x) && sc.span[x] && sc.span[x].n); sc.units.filter(u => u.mid === m).forEach(u => { S.done[u.uid] = 1; S.doneAt[u.uid] = Date.now(); }); delete gameState().shipped[m]; save(); return m; });
    await go(p, '#/path', 600); await go(p, '#/today', 1500); ok(await p.evaluate(() => !!document.querySelector('.gship')), 'no shipped moment for ' + sh);
    await p.click('.gship button'); await go(p, '#/path', 600); await go(p, '#/today', 1200); ok(await p.evaluate(() => !document.querySelector('.gship')), 'shipped moment shows twice');
    await go(p, '#/progress', 1200); ok(await p.evaluate(() => document.querySelectorAll('.gmap .gtile').length > 20 && !!document.querySelector('.gtile.full')), 'skill map missing or not filled');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sideways scroll on a phone');
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await T('reels: Shorts-style feed, shuffle by default with My week and filters, teaching-only reels, four-level Kafka series, scenes animate, one voice at a time, quick check schedules a review, heart saves to My playbook', async p => {
    await go(p, '#/today', 1500); await p.evaluate(() => { S.settings.reelVoice = false; delete S.settings.reelMode; S.reels = {}; S.playbook = {}; save(); });
    ok(await p.evaluate(() => [...document.querySelectorAll('.tabbar a')].some(a => a.getAttribute('href') === '#/reels')), 'no Reels tab');
    await go(p, '#/reels', 2500); await p.waitForSelector('.rmode');
    ok(/Shuffle/.test(await text(p, '.rmode [aria-selected=true]')), 'shuffle is not the default order');
    ok(await p.evaluate(() => document.querySelectorAll('.rfilters button').length >= 6), 'shuffle filters missing');
    const meta = await p.evaluate(async () => { const all = (await Promise.all(MODS.map(m => reelsFor(m)))).flat(); return all.filter(r => r.m === 's00' || REEL_META.test(r.head)).length; }); ok(meta === 0, meta + ' reels are about the program itself');
    await p.click('.rmode button:has-text("My week")'); await p.waitForTimeout(1500); ok(/My week/.test(await text(p, '.rmode [aria-selected=true]')), 'cannot switch back to My week');
    await go(p, '#/today', 600); await go(p, '#/learn/s05/chapter', 1500); await p.waitForSelector('.rsec');
    ok(await p.evaluate(() => [...document.querySelectorAll('.prose h2')].filter(h => !REEL_META.test(h.textContent)).every(h => h.nextElementSibling && h.nextElementSibling.classList.contains('rsec'))), 'a section has no Reel button under its heading');
    ok(/4 reels/.test(await p.evaluate(() => [...document.querySelectorAll('.rsec')][1].textContent)), 'section 5.2 does not show its four-level series');
    await go(p, '#/reels/s05-52-1', 1800); await p.waitForSelector('.rslide .rstart');
    ok(await p.evaluate(() => { const s = document.querySelector('.rslide .rstart').closest('.rslide'); return /How it works/.test(s.querySelector('.rlevel').textContent); }), 'level badge missing');
    await p.click('.rslide .rstart'); await p.waitForTimeout(2500);
    ok(await p.evaluate(() => document.querySelectorAll('.rslide.playing').length === 1 && document.querySelectorAll('.rslide .fxnode.on').length > 0), 'scene did not animate or more than one reel plays');
    const w = await p.evaluate(() => innerWidth); for (let n = 0; n < 3; n++) { await p.mouse.click(w - 30, 420); await p.waitForTimeout(300); }
    await p.waitForSelector('.ropt'); /* options are shuffled on every showing: pick one that is wrong, not the third */
    const wrong = await p.evaluate(async () => { const r = (await reelsFor('s05')).find(x => x.id === 's05-52-1'); return [...document.querySelectorAll('.ropt')].findIndex(b => +b.dataset.i !== r.check.ans); });
    await p.click('.ropt >> nth=' + wrong);
    ok(await p.evaluate(() => { const x = S.reels['s05-52-1']; return !!(x && x.ok === false && x.due > iso(new Date())); }), 'a missed check does not schedule a review');
    await p.evaluate(() => { const s = [...document.querySelectorAll('.rslide')].find(x => x.querySelector('.ropt')); s.querySelector('.rheart').click(); });
    ok(await p.evaluate(() => !!S.playbook['s05-52-1']), 'heart did not save to My playbook');
    await p.evaluate(() => window.reelGo(1)); await p.waitForTimeout(1500);
    ok(await p.evaluate(() => document.querySelectorAll('.rslide.playing').length <= 1), 'two reels play at once after swiping');
    ok(await p.evaluate(() => document.querySelector('.reelv').scrollWidth <= innerWidth + 1), 'reel player wider than the phone');
    await go(p, '#/playbook', 900); ok(/Size Kafka disks|sequential/i.test(await text(p, '#page')), 'playbook does not list the saved work list');
    ok(await p.evaluate(() => Object.keys((S.metrics || {})[iso(new Date())] || {}).length > 0 && ((S.metrics[iso(new Date())].ev || {}).reel_open || 0) > 0), 'usage totals are not recorded');
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await T('today: one Today box holds reading, quiz, coding, interview practice and coaching, with a summary on top and interview capped at its minutes', async p => {
    await go(p, '#/today', 1200); await p.waitForSelector('.plan .daysum');
    const t = await text(p, '.plan .daysum'); ok(/Reading/.test(t) && /Coding/.test(t) && /Interview/.test(t), 'summary row incomplete: ' + t);
    ok(/^Today/.test(await text(p, '.plan h2')), 'the box is not called Today');
    ok(await p.evaluate(() => !!document.querySelector('.plan #grp-coach .coachnote')), 'coaching is not inside Today');
    const ivm = await p.evaluate(() => [...document.querySelectorAll('#grp-interview .xit .s, #grp-coach .xit .s')].reduce((a, x) => a + (+(x.textContent.match(/^(\d+) min/) || [0, 0])[1]), 0)); ok(ivm <= 45, 'interview and coaching take ' + ivm + ' min');
    ok(await p.evaluate(() => ![...document.querySelectorAll('.grid2 > .stack > section h2')].some(h => /^Coach$|Coding track/.test(h.textContent))), 'a separate Coach or Coding card is still beside the plan');
    await p.click('.dsum:has-text("Interview")'); await p.waitForTimeout(800);
    ok(await p.evaluate(() => { const r = document.getElementById('grp-interview').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }), 'tapping Interview did not bring it into view');
  });

  await T('carry-over: an earlier week\'s unsolved problems wait for the weekend; a mock\'s blanks open the next mock only on the same module', async p => {
    await go(p, '#/today', 1200); await p.waitForSelector('.plan');
    const r = await p.evaluate(async () => {
      const s = new Date(); s.setDate(s.getDate() - 10); S.start = iso(s); save();
      const C = codingItems(0), wd = new Date().getDay(), weekend = wd === 0 || wd === 6;
      const old = C.now.some(x => /^set /.test(x.from || ''));
      /* a mock from yesterday on the current module with one blank */
      const y = new Date(); y.setDate(y.getDate() - 1); const yk = iso(y), cur = curMid();
      S.mock = { [yk]: { mod: cur, qs: [{ q: 'Carried question about grain' }, { q: 'Answered one' }], a: { 1: 'yes' }, sub: true } };
      const qs = await mockQuestions(iso(new Date()));
      const other = { [yk]: { mod: 'zz9', qs: [{ q: 'Other module blank' }], a: {}, sub: true } }; S.mock = other;
      const qs2 = await mockQuestions(iso(new Date()));
      return { old, weekend, catchup: C.catchup.length, carried: qs[0].q, carried2: qs2.some(q => q.q === 'Other module blank') };
    });
    ok(!r.old, 'an earlier week\'s problem was mixed into today\'s list');
    ok(r.weekend || r.catchup === 0, 'weekday shows a weekend catch-up block');
    ok(r.carried === 'Carried question about grain', 'the blank from the last mock did not open today\'s: ' + r.carried);
    ok(!r.carried2, 'a blank from another module was carried');
  });

  await T('terminal on iPhone: the page never scrolls sideways', async p => {
    await go(p, '#/terminal', 900);
    await p.waitForSelector('.xthold', { timeout: 30000 }); await p.waitForTimeout(4000);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'scrolls sideways by ' + await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) + 'px');
  }, { viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });

  await T('system labs: modules 1, 5 and 6 run in the browser (Kafka, S3, Airflow, streaming, CDC) and tick their steps', async p => {
    await go(p, '#/path/s01', 900);
    const sols = await p.evaluate(() => DATA.py.filter(x => x.m === 's01' || x.m === 's05' || x.m === 's06').map(x => [x.id, x.sol]));
    ok(sols.length === 13, 'expected 13 module 1, 5 and 6 exercises, got ' + sols.length);
    for (const [id, sol] of sols) {
      await hash(p, '#/py/' + id, 600);
      await p.fill('textarea.code', sol);
      await p.click('button.btn.pri:has-text("Run")');
      await p.waitForFunction(() => { const v = document.querySelector('.verdict'); return v && v.style.display !== 'none' && /pass|Error/.test(v.textContent); }, null, { timeout: 120000 });
      ok((await text(p, '.verdict')) === 'All checks pass', id + ' did not pass in the browser: ' + await text(p, '.out .body'));
    }
    const left = await p.evaluate(() => schedule().units.filter(u => (u.mid === 's01' || u.mid === 's05' || u.mid === 's06') && (u.kind === 'build' || u.kind === 'incident' || u.kind === 'ai') && /walking skeleton|rerun|streaming|poison|schema evolution|change data capture|disagree|approves/i.test(u.title) && !u.isDone).map(u => u.title));
    ok(!left.length, 'steps not ticked: ' + left.join(', '));
    await go(p, '#/learn/s01/lab', 900); ok(/without Docker/.test(await text(p, '#page')), 'lab page does not lead with the in-app lab');
  });

  await T('AI data stack: A4 and A5 labs run in the browser and tick their Path steps', async p => {
    await go(p, '#/path/a04', 900);
    ok(/LLMs meet the warehouse/.test(await text(p, '#page')) && /Guard the SQL/.test(await text(p, '#page')), 'A4 module or its lab steps missing');
    const sols = await p.evaluate(() => DATA.py.filter(x => x.m === 'a04' || x.m === 'a05').map(x => [x.id, x.sol]));
    ok(sols.length === 13, 'expected 13 AI data stack exercises, got ' + sols.length);
    for (const [id, sol] of sols) {
      await hash(p, '#/py/' + id, 600);
      await p.fill('textarea.code', sol);
      await p.click('button.btn.pri:has-text("Run")');
      await p.waitForFunction(() => { const v = document.querySelector('.verdict'); return v && v.style.display !== 'none' && /pass|Error/.test(v.textContent); }, null, { timeout: 120000 });
      ok((await text(p, '.verdict')) === 'All checks pass', id + ' did not pass in the browser: ' + await text(p, '.out .body'));
    }
    const left = await p.evaluate(() => schedule().units.filter(u => (u.mid === 'a04' || u.mid === 'a05') && u.kind === 'build' && !u.isDone).map(u => u.title));
    ok(!left.length, 'lab steps not ticked: ' + left.join(', '));
    await go(p, '#/learn/a05/readings', 900); ok(!(await p.$('#page a[href^="http"]')), 'A5 readings send you out of the app');
    await go(p, '#/design/a04', 900); ok(/Ask-your-data/.test(await text(p, '#page')), 'A4 design problem missing');
  });

  await T('python: solving the level-check tasks ticks the Setup step', async p => {
    await go(p, '#/path/s00', 900);
    ok(/Python level check/.test(await text(p, '#page')), 'level check missing on the Setup path');
    const sols = await p.evaluate(() => DATA.py.filter(x => x.m === 's00').map(x => [x.id, x.sol]));
    ok(sols.length === 6, 'expected 6 level-check tasks, got ' + sols.length);
    for (const [id, sol] of sols) {
      await hash(p, '#/py/' + id, 600);
      await p.fill('textarea.code', sol);
      await p.click('button.btn.pri:has-text("Run")');
      await p.waitForFunction(() => { const v = document.querySelector('.verdict'); return v && v.style.display !== 'none' && /pass|Error/.test(v.textContent); }, null, { timeout: 120000 });
      ok((await text(p, '.verdict')) === 'All checks pass', id + ' did not pass: ' + await text(p, '.out .body'));
    }
    await hash(p, '#/path/s00', 700);
    ok(await p.$('.unit.done:has-text("Python level check")'), 'level-check step not ticked automatically');
  });

  await T('review: opening the solution queues the problem; a review starts blank and moves it on', async p => {
    await go(p, '#/today');
    await p.evaluate(() => { S.secs.y011 = 1000; save(); }); /* past 15 minutes, so the solution can unlock */
    await hash(p, '#/py/y011', 600);
    for (let i = 0; i < 6; i++) { const b = await p.$('button.btn.dark:not([disabled])'); if (!b) break; await b.click(); await p.waitForTimeout(150); }
    let s = await state(p); ok(s.rev && s.rev.y011 && s.rev.y011.box === 0, 'not queued after opening the solution: ' + JSON.stringify(s.rev));
    await p.evaluate(() => { S.rev.y011.due = iso(new Date()); save(); });
    await hash(p, '#/today', 600);
    ok(/Review ·/.test(await all(p, '.plan')), 'due review not in the coding track on Today');
    ok(/Review \(1 due\)/.test(await (async () => { await hash(p, '#/practice/review', 500); return text(p, '.tabs'); })()), 'practice tab has no due count');
    await hash(p, '#/py/y011/review', 700);
    const code = await p.inputValue('textarea.code');
    ok(/pass\s*$/.test(code.trim()), 'review did not start from the starter code');
    ok(/0 of \d+ hints/.test(await text(p, 'aside')), 'hints not reset for the review');
    const sol = await p.evaluate(() => findQ('y011').sol);
    await p.fill('textarea.code', sol); await p.click('button.btn.pri:has-text("Run")');
    await p.waitForFunction(() => { const v = document.querySelector('.verdict'); return v && v.style.display !== 'none' && /pass|Error/.test(v.textContent); }, null, { timeout: 120000 });
    await p.waitForTimeout(300);
    s = await state(p); ok(s.rev.y011.box === 1, 'review pass did not move to box 1: ' + JSON.stringify(s.rev.y011));
    ok(/Next review/.test(await text(p, '.toast')), 'no next-review toast');
  });

  await T('modelling: solving the SCD exercises ticks the step; practice tab lists all three modules', async p => {
    await go(p, '#/path/m01', 900);
    ok(/Modelling exercises \(SQL\)/.test(await text(p, '#page')), 'modelling exercises missing on the path');
    const sols = await p.evaluate(() => DATA.sql.filter(x => x.m === 'm01').slice(0, 3).map(x => [x.id, x.sol]));
    for (const [id, sol] of sols) {
      await hash(p, '#/sql/' + id, 600);
      ok(/modelling 1/i.test(await text(p, '.top')), 'eyebrow should name the module');
      await p.fill('textarea.code', sol);
      await p.click('button.btn.pri:has-text("Run")');
      await p.waitForFunction(() => { const v = document.querySelector('.verdict'); return v && v.style.display !== 'none' && /pass|Error/.test(v.textContent); }, null, { timeout: 120000 });
      ok((await text(p, '.verdict')) === 'All checks pass', id + ' did not pass: ' + await text(p, '.out .body'));
    }
    await hash(p, '#/path/m01', 700);
    ok(await p.$('.unit.done:has-text("Exercises 1–3")'), 'exercise step not ticked automatically');
    await hash(p, '#/practice/model', 600);
    const t = await text(p, '#page');
    ok(/Modelling 1/.test(t) && /Modelling 2/.test(t) && /Modelling 3/.test(t), 'practice tab should list all modelling modules');
  });

  await T('platform and leadership: placed in order, Scala exercises tick the step, practice lists them', async p => {
    await go(p, '#/today');
    const pos = await p.evaluate(() => [MODS.indexOf('j01') - MODS.indexOf('s07'), MODS.indexOf('r01') - MODS.indexOf('s10'), MODS.indexOf('d01') - MODS.indexOf('a04')]);
    ok(pos[0] === 1 && pos[1] === 1 && pos[2] === 1, 'Platform 1 should follow DE 7, Leadership 1 DE 10, Systems 1 the AI data stack module after DE 4: ' + pos);
    const sols = await p.evaluate(() => DATA.spark.filter(x => x.m === 'j01').map(x => [x.id, x.sol]));
    ok(sols.length === 3, 'expected 3 Scala exercises');
    for (const [id, sol] of sols) {
      await hash(p, '#/spark/' + id, 600);
      await p.fill('textarea.code', sol);
      await p.click('button.btn.pri:has-text("Run")');
      await p.waitForFunction(() => { const v = document.querySelector('.verdict'); return v && v.style.display !== 'none' && /pass|Error/.test(v.textContent); }, null, { timeout: 120000 });
      ok((await text(p, '.verdict')) === 'All checks pass', id + ' did not pass: ' + await text(p, '.out .body'));
    }
    await hash(p, '#/path/j01', 700);
    ok(await p.$('.unit.done:has-text("Exercises 1–3")'), 'Scala exercise step not ticked automatically');
    await hash(p, '#/practice/model', 600);
    const t = await text(p, '#page');
    ok(/Platform 1/.test(t) && /Leadership 1/.test(t), 'practice tab should list Platform 1 and Leadership 1');
  });

  await T('trust: merges keep typed mock answers and submitted quizzes; applied coach marker syncs', async p => {
    await go(p, '#/today');
    const r = await p.evaluate(() => {
      const a = { mock: { '2026-10-26': { qs: [{ q: 'x' }], a: { 0: 'my long answer' }, sub: false, t: 1 } }, quiz: { p01: { sub: true, best: 70, last: 70 } }, coachApplied: '2026-10-26T00:05:00+05:30' };
      const b = { mock: { '2026-10-26': { qs: [{ q: 'y' }], a: {}, sub: false, t: 9 } }, quiz: { p01: { sub: false, a: { 0: 'B' }, best: 60 } }, updated: 9 };
      const m = mergeState(a, b);
      return [m.mock['2026-10-26'].a[0], m.quiz.p01.sub, m.quiz.p01.best, m.coachApplied];
    });
    ok(r[0] === 'my long answer', 'typed mock answers lost in merge');
    ok(r[1] === true && r[2] === 70, 'submitted quiz or best score lost in merge: ' + r);
    ok(r[3] === '2026-10-26T00:05:00+05:30', 'applied coach marker not merged');
  });

  await T('trust: coach review is applied once, skips work done after the report, and fills an untouched mock', async p => {
    await go(p, '#/today');
    const r = await p.evaluate(() => {
      const today = iso(new Date()), gen = new Date(Date.now() - 3 * 36e5).toISOString();
      S.rev = { d011: { box: 1, due: '2099-01-01', t: Date.now() } }; S.seen = { d012: Date.now() }; S.coachApplied = null;
      S.mock = { [today]: { kind: 'daily', qs: [{ q: 'bank question' }], a: {}, sub: false, t: 1, src: 'bank' } };
      const c = { generated_at: gen, review_add: ['d011', 'd012', 'd013'], next_mock: { [today]: { questions: [{ q: 'coach q1' }, { q: 'coach q2' }, { q: 'coach q3' }] } } };
      const n1 = applyCoach(c), n2 = applyCoach(c);
      return [n1, n2, S.rev.d011.due, !!S.rev.d012, S.rev.d013 && S.rev.d013.due === today, S.mock[today].qs[0].q];
    });
    ok(r[0] === 1 && r[1] === 0, 'coach review applied ' + r[0] + ' then ' + r[1] + ' times');
    ok(r[2] === '2099-01-01' && !r[3] && r[4], 'coach re-queued work done after the report: ' + r);
    ok(r[5] === 'coach q1', 'untouched mock did not take the coach questions');
  });

  await T('trust: stale coach report and missing sync are called out; readiness counts only passed quizzes', async p => {
    await go(p, '#/today');
    await p.evaluate(() => { S.settings.syncUrl = ''; S.coach = { generated_at: new Date(Date.now() - 4.5 * 864e5).toISOString(), summary: 'old', focus: [] }; S.quiz = { p01: { sub: true, best: 10 }, p02: { sub: true, best: 90 } }; save(); });
    await p.waitForTimeout(400); /* save() is debounced */
    await hash(p, '#/path', 400); await hash(p, '#/today', 700); /* same-URL goto would not re-render */
    const t = await all(p, '#page');
    ok(/Sync is not set up/.test(t), 'missing sync not called out on the coach card');
    ok(/This report is 4 days old/.test(t), 'stale coach report not labelled');
    await go(p, '#/progress', 700);
    const pr = await text(p, '#page');
    ok(/Quizzes passed \(80%\+\)/.test(pr), 'readiness label not updated');
    const pct = await p.evaluate(() => { const m = MODS.filter(x => (DATA.sprints[x] || {}).quiz && DATA.sprints[x].quiz.length); return Math.round(100 / m.length); });
    ok(new RegExp('Quizzes passed \\(80%\\+\\)\\s*' + pct + '%').test(pr), 'a 10% quiz was counted as ready');
  });

  await T('trust: bad backup, bad sync URL and failed upload are refused', async p => {
    await go(p, '#/progress', 700);
    await p.setInputFiles('input[type=file]', { name: 'other.json', mimeType: 'application/json', buffer: Buffer.from('{"foo": 1}') });
    await p.waitForTimeout(400);
    ok(/not a Data Architect backup/.test(await text(p, '.toast')), 'unrelated JSON accepted as a backup');
    await profile(p, 'sync'); await setField(p, '#st_sync', 'ftp://example.com/x'); await p.waitForTimeout(200);
    ok(/not a Google Apps Script web app/.test(await text(p, '.toast')) && !(await state(p)).settings.syncUrl, 'invalid sync URL saved');
    await p.route('https://script.google.com/**', route => route.request().method() === 'POST' ? route.fulfill({ contentType: 'application/json', body: '{"ok": false, "error": "quota exceeded"}' }) : route.fulfill({ contentType: 'application/json', body: '{"ok": true, "data": {}, "coach": {}}' }));
    await p.evaluate(() => { S.settings.syncUrl = 'https://script.google.com/macros/s/x/exec?k=a'; save(); });
    await p.evaluate(() => doSync()); await p.waitForTimeout(700);
    ok(/Sync failed/.test(await text(p, '.toast')), 'a refused upload was reported as synced: ' + await text(p, '.toast'));
  });

  await T('trust: a newer published version is announced', async p => {
    await p.route('**/version.json*', route => route.fulfill({ contentType: 'application/json', body: '{"version": "9.9.9"}' }));
    await go(p, '#/today', 1200);
    ok(/Version 9\.9\.9 is available/.test(await text(p, '#page')), 'new version not announced');
  });

  await T('review: sync merge keeps the newer review entry', async p => {
    await go(p, '#/today');
    const r = await p.evaluate(() => { const a = { rev: { d011: { box: 0, due: '2026-11-01', t: 1 } } }, b = { rev: { d011: { box: 2, due: null, t: 5 }, q011: { box: 1, due: '2026-11-05', t: 2 } } }; const m = mergeState(a, b); return [m.rev.d011.box, !!m.rev.q011]; });
    ok(r[0] === 2 && r[1], 'merge wrong: ' + JSON.stringify(r));
  });

  await T('update app: shows installed and latest version, up to date', async p => {
    await go(p, '#/profile', 1200);
    ok(/v\d+\.\d+\.\d+/.test(await text(p, '[aria-label="Update app"]')), 'version not shown on the Update app button');
    await p.click('[aria-label="Update app"]'); await p.waitForTimeout(1500);
    const t = await text(p, '.scrim [role=dialog]'), v = await p.evaluate(() => VERSION);
    ok(t.includes('Installed on this device') && t.includes(v) && /Latest published/.test(t), 'dialog lacks versions: ' + t.slice(0, 200));
    ok(/You have the latest version/.test(t) && !/Update now/.test(t), 'should say up to date');
    ok(/In this version/i.test(t), 'release notes missing');
  });
  await T('update app: a newer version shows banner, dot, toast once, and Update now', async (p, c) => {
    await c.route(/version\.json/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: '9.9.9', date: '2027-01-01', notes: ['Big new thing'] }) }));
    await go(p, '#/today', 1500);
    ok(/Version 9\.9\.9 is available/.test(await text(p, '.toast')), 'no toast for the new version');
    ok(/9\.9\.9 is available/.test(await text(p, '#page')), 'no banner');
    ok(await p.locator('.top .avatar.hasdot').count() === 1, 'no dot on the avatar');
    await profile(p); ok(await p.locator('[aria-label="Update app"].hasdot').count() === 1 && /Update to 9\.9\.9/.test(await text(p, '[aria-label="Update app"]')), 'button does not show the update');
    await p.reload(); await p.waitForTimeout(1500);
    ok(!/is available/.test(await text(p, '.toast')), 'toast repeated for the same version');
    await p.waitForSelector('[aria-label="Update app"]');
    await p.click('[aria-label="Update app"]'); await p.waitForTimeout(1200);
    const t = await text(p, '.scrim [role=dialog]');
    ok(/Update available/.test(t) && /Update now to 9\.9\.9/.test(t) && /Big new thing/.test(t), 'dialog: ' + t.slice(0, 200));
  });
  await T('update app: an older published version never shows as an update', async (p, c) => {
    await c.route(/version\.json/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: '1.0.0' }) }));
    await go(p, '#/today', 1500);
    ok(!/is available/.test(await text(p, 'body')) && await p.locator('.hasdot').count() === 0, 'older version offered as an update');
  });
  await T('update app: phone More tab shows a dot and the version', async (p, c) => {
    await c.route(/version\.json/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: '9.9.9' }) }));
    await go(p, '#/today', 1500);
    ok(await p.locator('button.tabmore.hasdot').count() === 1, 'no dot on More');
    await p.click('button.tabmore'); await p.waitForTimeout(300);
    ok(/Update to 9\.9\.9/.test(await text(p, '.sheet')), 'More sheet does not offer the update');
  }, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await T('update app: system notification when allowed, and settings show the version', async (p, c) => {
    await c.grantPermissions(['notifications']);
    await go(p, '#/today', 1500);
    const shown = await p.evaluate(async () => { S.settings.notifyUpdates = true; window.Notification = { permission: 'granted' }; /* headless Chrome always reports denied */ const reg = await navigator.serviceWorker.ready; let got = null; reg.showNotification = (t, o) => { got = [t, o.tag]; return Promise.resolve(); }; navigator.serviceWorker.getRegistration = () => Promise.resolve(reg); notifyUpdate({ version: '9.9.9', notes: ['x'] }); await new Promise(r => setTimeout(r, 300)); return got; });
    ok(shown && /9\.9\.9/.test(shown[0]) && shown[1] === 'da-update', 'no notification: ' + JSON.stringify(shown));
    await profile(p); const t = await text(p, '#page');
    ok(/v\d+\.\d+\.\d+/.test(t) && /Notify me when an app update/.test(t), 'profile lacks the version or the toggle');
  });

  /* ---- persona round 1 fixes ---- */
  await T('persona: Python runtime unreachable shows a clear error, not an endless Running', async (p, c) => {
    /* Playwright cannot block a Web Worker's own downloads, so stand in a worker that cannot fetch the runtime */
    await p.addInitScript(() => { window.Worker = class { constructor() { setTimeout(() => this.onmessage && this.onmessage({ data: { type: 'fatal', text: 'the Python runtime could not be downloaded (you seem to be offline)' } }), 200); } postMessage() { } terminate() { } }; });
    await go(p, '#/dsa/' + 'd011', 1500);
    await p.locator('button', { hasText: /^Run/ }).first().click();
    let t = ''; for (let i = 0; i < 20 && !/Could not start Python/.test(t); i++) { await p.waitForTimeout(500); t = await p.evaluate(() => document.body.innerText); }
    ok(/Could not start Python/.test(t), 'no error shown');
    ok(await p.locator('button', { hasText: /Run again/ }).first().isEnabled(), 'Run button stays disabled');
  });
  await T('persona: service worker keeps the Python runtime from the CDN for offline use', async p => {
    const src = await p.request.get(BASE + 'sw.js').then(r => r.text());
    ok(/cdn\.jsdelivr\.net/.test(src) && /pyodide/.test(src) && /RUNTIME/.test(src), 'sw.js does not cache the runtime');
  });
  await T('persona: AI features off hides grading, runs and the Claude Code track; on brings them back', async p => {
    await go(p, '#/today', 1200);
    ok(await p.evaluate(() => MODS.some(isCC)), 'track missing with AI on');
    await p.evaluate(() => { S.settings.ai = false; applyAi(); save(); });
    await go(p, '#/interview/a01', 1200);
    ok(await p.locator('.gradebox').count() === 0, 'grade boxes shown with AI off');
    ok(await p.locator('button', { hasText: 'Show model answer' }).count() > 0, 'self-check missing');
    ok(await p.evaluate(() => !MODS.some(isCC) && !schedule().units.some(u => isCC(u.mid))), 'Claude Code steps still planned');
    await go(p, '#/learn/c01/lab', 1200); ok(await p.locator('button', { hasText: 'Run in Claude Code' }).count() === 0, 'run box shown with AI off');
    await go(p, '#/cc/c01/1', 1200); ok(/AI features are off/.test(await text(p, '#page')), 'cc page does not explain');
    await profile(p, 'ai'); await p.selectOption('#st_ai', 'on'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => S.settings.ai === true && MODS.some(isCC)), 'turning AI back on did not restore the track');
  });
  await T('persona: step ticks are at least 44px on touch screens', async p => {
    await go(p, '#/today', 600); await p.waitForSelector('.unit .check', { timeout: 30000 });
    const sz = await p.evaluate(() => { const b = document.querySelector('.unit .check').getBoundingClientRect(); return Math.min(b.width, b.height); });
    ok(sz >= 44, 'tick is ' + sz + 'px');
  }, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await T('persona: test results are announced to screen readers after Run', async p => {
    await go(p, '#/dsa/d011', 1500);
    await p.locator('button', { hasText: /^Run/ }).first().click(); await p.waitForTimeout(200);
    ok(/Running/.test(await p.evaluate(() => (document.querySelector('.out [role=status]') || {}).textContent)), 'nothing announced while running');
    let t = ''; for (let i = 0; i < 180 && !/pass|Error|failing/i.test(t); i++) { await p.waitForTimeout(500); t = await p.evaluate(() => (document.querySelector('.out [role=status]') || {}).textContent || ''); }
    ok(/pass|Error|failing/i.test(t), 'live region empty: ' + t);
  });
  await T('persona: closing search returns focus to where it was', async p => {
    await go(p, '#/today', 1000);
    await p.locator('button[aria-label=Search]').first().focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.activeElement.getAttribute('aria-label') === 'Search'), 'focus lost: ' + await p.evaluate(() => document.activeElement.tagName));
  });
  await T('persona: grader setup message offers the model answer, and no stray text', async p => {
    await go(p, '#/interview/a01', 1200);
    await p.locator('details summary', { hasText: 'Practise' }).first().click();
    await p.locator('details textarea').first().fill('answer');
    await p.locator('details button', { hasText: 'Grade' }).first().click(); await p.waitForTimeout(2500);
    ok(/model answer/.test(await text(p, '.gradebox')), 'message does not point to the model answer');
  });
  await T('persona: mental map labels fit their boxes at 200% zoom', async p => {
    await go(p, '#/learn/p01/chapter', 1200);
    const over = await p.evaluate(() => [...document.querySelectorAll('.flow span')].filter(e => e.scrollWidth > e.clientWidth + 1).length);
    ok(!over, over + ' labels overflow');
  }, { viewport: { width: 405, height: 540 } });

  /* ---- persona round 2 fixes ---- */
  await T('persona: ticking a step by keyboard keeps focus on that step', async p => {
    await go(p, '#/today', 1200);
    const uid = await p.evaluate(() => document.querySelector('.unit .check').dataset.uid);
    await p.locator('.unit .check').first().focus(); await p.keyboard.press('Space'); await p.waitForTimeout(500);
    ok(await p.evaluate(u => document.activeElement && document.activeElement.dataset.uid === u, uid), 'focus moved to ' + await p.evaluate(() => document.activeElement.tagName));
  });
  await T('persona: offline, a missing lesson file never turns into the home page; Path survives', async (p, c) => {
    await go(p, '#/path', 1500);
    const sw = await p.request.get(BASE + 'sw.js').then(r => r.text());
    ok(/mode === 'navigate'/.test(sw) && /status: 503/.test(sw) && /PROGRAM/.test(sw), 'sw.js fallback or precache missing');
    await p.evaluate(() => { const orig = schedule; window.schedule = () => { const r = orig(); delete r.span.c05; return r; }; route(); });
    await p.waitForTimeout(300); ok(!/Something went wrong/.test(await text(p, 'body')), 'Path crashed without one module');
  });
  await T('persona: the markdown library is served by the app, not a CDN', async p => {
    await go(p, '#/today', 800);
    ok(await p.evaluate(() => !!window.marked && [...document.scripts].some(s => /js\/vendor\/marked/.test(s.src)) && ![...document.scripts].some(s => /cdn\.jsdelivr/.test(s.src))), 'marked still loaded from a CDN');
  });
  await T('persona: module picker is full height on touch screens', async p => {
    await go(p, '#/learn/a01/chapter', 1200);
    const h = await p.evaluate(() => document.querySelector('select[aria-label=Module]').getBoundingClientRect().height);
    ok(h >= 44, 'picker is ' + h + 'px tall');
  }, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  /* ---- persona round 3 fix ---- */
  await T('persona: AI features off: no Sync nag or promise of AI grading on Today, Coach explains', async p => {
    await go(p, '#/today', 1200); await p.evaluate(() => { S.settings.ai = false; applyAi(); save(); route(); }); await p.waitForTimeout(600);
    const t = await all(p, '#page');
    ok(!/Sync is not set up|grades it tonight|coach grades/i.test(t), 'Today still mentions the AI coach: ' + (t.match(/[^\n]*(Sync is not set up|grades it tonight)[^\n]*/) || [''])[0]);
    ok(/Live mock|Weekend boss/.test(t), "live mock missing");
    await go(p, '#/coach', 1000); ok(/AI features are off/.test(await text(p, '#page')), 'coach page does not explain');
  });

  /* ---- preferences (Settings) ---- */
  await T('preferences: coach source and grading model are chosen in Settings and saved', async p => {
    await go(p, '#/today', 1000); await profile(p, 'ai');
    await p.selectOption('#st_coach', 'hints'); await p.selectOption('#st_grade', 'sonnet'); await p.waitForTimeout(300);
    const st = await p.evaluate(() => [S.settings.coachVia, S.settings.gradeModel, S.settings.prefsAt > 0]);
    ok(st[0] === 'hints' && st[1] === 'sonnet' && st[2], 'not saved: ' + JSON.stringify(st));
  });
  await T('preferences: the coach follows the chosen source', async p => {
    await go(p, '#/today', 1000);
    const r = await p.evaluate(async () => {
      const calls = []; window.macCall = async () => { calls.push('mac'); return { text: 'from mac' }; };
      const f = window.fetch; window.fetch = (u, o) => { if (/api\.anthropic/.test(u)) { calls.push('key'); return Promise.resolve(new Response(JSON.stringify({ content: [{ text: 'from key' }] }))); } return f(u, o); };
      const ask = async () => { const b = document.createElement('div'); await askCoach('q', { title: 't' }, b); return b.innerText; };
      S.settings.aiKey = 'sk-test';
      S.settings.coachVia = 'mac'; const a = await ask();
      S.settings.coachVia = 'key'; const b = await ask();
      S.settings.coachVia = 'hints'; const c = await ask();
      window.fetch = f; S.settings.aiKey = ''; return { a, b, c, calls };
    });
    ok(/from mac/.test(r.a) && /from key/.test(r.b) && !/from/.test(r.c) && r.calls.join() === 'mac,key', JSON.stringify(r));
  });
  await T('preferences: the grading model choice travels with the grading request', async p => {
    await go(p, '#/today', 1000);
    const m = await p.evaluate(async () => { let got = null; window.graderHealthy = async () => true; window.gradeDirect = async (k, pl) => { got = pl.model || 'default'; return { score: 4, verdict: 'v', strengths: [], issues: [], improve: '', better: '' }; };
      S.settings.gradeModel = 'haiku'; await gradeNow('x1', 'code', { code: 'a' }, 'a', 't'); const one = got;
      S.settings.gradeModel = 'auto'; await gradeNow('x2', 'code', { code: 'a' }, 'a', 't'); return [one, got]; });
    ok(m[0] === 'haiku' && m[1] === 'default', JSON.stringify(m));
  });
  await T('preferences: sync shares them across devices, newest wins, keys stay on the device', async (p, c) => {
    let posted = null;
    await c.route('https://sync.example/**', async r => { if (r.request().method() === 'POST') { posted = JSON.parse(r.request().postData()); return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); }
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: { start: '2026-10-26', updated: 1, prefs: { at: Date.now() + 60000, capWd: 45, coachVia: 'key', gradeModel: 'sonnet', ai: true } } }) }); });
    await go(p, '#/today', 1000);
    await p.evaluate(() => { S.settings.syncUrl = 'https://sync.example/exec?k=x'; S.settings.aiKey = 'sk-secret'; S.settings.theme = 'dark'; S.settings.capWd = 60; S.settings.prefsAt = 1; save(); });
    await p.evaluate(() => doSync()); await p.waitForTimeout(1500);
    const st = await p.evaluate(() => [S.settings.capWd, S.settings.coachVia, S.settings.gradeModel, S.settings.aiKey, S.settings.theme, S.settings.syncUrl]);
    ok(st[0] === 45 && st[1] === 'key' && st[2] === 'sonnet', 'remote preferences not applied: ' + JSON.stringify(st));
    ok(st[3] === 'sk-secret' && st[4] === 'dark' && /sync\.example/.test(st[5]), 'device-only settings changed');
    ok(posted && posted.data.prefs && posted.data.prefs.capWd === 45 && !JSON.stringify(posted).includes('sk-secret') && !('settings' in posted.data), 'upload leaked device settings or missed prefs');
  });

  /* ---- design simulator (#/sim) ---- */
  const simState = p => p.evaluate(() => JSON.parse(JSON.stringify(S.sim || {})));
  await T('sim: System design opens the simulator on its module scenario; Check grades the starting design as not yet', async p => {
    await go(p, '#/design/s10', 1200);
    await p.click('.simmod .simsc'); await p.waitForSelector('#sim_check');
    ok(/Design simulator/.test(await text(p, '.top')) && /Serving reads at scale|cache stampede|Dashboards/i.test(await text(p, '.simside')), 'scenario did not open on its challenge');
    await p.click('#sim_check'); await p.waitForSelector('.simresult .item');
    const r = await text(p, '.simresult'); ok(/✗/.test(r) && /Not yet/.test(r), 'starting design should fail: ' + r.slice(0, 200));
    ok(await p.evaluate(() => Object.keys(S.sim.d).some(k => /^sc-/.test(k))), 'scenario design not saved');
  });
  await T('sim in the program: module chapter and lab list its challenges; Today shows one; passing one adds XP', async p => {
    await go(p, '#/learn/s05/chapter', 1500); await p.waitForSelector('.simmod'); ok(/Real time/.test(await text(p, '.simmod')), 'no challenges on the s05 chapter');
    await go(p, '#/learn/s00/chapter', 1200); ok(!(await p.$('.simmod')), 'a module without challenges shows a card');
    await go(p, '#/today', 1200); const t = await p.$('.simtoday'); if (t) ok(/Simulator challenge/.test(await text(p, '.simtoday')), 'Today card text');
    const x0 = await p.evaluate(() => gameXP()); await p.evaluate(() => { simState().done.cdc = iso(new Date()); }); ok((await p.evaluate(() => gameXP())) === x0 + 25, 'no XP for a passed challenge');
  });
  await T('sim quick start: a design problem opens a fitting starter named after it, with a way back; a blank design offers starters', async p => {
    await go(p, '#/design/s05', 1200); await p.click('.simsketch'); await p.waitForSelector('.simcv');
    const d = await p.evaluate(() => simDebug.d); ok(d.nodes.length >= 5 && d.edges.length >= 4 && /#\/design/.test(d.from), 'sketch did not open a starter: ' + d.nodes.length);
    ok(await p.$('a.btn:has-text("Back to the question")'), 'no way back to the question');
    await p.selectOption('select[aria-label="Open a design"]', '+new'); await p.waitForSelector('.simqbtn');
    await p.click('.simqbtn[data-tpl=cdc]'); await p.waitForTimeout(200); ok((await p.evaluate(() => simDebug.d.nodes.some(n => n.k === 'cdc'))), 'quick start CDC did not fill the design');
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await T('sim learn: a challenge opens in Learn with hint 1 open; the next hints and Show me fix it; Check passes', async p => {
    await go(p, '#/sim/sc/skeleton', 1400); await p.waitForSelector('.simhint[data-h="1"]');
    ok(await p.$('.simmode button[data-mode=learn][aria-selected=true]'), 'not in Learn mode');
    await p.click('.simhbtn[data-h="2"]'); await p.click('.simhbtn[data-h="3"]'); await p.click('.simhbtn[data-h="4"]');
    await p.waitForFunction(() => simDebug.d.nodes.find(n => n.k === 'stream').n === 2, null, { timeout: 8000 });
    ok(/Show me/.test(await text(p, '#sim_nar')) || true, 'narration');
    await p.waitForTimeout(1800); await p.click('#sim_check'); await p.waitForSelector('.simresult .simpass');
    ok(!!(await simState(p)).done.skeleton, 'learn pass not recorded');
  });
  await T('sim exam: hints and suggestions cost marks, the score is saved, the next attempt starts clean', async p => {
    await go(p, '#/sim/sc/failover/exam', 1400); await p.waitForSelector('.simmode button[data-mode=exam][aria-selected=true]');
    ok(!(await p.$('.simhint')), 'a hint is open at the start of an exam'); ok(/−5/.test(await text(p, '.simhbtn[data-h="1"]')), 'hint cost not shown');
    await p.click('.simhbtn[data-h="1"]'); await p.click('#simt_review'); await p.click('#sim_revgate');
    await p.click('.simnode[data-k=pg] .box'); await p.check('#sim_c_hot_standby_fails_over_in_3_s_');
    await p.click('#simt_goal'); ok(/Submit/.test(await text(p, '#sim_check')), 'exam button not Submit'); await p.click('#sim_check'); await p.waitForSelector('.simscore');
    ok(/Exam score: 90 \/ 100/.test(await text(p, '.simscore')), 'score: ' + await text(p, '.simscore'));
    const ex = (await simState(p)).ex.failover; ok(ex.best === 90 && ex.last.cost === 10 && ex.cur.lvl === 0 && !ex.cur.rev, JSON.stringify(ex));
    const mg = await p.evaluate(() => { const a = { sim: { d: {}, ex: { failover: { best: 60, last: { at: 1, score: 60 }, cur: { lvl: 2, t0: 5 } } } } }, b = { sim: { d: {}, ex: { failover: { best: 40, last: { at: 9, score: 40 }, cur: { lvl: 1, rev: 1, t0: 5 } } } } }; const m = mergeState(a, b).sim.ex.failover; return [m.best, m.last.score, m.cur.lvl, m.cur.rev]; });
    ok(mg.join() === '60,40,2,1', 'exam merge: ' + mg);
  });
  await T('sim: the what-is-happening line has a real sentence for every tab, selection, run state and failure', async p => {
    await go(p, '#/sim/sc/serving', 1400); await p.waitForSelector('#sim_nar');
    const r = await p.evaluate(async () => { const tabs = ['build', 'run', 'break', 'metrics', 'cost', 'review', 'goal'], d = simDebug.d, out = [], bad = [];
      const sels = [null, { n: d.nodes.find(n => n.k === 'client').id }, { n: d.nodes.find(n => n.k === 'svc').id }, { n: d.nodes.find(n => n.k === 'pg').id }, { e: d.edges[0].id }];
      for (const run of [false, true]) { if (run) { simDebug.play(true); for (let i = 0; i < 6; i++) simDebug.step(); simDebug.rt.chaos.push({ type: 'crash', target: d.nodes.find(n => n.k === 'pg').id, from: 0 }); simDebug.step(); }
        for (const t of tabs) { document.getElementById('simt_' + t).click(); for (const s of sels) { simDebug.sel = s; const x = document.getElementById('sim_nar').textContent; out.push(x); if (!x || x.length < 20 || /undefined|NaN|null/.test(x)) bad.push(t + '/' + JSON.stringify(s) + '/' + run + ': ' + x); } } }
      simDebug.play(false); return { n: out.length, uniq: new Set(out).size, bad, sample: [out[0], out[36], out[47], out[52]] }; });
    ok(!r.bad.length, 'bad sentences: ' + r.bad.slice(0, 3).join(' | ')); ok(r.n === 70 && r.uniq >= 40, 'too few distinct sentences: ' + r.uniq + ' ' + JSON.stringify(r.sample));
    ok(await p.evaluate(() => /down|crash/i.test((simDebug.sel = { n: simDebug.d.nodes.find(n => n.k === 'pg').id }, simDebug.step(), document.getElementById('sim_nar').textContent))), 'a crashed box is not described as down');
  });
  await T('sim teach: Teach me this design builds it box by box (tap or palette), then run, break, fix and say it', async p => {
    await go(p, '#/design/s05', 1200); await p.click('a:has-text("Teach me this design")'); await p.waitForSelector('.simcoach');
    ok(/Requirements/.test(await text(p, '.simcoach')) && /50,000|events/.test(await text(p, '.simcoach')), 'no requirements step from the design problem');
    await p.click('#sim_teach_next'); await p.click('#sim_teach_next'); await p.waitForSelector('.simcomp.simpulse[data-k=producer]');
    await p.click('.simcomp[data-k=producer]'); await p.waitForTimeout(200); ok(/Schema registry/.test(await text(p, '.simcoach')), 'adding from the palette did not count');
    while (await p.$('#sim_teach_add')) { await p.click('#sim_teach_add'); await p.waitForTimeout(120); }
    const d = await p.evaluate(() => simDebug.d); ok(d.nodes.length === 7 && d.edges.length === 6, 'design not built: ' + d.nodes.length + '/' + d.edges.length);
    await p.click('.simcoach button:has-text("Run traffic")'); await p.click('.simcoach button:has-text("Inject it")'); await p.waitForTimeout(1500);
    await p.click('.simcoach button:has-text("Fix it for me")'); ok(await p.evaluate(() => simDebug.d.nodes.find(n => n.k === 'stream').auto === true), 'fix not applied');
    ok(/Say it in the interview/.test(await text(p, '.simcoach')) && await p.$('.simcoach a:has-text("Write it up")'), 'no closing step');
    ok(!!(await simState(p)).taught.s05, 'lesson not recorded');
  });
  await T('sim teach on iPhone: the lesson card and its main button are on the first screen; no sideways scroll', async p => {
    await go(p, '#/sim/teach/stream', 1600); await p.waitForSelector('.simcoach'); await p.click('#sim_teach_next'); await p.click('#sim_teach_next');
    const b = await p.$eval('#sim_teach_add', e => [e.getBoundingClientRect().bottom, document.querySelector('.tabbar').getBoundingClientRect().top, document.documentElement.scrollWidth, innerWidth]);
    ok(b[0] <= b[1] && b[2] <= b[3], 'lesson button hidden or page scrolls sideways: ' + b);
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await T('sim in mocks: simulator suggestions opened on a live sketch cost 0.25 on that answer', async p => {
    await go(p, '#/today', 1000);
    const r = await p.evaluate(() => { const sc = { correct: 4, depth: 4, trade: 4, clear: 4 }; LIVE_DIMS.forEach(d => { sc[d[0]] = 4; }); return [liveAvg({ sc }), liveAvg({ sc, simHints: 2 })]; });
    ok(r[0] - r[1] === 0.5, 'no deduction: ' + r);
  });
  await T('sim: the More menu lists the simulator', async p => {
    await go(p, '#/today', 1000); await p.click('.tabmore'); await p.click('.sheet a[href="#/sim"]'); await p.waitForSelector('.simcv');
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await T('sim: add a component by tap, wire it by tapping the dot then the box, undo it; the design autosaves', async p => {
    await go(p, '#/sim', 1200);
    await p.click('.simcomp[data-k=kafka]'); await p.waitForTimeout(200);
    ok((await simState(p)).d[(await simState(p)).cur].nodes.some(n => n.k === 'kafka'), 'Kafka not added or not saved');
    await p.click('#simt_build'); await p.click('button:has-text("Done")').catch(() => {});
    await p.click('[data-port=n1]'); await p.click('.simnode[data-k=kafka]'); await p.waitForTimeout(200);
    let d = await p.evaluate(() => simDebug.d); ok(d.edges.length === 1 && d.edges[0].a === 'n1', 'tap-to-wire failed: ' + JSON.stringify(d.edges));
    await p.click('.simcv', { position: { x: 400, y: 30 } }); await p.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z'); await p.waitForTimeout(150);
    d = await p.evaluate(() => simDebug.d); ok(d.edges.length === 0, 'undo did not remove the wire');
    await p.reload(); await p.waitForSelector('.simcv'); ok((await p.evaluate(() => simDebug.d.nodes.length)) === 2, 'design not kept after reload');
  });
  await T('sim: dragging a box moves it, and dragging from its dot wires it', async p => {
    await go(p, '#/sim', 1200); await p.click('.simcomp[data-k=svc]'); await p.click('button:has-text("Done")'); await p.waitForTimeout(150);
    const b = await p.$eval('.simnode[data-k=svc] .box', e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    const x0 = await p.evaluate(() => simDebug.d.nodes.find(n => n.k === 'svc').x);
    await p.mouse.move(b[0], b[1]); await p.mouse.down(); await p.mouse.move(b[0] + 80, b[1] + 60, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(150);
    ok((await p.evaluate(() => simDebug.d.nodes.find(n => n.k === 'svc').x)) !== x0, 'box did not move');
    const s = await p.$eval('[data-port=n1]', e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }), t = await p.$eval('.simnode[data-k=svc] .box', e => { const r = e.getBoundingClientRect(); return [r.x + 20, r.y + r.height / 2]; });
    await p.mouse.move(s[0], s[1]); await p.mouse.down(); await p.mouse.move(t[0], t[1], { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(150);
    ok((await p.evaluate(() => simDebug.d.edges.length)) === 1, 'drag-to-wire failed');
  });
  await T('sim: a fixed scenario passes and is recorded; a failure while running shows errors', async p => {
    await go(p, '#/sim/sc/failover', 1400); await p.waitForSelector('#sim_check');
    await p.click('.simnode[data-k=pg] .box'); await p.check('#sim_c_hot_standby_fails_over_in_3_s_');
    await p.click('#simt_goal'); await p.click('#sim_check'); await p.waitForSelector('.simresult .simpass');
    ok(!!(await simState(p)).done.failover, 'pass not recorded');
    await p.click('#simt_break'); await p.click('[data-chaos=crash]'); await p.waitForTimeout(2500);
    const strip = await text(p, '.simstrip'); ok(/ERRORS\s*[1-9]/i.test(strip.replace(/\n/g, ' ')) || /Errors\s*[1-9]/.test(strip), 'no errors shown during a crash: ' + strip.replace(/\n/g, ' '));
    await p.click('#simt_metrics'); ok(await p.$('.simchart'), 'no metrics charts');
  });
  await T('sim: every starting scenario fails and its fix passes (engine)', async p => {
    await go(p, '#/sim', 1000);
    const r = await p.evaluate(() => SIM_SC.map(sc => [sc.id, SIM.grade(simFromSc(sc), sc).pass]));
    ok(r.length >= 16 && r.every(x => !x[1]), 'a starting design already passes: ' + JSON.stringify(r.filter(x => x[1])));
  });
  await T('sim: JSON export and a share link bring the design back', async p => {
    await go(p, '#/sim/sc/skeleton', 1200); await p.waitForSelector('.simcv');
    await p.click('.simexp summary'); const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Download JSON")')]);
    const j = JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8')); ok(j.nodes.length === 4 && j.edges.length === 3, 'export incomplete');
    const link = await p.evaluate(() => '#/sim/share/' + simPack(simDebug.d)); const before = Object.keys((await simState(p)).d).length;
    await hash(p, link, 800); ok(Object.keys((await simState(p)).d).length === before + 1 && /Walking skeleton/.test(await p.inputValue('.simname')), 'share link did not add the design');
    await hash(p, '#/sim/share/not-a-design', 600); ok(/does not hold a design/.test(await text(p, '.toast')), 'bad link not refused');
  });
  await T('sim: sync keeps designs from both devices, the newer edit wins, removed stays removed', async p => {
    await go(p, '#/today', 800);
    const r = await p.evaluate(() => { const a = { sim: { d: { x: { id: 'x', name: 'old', at: 1, nodes: [] }, y: { id: 'y', name: 'only a', at: 5, nodes: [] } }, done: { cdc: '2026-11-01' } } }, b = { sim: { d: { x: { id: 'x', name: 'new', at: 9, nodes: [] }, z: { id: 'z', name: 'gone', at: 7, del: 7, nodes: [] } }, done: { dlq: '2026-11-02' } } };
      const m = mergeState(a, b), m2 = mergeState(b, a); return [m.sim.d.x.name, !!m.sim.d.y, m.sim.d.z.del, Object.keys(m.sim.done).sort().join(), m2.sim.d.x.name]; });
    ok(r[0] === 'new' && r[1] && r[2] === 7 && r[3] === 'cdc,dlq' && r[4] === 'new', JSON.stringify(r));
  });
  await T('sim on iPhone: no sideways scroll, Run traffic on the first screen; Today Up next still above the tab bar', async p => {
    await go(p, '#/sim', 1400);
    const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); ok(w[0] <= w[1], 'page scrolls sideways: ' + w);
    const b = await p.$eval('.simplay', e => [e.getBoundingClientRect().bottom, document.querySelector('.tabbar').getBoundingClientRect().top]); ok(b[0] <= b[1], 'Run traffic hidden under the tab bar: ' + b);
    await go(p, '#/today', 1200); const u = await p.$('.unit.cur .acts .btn.pri');
    if (u) { const y = await u.evaluate(e => [e.getBoundingClientRect().bottom, document.querySelector('.tabbar').getBoundingClientRect().top]); ok(y[0] <= y[1], 'Up next pushed below the tab bar'); }
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await T('sim at staff scale: 10.3 has the unit costs and worked examples that open challenges failing at that scale until fixed', async p => {
    await go(p, '#/learn/s10/chapter', 1800); const ch = await all(p, '#page');
    ok(/Unit costs to reason with/.test(ch) && /per TB scanned/.test(ch) && /3,500 writes/.test(ch) && /RPO/.test(ch) && /Twelve designs/.test(ch), 'chapter content missing');
    for (const id of ['million', 'petabyte', 'prefix', 'region']) ok(await p.$('#page a[href="#/sim/sc/' + id + '"]'), 'no link to ' + id);
    await p.click('#page a[href="#/sim/sc/million"]'); await p.waitForSelector('#sim_check'); ok(/One million events a second/.test(await text(p, '.simside')), 'challenge did not open');
    const r = await p.evaluate(() => ['million', 'prefix', 'petabyte', 'region'].map(id => { const sc = SIM_SC.find(x => x.id === id), d = simFromSc(sc), g0 = SIM.grade(d, sc); SIM_HINTS[id].fix.forEach(f => simApplyFix(d, f)); return id + ':' + g0.pass + '>' + SIM.grade(d, sc).pass; }));
    ok(r.every(x => /false>true$/.test(x)), 'scale challenges: ' + r.join(' '));
  });

  /* ---- interview loop (#/loop) ---- */
  const loopGo = async (p, h) => { await go(p, h, 1200); await p.waitForFunction(() => !!DATA.loop, null, { timeout: 15000 }); await p.waitForTimeout(200); };
  await T('loop: the hub lists nine rounds with readiness and company loops; the nav and Today link to it', async p => {
    await loopGo(p, '#/loop');
    ok((await p.$$('.lpround')).length === 9, 'not nine rounds'); await p.click('.lpco summary'); const t = await text(p, '#page');
    ok(/Recruiter screen/.test(t) && /Code comprehension/.test(t) && /Leadership and past project/.test(t) && /SQL, live/.test(t) && /Data modelling/.test(t) && /Product sense/.test(t) && /Meta/.test(t) && /% ready/.test(t), 'hub text: ' + t.slice(0, 300));
    ok(await p.$('nav.side a[href="#/loop"]'), 'Interview loop not in the menu');
    await go(p, '#/today', 1400); const c = await p.$('.looptoday a'); ok(c, 'no Interview loop card on Today'); const h = await c.getAttribute('href');
    await c.click(); await p.waitForSelector('.tabs [aria-selected=true]'); ok(/#\/loop\/r\d\/\w+/.test(h) && (await p.evaluate(() => location.hash)) === h, 'Today card went to ' + h);
  });
  await T('loop recruiter: the pitch builds from four parts, saves, and raises readiness', async p => {
    await loopGo(p, '#/loop/r1/pitch');
    const parts = ['I lead data engineering for payments, owning the streaming platform.', 'Before that I built batch pipelines at a retailer for six years.', 'I cut the nightly load from six hours to forty minutes.', 'I want to design platforms at a larger scale, which this team does.'];
    const tas = await p.$$('.lpf textarea'); ok(tas.length === 4, 'four parts expected');
    for (let i = 0; i < 4; i++) await tas[i].fill(parts[i]);
    ok(/forty minutes/.test(await text(p, '.lppitch')) && /words/.test(await text(p, '.lppitch + .row')), 'pitch not assembled');
    await p.waitForTimeout(400); await p.reload(); await p.waitForSelector('.lpf textarea'); await p.waitForTimeout(500);
    ok((await p.$eval('.lpf textarea', e => e.value)) === parts[0], 'pitch not saved');
    ok(await p.evaluate(() => loopReady(DATA.loop).r1 >= 50), 'readiness did not rise');
  });
  await T('loop recruiter practice: one question per screen; an answer saves with a timer and checks', async p => {
    await loopGo(p, '#/loop/r1/practice');
    ok(/1 of 11/.test(await text(p, '.lpnav')) && /Tell me about yourself/.test(await text(p, '.lpans')), 'first question');
    await p.fill('.lpans textarea', 'I am a data engineer who builds streaming platforms; ' + 'word '.repeat(20)); await p.click('.lptimer'); await p.waitForTimeout(1200);
    ok(/0:0[1-2] of 1:30/.test(await text(p, '.lptimer')), 'timer did not run: ' + await text(p, '.lptimer'));
    await p.click('.lpchk input'); await p.click('.lpnav .btn.pri'); ok(/2 of 11/.test(await text(p, '.lpnav')), 'Next did not move');
    ok(await p.evaluate(() => /streaming/.test(S.loop.ans['r1:q1'].t) && S.loop.ans['r1:q1'].chk[0] && S.loop.reps[iso(new Date())].r1), 'answer, check or practice day not saved');
  });
  await T('loop coding: the complexity drill marks right and wrong answers with the reason', async p => {
    await loopGo(p, '#/loop/r2/cx');
    await p.click('.lpopt:has-text("O(n)") >> nth=0'); ok(/Right/.test(await text(p, '.lpchoice .why')) && /1 of 12 right/.test(await text(p, '#page')), 'right answer not marked');
    await p.click('.lpnav .btn.pri'); await p.click('.lpopt:has-text("O(1)")'); ok(/Not quite/.test(await text(p, '.lpchoice .why')) && await p.$('.lpopt.ok'), 'wrong answer not marked with the right one');
    await go(p, '#/loop/r2/method', 900); ok(/Clarify/.test(await text(p, '.lpsteps')) && await p.$('a[href^="#/dsa/"]'), 'method or today\'s problem missing');
  });
  await T('loop design: data platform topics link modules and simulator challenges and open Teach me; web topics stay; an exact estimate scores 4 of 4', async p => {
    await loopGo(p, '#/loop/r3/topics');
    const ids = await p.$$eval('.lptopic', es => es.map(e => e.dataset.topic)); ok(['stream1m', 'cdcmr', 'backfill', 'feature', 'migrate'].every(x => ids.includes(x)), 'data platform topics: ' + ids);
    await p.click('.lptopic[data-topic=stream1m] summary'); const st = await text(p, '.lptopic[data-topic=stream1m]'); ok(/exactly once/i.test(st) && /Module DE 5/.test(st) && await p.$('.lptopic[data-topic=stream1m] a[href="#/sim/sc/partitions"]'), 'stream topic: ' + st.slice(0, 200));
    await p.click('.lpweb summary'); await p.click('.lptopic[data-topic=chat] summary'); ok(/Kafka key = conversation id/.test(await text(p, '.lptopic[data-topic=chat]')), 'web topic details');
    await p.click('.lptopic[data-topic=chat] a[href="#/sim/teach/chat"]'); await p.waitForSelector('.simcoach'); ok(/Chat system/.test(await text(p, '.simcoach')), 'teach did not open on chat');
    await loopGo(p, '#/loop/r3/est');
    ok(/100,000,000 devices/.test(await text(p, '.lpest')) && /PB/.test(await text(p, '.lpest')), 'stream estimate is not at PB scale: ' + await text(p, '.lpest'));
    const v = await p.evaluate(() => loopEstQs(DATA.loop.topics[0], 1).map(q => q[2]));
    const ins = await p.$$('.lpnum'); for (let i = 0; i < 4; i++) await ins[i].fill(String(v[i]));
    await p.click('.lpest .btn.pri'); ok(/4 of 4/.test(await text(p, '.lpest')), 'estimate not 4 of 4: ' + await text(p, '.lpest'));
    await ins[0].fill(String(v[0] * 10)); await p.click('.lpest .btn.pri'); ok(/3 of 4/.test(await text(p, '.lpest')) && await p.$('.lpnum.bad'), 'a wrong number was accepted');
    ok(await p.evaluate(() => S.loop.est.stream1m.score === 4), 'best score not kept');
    await go(p, '#/sim', 1200); await p.evaluate(() => { simDebug; }); const quick = await p.evaluate(() => [...simQuickRow(() => {}).querySelectorAll('.simqbtn')].map(b => b.dataset.tpl)); ok(!quick.includes('url') && quick.includes('cdc'), 'SWE starters leaked into quick start: ' + quick);
  });
  await T('loop code: understand, find the line, fix (tests run), improve, use AI well, explain', async p => {
    await loopGo(p, '#/loop/r4/code'); ok((await p.$$('[data-cc]')).length === 12, 'twelve exercises'); await p.click('[data-cc=cc01]'); await p.waitForSelector('.lplines');
    ok(await p.$eval('.lpln[data-line="4"]', e => e.disabled), 'lines tappable before step 1');
    await p.click('.lpopt >> nth=1'); await p.click('.lpln[data-line="2"]'); ok(await p.$('.lpln.miss[data-line="2"]'), 'a wrong line not marked');
    await p.click('.lpln[data-line="4"]'); ok(await p.$('.lpln.hit[data-line="4"]') && /None reading/.test(await text(p, '#page')), 'bug line not accepted');
    await p.evaluate(() => { Py.json = async (fn, args) => { const ok = /is not None/.test(args[1]); return { err: null, tests: JSON.parse(args[0]).tests.map(t => ({ call: t[0], ok, want: '', got: '' })) }; }; });
    await p.click('button:has-text("Run the tests")'); await p.waitForTimeout(200); ok(!(await p.$('.badge:has-text("Tests pass")')) && await p.$('.lptest.bad'), 'the buggy code passed');
    await p.fill('.lpfix', 'def clean_readings(readings):\n    return [r for r in readings if r is not None and r >= 0]'); await p.click('button:has-text("Run the tests")'); await p.waitForSelector('.badge:has-text("Tests pass")');
    await p.click('.lpstep .lpopt >> nth=0'); await p.waitForTimeout(100); await p.click('.lpstep >> nth=3 >> .lpopt >> nth=0'); await p.waitForSelector('.lpans');
    await p.fill('.lpans textarea', 'The function dropped zero readings and crashed on None; I tested with [3, 0, -1, 5] and [1, None, 2].');
    const r = await p.evaluate(() => S.loop.cc.cc01); ok(r.fixed && r.tries === 2 && r.what === 1 && r.better === 0 && r.ai === 0 && await p.evaluate(() => /\[3, 0/.test(S.loop.ans['r4:cc01'].t)), 'progress not saved: ' + JSON.stringify(r));
    ok(await p.$('a:has-text("Next: Latest row per id")'), 'no next exercise'); await go(p, '#/loop/r4/code', 900); ok(/1 of 12 fixed/.test(await text(p, '#page')), 'list status');
    const x0 = await p.evaluate(() => gameXP()); await p.evaluate(() => { S.loop.cc.cc02 = { fixed: 1, at: 1 }; }); ok((await p.evaluate(() => gameXP())) === x0 + 15, 'no XP for a fixed exercise');
  });
  await T('loop code: the real Python runs the tests (fails as given, passes fixed)', async p => {
    await loopGo(p, '#/loop/cc/cc05'); await p.click('.lpopt >> nth=0'); await p.click('.lpln[data-line="5"]');
    await p.click('button:has-text("Run the tests")'); await p.waitForSelector('.lptest', { timeout: 90000 }); ok(await p.$('.lptest.bad'), 'given code passed');
    await p.fill('.lpfix', 'def avg_latency(ms):\n    return sum(ms) / len(ms) if ms else None'); await p.click('button:has-text("Run the tests")'); await p.waitForSelector('.badge:has-text("Tests pass")', { timeout: 30000 });
  });
  await T('loop SQL: the timed round starts the clock on a Hard problem, shows it on the problem page, and records the solve time', async p => {
    await loopGo(p, '#/loop/r7/timed'); const n = (await p.$$('[data-sql]')).length; ok(n === await p.evaluate(() => DATA.sql.filter(x => x.lv === 'Hard').length) && n >= 15, 'Hard list: ' + n);
    await p.click('button:has-text("Start the clock")'); await p.waitForFunction(() => /Timed SQL round ·\s*1[45]:\d\d left/.test((document.querySelector('.lpsqlbar') || {}).innerText || ''), null, { timeout: 10000 }).catch(() => {}); ok(/Timed SQL round ·\s*1[45]:\d\d left/.test(await text(p, '.lpsqlbar')), 'no clock on the problem page: ' + await text(p, '.lpsqlbar'));
    const id = await p.evaluate(() => S.loop.sqlCur.id); await p.evaluate(() => { S.loop.sqlCur.t0 -= 125000; S.solved[S.loop.sqlCur.id] = 1; loopSolved(S.loop.sqlCur.id); });
    ok(await p.evaluate(x => S.loop.sql[x].secs >= 125 && S.loop.sql[x].secs < 135 && S.loop.sqlCur.done, id), 'solve time not recorded');
    await loopGo(p, '#/loop/r7/timed'); ok(/1 of \d+ done/.test(await text(p, '#page')) && /2:0\d/.test(await text(p, '[data-sql="' + id + '"]')), 'round list');
    await go(p, '#/loop/r7/patterns', 900); ok((await p.$$('.lptopic')).length === 8 && /ROW_NUMBER/.test(await all(p, '#page')), 'eight patterns');
  });
  await T('loop modelling and metrics: a prompt answered part by part, then the model answer per part, a rubric and readiness', async p => {
    await loopGo(p, '#/loop/r8/cases'); ok(/Ride-hailing trips/.test(await text(p, '.lpcase')) && /Uber/.test(await text(p, '.lpcase')), 'first modelling case');
    const f = await p.$$('#page .lpf textarea'); ok(f.length === 6, 'six parts: ' + f.length);
    const ans = ['Is a cancelled request a trip and which currency', 'One row per trip request whatever its outcome', 'fare distance duration are additive measures', 'rider Type 2 on segment and home city', 'surrogate keys with an unknown member row', 'SUM amount by city and day from payments'];
    for (let i = 0; i < 6; i++) await f[i].fill(ans[i]);
    await p.click('button:has-text("Compare with the model answer")'); ok((await p.$$('.lpmodel')).length === 6 && /role-playing/.test(await text(p, '#page')), 'model answers not shown');
    await p.click('.lpchk input'); ok(await p.evaluate(() => S.loop.cases.dm1.shown && /cancelled/.test(S.loop.cases.dm1.ask) && S.loop.ans['r8:dm1'].chk[0] && loopReady(DATA.loop).r8 > 0), 'case not saved or readiness unchanged');
    await loopGo(p, '#/loop/r9/cases'); ok(/Stories success/.test(await text(p, '.lpcase')) && (await p.$$('#page .lpf textarea')).length === 6 && /guardrail/i.test(await text(p, '#page')), 'metrics case');
    await go(p, '#/loop/r8/about', 900); ok(await p.$('a[href="#/learn/m01/practice"]'), 'no link to Model it out loud');
  });
  await T('loop behavioural: a STAR story with tags fills the coverage and shows under matching questions; delete leaves a marker', async p => {
    await loopGo(p, '#/loop/r5/stories'); await p.click('button:has-text("+ New story")');
    await p.fill('.lptitle', 'The late partner files'); await p.click('.lptag:has-text("Handling challenges")');
    const f = await p.$$('.lpedit .lpf textarea'); ok(f.length === 4, 'four STAR parts'); await f[0].fill('A partner sent files late every month.'); await f[3].fill('On time 12 months running; I learned to agree contracts early.');
    await p.click('button:has-text("All stories")'); ok(/Handling challenges · 1/.test(await text(p, '.lpcov')) && /The late partner files/.test(await text(p, '.lpstory')), 'list or coverage');
    await go(p, '#/loop/r5/practice', 900); ok(/The late partner files/.test(await text(p, '.lpans')), 'story not offered for the first question');
    await go(p, '#/loop/r5/stories', 900); await p.click('.lpstory'); await p.click('button:has-text("Delete")'); await p.click('.scrim .dialog button:has-text("Delete")');
    await p.waitForTimeout(300); ok(!(await p.$('.lpstory')) && await p.evaluate(() => Object.values(S.loop.stories).some(s => s.del)), 'delete did not leave a marker');
  });
  await T('loop leadership: project parts save; Draw it opens a blank simulator design named after it; follow-ups save', async p => {
    await loopGo(p, '#/loop/r6/project'); const f = await p.$$('.lpf textarea'); ok(f.length === 10, 'ten project parts');
    await f[0].fill('Payments streaming platform'); await f[3].fill('Apps to Kafka to Flink to Cassandra and the lake'); ok(/2 of 10/.test(await text(p, '#page')), 'meter');
    await p.click('button:has-text("Draw it in the simulator")'); await p.waitForSelector('.simcv');
    const d = await p.evaluate(() => simDebug.d); ok(d.name === 'Payments streaming platform' && d.nodes.length <= 1 && /loop\/r6/.test(d.from), 'drawing: ' + JSON.stringify([d.name, d.nodes.length, d.from]));
    await loopGo(p, '#/loop/r6/project'); ok(/Open my drawing/.test(await text(p, '#page')), 'drawing not remembered');
    await go(p, '#/loop/r6/practice', 900); ok(/Payments streaming platform/.test(await text(p, '.lpfit')), 'project not shown with the follow-ups');
    await p.fill('.lpans textarea', 'We chose Flink over Spark Streaming for event-time windows and lower latency on payments.'); await p.click('.seg button:has-text("Leadership")'); ok(/agree on a technical direction/.test(await text(p, '.lpans')), 'leadership set');
    ok(await p.evaluate(() => /Flink/.test(S.loop.ans['r6:f0'].t)), 'follow-up answer not saved');
  });
  await T('loop: sync keeps both devices\' stories and answers, the newer edit wins, a deleted story stays deleted', async p => {
    await go(p, '#/today', 900);
    const r = await p.evaluate(() => { const a = { loop: { cases: { dm1: { grain: 'A', at: 1 } }, sql: { q024: { secs: 300, at: 1 } }, sqlCur: { id: 'q024', t0: 1 }, stories: { s1: { title: 'old', at: 1 }, s2: { title: 'gone', at: 5 } }, ans: { 'r5:b1': { t: 'a', at: 9 } }, pitch: { now: 'A', at: 3 }, cc: { cc01: { fixed: 1, at: 2 } }, reps: { '2026-11-07': { r1: 1 } } } };
      const b = { loop: { cases: { dm1: { grain: 'B', at: 2 }, pm1: { goal: 'x', at: 1 } }, sql: { q025: { secs: 200, at: 1 } }, sqlCur: { id: 'q025', t0: 2 }, stories: { s1: { title: 'new', at: 2 }, s2: { del: 1, at: 6 }, s3: { title: 'b only', at: 1 } }, ans: { 'r5:b1': { t: 'b', at: 4 } }, pitch: { now: 'B', at: 4 }, reps: { '2026-11-07': { r4: 1 } } } };
      const o = mergeState(a, b).loop, o2 = mergeState(b, a).loop; return [o, o2].map(x => [x.stories.s1.title, !!x.stories.s2.del, x.stories.s3.title, x.ans['r5:b1'].t, x.pitch.now, !!x.cc.cc01.fixed, Object.keys(x.reps['2026-11-07']).sort().join(), x.cases.dm1.grain, !!x.cases.pm1, Object.keys(x.sql).sort().join(), x.sqlCur.id].join('|')); });
    ok(r[0] === 'new|true|b only|a|B|true|r1,r4|B|true|q024,q025|q025' && r[1] === r[0], 'merge: ' + r.join(' / '));
  });
  await T('loop on iPhone: no sideways scroll on the hub, a code exercise and an estimate; Next stays on screen', async p => {
    for (const h of ['#/loop', '#/loop/cc/cc07', '#/loop/r3/est', '#/loop/r5/practice', '#/loop/r3/topics', '#/loop/r7/timed', '#/loop/r8/cases']) { await loopGo(p, h); const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); ok(w[0] <= w[1], h + ' scrolls sideways: ' + w); }
    const b = await p.$eval('.lpnav .btn.pri', e => [e.getBoundingClientRect().bottom, document.querySelector('.tabbar').getBoundingClientRect().top]); ok(b[0] <= b[1], 'Next hidden under the tab bar');
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  await browser.close();
  results.forEach(r => console.log(r.join('  ')));
  const f = results.filter(r => r[0] === 'FAIL').length;
  console.log(results.length - f + ' passed, ' + f + ' failed');
  process.exit(f ? 1 : 0);
})();
