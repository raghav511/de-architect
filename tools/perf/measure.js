/* Speed baseline: what the learner waits for, on a mid-range phone.
   node tools/perf/measure.js BASE [--engine chromium|webkit] [--runs 3] [--only load,actions,memory] [--swipe-min 5] [--out file.json]
   Profiles: chromium = Pixel 5 with 4x CPU slowdown; webkit = iPhone 13 (Playwright cannot slow WebKit's CPU).
   Both get Fast 4G (150 ms round trip, 9 Mbps down, 1.5 Mbps up) from tools/perf/net.js, service worker requests included.
   A local BASE (127.0.0.1 or localhost) is reached through a shaped port in front of it; its Google Fonts come from a copy fetched once. Every number is the median of --runs.
   Fresh learner each run (empty storage); the sync server and the grader are blocked. */
const pw = require(process.env.PW || 'playwright');
const { startNet } = require('./net');
const fs = require('fs');
const args = process.argv.slice(2), arg = (k, d) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const BASE0 = (args.find(a => /^http/.test(a)) || 'http://127.0.0.1:8844/').replace(/\/?$/, '/');
const ENGINES = arg('--engine') ? [arg('--engine')] : ['chromium', 'webkit'];
const RUNS = +arg('--runs', 3), ONLY = arg('--only', 'load,actions,memory').split(','), SWIPE_MIN = +arg('--swipe-min', 5);
const med = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const within = (pr, ms) => Promise.race([pr.catch(() => {}), new Promise(r => setTimeout(r, ms))]); /* a step that hangs never stalls the whole run */
const UPNEXT = '.upnext .unit a.btn.pri';
const kind = u => { const p = new URL(u).pathname; return /\.js$/.test(p) ? 'js' : /\.css$/.test(p) ? 'css' : /\/data\/reels\.json$/.test(p) ? 'reels' : /\/data\/|\.json$|\.txt$/.test(p) ? 'data' : /fonts\.g/.test(u) ? 'fonts' : 'other'; };

async function main() {
  const n = await startNet({});
  const local = /^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE0);
  const BASE = local ? BASE0.replace(/:\/\/[^/]+/, '://127.0.0.1:' + await n.front(+new URL(BASE0).port || 80)) : BASE0;
  /* local runs measure the app, not today's internet: Google Fonts (render-blocking) come from a copy fetched once, delayed as Fast 4G would */
  const fontCopy = {};
  const fonts = async r => { const u = r.request().url(); try { const f = fontCopy[u] = fontCopy[u] || await r.fetch().then(async x => ({ status: x.status(), headers: x.headers(), body: await x.body() })); await new Promise(z => setTimeout(z, 150 + f.body.length * 8 / 9e3)); await r.fulfill(f); } catch (e) { await r.abort().catch(() => {}); } };
  const res = { base: BASE0, at: new Date().toISOString(), net: 'Fast 4G: 150 ms RTT, 9 Mbps down, 1.5 Mbps up', runs: RUNS, engines: {} };
  for (const engine of ENGINES) {
    /* the shaped local port must not go through the proxy too (shaped twice); WebKit skips loopback by itself, Chromium only with this list */
    const b = await pw[engine].launch({ proxy: Object.assign({ server: 'http://127.0.0.1:' + n.port }, engine === 'chromium' ? { bypass: '<-loopback>,127.0.0.1' } : {}) });
    const dev = engine === 'webkit' ? pw.devices['iPhone 13'] : pw.devices['Pixel 5'];
    const ctx = async () => { const c = await b.newContext(Object.assign({}, dev)); await c.route(/127\.0\.0\.1:8765|script\.google\.com/, r => r.abort()); if (local) await c.route(/fonts\.(googleapis|gstatic)\.com/, fonts); return c; };
    const slow = async p => { if (engine !== 'chromium') return; const s = await p.context().newCDPSession(p); await s.send('Emulation.setCPUThrottlingRate', { rate: 4 }); return s; };
    /* the time from navigation start until Up next can be tapped (visible and enabled), measured in the page */
    const usable = p => p.waitForFunction(sel => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? Math.round(performance.now()) : false; }, UPNEXT, { polling: 'raf', timeout: 120000 }).then(h => h.jsonValue(), async e => { console.log('NOT USABLE after 120 s:', JSON.stringify(await p.evaluate(() => ({ booted: typeof booted !== 'undefined' && booted, root: (document.querySelector('#root') || {}).innerText.slice(0, 120), pending: performance.getEntriesByType('resource').filter(x => !x.responseEnd).map(x => x.name) })).catch(x => x.message))); return null; });
    const E = res.engines[engine] = {};
    const quiet = async () => { let last = -1, still = 0; for (let t = 0; t < 180 && still < 3; t++) { await new Promise(r => setTimeout(r, 1000)); const now = n.bytes(); still = now === last ? still + 1 : 0; last = now; } }; /* no bytes on the wire for 3 s */
    if (ONLY.includes('load')) {
      const L = { cold: [], warm: [], coldLoad: [], warmLoad: [], bytes: [] };
      for (let i = 0; i < RUNS; i++) {
        const c = await ctx(), p = await c.newPage(); await slow(p);
        const by = {}; p.on('response', async r => { try { const k = kind(r.url()); const h = await r.allHeaders(); const l = +(h['content-length'] || 0) || (await r.body().catch(() => Buffer.alloc(0))).length; if (!r.fromServiceWorker()) by[k] = (by[k] || 0) + l; } catch (e) { } });
        const b0 = n.bytes();
        await p.goto(BASE + '#/today', { waitUntil: 'commit' }); L.cold.push(await usable(p)); L.coldLoad.push(await p.evaluate(() => Math.round(performance.getEntriesByType('navigation')[0].loadEventEnd || performance.now())));
        /* the background downloads (reels, the service worker's offline copy) finish before the warm load */
        await within(p.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready), 60000); await within(p.evaluate(() => DATA.reelsP), 60000); await quiet();
        if (i === 0) { E.wire_kb = Math.round((n.bytes() - b0) / 1024); E.first_visit_kb = Object.fromEntries(Object.entries(by).map(([k, v]) => [k, Math.round(v / 1024)])); }
        await p.reload({ waitUntil: 'commit' }); L.warm.push(await usable(p)); L.warmLoad.push(await p.evaluate(() => Math.round(performance.getEntriesByType('navigation')[0].loadEventEnd || performance.now())));
        await c.close();
        console.log(new Date().toISOString().slice(11, 19), engine, 'load run', i + 1, 'cold', L.cold[i], 'warm', L.warm[i]);
      }
      Object.assign(E, { today_usable_cold_ms: med(L.cold), today_usable_warm_ms: med(L.warm), load_event_cold_ms: med(L.coldLoad), load_event_warm_ms: med(L.warmLoad), raw_load: L });
    }
    if (ONLY.includes('actions')) {
      const A = {};
      const put = (k, v) => (A[k] = A[k] || []).push(v);
      for (let i = 0; i < RUNS; i++) {
        const c = await ctx(), p = await c.newPage();
        await p.goto(BASE + '#/today'); await usable(p); await within(p.evaluate(() => DATA.reelsP), 60000); await p.waitForTimeout(1500);
        await slow(p);
        /* each action: start the clock in the page, do it, stop when what the learner waits for is on screen */
        const act = (go, sel) => p.evaluate(async ([go, sel]) => { const t = performance.now(); (new Function(go))(); for (;;) { await new Promise(r => requestAnimationFrame(r)); const e = document.querySelector(sel); if (e && e.getBoundingClientRect().height > 0) return Math.round(performance.now() - t); if (performance.now() - t > 60000) return null; } }, [go, sel]);
        put('switch_today_tab', await act("document.querySelector('#tab-grp-coding').click()", '#tab-grp-coding[aria-selected=true]'));
        put('open_reels_first_slide', await act("location.hash='#/reels'", '.rslide .rcap, .rslide .rstart'));
        put('open_module_chapter', await act("location.hash='#/learn/s05'", '#page .prose h2'));
        put('open_profile', await act("location.hash='#/profile'", '#pt_look'));
        put('open_simulator', await act("location.hash='#/design/s10'", '.simmod .simsc'));
        put('open_sim_challenge', await act("document.querySelector('.simmod .simsc').click()", '#sim_check'));
        put('run_simulator', await act("document.querySelector('#sim_check').click()", '.simresult .item'));
        put('back_to_today', await act("location.hash='#/today'", UPNEXT));
        await c.close();
        console.log(engine, 'actions run', i + 1, JSON.stringify(Object.fromEntries(Object.entries(A).map(([k, v]) => [k, v[i]]))));
      }
      E.actions_ms = Object.fromEntries(Object.entries(A).map(([k, v]) => [k, med(v)])); E.raw_actions = A;
    }
    if (ONLY.includes('memory') && engine === 'chromium') { /* WebKit has no heap figure for pages */
      const c = await ctx(), p = await c.newPage(); const s = await c.newCDPSession(p);
      await p.goto(BASE + '#/today'); await usable(p); await within(p.evaluate(() => DATA.reelsP), 60000);
      await p.evaluate(() => { location.hash = '#/reels'; }); await p.waitForSelector('.rslide .rstart, .rslide .rcap');
      const heap = async () => { await s.send('HeapProfiler.collectGarbage'); const m = (await s.send('Performance.getMetrics')).metrics.reduce((o, x) => (o[x.name] = x.value, o), {}); return { heap_mb: +(m.JSHeapUsedSize / 1048576).toFixed(1), nodes: m.Nodes, listeners: m.JSEventListeners }; };
      await s.send('Performance.enable'); const m0 = await heap(); const t0 = Date.now(); let swipes = 0; const trail = [];
      await p.click('.rstart').catch(() => {});
      while (Date.now() - t0 < SWIPE_MIN * 60000) { await p.keyboard.press('ArrowDown'); swipes++; await p.waitForTimeout(3000); if (swipes % 20 === 0) trail.push(Object.assign({ swipes }, await heap())); }
      E.memory = { after_load: m0, after_swipes: await heap(), swipes, minutes: SWIPE_MIN, trail };
      console.log(engine, 'memory', JSON.stringify(E.memory));
      await c.close();
    }
    await b.close();
  }
  await n.close();
  const out = arg('--out'); if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, (k, v) => /^raw_|trail/.test(k) ? undefined : v, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
