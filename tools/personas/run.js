/* Simulated users: seven people with different devices, skills, habits and needs run realistic end-to-end tasks
   in the real app. Each task is scripted the way that person would do it; probes record what they would notice.
   node tools/personas/run.js BASE OUTDIR [persona]
   Needs: the app on BASE, fake_sync on 8814 (key gkey), and a stub grader on 8766 (see tools/test_all.sh). */
const { chromium, webkit, devices } = require(process.env.PW || 'playwright');
const fs = require('fs');
const [BASE, OUT, ONLY] = [process.argv[2] || 'http://localhost:8811/', process.argv[3] || '/tmp/personas', process.argv[4] || ''];
const SYNC = 'http://127.0.0.1:8814/exec?k=gkey';
fs.mkdirSync(OUT, { recursive: true });

const PERSONAS = [
  { id: 'raghav', name: 'Raghav, 38, senior data engineer', engine: 'chromium', ctx: { viewport: { width: 1440, height: 900 } }, grader: true, sync: true,
    about: 'MacBook Chrome, 60 minutes before work, uses sync, the grader and Claude Code daily. Wants to move fast and trust what he sees.' },
  { id: 'priya', name: 'Priya, 29, junior data engineer', engine: 'webkit', ctx: Object.assign({}, devices['iPhone 13']), sync: true, grader: 'relay',
    about: 'iPhone Safari on a 25-minute train commute; signal drops in tunnels; types with thumbs; Python beginner.' },
  { id: 'arun', name: 'Arun, 52, analyst moving into data engineering', engine: 'webkit', ctx: { viewport: { width: 405, height: 540 }, deviceScaleFactor: 4, hasTouch: false, isMobile: false, userAgent: devices['iPad (gen 7)'].userAgent }, keyboard: true,
    about: 'iPad 9th gen with a Bluetooth keyboard, low vision: reads at 200% zoom (simulated as a 405px-wide layout) and moves by keyboard. Strong SQL, new to Python.' },
  { id: 'meera', name: 'Meera, 34, blind analytics engineer', engine: 'chromium', ctx: { viewport: { width: 1280, height: 800 } }, screenReader: true,
    about: 'Mac with VoiceOver (simulated with the accessibility tree): needs headings, labels, announced results and dialogs that manage focus.' },
  { id: 'kenji', name: 'Kenji, 45, privacy-minded architect', engine: 'chromium', ctx: { viewport: { width: 1280, height: 800 } }, offline: true, noAI: true,
    about: 'Refuses AI tools and cloud sync for personal data; studies offline on a plane; wants the app useful with no AI at all.' },
  { id: 'sofia', name: 'Sofia, 26, fast-moving Python developer', engine: 'chromium', ctx: Object.assign({}, devices['Pixel 7'], { colorScheme: 'dark', reducedMotion: 'reduce' }), sync: true, grader: 'relay',
    about: 'Android Chrome in dark mode with reduced motion; binges on weekends; pokes at edge cases: back button, retake, reset, backup, search.' },
  { id: 'dev', name: 'Dev, 41, on-call SRE and parent', engine: 'webkit', ctx: Object.assign({}, devices['iPad (gen 7) landscape']), gap: 3,
    about: 'iPad Safari in landscape; misses days when on call or with the kids, then comes back wanting to know what he missed; uses Claude Code but no sync.' },
];

const short = s => String(s || '').replace(/\s+/g, ' ').slice(0, 160);
async function probe(p, P, where, notes) {
  /* what anyone would notice on this screen */
  const r = await p.evaluate(({ touch }) => {
    const pg = document.querySelector('#page') || document.body, txt = pg.innerText || '';
    const vis = e => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('details:not([open]) > :not(summary)'); };
    const small = touch ? [...pg.querySelectorAll('button, a.btn, [role=tab], select, input[type=checkbox]')].filter(vis).filter(e => { const b = e.getBoundingClientRect(); return b.height < 36 || b.width < 36; }).map(e => (e.getAttribute('aria-label') || e.innerText || e.tagName).trim().slice(0, 30)) : [];
    return { overflow: document.documentElement.scrollWidth - window.innerWidth, junk: (txt.match(/(^|\s)(null|undefined|NaN|\[object Object\])(\s|$)/) || [''])[0].trim(),
      h1: !!document.querySelector('h1'), small: [...new Set(small)].slice(0, 6), unlabeled: [...document.querySelectorAll('button, input, select, textarea')].filter(vis).filter(e => !(e.getAttribute('aria-label') || e.textContent.trim() || e.labels && e.labels.length || e.getAttribute('title') || e.getAttribute('placeholder'))).length };
  }, { touch: !!(P.ctx.hasTouch || P.ctx.isMobile) });
  if (r.overflow > 2) notes.push({ where, kind: 'layout', msg: 'page scrolls sideways by ' + r.overflow + 'px' });
  if (r.junk) notes.push({ where, kind: 'text', msg: 'stray "' + r.junk + '" on the page' });
  if (!r.h1) notes.push({ where, kind: 'a11y', msg: 'no h1 heading' });
  if (r.small.length) notes.push({ where, kind: 'touch', msg: 'small tap targets: ' + r.small.join(', ') });
  if (r.unlabeled) notes.push({ where, kind: 'a11y', msg: r.unlabeled + ' controls without a label' });
}

async function run(P) {
  const b = await (P.engine === 'webkit' ? webkit : chromium).launch();
  const c = await b.newContext(Object.assign({ acceptDownloads: true }, P.ctx));
  await c.route('http://127.0.0.1:8765/**', async r => { if (P.grader !== true) return r.abort(); const res = await r.fetch({ url: r.request().url().replace(':8765', ':8766') }); await r.fulfill({ response: res }); });
  const p = await c.newPage();
  const notes = [], tasks = [], errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { errs.push('native dialog: ' + d.message()); d.dismiss(); });
  const go = async (h, w) => { await p.goto(BASE + h); await p.waitForTimeout(w || 1200); };
  const shot = n => p.screenshot({ path: OUT + '/' + P.id + '_' + n + '.png', fullPage: false }).catch(() => {});
  const task = async (name, fn) => { const t0 = Date.now(); let ok = true, why = ''; try { const r = await fn(); if (r === false) { ok = false; why = 'could not complete'; } else if (typeof r === 'string') { ok = false; why = r; } } catch (e) { ok = false; why = short(e.message); } tasks.push({ name, ok, why, secs: Math.round((Date.now() - t0) / 100) / 10 }); if (!ok) await shot('fail_' + tasks.length); };
  const note = (where, kind, msg) => notes.push({ where, kind, msg });
  const TAB = P.engine === 'webkit' ? 'Alt+Tab' : 'Tab'; /* Safari reaches buttons and links with Option+Tab */
  const gradeWait = async (key, ms) => { const t = Date.now(); while (Date.now() - t < ms) { const g = await p.evaluate(k => (S.grades || {})[k] || null, key); if (g && g.s !== 'pending') return g; await p.waitForTimeout(500); } return p.evaluate(k => (S.grades || {})[k] || null, key); };

  await go('#/today', 2000);
  if (P.sync) await p.evaluate(u => { S.settings.syncUrl = u; save(); }, SYNC);
  if (P.gap) await p.evaluate(n => { const d = new Date(); d.setDate(d.getDate() - n); S.start = iso(d); S.since = null; S.done = {}; save(); }, P.gap);
  await p.waitForTimeout(300);

  /* ---------- everyone: first look at Today ---------- */
  await task('open Today and understand what to do now', async () => {
    await go('#/today'); await probe(p, P, 'Today', notes); await shot('today');
    const t = await p.evaluate(() => ({ units: document.querySelectorAll('.unit').length, hero: (document.querySelector('.unit.cur .t, .hero b') || {}).innerText || '' /* the plan's Up next card, or the ahead-of-plan banner */, cc: [...document.querySelectorAll('.unit .chip')].some(x => /Claude Code/.test(x.innerText)), load: performance.now() }));
    if (!t.units) return 'no steps on Today';
    if (!t.hero) note('Today', 'clarity', 'no "start here" step at the top');
    return true;
  });

  if (P.id === 'raghav') {
    await task('solve the first SQL problem in the editor', async () => {
      const q = await p.evaluate(() => DATA.sql.find(x => !x.m)); await go('#/sql/' + q.id, 2500);
      await p.evaluate(sol => { const ta = document.querySelector('textarea.code'); ta.value = sol; ta.dispatchEvent(new Event('input')); }, q.sol);
      await p.keyboard.press('Meta+Enter'); await p.waitForTimeout(500);
      await p.locator('button', { hasText: /^Run/ }).first().click().catch(() => {});
      for (let i = 0; i < 180 && !(await p.evaluate(id => !!S.solved[id], q.id)); i++) await p.waitForTimeout(500); /* up to 90 s: a busy machine slows Python's first start */
      await probe(p, P, 'SQL editor', notes);
      return (await p.evaluate(id => !!S.solved[id], q.id)) || 'correct solution not marked solved';
    });
    await task('get the code reviewed by the grader', async () => {
      await p.locator('button', { hasText: 'Review my code' }).click();
      const q = await p.evaluate(() => DATA.sql.find(x => !x.m).id);
      const g = await gradeWait('code:' + q, 20000); await shot('code_review');
      return (g && g.s === 'done') || 'no review: ' + JSON.stringify(g && g.err);
    });
    await task('practise an interview answer and get it graded', async () => {
      await go('#/interview/s01');
      await p.locator('details summary', { hasText: 'Practise' }).first().click();
      await p.locator('details textarea').first().fill('Kafka partitions give ordering per key and parallelism; I size partitions from peak throughput divided by per-consumer rate, with headroom.');
      await p.locator('details button', { hasText: 'Grade' }).first().click();
      const g = await gradeWait('iv:1:0', 20000); await probe(p, P, 'Interview set', notes);
      return (g && g.s === 'done') || 'not graded';
    });
    await task('do a Claude Code task and get it graded', async () => {
      await go('#/cc/c03/3'); await probe(p, P, 'Claude Code test', notes);
      await p.locator('textarea[aria-label="Your submission"]').fill('# Orders pipeline\n- Tests: python3 -m unittest -q\n- EU amounts use decimal comma\n- Late files up to 3 days\n- Never print WAREHOUSE_TOKEN\nRemoved: generic advice and history, because CLAUDE.md loads every session.');
      await p.locator('button', { hasText: 'Grade my work' }).click();
      const g = await gradeWait('cc:c03:2', 20000); await shot('cc_graded');
      return (g && g.s === 'done') || 'not graded';
    });
    await task('compare two prompts with Try it in Claude Code', async () => {
      await go('#/learn/c03/lab', 1500);
      await p.locator('textarea[aria-label="Your prompt for Claude Code"]').fill('Look through the project and tell me everything that could be wrong.');
      await p.locator('button', { hasText: 'Run in Claude Code' }).click(); await gradeWait('run:c03_lab', 20000);
      await p.locator('textarea[aria-label="Your prompt for Claude Code"]').fill('In @pipeline/run.py only: is a secret printed? 3 lines.');
      await p.locator('button', { hasText: 'Run in Claude Code' }).click(); await gradeWait('run:c03_lab', 20000); await p.waitForTimeout(500);
      await p.locator('summary', { hasText: 'Compare' }).click().catch(() => {}); await shot('run_compare');
      return (await p.locator('summary', { hasText: 'Compare' }).count()) === 1 || 'no comparison of runs';
    });
    await task('sync progress at the end of the session', async () => {
      await go('#/today'); await p.locator('#syncBtn').click(); await p.waitForTimeout(2500);
      const t = await p.evaluate(() => (document.querySelector('.toast') || {}).innerText || '');
      return /synced/i.test(t) || 'sync message: ' + short(t);
    });
  }

  if (P.id === 'priya') {
    await task('read today\'s lesson on the phone', async () => {
      const href = await p.evaluate(() => { const u = schedule().units.find(u => !u.isDone && u.kind === 'learn'); return u.href; });
      await go(href, 1500); await probe(p, P, 'Lesson', notes); await shot('lesson');
      const wide = await p.evaluate(() => [...document.querySelectorAll('pre, table')].filter(e => e.getBoundingClientRect().right > innerWidth + 2 && !e.closest('.scroll') && getComputedStyle(e).overflowX === 'visible').length);
      if (wide) note('Lesson', 'layout', wide + ' code blocks or tables run off the screen');
      return true;
    });
    await task('take a whole quiz with thumbs and submit', async () => {
      await go('#/quiz/a01', 1500);
      const n = await p.evaluate(() => DATA.sprints.a01.quiz.length);
      for (let i = 0; i < n; i++) {
        const opt = p.locator('button.opt').first();
        if (await opt.count()) await opt.tap(); else if (await p.locator('#page input[type=text]').count()) await p.locator('#page input[type=text]').fill('harness'); else await p.locator('#page textarea').fill('Measure first, then cut waste: cache, smaller model, shorter context.');
        const next = p.locator('button', { hasText: 'Save and next' }); if (await next.count()) await next.tap();
      }
      await p.locator('button', { hasText: /^Submit$/ }).tap(); await p.waitForTimeout(400);
      await p.locator('.dialog button, [role=dialog] button', { hasText: 'Submit' }).first().tap(); await p.waitForTimeout(1500);
      await probe(p, P, 'Quiz results', notes); await shot('quiz_result');
      return (await p.locator('h2', { hasText: 'Score' }).count()) > 0 || 'no score shown';
    });
    await task('wait for the grade of a short quiz answer (Mac is asleep)', async () => {
      const g = await p.evaluate(() => Object.entries(S.grades || {}).find(([k]) => k.startsWith('quiz:a01')));
      if (!g) return 'short answer not sent for grading';
      const t = await p.evaluate(() => [...document.querySelectorAll('.gradebox')].map(x => x.innerText).join(' | '));
      if (!/Waiting|Grading|\d \/ 5/.test(t)) note('Quiz results', 'clarity', 'no sign the answer is being graded: ' + short(t));
      return true;
    });
    await task('do the daily mock interview on the phone', async () => {
      await go('#/mock', 2500); await probe(p, P, 'Mock', notes);
      const tas = p.locator('#page textarea');
      for (let i = 0; i < await tas.count(); i++) await tas.nth(i).fill('First I would clarify the requirements, then estimate volume, then pick the design.');
      await p.locator('button', { hasText: 'Submit for grading' }).tap(); await p.waitForTimeout(300);
      await p.locator('[role=dialog] button', { hasText: 'Submit' }).first().tap(); await p.waitForTimeout(1500); await shot('mock_submitted');
      return (await p.evaluate(() => Object.values(S.mock || {}).some(m => m.sub))) || 'mock not submitted';
    });
    await task('lose signal in a tunnel and keep studying', async () => {
      await go('#/today', 1500); await go('#/path', 1500); await c.setOffline(true);
      await p.reload().catch(() => {}); await p.waitForTimeout(2500);
      const path = await p.evaluate(() => document.body.innerText).catch(() => '');
      await p.goto(BASE + '#/today').catch(() => {}); await p.waitForTimeout(2000);
      const ok = await p.evaluate(() => document.querySelectorAll('.unit').length).catch(() => 0);
      await shot('offline'); await c.setOffline(false);
      if (/Something went wrong/.test(path)) return 'Path page crashes offline';
      return ok > 0 || 'blank page offline';
    });
    await task('sync after the tunnel', async () => {
      await go('#/today', 1500);
      await p.locator('button.tabmore').tap(); await p.waitForTimeout(300);
      await p.locator('.sheet button', { hasText: /Sync/ }).tap(); await p.waitForTimeout(2500);
      const t = await p.evaluate(() => (document.querySelector('.toast') || {}).innerText || '');
      return /synced/i.test(t) || 'sync message: ' + short(t);
    });
  }

  if (P.id === 'arun') {
    await task('tick today\'s first step using only the keyboard', async () => {
      await go('#/today', 1500);
      let reached = false;
      for (let i = 0; i < 60; i++) { await p.keyboard.press(TAB); if (await p.evaluate(() => document.activeElement && document.activeElement.matches('.unit .check'))) { reached = true; break; } }
      if (!reached) return 'could not reach the first step\'s tick with Tab in 60 presses';
      const ring = await p.evaluate(() => { const cs = getComputedStyle(document.activeElement); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 || cs.boxShadow !== 'none'; });
      if (!ring) note('Today', 'a11y', 'focus ring not visible on the step tick');
      await p.keyboard.press('Space'); await p.waitForTimeout(500);
      const tabs = await p.evaluate(() => document.activeElement && document.activeElement.tagName);
      if (tabs === 'BODY') note('Today', 'a11y', 'after ticking, keyboard focus is lost (jumps to the top of the page)');
      return (await p.evaluate(() => Object.keys(S.done).length > 0)) || 'tick did not register';
    });
    await task('answer two quiz questions by keyboard at 200% zoom', async () => {
      await go('#/quiz/p01', 1500); await probe(p, P, 'Quiz', notes); await shot('quiz_zoom');
      for (let i = 0; i < 40; i++) { await p.keyboard.press(TAB); if (await p.evaluate(() => document.activeElement.matches('button.opt, #page input, #page textarea'))) break; }
      const el = await p.evaluate(() => document.activeElement.className + ' ' + document.activeElement.tagName);
      if (/opt/.test(el)) await p.keyboard.press('Enter'); else await p.keyboard.type('list');
      await p.waitForTimeout(300);
      return (await p.evaluate(() => Object.keys((S.quiz.p01 || {}).a || {}).length > 0)) || 'answer not saved by keyboard';
    });
    await task('open settings by keyboard, change minutes, close with Escape', async () => {
      await go('#/today', 1500);
      await p.locator('button[aria-label=Settings]').focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
      const inDialog = await p.evaluate(() => !!document.activeElement.closest('.scrim [role=dialog]'));
      if (!inDialog) note('Settings', 'a11y', 'focus does not move into the settings dialog');
      await shot('settings_zoom'); await probe(p, P, 'Settings dialog', notes);
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      return (await p.locator('.scrim [role=dialog]').count()) === 0 || 'Escape did not close settings';
    });
    await task('read a Python lesson at 200% zoom', async () => {
      await go('#/learn/p01/chapter', 1500); await probe(p, P, 'Python lesson', notes); await shot('lesson_zoom');
      const tiny = await p.evaluate(() => [...document.querySelectorAll('#page p, #page li, #page td')].filter(e => parseFloat(getComputedStyle(e).fontSize) < 14).length);
      if (tiny) note('Python lesson', 'a11y', tiny + ' text blocks smaller than 14px');
      return true;
    });
    await task('run Python code in the editor at zoom', async () => {
      const q = await p.evaluate(() => DATA.py.find(x => x.m === 'p01')); await go('#/py/' + q.id, 3000);
      await probe(p, P, 'Python editor', notes); await shot('editor_zoom');
      const visible = await p.evaluate(() => { const r = [...document.querySelectorAll('button')].find(b => /^Run/.test(b.innerText)); return !!r && r.getBoundingClientRect().bottom <= innerHeight; });
      if (!visible) note('Python editor', 'layout', 'Run button not visible without scrolling at this zoom');
      return true;
    });
  }

  if (P.id === 'meera') {
    /* what a screen reader exposes: roles and names from Playwright's ARIA snapshot */
    const ax = async () => (await p.locator('body').ariaSnapshot()).split('\n').map(l => { const m = /^\s*- (\w+)(?: "((?:[^"\\]|\\.)*)")?/.exec(l); return m ? { role: m[1], name: m[2] || '' } : null; }).filter(Boolean);
    await task('find her place on Today by headings and landmarks', async () => {
      await go('#/today', 1500); const f = await ax('Today');
      const heads = f.filter(n => n.role === 'heading'), lands = f.filter(n => ['main', 'navigation', 'banner'].includes(n.role));
      if (heads.length < 3) note('Today', 'a11y', 'only ' + heads.length + ' headings to jump between');
      if (!lands.some(n => n.role === 'main')) note('Today', 'a11y', 'no main landmark');
      const unnamed = f.filter(n => ['button', 'link'].includes(n.role) && !String(n.name || '').trim());
      if (unnamed.length) note('Today', 'a11y', unnamed.length + ' buttons or links with no accessible name');
      return true;
    });
    await task('take a quiz with the screen reader and hear the score', async () => {
      await go('#/quiz/a02', 1500);
      const opts = await ax('Quiz'); const o = opts.filter(n => n.role === 'button' && /^[A-D]/.test(n.name || ''));
      if (!o.length) note('Quiz', 'a11y', 'answer options not exposed as named buttons');
      const pressed = await p.evaluate(() => [...document.querySelectorAll('button.opt')].every(b => b.hasAttribute('aria-pressed')));
      if (!pressed) note('Quiz', 'a11y', 'selected answer not announced (no aria-pressed)');
      await p.locator('button.opt').first().click(); await p.locator('button', { hasText: /^Submit$/ }).click(); await p.waitForTimeout(300);
      const focusIn = await p.evaluate(() => !!document.activeElement.closest('[role=dialog]'));
      if (!focusIn) note('Quiz', 'a11y', 'submit confirmation opens without moving focus into it');
      await p.locator('[role=dialog] button', { hasText: 'Submit' }).first().click(); await p.waitForTimeout(1000);
      const scoreFocus = await p.evaluate(() => { const a = document.activeElement; return a && (a.closest('section') || a).innerText.includes('Score'); });
      if (!scoreFocus) note('Quiz results', 'a11y', 'after submitting, the score is not announced or focused; she must search for it');
      return true;
    });
    await task('get an interview answer graded and hear the result', async () => {
      await go('#/interview/a01', 1500);
      await p.locator('details summary', { hasText: 'Practise' }).first().click();
      await p.locator('details textarea').first().fill('An agent decides its next step in a loop; a workflow is fixed.');
      const live = await p.evaluate(() => { const g = document.querySelector('.gradebox'); return g && g.getAttribute('aria-live'); });
      if (live !== 'polite') note('Interview', 'a11y', 'grade result area is not a live region');
      await p.locator('details button', { hasText: 'Grade' }).first().click(); await p.waitForTimeout(1200);
      const t = await p.evaluate(() => (document.querySelector('.gradebox') || {}).innerText || '');
      if (/install\.sh/.test(t) && !/model answer/.test(t)) note('Interview', 'clarity', 'grader setup message reads as an error and offers no alternative');
      return true;
    });
    await task('use the code editor with a screen reader', async () => {
      const q = await p.evaluate(() => DATA.dsa[0]); await go('#/dsa/' + q.id, 3000);
      const f = await ax('Editor'); const tb = f.find(n => n.role === 'textbox');
      if (!tb || !tb.name) note('Code editor', 'a11y', 'code box has no accessible name');
      await p.locator('button', { hasText: /^Run/ }).first().click(); await p.waitForTimeout(300);
      if (!/Running/.test(await p.evaluate(() => (document.querySelector('.out [role=status]') || {}).textContent || ''))) note('Code editor', 'a11y', 'nothing announced while the code runs');
      let announced = false; for (let i = 0; i < 180 && !announced; i++) { await p.waitForTimeout(500); announced = await p.evaluate(() => /pass|failing|error/i.test((document.querySelector('.out [role=status]') || {}).textContent || '')); }
      if (!announced) note('Code editor', 'a11y', 'test results are not announced after Run');
      return true;
    });
    await task('open the More/Search dialog and leave it', async () => {
      await go('#/today', 1200); await p.locator('nav.side a', { hasText: 'Path' }).focus(); await p.keyboard.press('/'); await p.waitForTimeout(400);
      const inS = await p.evaluate(() => document.activeElement.tagName === 'INPUT');
      if (!inS) note('Search', 'a11y', '/ does not put focus in the search box');
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      const back = await p.evaluate(() => document.activeElement && document.activeElement.tagName !== 'BODY');
      if (!back) note('Search', 'a11y', 'closing search drops focus to the page top instead of returning it');
      return true;
    });
  }

  if (P.id === 'kenji') {
    await task('turn AI features off in Settings', async () => {
      await go('#/today', 1200); await p.locator('button[aria-label=Settings]').click(); await p.waitForTimeout(300);
      if (!(await p.locator('#st_ai').count())) return 'no AI setting';
      await p.selectOption('#st_ai', 'off'); await p.locator('.scrim [role=dialog] button', { hasText: 'Save' }).click(); await p.waitForTimeout(600);
      return (await p.evaluate(() => S.settings.ai === false)) || 'setting not saved';
    });
    await task('use the app with no AI key, no grader and no sync', async () => {
      await go('#/today', 1500); await probe(p, P, 'Today (no AI)', notes); await shot('today_ai_off');
      const ai = await p.evaluate(() => [...document.querySelectorAll('.unit')].filter(u => /Claude Code/.test(u.innerText)).length);
      if (ai) note('Today', 'choice', ai + ' Claude Code (AI) steps are still in his plan with AI features off');
      const t = await p.evaluate(() => document.querySelector('#page').innerText);
      const nag = (t.match(/[^\n]*(Sync is not set up|grades it tonight|coach grades)[^\n]*/i) || [''])[0];
      if (nag) note('Today', 'choice', 'with AI off, Today still pushes the AI coach: "' + short(nag) + '"');
      return true;
    });
    await task('try a grade button without any AI set up', async () => {
      await go('#/interview/a01', 1500);
      await p.locator('details summary', { hasText: 'Practise' }).first().click();
      await p.locator('details textarea').first().fill('My own answer.');
      await p.waitForTimeout(500); await shot('grade_noai');
      const boxes = await p.locator('.gradebox').count(), selfCheck = await p.locator('button', { hasText: 'Show model answer' }).count();
      if (boxes) note('Interview', 'choice', 'grade buttons still shown with AI off');
      if (!selfCheck) note('Interview', 'choice', 'no way to self-check without AI');
      return true;
    });
    await task('before the flight: run one coding problem online', async () => {
      const q = await p.evaluate(() => DATA.dsa[1]); await go('#/dsa/' + q.id, 2000);
      await p.locator('button', { hasText: /^Run/ }).first().click();
      for (let i = 0; i < 180; i++) { await p.waitForTimeout(500); if (await p.evaluate(() => /pass|failing|rror/i.test((document.querySelector('.out [role=status]') || {}).textContent || ''))) return true; }
      return 'online run did not finish';
    });
    await task('go offline on the plane and keep working', async () => {
      await go('#/learn/s02/chapter', 1500); await go('#/quiz/s02', 1200); await go('#/today', 1200);
      await c.setOffline(true);
      for (const h of ['#/today', '#/learn/s02/chapter', '#/quiz/s02', '#/path']) { await p.goto(BASE + h).catch(() => {}); await p.waitForTimeout(1500); const n = await p.evaluate(() => (document.querySelector('#page') || {}).innerText || '').catch(() => ''); if (n.length < 50) { await c.setOffline(false); return 'screen ' + h + ' empty offline'; } }
      return true;
    });
    await task('run code offline', async () => {
      const q = await p.evaluate(() => DATA.dsa[0]);
      await p.goto(BASE + '#/dsa/' + q.id).catch(() => {}); await p.waitForTimeout(4000);
      await p.locator('button', { hasText: /^Run/ }).first().click().catch(() => {}); await p.waitForTimeout(8000);
      const out = await p.evaluate(() => (document.querySelector('.out, .obody, #page') || {}).innerText || '');
      await shot('code_offline'); await c.setOffline(false);
      const said = await p.evaluate(() => (document.querySelector('.out [role=status]') || {}).textContent || '').catch(() => '');
      if (/pass|failing/i.test(said)) return true;
      if (/Could not start Python/.test(out + said)) { note('Code editor', 'offline', 'clear message, but code does not run offline: ' + short(said || out)); return true; }
      return 'offline run stuck or silent: ' + short(said || out.split('\n').slice(-3).join(' '));
    });
    await task('ask the coach bubble without a key', async () => {
      await go('#/today', 1200); await p.locator('button.fab').click(); await p.locator('.coach input[type=text]').fill('How do I start?'); await p.locator('.coach button', { hasText: 'Send' }).click(); await p.waitForTimeout(600);
      const t = await p.evaluate(() => document.querySelector('.coach .msgs').innerText);
      return t.length > 20 || 'coach gave no reply';
    });
    await task('back up progress to a file (instead of cloud sync)', async () => {
      await go('#/progress', 1200);
      const [d] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }), p.locator('button', { hasText: /Download|Back up|Export/i }).first().click()]);
      const j = JSON.parse(fs.readFileSync(await d.path(), 'utf8'));
      if (j.settings && (j.settings.aiKey || j.settings.syncUrl)) note('Backup', 'privacy', 'backup file includes the AI key or sync URL');
      return !!j.start || 'backup empty';
    });
  }

  if (P.id === 'sofia') {
    await task('tick today\'s steps fast, untick one, check counts', async () => {
      await go('#/today', 1500);
      let n = 0;
      for (let i = 0; i < 5; i++) { const b = p.locator('.unit:not(.done) .check').first(); if (await b.count()) { await b.tap(); n++; await p.waitForTimeout(250); } }
      await p.locator('.unit.done .check').first().tap(); await p.waitForTimeout(300);
      await probe(p, P, 'Today dark', notes); await shot('today_dark');
      const s = await p.evaluate(() => Object.keys(S.done).length); return s === n - 1 || 'expected ' + (n - 1) + ' done, got ' + s;
    });
    await task('search for "SCD" and open a result', async () => {
      await p.locator('button[aria-label=Search]').tap(); await p.waitForTimeout(300);
      await p.keyboard.type('SCD'); await p.waitForTimeout(500);
      const n = await p.locator('[role=dialog] a, [role=option]').count();
      if (!n) return 'no results for SCD';
      await p.locator('[role=dialog] a, [role=option]').first().tap(); await p.waitForTimeout(1200);
      return !/today/.test(await p.evaluate(() => location.hash)) || 'did not navigate';
    });
    await task('use the Android back button through three screens', async () => {
      await go('#/today', 800); await p.goto(BASE + '#/path'); await p.waitForTimeout(600); await p.goto(BASE + '#/practice'); await p.waitForTimeout(600); await p.goto(BASE + '#/quiz/p02'); await p.waitForTimeout(900);
      await p.goBack(); await p.waitForTimeout(600); const h1 = await p.evaluate(() => location.hash);
      await p.goBack(); await p.waitForTimeout(600); const h2 = await p.evaluate(() => location.hash);
      const ok = /practice/.test(h1) && /path/.test(h2); const pageOk = await p.evaluate(() => (document.querySelector('#page') || {}).innerText.length > 50);
      return (ok && pageOk) || 'back went to ' + h1 + ' then ' + h2;
    });
    await task('retake a quiz and keep the best score', async () => {
      await p.evaluate(() => { S.quiz.p02 = { a: {}, sub: true, i: 0, best: 90, last: 90 }; save(); });
      await go('#/quiz/p02', 1200); await p.locator('button', { hasText: 'Retake' }).tap(); await p.waitForTimeout(600);
      const best = await p.evaluate(() => (S.quiz.p02 || {}).best); return best === 90 || 'best score lost: ' + best;
    });
    await task('get a Claude Code task graded from the phone (via the Mac)', async () => {
      await go('#/cc/c01/2', 1500); await probe(p, P, 'Claude Code test dark', notes); await shot('cc_dark');
      await p.locator('textarea[aria-label="Your submission"]').fill('1 Esc 2 /clear 3 ! tests 4 claude -c 5 plan mode 6 /context');
      await p.locator('button', { hasText: 'Grade my work' }).tap();
      const g = await gradeWait('cc:c01:1', 30000); return (g && g.s === 'done') || 'not graded: ' + JSON.stringify(g && (g.err || g.s));
    });
    await task('export a backup and restore it', async () => {
      await go('#/progress', 1200);
      const [d] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }), p.locator('button', { hasText: /Download|Back up|Export/i }).first().tap()]);
      const path = await d.path(); const before = await p.evaluate(() => Object.keys(S.done).length);
      await p.evaluate(() => { S.done = {}; save(); });
      await p.locator('input[type=file][accept="application/json"]').first().setInputFiles(path); await p.waitForTimeout(1000);
      const after = await p.evaluate(() => Object.keys(S.done).length); return after === before || 'restore lost steps: ' + before + ' -> ' + after;
    });
  }

  if (P.id === 'dev') {
    await task('come back after missing days and see what happened', async () => {
      await go('#/today', 1200); await probe(p, P, 'Today after a gap', notes); await shot('gap');
      const r = await p.evaluate(() => { const sc = schedule(); return { note: (document.querySelector('.behind') || {}).innerText || '', cur: (document.querySelector('.unit.cur .t') || {}).innerText || '', first: (sc.units.find(u => !u.isDone && !isCC(u.mid)) || {}).title }; });
      if (!/Catching up/.test(r.note)) return 'no word about the missed days';
      return r.cur === r.first || 'Up next is "' + r.cur + '", not the earliest open step "' + r.first + '"';
    });
    await task('check the week strip for the missed days', async () => {
      const t = await p.$$eval('.wkday.past', a => a.map(x => x.innerText));
      if (t.some(x => /—/.test(x))) note('Today week strip', 'clarity', 'a missed day shows only a dash');
      return true;
    });
    await task('catch up on a skipped DSA problem first', async () => {
      const s = await p.$$eval('.item .s', a => a.map(x => x.innerText).join(' | '));
      return /from (Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(s) || new Date().getDay() === 1 || 'coding track jumped past unsolved problems: ' + s.slice(0, 120);
    });
    await task('do the first step by touch and see the plan move', async () => {
      const before = await p.$eval('.unit.cur .t', e => e.innerText);
      await p.locator('.unit.cur .check').tap(); await p.waitForTimeout(500);
      const after = await p.$eval('.unit.cur .t', e => e.innerText).catch(() => '');
      return (after && after !== before) || 'Up next did not move on';
    });
    await task('open Path and continue the current module', async () => {
      await go('#/path', 1200); await probe(p, P, 'Path iPad', notes); await shot('path');
      const href = await p.$eval('.pcard.cur .go', e => e.getAttribute('href')).catch(() => null);
      if (!href) return 'no Continue button on the current module';
      await p.locator('.pcard.cur .go').tap(); await p.waitForTimeout(1200); await probe(p, P, 'Continue target', notes);
      return (await p.evaluate(() => (document.querySelector('#page') || {}).innerText.length > 80)) || 'Continue opened an empty page';
    });
    await task('skip ahead to tomorrow and come back', async () => {
      await go('#/today/1', 900); const t = await p.evaluate(() => document.querySelector('h1').innerText + '|' + location.hash);
      await p.locator('a', { hasText: 'Back to today' }).first().tap(); await p.waitForTimeout(700);
      return /#\/today$/.test(await p.evaluate(() => location.hash)) || 'Back to today failed (' + t + ')';
    });
  }

  errs.forEach(e => notes.push({ where: 'any', kind: 'error', msg: 'page error: ' + short(e) }));
  await b.close();
  return { id: P.id, name: P.name, about: P.about, tasks, notes };
}

(async () => {
  const out = [];
  for (const P of PERSONAS.filter(x => !ONLY || x.id === ONLY)) { try { out.push(await run(P)); } catch (e) { out.push({ id: P.id, name: P.name, crash: short(e.message), tasks: [], notes: [] }); } }
  /* severity: P0 blocks a task or breaks the page; P1 confuses or excludes someone; P2 is polish. Rating starts at 10. */
  const SEV = { error: 'P0', layout: 'P1', a11y: 'P1', clarity: 'P1', touch: 'P2', text: 'P2' };
  for (const r of out) {
    const seen = new Set(); r.issues = [];
    if (r.crash) r.issues.push({ sev: 'P0', where: 'run', msg: r.crash });
    r.tasks.filter(t => !t.ok).forEach(t => r.issues.push({ sev: 'P0', where: t.name, msg: t.why }));
    r.notes.forEach(n => { const k = n.where + n.msg; if (seen.has(k)) return; seen.add(k); r.issues.push({ sev: SEV[n.kind] || 'P2', where: n.where, msg: n.msg }); });
    const c = x => r.issues.filter(i => i.sev === x).length;
    r.count = { P0: c('P0'), P1: c('P1'), P2: c('P2') };
    r.rating = Math.max(1, Math.round(10 - 3 * r.count.P0 - 1.5 * r.count.P1 - 0.5 * r.count.P2));
  }
  fs.writeFileSync(OUT + '/results.json', JSON.stringify(out, null, 1));
  for (const r of out) {
    console.log('\n## ' + r.name + (r.crash ? ' CRASH ' + r.crash : ''));
    r.tasks.forEach(t => console.log((t.ok ? '  ok   ' : '  FAIL ') + t.name + ' (' + t.secs + ' s)' + (t.why ? ': ' + t.why : '')));
    r.issues.forEach(i => console.log('  ' + i.sev + ' ' + i.where + ': ' + i.msg));
    console.log('  RATING ' + r.rating + '/10 · P0 ' + r.count.P0 + ' · P1 ' + r.count.P1 + ' · P2 ' + r.count.P2);
  }
  console.log('\nRATINGS ' + out.map(r => r.id + '=' + r.rating).join(' '));
})();
