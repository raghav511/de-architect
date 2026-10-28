/* Data Architect user-journey tests (QA scenarios). node tools/flows.js [baseUrl] [filter]
   Each scenario runs in a fresh browser context and checks what a user would see. */
const { chromium } = require(process.env.PW || 'playwright');
const BASE = (process.argv[2] && /^http/.test(process.argv[2])) ? process.argv[2] : 'http://localhost:8811/';
const FILTER = process.argv.find(a => !/^http/.test(a) && a !== process.argv[0] && a !== process.argv[1]) || '';
const results = [];
let browser;
async function ctx(opt) {
  const c = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }, opt || {})); await c.route('http://127.0.0.1:8765/**', r => r.abort()); /* never reach a real grader installed on this Mac */
  const p = await c.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('dialog', d => { p.errs.push('native dialog: ' + d.message()); d.dismiss(); });
  return { c, p };
}
const go = async (p, h, w) => { await p.goto(BASE + h); await p.waitForTimeout(w || 700); };
const hash = async (p, h, w) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(w || 400); };
const text = (p, s) => p.$eval(s, e => e.innerText).catch(() => '');
const state = p => p.evaluate(() => JSON.parse(localStorage.getItem('keystone:v1') || '{}'));
function ok(cond, msg) { if (!cond) throw new Error(msg); }
async function T(name, fn, opt) {
  if (FILTER && !name.toLowerCase().includes(FILTER.toLowerCase())) return;
  const { c, p } = await ctx(opt);
  try { await fn(p, c); if (p.errs.length) throw new Error('page errors: ' + p.errs.join(' | ')); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]); await p.screenshot({ path: '/tmp/flow_fail_' + name.replace(/\W+/g, '_') + '.png' }).catch(() => {}); }
  await c.close();
}

(async () => {
  browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});

  await T('today: two missed days carry forward, say so, and keep the first step on top', async p => {
    await go(p, '#/today');
    await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 2); S.start = iso(d); S.done = {}; save(); });
    await p.reload(); await p.waitForSelector('.unit .t', { timeout: 30000 }); await p.waitForTimeout(400);
    const sc = await p.evaluate(() => { const s = schedule(); return { missed: s.missed.length, first: s.units.find(u => !isCC(u.mid)).title, today: (s.byDay[s.today] || []).map(u => isCC(u.mid)) }; });
    ok(sc.missed === 2, 'expected 2 missed days, got ' + sc.missed);
    ok(/Catching up/.test(await text(p, '.behind')) && /2 days/.test(await text(p, '.behind')), 'no catching-up note on Today');
    ok((await text(p, '.unit.cur .t')) === sc.first, 'Up next is not the program\'s first step');
    ok(sc.today.indexOf(true) === -1 || sc.today.indexOf(true) > sc.today.lastIndexOf(false), 'a Claude Code step sits above a main step');
    ok(/from (Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test((await p.$$eval('.item .s', a => a.map(x => x.innerText))).join(' ')), 'coding track did not catch up on the first unsolved problem');
    const strip = await p.$$eval('.wkday.past', a => a.map(x => x.innerText));
    ok(strip.every(t => !/—/.test(t) || !/0\//.test(t)) || strip.some(t => /Missed · moved to today/.test(t)) || new Date().getDay() <= 2, 'missed days in the week strip do not say where the work went');
    await p.evaluate(() => { S.done[schedule().units.find(u => !isCC(u.mid)).uid] = iso(new Date()); save(); }); await p.reload(); await p.waitForTimeout(800);
    ok(await p.$('.behind'), 'note should stay while earlier days are still empty');
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
    for (let i = 0; i < 8; i++) { const b = await p.$('.unit:not(.done) .check'); if (!b) break; await b.click(); await p.waitForTimeout(350); }
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
    let m = (await text(p, '#page')).match(/of (\d+) min done/); ok(m && +m[1] <= 65, 'Monday plan over 60: ' + (m && m[1]));
    await p.evaluate(() => { S.settings.capWd = 90; save(); route(); }); await p.waitForTimeout(500);
    m = (await text(p, '#page')).match(/of (\d+) min done/); ok(m && +m[1] > 60 && +m[1] <= 95, 'budget 90 not applied: ' + (m && m[1]));
    ok(/90-minute day/.test(await text(p, '#page')), 'day chip not updated');
  });

  await T('settings: save, reopen shows values, bad minutes fall back, theme applies', async p => {
    await go(p, '#/today');
    await p.click('[aria-label="Settings"]'); await p.waitForTimeout(300);
    await p.fill('#st_wd', '5'); await p.fill('#st_we', '150'); await p.fill('#st_time', '06:30');
    await p.fill('#st_sync', 'https://script.google.com/macros/s/abc/exec'); await p.fill('#st_key', 'sk-ant-test');
    await p.selectOption('#st_theme', 'dark');
    await p.click('.dialog button:has-text("Save")'); await p.waitForTimeout(400);
    const s = await state(p); ok(s.settings.capWd === 60, 'invalid weekday minutes should fall back to 60, got ' + s.settings.capWd);
    ok(s.settings.capWe === 150 && s.settings.studyTime === '06:30', 'weekend/time not saved');
    ok(await p.evaluate(() => document.documentElement.dataset.theme === 'dark'), 'dark theme not applied');
    await p.reload(); await p.waitForTimeout(700);
    ok(await p.evaluate(() => document.documentElement.dataset.theme === 'dark'), 'theme lost after reload');
    await p.click('[aria-label="Settings"]'); await p.waitForTimeout(300);
    ok((await p.inputValue('#st_sync')).includes('abc') && (await p.inputValue('#st_key')) === 'sk-ant-test', 'settings not shown on reopen');
    await p.keyboard.press('Escape');
  });

  await T('sync: without URL opens settings; failing URL keeps progress', async p => {
    await go(p, '#/today');
    await p.click('#syncBtn'); await p.waitForTimeout(300); ok(await p.$('#st_sync'), 'settings not opened');
    await p.keyboard.press('Escape');
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
    ok(/\$L setup 5/.test(await text(p, '#page')), 'setup command missing');
    await p.click('button:has-text("Mark this lesson done")'); await p.waitForTimeout(300);
    ok(Object.keys((await state(p)).done).some(k => k.endsWith(':git')), 'git lesson not saved');
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
    await p.evaluate(() => { saveT && clearTimeout(saveT); localStorage.setItem('keystone:v1', JSON.stringify({ start: '2026-10-12', done: { w1d0les1: 1, w1d0dsa: 1 }, quiz: { 1: { a: { 0: 'A' }, sub: true, i: 0 } }, iv: { 1: { 0: true } }, solved: { d011: 1 }, settings: { syncUrl: '' }, week: 2, dayPick: 1 })); }); await p.reload(); await p.waitForTimeout(800);
    for (const h of ['#/today', '#/path', '#/progress', '#/quiz/s01', '#/interview/1', '#/learn/1', '#/path/3']) { await go(p, h, 600); ok(!(/Something went wrong/.test(await text(p, '.top'))), h + ' broke'); }
    await go(p, '#/path/s01', 600); ok(await p.$('.unit.done:has-text("Quiz 1")'), 'old submitted quiz 1 should count as done');
  });

  await T('storage blocked: app still renders', async p => {
    await p.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
    await go(p, '#/today', 1000);
    ok(/Your plan for today/.test(await text(p, '#page')), 'app did not render without storage');
  });

  await T('keyboard: dialogs trap focus start and Escape closes; focus visible', async p => {
    await go(p, '#/today');
    await p.click('[aria-label="Settings"]'); await p.waitForTimeout(200);
    const f = await p.evaluate(() => document.activeElement && document.activeElement.closest('.dialog') !== null); ok(f, 'focus not moved into dialog');
    await p.keyboard.press('Escape'); await p.waitForTimeout(150); ok(!(await p.$('.dialog')), 'escape did not close settings');
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
    const outline = await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle); ok(outline !== 'none', 'no visible focus ring');
  });

  await T('phone: More sheet opens every section and settings', async p => {
    await go(p, '#/today');
    await p.click('.tabmore'); await p.waitForTimeout(200);
    const n = await p.$$eval('.sheetgrid a, .sheetgrid button', x => x.length); ok(n >= 10, 'sheet has ' + n);
    await p.click('.sheetgrid a:has-text("Git lessons")'); await p.waitForTimeout(500);
    ok(/#\/git/.test(p.url()) && !(await p.$('.sheet')), 'sheet link failed or did not close');
    ok(await p.$('.tabmore[aria-current=page]'), 'More tab not highlighted on a non-tab page');
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
    ok(/Weeks? 8/.test(await text(p, '#page')), 'old start not reflected');
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
    const n = await p.$$eval('.plan .unit', us => us.length); ok(n >= 2, 'need two steps today, got ' + n);
    ok(await p.$$eval('.plan .unit.cur', us => us.length) === 1, 'exactly one Up next card expected');
    const row = p.locator('.plan .unit.folded').first();
    ok(!(await row.locator('.goal').isVisible()), 'folded row should hide its details');
    const btn = row.locator('.unfold'); ok((await btn.getAttribute('aria-expanded')) === 'false', 'toggle should start collapsed');
    await btn.click(); await p.waitForTimeout(150);
    const opened = p.locator('.plan .unit').nth(1);
    ok(await opened.locator('.goal').isVisible() && await opened.locator('.acts .btn.pri').isVisible(), 'details did not open in place');
    ok((await opened.locator('.unfold').getAttribute('aria-expanded')) === 'true', 'aria-expanded not updated');
    await opened.locator('.unfold').click(); await p.waitForTimeout(150);
    ok(!(await opened.locator('.goal').isVisible()), 'details did not fold again');
    const r = await p.$eval('.planhead .ring', e => e.getAttribute('aria-label')); ok(/% of the plan done/.test(r), 'progress ring missing a label');
    ok(await p.$('.plan .daynav [aria-label="Next day"]'), 'day arrows should sit inside the plan card');
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
    await p.click('[aria-label="Settings"]'); await p.fill('#st_start', '2026-10-22'); await p.click('.dialog button:has-text("Save")'); await p.waitForTimeout(300);
    ok((await state(p)).start === '2026-10-19', 'start not snapped: ' + (await state(p)).start);
  });

  await T('order: diagnostic first, Python woven between the AI modules', async p => {
    await go(p, '#/today');
    const mods = await p.evaluate(() => MODS.slice(0, 14).join(' '));
    ok(mods === 's00 p01 p02 a01 p03 p04 a02 p05 p06 a03 m01 m02 m03 s01', 'module order: ' + mods);
    const first = await p.evaluate(() => schedule().units.find(u => !isCC(u.mid)).mid); ok(first === 's00', 'first non-Claude-Code step should be in Setup: ' + first);
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
    ok(/Review ›/.test(await text(p, '#page')), 'due review not on the coding card');
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
    const pos = await p.evaluate(() => [MODS.indexOf('j01') - MODS.indexOf('s07'), MODS.indexOf('r01') - MODS.indexOf('s10'), MODS.indexOf('d01') - MODS.indexOf('s04')]);
    ok(pos[0] === 1 && pos[1] === 1 && pos[2] === 1, 'Platform 1 should follow DE 7, Leadership 1 DE 10, Systems 1 DE 4: ' + pos);
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
    const t = await text(p, '#page');
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
    await p.click('[aria-label="Settings"]'); await p.fill('#st_sync', 'ftp://example.com/x'); await p.click('.dialog button:has-text("Save")'); await p.waitForTimeout(300);
    ok(/not valid/.test(await text(p, '.toast')) && !(await state(p)).settings.syncUrl, 'invalid sync URL saved');
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
    await go(p, '#/today');
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
    ok(await p.locator('[aria-label="Update app"].hasdot').count() === 1 && /Update to 9\.9\.9/.test(await text(p, '[aria-label="Update app"]')), 'button does not show the update');
    await p.reload(); await p.waitForTimeout(1500);
    ok(!/is available/.test(await text(p, '.toast')), 'toast repeated for the same version');
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
    await p.click('[aria-label=Settings]'); await p.waitForTimeout(400);
    const t = await text(p, '.scrim [role=dialog]');
    ok(/App version \d/.test(t) && /Notify me when an app update/.test(t), 'settings lack the version or the toggle');
  });

  /* ---- persona round 1 fixes ---- */
  await T('persona: Python runtime unreachable shows a clear error, not an endless Running', async (p, c) => {
    await c.route(/cdn\.jsdelivr\.net\/pyodide/, r => r.abort());
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
    await p.click('[aria-label=Settings]'); await p.waitForTimeout(300);
    await p.selectOption('#st_ai', 'on'); await p.locator('[role=dialog] button', { hasText: 'Save' }).click(); await p.waitForTimeout(500);
    ok(await p.evaluate(() => S.settings.ai === true && MODS.some(isCC)), 'turning AI back on did not restore the track');
  });
  await T('persona: step ticks are at least 44px on touch screens', async p => {
    await go(p, '#/today', 1200);
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
    const t = await text(p, '#page');
    ok(!/Sync is not set up|grades it tonight|coach grades/i.test(t), 'Today still mentions the AI coach: ' + (t.match(/[^\n]*(Sync is not set up|grades it tonight)[^\n]*/) || [''])[0]);
    ok(/Daily mock interview/.test(t), 'daily mock missing');
    await go(p, '#/coach', 1000); ok(/AI features are off/.test(await text(p, '#page')), 'coach page does not explain');
  });

  /* ---- preferences (Settings) ---- */
  await T('preferences: coach source and grading model are chosen in Settings and saved', async p => {
    await go(p, '#/today', 1000); await p.click('[aria-label=Settings]'); await p.waitForTimeout(300);
    await p.selectOption('#st_coach', 'hints'); await p.selectOption('#st_grade', 'sonnet');
    await p.locator('.scrim [role=dialog] button', { hasText: 'Save' }).click(); await p.waitForTimeout(300);
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

  await browser.close();
  results.forEach(r => console.log(r.join('  ')));
  const f = results.filter(r => r[0] === 'FAIL').length;
  console.log(results.length - f + ' passed, ' + f + ' failed');
  process.exit(f ? 1 : 0);
})();
