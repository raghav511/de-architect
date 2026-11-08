/* Data Architect · the daily set (F9, approved 2026-11-08). Each day Today holds the smallest set that touches every
   section of Learn, Practice and Interview: the next item of each section that has work, in program order. The set is
   chosen when the day starts and kept for the day (S.dayset[date].items, merged per date in mergeState); One more adds
   the next item of a section. Unfinished items carry to the next day, at most one carried item per section per day; the
   rest wait. XP decides what a day holds and when a module advances; minutes are shown only, never a limit.
   Loaded before app.js. */
'use strict';
const DAY_SECS = [
  ['learn', 'lesson', 'Lesson'], ['learn', 'lab', 'Lab'], ['learn', 'quiz', 'Quiz'], ['learn', 'reels', 'Reels'], ['learn', 'news', 'What is new'], ['learn', 'cc', 'Claude Code'],
  ['practice', 'coding', 'Coding'], ['practice', 'design', 'Design and build'], ['practice', 'sim', 'Simulator'], ['practice', 'git', 'Git and drills'],
  ['interview', 'live', 'Live mock'], ['interview', 'recall', 'Recall'], ['interview', 'loop', 'Loop drill'], ['interview', 'set', 'Interview set'], ['interview', 'rq', 'Company question'], ['interview', 'coach', 'Coach']];
const DAY_TABS = [['learn', 'Learn'], ['practice', 'Practice'], ['interview', 'Interview']];
const SEC_OF_KIND = { learn: 'lesson', build: 'lab', ai: 'lab', incident: 'lab', quiz: 'quiz', news: 'news', cc: 'cc', design: 'design', project: 'design', git: 'git', practice: 'git', talk: 'set' };
const DAY_BONUS = 20, DAY_CARRY = 1, DAY_BACK = 7;
const XP_X = { reels: 9, sim: 25, loop: 10, recall: 5, ivq: 5, rq: 5, coach: 10, cmp: 10, live1: 8 };

function dayState() { S.dayset = S.dayset || {}; return S.dayset; }
function daySize() { return S.settings.setSize === 'double' ? 2 : 1; }
/* the module whose reading comes next: sections never pick from a later module */
function dayCurIdx(sc) { const u = sc.units.find(x => !x.isDone && !isCC(x.mid) && x.kind === 'learn'); return u ? MODS.indexOf(u.mid) : MODS.length; }
function dayAdd(k, n) { const d = new Date(k + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); }
/* live mock by weekday: one question on weekdays, the full 5-question mock on Saturday, the 7-question boss round on Sunday */
function liveMode(k) { const g = new Date(k + 'T00:00:00').getDay(); return g === 0 ? 'boss' : g === 6 ? 'full' : 'one'; }

/* candidates of a section on day k, in order: { s, id } references */
function dayCands(sec, k, sc) {
  const ci = dayCurIdx(sc), out = [], R = (id) => out.push({ s: sec, id });
  const unitSec = Object.keys(SEC_OF_KIND).filter(x => SEC_OF_KIND[x] === sec);
  if (unitSec.length && sec !== 'set') {
    sc.units.forEach(u => {
      if (u.isDone || !unitSec.includes(u.kind)) return;
      if (sec === 'cc') { if (isCC(u.mid)) R(u.uid); return; }
      if (isCC(u.mid) || MODS.indexOf(u.mid) > ci) return;
      if (sec === 'quiz' && sc.units.some(x => x.mid === u.mid && x.kind === 'learn' && !x.isDone)) return; /* the quiz once the module's reading is done */
      R(u.uid);
    });
    if (sec === 'cc') { const g = new Date(k + 'T00:00:00').getDay(); if (g !== 3 && g !== 6) return []; } /* Claude Code keeps its Wednesday and Saturday pace */
    if (sec === 'design' && !out.length && ci < MODS.length && !isCC(MODS[ci])) R('cmp:' + k); /* no design or project step: a 15-minute comparison */
    return out;
  }
  if (sec === 'set') { /* one question at a time from the interview sets of modules already reached */
    for (const m of MODS.slice(0, Math.min(ci + 1, MODS.length))) { if (isCC(m)) continue; const s = DATA.sprints[m]; if (!s || !s.interview) continue; const st = (S.iv || {})[qk(m)] || {};
      s.interview.forEach((q, i) => { if (!st[i]) R('ivq:' + m + ':' + i); }); if (out.length >= 3) break; }
    return out;
  }
  if (sec === 'reels') { R('reels:' + k); return out; }
  if (sec === 'coding') { /* reviews due first, then the ladder in order: it moves on when you solve, not by date */
    (typeof revDue === 'function' ? revDue() : []).forEach(x => R('rev:' + x.id));
    for (let c = 0; c < 84 * 2 && out.length < 6; c++) dayProblems(c).forEach(x => { if (!x.auto) R(x.id); });
    return out;
  }
  if (sec === 'sim') { const x = typeof simTodayItem === 'function' ? simTodayItem(k) : null; if (x) R(x.id); return out; }
  if (sec === 'live') { R('live:' + k); return out; }
  if (sec === 'recall') { if (typeof recallItem === 'function' && recallItem()) R('recall:' + k); return out; }
  if (sec === 'loop') { if (typeof LOOP_DAY !== 'undefined') R('loop:' + LOOP_DAY[new Date(k + 'T00:00:00').getDay()][0] + ':' + k); return out; }
  if (sec === 'rq') { const cur = MODS[ci] || sc.cur; (typeof recentOpen === 'function' ? recentOpen() : []).sort((a, b) => (b.mid === cur) - (a.mid === cur) || (b.found || '').localeCompare(a.found || '')).forEach(q => R('rq:' + q.id)); return out; }
  if (sec === 'coach') { if (aiOn() && typeof coachData === 'function') { const c = coachData(); (c.focus || []).forEach((f, i) => { if (!focusDone(f, c)) R('coach' + i + ':' + (c.generated_at || '')); }); } return out; }
  return out;
}

/* a reference made live: { s, id, tab, unit | x, mins, xp, done } */
function dayItem(ref, k, sc) {
  const tab = (DAY_SECS.find(x => x[1] === ref.s) || [])[0]; if (!tab) return null;
  const id = ref.id, o = { s: ref.s, id, tab, carried: ref.c || '', more: !!ref.m };
  const u = sc.units.find(x => x.uid === id);
  if (u) return Object.assign(o, { unit: u, mins: u.mins, xp: XP_KIND[u.kind] || 10, done: !!u.isDone });
  let x = null;
  if (/^reels:/.test(id)) { const d = id.slice(6); x = { id, chip: 'core', t: 'Reels for today', sub: '3 reels on today\'s reading, each with a quick check', mins: 3, href: '#/reels', auto: Object.values(S.reels || {}).some(r => r && r.seen && r.seen >= d) }; o.xp = XP_X.reels; }
  else if (/^cmp:/.test(id)) { const d = id.slice(4), c = (S.cmp || {})[d]; x = { id, chip: 'arch', t: 'Compare: ' + cmpTitle(d), sub: 'When would you pick each one, and what would you give up?', mins: 15, href: '#/compare/' + d, auto: !!(c && c.done) }; o.xp = XP_X.cmp; }
  else if (/^live:/.test(id)) { const d = id.slice(5), mode = liveMode(d), lk = (S.live || {})[d], mk = (S.mock || {})[d];
    x = { id, chip: 'test', t: mode === 'one' ? 'Live question · ' + ['', 'concept', 'under the hood', 'architect\'s lens', 'staff level', 'recall'][new Date(d + 'T00:00:00').getDay()] : mode === 'full' ? 'Live mock · 5 questions' : 'Weekend boss · 7 questions', sub: 'Spoken or typed; ' + (aiOn() ? 'an AI interviewer follows up and scores it.' : 'you mark yourself against the model answer.'), mins: mode === 'one' ? 5 : mode === 'full' ? 20 : 35, href: '#/live/' + d, auto: !!((lk && lk.done) || (mk && mk.sub)) };
    o.xp = mode === 'one' ? XP_X.live1 : 40; }
  else if (/^recall:/.test(id)) { const r = typeof recallItem === 'function' ? recallItem() : null; x = r ? Object.assign({}, r, { id }) : { id, chip: 'talk', t: 'Recall', sub: 'Nothing due', mins: 5, href: '#/recall', auto: true }; o.xp = XP_X.recall; }
  else if (/^loop:/.test(id)) { const [, r, d] = id.split(':'), L = typeof loopState === 'function' ? loopState() : { reps: {} }, row = (typeof LOOP_DAY !== 'undefined' ? LOOP_DAY : []).find(z => z[0] === r) || [r, 'about', 'Practise round ' + r.slice(1)];
    x = { id, chip: 'talk', t: 'Interview loop: ' + row[2], sub: 'Round ' + r.slice(1) + ' · ' + ((typeof LOOP_R !== 'undefined' && LOOP_R[r]) || ''), mins: 10, href: '#/loop/' + r + '/' + row[1], auto: Object.entries(L.reps || {}).some(([dd, v]) => dd >= d && v && v[r]) }; o.xp = XP_X.loop; }
  else if (/^ivq:/.test(id)) { const [, m, i] = id.split(':'), s = DATA.sprints[m], q = s && s.interview && s.interview[+i]; if (!q) return null;
    x = { id, chip: q.TAG || 'talk', t: modLabel(m) + ': ' + q.Q.replace(/\*\*/g, '').slice(0, 90) + (q.Q.length > 90 ? '…' : ''), sub: 'Answer out loud, then tick it on the interview set', mins: 5, href: '#/interview/' + m, auto: !!(((S.iv || {})[qk(m)] || {})[+i]), lock: true }; o.xp = XP_X.ivq; }
  else if (/^rq:/.test(id)) { const q = ((DATA.recent || {}).items || []).find(z => 'rq:' + z.id === id); if (!q) return null;
    x = { id, chip: q.TAG || 'talk', t: q.company + ': ' + q.Q.replace(/\*\*/g, '').slice(0, 90) + (q.Q.length > 90 ? '…' : ''), sub: 'Found ' + shortDate(q.found), mins: 5, href: '#/recent', auto: !!(S.rq || {})[q.id], lock: true }; o.xp = XP_X.rq; }
  else if (/^coach\d+:/.test(id)) { const c = typeof coachData === 'function' ? coachData() : {}, i = +id.slice(5, id.indexOf(':')), f = (c.focus || [])[i]; if (!f) return null;
    x = { id, chip: 'ai', t: f.title, sub: 'From your coach' + (f.why ? ' · ' + f.why : ''), mins: Math.min(15, +f.mins || 10), href: /^#\//.test(f.href || '') ? f.href : '#/coach', auto: focusDone(f, c) }; o.xp = XP_X.coach; }
  else if (/^sim:/.test(id)) { const sid = id.slice(4), s = (typeof SIM_SC !== 'undefined' ? SIM_SC : []).find(z => z.id === sid); if (!s) return null; const dn = (simState().done || {})[sid];
    x = { id, chip: 'design', t: 'Simulator challenge: ' + s.t, sub: 'Build it, run traffic, break it and fix it until it passes · module ' + modLabel(s.mid), mins: 20, href: '#/sim/sc/' + sid, auto: !!dn }; o.xp = XP_X.sim; }
  else { /* a coding problem or a review */
    const rev = /^rev:/.test(id), pid = rev ? id.slice(4) : id, kind = kindOf(pid), p = (DATA[kind] || []).find(z => z.id === pid); if (!p) return null;
    x = { id, chip: kind, t: p.t, sub: (rev ? 'Review · ' : '') + ({ dsa: 'DSA', sql: 'SQL', spark: 'PySpark', py: 'Python' }[kind] || kind) + ' · ' + p.lv, mins: kind === 'dsa' ? 20 : 15, href: '#/' + kind + '/' + pid + (rev ? '/review' : ''), auto: rev ? !(S.rev && S.rev[pid] && S.rev[pid].due && S.rev[pid].due <= iso(new Date())) : !!S.solved[pid] };
    o.xp = (typeof XP_LV !== 'undefined' && XP_LV[p.lv]) || 15; }
  return Object.assign(o, { x, mins: x.mins, done: xDone(k, x) });
}

/* the day's references: chosen once for today (with at most one carried item per section), stored; other days are read back or previewed */
function dayRefs(k) {
  const st = dayState(), today = iso(new Date()), sc = schedule();
  if (st[k] && Array.isArray(st[k].items)) {
    /* a section that had no work when the day began (recall due later, a new company question, a coach item) joins once it has some; sections already in the set stay as chosen */
    if (k === today) { const have = new Set(st[k].items.map(r => r.s)); let add = 0; DAY_SECS.forEach(([, sec]) => { if (have.has(sec)) return; const c = dayCands(sec, k, sc)[0]; if (c) { st[k].items.push(c); add = 1; } }); if (add) save(false); }
    return st[k].items;
  }
  const refs = [];
  DAY_SECS.forEach(([, sec]) => {
    const picks = dayCands(sec, k, sc).slice(0, daySize());
    /* the oldest unfinished item of this section from earlier days carries, one per section; the rest wait */
    let carry = null;
    for (let i = DAY_BACK; i >= 1 && !carry; i--) { const d = dayAdd(k, -i), prev = st[d] && st[d].items; if (!prev) continue;
      prev.filter(r => r.s === sec && !picks.some(p => p.id === r.id)).forEach(r => { if (carry) return; const it = dayItem(r, k, sc); if (it && !it.done && !(sec === 'live' && !(S.live || {})[r.id.slice(5)])) carry = { s: sec, id: r.id, c: d }; }); }
    refs.push(...picks); if (carry && DAY_CARRY) refs.push(carry);
  });
  if (k === today) { st[k] = { items: refs, at: Date.now() }; save(false); }
  return refs;
}
function daySet(k) {
  const sc = schedule(), items = dayRefs(k).map(r => dayItem(r, k, sc)).filter(Boolean);
  const st = dayState()[k], full = items.length > 0 && items.every(x => x.done);
  if (full && st && !st.full && k === iso(new Date())) { st.full = Date.now(); save(false); if (typeof toast === 'function') toast('Daily set done: +' + DAY_BONUS + ' XP'); if (typeof gameNote === 'function') gameNote('day'); }
  return items;
}
/* One more: the next item of a section that is not in the day yet */
function dayMore(k, sec) {
  const st = dayState(); dayRefs(k); const have = new Set(st[k].items.map(r => r.id));
  const nx = dayCands(sec, k, schedule()).find(r => !have.has(r.id));
  if (!nx) { toast('Nothing more in ' + (DAY_SECS.find(x => x[1] === sec) || [, , sec])[2] + ' right now.'); return; }
  st[k].items.push(Object.assign(nx, { m: 1 })); save(); route();
}
/* XP the days give: the full-set bonus (counted in gameXP) */
function dayBonusXP() { return Object.values(S.dayset || {}).filter(d => d && d.full).length * DAY_BONUS; }
/* days whose full set was done (streak days from the first daily set on) */
function dayFullDays() { return Object.entries(S.dayset || {}).filter(([, d]) => d && d.full).map(([k]) => k); }
function dayFirst() { return Object.keys(S.dayset || {}).sort()[0] || null; }

/* ---------------- Compare: the small design item on days without a design or project step ---------------- */
function cmpKinds(k) {
  const sc = schedule(), ci = dayCurIdx(sc), mods = MODS.slice(0, ci + 1).reverse().concat(MODS.slice(ci + 1));
  const sc1 = typeof SIM_SC !== 'undefined' ? mods.map(m => SIM_SC.filter(x => x.mid === m)).find(a => a.length) || SIM_SC : [];
  const kinds = []; sc1.forEach(s => (s.nodes || []).forEach(n => { const kk = n[0], K = SIM_K[kk]; if (K && K.cat !== 'src' && !kinds.includes(kk)) kinds.push(kk); }));
  const pool = kinds.length >= 2 ? kinds : Object.keys(SIM_K).filter(x => SIM_K[x].cat !== 'src');
  let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) | 0; h = Math.abs(h);
  const out = []; for (let i = 0; out.length < Math.min(3, pool.length) && i < pool.length * 2; i++) { const x = pool[(h + i * 7) % pool.length]; if (!out.includes(x)) out.push(x); }
  return out;
}
function cmpTitle(k) { const c = (S.cmp || {})[k], ks = (c && c.ks) || (typeof SIM_K !== 'undefined' ? cmpKinds(k) : []); return ks.map(x => (SIM_K[x] || {}).t || x).join(', '); }
function vCompare(k) {
  k = /^\d{4}-\d\d-\d\d$/.test(k || '') ? k : iso(new Date());
  S.cmp = S.cmp || {}; const c = S.cmp[k] = S.cmp[k] || { ks: cmpKinds(k), t: '', at: 0 };
  const ta = el('textarea', { class: 'code', 'aria-label': 'When would you pick each one, and what would you give up?', style: { minHeight: '160px', border: '1px solid var(--line2)', borderRadius: '10px', fontFamily: 'var(--body)', fontSize: '16px' }, placeholder: 'Pick each for… because… you give up…' });
  ta.value = c.t || '';
  const note = el('span', { class: 'muted', role: 'status', style: { fontSize: '14px' } });
  const paint = () => { note.textContent = c.done ? 'Done for today. It counts towards your Practice set (+' + XP_X.cmp + ' XP).' : 'Write at least two sentences (about 80 characters) to finish it.'; };
  ta.addEventListener('input', () => { c.t = ta.value; c.at = Date.now(); const was = c.done; c.done = c.t.trim().length >= 80 ? (c.done || iso(new Date())) : 0; save(); if (!!was !== !!c.done) paint(); });
  paint();
  shell('Compare components', 'Practice · Design and build · about 15 minutes', [
    el('section', { class: 'card pad stack' }, [el('p', { style: { margin: 0 }, text: 'Today has no design or project step, so compare the parts you would choose between in an interview: what each is for, what it costs, and when you would not use it.' })]),
    el('div', { class: 'grid2' }, c.ks.map(x => { const K = SIM_K[x] || {}; return el('section', { class: 'card pad stack', style: { gap: '4px' } }, [el('b', { text: K.t || x }), el('span', { style: { fontSize: '14.5px' }, text: K.d || '' }),
      el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: [K.cap ? 'about ' + K.cap.toLocaleString() + ' a second per box' : '', K.lat ? K.lat + ' ms' : '', K.cost ? '$' + K.cost + ' a month per box in the simulator' : ''].filter(Boolean).join(' · ') })]); })),
    el('section', { class: 'card pad stack' }, [el('b', { text: 'When would you pick each one, and what would you give up?' }), ta, note,
      el('div', { class: 'row wrap', style: { gap: '10px' } }, [el('a', { class: 'btn', href: '#/sim', text: 'Try them in the simulator' }), el('a', { class: 'btn', href: '#/today', text: 'Back to Today' })])])], { back: '#/today' });
}
