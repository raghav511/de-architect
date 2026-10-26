/* Data Architect UI crawler. Opens every reachable screen, checks errors, layout and text, and clicks every button.
   node tools/crawl.js [baseUrl] [--quick]
   Needs playwright (PW env var can point at it) and a local server on the repo root. */
const PW = process.env.PW || 'playwright';
const { chromium } = require(PW);
const BASE = (process.argv[2] && !process.argv[2].startsWith('--')) ? process.argv[2] : 'http://localhost:8811/';
const QUICK = process.argv.includes('--quick');
const VP = {
  mac: { viewport: { width: 1440, height: 900 } },
  ipad: { viewport: { width: 810, height: 1080 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  iphone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }
};
const SEED = ['#/today', '#/path', '#/practice', '#/practice/tests', '#/projects', '#/design', '#/git', '#/news', '#/progress', '#/quiz/0', '#/learn/0'];
const issues = [];
const bad = (vp, r, m) => issues.push(`[${vp}] ${r} :: ${m}`);
const editor = r => /^#\/(dsa|sql|spark|test)\//.test(r);
const norm = h => h.replace(/\/$/, '');

async function load(p, r) { await p.goto('about:blank'); await p.goto(BASE + r, { timeout: 15000 }); await p.waitForFunction(() => document.querySelector('.top') && !/Loading/.test((document.querySelector('#page') || document.body).innerText.slice(0, 300)), null, { timeout: 8000 }).catch(() => {}); }
async function pageCheck(p, vp, r, errs) {
  const info = await p.evaluate(() => {
    const main = document.querySelector('#page') || document.querySelector('.main') || document.body;
    const txt = main ? main.innerText : '';
    const links = Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href'));
    const small = [];
    document.querySelectorAll('button, a.btn, .tabbar a, select, input, .item').forEach(e => {
      const b = e.getBoundingClientRect(); const st = getComputedStyle(e);
      if (b.width && b.height && st.visibility !== 'hidden' && st.display !== 'none' && (b.height < 30 || b.width < 30)) small.push((e.innerText || e.getAttribute('aria-label') || e.tagName).slice(0, 30) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height));
    });
    const clipped = [];
    document.querySelectorAll('.card, .unit, .item, .btn').forEach(e => { if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === 'visible') clipped.push((e.innerText || '').slice(0, 30)); });
    return { iw: innerWidth, title: (document.querySelector('.top .title b') || {}).textContent || '', txt, links, small, over: document.documentElement.scrollWidth - innerWidth, clipped: clipped.slice(0, 3), h1: !!document.querySelector('h1,h2,h3') };
  });
  if (info.title === 'Something went wrong') bad(vp, r, 'error page: ' + info.txt.slice(0, 160));
  if (info.over > 2) bad(vp, r, 'horizontal overflow ' + info.over + 'px');
  if (VP[vp].viewport && info.iw > VP[vp].viewport.width + 2) bad(vp, r, 'page wider than the screen (layout width ' + info.iw + 'px), content would shrink');
  if (/\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b(?! *(values|rows|check|count|rate|handling|drivers|fares|s\b))/.test(info.txt.replace(/IS (NOT )?NULL|null(able|s)|NULLs?/gi, ''))) {
    const m = info.txt.match(/.{0,40}(\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b).{0,40}/);
    if (m && !/`|null\)|= null|is null|null if|None|NULL/i.test(m[0])) bad(vp, r, 'suspicious text: ' + m[0].replace(/\n/g, ' '));
  }
  if (!info.h1 && !editor(r)) bad(vp, r, 'no heading on page');
  if (/Loading/.test(info.txt) && info.txt.length < 200) bad(vp, r, 'stuck on loading');
  if (vp === 'iphone' && info.small.length) bad(vp, r, 'small tap targets: ' + info.small.slice(0, 4).join(' | '));
  errs.splice(0).forEach(e => bad(vp, r, 'console: ' + e.slice(0, 200)));
  return info;
}

(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const ext = new Set();
  for (const [vp, opt] of Object.entries(VP)) {
    if (QUICK && vp === 'ipad') continue;
    const ctx = await b.newContext(opt); await ctx.route('http://127.0.0.1:8765/**', r => r.abort()); /* never reach a real grader installed on this Mac */
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('pageerror ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|favicon|ERR_TUNNEL|ERR_PROXY|net::ERR|Failed to load resource.*(cdn|jsdelivr)/.test(m.text())) errs.push(m.text()); });
    p.on('dialog', d => { bad(vp, p.url(), 'native dialog: ' + d.message()); d.dismiss(); });
    const seen = new Set(), queue = SEED.slice(), queued = new Set(SEED);
    let editorsSeen = 0; const fam = {};
    while (queue.length) {
      const r = queue.shift(); if (seen.has(r)) continue; seen.add(r);
      const tm = /^#\/today\/(-?\d+)$/.exec(r); if (tm && (+tm[1] < -3 || +tm[1] > 10)) continue;
      if (editor(r)) { editorsSeen++; if (vp !== 'mac' && editorsSeen > 4) continue; if (vp === 'mac' && QUICK && editorsSeen > 12) continue; }
      if (process.env.DEBUG) console.log('visit', vp, r);
      await load(p, r); await p.waitForTimeout(editor(r) ? 900 : 350);
      const info = await pageCheck(p, vp, r, errs);
      info.links.forEach(h => { if (h.startsWith('#/')) { const n = norm(h); if (!queued.has(n)) { queued.add(n); queue.push(n); } } else if (/^https?:/.test(h)) ext.add(h); else if (h !== '#' && !h.startsWith('#sec')) bad(vp, r, 'odd link ' + h); });
      if (seen.size % 25 === 0) console.log(vp, 'visited', seen.size, 'queue', queue.length);
      const clickable = vp === 'mac' && (!editor(r) ? !/^#\/(today\/|learn\/.+\/\d+-\d+)/.test(r) || r === '#/today/1' : editorsSeen <= 3);
      const sp = r.split('/'); const fk = sp[1] + (sp[1] === 'learn' ? '/' + (sp[3] || '') + (sp[4] ? '/R' : '') : sp[1] === 'practice' ? '/' + (sp[2] || '') : '');
      fam[fk] = (fam[fk] || 0) + 1;
      if (clickable && fam[fk] <= 1) {
        /* click every button once, each from a fresh load of the page */
        const n = await p.$$eval('button', bs => bs.length);
        let checks = 0;
        for (let i = 0; i < Math.min(n, 24); i++) {
          await load(p, r); await p.waitForTimeout(200);
          const bs = await p.$$('button');
          if (!bs[i]) continue;
          const label = ((await bs[i].innerText()) || (await bs[i].getAttribute('aria-label')) || '').trim().slice(0, 40);
          if (/Update app/.test(label)) continue;
          if (process.env.DEBUG) console.log('  click', i, label);
          if (!(await bs[i].isVisible()) || !(await bs[i].isEnabled())) continue;
          if (/^Mark (not )?done/.test(label) && ++checks > 2) continue;
          try { await bs[i].click({ timeout: 2000 }); } catch (e) { bad(vp, r, 'cannot click "' + label + '": ' + e.message.split('\n')[0]); continue; }
          await p.waitForTimeout(250);
          const after = await p.evaluate(() => ({ t: (document.querySelector('.top .title b') || {}).textContent, scrim: !!document.querySelector('.scrim') }));
          if (after.t === 'Something went wrong') bad(vp, r, 'button "' + label + '" leads to error page');
          if (after.scrim) { const db = await p.$$('.scrim .dialog button'); if (!db.length) bad(vp, r, 'dialog without buttons after "' + label + '"'); await p.keyboard.press('Escape'); }
          errs.splice(0).forEach(e => bad(vp, r, 'after "' + label + '": ' + e.slice(0, 200)));
        }
      }
    }
    console.log(vp, 'screens visited:', seen.size);
    await ctx.close();
  }
  await b.close();
  console.log('external links:', ext.size);
  require('fs').writeFileSync('/tmp/data-architect-ext-links.txt', Array.from(ext).join('\n'));
  issues.forEach(i => console.log('ISSUE', i));
  console.log(issues.length + ' issues');
  process.exit(issues.length ? 1 : 0);
})();
