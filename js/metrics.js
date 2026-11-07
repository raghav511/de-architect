/* Data Architect · usage metrics for the morning suggestions (tools/insights). Small daily totals only: screens opened
   and seconds spent, how fast each screen draws, reels opened, finished and skipped, checks right and wrong, steps,
   solves, warm-ups, mocks and errors. Kept in S.metrics[date] for the last 7 days, synced with your own progress and
   never written to the public repository. No text you type is recorded. Loaded before app.js. */
'use strict';
function mDay() { const k = iso(new Date()); S.metrics = S.metrics || {}; return S.metrics[k] = S.metrics[k] || { screens: {}, perf: {}, ev: {} }; }
function mEvent(name, n) { try { const m = mDay(); m.ev[name] = (m.ev[name] || 0) + (n || 1); } catch (e) { } }
let mScreen = null, mT0 = 0;
function mLeave() { if (!mScreen) return; const m = mDay(), s = m.screens[mScreen] = m.screens[mScreen] || { n: 0, secs: 0 }; s.secs += Math.min(1800, Math.round((Date.now() - mT0) / 1000)); mScreen = null; }
function mRoute(r) {
  try {
    mLeave(); mScreen = r; mT0 = Date.now();
    const m = mDay(); (m.screens[r] = m.screens[r] || { n: 0, secs: 0 }).n++;
    const t0 = performance.now();
    requestAnimationFrame(() => requestAnimationFrame(() => { const p = m.perf[r] = m.perf[r] || [0, 0]; p[0] += Math.round(performance.now() - t0); p[1]++; }));
    const keep = iso(new Date(Date.now() - 7 * 864e5)); Object.keys(S.metrics).forEach(k => { if (k < keep) delete S.metrics[k]; });
  } catch (e) { }
}
window.addEventListener('error', () => mEvent('error'));
window.addEventListener('unhandledrejection', () => mEvent('error'));
document.addEventListener('visibilitychange', () => { if (document.hidden) { mLeave(); try { save(false); } catch (e) { } } else if (!mScreen) { mScreen = (location.hash.replace(/^#\/?/, '').split('/')[0] || 'today'); mT0 = Date.now(); } });
