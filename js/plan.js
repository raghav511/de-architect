/* Data Architect 1.5 · modules, units and the time-boxed scheduler.
   Loaded before app.js; uses its globals (S, DATA, el, svg, I, shell, chip, save, iso, ...) at call time. */
'use strict';
/* Diagnostic first, then the Python track interleaved with the AI modules, then data modelling, then data engineering. */
const BASE_MODS = ['s00', 'p01', 'p02', 'a01', 'p03', 'p04', 'a02', 'p05', 'p06', 'a03', 'm01', 'm02', 'm03', 's01', 's02', 's03', 's04', 'd01', 's05', 's06', 's07', 'j01', 's08', 's09', 's10', 'r01', 's11', 's12'];
let MODS = BASE_MODS.slice();
const MOD = {};
const DN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const midOf = x => { x = String(x == null ? '' : x); return /^\d+$/.test(x) ? 's' + x.padStart(2, '0') : x; };
const isS = m => /^s\d\d$/.test(m);
const qk = m => isS(m) ? +m.slice(1) : m; /* state keys stay compatible with v1.1 (numbers for DE modules) */
function modLabel(m) { const k = m[0], n = +m.slice(1); return k === 'a' ? 'AI ' + n : k === 'p' ? 'Python ' + n : k === 'm' ? 'Modelling ' + n : k === 'j' ? 'Platform ' + n : k === 'd' ? 'Systems ' + n : k === 'r' ? 'Leadership ' + n : k === 's' ? (n === 0 ? 'Setup' : 'DE ' + n) : 'Extra ' + n; }
function modTitle(m) { return (MOD[m] && MOD[m].title) || modLabel(m); }
function modColor(m) { return m[0] === 'a' ? 'c-ai' : m[0] === 'p' ? 'c-py' : m[0] === 'm' || m[0] === 'r' ? 'c-arch' : m[0] === 'j' || m[0] === 'd' ? 'c-core' : m[0] === 's' ? 'c-core' : 'c-arch'; }
function dayName(k) { const d = new Date(k + 'T00:00:00'); return DN[(d.getDay() + 6) % 7]; }
function shortDate(k) { const d = new Date(k + 'T00:00:00'); return DN[(d.getDay() + 6) % 7].slice(0, 3) + ' ' + d.getDate() + ' ' + d.toLocaleString('en', { month: 'short' }); }
function weekOf(k) { const s = new Date(S.start + 'T00:00:00'), d = new Date(k + 'T00:00:00'); return Math.max(1, Math.floor(Math.round((d - s) / 864e5) / 7) + 1); }
function capOf(d) { const we = d.getDay() === 0 || d.getDay() === 6; return we ? (+S.settings.capWe || 120) : (+S.settings.capWd || 60); }

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
  const [ext, design, git, news] = await Promise.all([opt('data/extensions.json'), opt('data/design.json'), opt('data/git.json'), opt('data/news.json')]);
  DATA.design = design || {}; DATA.git = git || []; DATA.news = news || { items: [] };
  MODS = BASE_MODS.concat(((ext && ext.modules) || []).filter(m => /^x\d\d$/.test(m)));
  await Promise.all(MODS.map(m => sprint(m).catch(() => null)));
  MODS = MODS.filter(m => DATA.sprints[m]);
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
    const ex = /^(py|sql|spark):(\d+)-(\d+)$/.exec(t.tab);
    if (ex) {
      /* Python and SQL exercises run in the browser editor; the step ticks itself when all of them pass */
      const k = ex[1], xs = DATA[k].filter(x => x.m === m).slice(+ex[2] - 1, +ex[3]), nx = xs.find(x => !S.solved[x.id]) || xs[0];
      add({ uid: m + ':' + t.id, kind: 'build', mins: Math.min(60, mins), title: t.title, goal: 'Exercises: ' + xs.map(x => x.t).join(' · ') + '. Each one runs real tests in your browser.', done: t.done, href: nx ? '#/' + k + '/' + nx.id : '#/practice/' + (k === 'py' ? 'py' : 'model'), cta: 'Code', auto: () => xs.length > 0 && xs.every(x => S.solved[x.id]) });
      return;
    }
    if (t.tab.startsWith('chapter')) {
      const r = /chapter:(\d+)-(\d+)/.exec(t.tab), nH = Math.max(1, M.ch.length);
      let ranges;
      if (r) ranges = [[+r[1], +r[2]]];
      else { const p = Math.min(Math.max(1, Math.ceil(mins / 45)), nH); ranges = []; for (let k = 0; k < p; k++) ranges.push([Math.floor(k * nH / p), Math.floor((k + 1) * nH / p) - 1]); }
      ranges.forEach((rg, k) => add({ uid: m + ':' + t.id + (ranges.length > 1 ? '.' + (k + 1) : ''), kind: 'learn', mins: Math.round(mins / ranges.length), title: ranges.length > 1 ? 'Chapter ' + (isS(m) ? +m.slice(1) + ' ' : '') + 'part ' + (k + 1) + ' of ' + ranges.length : t.title, goal: 'Read: ' + M.ch.slice(rg[0], rg[1] + 1).join(' · '), done: t.done, href: '#/learn/' + m + '/chapter/' + rg[0] + '-' + rg[1], cta: 'Read' }));
    } else if (t.tab === 'lab') {
      const k = bestH2(M.lab, t.title), n = Math.max(1, Math.ceil(mins / 60));
      for (let i = 0; i < n; i++) add({ uid: m + ':' + t.id + (n > 1 ? '.' + (i + 1) : ''), kind: t.type === 'ai' ? 'ai' : t.type === 'incident' ? 'incident' : 'build', mins: Math.round(mins / n), title: t.title + (n > 1 ? ' · session ' + (i + 1) + ' of ' + n : ''), goal: (k >= 0 ? 'Lab: ' + M.lab[k] + '. ' : '') + (n > 1 ? (i === 0 ? 'Read the whole lab first, then start the steps.' : 'Pick up where your notes say you stopped.') : 'Follow the lab steps in order.'), done: n > 1 && i < n - 1 ? 'You stop at a working checkpoint and write one line in notes/progress.md saying where you are.' : t.done, href: '#/learn/' + m + '/lab' + (k >= 0 ? '/' + k + '-' + k : ''), cta: 'Open lab', links: pj && pj.env === 'ai' ? [['Project and environment', '#/project/' + pj.id]] : [] });
    } else if (t.tab === 'practice') add({ uid: m + ':' + t.id, kind: 'practice', mins: Math.min(mins, 30), title: t.title, goal: (M.pr.length ? 'Warm-ups: ' + M.pr.join(' · ') + '. ' : '') + (mins > 30 ? 'The SQL and DSA warm-ups also count toward the coding track, so only the drill sits in this hour.' : ''), done: t.done, href: '#/learn/' + m + '/practice', cta: 'Practise' });
    else if (t.tab === 'quiz') add({ uid: m + ':' + t.id, kind: 'quiz', mins: Math.max(20, mins), title: t.title, goal: 'Multiple choice, fill in the blank and short answers on this module. No notes.', done: t.done, href: '#/quiz/' + m, cta: 'Start', auto: () => S.quiz[qk(m)] && S.quiz[qk(m)].sub });
    else if (t.tab === 'mock') { const n = Math.max(1, Math.ceil(mins / 60)); for (let i = 0; i < n; i++) add({ uid: m + ':' + t.id + '.' + (i + 1), kind: 'talk', mins: Math.round(mins / n), title: t.title + ' · session ' + (i + 1) + ' of ' + n, goal: 'One full mock loop under time, then score it with the rubric and write one repair action.', done: i === n - 1 ? t.done : 'One loop done and scored, with a repair action written down.', href: '#/interview/' + m + '/mock', cta: 'Open mock' }); }
    else if (t.tab === 'interview') add({ uid: m + ':' + t.id, kind: 'talk', mins: Math.min(60, mins), title: t.title, goal: 'Answer each question out loud first, then open the model answer and tick the ones you nailed.', done: t.done, href: '#/interview/' + m, cta: 'Practise' });
    else add({ uid: m + ':' + t.id, kind: 'learn', mins: Math.min(60, mins), title: t.title, goal: '', done: t.done, href: '#/learn/' + m + '/chapter', cta: 'Open' });
  });
  const lastLearn = U.map(u => u.kind).lastIndexOf('learn');
  const learn = U.filter(u => u.kind === 'learn'); if (learn.length) learn[learn.length - 1].links.push(['Readings', '#/learn/' + m + '/readings']);
  const g = DATA.git.length ? DATA.git[MODS.indexOf(m) % DATA.git.length] : null;
  if (g) U.splice(lastLearn + 1, 0, { mid: m, uid: m + ':git', kind: 'git', mins: 20, title: 'Git ' + g.n + ': ' + g.title, goal: g.why.replace(/`/g, ''), done: 'bash labs/git/gitlab.sh check ' + g.n + ' prints PASS for every line.', href: '#/git/' + g.n, cta: 'Open', links: [] });
  const D = DATA.design[m], qi = U.findIndex(u => u.kind === 'quiz'), at = qi < 0 ? U.length : qi;
  const extra = [];
  if (D) extra.push({ mid: m, uid: m + ':design', kind: 'design', mins: 40, title: 'Design problem: ' + D.title, goal: D.prompt, done: D.deliverable, href: '#/design/' + m, cta: 'Design', links: [] });
  extra.push({ mid: m, uid: m + ':news', kind: 'news', mins: 15, title: 'What is new in AI this week', goal: (DATA.news.items[0] ? DATA.news.items.slice(0, 3).map(x => x.title).join(' · ') : 'Short items on new AI developments, each with how to test the claim.'), done: 'You can say in two sentences what changed and how you would test it on your own eval set.', href: '#/news', cta: 'Read', links: [] });
  U.splice(at, 0, ...extra);
  if (pj && pj.env !== 'ai') {
    if (pj.status === 'ready') [1, 2].forEach(i => U.push({ mid: m, uid: m + ':proj.' + i, kind: 'project', mins: 60, title: 'Project: ' + pj.title + ' · session ' + i + ' of 2', goal: pj.goal, done: i === 2 ? 'make check passes for this week\'s milestones and you pasted the code into the project page.' : 'The environment is up and the first milestone passes.', href: '#/project/' + pj.id, cta: 'Build', links: [], auto: () => (pj.ms || []).length && pj.ms.every(x => msDone(pj.id)[x[0]]) }));
    else U.push({ mid: m, uid: m + ':proj', kind: 'project', mins: 30, title: 'Project brief: ' + pj.title, goal: pj.goal, done: 'You wrote the architecture in five boxes and listed the three riskiest parts. The full environment comes in a later update.', href: '#/project/' + pj.id, cta: 'Read', links: [] });
  }
  return U;
}
function doneDate(u) { const v = S.done[u.uid]; if (typeof v === 'string') return v; if (v) return '0000-00-00'; return u.auto && u.auto() ? '0000-00-00' : null; }
function schedule() {
  const units = [].concat(...MODS.map(modUnits));
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const byDay = {}, used = {};
  const put = (k, u) => { (byDay[k] = byDay[k] || []).push(u); used[k] = (used[k] || 0) + u.mins; u.day = k; };
  units.forEach(u => { const d = doneDate(u); u.isDone = !!d; if (d) put(d, u); });
  const cur = new Date(t), q = units.filter(u => !u.isDone); let guard = 0;
  /* pack in order; when the next step does not fit, a short Git or news step from the same module may fill the gap */
  while (q.length && guard++ < 6000) {
    const k = iso(cur), rem = capOf(cur) - (used[k] || 0), u = q[0];
    if (u.mins <= rem + 5 || !(used[k] > 0)) { put(k, q.shift()); continue; }
    const fi = q.findIndex((x, i) => i > 0 && i < 8 && x.mid === u.mid && (x.kind === 'git' || x.kind === 'news') && x.mins <= rem + 5);
    if (fi > 0) { put(k, q.splice(fi, 1)[0]); continue; }
    cur.setDate(cur.getDate() + 1);
  }
  const span = {};
  units.forEach(u => { const s = span[u.mid] = span[u.mid] || { first: null, last: null, n: 0, done: 0, mins: 0 }; if (u.day !== '0000-00-00') { if (!s.first || u.day < s.first) s.first = u.day; if (!s.last || u.day > s.last) s.last = u.day; } s.n++; s.mins += u.mins; if (u.isDone) s.done++; });
  const next = units.find(u => !u.isDone);
  return { units, byDay, used, span, today: iso(t), cur: next ? next.mid : MODS[MODS.length - 1], next };
}
function curMid() { return schedule().cur; }
function weeksText(sp) { if (!sp || !sp.first) return 'done'; const a = weekOf(sp.first), b = weekOf(sp.last); return (a === b ? 'Week ' + a : 'Weeks ' + a + '–' + b) + ' · ' + shortDate(sp.first) + (sp.first !== sp.last ? ' – ' + shortDate(sp.last) : ''); }
const KIND = { learn: ['Lesson', 'c-core'], build: ['Lab', 'c-dsa'], ai: ['AI lab', 'c-ai'], incident: ['Incident', 'c-spark'], practice: ['Drill', 'c-sql'], quiz: ['Quiz', 'c-test'], talk: ['Interview', 'c-test'], git: ['Git', 'c-git'], design: ['Design', 'c-arch'], news: ['What is new', 'c-ai'], project: ['Project', 'c-dsa'] };
function kchip(k) { const c = KIND[k] || [k, 'c-test']; return el('span', { class: 'chip ' + c[1], text: c[0] }); }
function toggleUnit(u) { S.undone = S.undone || {}; S.doneAt = S.doneAt || {}; if (S.done[u.uid] || u.isDone) { delete S.done[u.uid]; S.undone[u.uid] = Date.now(); if (u.auto && u.auto()) toast('This one is marked done automatically (quiz submitted or milestones verified).'); } else { S.done[u.uid] = iso(new Date()); S.doneAt[u.uid] = Date.now(); delete S.undone[u.uid]; } save(); route(); }

/* one unit as a card: what, why, done when, where */
function unitCard(u, opts) {
  opts = opts || {};
  return el('div', { class: 'unit' + (u.isDone ? ' done' : '') }, [
    el('button', { class: 'check', 'aria-pressed': String(!!u.isDone), 'aria-label': (u.isDone ? 'Mark not done: ' : 'Mark done: ') + u.title, onclick: () => toggleUnit(u) }, u.isDone ? svg(I.check, 16) : null),
    el('div', { class: 'grow stack', style: { gap: '5px', minWidth: 0 } }, [
      el('div', { class: 'row wrap', style: { gap: '6px' } }, [kchip(u.kind), el('span', { class: 'chip ' + modColor(u.mid), style: { background: 'transparent', border: '1px solid currentColor' }, text: modLabel(u.mid) }), el('span', { class: 'mins', text: u.mins + ' min' }), opts.day ? el('span', { class: 'muted', style: { fontSize: '13px' }, text: opts.day }) : null]),
      el('span', { class: 't', text: u.title }),
      u.goal ? el('span', { class: 'goal', text: u.goal }) : null,
      u.done && !opts.compact ? el('span', { class: 'dw' }, [el('b', { text: 'Done when: ' }), u.done]) : null,
      el('div', { class: 'row wrap', style: { gap: '8px', marginTop: '2px' } }, [el('a', { class: 'btn sm pri', href: u.href, text: u.cta })].concat(u.links.map(([t, h]) => el('a', { class: 'btn sm', href: h, text: t }))))])]);
}
function codingTrack(off) {
  const ci = dayIndex() + (off || 0), w = Math.floor(ci / 7) % 12 + 1, d = ci % 7;
  const ds = byWeek(DATA.dsa, w), qs = byWeek(DATA.sql, w), ps = byWeek(DATA.spark, w);
  const SQ = [0, null, 1, 2, 3, 4, null], SP = [null, 0, 1, 2, 3, null, 4];
  const items = [];
  const due = off ? [] : revDue();
  due.slice(0, 3).forEach(x => items.push([kindOf(x.id), x, 'review', '#/' + kindOf(x.id) + '/' + x.id + '/review', 'Review · ' + revText(S.rev[x.id])]));
  if (ds[d]) items.push(['dsa', ds[d], '20 min', '#/dsa/' + ds[d].id, 'DSA · ' + WEEKS[w - 1][4] + ' · ' + ds[d].lv]);
  if (SQ[d] != null && qs[SQ[d]]) items.push(['sql', qs[SQ[d]], '15 min', '#/sql/' + qs[SQ[d]].id, 'SQL · ' + (qs[SQ[d]].k === 'O' ? 'optimize' : 'write') + ' · ' + qs[SQ[d]].lv]);
  if (SP[d] != null && ps[SP[d]]) items.push(['spark', ps[SP[d]], '15 min', '#/spark/' + ps[SP[d]].id, 'PySpark · ' + (ps[SP[d]].k === 'O' ? 'optimize' : 'write') + ' · ' + ps[SP[d]].lv]);
  return el('section', { class: 'card pad stack', style: { borderColor: '#BFE3D6' } }, [
    el('div', { class: 'row wrap' }, [el('h2', { class: 'grow', text: 'Coding track' }), el('span', { class: 'chip c-dsa', text: 'separate from the hour' })]),
    el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'One DSA problem a day plus SQL and PySpark, on their own time. Problems you struggled with come back here for review after 3, 7 and 21 days.' }),
    el('div', { class: 'list' }, items.map(([k, x, mins, href, sub]) => el('a', { class: 'item', href }, [chip(k), el('span', { class: 'grow' }, [el('span', { class: 't', text: x.t }), el('br'), el('span', { class: 's', text: mins === 'review' ? sub : mins + ' · ' + sub })]), mins === 'review' ? el('span', { class: 's', text: 'Review ›' }) : S.solved[x.id] ? el('span', { class: 'ok', text: '✓' }) : el('span', { class: 's', text: 'Open ›' })]))),
    due.length > 3 ? el('a', { href: '#/practice/review', style: { fontWeight: 600, fontSize: '14px' }, text: (due.length - 3) + ' more reviews due ›' }) : null,
    el('a', { href: '#/practice/tests', style: { fontWeight: 600, fontSize: '14px' }, text: 'Timed coding tests (60 min, one per module, any day you like) ›' })]);
}
function weekStrip(sc, k0) {
  const d0 = new Date(k0 + 'T00:00:00'); d0.setDate(d0.getDate() - ((d0.getDay() + 6) % 7));
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(d0); d.setDate(d0.getDate() + i); days.push(d); }
  return el('div', { class: 'wkstrip' }, days.map(d => {
    const k = iso(d), us = sc.byDay[k] || [], off = Math.round((d - t) / 864e5), mins = us.reduce((a, u) => a + u.mins, 0);
    return el('a', { class: 'wkday' + (k === sc.today ? ' today' : '') + (k === k0 ? ' sel' : '') + (off < 0 ? ' past' : ''), href: '#/today/' + off, 'aria-label': dayName(k) + ' ' + shortDate(k) }, [
      el('div', { class: 'row' }, [el('b', { class: 'grow', text: DN[(d.getDay() + 6) % 7].slice(0, 3) + ' ' + d.getDate() }), el('span', { class: 's', text: mins + '/' + capOf(d) })]),
      el('div', { class: 'stack', style: { gap: '3px' } }, us.length ? us.map(u => el('span', { class: 'wu' + (u.isDone ? ' ok' : ''), title: u.title, text: (u.isDone ? '✓ ' : '') + (KIND[u.kind] || [u.kind])[0] + ' · ' + u.title })) : [el('span', { class: 's', text: off < 0 ? '—' : 'free' })])]);
  }));
}

/* ---------------- Today ---------------- */
function vToday(off) {
  off = +off || 0;
  const sc = schedule();
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + off);
  const k = iso(d), cap = capOf(d), us = sc.byDay[k] || [];
  const doneMins = us.filter(u => u.isDone).reduce((a, u) => a + u.mins, 0), planMins = us.reduce((a, u) => a + u.mins, 0);
  const m = (us[0] && us[0].mid) || sc.cur, M = MOD[m], sp = sc.span[m];
  const hr = new Date().getHours();
  const nav = el('div', { class: 'row wrap', style: { gap: '8px' } }, [
    el('a', { class: 'btn icon sm', href: '#/today/' + (off - 1), 'aria-label': 'Previous day' }, svg(I.back, 18)),
    el('b', { style: { fontSize: '17px' }, text: (off === 0 ? 'Today · ' : off === 1 ? 'Tomorrow · ' : off === -1 ? 'Yesterday · ' : '') + dayName(k) + ' ' + shortDate(k).slice(4) }),
    el('a', { class: 'btn icon sm', href: '#/today/' + (off + 1), 'aria-label': 'Next day' }, svg(I.fwd, 18)),
    off ? el('a', { class: 'btn sm', href: '#/today', text: 'Back to today' }) : null,
    el('span', { class: 'grow' }),
    el('span', { class: 'chip ' + (cap > 60 ? 'c-arch' : 'c-core'), text: (cap >= 120 ? cap / 60 + '-hour' : cap + '-minute') + ' day' })]);
  const plan = el('section', { class: 'card pad stack' }, [
    el('div', { class: 'row wrap' }, [el('h2', { class: 'grow', text: off === 0 ? 'Your plan for today' : 'Plan for ' + dayName(k) }), el('span', { class: 'muted', text: doneMins + ' of ' + planMins + ' min done' })]),
    el('div', { class: 'bar' }, el('i', { style: { width: (planMins ? Math.round(100 * doneMins / planMins) : 0) + '%' } })),
    el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'Do these in order. Each card says what to do, how you know it is done, and opens the exact section. Anything you do not finish moves to the next free day automatically.' })]
    .concat(us.length ? us.map(u => unitCard(u)) : [el('p', { style: { margin: 0 }, text: off < 0 ? 'Nothing was done on this day.' : 'Nothing planned. Everything is done.' })])
    .concat(off === 0 && us.length && us.every(u => u.isDone) && sc.next ? [el('div', { class: 'hint' }, [el('b', { text: 'Done for today. ' }), 'Want to keep going? Next up: ' + sc.next.title + ' (planned ' + shortDate(sc.next.day) + '). ', el('a', { href: sc.next.href, text: 'Start it now' })])] : []));
  const D = DATA.design[m], du = sc.units.find(u => u.uid === m + ':design');
  const modCard = el('section', { class: 'card pad stack' }, [
    el('div', { class: 'row wrap', style: { gap: '6px' } }, [el('span', { class: 'chip ' + modColor(m), text: 'Module ' + modLabel(m) }), el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: weeksText(sp) })]),
    el('b', { style: { fontSize: '18px' }, text: M ? M.title : '' }), el('span', { style: { fontSize: '14.5px' }, text: M ? M.goal : '' }),
    el('div', { class: 'row' }, [el('div', { class: 'bar grow' }, el('i', { style: { width: (sp ? Math.round(100 * sp.done / sp.n) : 0) + '%' } })), el('b', { text: sp ? sp.done + '/' + sp.n : '' })]),
    modLinks(m), el('a', { class: 'btn', href: '#/path/' + m, style: { alignSelf: 'flex-start' }, text: 'See every step of this module' })]);
  const desCard = D ? el('section', { class: 'card pad stack', style: { borderColor: '#D9C6E6' } }, [
    el('div', { class: 'row wrap', style: { gap: '6px' } }, [el('span', { class: 'lbl grow', style: { color: 'var(--plum-d)' }, text: 'Design problem · module ' + modLabel(m) }), el('span', { class: 'chip c-arch', text: du ? (du.isDone ? 'done' : (du.day === sc.today ? 'today' : 'planned ' + shortDate(du.day))) + ' · 40 min' : '40 min' })]),
    el('b', { style: { fontSize: '17px' }, text: D.title }), el('span', { style: { fontSize: '14.5px' }, text: D.prompt }), el('span', { class: 'muted', style: { fontSize: '14px' } }, [el('b', { text: 'Hand in: ' }), D.deliverable]),
    el('a', { class: 'btn', href: '#/design/' + m, style: { alignSelf: 'flex-start' }, text: 'Open in the design studio' })]) : null;
  const nx = off === 0 ? (us.find(u => !u.isDone) || sc.next) : null;
  const hero = nx ? el('section', { class: 'hero' }, [el('div', { class: 'grow stack', style: { gap: '3px', minWidth: '200px' } }, [el('span', { class: 'lbl', text: (us.includes(nx) ? 'Up next' : 'Ahead of plan · next') + ' · ' + nx.mins + ' min · module ' + modLabel(nx.mid) }), el('b', { text: nx.title })]), el('a', { class: 'btn', href: nx.href, text: nx.cta + ' ›' })]) : null;
  shell(off === 0 ? 'Today' : 'Plan · ' + shortDate(k), 'Module ' + modLabel(m) + ' · ' + weekText(k), [
    el('div', { class: 'stack', style: { gap: '4px' } }, [el('h1', { text: (hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + ', Raghavendra' }), el('span', { class: 'muted', text: (+S.settings.capWd || 60) + ' min on weekdays, ' + (+S.settings.capWe || 120) + ' on Saturday and Sunday (change in Settings). Coding practice runs on its own track.' })]),
    hero,
    nav,
    el('div', { class: 'grid2' }, [plan, el('div', { class: 'stack', style: { gap: '18px' } }, [off === 0 ? coachCard() : null, modCard, codingTrack(off), desCard])]),
    el('section', { class: 'card pad stack' }, [el('div', { class: 'row wrap' }, [el('h2', { class: 'grow', text: 'This week' }), el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'minutes planned / budget · tap a day to see it' }), el('button', { class: 'btn sm', onclick: exportIcs, text: 'Add to calendar' })]), weekStrip(sc, k)])]);
}
function weekText(k) { return 'Week ' + weekOf(k); }
function modLinks(m) {
  const pj = DATA.projects.find(p => p.mod === m), M = MOD[m] || {};
  const R = (DATA.sprints[m] || {}).raw || {}, has = k => (R[k] || '').trim().length > 0;
  const L = [['Chapter', '#/learn/' + m + '/chapter'], has('readings') && ['Readings', '#/learn/' + m + '/readings'], has('lab') && ['Labs', '#/learn/' + m + '/lab'], has('practice') && ['Warm-ups', '#/learn/' + m + '/practice'], has('quiz') && ['Quiz', '#/quiz/' + m], has('interview') && ['Interview', '#/interview/' + m], has('mock') && ['Mock', '#/interview/' + m + '/mock']].filter(Boolean);
  const g = DATA.git.length ? DATA.git[MODS.indexOf(m) % DATA.git.length] : null; if (g) L.push(['Git ' + g.n, '#/git/' + g.n]);
  if (DATA.design[m]) L.push(['Design', '#/design/' + m]);
  if (pj) L.push(['Project', '#/project/' + pj.id]);
  if (M.coding) L.push(['Coding test', '#/practice/tests']);
  if (DATA.py.some(x => x.m === m)) L.push(['Python exercises', '#/practice/py']);
  if (DATA.sql.some(x => x.m === m) || DATA.spark.some(x => x.m === m)) L.push(['Module exercises', '#/practice/model']);
  return el('div', { class: 'row wrap', style: { gap: '6px' } }, L.map(([t, h]) => el('a', { class: 'btn sm', href: h, text: t })));
}

/* ---------------- Path ---------------- */
function vPath(m) {
  const sc = schedule();
  m = MOD[midOf(m)] ? midOf(m) : sc.cur;
  const M = MOD[m], sp = sc.span[m], us = sc.units.filter(u => u.mid === m);
  const pick = el('nav', { class: 'modpick', 'aria-label': 'Modules' }, MODS.map(x => { const s = sc.span[x] || {}; return el('a', { href: '#/path/' + x, 'aria-current': String(x === m), class: (x === sc.cur ? 'cur ' : '') + (s.n && s.done === s.n ? 'fin ' : '') + modColor(x), text: modLabel(x) }); }));
  const total = us.reduce((a, u) => a + u.mins, 0);
  const head = el('section', { class: 'card pad stack' }, [
    el('div', { class: 'row wrap', style: { gap: '6px' } }, [el('span', { class: 'chip ' + modColor(m), text: 'Module ' + modLabel(m) }), el('span', { class: 'muted', style: { fontSize: '14px' }, text: weeksText(sp) + ' · ' + Math.round(total / 6) / 10 + ' h in the daily hour' + (M.coding ? ' + coding' : '') })]),
    el('h1', { text: M.title }), el('p', { style: { margin: 0, fontSize: '16px' }, text: M.goal }),
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
  const road = el('section', { class: 'card pad stack' }, [el('div', { class: 'row wrap' }, [el('h2', { class: 'grow', text: 'Roadmap' }), el('button', { class: 'btn sm', onclick: async () => { const v = await confirmBox('Restart the calendar?', 'Week 1 becomes this week. Your progress is kept; only the week numbers change.', [{ t: 'Make this week 1', cls: 'pri', v: 1 }, { t: 'Cancel', v: null }]); if (v) { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); S.start = iso(d); save(); route(); } }, text: 'Make this week 1' })]),
    el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'Setup and the diagnostic first, then the Python track (Python 1–6) woven between the AI modules (AI 1–3), then data modelling (Modelling 1–3), then the data engineering modules, with Systems 1 (distributed systems and storage internals) after DE 4, Platform 1 (Scala, the JVM, Kubernetes and Hadoop) after DE 7 and Leadership 1 (strategy, migrations, cost, influence) after DE 10. A module ends when its steps are done, not on a fixed week. After the last module, new Extra modules arrive every week: big-tech papers and problems, plus fresh questions on earlier topics.' }),
    el('div', { class: 'list' }, MODS.map(x => { const s = sc.span[x]; return el('a', { class: 'item', href: '#/path/' + x }, [el('span', { class: 'chip ' + modColor(x), style: { flex: 'none', minWidth: '62px', justifyContent: 'center' }, text: modLabel(x) }), el('span', { class: 'grow' }, [el('span', { class: 't', text: modTitle(x) }), el('br'), el('span', { class: 's', text: weeksText(s) })]), el('span', { class: 's', style: { fontWeight: 700, flex: 'none' }, text: s.done === s.n ? '✓ done' : x === sc.cur ? 'now · ' + s.done + '/' + s.n : s.done + '/' + s.n })]); }))]);
  setTimeout(() => { const c = pick.querySelector('[aria-current=true]'); if (c && pick.scrollWidth > pick.clientWidth) pick.scrollLeft = c.offsetLeft - 16; }, 0);
  shell('Path', 'Module ' + modLabel(m) + ' · ' + MODS.length + ' modules so far', [pick, el('div', { class: 'grid2 wide' }, [el('div', { class: 'stack', style: { gap: '18px' } }, [head, steps]), el('div', { class: 'stack', style: { gap: '18px' } }, [road])])].concat(extra));
}

/* ---------------- Learn ---------------- */
async function vLearn(m, tab, range) {
  m = MOD[midOf(m)] ? midOf(m) : curMid();
  const TABS2 = [['chapter', 'Chapter'], ['readings', 'Readings'], ['lab', 'Labs'], ['practice', 'Warm-ups']];
  const tabs = el('div', { class: 'tabs', role: 'tablist' }, TABS2.map(([k, n]) => el('button', { role: 'tab', 'aria-selected': String(k === tab), onclick: () => { location.hash = '#/learn/' + m + '/' + k; }, text: n })));
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
  const hs = ch.querySelectorAll('h2');
  if (hs.length > 1) {
    const toc = el('nav', { class: 'toc', 'aria-label': 'Sections' });
    hs.forEach((h, i) => { h.id = 'sec' + i; toc.appendChild(el('a', { href: '#', text: h.textContent, onclick: e => { e.preventDefault(); h.scrollIntoView({ behavior: 'smooth', block: 'start' }); } })); });
    body.appendChild(el('details', { class: 'card pad', open: matchMedia('(min-width:900px)').matches ? 'open' : null }, [el('summary', { class: 'lbl', style: { cursor: 'pointer' }, text: 'Sections (' + hs.length + ')' }), toc]));
  }
  if (tab === 'readings') { body.appendChild(el('section', { class: 'card pad stack' }, [el('h2', { text: 'Read deeper' }), isS(m) && +m.slice(1) > 0 ? el('p', { class: 'muted', style: { margin: 0 }, text: 'Books: ' + WEEKS[+m.slice(1) - 1][5] }) : null, ch])); if (isS(m)) body.appendChild(videoCard(+m.slice(1))); }
  else body.appendChild(el('article', { class: 'card pad' }, ch));
  const nextTab = { chapter: 'readings', readings: 'lab', lab: 'practice' }[tab];
  body.appendChild(el('div', { class: 'row wrap' }, [el('a', { class: 'btn', href: '#/today', text: 'Back to today\'s plan' }), nextTab ? el('a', { class: 'btn', href: '#/learn/' + m + '/' + nextTab, text: 'Next: ' + TABS2.find(t => t[0] === nextTab)[1] }) : el('a', { class: 'btn', href: '#/quiz/' + m, text: 'Next: Quiz' })]));
}
const AMAPS = { d01: ['Storage engine', 'Replication', 'Partitioning', 'Transactions', 'Consensus'], j01: ['Scala', 'Spark API', 'JVM memory', 'Kubernetes', 'Paved path'], r01: ['Strategy', 'Design doc', 'Migration', 'Cost', 'Influence'], m01: ['Process', 'Grain', 'Dimensions', 'History (SCD)', 'Cumulative'], m02: ['Event', 'Grain', 'Fact type', 'Dedupe', 'Reduced'], m03: ['Raw', 'Cleaned', 'Business', 'Serving', 'Semantic'], p01: ['Objects', 'Lists', 'Dicts and sets', 'Big-O', 'collections'], p02: ['Arguments', 'Closures', 'Comprehensions', 'Sort keys', 'Decorators'], p03: ['Iterable', 'Generator', 'Pipeline', 'itertools', 'Batches'], p04: ['Class', 'dataclass', 'Property', 'Protocol', 'Design'], p05: ['Exceptions', 'with', 'Logging', 'pytest', 'Package'], p06: ['I/O or CPU', 'Threads', 'Processes', 'asyncio', 'Measure'], a01: ['Task', 'Model', 'Tools', 'Trace', 'Answer'], a02: ['Task', 'Agent', 'Grader', 'Fix', 'Lesson'], a03: ['Alert', 'MCP tools', 'Agent', 'Approval', 'Report'], s00: ['Laptop', 'Docker', 'Python', 'Repo', 'Diagnostic'] };
function weekMap(m) {
  const map = AMAPS[m] || (isS(m) ? MAPS[+m.slice(1) - 1] : null) || ['Read', 'Build', 'Break', 'Fix', 'Explain'];
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
        el('span', { style: { fontSize: '14.5px' }, text: 'The lab script builds a small repository with the problem already in it, prints your task, and checks your fix. Run it in any Codespace of this repo (iPad, iPhone or Mac) or in a clone on your MacBook.' }),
        el('pre', { class: 'schema', style: { whiteSpace: 'pre-wrap' }, text: 'L=$PWD/labs/git/gitlab.sh     # run this line in the repo folder\nbash $L setup ' + g.n + '    # builds ~/git-labs/' + nn + ' and prints the task\ncd ~/git-labs/' + nn + (g.n === 11 ? '/me' : '') + '\n# … fix it with the commands above …\nbash $L check ' + g.n + '    # PASS / FAIL per check' }),
        el('div', { class: 'row wrap' }, [el('a', { class: 'btn pri', href: 'https://codespaces.new/raghav511/de-architect?devcontainer_path=.devcontainer/ai/devcontainer.json', target: '_blank', rel: 'noopener', text: 'Open a Codespace (2-core is enough)' }), u ? el('button', { class: 'btn', onclick: () => toggleUnit(u), text: u.isDone ? 'Mark not done' : 'Mark this lesson done' }) : null]),
        el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: 'In a Codespace the terminal already starts in the repo folder (/workspaces/de-architect). On a Mac, clone first: git clone https://github.com/raghav511/de-architect && cd de-architect' })]),
      el('section', { class: 'card pad stack' }, [el('h3', { text: 'The mistake people make' }), el('div', { html: mdi(g.mistake) }), el('h3', { text: 'Interview question' }), el('div', { html: mdi(g.interview) })])]),
    el('section', { class: 'card pad stack' }, [el('h3', { text: 'All Git lessons' }), list])])], { back: '#/today' });
}

/* ---------------- What is new ---------------- */
function vNews() {
  const N = DATA.news || { items: [] };
  const sc = schedule(), u = sc.units.find(x => x.kind === 'news' && x.mid === sc.cur);
  shell('What is new in AI', 'Updated ' + (N.updated || '') + ' · refreshed weekly', [
    el('section', { class: 'card pad stack' }, [el('p', { style: { margin: 0 }, text: N.note || '' }), u ? el('button', { class: 'btn', style: { alignSelf: 'flex-start' }, onclick: () => toggleUnit(u), text: u.isDone ? 'Mark not done' : 'Mark this week\'s reading done' }) : null]),
    el('div', { class: 'stack' }, N.items.map(x => el('section', { class: 'card pad stack' }, [el('b', { style: { fontSize: '18px' }, text: x.title }), el('span', { text: x.summary }), el('span', {}, [el('b', { style: { color: 'var(--plum-d)' }, text: 'Why it matters: ' }), x.why]), x.try ? el('span', {}, [el('b', { style: { color: 'var(--teal-d)' }, text: 'Test it yourself: ' }), x.try]) : null, x.url ? el('a', { href: x.url, target: '_blank', rel: 'noopener', style: { fontWeight: 600 }, text: 'Source: ' + (x.source || new URL(x.url).hostname) + ' ›' }) : null])))], { back: '#/today' });
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
  const close = () => { wrap.remove(); document.removeEventListener('keydown', key); };
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
  let streak = 0; const d = new Date(); d.setHours(0, 0, 0, 0); if (!per[iso(d)]) d.setDate(d.getDate() - 1);
  while (per[iso(d)]) { streak++; d.setDate(d.getDate() - 1); }
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - 7 * 11 - ((start.getDay() + 6) % 7));
  const cells = [];
  for (let i = 0; i < 84; i++) { const x = new Date(start); x.setDate(start.getDate() + i); const k = iso(x), v = per[k] || 0; cells.push(el('span', { title: shortDate(k) + ': ' + v + ' min', class: 'hm' + (v >= 90 ? ' h3' : v >= 45 ? ' h2' : v > 0 ? ' h1' : '') + (k === sc.today ? ' now' : '') })); }
  const stat = (n, t) => el('div', { class: 'stack', style: { gap: '0' } }, [el('b', { style: { font: '800 26px var(--display)' }, text: n }), el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: t })]);
  return el('section', { class: 'card pad stack' }, [
    el('div', { class: 'row wrap' }, [el('span', { class: 'lbl grow', text: 'Program' }), el('a', { href: '#/path', style: { fontWeight: 600, fontSize: '14px' }, text: 'Open the path ›' })]),
    el('div', { class: 'statrow' }, [stat(done.length + '/' + U.length, 'steps done'), stat(Math.round(dm / 60) + ' / ' + Math.round(mins / 60) + ' h', 'study hours'), stat(streak + (streak === 1 ? ' day' : ' days'), 'study streak'), stat(shortDate(last).slice(4), 'planned finish (week ' + weekOf(last) + ')')]),
    el('div', { class: 'bar' }, el('i', { style: { width: Math.round(100 * dm / Math.max(1, mins)) + '%' } })),
    el('span', { class: 'lbl', text: 'Last 12 weeks · minutes studied per day' }), el('div', { class: 'heat', 'aria-label': 'Study activity, last 12 weeks' }, cells),
    el('span', { class: 'muted', style: { fontSize: '13px' }, text: 'Columns are weeks, rows are Monday to Sunday. Darker means more minutes.' })]);
}
