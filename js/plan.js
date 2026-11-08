/* Data Architect 1.5 · modules, units and the time-boxed scheduler.
   Loaded before app.js; uses its globals (S, DATA, el, svg, I, shell, chip, save, iso, ...) at call time. */
'use strict';
/* Diagnostic first, then the Python track interleaved with the AI modules, then data modelling, then data engineering. */
const BASE_MODS = ['s00', 'p01', 'p02', 'a01', 'p03', 'p04', 'a02', 'p05', 'p06', 'a03', 'm01', 'm02', 'm03', 's01', 's02', 's03', 's04', 'a04', 'd01', 's05', 's06', 'a05', 'a06', 's07', 'j01', 's08', 's09', 's10', 'o01', 'o02', 'o03', 'r01', 's11', 's12'];
/* Claude Code and AI-at-work track: runs alongside the main path, inside the daily hour, spread so it lasts about as long as the main path */
const CC_MODS = ['c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08', 'c09', 'c10', 'c11', 'c12'];
const CC_PACE = { 1: { 6: 1 }, 2: { 3: 1, 6: 1 }, 3: { 3: 1, 6: 2 } }; /* steps per week -> steps per getDay(): Saturday first, then Wednesday */
const isCC = m => /^c\d\d$/.test(m);
let MODS = BASE_MODS.concat(CC_MODS), MODS_ALL = MODS.slice();
function applyAi() { MODS = MODS_ALL.filter(m => !isCC(m) || aiOn()); } /* AI features off: the Claude Code track leaves the plan */
const MOD = {};
const DN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const midOf = x => { x = String(x == null ? '' : x); return /^\d+$/.test(x) ? 's' + x.padStart(2, '0') : x; };
const isS = m => /^s\d\d$/.test(m);
const qk = m => isS(m) ? +m.slice(1) : m; /* state keys stay compatible with v1.1 (numbers for DE modules) */
function modLabel(m) { const k = m[0], n = +m.slice(1); return k === 'c' ? 'Claude Code ' + n : k === 'a' ? 'AI ' + n : k === 'p' ? 'Python ' + n : k === 'm' ? 'Modelling ' + n : k === 'j' ? 'Platform ' + n : k === 'd' ? 'Systems ' + n : k === 'r' ? 'Leadership ' + n : k === 'o' ? 'Org ' + n : k === 's' ? (n === 0 ? 'Setup' : 'DE ' + n) : 'Extra ' + n; }
function modTitle(m) { return (MOD[m] && MOD[m].title) || modLabel(m); }
function modColor(m) { return m[0] === 'a' || m[0] === 'c' ? 'c-ai' : m[0] === 'p' ? 'c-py' : m[0] === 'm' || m[0] === 'r' || m[0] === 'o' ? 'c-arch' : m[0] === 'j' || m[0] === 'd' ? 'c-core' : m[0] === 's' ? 'c-core' : 'c-arch'; }
function dayName(k) { const d = new Date(k + 'T00:00:00'); return DN[(d.getDay() + 6) % 7]; }
function shortDate(k) { const d = new Date(k + 'T00:00:00'); return DN[(d.getDay() + 6) % 7].slice(0, 3) + ' ' + d.getDate() + ' ' + d.toLocaleString('en', { month: 'short' }); }
function weekOf(k) { const s = new Date(S.start + 'T00:00:00'), d = new Date(k + 'T00:00:00'); return Math.max(1, Math.floor(Math.round((d - s) / 864e5) / 7) + 1); }
/* F9: no daily limit. The scheduler still lays steps on dates, but only as a forecast for Path and module dates, at your pace:
   the minutes of steps you finished over the last 14 days, per day (30 to 240, 60 until there is a week of history) */
let PACE = null, PACE_KEY = '';
function capOf(d) {
  const key = iso(new Date()) + '|' + Object.keys(S.doneAt || {}).length;
  if (PACE_KEY !== key) { PACE_KEY = key; const since = Date.now() - 14 * 864e5, mins = {}; (typeof modUnits === 'function' && DATA.sprints ? [].concat(...MODS.map(m => DATA.sprints[m] ? modUnits(m) : [])) : []).forEach(u => { mins[u.uid] = u.mins; });
    const done = Object.entries(S.doneAt || {}).filter(([, t]) => t >= since), sum = done.reduce((a, [id]) => a + (mins[id] || 0), 0);
    PACE = done.length >= 5 ? Math.max(30, Math.min(240, Math.round(sum / 14))) : 60; }
  return PACE;
}

/* ---------- module files ---------- */
function headings(text) { const out = []; let fence = false; (text || '').split('\n').forEach(l => { if (/^```/.test(l)) fence = !fence; else if (!fence && /^## /.test(l)) out.push(l.slice(3).trim()); }); return out; }
function sliceH2(text, a, b) {
  const out = []; let idx = -1, fence = false;
  (text || '').split('\n').forEach(l => { if (/^```/.test(l)) fence = !fence; else if (!fence && /^## /.test(l)) idx++; if ((idx >= a && idx <= b) || (idx === -1 && a === 0)) out.push(l); });
  return out.join('\n');
}
function parseTickets(t) { return (t || '').split('\n').map(l => l.split('|').map(x => x.trim())).filter(p => p.length >= 6 && p[0]).map(p => ({ id: p[0], type: p[1], h: +p[2] || 0.5, title: p[3], done: p[4], tab: p[5] })); }
async function loadModules() {
  const opt = u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null);
  const core = BASE_MODS.concat(CC_MODS), coreP = Promise.all(core.map(m => sprint(m).catch(() => null))); /* module files download alongside the small data files */
  const [ext, design, git, news, recent] = await Promise.all([opt('data/extensions.json'), opt('data/design.json'), opt('data/git.json'), opt('data/news.json'), opt('data/recent.json')]);
  DATA.design = design || {}; DATA.git = git || []; DATA.news = news || { items: [] };
  DATA.recent = recent && Array.isArray(recent.items) ? recent : { items: [] };
  MODS = core.concat(((ext && ext.modules) || []).filter(m => /^x\d\d$/.test(m)));
  await coreP; await Promise.all(MODS.filter(m => !core.includes(m)).map(m => sprint(m).catch(() => null)));
  MODS = MODS.filter(m => DATA.sprints[m]); MODS_ALL = MODS.slice(); applyAi();
  MODS.forEach(m => { const s = DATA.sprints[m]; MOD[m] = { id: m, title: s.meta.title || modLabel(m), goal: s.meta.goal || '', tickets: parseTickets(s.raw.tickets), ch: headings(s.raw.chapter), lab: headings(s.raw.lab), pr: headings(s.raw.practice), coding: s.coding.length }; });
}
function bestH2(list, title) {
  const w = s => (s.toLowerCase().match(/[a-z0-9]{4,}/g) || []).filter(x => !['your', 'with', 'from', 'that', 'this', 'hour', 'hours', 'minutes'].includes(x));
  const tw = w(title); let best = -1, sc = 0;
  list.forEach((h, i) => { const hw = w(h); const n = tw.filter(x => hw.includes(x)).length; const lab = /lab\s*(\d+)/i.exec(title), hl = /lab\s*(\d+)/i.exec(h); const bonus = lab && hl && lab[1] === hl[1] ? 5 : 0; if (n + bonus > sc) { sc = n + bonus; best = i; } });
  return best;
}

/* ---------- units: everything you do inside the daily hour ---------- */
const UNIT_CACHE = {};
function modUnits(m) {
  const M = MOD[m]; if (!M) return [];
  const U = [], pj = DATA.projects.find(p => p.mod === m);
  const add = o => U.push(Object.assign({ mid: m, links: [] }, o));
  M.tickets.forEach(t => {
    const mins = Math.round(t.h * 60);
    if (t.tab === 'coding') return; /* coding tests live in the coding track */
    if (t.tab === 'cc') {
      /* Claude Code tests: tasks you do in the terminal, then paste for an instant grade; done when every task scores 4 or 5 */
      const n = (DATA.sprints[m].tasks || []).length, ok = i => { const g = (S.grades || {})['cc:' + m + ':' + i]; return g && g.s === 'done' && g.r && g.r.score >= 4; };
      const nx = Array.from({ length: n }, (_, i) => i).find(i => !ok(i));
      add({ uid: m + ':' + t.id, kind: 'cc', mins: Math.min(60, mins), title: t.title, goal: (DATA.sprints[m].tasks || []).map(x => x.TITLE).join(' · '), done: t.done, href: '#/cc/' + m + '/' + ((nx == null ? 0 : nx) + 1), cta: 'Start', auto: () => n > 0 && Array.from({ length: n }, (_, i) => i).every(ok) });
      return;
    }
    const ex = /^(py|sql|spark):(\d+)-(\d+)$/.exec(t.tab);
    if (ex) {
      /* Python and SQL exercises run in the browser editor; the step ticks itself when all of them pass */
      const k = ex[1], xs = DATA[k].filter(x => x.m === m).slice(+ex[2] - 1, +ex[3]), nx = xs.find(x => !S.solved[x.id]) || xs[0];
      add({ uid: m + ':' + t.id, src: xs.map(x => x.p + JSON.stringify(x.tests || '')).join('|'), kind: 'build', mins: Math.min(60, mins), title: t.title, goal: 'Exercises: ' + xs.map(x => x.t).join(' · ') + '. Each one runs real tests in your browser.', done: t.done, href: nx ? '#/' + k + '/' + nx.id : '#/practice/' + (k === 'py' ? 'py' : 'model'), cta: 'Code', auto: () => xs.length > 0 && xs.every(x => S.solved[x.id]) });
      return;
    }
    if (t.tab.startsWith('chapter')) {
      const r = /chapter:(\d+)-(\d+)/.exec(t.tab), nH = Math.max(1, M.ch.length);
      let ranges;
      if (r) ranges = [[+r[1], +r[2]]];
      else { const p = Math.min(Math.max(1, Math.ceil(mins / 45)), nH); ranges = []; for (let k = 0; k < p; k++) ranges.push([Math.floor(k * nH / p), Math.floor((k + 1) * nH / p) - 1]); }
      ranges.forEach((rg, k) => add({ uid: m + ':' + t.id + (ranges.length > 1 ? '.' + (k + 1) : ''), src: sliceH2(DATA.sprints[m].raw.chapter, rg[0], rg[1]), kind: 'learn', mins: Math.round(mins / ranges.length), title: ranges.length > 1 ? 'Chapter ' + (isS(m) ? +m.slice(1) + ' ' : '') + 'part ' + (k + 1) + ' of ' + ranges.length : t.title, goal: 'Read: ' + M.ch.slice(rg[0], rg[1] + 1).join(' · '), done: t.done, href: '#/learn/' + m + '/chapter/' + rg[0] + '-' + rg[1], cta: 'Read' }));
    } else if (t.tab === 'lab') {
      const k = bestH2(M.lab, t.title), n = Math.max(1, Math.ceil(mins / 60));
      for (let i = 0; i < n; i++) add({ uid: m + ':' + t.id + (n > 1 ? '.' + (i + 1) : ''), src: k >= 0 ? sliceH2(DATA.sprints[m].raw.lab, k, k) : '', kind: t.type === 'ai' ? 'ai' : t.type === 'incident' ? 'incident' : 'build', mins: Math.round(mins / n), title: t.title + (n > 1 ? ' · session ' + (i + 1) + ' of ' + n : ''), goal: (k >= 0 ? 'Lab: ' + M.lab[k] + '. ' : '') + (n > 1 ? (i === 0 ? 'Read the whole lab first, then start the steps.' : 'Pick up where your notes say you stopped.') : 'Follow the lab steps in order.'), done: n > 1 && i < n - 1 ? 'You stop at a working checkpoint and write one line in notes/progress.md saying where you are.' : t.done, href: '#/learn/' + m + '/lab' + (k >= 0 ? '/' + k + '-' + k : ''), cta: 'Open lab', links: pj && pj.env === 'ai' ? [['Project and environment', '#/project/' + pj.id]] : [] });
    } else if (t.tab === 'practice') add({ uid: m + ':' + t.id, kind: 'practice', mins: Math.min(mins, 30), title: t.title, goal: (M.pr.length ? 'Warm-ups: ' + M.pr.join(' · ') + '. ' : '') + (mins > 30 ? 'The SQL and DSA warm-ups also count toward the coding track, so only the drill sits in this hour.' : ''), done: t.done, href: '#/learn/' + m + '/practice', cta: 'Practise' });
    else if (t.tab === 'quiz') add({ uid: m + ':' + t.id, src: DATA.sprints[m].raw.quiz || '', kind: 'quiz', mins: Math.max(20, mins), title: t.title, goal: 'Multiple choice, fill in the blank and short answers on this module. No notes.', done: t.done, href: '#/quiz/' + m, cta: 'Start', auto: () => S.quiz[qk(m)] && S.quiz[qk(m)].sub });
    else if (t.tab === 'mock') { const n = Math.max(1, Math.ceil(mins / 60)); for (let i = 0; i < n; i++) add({ uid: m + ':' + t.id + '.' + (i + 1), kind: 'talk', mins: Math.round(mins / n), title: t.title + ' · session ' + (i + 1) + ' of ' + n, goal: 'One full mock loop under time, then score it with the rubric and write one repair action.', done: i === n - 1 ? t.done : 'One loop done and scored, with a repair action written down.', href: '#/interview/' + m + '/mock', cta: 'Open mock' }); }
    else if (t.tab === 'interview') add({ uid: m + ':' + t.id, src: (DATA.sprints[m].raw.interview || '') + recentFor(m).map(q => '|' + q.id).join(''), kind: 'talk', mins: Math.min(60, mins), title: t.title, goal: 'Answer each question out loud first, then open the model answer and tick the ones you nailed.', done: t.done, href: '#/interview/' + m, cta: 'Practise' });
    else add({ uid: m + ':' + t.id, kind: 'learn', mins: Math.min(60, mins), title: t.title, goal: '', done: t.done, href: '#/learn/' + m + '/chapter', cta: 'Open' });
  });
  const lastLearn = U.map(u => u.kind).lastIndexOf('learn');
  const learn = U.filter(u => u.kind === 'learn'); if (learn.length) learn[learn.length - 1].links.push(['Readings', '#/learn/' + m + '/readings']);
  if (isCC(m)) return U; /* no Git, news or design steps inside the Claude Code track */
  const g = DATA.git.length ? DATA.git[MODS.indexOf(m) % DATA.git.length] : null;
  if (g) U.splice(lastLearn + 1, 0, { mid: m, uid: m + ':git', kind: 'git', mins: 20, title: 'Git ' + g.n + ': ' + g.title, goal: g.why.replace(/`/g, ''), done: 'Check my fix in the in-app terminal passes every line.', href: '#/git/' + g.n, cta: 'Open', links: [['Terminal', '#/terminal/git/' + g.n]], auto: () => !!(S.gitlab || {})[g.n] });
  const D = DATA.design[m], qi = U.findIndex(u => u.kind === 'quiz'), at = qi < 0 ? U.length : qi;
  const extra = [];
  if (D) extra.push({ mid: m, uid: m + ':design', kind: 'design', mins: 40, title: 'Design problem: ' + D.title, goal: D.prompt, done: D.deliverable, href: '#/design/' + m, cta: 'Design', links: [] });
  extra.push({ mid: m, uid: m + ':news', kind: 'news', mins: 15, title: 'What is new in AI this week', goal: (DATA.news.items[0] ? DATA.news.items.slice(0, 3).map(x => x.title).join(' · ') : 'Short items on new AI developments, each with how to test the claim.'), done: 'You can say in two sentences what changed and how you would test it on your own eval set.', href: '#/news', cta: 'Read', links: [] });
  U.splice(at, 0, ...extra, ...(typeof stepUnits === 'function' ? stepUnits(m) : [])); /* integrated week steps (js/steps.js) just before the quiz */
  if (pj && pj.env !== 'ai') {
    if (pj.status === 'ready') [1, 2].forEach(i => U.push({ mid: m, uid: m + ':proj.' + i, kind: 'project', mins: 60, title: 'Project: ' + pj.title + ' · session ' + i + ' of 2', goal: pj.goal, done: i === 2 ? 'make check passes for this week\'s milestones and you pasted the code into the project page.' : 'The environment is up and the first milestone passes.', href: '#/project/' + pj.id, cta: 'Build', links: [], auto: () => (pj.ms || []).length && pj.ms.every(x => msDone(pj.id)[x[0]]) }));
    else U.push({ mid: m, uid: m + ':proj', kind: 'project', mins: 30, title: 'Project brief: ' + pj.title, goal: pj.goal, done: 'You wrote the architecture in five boxes and listed the three riskiest parts. The full environment comes in a later update.', href: '#/project/' + pj.id, cta: 'Read', links: [] });
  }
  return U;
}
function doneDate(u) { const v = S.done[u.uid]; if (typeof v === 'string') return v; if (v) return '0000-00-00'; return u.auto && u.auto() ? '0000-00-00' : null; }
/* the schedule is computed once per screen and per change: route() and save() clear the cache (schedFlush) */
let SCHED = null, SCHED_DAY = '';
function schedFlush() { SCHED = null; }
function schedule() {
  /* the key also covers ticks and plan settings changed without save(), so a stale plan is never shown */
  const st = S.settings || {}, day = iso(new Date()) + '|' + S.start + '|' + S.since + '|' + st.capWd + '|' + st.capWe + '|' + st.buildWd + '|' + st.buildWe + '|' + JSON.stringify(S.done || {}) + '|' + Object.keys(S.doneAt || {}).length + '|' + JSON.stringify(S.quiz || {}).length + '|' + Object.keys(S.solved || {}).length + '|' + MODS.length;
  if (SCHED && SCHED_DAY === day) return SCHED;
  SCHED_DAY = day; return (SCHED = scheduleNow());
}
function scheduleNow() {
  const units = [].concat(...MODS.map(modUnits));
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const byDay = {}, used = {}, bused = {}; /* reading minutes and Design and build minutes are counted apart */
  const put = (k, u) => { (byDay[k] = byDay[k] || []).push(u); const c = isBuild(u) ? bused : used; c[k] = (c[k] || 0) + u.mins; u.day = k; };
  units.forEach(u => { const d = doneDate(u); u.isDone = !!d; if (d) put(d, u); });
  if (S.cv && S.cv.units) units.forEach(u => { if (u.isDone && !S.cv.units[u.uid] && tracked(u)) S.cv.units[u.uid] = unitHash(u); }); /* remember which version you finished */
  const cur = new Date(t), q = units.filter(u => !u.isDone && !isCC(u.mid) && !isBuild(u)), bq = units.filter(u => !u.isDone && isBuild(u)), cq = units.filter(u => !u.isDone && isCC(u.mid)); let guard = 0;
  const ccDay = {}; units.forEach(u => { if (u.isDone && isCC(u.mid) && u.day) ccDay[u.day] = (ccDay[u.day] || 0) + 1; });
  /* Claude Code pace: enough steps a week to finish around when the main path does (1 to 3 a week) */
  const wk = 5 * capOf(new Date(2026, 0, 5)) + 2 * capOf(new Date(2026, 0, 3)), sum = a => a.reduce((x, u) => x + u.mins, 0);
  const quota = CC_PACE[Math.min(3, Math.max(1, Math.ceil(cq.length / Math.max(1, (sum(q) + sum(cq)) / wk))))];
  /* pack in order; when the next step does not fit, a short Git or news step from the same module may fill the gap.
     Claude Code steps go first on their days, so the track runs every week alongside the main path */
  while ((q.length || cq.length) && guard++ < 6000) {
    const k = iso(cur);
    if (q.length && q[0].ccSwap && cq.length) { cq.unshift(q.shift()); continue; } /* a module's With AI step (js/steps.js) takes the next Claude Code slot */
    if (cq.length && (ccDay[k] || 0) < (quota[cur.getDay()] || 0)) { put(k, cq.shift()); ccDay[k] = (ccDay[k] || 0) + 1; continue; }
    if (!q.length) { cur.setDate(cur.getDate() + 1); continue; }
    const rem = capOf(cur) - (used[k] || 0), u = q[0];
    if (u.mins <= rem + 5 || !(used[k] > 0)) { put(k, q.shift()); continue; }
    const fi = q.findIndex((x, i) => i > 0 && i < 8 && x.mid === u.mid && (x.kind === 'git' || x.kind === 'news') && x.mins <= rem + 5);
    if (fi > 0) { put(k, q.splice(fi, 1)[0]); continue; }
    cur.setDate(cur.getDate() + 1);
  }
  /* Design and build (design problems and project sessions) run in their own lane with their own minutes (budgets().build),
     in program order, never before their module's reading has started */
  const first = {}; units.forEach(u => { if (!isBuild(u) && u.day && u.day !== '0000-00-00' && (!first[u.mid] || u.day < first[u.mid])) first[u.mid] = u.day; });
  const bcur = new Date(t); guard = 0;
  while (bq.length && guard++ < 6000) {
    const k = iso(bcur), u = bq[0], f = first[u.mid];
    if (f && f > k) { bcur.setTime(new Date(f + 'T00:00:00').getTime()); continue; }
    const rem = budgets(bcur).build - (bused[k] || 0);
    if (u.mins <= rem + 5 || !(bused[k] > 0)) { put(k, bq.shift()); continue; }
    bcur.setDate(bcur.getDate() + 1);
  }
  /* within a day the main path comes first, so a carried-over step is never pushed below a Claude Code step */
  Object.values(byDay).forEach(a => a.sort((x, y) => isCC(x.mid) - isCC(y.mid)));
  /* days since the start with nothing ticked: their steps were not skipped, they moved to today and later */
  const missed = [];
  for (const d = new Date([S.start, S.since].filter(Boolean).sort().pop() + 'T00:00:00' || t); d < t && missed.length < 400; d.setDate(d.getDate() + 1)) if (!(byDay[iso(d)] || []).some(u => u.isDone)) missed.push(iso(d));
  const span = {};
  units.forEach(u => { const s = span[u.mid] = span[u.mid] || { first: null, last: null, n: 0, done: 0, mins: 0 }; if (u.day !== '0000-00-00') { if (!s.first || u.day < s.first) s.first = u.day; if (!s.last || u.day > s.last) s.last = u.day; } s.n++; s.mins += u.mins; if (u.isDone) s.done++; });
  const next = units.find(u => !u.isDone);
  return { units, byDay, used, bused, span, missed, today: iso(t), cur: next ? next.mid : MODS[MODS.length - 1], next };
}
function curMid() { return schedule().cur; }
function weeksText(sp) { if (!sp || !sp.first) return 'done'; const a = weekOf(sp.first), b = weekOf(sp.last); return (a === b ? 'Week ' + a : 'Weeks ' + a + '–' + b) + ' · ' + shortDate(sp.first) + (sp.first !== sp.last ? ' – ' + shortDate(sp.last) : ''); }
const KIND = { cc: ['Claude Code test', 'c-ai'], learn: ['Lesson', 'c-core'], build: ['Lab', 'c-dsa'], ai: ['AI lab', 'c-ai'], incident: ['Incident', 'c-spark'], practice: ['Drill', 'c-sql'], quiz: ['Quiz', 'c-test'], talk: ['Interview', 'c-test'], git: ['Git', 'c-git'], design: ['Design', 'c-arch'], news: ['What is new', 'c-ai'], project: ['Project', 'c-dsa'] };
function kchip(k) { const c = KIND[k] || [k, 'c-test']; return el('span', { class: 'chip ' + c[1], text: c[0] }); }
function toggleUnit(u) { S.undone = S.undone || {}; S.doneAt = S.doneAt || {}; if (S.done[u.uid] || u.isDone) { delete S.done[u.uid]; S.undone[u.uid] = Date.now(); if (u.auto && u.auto()) toast('This one is marked done automatically (quiz submitted or milestones verified).'); } else { S.done[u.uid] = iso(new Date()); gameNote('step'); S.doneAt[u.uid] = Date.now(); delete S.undone[u.uid]; } save();
  const kb = document.activeElement && document.activeElement.matches && document.activeElement.matches('.check');
  route();
  /* the screen re-renders: keep keyboard and screen-reader users on the step they just ticked */
  if (kb) { const b = document.querySelector('.check[data-uid="' + CSS.escape(u.uid) + '"]'); if (b) b.focus({ preventScroll: true }); } }

/* one unit as a card: what, why, done when, where.
   On Today (opts.fold) the first open step is expanded as "Up next"; the others fold to one row that opens in place. */
const openUnits = new Set();
function unitCard(u, opts) {
  opts = opts || {};
  const folded = opts.fold && !opts.cur && !openUnits.has(u.uid);
  const card = el('div', { class: 'unit' + (u.isDone ? ' done' : '') + (opts.cur ? ' cur' : '') + (folded ? ' folded' : '') }, [
    el('button', { class: 'check', 'data-uid': u.uid, 'aria-pressed': String(!!u.isDone), 'aria-label': (u.isDone ? 'Mark not done: ' : 'Mark done: ') + u.title, onclick: () => toggleUnit(u) }, u.isDone ? svg(I.check, 16) : null),
    el('div', { class: 'grow stack', style: { gap: '5px', minWidth: 0 } }, [
      opts.cur ? el('span', { class: 'upn', text: 'Up next' }) : null,
      !u.isDone && wasDone(u.uid) ? el('span', { class: 'chip c-ai', title: 'You finished an earlier version of this step on ' + shortDate(wasDone(u.uid)) + '. It has changed.', text: 'Updated · finished before ' + shortDate(wasDone(u.uid)).slice(4) }) : isNewUnit(u) ? el('span', { class: 'chip c-dsa', text: 'New' }) : null,
      el('div', { class: 'row wrap', style: { gap: '6px' } }, [kchip(u.kind), opts.from ? el('span', { class: 'chip c-ai', text: 'from ' + opts.from }) : null, el('span', { class: 'chip ' + modColor(u.mid), style: { background: 'transparent', border: '1px solid currentColor' }, text: modLabel(u.mid) }), el('span', { class: 'mins', text: u.mins + ' min' }), opts.day ? el('span', { class: 'muted', style: { fontSize: '13px' }, text: opts.day }) : null]),
      el('span', { class: 't', text: u.title }),
      u.goal ? el('span', { class: 'goal', text: u.goal }) : null,
      u.done && !opts.compact ? el('span', { class: 'dw' }, [el('b', { text: 'Done when: ' }), u.done]) : null,
      el('div', { class: 'row wrap acts', style: { gap: '8px', marginTop: '2px' } }, [el('a', { class: 'btn sm pri', href: u.href, text: opts.cur ? u.cta + ' · ' + u.mins + ' min' : u.cta })].concat(u.links.map(([t, h]) => el('a', { class: 'btn sm', href: h, text: t }))))])]);
  if (opts.fold && !opts.cur) {
    const say = f => (f ? 'Show details: ' : 'Hide details: ') + u.title;
    const tg = el('button', { class: 'unfold', 'aria-expanded': String(!folded), 'aria-label': say(folded), onclick: () => {
      const f = card.classList.toggle('folded'); if (f) openUnits.delete(u.uid); else openUnits.add(u.uid);
      tg.setAttribute('aria-expanded', String(!f)); tg.setAttribute('aria-label', say(f)); } }, svg(I.fwd, 18));
    card.appendChild(tg);
  }
  return card;
}
/* the rest of the day, shown inside Today's plan so nothing sits outside it: the coding track and interview practice.
   Each row ticks itself (problem solved, mock submitted); a manual tick is kept per day in S.xdone. */
/* the day's other two groups. Each has its own minutes (Profile › Plan), so carried work never makes the day longer.
   Newest work comes first; leftovers from earlier this week follow; whatever doesn't fit, and anything from an earlier
   week's set, waits for the weekend's catch-up minutes instead of mixing into the new week's theme. */
/* forecast lanes only (F9): the saved minute settings are no longer read */
function budgets(d) { const we = d.getDay() === 0 || d.getDay() === 6; return { code: we ? 80 : 50, iv: we ? 55 : 40, build: we ? 60 : 30 }; }
/* design problems and project sessions: the Design and build part of the day (their own lane in the scheduler) */
function isBuild(u) { return u.kind === 'design' || u.kind === 'project'; }
const SQMAP = [0, null, 1, 2, 3, 4, null], SPMAP = [null, 0, 1, 2, 3, null, 4];
const WKC = {}; /* each week's problem sets, filtered once */
function wk(k, w) { return (WKC[k + w] = WKC[k + w] || byWeek(DATA[k], w)); }
function dayProblems(ci) {
  const w = Math.floor(ci / 7) % 12 + 1, d = ci % 7, out = [];
  const st = wk('dsa', w).filter(y => y.st), s = st[d - 7 + st.length]; /* Hard stretch problems sit on the set's last days */
  const x = wk('dsa', w)[d], q = SQMAP[d] == null ? null : wk('sql', w)[SQMAP[d]], p = SPMAP[d] == null ? null : wk('spark', w)[SPMAP[d]];
  if (x) out.push({ id: x.id, chip: 'dsa', t: x.t, sub: 'DSA · ' + WEEKS[w - 1][4] + ' · ' + x.lv, mins: 20, href: '#/dsa/' + x.id, auto: !!S.solved[x.id] });
  if (s) out.push({ id: s.id, chip: 'dsa', t: s.t, sub: 'DSA · Hard stretch · ' + WEEKS[w - 1][4], mins: 25, href: '#/dsa/' + s.id, auto: !!S.solved[s.id] });
  if (q) out.push({ id: q.id, chip: 'sql', t: q.t, sub: 'SQL · ' + (q.k === 'O' ? 'optimize' : 'write') + ' · ' + q.lv, mins: 15, href: '#/sql/' + q.id, auto: !!S.solved[q.id] });
  if (p) out.push({ id: p.id, chip: 'spark', t: p.t, sub: 'PySpark · ' + (p.k === 'O' ? 'optimize' : 'write') + ' · ' + p.lv, mins: 15, href: '#/spark/' + p.id, auto: !!S.solved[p.id] });
  return out;
}
/* take items in order until the minutes run out; finished items always show */
function fill(list, cap) { let used = 0; const now = [], later = []; list.forEach(x => { if (x.auto || used + x.mins <= cap) { now.push(x); used += x.mins; } else later.push(x); }); return [now, later, used]; }
function codingItems(off) {
  const ci = dayIndex() + (off || 0), d = ci % 7, day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() + (off || 0));
  const cap = budgets(day).code, weekend = day.getDay() === 0 || day.getDay() === 6;
  const today = dayProblems(ci);
  if (off) return { now: fill(today, cap)[0], catchup: [], later: [] }; /* other days show their own planned problems */
  const reviews = revDue().slice(0, 3).map(x => ({ id: 'rev:' + x.id, chip: kindOf(x.id), t: x.t, sub: 'Review · ' + revText(S.rev[x.id]), mins: 10, href: '#/' + kindOf(x.id) + '/' + x.id + '/review', auto: false }));
  const carried = []; for (let i = d - 1; i >= 0; i--) dayProblems(ci - d + i).forEach(x => { if (!x.auto) carried.push(Object.assign(x, { from: DN[i].slice(0, 3) })); }); /* this week's earlier days, newest first */
  const [now, laterWeek, used] = fill(reviews.concat(today, carried), cap); /* reviews due today, then today's set, then this week's leftovers */
  /* earlier sets of this 12-week cycle: only on weekends, in their own block */
  const older = []; for (let c = ci - d - 1; c >= Math.max(0, ci - d - 7 * 11) && c >= ci - (ci % 84); c--) dayProblems(c).forEach(x => { if (!x.auto) older.push(Object.assign(x, { from: 'set ' + (Math.floor(c / 7) % 12 + 1) })); });
  const [catchup, laterOld] = weekend ? fill(older, Math.max(0, cap - used)) : [[], older];
  return { now, catchup, later: laterWeek.concat(laterOld), olderWaiting: weekend ? laterOld.length : older.length };
}
function interviewItems(off, k, cur) {
  const day = new Date(k + 'T00:00:00'), cap = budgets(day).iv; cur = cur || curMid();
  /* the live mock (js/live.js); the written mock stays at #/mock and also ticks this row */
  const we = liveWeekend(k), [mins] = LIVE_LEN[we ? 'we' : 'wd'], lk = (S.live || {})[k], mk = (S.mock || {})[k];
  const mock = { id: 'mock', chip: 'test', t: (we ? 'Weekend boss: a ' + LIVE_STYLES[Math.floor(new Date(k + 'T00:00:00').getTime() / 864e5 / 7) % LIVE_STYLES.length] + '-style round' : 'Live mock') + ' · ' + (we ? 7 : 5) + ' questions', sub: 'Spoken or typed, built from this week\'s modules: concept, under the hood, ' + (we ? 'a staff-level round' : 'architect\'s lens, a staff-level question') + ' and recall. ' + (aiOn() ? 'An AI interviewer asks follow-ups and scores each answer.' : 'You mark yourself against the model answers' + (we ? ': good practice, but promotions past Senior need AI scoring.' : '.')), mins, href: '#/live/' + k, auto: !!((lk && lk.done) || (mk && mk.sub)) };
  const coach = []; if (!off && aiOn()) { const c = coachData(); (c.focus || []).forEach((f, i) => coach.push({ id: 'coach' + i + ':' + (c.generated_at || ''), chip: 'ai', t: f.title, sub: 'From your coach' + (f.why ? ' · ' + f.why : ''), mins: Math.min(15, +f.mins || 10), href: /^#\//.test(f.href || '') ? f.href : '#/coach', auto: focusDone(f, c) })); }
  /* company questions: this module's first, newest first; each ticked on its own page */
  const rq = off ? [] : recentOpen().sort((a, b) => (b.mid === cur) - (a.mid === cur) || (b.found || '').localeCompare(a.found || '')).map(q => ({ id: 'rq:' + q.id, chip: q.TAG || 'talk', t: q.company + ': ' + q.Q.replace(/\*\*/g, '').slice(0, 90) + (q.Q.length > 90 ? '…' : ''), sub: (q.found >= iso(new Date(Date.now() - 7 * 864e5)) ? 'Asked this week' : 'Found ' + shortDate(q.found)) + (q.mid === cur ? ' · this module' : ''), mins: 5, href: '#/recent', auto: false, lock: true }));
  const rc = !off && typeof recallItem === 'function' ? recallItem() : null; /* daily recall set (js/recall.js), right after the mock */
  const loop = typeof loopTodayItem === 'function' ? [loopTodayItem(k)] : []; /* the interview loop's drill for the day (js/loop.js) */
  const [now, later] = fill([mock].concat(rc ? [rc] : [], loop, coach.filter(x => !x.auto), coach.filter(x => x.auto), rq), cap);
  if (rq.length && !now.some(x => x.id.startsWith('rq:'))) now.push(later.splice(later.indexOf(rq[0]), 1)[0]); /* an open company question always keeps one row (5 minutes) */
  return { iv: now.filter(x => x.id === 'mock' || x.id === 'recall' || x.id.startsWith('loop:') || x.id.startsWith('rq:')), coach: now.filter(x => x.id.startsWith('coach')), later, laterQ: later.filter(x => x.id.startsWith('rq:')).length, laterC: later.filter(x => x.id.startsWith('coach')).length };
}
function xDone(k, x) { return x.auto || +(((S.xdone || {})[k] || {})[x.id] || 0) > 0; } /* a tick is its time, an untick minus its time, so sync keeps the later one */
function xGroup(k, title, note, items, id, extra, foot) {
  const mins = items.reduce((a, x) => a + x.mins, 0), dm = items.filter(x => xDone(k, x)).reduce((a, x) => a + x.mins, 0);
  return el('div', { class: 'xgroup stack', id, style: { gap: '8px' } }, [
    title ? el('div', { class: 'row wrap xghead' }, [el('h3', { class: 'grow', text: title }), items.length ? el('span', { class: 'muted', style: { fontSize: '14px' }, text: dm + ' / ' + mins + ' min' }) : null]) : null,
    note ? el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: note }) : null, extra || null]
    .concat(items.map(x => { const dn = xDone(k, x); return el('div', { class: 'xit' + (dn ? ' done' : '') }, [
      el('button', { class: 'check', 'aria-pressed': String(dn), 'aria-label': (dn ? 'Mark not done: ' : 'Mark done: ') + x.t, onclick: () => {
        if (x.auto) { toast('This one ticks itself when you solve or submit it.'); return; }
        if (x.lock) { toast('Tick this question on its page when you can answer it out loud.'); location.hash = x.href; return; }
        const m = (S.xdone = S.xdone || {})[k] = S.xdone[k] || {}; m[x.id] = +(m[x.id] || 0) > 0 ? -Date.now() : Date.now(); save(); route(); } }, dn ? svg(I.check, 16) : null),
      el('a', { class: 'grow xlink', href: x.href }, [el('span', { class: 'row wrap', style: { gap: '6px' } }, [chip(x.chip), x.from ? el('span', { class: 'chip c-ai', text: 'from ' + x.from }) : null, el('span', { class: 't', text: x.t })]), el('span', { class: 's', text: x.mins + ' min · ' + x.sub })]),
      el('a', { class: 'btn sm', href: x.href, text: dn ? 'Open' : 'Start' })]); }), foot ? [foot] : []));
}
function weekStrip(sc, k0) {
  const d0 = new Date(k0 + 'T00:00:00'); d0.setDate(d0.getDate() - ((d0.getDay() + 6) % 7));
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(d0); d.setDate(d0.getDate() + i); days.push(d); }
  return el('div', { class: 'wkstrip' }, days.map(d => {
    const k = iso(d), off = Math.round((d - t) / 864e5), ds = (S.dayset || {})[k];
    /* F9: what each day held (its daily set, or the steps done that day before daily sets) in XP and minutes; a tick for a full set */
    const its = ds ? daySet(k) : (sc.byDay[k] || []).filter(u => u.isDone).map(u => ({ unit: u, xp: XP_KIND[u.kind] || 10, mins: u.mins, done: true, s: SEC_OF_KIND[u.kind] || 'lesson' }));
    const xp = its.filter(x => x.done).reduce((a, x) => a + x.xp, 0) + (ds && ds.full ? DAY_BONUS : 0), mins = its.reduce((a, x) => a + x.mins, 0);
    return el('a', { class: 'wkday' + (k === sc.today ? ' today' : '') + (k === k0 ? ' sel' : '') + (off < 0 ? ' past' : ''), href: '#/today/' + off, 'aria-label': dayName(k) + ' ' + shortDate(k) + (ds && ds.full ? ', full set done' : '') }, [
      el('div', { class: 'row' }, [el('b', { class: 'grow', text: (ds && ds.full ? '✓ ' : '') + DN[(d.getDay() + 6) % 7].slice(0, 3) + ' ' + d.getDate() }), el('span', { class: 's', text: its.length ? xp + ' XP' : '' })]),
      el('div', { class: 'stack', style: { gap: '3px' } }, its.length ? its.slice(0, 6).map(x => el('span', { class: 'wu' + (x.done ? ' ok' : ''), title: x.unit ? x.unit.title : x.x.t, text: (x.done ? '✓ ' : '') + (x.unit ? (KIND[x.unit.kind] || [x.unit.kind])[0] + ' · ' + x.unit.title : x.x.t) })).concat(its.length > 6 ? [el('span', { class: 's', text: '+' + (its.length - 6) + ' more · ' + mins + ' min' })] : [el('span', { class: 's', text: mins + ' min' })]) : [el('span', { class: 's', text: off < 0 ? 'Nothing that day' : off === 0 ? '' : 'Chosen that morning' })])]);
  }));
}

/* ---------------- Today ---------------- */
/* F9 (user's design, approved 2026-11-08): the plan box holds the daily set, the smallest set that touches every section of
   Learn, Practice and Interview (js/dayset.js). Minutes show on every row, section, tab and the day, as information only;
   XP decides what a day holds and when the module advances. */
function vToday(off) {
  off = +off || 0;
  const sc = schedule();
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + off);
  const k = iso(d), pre = k < S.start, ds = (S.dayset || {})[k];
  const items = pre ? [] : off < 0 && !ds ? (sc.byDay[k] || []).filter(u => u.isDone).map(u => ({ s: SEC_OF_KIND[u.kind] || 'lesson', tab: (DAY_SECS.find(x => x[1] === (SEC_OF_KIND[u.kind] || 'lesson')) || ['learn'])[0], id: u.uid, unit: u, mins: u.mins, xp: XP_KIND[u.kind] || 10, done: true })) : daySet(k);
  const sum = xs => ({ xp: xs.reduce((a, x) => a + x.xp, 0), xpd: xs.filter(x => x.done).reduce((a, x) => a + x.xp, 0), m: xs.reduce((a, x) => a + x.mins, 0), md: xs.filter(x => x.done).reduce((a, x) => a + x.mins, 0) });
  const all = sum(items), full = items.length > 0 && items.every(x => x.done), fmt = n => n >= 60 ? Math.floor(n / 60) + ' h' + (n % 60 ? ' ' + (n % 60) + ' min' : '') : n + ' min';
  const cur = off === 0 ? DAY_TABS.map(([t]) => items.find(x => x.tab === t && !x.done)).find(Boolean) : null;
  const m = (cur && (cur.unit ? cur.unit.mid : null)) || MODS[dayCurIdx(sc)] || sc.cur, M = MOD[m], sp = sc.span[m];
  const hr = new Date().getHours();
  const fromTxt = x => x.carried ? shortDate(x.carried).slice(0, 3) : '';
  const row = x => x.unit ? unitCard(x.unit, { fold: true, cur: false, from: fromTxt(x) }) : xGroup(k, '', '', [Object.assign({}, x.x, { from: fromTxt(x), sub: x.x.sub + ' · +' + x.xp + ' XP' })]);
  const upNext = cur && !pre ? el('section', { class: 'upnext' }, [cur.unit ? unitCard(cur.unit, { cur: true, from: fromTxt(cur) }) : el('div', { class: 'stack', style: { gap: '6px' } }, [el('span', { class: 'upn', text: 'Up next · ' + (DAY_SECS.find(s => s[1] === cur.s) || [, , ''])[2] }), xGroup(k, '', '', [Object.assign({}, cur.x, { sub: cur.x.sub + ' · +' + cur.xp + ' XP' })])])]) : null;
  const nav = el('div', { class: 'row wrap daynav', style: { gap: '8px' } }, [
    el('a', { class: 'btn icon sm', href: '#/today/' + (off - 1), 'aria-label': 'Previous day' }, svg(I.back, 18)),
    el('b', { style: { fontSize: '17px' }, text: (off === 0 ? 'Today · ' : off === 1 ? 'Tomorrow · ' : off === -1 ? 'Yesterday · ' : '') + dayName(k) + ' ' + shortDate(k).slice(4) }),
    el('a', { class: 'btn icon sm', href: '#/today/' + (off + 1), 'aria-label': 'Next day' }, svg(I.fwd, 18)),
    off ? el('a', { class: 'btn sm', href: '#/today', text: 'Back to today' }) : null]);
  const pct = all.xp ? Math.round(100 * all.xpd / all.xp) : 0;
  const ring = el('span', { class: 'ring', role: 'img', 'aria-label': pct + '% of the day\'s XP earned', html: '<svg viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="17" fill="none" stroke="var(--line)" stroke-width="5"/><circle cx="21" cy="21" r="17" fill="none" stroke="var(--teal)" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + (pct * 1.068).toFixed(1) + ' 107" transform="rotate(-90 21 21)"/></svg>' });
  /* one pane per tab: its sections in order, each with its rows; when the tab is done, One more per section */
  const IDS = { learn: 'grp-hour', practice: 'grp-coding', interview: 'grp-interview' };
  const PARTS = DAY_TABS.map(([t, n]) => [IDS[t], n, items.filter(x => x.tab === t), t]).filter(g => g[2].length);
  const tabNow = PARTS.some(g => g[0] === todayTab) ? todayTab : ((PARTS.find(g => !g[2].every(x => x.done)) || PARTS[0] || [])[0]);
  const paneOf = ([id, n, xs, t]) => {
    const secs = DAY_SECS.filter(s => s[0] === t).map(s => [s, xs.filter(x => x.s === s[1])]).filter(z => z[1].length), s0 = sum(xs), done = xs.every(x => x.done);
    const kids = secs.map(([s, ys]) => { const z = sum(ys); return el('div', { class: 'xgroup stack tsec', id: 'sec-' + s[1], style: { gap: '8px' } }, [el('div', { class: 'row wrap xghead' }, [el('h3', { class: 'grow', text: s[2] }), el('span', { class: 'muted', style: { fontSize: '14px' }, text: z.xpd + ' / ' + z.xp + ' XP · ' + z.m + ' min' })])].concat(ys.filter(x => x !== cur).map(row))); });
    if (t === 'interview' && off === 0) { const cn = typeof coachNote === 'function' ? coachNote() : null; if (cn) kids.push(el('div', { class: 'xgroup stack tsec', id: 'grp-coach', style: { gap: '8px' } }, [el('h3', { text: 'Coaching' }), cn]));
      kids.push(el('a', { class: 'tlink', href: '#/mock', style: { fontWeight: 600, fontSize: '14px' }, text: 'Prefer writing? The written mock ›' })); }
    if (done && off === 0) kids.push(el('div', { class: 'stack', style: { gap: '6px' } }, [el('span', { class: 'muted', style: { fontSize: '14px' }, text: n + ' is done for today. Want more? Each adds its XP; none is required.' }), el('div', { class: 'row wrap', style: { gap: '8px' } }, DAY_SECS.filter(s => s[0] === t).map(s => el('button', { class: 'btn sm', onclick: () => dayMore(k, s[1]), text: 'One more: ' + s[2].toLowerCase() })))]));
    const pane = el('div', { class: 'stack tpane', id, role: 'tabpanel', 'aria-label': n + ': ' + s0.xpd + ' of ' + s0.xp + ' XP, ' + s0.m + ' minutes', style: { gap: '14px' } }, kids);
    if (PARTS.length > 1 && id !== tabNow) pane.hidden = true;
    return pane;
  };
  const plan = el('section', { class: 'card pad stack plan' }, [
    el('div', { class: 'row planhead wrap' }, [ring, el('div', { class: 'grow stack', style: { gap: '0' } }, [el('div', { class: 'row', style: { gap: '8px' } }, [el('h2', { text: off === 0 ? 'Today' : pre ? 'Before your plan starts' : dayName(k) })]), pre ? null : el('span', { class: 'muted', style: { fontSize: '14px' }, text: all.xpd + ' of ' + all.xp + ' XP · about ' + fmt(all.m) + ' (' + fmt(all.md) + ' done)' })]),
      pre ? null : el('div', { class: 'row wrap daysum', role: 'tablist', 'aria-label': 'This day in parts' }, PARTS.map(([id, n, xs]) => {
        const z = sum(xs), dn = xs.every(x => x.done);
        return el('button', { class: 'dsum' + (dn ? ' done' : ''), role: 'tab', id: 'tab-' + id, 'aria-selected': String(id === tabNow), 'aria-controls': id, 'aria-label': n + ': ' + z.xpd + ' of ' + z.xp + ' XP, ' + z.m + ' minutes' + (dn ? ', finished' : ''), onclick: () => { todayTab = id; document.querySelectorAll('.plan .dsum').forEach(b => b.setAttribute('aria-selected', String(b.id === 'tab-' + id))); PARTS.forEach(([g]) => { const s = document.getElementById(g); if (s) s.hidden = g !== id; }); } }, [dn ? svg(I.check, 14) : null, el('b', { text: n }), el('span', { text: z.xpd + '/' + z.xp + ' XP · ' + z.m + ' min' })]); }))]),
    nav,
    pre ? el('p', { style: { margin: 0 }, text: 'Your plan starts ' + shortDate(S.start) + '.' }) : null,
    off > 0 && !pre ? el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' }, text: 'A preview: the set is chosen on the morning of the day, from what is still open then.' }) : null,
    !pre && items.length ? el('div', { class: 'hint' + (full ? '' : ' quiet'), role: 'status' }, full ? [el('b', { text: 'Daily set done · +' + DAY_BONUS + ' XP. ' }), 'It counts for your streak.'] : ['Finish all ' + items.length + ' for +' + DAY_BONUS + ' XP and a streak day. No time limit: the minutes are only a guide.']) : null].concat(PARTS.map(paneOf)));
  const D = DATA.design[m];
  const modCard = el('section', { class: 'card pad stack' }, [
    el('div', { class: 'row wrap', style: { gap: '6px' } }, [el('span', { class: 'chip ' + modColor(m), text: 'Module ' + modLabel(m) }), el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: weeksText(sp) })]),
    el('b', { style: { fontSize: '18px' }, text: M ? M.title : '' }), el('span', { style: { fontSize: '14.5px' }, text: M ? M.goal : '' }),
    el('div', { class: 'row' }, [el('div', { class: 'bar grow' }, el('i', { style: { width: (sp ? Math.round(100 * sp.done / sp.n) : 0) + '%' } })), el('b', { text: modXP(m) })]),
    el('details', { class: 'modmenu' }, [el('summary', { class: 'btn', text: 'Open module' }), el('div', { class: 'stack', style: { gap: '10px', marginTop: '10px' } }, [modLinks(m), D ? el('a', { class: 'tlink', href: '#/design/' + m, style: { fontWeight: 600, fontSize: '14px' }, text: 'Design problem: ' + D.title + ' ›' }) : null, el('a', { class: 'tlink', href: '#/path/' + m, style: { fontWeight: 600, fontSize: '14px' }, text: 'See every step of this module ›' })])])]);
  shell(off === 0 ? 'Today' : 'Plan · ' + shortDate(k), 'Module ' + modLabel(m), [
    el('div', { class: 'row greet' }, [el('div', { class: 'grow stack', style: { gap: '2px' } }, [el('h1', { text: (hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + (userName() ? ', ' + userName() : '') }), pre ? null : el('span', { class: 'muted', style: { fontSize: '14px' }, text: dayName(k) + ' ' + shortDate(k).slice(4) + ' · ' + all.xpd + ' of ' + all.xp + ' XP' })]), off === 0 ? gameMini() : null]),
    upNext,
    off === 0 ? whatsNewCard() : null,
    el('div', { class: 'grid2' }, [plan, el('div', { class: 'stack', style: { gap: '18px' } }, [modCard, off === 0 ? el('div', { id: 'rtodayslot' }) : null])]),
    off === 0 ? el('div', { id: 'gcardslot' }) : null,
    el('section', { class: 'card pad stack' }, [el('div', { class: 'row wrap' }, [el('h2', { class: 'grow', style: { minWidth: 'max-content' }, text: 'This week' }), el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'XP earned and minutes · ✓ full set · tap a day to see it' }), el('button', { class: 'btn sm', onclick: exportIcs, text: 'Add to calendar' })]), weekStrip(sc, k)])]);
  if (off === 0) { reelToday().then(c => { const s = document.getElementById('rtodayslot'); if (c && s) s.replaceWith(c); }); gameCard().then(c => { const s = document.getElementById('gcardslot'); if (c && s) s.replaceWith(c); }); gameShipCheck(); }
}
/* module XP: earned in its steps out of what its steps are worth (F9; the module advances when every step is done) */
function modXP(m) { const us = schedule().units.filter(u => u.mid === m), a = us.filter(u => u.isDone).reduce((s, u) => s + (XP_KIND[u.kind] || 10), 0), b = us.reduce((s, u) => s + (XP_KIND[u.kind] || 10), 0); return a + ' / ' + b + ' XP'; }
let todayTab = null; /* the plan tab picked on Today, kept while the app is open */
function missedText(ks) { const n = ks.map(k => shortDate(k).slice(0, 3)); return ks.length > 3 ? ks.length + ' missed days' : n.length === 1 ? n[0] : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1]; }
function weekText(k) { return 'Week ' + weekOf(k); }
function modLinks(m) {
  const pj = DATA.projects.find(p => p.mod === m), M = MOD[m] || {};
  const R = (DATA.sprints[m] || {}).raw || {}, has = k => (R[k] || '').trim().length > 0;
  const L = [['Read', '#/learn/' + m], has('readings') && ['Readings', '#/learn/' + m + '/readings'], has('lab') && ['Labs', '#/learn/' + m + '/lab'], has('practice') && ['Warm-ups', '#/learn/' + m + '/practice'], has('quiz') && ['Quiz', '#/quiz/' + m], has('interview') && ['Interview', '#/interview/' + m], has('mock') && ['Mock', '#/interview/' + m + '/mock']].filter(Boolean);
  const g = !isCC(m) && DATA.git.length ? DATA.git[MODS.indexOf(m) % DATA.git.length] : null; if (g) L.push(['Git ' + g.n, '#/git/' + g.n]);
  if (DATA.design[m]) L.push(['Design', '#/design/' + m]);
  if (pj) L.push(['Project', '#/project/' + pj.id]);
  if (M.coding) L.push(['Coding test', '#/practice/tests']);
  if (DATA.py.some(x => x.m === m)) L.push(['Python exercises', '#/practice/py']);
  if (DATA.sql.some(x => x.m === m) || DATA.spark.some(x => x.m === m)) L.push(['Module exercises', '#/practice/model']);
  return el('div', { class: 'row wrap', style: { gap: '6px' } }, L.map(([t, h]) => el('a', { class: 'btn sm', href: h, text: t })));
}

/* ---------------- Path ---------------- */
/* topic pictures for the Path cards: one simple drawing per track, coloured by the track's tokens */
function trackOf(x) { return x === 's00' ? 'setup' : { p: 'python', a: 'ai', m: 'model', d: 'systems', j: 'platform', r: 'lead', c: 'cc' }[x[0]] || 'de'; }
const ART = {
  setup: '<rect x="18" y="30" width="64" height="40" rx="5" fill="var(--card)" stroke="currentColor" stroke-width="4"/><rect x="10" y="70" width="80" height="8" rx="4" fill="currentColor"/><path d="M38 50l8 8 16-16" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
  python: '<path d="M50 18c-14 0-16 6-16 12v8h17v4H27c-8 0-13 6-13 16s5 16 12 16h6v-9c0-7 5-12 12-12h16c6 0 10-4 10-10V30c0-7-6-12-20-12z" fill="currentColor"/><path d="M50 82c14 0 16-6 16-12v-8H49v-4h24c8 0 13-6 13-16s-5-16-12-16h-6v9c0 7-5 12-12 12H40c-6 0-10 4-10 10v13c0 7 6 12 20 12z" fill="#F2C94C"/><circle cx="42" cy="27" r="3" fill="var(--card)"/><circle cx="58" cy="73" r="3" fill="var(--card)"/>',
  ai: '<rect x="24" y="32" width="52" height="40" rx="12" fill="var(--card)" stroke="currentColor" stroke-width="4"/><circle cx="40" cy="52" r="5" fill="currentColor"/><circle cx="60" cy="52" r="5" fill="currentColor"/><path d="M50 32V20" stroke="currentColor" stroke-width="4"/><circle cx="50" cy="17" r="5" fill="currentColor"/><path d="M42 63h16" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M80 22l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="currentColor"/>',
  model: '<rect x="38" y="38" width="24" height="24" rx="4" fill="currentColor"/><g fill="var(--card)" stroke="currentColor" stroke-width="4"><rect x="12" y="12" width="20" height="16" rx="3"/><rect x="68" y="12" width="20" height="16" rx="3"/><rect x="12" y="72" width="20" height="16" rx="3"/><rect x="68" y="72" width="20" height="16" rx="3"/></g><path d="M30 28l10 10M70 28L60 38M30 72l10-10M70 72L60 62" stroke="currentColor" stroke-width="4"/>',
  de: '<g fill="var(--card)" stroke="currentColor" stroke-width="4"><ellipse cx="24" cy="34" rx="12" ry="5"/><path d="M12 34v28c0 3 5 5 12 5s12-2 12-5V34"/><ellipse cx="76" cy="34" rx="12" ry="5"/><path d="M64 34v28c0 3 5 5 12 5s12-2 12-5V34"/></g><path d="M40 50h18" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M54 43l8 7-8 7" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
  systems: '<g fill="var(--card)" stroke="currentColor" stroke-width="4"><rect x="22" y="16" width="56" height="18" rx="4"/><rect x="22" y="41" width="56" height="18" rx="4"/><rect x="22" y="66" width="56" height="18" rx="4"/></g><g fill="currentColor"><circle cx="32" cy="25" r="3"/><circle cx="32" cy="50" r="3"/><circle cx="32" cy="75" r="3"/></g>',
  platform: '<circle cx="50" cy="50" r="30" fill="var(--card)" stroke="currentColor" stroke-width="4"/><circle cx="50" cy="50" r="8" fill="currentColor"/><path d="M50 50V24M50 50l20.3-12.8M50 50l25.3 5.8M50 50l11.3 23.4M50 50l-11.3 23.4M50 50l-25.3 5.8M50 50L29.7 37.2" stroke="currentColor" stroke-width="4"/>',
  lead: '<path d="M10 84l26-40 14 20 12-16 28 36z" fill="currentColor"/><path d="M62 48V16" stroke="currentColor" stroke-width="4"/><path d="M62 16h20l-5 7 5 7H62z" fill="#F2C94C"/>',
  cc: '<rect x="12" y="22" width="76" height="56" rx="8" fill="#12202F"/><circle cx="22" cy="31" r="2.5" fill="#E08A1E"/><circle cx="30" cy="31" r="2.5" fill="#F2C94C"/><circle cx="38" cy="31" r="2.5" fill="#5CC8B0"/><path d="M24 48l8 6-8 6" fill="none" stroke="#5CC8B0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M38 62h16" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M74 44l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="currentColor"/>'
};
function topicArt(x, size) { const t = trackOf(x); return el('span', { class: 'tart a-' + t, 'aria-hidden': 'true', html: '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '">' + ART[t] + '</svg>' }); }
const ROADMAP_TEXT = 'Setup and the diagnostic first, then the Python track (Python 1–6) woven between the AI modules (AI 1–3), then data modelling (Modelling 1–3), then the data engineering modules, with Systems 1 (distributed systems and storage internals) after DE 4, Platform 1 (Scala, the JVM, Kubernetes and Hadoop) after DE 7 and Leadership 1 (strategy, migrations, cost, influence) after DE 10. A module ends when its steps are done, not on a fixed week. After the last module, new Extra modules arrive every week: big-tech papers and problems, plus fresh questions on earlier topics.';
function weekOneBtn() { return el('button', { class: 'btn sm', onclick: async () => { const v = await confirmBox('Restart the calendar?', 'Week 1 becomes this week. Your progress is kept; only the week numbers change.', [{ t: 'Make this week 1', cls: 'pri', v: 1 }, { t: 'Cancel', v: null }]); if (v) { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); S.start = iso(d); S.since = iso(new Date()); save(); route(); } }, text: 'Make this week 1' }); }
/* ---------------- Path: picture cards for every module ---------------- */
function vPathMap() {
  const sc = schedule(), cur = sc.cur, i = MODS.indexOf(cur), nx = sc.units.find(u => u.mid === cur && !u.isDone);
  const cards = MODS.map(x => {
    const s = sc.span[x] || { n: 0, done: 0 }, fin = s.n > 0 && s.done === s.n, isCur = x === cur, pct = s.n ? Math.round(100 * s.done / s.n) : 0;
    return el('div', { class: 'pcard' + (isCur ? ' cur' : '') + (fin ? ' fin' : ''), 'data-mid': x }, [
      el('div', { class: 'band a-' + trackOf(x) }, topicArt(x, isCur ? 96 : 64)),
      el('div', { class: 'bd' }, [
        el('div', { class: 'row', style: { gap: '6px' } }, [el('span', { class: 'chip ' + modColor(x), text: modLabel(x) }), fin ? el('span', { class: 'tag', text: '✓ Done' }) : isNewMod(x) ? el('span', { class: 'tag tnew', text: 'New' }) : modUpdated(x) ? el('span', { class: 'tag tupd', text: 'Updated' }) : isCur ? el('span', { class: 'tag', text: 'You are here' }) : null]),
        el('a', { class: 'pt', href: '#/path/' + x, text: modTitle(x) }),
        el('div', { class: 'bar', role: 'img', 'aria-label': s.done + ' of ' + s.n + ' steps done' }, el('i', { style: { width: pct + '%' } })),
        el('span', { class: 's', text: s.done + '/' + s.n + ' steps · ' + weeksText(s.n ? s : null) }),
        isCur && nx ? el('a', { class: 'btn sm pri go', href: nx.href, text: 'Continue: ' + nx.title }) : null])]);
  });
  const road = el('section', { class: 'card pad stack' }, [el('div', { class: 'row wrap' }, [el('h2', { class: 'grow', text: 'Roadmap' }), weekOneBtn()]),
    el('span', { class: 'muted', style: { fontSize: '14px' }, text: ROADMAP_TEXT })]);
  const grid = el('section', { class: 'pgrid', 'aria-label': 'Modules' }, cards);
  shell('Path', MODS.length + ' modules so far · you are on module ' + (i + 1), [el('div', { class: 'grid2 wide' }, [grid, el('div', { class: 'stack', style: { gap: '18px' } }, [road])])]);
  /* bring the current module into view when it is further down the page */
  setTimeout(() => { const c = document.querySelector('.pcard.cur'); if (c && c.getBoundingClientRect().top > innerHeight * .6) c.scrollIntoView({ block: 'center' }); }, 0);
}
function vPath(m) {
  if (m == null || m === '') return vPathMap();
  const sc = schedule();
  m = MOD[midOf(m)] ? midOf(m) : sc.cur;
  const M = MOD[m], sp = sc.span[m], us = sc.units.filter(u => u.mid === m);
  const total = us.reduce((a, u) => a + u.mins, 0);
  const head = el('section', { class: 'card pad stack' }, [
    el('div', { class: 'row wrap', style: { gap: '6px' } }, [el('span', { class: 'chip ' + modColor(m), text: 'Module ' + modLabel(m) }), el('span', { class: 'muted', style: { fontSize: '14px' }, text: weeksText(sp) + ' · ' + Math.round(total / 6) / 10 + ' h in the daily hour' + (M.coding ? ' + coding' : '') })]),
    el('div', { class: 'phead' }, [topicArt(m, 80), el('h1', { text: M.title })]), el('p', { style: { margin: 0, fontSize: '16px' }, text: M.goal }),
    el('div', { class: 'row' }, [el('div', { class: 'bar grow' }, el('i', { style: { width: Math.round(100 * sp.done / sp.n) + '%' } })), el('b', { text: sp.done + ' of ' + sp.n + ' steps' })]),
    el('span', { class: 'lbl', text: 'Everything in this module' }), modLinks(m)]);
  const steps = el('section', { class: 'card pad stack' }, [el('h2', { text: 'Steps, in order, with the day each is planned' }), el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'Each step fits in one day\'s budget. Tick a step here or on Today. Unfinished steps slide to the next free day, so the dates always stay true.' })]
    .concat(us.map(u => unitCard(u, { day: u.isDone ? 'done' : (u.day === sc.today ? 'today' : shortDate(u.day) + ' · week ' + weekOf(u.day)), compact: false }))));
  const extra = [];
  if (M.coding) extra.push(el('section', { class: 'card pad stack' }, [el('div', { class: 'row' }, [chip('test'), el('h3', { class: 'grow', text: 'Coding test · on the coding track' })]), el('div', { class: 'list' }, DATA.sprints[m].coding.map((c, i) => el('a', { class: 'item', href: '#/test/' + m + '/' + i }, [chip(c.KIND === 'sql' ? 'sql' : c.KIND === 'pyspark' ? 'spark' : 'dsa'), el('span', { class: 'grow' }, [el('span', { class: 't', text: c.TITLE }), el('br'), el('span', { class: 's', text: (c.MIN || '?') + ' min' })]), S.solved['t' + qk(m) + '_' + i] ? el('span', { class: 'ok', text: '✓' }) : null])))]));
  const exk = ['py', 'sql', 'spark'].find(k => DATA[k].some(x => x.m === m)) || 'sql', pyx = DATA[exk].filter(x => x.m === m);
  if (pyx.length) extra.push(el('section', { class: 'card pad stack' }, [el('div', { class: 'row' }, [chip(exk), el('h3', { class: 'grow', text: m === 's00' ? 'Python level check' : exk === 'py' && m[0] === 'p' ? 'Python exercises' : exk === 'py' ? 'Module exercises (Python)' : m[0] === 'm' ? 'Modelling exercises (SQL)' : 'Module exercises (' + (exk === 'sql' ? 'SQL' : 'PySpark') + ')' }), el('span', { class: 'muted', text: pyx.filter(x => S.solved[x.id]).length + ' / ' + pyx.length })]), el('div', { class: 'list' }, pyx.map(x => el('a', { class: 'item', href: '#/' + exk + '/' + x.id }, [el('span', { class: 'grow' }, [el('span', { class: 't', text: x.t }), el('br'), el('span', { class: 's', text: x.lv })]), S.solved[x.id] ? el('span', { class: 'ok', text: '✓' }) : null])))]));
  if (isS(m) && +m.slice(1) > 0) {
    const w = +m.slice(1);
    const sec = (title, kind, items, href) => el('section', { class: 'card pad stack' }, [el('div', { class: 'row' }, [chip(kind), el('h3', { class: 'grow', text: title })]), el('div', { class: 'list' }, items.map(x => el('a', { class: 'item', href: href(x) }, [el('span', { class: 'grow' }, [el('span', { class: 't', text: x.t }), el('br'), el('span', { class: 's', text: (x.k ? (x.k === 'O' ? 'Optimize · ' : 'Write · ') : '') + x.lv })]), S.solved[x.id] ? el('span', { class: 'ok', text: '✓' }) : null])))]);
    extra.push(el('div', { class: 'cols3' }, [sec('DSA on this topic', 'dsa', byWeek(DATA.dsa, w), x => '#/dsa/' + x.id), sec('SQL on this topic', 'sql', byWeek(DATA.sql, w), x => '#/sql/' + x.id), sec('PySpark on this topic', 'spark', byWeek(DATA.spark, w), x => '#/spark/' + x.id)]));
  }
  const k = MODS.indexOf(m), near = el('section', { class: 'card pad stack' }, [el('div', { class: 'row wrap' }, [el('h2', { class: 'grow', text: 'Module ' + (k + 1) + ' of ' + MODS.length }), el('a', { class: 'btn sm', href: '#/path', text: 'All modules' })])]
    .concat([[k - 1, 'Previous'], [k + 1, 'Next']].filter(([j]) => MODS[j]).map(([j, t]) => { const x = MODS[j], s = sc.span[x] || { n: 0, done: 0 }; return el('a', { class: 'item', href: '#/path/' + x }, [topicArt(x, 44), el('span', { class: 'grow' }, [el('span', { class: 's', text: t + ' · ' + modLabel(x) }), el('br'), el('span', { class: 't', text: modTitle(x) })]), el('span', { class: 's', style: { fontWeight: 700, flex: 'none' }, text: s.n && s.done === s.n ? '✓' : s.done + '/' + s.n })]); })));
  shell('Path', 'Module ' + modLabel(m) + ' · ' + MODS.length + ' modules so far', [el('div', { class: 'grid2 wide' }, [el('div', { class: 'stack', style: { gap: '18px' } }, [head, steps]), el('div', { class: 'stack', style: { gap: '18px' } }, [near])])].concat(extra), { back: '#/path' });
}

/* ---------------- Learn ---------------- */
/* a module tab is finished when you tapped "Done, next" on it, or when every plan step that opens it is ticked */
const TABS2 = [['chapter', 'Chapter'], ['readings', 'Readings'], ['lab', 'Labs'], ['practice', 'Warm-ups']];
function tabUnits(m, tab, sc) { return (sc || schedule()).units.filter(u => u.mid === m && (u.href === '#/learn/' + m + '/' + tab || u.href.startsWith('#/learn/' + m + '/' + tab + '/'))); }
/* earlier fingerprints of a module's quiz that differ only in the wording of wrong options (`quiz-same:` in @@meta, checked by tools/validate.py); a quiz you finished stays finished */
function quizSame(m) { return String((((DATA.sprints[m] || {}).meta) || {})['quiz-same'] || '').split(/\s+/).filter(Boolean); }
function tabHash(m, tab) { const R = (DATA.sprints[m] || {}).raw || {}; return fnv(R[tab === 'lab' ? 'lab' : tab] || ''); }
/* a tab you finished whose text changed since is not finished any more */
function tabDone(m, tab, sc) { const f = (S.tabs || {})[m + ':' + tab]; if (f && (!f.h || f.h === tabHash(m, tab) || (tab === 'quiz' && quizSame(m).includes(f.h)))) return true; const us = tabUnits(m, tab, sc); return us.length > 0 && us.every(u => u.isDone); }
async function vLearn(m, tab, range) {
  m = MOD[midOf(m)] ? midOf(m) : curMid();
  const sc = schedule();
  /* opened without a tab (the module's Read link): land on the first tab you have not finished */
  if (!TABS2.some(t => t[0] === tab)) tab = (TABS2.find(t => !tabDone(m, t[0], sc)) || TABS2[0])[0];
  const tabs = el('div', { class: 'tabs', role: 'tablist' }, TABS2.map(([k, n]) => { const dn = tabDone(m, k, sc); return el('button', { role: 'tab', class: dn ? 'tdone' : null, 'aria-selected': String(k === tab), 'aria-label': n + (dn ? ', finished' : ''), onclick: () => { location.hash = '#/learn/' + m + '/' + k; } }, [dn ? svg(I.check, 14) : null, n]); }));
  const sel = el('select', { class: 'btn sm', 'aria-label': 'Module', onchange: e => { location.hash = '#/learn/' + e.target.value + '/' + tab; } }, MODS.map(x => el('option', { value: x, selected: x === m ? 'selected' : null, text: modLabel(x) + ' · ' + modTitle(x) })));
  const body = el('div', { class: 'stack' });
  shell(modTitle(m), 'Module ' + modLabel(m) + ' · ' + (TABS2.find(t => t[0] === tab) || ['', 'Chapter'])[1], [el('div', { class: 'row wrap' }, [sel, tabs]), body], { back: '#/today' });
  const s = DATA.sprints[m];
  const rg = /^(\d+)-(\d+)$/.exec(range || ''), a = rg ? +rg[1] : 0, b = rg ? +rg[2] : 999;
  const src = tab === 'chapter' ? s.raw.chapter : tab === 'readings' ? s.raw.readings : tab === 'lab' ? s.raw.lab : s.raw.practice;
  const all = headings(src);
  if (rg) body.appendChild(el('div', { class: 'hint row wrap' }, [el('span', { class: 'grow' }, [el('b', { text: 'Today\'s part: ' }), all.slice(a, b + 1).join(' · ')]), el('a', { class: 'btn sm', href: '#/learn/' + m + '/' + tab, text: 'Show the whole ' + (tab === 'lab' ? 'lab page' : tab) })]));
  if (tab === 'chapter' && a === 0) { if (m === 's01') body.appendChild(kafkaLesson()); else body.appendChild(weekMap(m)); }
  const text = rg ? sliceH2(src, a, b) : src;
  const ch = mdEl(text || '_Nothing here for this module._');
  /* this week's company questions and What is new items, inside the section they belong to */
  if (tab === 'chapter') {
    const h2s = [...ch.querySelectorAll('h2')], by = {}, top = [];
    const secs = h2s.map(h => { let b = '', n = h.nextElementSibling; while (n && n.tagName !== 'H2') { b += ' ' + n.textContent; n = n.nextElementSibling; } return { head: h.textContent.trim(), body: b }; });
    freshFor(m).forEach(f => { const i = freshPlace(secs, f); if (i >= 0) (by[i] = by[i] || []).push(f); else top.push(f); });
    Object.keys(by).forEach(i => h2s[i].after(freshBox(by[i])));
    if (top.length && a === 0) body.appendChild(freshBox(top));
  }
  /* a Reel button under each section heading (js/reels.js), placed last so it sits right under the heading */
  if (tab === 'chapter') setTimeout(() => reelMount(m, ch), 0);
  /* the learner's Udemy lectures: under each matching chapter section, or one row for the whole module */
  const U = DATA.udemy && DATA.udemy.modules[m];
  if (U && tab === 'chapter') {
    if (U.sections) ch.querySelectorAll('h2').forEach((h, i) => { let nx = h.nextElementSibling; while (nx && nx.tagName !== 'H2') { if (!nx.nextElementSibling || nx.nextElementSibling.tagName === 'H2') break; nx = nx.nextElementSibling; } const u = udemyLinks(U.course, U.sections[String(i + a)], 'Watch on Udemy'); if (u) nx ? nx.after(u) : h.after(u); });
    else if (a === 0 && U.lectures) body.appendChild(udemyLinks(U.course, U.lectures, 'Your Udemy lectures for this module'));
  }
  const hs = ch.querySelectorAll('h2');
  if (hs.length > 1) {
    const toc = el('nav', { class: 'toc', 'aria-label': 'Sections' });
    hs.forEach((h, i) => { h.id = 'sec' + i; toc.appendChild(el('a', { href: '#', text: h.textContent, onclick: e => { e.preventDefault(); h.scrollIntoView({ behavior: 'smooth', block: 'start' }); } })); });
    body.appendChild(el('details', { class: 'card pad', open: matchMedia('(min-width:900px)').matches ? 'open' : null }, [el('summary', { class: 'lbl', style: { cursor: 'pointer' }, text: 'Sections (' + hs.length + ')' }), toc]));
  }
  if (tab === 'readings') { body.appendChild(el('section', { class: 'card pad stack' }, [el('h2', { text: 'Read deeper' }), isS(m) && +m.slice(1) > 0 ? el('p', { class: 'muted', style: { margin: 0 }, text: 'Books: ' + WEEKS[+m.slice(1) - 1][5] }) : null, ch])); if (isS(m)) body.appendChild(videoCard(+m.slice(1))); }
  else body.appendChild(el('article', { class: 'card pad' }, ch));
  if ((tab === 'chapter' || tab === 'lab') && typeof simCard === 'function') { const c = simCard(m); if (c) body.appendChild(c); } /* this module's design simulator challenges (js/sim.js) */
  /* Claude Code modules: try prompts for real from any page of the lesson */
  if (isCC(m) && (tab === 'chapter' || tab === 'lab')) body.appendChild(runBox({ key: m + '_' + tab, title: tab === 'lab' ? 'Practise here: run a prompt in Claude Code' : 'Try what you just read', claudeMd: true, placeholder: 'For example: Find where amounts are parsed and explain what goes wrong for EU files. Answer in 5 lines.' }));
  if (isCC(m) && tab === 'lab' && (s.tasks || []).length) body.appendChild(el('a', { class: 'btn pri', style: { alignSelf: 'flex-start' }, href: '#/cc/' + m + '/1', text: 'Take the test: ' + s.tasks.length + ' graded tasks' }));
  const nextTab = { chapter: 'readings', readings: 'lab', lab: 'practice' }[tab], nextName = nextTab ? TABS2.find(t => t[0] === nextTab)[1] : 'Quiz', nextHref = nextTab ? '#/learn/' + m + '/' + nextTab : '#/quiz/' + m;
  const finished = tabDone(m, tab, sc);
  /* "Done, next" marks this tab finished (and today's reading step for this part), then opens the next tab */
  const finish = () => {
    S.tabs = S.tabs || {}; S.tabs[m + ':' + tab] = { at: iso(new Date()), h: tabHash(m, tab) };
    const u = rg ? sc.units.find(x => x.href === '#/learn/' + m + '/' + tab + '/' + range) : null;
    if (u && !u.isDone) { S.done[u.uid] = iso(new Date()); (S.doneAt = S.doneAt || {})[u.uid] = Date.now(); if (S.undone) delete S.undone[u.uid]; }
    save(); location.hash = nextHref;
  };
  body.appendChild(el('div', { class: 'row wrap' }, [finished ? el('a', { class: 'btn pri', href: nextHref, text: 'Next: ' + nextName }) : el('button', { class: 'btn pri', onclick: finish, text: 'Done, next: ' + nextName }), el('a', { class: 'btn', href: '#/today', text: 'Back to today\'s plan' }),
    finished && (S.tabs || {})[m + ':' + tab] && tabDone(m, tab, { units: [] }) ? el('button', { class: 'btn', onclick: () => { delete S.tabs[m + ':' + tab]; save(); route(); }, text: 'Mark not finished' }) : null]));
}
const AMAPS = { d01: ['Storage engine', 'Replication', 'Partitioning', 'Transactions', 'Consensus'], j01: ['Scala', 'Spark API', 'JVM memory', 'Kubernetes', 'Paved path'], r01: ['Strategy', 'Design doc', 'Migration', 'Cost', 'Influence'], m01: ['Process', 'Grain', 'Dimensions', 'History (SCD)', 'Cumulative'], m02: ['Event', 'Grain', 'Fact type', 'Dedupe', 'Reduced'], m03: ['Raw', 'Cleaned', 'Business', 'Serving', 'Semantic'], p01: ['Objects', 'Lists', 'Dicts and sets', 'Big-O', 'collections'], p02: ['Arguments', 'Closures', 'Comprehensions', 'Sort keys', 'Decorators'], p03: ['Iterable', 'Generator', 'Pipeline', 'itertools', 'Batches'], p04: ['Class', 'dataclass', 'Property', 'Protocol', 'Design'], p05: ['Exceptions', 'with', 'Logging', 'pytest', 'Package'], p06: ['I/O or CPU', 'Threads', 'Processes', 'asyncio', 'Measure'], a01: ['Task', 'Model', 'Tools', 'Trace', 'Answer'], a02: ['Task', 'Agent', 'Grader', 'Fix', 'Lesson'], a03: ['Alert', 'MCP tools', 'Agent', 'Approval', 'Report'], a04: ['Question', 'Context layer', 'Guarded SQL', 'Read-only tools', 'Eval'], a05: ['Documents', 'Chunks', 'Vectors', 'Fresh index', 'Recall'], a06: ['Request', 'Gateway', 'Model server', 'Trace', 'Eval gate'], s00: ['Laptop', 'Docker', 'Python', 'Repo', 'Diagnostic'] };
function weekMap(m) {
  const map = (isCC(m) && ['Learn', 'Try it here', 'Practise in the terminal', 'Test, graded', 'Quiz']) || AMAPS[m] || (isS(m) ? MAPS[+m.slice(1) - 1] : null) || ['Read', 'Build', 'Break', 'Fix', 'Explain'];
  return el('section', { class: 'fig', 'aria-label': 'Mental map for module ' + modLabel(m) }, [el('div', { class: 'row' }, [el('b', { text: 'Mental map: where this module fits' }), el('span', { class: 'step', text: modLabel(m) })]),
    el('div', { class: 'flow' }, map.map((x, i) => el('span', { style: { background: PALETTE[i][0], color: PALETTE[i][1] }, text: x })).concat([el('span', { class: 'dot' })])),
    el('span', { style: { fontSize: '14.5px' } }, [el('b', { text: 'How to read it: ' }), 'each box is one part of what you build in this module, left to right in the order work flows. The chapter explains each box; the labs build it.'])]);
}

/* ---------------- Git ---------------- */
function vGit(n) {
  const G = DATA.git; n = +n || 0;
  const sc = schedule(); if (!n) { const gu = sc.units.find(u => u.kind === 'git' && !u.isDone); n = gu ? +gu.title.split(' ')[1].replace(':', '') : 1; }
  const g = G.find(x => x.n === n) || G[0];
  const u = sc.units.find(x => x.kind === 'git' && x.title.startsWith('Git ' + g.n + ':'));
  const list = el('div', { class: 'list' }, G.map(x => { const ux = sc.units.find(y => y.kind === 'git' && y.title.startsWith('Git ' + x.n + ':')); return el('a', { class: 'item', href: '#/git/' + x.n, 'aria-current': String(x.n === g.n) }, [el('span', { class: 'chip c-git', style: { flex: 'none' }, text: String(x.n) }), el('span', { class: 'grow' }, [el('span', { class: 't', text: x.title }), el('br'), el('span', { class: 's', text: ux ? 'Module ' + modLabel(ux.mid) + (ux.isDone ? ' · done' : ' · ' + shortDate(ux.day)) : '' })]), ux && ux.isDone ? el('span', { class: 'ok', text: '✓' }) : null]); }));
  const nn = String(g.n).padStart(2, '0');
  shell('Git lesson ' + g.n, 'Real-world Git · one lesson per module', [el('div', { class: 'grid2' }, [
    el('div', { class: 'stack', style: { gap: '18px' } }, [
      el('section', { class: 'card pad stack' }, [el('span', { class: 'lbl', text: 'Lesson ' + g.n + ' of ' + G.length + (u ? ' · module ' + modLabel(u.mid) + ' · 20 min' : '') }), el('h1', { style: { fontSize: '26px' }, text: g.title }), el('div', { html: mdi(g.why) })]),
      el('section', { class: 'card pad stack' }, [el('h3', { text: 'The commands' }), el('pre', { class: 'schema', style: { whiteSpace: 'pre-wrap' }, text: g.commands })]),
      el('section', { class: 'card pad stack', style: { borderColor: '#BFE3D6' } }, [el('h3', { text: 'Practise on a real broken repo' }),
        el('span', { style: { fontSize: '14.5px' }, text: 'A real Linux with git runs inside this app. The lab builds a small repository with the problem already in it, prints your task, and checks your fix. Nothing to install, on Mac, iPad or iPhone.' }),
        el('div', { class: 'row wrap' }, [el('a', { class: 'btn pri', href: '#/terminal/git/' + g.n, text: (S.gitlab || {})[g.n] ? 'Open the lab again (passed)' : 'Practise in the terminal' }), u ? el('button', { class: 'btn', onclick: () => toggleUnit(u), text: u.isDone ? 'Mark not done' : 'Mark this lesson done' }) : null]),
        el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: 'The first start downloads about 10 MB and takes a few seconds; after that it also works offline.' })]),
      el('section', { class: 'card pad stack' }, [el('h3', { text: 'The mistake people make' }), el('div', { html: mdi(g.mistake) }), el('h3', { text: 'Interview question' }), el('div', { html: mdi(g.interview) })])]),
    el('section', { class: 'card pad stack' }, [el('h3', { text: 'All Git lessons' }), list])])], { back: '#/today' });
}

/* ---------------- What is new ---------------- */
function newsAge() { const t = Date.parse((DATA.news || {}).updated || ''); return isNaN(t) ? 0 : Math.floor((Date.now() - t) / 864e5); }
function vNews() {
  const N = DATA.news || { items: [] };
  const sc = schedule(), u = sc.units.find(x => x.kind === 'news' && x.mid === sc.cur);
  shell('What is new in AI', 'Updated ' + (N.updated || '') + ' · refreshed daily', [
    newsAge() > 10 ? el('div', { class: 'hint', style: { background: 'var(--amber-l)', borderColor: 'var(--amber-b)' } }, [el('b', { text: 'These items are ' + newsAge() + ' days old. ' }), 'The weekly refresh has not run since; treat "new" with care and check the sources.']) : null, /* trust fix 22 */
    el('section', { class: 'card pad stack' }, [el('p', { style: { margin: 0 }, text: N.note || '' }), u ? el('button', { class: 'btn', style: { alignSelf: 'flex-start' }, onclick: () => toggleUnit(u), text: u.isDone ? 'Mark not done' : 'Mark this week\'s reading done' }) : null]),
    el('div', { class: 'stack' }, N.items.map(x => newsCard(x)))], { back: '#/today' });
}

/* one What is new item; also shown inside the module section it belongs to (mid, sec in data/news.json) */
function newsCard(x, cls) { return el('section', { class: cls || 'card pad stack' }, [el('b', { style: { fontSize: '18px' }, text: x.title }), el('span', { text: x.summary }), el('span', {}, [el('b', { style: { color: 'var(--plum-d)' }, text: 'Why it matters: ' }), x.why]), x.try ? el('span', {}, [el('b', { style: { color: 'var(--teal-d)' }, text: 'Test it yourself: ' }), x.try]) : null, x.url || x.source ? el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: 'Source: ' + (x.source || new URL(x.url).hostname) }) : null /* credit the source without sending you out of the app */]); }
/* items for a module's chapter: What is new (mid) and the week's company questions (recent.json mid), each placed
   under its section: sec names the heading number ("5.7"); otherwise the heading whose words match best, else the top */
function freshFor(m) { return ((DATA.news || {}).items || []).filter(x => x.mid === m).map(x => ({ kind: 'news', x, sec: x.sec, text: x.title + ' ' + x.summary })).concat(recentFor(m).filter(q => !(S.rq || {})[q.id]).map(q => ({ kind: 'rq', x: q, sec: q.sec, text: q.Q }))); }
function freshPlace(secs, f) {
  if (f.sec) { const i = secs.findIndex(s => s.head.split(' ')[0] === f.sec); if (i >= 0) return i; }
  const W = s => new Set((s.toLowerCase().match(/[a-z0-9]{4,}/g) || []).filter(w => !['with', 'from', 'that', 'this', 'what', 'your', 'when', 'into', 'have', 'does', 'design', 'data', 'would', 'which', 'there', 'their', 'they', 'them', 'than', 'then', 'each', 'more', 'about', 'only', 'also', 'like', 'need', 'used', 'using'].includes(w)));
  const fw = W(f.text); let best = -1, sc = 3;
  secs.forEach((s, i) => { const hw = W(s.head), bw = W(s.body); let n = 0; fw.forEach(w => { if (hw.has(w)) n += 3; else if (bw.has(w)) n += 1; }); if (n > sc) { sc = n; best = i; } });
  return best;
}
function freshBox(list) {
  const nq = list.filter(f => f.kind === 'rq').length, nn = list.length - nq;
  return el('details', { class: 'fresh' }, [el('summary', {}, [el('span', { class: 'lbl', text: '★ New this week · ' + [nq ? nq + (nq === 1 ? ' question asked at ' : ' questions asked at ') + [...new Set(list.filter(f => f.kind === 'rq').map(f => f.x.company))].join(', ') : '', nn ? nn + ' what is new' : ''].filter(Boolean).join(' · ') })]),
    el('div', { class: 'stack', style: { gap: '10px', marginTop: '8px' } }, list.map(f => f.kind === 'rq' ? rqCard(f.x) : newsCard(f.x, 'stack fnews')))]);
}

/* ---------------- Recent interview questions (weekly research task) ---------------- */
function recentFor(m) { return ((DATA.recent || {}).items || []).filter(q => q && q.mid === m); }
function recentOpen() { const cut = iso(new Date(Date.now() - 14 * 864e5)); return ((DATA.recent || {}).items || []).filter(q => q && q.found >= cut && !(S.rq || {})[q.id]); }
function rqCard(q) {
  const ans = mdEl(q.A || ''); ans.hidden = true;
  const dn = !!(S.rq || {})[q.id];
  const tick = el('button', { class: 'check', 'aria-pressed': String(dn), 'aria-label': (dn ? 'Not ready yet: ' : 'I can answer this: ') + q.Q, style: dn ? { background: 'var(--teal)', borderColor: 'var(--teal)', color: '#fff' } : {}, onclick: () => { S.rq = S.rq || {}; if (S.rq[q.id]) delete S.rq[q.id]; else S.rq[q.id] = iso(new Date()); save(); route(); } }, dn ? svg(I.check, 16) : null);
  const show = el('button', { class: 'btn sm', 'aria-expanded': 'false', onclick: () => { ans.hidden = !ans.hidden; show.setAttribute('aria-expanded', String(!ans.hidden)); show.textContent = ans.hidden ? 'Show model answer' : 'Hide model answer'; } }, 'Show model answer');
  const fresh = !dn && q.found >= iso(new Date(Date.now() - 14 * 864e5));
  return el('section', { class: 'card pad stack rq' }, [el('div', { class: 'row', style: { alignItems: 'flex-start' } }, [tick, el('div', { class: 'grow stack', style: { gap: '4px' } }, [
    el('div', { class: 'row wrap', style: { gap: '6px' } }, [fresh ? el('span', { class: 'chip c-dsa', text: 'New' }) : null, q.TAG ? chip(q.TAG) : null, el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: [q.company, q.level, q.asked ? 'asked ' + shortDate(q.asked) : ''].filter(Boolean).join(' · ') }),
      /^https:\/\//.test(q.url || '') ? el('a', { class: 'srcl', href: q.url, target: '_blank', rel: 'noopener', 'aria-label': 'Where this was reported: ' + (q.src || 'source') + ' (opens in a new tab)', title: q.src || 'Source', text: 'ⓘ' }) : null]),
    el('b', { style: { fontSize: '16.5px' }, html: mdi(q.Q) })])]), el('div', { class: 'row wrap' }, [show, q.mid && MOD[q.mid] ? el('a', { class: 'btn sm', href: '#/learn/' + q.mid, text: 'Module ' + modLabel(q.mid) }) : null]), ans]);
}
function vRecent() {
  const R = DATA.recent || { items: [] }, qs = (R.items || []).slice().sort((a, b) => (b.found || '').localeCompare(a.found || '') || (a.company || '').localeCompare(b.company || ''));
  const open = recentOpen().length;
  shell('Asked this week', R.updated ? 'Updated ' + shortDate(R.updated) + ' · refreshed daily' : 'Refreshed daily', [
    el('section', { class: 'card pad stack' }, [el('p', { style: { margin: 0 }, text: R.note || '' }), el('span', { class: 'muted', style: { fontSize: '14px' }, text: open ? open + ' new to work through. Tick a question only when you can answer it out loud; your plan keeps showing them until then.' : 'Nothing new to work through.' })]),
    qs.length ? el('div', { class: 'stack' }, qs.map(rqCard)) : el('section', { class: 'card pad' }, [el('p', { style: { margin: 0 }, text: 'No questions yet. The daily research task adds them here.' })])], { back: '#/today' });
}

/* ---------------- Search (⌘K or /) ---------------- */
function searchIndex() {
  const ix = [];
  MODS.forEach(m => {
    const M = MOD[m];
    ix.push([modLabel(m) + ' · ' + M.title, 'Module', '#/path/' + m]);
    M.ch.forEach((h, i) => ix.push([h, 'Chapter · ' + modLabel(m), '#/learn/' + m + '/chapter/' + i + '-' + i]));
    M.lab.forEach((h, i) => ix.push([h, 'Lab · ' + modLabel(m), '#/learn/' + m + '/lab/' + i + '-' + i]));
    (DATA.sprints[m].coding || []).forEach((c, i) => ix.push([c.TITLE, 'Coding test · ' + modLabel(m), '#/test/' + m + '/' + i]));
    (DATA.sprints[m].interview || []).forEach(q => ix.push([q.Q.replace(/[*`]/g, '').slice(0, 140), 'Interview · ' + modLabel(m), '#/interview/' + m]));
  });
  [['py', 'Python'], ['dsa', 'DSA'], ['sql', 'SQL'], ['spark', 'PySpark']].forEach(([k, n]) => DATA[k].forEach(x => ix.push([x.t, n + ' · ' + x.lv, '#/' + k + '/' + x.id])));
  DATA.git.forEach(g => ix.push([g.title, 'Git lesson ' + g.n, '#/git/' + g.n]));
  Object.keys(DATA.design).forEach(m => ix.push([DATA.design[m].title, 'Design problem · ' + modLabel(m), '#/design/' + m]));
  DATA.projects.forEach(p => ix.push([p.title, 'Project · ' + modLabel(p.mod), '#/project/' + p.id]));
  return ix;
}
function openSearch() {
  if (document.querySelector('.searchwrap')) return;
  const ix = searchIndex();
  const inp = el('input', { type: 'search', placeholder: 'Search lessons, labs, questions, Git, designs…', 'aria-label': 'Search', autocomplete: 'off', class: 'grow' });
  const list = el('div', { class: 'list', style: { maxHeight: '60vh', overflow: 'auto' } });
  const back = document.activeElement; /* focus goes back where it was when search closes */
  const close = () => { wrap.remove(); document.removeEventListener('keydown', key); if (back && back.isConnected && back.focus) back.focus(); };
  let hits = [], sel = 0;
  const paint = () => {
    const q = inp.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const RANK = ['Module', 'Chapter', 'Lab', 'Project', 'Design', 'Git', 'Coding test', 'Python', 'DSA', 'SQL', 'PySpark', 'Interview'];
    const score = x => { const t = x[0].toLowerCase(); let sc = RANK.findIndex(k => x[1].startsWith(k)) * 2; if (q.every(w => new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(t))) sc -= 6; if (t.startsWith(q[0])) sc -= 4; return sc; };
    hits = q.length ? ix.filter(x => q.every(w => (x[0] + ' ' + x[1]).toLowerCase().includes(w))).map(x => [x, score(x)]).sort((a, b) => a[1] - b[1]).map(x => x[0]).slice(0, 40) : [];
    sel = Math.min(sel, Math.max(0, hits.length - 1));
    list.textContent = '';
    if (q.length && !hits.length) list.appendChild(el('p', { class: 'muted', style: { margin: '6px 2px' }, text: 'Nothing found. Try fewer words.' }));
    hits.forEach((x, i) => list.appendChild(el('a', { class: 'item', href: x[2], 'aria-current': String(i === sel), onclick: close }, [el('span', { class: 'grow' }, [el('span', { class: 't', text: x[0] }), el('br'), el('span', { class: 's', text: x[1] })])])));
  };
  const key = e => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') { sel = Math.min(hits.length - 1, sel + 1); paint(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); paint(); e.preventDefault(); }
    else if (e.key === 'Enter' && hits[sel]) { location.hash = hits[sel][2]; close(); }
  };
  inp.addEventListener('input', () => { sel = 0; paint(); });
  document.addEventListener('keydown', key);
  const wrap = el('div', { class: 'scrim searchwrap', onclick: e => { if (e.target === wrap) close(); } }, [el('div', { class: 'dialog', role: 'dialog', 'aria-label': 'Search', style: { width: 'min(640px, 100%)', alignSelf: 'flex-start', marginTop: '8vh' } }, [el('div', { class: 'row' }, [svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', 20), inp, el('button', { class: 'btn icon sm', 'aria-label': 'Close search', onclick: close, text: '×' })]), list, el('span', { class: 'muted', style: { fontSize: '12.5px' }, text: ix.length + ' items · ↑ ↓ to move · Enter to open · Esc to close' })])]);
  document.body.appendChild(wrap); inp.focus();
}
window.addEventListener('keydown', e => {
  const t = e.target && e.target.tagName;
  if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t))) { e.preventDefault(); openSearch(); }
});

/* ---------------- Calendar export: the next 4 weeks of planned study as .ics ---------------- */
function exportIcs() {
  const sc = schedule(), t = S.settings.studyTime || '07:00', [hh, mm] = t.split(':').map(Number);
  const pad = n => String(n).padStart(2, '0'), stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const esc2 = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Data Architect//Study plan//EN', 'CALSCALE:GREGORIAN'];
  const d = new Date(); d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 28; i++) {
    const k = iso(d), us = (sc.byDay[k] || []).filter(u => !u.isDone);
    if (us.length) {
      const mins = us.reduce((a, u) => a + u.mins, 0), st = new Date(d); st.setHours(hh, mm || 0, 0, 0); const en = new Date(st.getTime() + mins * 60000);
      const f = x => x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()) + 'T' + pad(x.getHours()) + pad(x.getMinutes()) + '00';
      L.push('BEGIN:VEVENT', 'UID:data-architect-' + k + '@raghav511.github.io', 'DTSTAMP:' + stamp, 'DTSTART:' + f(st), 'DTEND:' + f(en),
        'SUMMARY:' + esc2('Data Architect · ' + mins + ' min · ' + modLabel(us[0].mid)), 'DESCRIPTION:' + esc2(us.map(u => '• ' + u.title + ' (' + u.mins + ' min)').join('\n') + '\n\nOpen: https://raghav511.github.io/de-architect/#/today'),
        'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', 'DESCRIPTION:Data Architect study block', 'END:VALARM', 'END:VEVENT');
    }
    d.setDate(d.getDate() + 1);
  }
  L.push('END:VCALENDAR');
  const a = el('a', { href: URL.createObjectURL(new Blob([L.join('\r\n')], { type: 'text/calendar' })), download: 'data-architect-plan.ics' });
  document.body.appendChild(a); a.click(); a.remove();
  toast('Calendar file ready: open it to add the next 4 weeks at ' + t + '. Re-export after big changes.', null, 6000);
}

/* ---------------- Progress: program card with streak and activity heatmap ---------------- */
function programCard() {
  const sc = schedule(), U = sc.units, done = U.filter(u => u.isDone), mins = U.reduce((a, u) => a + u.mins, 0), dm = done.reduce((a, u) => a + u.mins, 0);
  const last = U.length ? U[U.length - 1].day : sc.today;
  const per = {}; done.forEach(u => { if (u.day !== '0000-00-00') per[u.day] = (per[u.day] || 0) + u.mins; });
  /* trust fix 14: a day with coding practice, a quiz or a mock is a study day too, not only ticked plan steps */
  const active = new Set(Object.keys(per));
  const addT = t => { if (t) active.add(iso(new Date(t))); };
  Object.values(S.seen || {}).forEach(addT); Object.values(S.quiz || {}).forEach(q => addT(q.at)); Object.entries(S.mock || {}).forEach(([k, m]) => { if (m.sub || Object.values(m.a || {}).some(x => (x || '').trim())) active.add(k); });
  let streak = 0; const d = new Date(); d.setHours(0, 0, 0, 0); if (!active.has(iso(d))) d.setDate(d.getDate() - 1);
  while (active.has(iso(d))) { streak++; d.setDate(d.getDate() - 1); }
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 7 * 11 - ((start.getDay() + 6) % 7));
  const cells = [];
  for (let i = 0; i < 84; i++) { const x = new Date(start); x.setDate(start.getDate() + i); const k = iso(x), v = per[k] || 0; cells.push(el('span', { title: shortDate(k) + ': ' + v + ' min', class: 'hm' + (v >= 90 ? ' h3' : v >= 45 ? ' h2' : v > 0 || active.has(k) ? ' h1' : '') + (k === sc.today ? ' now' : '') })); }
  const stat = (n, t) => el('div', { class: 'stack', style: { gap: '0' } }, [el('b', { style: { font: '800 26px var(--display)' }, text: n }), el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: t })]);
  return el('section', { class: 'card pad stack' }, [
    el('div', { class: 'row wrap' }, [el('span', { class: 'lbl grow', text: 'Program' }), el('a', { class: 'tlink', href: '#/path', style: { fontWeight: 600, fontSize: '14px' }, text: 'Open the path ›' })]),
    el('div', { class: 'statrow' }, [stat(done.length + '/' + U.length, 'steps done'), stat(Math.round(dm / 60) + ' / ' + Math.round(mins / 60) + ' h', 'study hours'), stat(streak + (streak === 1 ? ' day' : ' days'), 'study streak'), stat(shortDate(last).slice(4), 'planned finish (week ' + weekOf(last) + ')')]),
    el('div', { class: 'bar' }, el('i', { style: { width: Math.round(100 * dm / Math.max(1, mins)) + '%' } })),
    el('span', { class: 'lbl', text: 'Last 12 weeks · minutes studied per day' }), el('div', { class: 'heat', 'aria-label': 'Study activity, last 12 weeks' }, cells),
    el('span', { class: 'muted', style: { fontSize: '13px' }, text: 'Columns are weeks, rows are Monday to Sunday. Darker means more planned minutes ticked; the lightest shade also marks days with only coding practice, a quiz or a mock.' })]);
}

/* ---------------- content updates: new steps appear, changed steps you finished come back, nothing you did is deleted ----------------
   Every step, exercise and quiz has a fingerprint of its content. The fingerprint of the version you finished is stored in S.cv.
   When an update changes something you finished, the step goes back to not done, your old completion moves to S.archive,
   and a "What's new" note on Today lists it with every new module and step. */
const RECENT_MODS = ['a04', 'a05']; /* added in 1.9.0: shown as new to anyone who had progress before this tracker existed */
function fnv(t) { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function tracked(u) { return u.kind !== 'news' && u.kind !== 'cc' && u.kind !== 'project'; } /* news changes weekly by design; graded and project work keeps its own record */
function unitHash(u) { return fnv(u.title + '|' + (u.src != null ? u.src : u.goal + '|' + u.done)); }
function exHash(x) { return fnv((x.p || '') + '|' + JSON.stringify(x.tests || x.sol || '')); }
function wasDone(uid) { const a = S.archive && S.archive.done && S.archive.done[uid]; return a ? (typeof a.at === 'string' ? a.at : iso(new Date(a.when || Date.now()))) : null; }
function openUpdates() { return Array.isArray(S.updates) ? S.updates.filter(x => x && !x.read && Array.isArray(x.items)) : []; }
function isNewUnit(u) { return openUpdates().some(x => x.items.some(i => i.uid === u.uid || (i.kind === 'module' && i.mid === u.mid))); }
function isNewMod(m) { return openUpdates().some(x => x.items.some(i => i.kind === 'module' && i.mid === m)); }
function modUpdated(m) { return openUpdates().some(x => x.items.some(i => i.mid === m && i.kind !== 'module')); }
/* synced or restored data can arrive damaged; repair the tracker's own fields instead of failing (progress fields are untouched) */
function repairTracker() {
  const obj = x => x && typeof x === 'object' && !Array.isArray(x);
  if (S.cv && !(obj(S.cv) && obj(S.cv.units) && obj(S.cv.ex) && obj(S.cv.known))) delete S.cv;
  if (!obj(S.archive)) S.archive = { done: {}, solved: {}, quiz: {} };
  ['done', 'solved', 'quiz'].forEach(k => { if (!obj(S.archive[k])) S.archive[k] = {}; });
  if (!Array.isArray(S.updates)) S.updates = [];
  S.updates = S.updates.filter(x => obj(x) && Array.isArray(x.items));
}
function reconcileContent() {
  repairTracker();
  const units = [].concat(...MODS_ALL.map(modUnits)), had = Object.keys(S.done || {}).length + Object.keys(S.solved || {}).length > 0;
  S.archive = S.archive || { done: {}, solved: {}, quiz: {} };
  if (!S.cv) {
    /* first run with the tracker: what you finished so far is the starting point, so nothing is flagged by mistake */
    S.cv = { units: {}, ex: {}, known: {} };
    units.forEach(u => { if (doneDate(u) && tracked(u)) S.cv.units[u.uid] = unitHash(u); if (!had || !RECENT_MODS.includes(u.mid)) S.cv.known[u.uid] = 1; });
    Object.keys(S.solved || {}).forEach(id => { const x = findQ(id); if (x) S.cv.ex[id] = exHash(x); });
    if (!had) { S.rqSeen = (DATA.recent || {}).updated || ''; save(false); return []; } /* a new learner starts with this week's questions, not a notice about them */
  }
  const cv = S.cv, items = [], today = iso(new Date());
  /* 1. new steps: a whole new module, or new steps inside a module you know */
  const fresh = units.filter(u => !cv.known[u.uid]), byMod = {};
  fresh.forEach(u => (byMod[u.mid] = byMod[u.mid] || []).push(u));
  Object.entries(byMod).forEach(([m, us]) => {
    const all = units.filter(u => u.mid === m).every(u => !cv.known[u.uid]);
    if (all) items.push({ kind: 'module', mid: m, title: 'New module ' + modLabel(m) + ': ' + modTitle(m), href: '#/path/' + m });
    else us.forEach(u => items.push({ kind: 'new', mid: m, uid: u.uid, title: 'New step in ' + modLabel(m) + ': ' + u.title, href: u.href }));
  });
  /* 2. steps you finished whose content changed: back to not done, the old completion kept in the archive */
  units.forEach(u => {
    const h = cv.units[u.uid]; if (!h || !tracked(u)) return;
    const now = unitHash(u); if (now === h) return;
    if (u.kind === 'quiz' && quizSame(u.mid).includes(h)) { cv.units[u.uid] = now; return; }
    delete cv.units[u.uid];
    if (!doneDate(u) && !S.done[u.uid]) return;
    S.archive.done[u.uid] = { at: S.done[u.uid] || today, h, when: Date.now() };
    delete S.done[u.uid];
    if (u.kind === 'quiz' && S.quiz[qk(u.mid)]) { S.archive.quiz[qk(u.mid)] = S.quiz[qk(u.mid)]; delete S.quiz[qk(u.mid)]; } /* your answers and score are kept, a fresh attempt starts */
    items.push({ kind: 'updated', mid: u.mid, uid: u.uid, title: 'Updated in ' + modLabel(u.mid) + ': ' + u.title, href: u.href });
  });
  /* 3. exercises you solved whose prompt or tests changed: unsolved again, your code stays in the editor */
  Object.keys(S.solved || {}).forEach(id => {
    const x = findQ(id), h = cv.ex[id]; if (!x) return;
    if (!h) { cv.ex[id] = exHash(x); return; }
    if (exHash(x) === h) return;
    S.archive.solved[id] = { h, when: Date.now() }; delete S.solved[id]; delete cv.ex[id];
    items.push({ kind: 'exercise', mid: x.m || '', id, title: 'Exercise changed: ' + x.t, href: '#/' + kindOf(id) + '/' + id });
  });
  units.forEach(u => { cv.known[u.uid] = 1; });
  if (items.length) { S.updates = [{ at: Date.now(), ver: VERSION, items, read: false }].concat(S.updates || []).slice(0, 10); }
  save(false);
  return items;
}
function whatsNewCard() {
  const ups = openUpdates(), rq = recentOpen(), seenRq = (S.rqSeen || '') >= ((DATA.recent || {}).updated || ''); if (!ups.length && (!rq.length || seenRq)) return null;
  const items = [].concat(...ups.map(x => x.items)), mods = items.filter(i => i.kind === 'module'), back = items.filter(i => i.kind === 'updated' || i.kind === 'exercise'), adds = items.filter(i => i.kind === 'new');
  const say = [mods.length && mods.length + ' new module' + (mods.length > 1 ? 's' : ''), adds.length && adds.length + ' new step' + (adds.length > 1 ? 's' : ''), back.length && back.length + ' updated step' + (back.length > 1 ? 's' : '') + ' to look at again', rq.length && !seenRq && rq.length + ' new interview question' + (rq.length > 1 ? 's' : '') + ' from this week'].filter(Boolean).join(' · ');
  const row = i => el('a', { class: 'item', href: i.href }, [el('span', { class: 'chip ' + (i.kind === 'module' || i.kind === 'new' ? 'c-dsa' : 'c-ai'), text: i.kind === 'module' || i.kind === 'new' ? 'New' : 'Updated' }), el('span', { class: 'grow t', text: i.title.replace(/^(New module |New step in |Updated in |Exercise changed: )/, '') }), el('span', { class: 's', text: 'Open ›' })]);
  const shown = (rq.length && !seenRq ? [{ kind: 'new', title: rq.length + ' interview questions asked this week (' + [...new Set(rq.map(q => q.company))].slice(0, 5).join(', ') + ')', href: '#/recent' }] : []).concat(mods, back, adds), more = shown.length - 6;
  /* one line on Today so the plan stays on the first screen; the list opens in place */
  const body = el('div', { class: 'stack', id: 'wn_list', hidden: 'hidden', style: { gap: '8px' } }, [
    el('span', { class: 'muted', style: { fontSize: '14px' }, text: (back.length ? 'Nothing you did is lost: steps you had finished that changed are marked Updated, and your earlier work is kept. ' : 'They are added to your plan. ') + 'Got it only hides this note: new and updated parts stay not done until you open them and finish or tick them yourself.' }),
    el('div', { class: 'list' }, shown.slice(0, 6).map(row)),
    more > 0 ? el('span', { class: 'muted', style: { fontSize: '13px' }, text: 'and ' + more + ' more, tagged New or Updated on the Path.' }) : null]);
  const see = el('button', { class: 'btn sm', 'aria-expanded': 'false', 'aria-controls': 'wn_list', onclick: () => { body.hidden = !body.hidden; see.setAttribute('aria-expanded', String(!body.hidden)); see.textContent = body.hidden ? 'See' : 'Hide'; }, text: 'See' });
  return el('section', { class: 'card stack whatsnew', role: 'status' }, [
    el('div', { class: 'row', style: { gap: '8px' } }, [el('span', { class: 'grow' }, [el('b', { text: 'What is new: ' }), say]), see, el('button', { class: 'btn sm', onclick: () => { (S.updates || []).forEach(x => { x.read = true; }); S.rqSeen = (DATA.recent || {}).updated || ''; save(); route(); }, text: 'Got it' })]),
    body]);
}
