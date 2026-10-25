/* Data Architect · DE and architect interview prep. Plain JS, no build step. */
'use strict';
const VERSION = '1.5.0';
const $ = (s, r = document) => r.querySelector(s);
function el(tag, attrs, kids) {
  const e = document.createElement(tag);
  for (const k in (attrs || {})) {
    const v = attrs[k];
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  (Array.isArray(kids) ? kids : kids === undefined ? [] : [kids]).forEach(c => { if (c !== null && c !== undefined && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
const svg = (d, s = 20) => { const w = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); w.setAttribute('width', s); w.setAttribute('height', s); w.setAttribute('viewBox', '0 0 24 24'); w.setAttribute('fill', 'none'); w.setAttribute('stroke', 'currentColor'); w.setAttribute('stroke-width', '2'); w.setAttribute('stroke-linecap', 'round'); w.setAttribute('stroke-linejoin', 'round'); w.setAttribute('aria-hidden', 'true'); w.innerHTML = d; return w; };
const I = {
  today: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>', path: '<path d="M4 19c4 0 4-6 8-6s4-6 8-6"/><circle cx="4" cy="19" r="2"/><circle cx="20" cy="7" r="2"/>',
  book: '<path d="M3 5h7a2 2 0 012 2v12a2 2 0 00-2-2H3zM21 5h-7a2 2 0 00-2 2v12a2 2 0 012-2h7z"/>', code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
  db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>', design: '<rect x="3" y="4" width="7" height="6" rx="1"/><rect x="14" y="14" width="7" height="6" rx="1"/><path d="M10 7h4v10"/>',
  quiz: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"/>', proj: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 12l9 4 9-4M3 17l9 4 9-4"/>', prog: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', sync: '<path d="M20 11a8 8 0 00-14-5L4 8M4 13a8 8 0 0014 5l2-2M4 4v4h4M20 20v-4h-4"/>',
  update: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>', back: '<path d="M15 18l-6-6 6-6"/>', fwd: '<path d="M9 6l6 6-6 6"/>', dbl_l: '<path d="M18 6l-6 6 6 6M11 6l-6 6 6 6"/>', dbl_r: '<path d="M6 6l6 6-6 6M13 6l6 6-6 6"/>',
  check: '<path d="M5 12l5 5 9-10" stroke="#fff" stroke-width="3"/>', spark: '<path d="M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8z"/><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  git: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10M18 11c0 4-6 3-11 7"/>', news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
  term: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'
};
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const md = s => { try { return window.marked ? window.marked.parse(s || '', { gfm: true }) : esc(s); } catch (e) { return esc(s); } };
const mdi = s => { try { return window.marked ? window.marked.parseInline(s || '', { gfm: true }) : esc(s); } catch (e) { return esc(s); } };

/* ---------------- state ---------------- */
const KEY = 'keystone:v1'; /* the app was called Keystone; the key stays so saved progress is kept */
let S = load();
function load() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { s = {}; }
  return Object.assign({ start: null, proj: {}, done: {}, doneAt: {}, undone: {}, code: {}, solved: {}, runs: {}, hints: {}, secs: {}, quiz: {}, iv: {}, tests: {}, settings: {}, layout: {}, rev: {}, updated: 0, week: null }, s);
}
let saveT = null;
function save(touch = true) {
  if (touch) S.updated = Date.now();
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save in this browser (storage full or private mode).'); } }, 150);
}
if (!S.start) { const d = new Date(); const m = (d.getDay() + 6) % 7; d.setDate(d.getDate() - m); S.start = iso(d); save(); }
function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dayIndex() { const s = new Date(S.start + 'T00:00:00'), n = new Date(); n.setHours(0, 0, 0, 0); return Math.max(0, Math.round((n - s) / 864e5)); }
function curWeek() { return S.week || Math.min(12, Math.floor(dayIndex() / 7) + 1); }
function curDay() { return S.week ? (S.dayPick || 0) : Math.min(6, dayIndex() % 7); }

/* ---------------- data ---------------- */
const DATA = { dsa: [], sql: [], spark: [], py: [], projects: [], sprints: {}, weeks: [] };
const WEEKS = [
  ['The walking skeleton', 'Git, terminal, Kafka, Spark, Parquet, Airflow end to end', 'Back-of-envelope estimates and decision records', 'Your first LLM call and the agent loop', 'Arrays and hash maps', 'Python Crash Course ch. 1–6 · Fundamentals of DE ch. 1–3 · DDIA ch. 1'],
  ['Storage that survives growth', 'File formats, Hive, Iceberg, small files', 'Storage engines and indexes', 'Structured output with validation', 'Two pointers', 'DDIA ch. 3 · Spark: The Definitive Guide ch. 9 · Python Distilled ch. 1–3'],
  ['Spark under load', 'Stages, shuffles, joins, skew, memory', 'Partitioning and rebalancing', 'Tools that read evidence', 'Sliding window', 'Spark: The Definitive Guide ch. 15–19 · DDIA ch. 6'],
  ['A warehouse people trust', 'Dimensional modeling, SCD, dbt, Snowflake', 'Data models and query languages', 'Text-to-SQL and context engineering', 'Stacks and queues', 'DDIA ch. 2 · Fundamentals of DE ch. 8 · The Data Warehouse Toolkit ch. 1–5'],
  ['Real time', 'Kafka internals, watermarks, exactly-once', 'Stream system design', 'Retrieval over your runbooks', 'Strings and parsing', 'DDIA ch. 11 · Spark: The Definitive Guide ch. 20–23 · Streaming Systems ch. 1–3'],
  ['Source of truth', 'Change data capture, Debezium, reconciliation', 'Replication and consistency', 'Human approval before any change', 'Sorting and intervals', 'DDIA ch. 5, 7 and 9'],
  ['Move it to the cloud', 'AWS, IAM, Terraform, cost', 'Cloud reference architectures and cost', 'An MCP server for your platform', 'Binary search', 'Fundamentals of DE ch. 4 · AWS Well-Architected Analytics Lens'],
  ['Two platforms, one set of tables', 'Delta, Databricks, Snowflake, governance', 'Lakehouse interop and governance', 'LLM steps inside batch pipelines', 'Heaps and top-K', 'Fundamentals of DE ch. 10 · Delta and Iceberg docs'],
  ['Reliability', 'Contracts, tests, CI/CD, observability', 'SLOs, failure modes, run books', 'The on-call agent', 'Linked lists and LRU', 'DDIA ch. 1 and 8 · Python Distilled ch. 7'],
  ['Design at scale', 'Serving stores, capacity, DR', 'Full design rounds, Alex Xu method', 'Evals, traces, one agent or many', 'Trees, BFS and DFS', 'System Design Interview (Alex Xu) ch. 1–4 · DDIA ch. 12'],
  ['In front of the customer', 'Discovery, metrics, experiments', 'Architecture for stakeholders: C4 and trade-off memos', 'A one-day customer build', 'Graphs and topological sort', 'Fundamentals of DE ch. 11 · System Design Interview ch. 12'],
  ['Loops', 'Mock loops and the capstone', 'Architecture review board mock', 'Capstone demo and evaluation', 'Dynamic programming basics', 'Your notes from all 12 weeks']
];
const MAPS = [
  ['Generator', 'Kafka', 'Spark', 'Parquet', 'Trino'], ['Spark', 'Parquet', 'Iceberg', 'Compaction', 'Trino'], ['Kafka', 'Spark stages', 'Shuffle', 'Join', 'Iceberg'], ['Sources', 'Staging', 'dbt models', 'Star schema', 'BI'],
  ['Producers', 'Kafka', 'Flink/Spark', 'Watermarks', 'Sink'], ['Postgres', 'Debezium', 'Kafka', 'MERGE', 'Lakehouse'], ['S3', 'Glue', 'EMR/Spark', 'Athena', 'Cost'], ['Delta', 'Iceberg', 'Catalog', 'Snowflake', 'Governance'],
  ['Contracts', 'Tests', 'CI/CD', 'Metrics', 'On-call'], ['Ingest', 'Lake', 'Serving store', 'Cache', 'API'], ['Discovery', 'Metric tree', 'Experiment', 'Dashboard', 'Decision'], ['Design', 'Build', 'Test', 'Demo', 'Loop']
];
const PALETTE = [['#E4ECFA', '#1E3F8F'], ['#FBE7C6', '#7A3E05'], ['#E4ECFA', '#1E3F8F'], ['#DDF1EA', '#0B3D33'], ['#EFE4F5', '#5A2A75']];
async function loadData() {
  const [d, q, p] = await Promise.all(['dsa', 'sql', 'spark'].map(n => fetch('data/bank/' + n + '.json').then(r => r.json())));
  DATA.dsa = d; DATA.sql = q; DATA.spark = p;
  try { DATA.py = await fetch('data/bank/py.json').then(r => r.json()); } catch (e) { DATA.py = []; }
  try { DATA.projects = await fetch('data/projects.json').then(r => r.json()); } catch (e) { DATA.projects = []; }
  await loadModules();
}
const byWeek = (arr, w) => arr.filter(x => x.w === w);
const findQ = id => DATA.dsa.find(x => x.id === id) || DATA.sql.find(x => x.id === id) || DATA.spark.find(x => x.id === id) || DATA.py.find(x => x.id === id);
const kindOf = id => ({ d: 'dsa', q: 'sql', p: 'spark', y: 'py' })[String(id)[0]];

/* ---------------- review queue: problems you struggled with come back after 3, 7 and 21 days ---------------- */
const REV_GAPS = [3, 7, 21];
function revPut(id, box) {
  S.rev = S.rev || {};
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + (REV_GAPS[box] || 0));
  S.rev[id] = { box, due: box < REV_GAPS.length ? iso(d) : null, t: Date.now() };
  save();
}
function revDue() { const t = iso(new Date()); return Object.entries(S.rev || {}).filter(([id, r]) => r.due && r.due <= t && findQ(id)).sort((a, b) => a[1].due < b[1].due ? -1 : 1).map(([id]) => findQ(id)); }
function revText(r) { return !r ? '' : !r.due ? 'learned · no more reviews' : 'review ' + (r.box + 1) + ' of ' + REV_GAPS.length + ' · due ' + shortDate(r.due); }
async function sprint(w) {
  w = midOf(w);
  if (DATA.sprints[w]) return DATA.sprints[w];
  const t = await fetch('data/program/' + w + '.txt').then(r => { if (!r.ok) throw new Error('missing'); return r.text(); });
  return (DATA.sprints[w] = parseSprint(t));
}
function splitSections(text) { const out = {}; let name = null, buf = []; text.split(/\r?\n/).forEach(l => { const m = /^@@([a-z]+)\s*$/.exec(l); if (m) { if (name) out[name] = buf.join('\n'); name = m[1]; buf = []; } else buf.push(l); }); if (name) out[name] = buf.join('\n'); return out; }
function blocks(text, keys, letters) {
  const res = []; let b = null, f = null, fence = false; const re = new RegExp('^(' + keys.join('|') + '):\\s?(.*)$');
  const push = () => { if (b && Object.keys(b).length) res.push(b); b = null; f = null; };
  (text || '').split('\n').forEach(l => {
    const isF = /^```/.test(l); if (isF) fence = !fence;
    if (!fence && !isF) {
      if (l.trim() === '---') { push(); return; }
      const m = re.exec(l); if (m) { b = b || {}; f = m[1]; b[f] = m[2]; return; }
      if (letters) { const o = /^([A-D])\)\s(.*)$/.exec(l); if (o) { b = b || {}; b.opts = b.opts || []; b.opts.push([o[1], o[2]]); f = null; return; } }
    }
    if (b && f) b[f] += '\n' + l;
  }); push();
  res.forEach(x => { for (const k in x) if (typeof x[k] === 'string') x[k] = x[k].trim(); });
  return res;
}
function parseSprint(text) {
  const s = splitSections(text), o = { raw: s, meta: {} };
  (s.meta || '').split('\n').forEach(l => { const i = l.indexOf(':'); if (i > 0) o.meta[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
  o.quiz = blocks(s.quiz, ['TYPE', 'TAG', 'Q', 'ANS', 'WHY', 'MODEL'], true);
  /* the source files put most right answers at B; shuffle options per question (stable per module) so the letter gives nothing away */
  o.quiz.forEach((q, i) => {
    if (q.TYPE !== 'mcq' || !q.opts) return;
    let h = 2166136261; for (const ch of (o.meta.id || '') + ':' + i) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
    const texts = q.opts.map(x => x[1]), right = texts[q.opts.findIndex(x => x[0] === q.ANS)];
    for (let k = texts.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [texts[k], texts[j]] = [texts[j], texts[k]]; }
    q.opts = texts.map((t, k) => ['ABCD'[k], t]); q.ANS = 'ABCD'[texts.indexOf(right)];
  });
  o.coding = blocks(s.coding, ['TITLE', 'KIND', 'MIN', 'TAG', 'SRC', 'PROBLEM', 'SOLUTION'], false).map(c => {
    const m = /<!--test\n?([\s\S]*?)-->/.exec(c.SOLUTION || ''); c.TEST = m ? m[1] : ''; c.SOLUTION = (c.SOLUTION || '').replace(/<!--test[\s\S]*?-->/, '').trim();
    const f = /```(?:\w+)?\n([\s\S]*?)```/.exec(c.SOLUTION); c.CODE = f ? f[1] : ''; return c;
  });
  o.interview = blocks(s.interview, ['Q', 'SRC', 'TAG', 'A'], false);
  return o;
}

/* ---------------- ui helpers ---------------- */
let toastT;
function toast(msg, undo, ms) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = el('div', { class: 'toast', role: 'status' }, [el('span', { text: msg }), undo ? el('button', { text: 'Undo', onclick: () => { undo(); t.remove(); } }) : null]);
  document.body.appendChild(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), ms || (undo ? 10000 : 3500));
}
function confirmBox(title, body, actions) {
  return new Promise(res => {
    const close = v => { sc.remove(); res(v); };
    const sc = el('div', { class: 'scrim', onclick: e => { if (e.target === sc) close(null); } }, [
      el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [el('h2', { text: title }), body ? (typeof body === 'string' ? el('p', { style: { margin: 0 }, text: body }) : body) : null,
        el('div', { class: 'stack', style: { gap: '8px' } }, actions.map(a => el('button', { class: 'btn ' + (a.cls || ''), style: { justifyContent: 'flex-start' }, onclick: () => close(a.v) }, [el('b', { text: a.t }), a.s ? el('span', { class: 'muted', style: { fontWeight: 500, fontSize: '13.5px', whiteSpace: 'normal' }, text: '· ' + a.s }) : null])))])]);
    document.body.appendChild(sc); const b = sc.querySelector('button'); if (b) b.focus();
    const k = e => { if (e.key === 'Escape') { document.removeEventListener('keydown', k); close(null); } }; document.addEventListener('keydown', k);
  });
}
function lightbox(src) { const lb = el('div', { class: 'lightbox', role: 'dialog', 'aria-label': 'Image', onclick: () => lb.remove() }, [el('img', { src, alt: '' })]); document.body.appendChild(lb); }
function mdEl(s, cls) { const d = el('div', { class: cls || 'prose', html: md(s) }); d.querySelectorAll('table').forEach(t => { const w = el('div', { class: 'scroll' }); t.parentNode.insertBefore(w, t); w.appendChild(t); }); d.querySelectorAll('a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; }); d.querySelectorAll('pre').forEach(x => x.setAttribute('tabindex', '0')); d.querySelectorAll('img').forEach(i => { i.loading = 'lazy'; i.addEventListener('click', () => lightbox(i.src)); }); return d; }
function chipFor(k) { return { py: ['Python', 'c-py'], dsa: ['DSA', 'c-dsa'], core: ['Core DE', 'c-core'], arch: ['Architecture', 'c-arch'], ai: ['Agentic AI', 'c-ai'], git: ['Git', 'c-git'], cloud: ['Cloud', 'c-core'], streaming: ['Streaming', 'c-core'], modeling: ['Data modeling', 'c-core'], design: ['System design', 'c-arch'], behavioral: ['Behavioral', 'c-test'], sql: ['SQL', 'c-sql'], spark: ['PySpark', 'c-spark'], test: ['Check', 'c-test'], talk: ['Interview', 'c-test'] }[k] || [k, 'c-test']; }
function chip(k) { const c = chipFor(k); return el('span', { class: 'chip ' + c[1], text: c[0] }); }

/* ---------------- shell ---------------- */
const NAV = [['#/today', 'Today', 'today'], ['#/path', 'Path', 'path'], ['#/learn/0', 'Lessons', 'book'], ['#/practice', 'Coding practice', 'code'], ['#/projects', 'Projects', 'proj'], ['#/design', 'System design', 'design'], ['#/git', 'Git lessons', 'git'], ['#/news', 'What is new in AI', 'news'], ['#/quiz/0', 'Quizzes', 'quiz'], ['#/progress', 'Progress', 'prog']];
const TABS = [['#/today', 'Today', 'today'], ['#/path', 'Path', 'path'], ['#/practice', 'Coding', 'code'], ['#/projects', 'Projects', 'proj'], ['#/design', 'Design', 'design']];
function shell(title, eyebrow, body, opts) {
  opts = opts || {};
  const route = location.hash.split('/')[1] || 'today';
  const sc = schedule(), wk = sc.cur, tu = sc.byDay[sc.today] || [], tdone = tu.filter(u => u.isDone).reduce((a, u) => a + u.mins, 0), tall = tu.reduce((a, u) => a + u.mins, 0);
  const nav = NAV.map(([h, t, ic]) => { const href = h.replace('/0', '/' + wk); return el('a', { class: 'nav', href, 'aria-current': href.split('/')[1] === route ? 'page' : null }, [svg(I[ic]), t]); });
  const side = el('nav', { class: 'side', 'aria-label': 'Main' }, [el('a', { class: 'brand', href: '#/today' }, [logo(), 'Data Architect'])].concat(nav, [el('a', { class: 'week', href: '#/path/' + wk, style: { color: 'inherit', textDecoration: 'none' } }, [el('span', { class: 'lbl', style: { color: '#9FB0BF' }, text: 'Module ' + modLabel(wk) + ' · week ' + weekOf(sc.today) }), el('b', { style: { color: '#fff' }, text: modTitle(wk) }), el('div', { class: 'bar' }, el('i', { style: { width: (tall ? Math.round(100 * tdone / tall) : 0) + '%' } })), el('span', { style: { fontSize: '13px' }, text: 'Today: ' + tdone + ' of ' + tall + ' min done' })])]));
  const inTabs = TABS.some(x => x[0].split('/')[1] === route);
  const more = el('button', { class: 'tabmore', 'aria-label': 'More sections', 'aria-current': inTabs ? null : 'page', onclick: () => {
    const sc2 = el('div', { class: 'scrim sheetwrap', onclick: e => { if (e.target === sc2) sc2.remove(); } }, [el('div', { class: 'sheet', role: 'dialog', 'aria-label': 'All sections' }, [el('div', { class: 'row' }, [el('b', { class: 'grow', style: { fontSize: '18px' }, text: 'All sections' }), el('button', { class: 'btn icon sm', 'aria-label': 'Close', onclick: () => sc2.remove(), text: '×' })]),
      el('div', { class: 'sheetgrid' }, NAV.map(([h, t, ic]) => { const href = h.replace('/0', '/' + wk); return el('a', { href, onclick: () => sc2.remove(), 'aria-current': href.split('/')[1] === route ? 'page' : null }, [svg(I[ic], 22), t]); }).concat([el('button', { onclick: () => { sc2.remove(); doSync(); } }, [svg(I.sync, 22), syncLabel()]), el('button', { onclick: () => { sc2.remove(); doUpdate(); } }, [svg(I.update, 22), 'Update app']), el('button', { onclick: () => { sc2.remove(); settings(); } }, [svg(I.gear, 22), 'Settings'])]))])]);
    document.body.appendChild(sc2);
    const k = e => { if (e.key === 'Escape') { sc2.remove(); document.removeEventListener('keydown', k); } }; document.addEventListener('keydown', k);
  } }, [svg('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>', 22), 'More']);
  const tabbar = el('nav', { class: 'tabbar', 'aria-label': 'Main' }, TABS.map(([h, t, ic]) => el('a', { href: h, 'aria-current': h.split('/')[1] === route ? 'page' : null }, [svg(I[ic], 22), t])).concat([more]));
  const top = el('header', { class: 'top' }, [
    opts.back ? el('a', { class: 'btn icon', href: opts.back, 'aria-label': 'Back', onclick: e => { if (navCount > 0) { e.preventDefault(); history.back(); } } }, svg(I.back)) : null,
    el('div', { class: 'title' }, [eyebrow ? el('span', { class: 'lbl', text: eyebrow }) : null, el('b', { text: title })]),
    opts.extra || null,
    el('div', { class: 'row topbtns', style: { gap: '8px' } }, [
      el('button', { class: 'btn icon', onclick: () => openSearch(), title: 'Search (⌘K or /)', 'aria-label': 'Search' }, svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', 18)),
      el('button', { class: 'btn hide-s', onclick: doUpdate, title: 'Check for a new version', 'aria-label': 'Update app' }, [svg(I.update, 18), el('span', { class: 't', text: 'Update app' })]),
      el('button', { class: 'btn hide-s', id: 'syncBtn', onclick: doSync, title: 'Sync progress across your devices', 'aria-label': 'Sync progress' }, [svg(I.sync, 18), el('span', { class: 't', text: syncLabel() })]),
      el('button', { class: 'btn icon', onclick: settings, 'aria-label': 'Settings' }, svg(I.gear, 18))])]);
  const pageEl = opts.raw ? body : el('main', { class: 'page', id: 'page' }, body);
  const main = el('div', { class: 'main' }, [top, pageEl.querySelector && pageEl.querySelector('h1') ? null : el('h1', { class: 'sr', text: title }), pageEl]);
  const app = el('div', { class: 'app' }, [side, main]);
  const same = shell.last === location.hash, y = window.scrollY; shell.last = location.hash;
  const root = $('#root'); root.textContent = ''; root.appendChild(app); root.appendChild(tabbar); root.appendChild(coachFab());
  window.scrollTo(0, same ? y : 0); /* re-rendering the same screen (ticking a step) keeps your place */
}
function logo() { const s = svg('<path d="M4 22h8l4-12 4 12h8" stroke="#5CC8B0" stroke-width="3"/><circle cx="16" cy="10" r="3" fill="#E08A1E" stroke="none"/>', 30); s.setAttribute('viewBox', '0 0 32 32'); return s; }

/* ---------------- router ---------------- */
let cleanup = [];
function route() {
  cleanup.forEach(f => { try { f(); } catch (e) { } }); cleanup = [];
  const p = location.hash.replace(/^#\/?/, '').split('/');
  const r = p[0] || 'today';
  try {
    if (r === 'today') vToday(p[1]);
    else if (r === 'path') vPath(p[1]);
    else if (r === 'learn') vLearn(p[1] === '0' ? '' : p[1], p[2] || 'chapter', p[3]);
    else if (r === 'git') vGit(p[1]);
    else if (r === 'news') vNews();
    else if (r === 'dsa' || r === 'sql' || r === 'spark' || r === 'py') vWork(r, p[1], p[2]);
    else if (r === 'test') vWork('test', midOf(p[1]) + '/' + p[2]);
    else if (r === 'practice') vPractice(p[1] || 'all');
    else if (r === 'design') vDesign(p[1]);
    else if (r === 'quiz') vQuiz(p[1]);
    else if (r === 'interview') vInterview(p[1], p[2]);
    else if (r === 'progress') vProgress();
    else if (r === 'projects') vProjects();
    else if (r === 'project') vProject(p[1]);
    else vToday();
  } catch (e) { console.error(e); shell('Something went wrong', '', [el('div', { class: 'card pad' }, [el('p', { text: String(e.message || e) }), el('a', { class: 'btn', href: '#/today', text: 'Back to Today' })])]); }
}

const VIDEOS = { 1: [['Kafka 101: events and logs', 'https://developer.confluent.io/courses/apache-kafka/events/'], ['Topics', 'https://developer.confluent.io/courses/apache-kafka/topics/'], ['Partitions', 'https://developer.confluent.io/courses/apache-kafka/partitions/'], ['Consumers and groups', 'https://developer.confluent.io/courses/apache-kafka/consumers/']], 5: [['Kafka 101: producers', 'https://developer.confluent.io/courses/apache-kafka/producers/'], ['Stream processing', 'https://developer.confluent.io/courses/apache-kafka/stream-processing/']], 6: [['Kafka Connect', 'https://developer.confluent.io/courses/apache-kafka/kafka-connect/']] };
function videoCard(w) {
  const v = VIDEOS[w];
  if (!v) return el('section', { class: 'card pad stack' }, [el('h3', { text: 'Video' }), el('p', { class: 'muted', style: { margin: 0 }, text: 'This week\'s videos come with the next content update. Use the readings and the animated map above for now.' })]);
  return el('section', { class: 'card pad stack' }, [el('h3', { text: 'Watch (free Confluent course, opens in a new tab)' }), el('div', { class: 'list' }, v.map(([t, u]) => el('a', { class: 'item', href: u, target: '_blank', rel: 'noopener' }, [el('span', { class: 'grow t', text: '▶ ' + t }), el('span', { class: 's', text: 'confluent.io' })])))]);
}
/* Kafka lesson: step-through diagrams with ‹ › controls */
function kafkaLesson() {
  const wrap = el('section', { class: 'stack' });
  const modes = [['parts', 'Key → partition → offset'], ['group', 'Sharing partitions'], ['crash', 'Loop: consumer crash']];
  let mode = 'parts', step = 0, playing = true, n = 1;
  const host = el('div');
  const counter = el('span', { class: 'lbl', style: { minWidth: '56px', textAlign: 'center' } });
  const playBtn = el('button', { class: 'btn sm', onclick: () => { playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play'; } }, 'Pause');
  const total = () => mode === 'parts' ? 8 : mode === 'group' ? 8 : 4;
  const go = d => { playing = false; playBtn.textContent = 'Play'; step = (step + d + total()) % total(); draw(); };
  const tabs = el('div', { class: 'tabs', role: 'tablist' }, modes.map(([k, t]) => el('button', { role: 'tab', 'aria-selected': String(k === mode), onclick: e => { mode = k; step = 0; tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', 'false')); e.target.setAttribute('aria-selected', 'true'); draw(); }, text: t })));
  const ctl = el('div', { class: 'row', style: { gap: '6px', marginLeft: 'auto' } }, [el('button', { class: 'btn icon sm', 'aria-label': 'Previous step', onclick: () => go(-1) }, svg(I.back, 18)), counter, el('button', { class: 'btn icon sm', 'aria-label': 'Next step', onclick: () => go(1) }, svg(I.fwd, 18)), playBtn]);
  const TR = { 't-1': ['#E08A1E', '#FDEBD3', '#7A3E05', 0], 't-2': ['#2B59C3', '#E4ECFA', '#1E3F8F', 1], 't-3': ['#0B7A67', '#DDF1EA', '#0B3D33', 2] };
  const EV = [['Rider app', 't-1', 'requested'], ['Rider app', 't-2', 'requested'], ['Driver app', 't-1', 'driver assigned'], ['Rider app', 't-3', 'requested'], ['Driver app', 't-2', 'picked up'], ['Driver app', 't-1', 'completed']];
  const HV = { 't-1': 7203, 't-2': 4411, 't-3': 9008 };
  const CC = ['#2B59C3', '#0B7A67', '#7A3E9D', '#B45F06', '#1E3F8F', '#0B3D33', '#5A2A75', '#7A3E05'];
  const chipS = c => ({ display: 'inline-flex', minWidth: '40px', justifyContent: 'center', padding: '2px 8px', borderRadius: '6px', color: '#fff', background: c, font: '700 12.5px var(--mono)' });
  function draw() {
    counter.textContent = (step + 1) + ' / ' + total();
    host.textContent = '';
    if (mode === 'parts') {
      const cur = step >= 1 && step <= 6 ? EV[step - 1] : null, shown = Math.min(step, 6);
      const rows = [0, 1, 2].map(pn => {
        const evs = EV.slice(0, shown).map((e, k) => ({ e, k })).filter(x => TR[x.e[1]][3] === pn);
        const active = cur && TR[cur[1]][3] === pn;
        return el('div', { class: 'prow' }, [el('span', { style: { font: '700 14px var(--mono)', padding: '10px 6px', borderRadius: '8px', textAlign: 'center', background: active ? '#12202F' : '#FFF7EA', color: active ? '#fff' : '#7A3E05', border: '1px solid #E9C48B' }, text: 'p' + pn }),
          el('div', { class: 'cells' }, evs.map((x, off) => { const c = TR[x.e[1]], isNew = active && x.k === step - 1; return el('span', { style: { background: isNew ? c[0] : c[1], color: isNew ? '#fff' : c[2], outline: isNew || (step === 7 && x.e[1] === 't-1') ? '2px solid ' + c[0] : '' } }, [el('small', { text: 'offset ' + off }), x.e[1] + ' ' + x.e[2]]); })),
          el('span', { class: 'reader', style: { fontSize: '13px', fontWeight: 700, borderRadius: '8px', padding: '8px', background: active ? '#0B7A67' : '#DDF1EA', color: active ? '#fff' : '#0B3D33' }, text: (pn === 0 ? 'Spark task A' : 'Spark task B') + (active ? ' reads it next' : '') })]);
      });
      const c = cur ? TR[cur[1]] : null, off = cur ? EV.slice(0, step - 1).filter(e => e[1] === cur[1]).length : 0;
      host.append(
        el('div', { class: 'row wrap', style: { alignItems: 'stretch' } }, [
          el('div', { style: { flex: '1 1 200px', borderRadius: '10px', padding: '8px 10px', background: c ? c[1] : '#E4ECFA', color: c ? c[2] : '#1E3F8F', border: '2px solid ' + (c ? c[0] : '#C9D6F0') } }, [el('div', { class: 'lbl', style: { color: 'inherit' }, text: '1 · Producer sends' }), el('b', { text: cur ? cur[0] : step === 7 ? 'All 6 events sent' : 'Waiting for the first event' }), el('div', { class: 'mono', style: { fontSize: '12.5px' }, text: cur ? 'key "' + cur[1] + '" · value "' + cur[2] + '"' : 'key = trip id · value = what happened' })]),
          el('div', { style: { flex: '2 1 280px', borderRadius: '10px', padding: '8px 12px', background: '#FFF7EA', border: '1px solid #E9C48B' } }, [el('div', { class: 'lbl', style: { color: '#7A3E05' }, text: '2 · Kafka picks the partition from the key' }), el('div', { class: 'mono', style: { fontWeight: 600 }, text: cur ? 'hash("' + cur[1] + '") = ' + HV[cur[1]] + ' → ' + HV[cur[1]] + ' % 3 = ' + c[3] + ' → p' + c[3] : step === 7 ? 'Same key → same partition, every time' : 'partition = hash(key) % number_of_partitions' }), el('div', { style: { fontSize: '13.5px' }, text: cur ? 'Appended at the end of p' + c[3] + ' with offset ' + off + '. ' + (c[3] === 0 ? 'Task A' : 'Task B') + ' owns p' + c[3] + ', so it reads it.' : step === 7 ? 'Look at p0: every t-1 event is there, in the order it happened.' : 'Press › or wait. Six events arrive one by one.' })])]),
        el('div', { class: 'lbl', text: '3 · Events stored in order (offset = position) · 4 · read by' }), ...rows,
        el('div', { class: 'keyrow' }, [el('b', { text: 'Key = trip id' }), el('span', { class: 'sw' }, [el('i', { style: { background: '#E08A1E' } }), 't-1 → always p0']), el('span', { class: 'sw' }, [el('i', { style: { background: '#2B59C3' } }), 't-2 → always p1']), el('span', { class: 'sw' }, [el('i', { style: { background: '#0B7A67' } }), 't-3 → always p2']), el('span', { class: 'muted', text: '(hash values are made up)' })]),
        el('p', { style: { margin: 0, fontSize: '14.5px', background: step === 7 ? '#F3FAF7' : '', borderRadius: '10px', padding: step === 7 ? '6px 10px' : 0 }, html: step === 7 ? '<b>Why this matters:</b> all t-1 events sit in p0 in order, so one reader sees that trip in order. Across partitions there is no order. 3 partitions and 2 tasks, so task B owns two (p1 and p2).' : '<b>How to read it:</b> one event per step. 1) An app sends it with the trip id as key. 2) Kafka hashes the key to pick a partition. 3) It is stored at the end with the next offset. 4) The task that owns that partition reads it.' }));
    } else if (mode === 'group') {
      n = step + 1;
      const own = k => k % n;
      host.append(el('div', { class: 'row wrap' }, [el('b', { text: n + (n === 1 ? ' consumer' : ' consumers') + ' sharing 6 partitions' })]),
        el('div', { class: 'row wrap', style: { gap: '6px' } }, [el('span', { class: 'lbl', text: 'Partitions' })].concat([0, 1, 2, 3, 4, 5].map(k => el('span', { style: chipS(CC[own(k)]), text: 'p' + k })))),
        el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: '8px' } }, Array.from({ length: n }, (_, c) => { const ps = [0, 1, 2, 3, 4, 5].filter(k => own(k) === c); return el('div', { style: { background: '#fff', borderRadius: '10px', padding: '8px 10px', border: ps.length ? '2px solid ' + CC[c] : '2px dashed #C9CFC4', opacity: ps.length ? 1 : .75 } }, [el('b', { style: { color: ps.length ? CC[c] : '#4E5B66', fontSize: '13.5px' }, text: 'Consumer ' + (c + 1) }), el('div', { class: 'row wrap', style: { gap: '4px', marginTop: '4px' } }, ps.length ? ps.map(k => el('span', { style: chipS(CC[c]), text: 'p' + k })) : [el('span', { class: 'muted', style: { fontSize: '13px' }, text: 'idle · standby' })])]); })),
        el('p', { style: { margin: 0, fontWeight: 700, background: '#FFF7EA', borderRadius: '10px', padding: '8px 12px' }, text: n === 1 ? '1 consumer reads all 6 partitions alone.' : n < 6 ? n + ' consumers: each owns ' + Math.floor(6 / n) + (6 % n ? '–' + Math.ceil(6 / n) : '') + ' partitions.' : n === 6 ? '6 consumers: one partition each. The most parallel this topic allows.' : n + ' consumers: 6 work, ' + (n - 6) + ' sit idle. More partitions would help; more consumers do not.' }),
        el('p', { style: { margin: 0, fontSize: '14.5px' }, html: '<b>Rule:</b> a partition has at most one consumer in a group, but one consumer can own many partitions. Sizing: 40,000 events/s ÷ 5,000 per consumer = 8 consumers, so at least 8 partitions.' }));
    } else {
      const own = step >= 2 ? [0, 0, 2] : [0, 1, 2];
      const st = [['reading', 'reading', 'reading'], ['reading', 'crashed · missed heartbeats', 'reading'], ['takes over p1', 'gone from group', 'reading'], ['reading p1 from after offset 37', 'gone from group', 'reading']][step];
      const txt = ['Step 1: each consumer owns one partition and commits its offset every few seconds.', 'Step 2: consumer B crashes. p1 has no reader; its events wait safely in Kafka.', 'Step 3: the group rebalances. p1 moves to consumer A.', 'Step 4: A reads p1 from after B\'s saved offset 37. Nothing is lost; 38–40 may repeat.'][step];
      host.append(el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '8px' } }, [0, 1, 2].map(c => { const dead = c === 1 && step >= 1, ps = [0, 1, 2].filter(k => own[k] === c); return el('div', { style: { background: dead ? '#FDF0EC' : '#fff', borderRadius: '10px', padding: '8px 10px', border: '2px ' + (dead && step >= 2 ? 'dashed #C9A8A0' : 'solid ' + (dead ? '#B4432A' : CC[c])) } }, [el('b', { style: { color: dead ? '#B4432A' : CC[c] }, text: 'Consumer ' + 'ABC'[c] }), el('div', { style: { fontSize: '13px', fontWeight: 600 }, text: st[c] }), el('div', { class: 'row wrap', style: { gap: '4px', marginTop: '4px' } }, ps.map(k => el('span', { style: chipS(dead ? '#B4432A' : CC[c]), text: 'p' + k })))]); })),
        el('p', { style: { margin: 0, fontWeight: 600, background: '#FFF7EA', borderRadius: '10px', padding: '8px 12px' }, text: txt }),
        el('p', { style: { margin: 0, fontSize: '14.5px' }, html: '<b>Why it matters:</b> B saved offset 37, wrote 38–40, then crashed before saving again. A restarts after 37, so 38–40 are written twice. Kafka is <i>at least once</i>. Make the sink idempotent: MERGE/ON CONFLICT on event_id, dedupe with ROW_NUMBER, overwrite the partition, or use Spark checkpoints + Delta/Iceberg batch commits.' }));
    }
  }
  const t = setInterval(() => { if (playing && document.body.contains(host)) { step = (step + 1) % total(); draw(); } }, 1900);
  cleanup.push(() => clearInterval(t));
  draw();
  wrap.append(el('div', { class: 'fig' }, [el('div', { class: 'row wrap' }, [el('b', { text: 'Animated diagrams · Kafka' }), ctl]), tabs, host]));
  return wrap;
}

/* ---------------- Workbench (DSA / SQL / Spark / coding test) ---------------- */
let REPL = [];
function vWork(kind, id, mode) {
  let Q, lang, title, eyebrow;
  if (kind === 'test') {
    const [w, i] = id.split('/'); const sp = DATA.sprints[w];
    if (!sp) { sprint(w).then(() => vWork(kind, id)); shell('Loading…', '', [el('p', { class: 'muted', text: 'Loading the coding test…' })]); return; }
    const c = sp.coding[+i];
    if (!c) { location.hash = '#/practice/tests'; return; }
    Q = { id: 't' + qk(w) + '_' + i, t: c.TITLE, lv: c.MIN + ' min', p: c.PROBLEM, sol: c.CODE || c.SOLUTION, solMd: c.SOLUTION, test: c.TEST, kind2: c.KIND, src: c.SRC, h: ['Read the problem twice and write down the inputs and the output grain.', 'Solve a tiny example by hand first.', 'Check NULLs, empty inputs and duplicates.'], w: w };
    lang = c.KIND === 'sql' ? 'sql' : c.KIND === 'pyspark' ? 'spark' : 'python';
    title = c.TITLE; eyebrow = 'Coding test · module ' + modLabel(w) + ' · ' + c.KIND + (c.SRC ? ' · ' + c.SRC : '');
  } else {
    Q = (DATA[kind] || []).find(x => x.id === id);
    if (!Q) { location.hash = '#/practice'; return; }
    lang = kind === 'dsa' || kind === 'py' ? 'python' : kind;
    title = Q.t; eyebrow = kind === 'py' ? 'Python · ' + modLabel(Q.m) + ' · exercise ' + (DATA.py.filter(x => x.m === Q.m).indexOf(Q) + 1) + ' · ' + Q.lv : (kind === 'dsa' ? 'DSA · day ' + (DATA.dsa.indexOf(Q) + 1) + ' of 84' : kind === 'sql' ? 'SQL · ' + (Q.k === 'O' ? 'optimize' : 'write') : 'PySpark · ' + (Q.k === 'O' ? 'optimize' : 'write')) + (Q.m ? ' · ' + modLabel(Q.m) : ' · set ' + Q.w) + ' · ' + Q.lv;
  }
  const qid = Q.id;
  const rv = (S.rev || {})[qid];
  let review = kind !== 'test' && mode === 'review' && !!rv && !!rv.due && rv.due <= iso(new Date());
  if (review) eyebrow = 'Review · ' + eyebrow;
  const starter = kind === 'py' ? Q.sig : kind === 'dsa' ? (Q.sig + (Q.cls ? '\n' : '\n    # your approach here\n    pass\n')) : kind === 'sql' ? (Q.k === 'O' ? Q.start : '-- ' + Q.p + '\n') : kind === 'spark' ? Q.start : (lang === 'sql' ? '-- write your query\n' : lang === 'spark' ? 'from pyspark.sql import functions as F\n\n' : '# write your solution\n');
  if (S.code[qid] === undefined) S.code[qid] = starter;
  /* a review starts from a blank editor with no hints, once per due date */
  if (review && rv.started !== rv.due) { S.code[qid] = starter; S.hints[qid] = 0; S.runs[qid] = 0; S.secs[qid] = 0; rv.started = rv.due; save(); }
  const L = S.layout;
  let lw = L.lw || 340, rw = L.rw || 330, oh = L.oh || 260;
  let secs = S.secs[qid] || 0, running = true, outTab = lang === 'python' ? 'tests' : 'result', last = null;
  const runs = () => S.runs[qid] || 0, nh = () => S.hints[qid] || 0;
  const unlocked = () => runs() >= 2 || secs >= 900;
  const clock = el('span', { class: 'mono', style: { fontSize: '17px', minWidth: '52px', textAlign: 'right' } });
  const tick = setInterval(() => { if (running && document.visibilityState === 'visible') { secs++; S.secs[qid] = secs; if (secs % 10 === 0) save(false); paintClock(); } }, 1000);
  cleanup.push(() => { clearInterval(tick); S.secs[qid] = secs; save(false); });
  const paintClock = () => { clock.textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'); };
  paintClock();
  const pauseBtn = el('button', { class: 'btn sm', onclick: () => { running = !running; pauseBtn.textContent = running ? 'Pause' : 'Resume'; } }, 'Pause');
  const resetBtn = el('button', { class: 'btn sm', title: 'Set the timer to 0:00', onclick: () => { const prev = secs; secs = 0; paintClock(); toast('Timer reset to 0:00', () => { secs = prev + secs; paintClock(); }); } }, 'Reset timer');
  const back = kind === 'test' ? '#/practice/tests' : review ? '#/practice/review' : '#/path/' + (Q.m || Q.w);
  const exitBtn = el('button', { class: 'btn sm warn', onclick: async () => {
    const was = running; running = false; pauseBtn.textContent = 'Resume';
    const v = await confirmBox('Leave ' + title + '?', 'Time so far ' + clock.textContent + ' · ' + nh() + ' hints · ' + runs() + ' runs', [{ t: 'Save and exit', s: 'code, hints and timer kept', cls: 'pri', v: 'save' }, { t: 'Reset and exit', s: 'clears code, hints and timer; Undo for 10 s', cls: 'warn', v: 'reset' }, { t: 'Keep working', v: null }]);
    if (v === 'save') { location.hash = back; }
    else if (v === 'reset') { const snap = { c: S.code[qid], r: S.runs[qid], h: S.hints[qid], s: secs }; S.code[qid] = starter; S.runs[qid] = 0; S.hints[qid] = 0; S.secs[qid] = 0; secs = 0; save(); location.hash = back; setTimeout(() => toast('Attempt reset', () => { S.code[qid] = snap.c; S.runs[qid] = snap.r; S.hints[qid] = snap.h; S.secs[qid] = snap.s; save(); }), 50); }
    else { running = was; pauseBtn.textContent = running ? 'Pause' : 'Resume'; }
  } }, 'Exit');
  const extra = el('div', { class: 'row', style: { gap: '6px' } }, [clock, el('span', { class: 'hide-m row', style: { gap: '6px' } }, [pauseBtn, resetBtn]), exitBtn]);

  /* left: problem */
  const solved = el('span');
  const paintSolved = () => { solved.textContent = S.solved[qid] ? '✓ Solved' : ''; solved.className = S.solved[qid] ? 'chip c-dsa' : ''; };
  paintSolved();
  const left = el('section', { class: 'card pad pane stack', style: { gap: '10px' } }, [
    el('div', { class: 'row' }, [el('span', { class: 'lbl grow', text: 'Problem' }), solved, el('button', { class: 'btn icon sm hide-m', 'aria-label': 'Hide the problem panel', title: 'Hide', onclick: () => { L.lshut = 1; save(false); lay(); } }, svg(I.dbl_l, 18))]),
    el('h2', { style: { fontSize: '20px' }, text: title }),
    kind === 'test' ? mdEl(Q.p, 'prose') : el('div', { class: 'stack', style: { gap: '8px' } }, [el('div', { style: { fontSize: '15.5px', lineHeight: 1.55 }, html: mdi(Q.p) }),
      kind === 'dsa' ? el('div', { class: 'schema', text: Q.tests.slice(0, 2).map(t => Q.fn + '(' + t[0].map(a => JSON.stringify(a)).join(', ') + ') → ' + JSON.stringify(t[1])).join('\n'), style: { whiteSpace: 'pre-wrap' } }) : null,
      kind === 'py' ? el('div', { class: 'schema', text: 'Example (' + Q.tests[0][0] + '):\n' + Q.tests[0][1] + '\n# → ' + JSON.stringify(Q.tests[0][2]), style: { whiteSpace: 'pre-wrap' } }) : null]),
    review ? el('div', { class: 'hint' }, [el('b', { text: 'Review ' + (rv.box + 1) + ' of ' + REV_GAPS.length + '. ' }), 'Solve it again from a blank editor. Pass without opening the solution and it comes back in ' + (REV_GAPS[rv.box + 1] ? REV_GAPS[rv.box + 1] + ' days' : 'no more reviews') + '. If you open the solution, it starts again in 3 days.']) : null,
    Q.why ? el('div', { class: 'why' }, [el('b', { text: 'Why a data engineer cares: ' }), Q.why]) : null,
    lang !== 'python' ? tablesBox() : null,
    Q.rec ? el('div', { class: 'stack', style: { gap: '6px' } }, [el('span', { class: 'lbl', text: 'On full data (typical estimate)' }), el('div', { class: 'hint', style: { background: 'var(--red-l)', borderColor: '#F0C4B8' } }, [el('b', { text: 'Before: ' }), Q.rec[0]]), el('div', { class: 'hint' }, [el('b', { text: 'Target: ' }), Q.rec[1]])]) : null,
    kind !== 'test' ? el('a', { href: '#/path/' + (Q.m || Q.w), style: { fontWeight: 600 }, text: 'See this topic in its module' }) : null]);

  /* middle: editor + output */
  const ta = el('textarea', { class: 'code', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', 'aria-label': 'Your code' });
  ta.value = S.code[qid];
  ta.addEventListener('input', () => { S.code[qid] = ta.value; save(); });
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); return; }
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('    ', s, ta.selectionEnd, 'end'); S.code[qid] = ta.value; save(); }
    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) { const s = ta.selectionStart, line = ta.value.slice(ta.value.lastIndexOf('\n', s - 1) + 1, s); const ind = (line.match(/^\s*/) || [''])[0] + (/:\s*$/.test(line) ? '    ' : ''); if (ind) { e.preventDefault(); ta.setRangeText('\n' + ind, s, ta.selectionEnd, 'end'); S.code[qid] = ta.value; save(); } }
  });
  const runBtn = el('button', { class: 'btn pri', title: 'Run (⌘/Ctrl + Enter)', onclick: () => run() }, [runs() ? 'Run again' : 'Run', el('span', { class: 'kbd', text: '⌘↵' })]);
  const pyState = el('div', { class: 'pystate', role: 'status' });
  const fileName = lang === 'python' ? 'solution.py · Python 3' : lang === 'sql' ? 'query.sql · DuckDB in your browser' : 'job.py · PySpark (practice engine)';
  const editor = el('div', { class: 'card editor' }, [el('div', { class: 'bar2' }, [el('span', { class: 'mono fname', text: fileName }),
    el('button', { class: 'btn sm hide-m', onclick: () => { const f = L.lshut && L.rshut; L.lshut = L.rshut = f ? 0 : 1; save(false); lay(); }, text: 'Focus editor' }),
    el('button', { class: 'btn sm', onclick: () => { setTab('term'); } }, [svg(I.term, 16), 'Terminal']),
    el('button', { class: 'btn sm', onclick: async () => { const v = await confirmBox('Reset the code?', 'Your code goes back to the starter. Undo is available for 10 seconds.', [{ t: 'Reset code', cls: 'warn', v: 1 }, { t: 'Cancel', v: null }]); if (v) { const old = ta.value; ta.value = starter; S.code[qid] = starter; save(); toast('Code reset', () => { ta.value = old; S.code[qid] = old; save(); }); } }, text: 'Starter code' }), runBtn]), pyState, ta]);
  const OT = lang === 'python' ? [['tests', 'Tests'], ['term', 'Terminal']] : lang === 'sql' ? [['result', 'Result'], ['tests', 'Tests'], ['plan', 'Plan'], ['term', 'Terminal']] : [['result', 'Output'], ['tests', 'Tests'], ['plan', 'explain()'], ['term', 'Terminal']];
  const outTabs = el('div', { class: 'row wrap', role: 'tablist', style: { gap: '4px' } });
  const verdict = el('span', { class: 'verdict', style: { display: 'none' } });
  const obody = el('div', { class: 'body' });
  const termLines = el('div', { class: 'term-lines', 'aria-live': 'polite' });
  const termIn = el('input', { type: 'text', placeholder: lang === 'sql' ? 'SELECT * FROM trips LIMIT 5  then Enter' : 'two_sum([1, 5, 3], 8)  then Enter', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'go', 'aria-label': 'Terminal input' });
  termIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendLine(); } });
  const termBox = el('div', { class: 'term-in' }, [el('label', { class: 'mono', style: { color: '#5CC8B0', fontSize: '13.5px' }, text: lang === 'sql' ? 'sql>' : '>>>' }), termIn, el('button', { class: 'btn sm pri', onclick: () => sendLine() }, ['Run line', el('span', { class: 'kbd', text: '↵' })])]);
  const out = el('div', { class: 'card out' }, [el('div', { class: 'head' }, [outTabs, el('span', { class: 'grow' }), verdict, el('button', { class: 'otab', onclick: () => { termLines.textContent = ''; REPL = []; }, text: 'Clear' })]), obody]);
  const hgrip = el('div', { class: 'hgrip hide-m', role: 'separator', 'aria-orientation': 'horizontal', 'aria-label': 'Drag to resize the output panel', tabindex: '0' }, el('i'));
  const mid = el('section', { class: 'mid' }, [editor, hgrip, out]);
  function setTab(k) { outTab = k; paintOut(); if (k === 'term') setTimeout(() => termIn.focus(), 30); if (window.innerWidth < 1024) mshow('out'); }
  function addTerm(cls, t) { REPL.push([cls, t]); if (REPL.length > 300) REPL.shift(); if (outTab === 'term') { termLines.appendChild(el('div', { class: cls, text: t })); obody.scrollTop = obody.scrollHeight; } }
  function paintOut() {
    outTabs.textContent = '';
    OT.forEach(([k, n]) => outTabs.appendChild(el('button', { class: 'otab', role: 'tab', 'aria-selected': String(k === outTab), onclick: () => setTab(k), text: n })));
    out.classList.toggle('term', outTab === 'term');
    obody.textContent = '';
    if (out.contains(termBox)) termBox.remove();
    if (outTab === 'term') {
      termLines.textContent = '';
      if (!REPL.length) REPL.push(['info', lang === 'sql' ? 'SQL terminal on the sample tables (DuckDB). Try: SHOW TABLES' : 'Python 3 in your browser. Your editor code is loaded when you run it. print() output and errors appear here.']);
      REPL.forEach(([c, t]) => termLines.appendChild(el('div', { class: c, text: t })));
      obody.appendChild(termLines); out.appendChild(termBox); obody.scrollTop = obody.scrollHeight; return;
    }
    if (!last) { obody.appendChild(el('p', { class: 'muted', style: { margin: 0 }, text: 'Run your code to see ' + (lang === 'python' ? 'the tests' : 'results, tests and the plan') + '. It runs in your browser; nothing is sent anywhere.' })); return; }
    if (last.err) obody.appendChild(el('pre', { class: 'mono', style: { color: 'var(--red-d)', whiteSpace: 'pre-wrap', margin: '0 0 8px' }, text: last.err }));
    if (outTab === 'tests') {
      (last.tests || []).forEach(t => obody.appendChild(el('div', { class: 'row', style: { alignItems: 'flex-start', marginBottom: '8px' } }, [el('span', { class: 'badge ' + (t.ok ? 'b-ok' : t.warn ? 'b-warn' : 'b-bad'), text: t.ok ? 'Pass' : t.warn ? 'Warn' : 'Fail' }), el('div', { class: 'grow' }, [el('b', { class: t.call ? 'mono' : '', style: { fontSize: t.call ? '13px' : '14.5px' }, text: t.call || t.name }), el('div', { class: 'muted', style: { fontSize: '13.5px' }, text: t.call ? ('expected ' + t.want + ' · got ' + t.got) : t.note })])])));
      if (last.out) obody.appendChild(el('pre', { class: 'mono', style: { fontSize: '12.5px', background: 'var(--soft)', padding: '8px', borderRadius: '8px', whiteSpace: 'pre-wrap' }, text: last.out }));
    } else if (outTab === 'result') {
      if (last.out) obody.appendChild(el('pre', { class: 'mono', style: { fontSize: '12.5px', whiteSpace: 'pre', overflow: 'auto', margin: '0 0 8px' }, text: last.out }));
      if (last.table) obody.appendChild(table(last.table));
    } else if (outTab === 'plan') {
      if (last.plan) obody.appendChild(el('pre', { class: 'mono', style: { fontSize: '12.5px', whiteSpace: 'pre-wrap', margin: '0 0 8px' }, text: last.plan }));
      if (Q.rec) obody.appendChild(el('div', { class: 'stack', style: { gap: '6px' } }, [el('div', { class: 'hint', style: { background: 'var(--red-l)', borderColor: '#F0C4B8' } }, [el('b', { text: 'Original on full data: ' }), Q.rec[0]]), el('div', { class: 'hint' }, [el('b', { text: (last.pass ? 'Your version: ' : 'Target: ') }), Q.rec[1]])]));
      else if (!last.plan) obody.appendChild(el('p', { class: 'muted', text: 'Plans are shown for optimize questions and PySpark jobs.' }));
    }
  }
  function table(t) {
    const w = el('div', { class: 'scroll' });
    w.appendChild(el('div', { class: 'muted', style: { fontSize: '12.5px', marginBottom: '4px' }, text: t.total + ' rows' + (t.total > t.rows.length ? ' · first ' + t.rows.length + ' shown' : '') }));
    w.appendChild(el('table', { class: 'tbl' }, [el('thead', {}, el('tr', {}, t.cols.map(c => el('th', { text: c })))), el('tbody', {}, t.rows.map(r => el('tr', {}, r.map(c => el('td', { text: c === null ? 'NULL' : c })))))]));
    return w;
  }
  Py.on((st, txt) => { pyState.textContent = st === 'loading' ? txt : st === 'error' ? txt : ''; });
  async function run() {
    const code = ta.value; S.code[qid] = code;
    runBtn.disabled = true; const old = runBtn.firstChild.textContent; runBtn.firstChild.textContent = 'Running…';
    try {
      let r;
      if (kind === 'test') {
        r = await Py.json('run_program_test', [code, Q.test || '', Q.kind2 === 'pyspark' ? 'pyspark' : Q.kind2 === 'sql' ? 'sql' : 'python'], 30000);
        r.tests = [{ name: 'Hidden tests from the course', ok: r.ok, note: r.ok ? 'All assertions passed.' : (r.err || 'Failed') }]; r.pass = r.ok; if (!r.ok) r.err = null;
        if (lang === 'sql' && !r.err) { const t = await Py.json('run_sql', [code]); r.table = t.table; }
      } else if (kind === 'dsa') {
        const spec = { fn: Q.fn, tests: Q.tests, big: Q.big, bigLabel: Q.bigLabel, cls: Q.cls, in: Q.in, out: Q.out, inplace: Q.inplace, sortout: Q.sortout, unordered: Q.un, lca: Q.lca };
        r = await Py.json('check_dsa', [JSON.stringify(spec), code], 15000);
        r.pass = !r.err && r.tests.length && r.tests.every(t => t.ok);
      } else if (kind === 'py') {
        r = await Py.json('check_py', [JSON.stringify({ tests: Q.tests }), code], 20000);
        r.pass = !r.err && r.tests.length && r.tests.every(t => t.ok);
      } else if (kind === 'sql') {
        r = await Py.json('check_sql', [code, Q.sol, !!Q.ordered]);
        if (Q.approx && !r.err) { r.tests = [{ name: 'Same days', ok: r.tests[0].ok, note: r.tests[0].note }, { name: 'Counts close to exact', ok: true, note: 'approximate counts may differ by a few percent' }]; r.pass = r.tests.every(t => t.ok); }
      } else {
        r = await Py.json('check_spark', [code, Q.sol, 'result', !!Q.ordered], 30000);
        if (Q.empty && !r.err) { r.tests = [{ name: 'Check runs and returns no violations', ok: r.table && r.table.total === 0, note: (r.table ? r.table.total : 0) + ' rows' }]; r.pass = r.tests[0].ok; }
        if (Q.approx && !r.err && r.tests) { r.tests[1] = { name: 'Counts close to exact', ok: true, note: 'approximate counts may differ by a few percent' }; r.pass = r.tests[0].ok; }
      }
      if (kind === 'sql' || kind === 'spark' || kind === 'py') {
        const rules = [];
        (Q.avoid || []).forEach(([rx, msg]) => { const bad = new RegExp(rx, 'i').test(code); rules.push({ name: 'Rule: ' + msg.split('.')[0], ok: !bad, note: bad ? msg : 'ok' }); });
        (Q.need || []).forEach(([rx, msg]) => { const ok = new RegExp(rx, 'i').test(code); rules.push({ name: 'Rule: ' + msg.split('.')[0], ok, note: ok ? 'ok' : msg }); });
        if (rules.length && !r.err) { r.tests = (r.tests || []).concat(rules); r.pass = r.pass && rules.every(t => t.ok); }
      }
      last = r;
      S.runs[qid] = runs() + 1;
      if (r.pass) {
        const first = !S.solved[qid]; S.solved[qid] = 1;
        if (review) {
          const lapsed = nh() > H.length; revPut(qid, lapsed ? 0 : rv.box + 1); review = false;
          const nr = S.rev[qid];
          toast(lapsed ? 'Solved with the solution open, so it comes back in 3 days.' : nr.due ? 'Review passed. Next review ' + shortDate(nr.due) + '.' : 'Review passed. You have learned this one.', null, 5000);
        } else if (first && kind !== 'test' && !(S.rev || {})[qid] && (nh() >= 2 || runs() >= 3)) {
          revPut(qid, 0); toast('Solved. It took ' + (nh() >= 2 ? nh() + ' hints' : runs() + ' runs') + ', so it comes back for review on ' + shortDate(S.rev[qid].due) + '.', null, 5000);
        } else if (first) toast('Solved. Nice work.');
        paintRev();
      }
      save(); paintSolved();
      verdict.style.display = '';
      const passed = (r.tests || []).filter(t => t.ok).length, all = (r.tests || []).length;
      verdict.textContent = r.err ? 'Error' : r.pass ? 'All checks pass' : passed + ' of ' + all + ' pass';
      verdict.className = 'verdict ' + (r.pass ? 'b-ok' : r.err ? 'b-bad' : 'b-warn');
      addTerm('cmd', '$ run ' + fileName.split(' ')[0]);
      if (r.out) addTerm('', r.out.trimEnd());
      if (r.err) addTerm('err', r.err);
      addTerm(r.pass ? 'ok' : 'info', verdict.textContent);
      if (outTab === 'term') paintOut(); else { outTab = r.err && lang !== 'python' ? 'result' : (lang === 'python' ? 'tests' : (outTab === 'result' || outTab === 'tests' || outTab === 'plan') ? outTab : 'result'); paintOut(); }
      paintHints();
    } catch (e) { last = { err: String(e.message || e) }; addTerm('err', last.err); paintOut(); }
    finally { runBtn.disabled = false; runBtn.firstChild.textContent = 'Run again'; if (window.innerWidth < 1024) mshow('out'); }
  }
  async function sendLine() {
    const line = termIn.value; if (!line.trim()) return; termIn.value = '';
    addTerm('cmd', (lang === 'sql' ? 'sql> ' : '>>> ') + line);
    try {
      if (lang === 'sql') { const r = await Py.json('run_sql', [line]); if (r.err) addTerm('err', r.err); else addTerm('', fmtTable(r.table)); }
      else { if (!sendLine.loaded) { await Py.json('run_script', [ta.value]); sendLine.loaded = true; } const r = await Py.json('repl', [line]); if (r.out) addTerm('', r.out.trimEnd()); if (r.err) addTerm('err', r.err); }
    } catch (e) { addTerm('err', String(e.message || e)); }
  }
  ta.addEventListener('input', () => { sendLine.loaded = false; });
  function fmtTable(t) { if (!t || !t.cols.length) return '(ok)'; const rows = [t.cols].concat(t.rows.slice(0, 20).map(r => r.map(c => c === null ? 'NULL' : c))); const w = t.cols.map((_, i) => Math.min(24, Math.max(...rows.map(r => String(r[i]).length)))); return rows.map((r, k) => r.map((c, i) => String(c).slice(0, 24).padEnd(w[i])).join(' │ ') + (k === 0 ? '\n' + w.map(x => '─'.repeat(x)).join('─┼─') : '')).join('\n') + (t.total > 20 ? '\n… ' + t.total + ' rows' : '\n(' + t.total + ' rows)'); }

  /* right: hints, follow-ups, solution */
  const hintBox = el('div', { class: 'stack', style: { gap: '8px' } });
  const hintBtn = el('button', { class: 'btn dark', onclick: () => { S.hints[qid] = Math.min(H.length + 1, nh() + 1); if (nh() > H.length && kind !== 'test' && !review && !S.solved[qid] && !(S.rev || {})[qid]) { revPut(qid, 0); paintRev(); } save(); paintHints(); } });
  const H = Q.h || [];
  const stuck = el('input', { type: 'text', placeholder: 'Why is my loop slow?', 'aria-label': 'Ask the coach', class: 'grow', style: { minHeight: '44px', border: '1px solid var(--line2)', borderRadius: '10px', padding: '0 12px' } });
  const stuckOut = el('div');
  function paintHints() {
    hintBox.textContent = '';
    H.slice(0, Math.min(nh(), H.length)).forEach((h, i) => hintBox.appendChild(el('div', { class: 'hint' }, [el('b', { text: (i + 1) + '. ' + ['Restate', 'Intuition', 'Pattern', 'Edge cases', 'Skeleton'][i] }), /\n/.test(h) ? el('pre', { text: h }) : el('div', { text: h })])));
    const showSol = nh() > H.length;
    if (showSol) hintBox.appendChild(el('div', { class: 'hint', style: { background: 'var(--card)', borderColor: 'var(--line2)' } }, [el('b', { text: 'Reference solution' }), kind === 'test' ? mdEl(Q.solMd, 'prose') : el('pre', { text: Q.sol.replace(/^from pyspark[^\n]*\n/gm, '') })]));
    const locked = nh() === H.length && !unlocked();
    hintBtn.disabled = showSol || locked;
    hintBtn.textContent = showSol ? 'All hints shown' : locked ? 'Run twice (or 15 min) to unlock the solution' : nh() === H.length ? 'Show the solution' : 'Show hint ' + (nh() + 1);
    hintCount.textContent = Math.min(nh(), H.length) + ' of ' + H.length + ' hints';
  }
  const hintCount = el('span', { class: 'muted', style: { fontSize: '13px' } });
  const revInfo = el('span', { class: 'muted', style: { fontSize: '13px' } });
  const revBtn = el('button', { class: 'btn sm', style: { alignSelf: 'flex-start' }, onclick: () => { revPut(qid, 0); paintRev(); toast('In your review queue: due ' + shortDate(S.rev[qid].due) + '.'); } });
  function paintRev() { const r = (S.rev || {})[qid]; revInfo.textContent = r ? 'Review queue: ' + revText(r) + '.' : 'Struggled with this one? Bring it back later.'; revBtn.textContent = r && r.due ? 'Restart: review in 3 days' : 'Review again in 3 days'; }
  paintRev();
  const fups = (Q.fups || []).map(([q, a]) => { const ans = el('div', { style: { fontSize: '14px', lineHeight: 1.45, padding: '6px 4px 0', display: 'none' }, text: a }); const b = el('button', { 'aria-expanded': 'false', onclick: () => { const o = ans.style.display === 'none'; ans.style.display = o ? 'block' : 'none'; b.setAttribute('aria-expanded', String(o)); }, text: q }); return el('div', { class: 'fup' }, [b, ans]); });
  const right = el('aside', { class: 'card pad pane stack', style: { gap: '10px' } }, [
    el('div', { class: 'row' }, [el('button', { class: 'btn icon sm hide-m', 'aria-label': 'Hide the coach panel', title: 'Hide', onclick: () => { L.rshut = 1; save(false); lay(); } }, svg(I.dbl_r, 18)), el('h3', { class: 'grow', text: 'Coach' }), hintCount]),
    el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'Hints come one step at a time. The solution unlocks after two runs or 15 minutes.' }),
    hintBox, hintBtn,
    el('div', { class: 'stack', style: { gap: '6px', borderTop: '1px solid var(--line)', paddingTop: '10px' } }, [el('label', { style: { fontWeight: 700 }, text: 'I\'m stuck. Ask the coach' }), el('div', { class: 'row' }, [stuck, el('button', { class: 'btn', onclick: () => askCoach(stuck.value, { title, problem: Q.p, code: ta.value, hints: H }, stuckOut), text: 'Ask' })]), stuckOut]),
    fups.length ? el('div', { class: 'stack', style: { gap: '8px', borderTop: '1px solid var(--line)', paddingTop: '10px' } }, [el('span', { class: 'lbl', style: { color: 'var(--plum-d)' }, text: 'Interviewer follow-ups' })].concat(fups)) : null,
    kind !== 'test' ? el('div', { class: 'stack', style: { gap: '6px', borderTop: '1px solid var(--line)', paddingTop: '10px' } }, [el('span', { class: 'lbl', text: 'Spaced review' }), revInfo, revBtn]) : null]);
  stuck.addEventListener('keydown', e => { if (e.key === 'Enter') askCoach(stuck.value, { title, problem: Q.p, code: ta.value, hints: H }, stuckOut); });
  paintHints(); paintOut();

  const railL = el('button', { class: 'rail', 'aria-label': 'Show the problem panel', onclick: () => { L.lshut = 0; save(false); lay(); } }, [svg(I.dbl_r, 18), el('span', { text: 'Problem' })]);
  const railR = el('button', { class: 'rail', 'aria-label': 'Show the coach panel', onclick: () => { L.rshut = 0; save(false); lay(); } }, [svg(I.dbl_l, 18), el('span', { text: 'Coach · hints' })]);
  const gripL = el('div', { class: 'grip', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Drag to resize the problem panel', tabindex: '0' }, el('i'));
  const gripR = el('div', { class: 'grip', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Drag to resize the coach panel', tabindex: '0' }, el('i'));
  const wb = el('div', { class: 'wb' });
  const mtabs = el('div', { class: 'mtabs', role: 'group', 'aria-label': 'Show panel' });
  let mcur = 'code';
  function mshow(k) { mcur = k; [left, mid, right].forEach(x => x.classList.remove('mshow')); (k === 'problem' ? left : k === 'hints' ? right : mid).classList.add('mshow'); if (k === 'out') out.scrollIntoView({ block: 'nearest' }); mtabs.querySelectorAll('button[data-k]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === (k === 'out' ? 'code' : k)))); }
  [['problem', 'Problem'], ['code', 'Code'], ['hints', 'Hints']].forEach(([k, n]) => mtabs.appendChild(el('button', { 'data-k': k, onclick: () => mshow(k), text: n })));
  mtabs.appendChild(el('button', { onclick: () => { running = !running; mtabs.lastChild.textContent = running ? 'Pause' : 'Resume'; }, text: 'Pause' }));
  function lay() {
    wb.textContent = '';
    wb.style.setProperty('--lw', (L.lshut ? 46 : lw) + 'px'); wb.style.setProperty('--rw', (L.rshut ? 46 : rw) + 'px');
    out.style.height = oh + 'px';
    wb.append(L.lshut ? railL : left, gripL, mid, gripR, L.rshut ? railR : right);
    mshow(mcur);
  }
  const drag = (gr, onMove) => { gr.addEventListener('pointerdown', e => { e.preventDefault(); const x0 = e.clientX, y0 = e.clientY, a = lw, b = rw, c = oh; gr.setPointerCapture(e.pointerId); const mv = ev => { onMove(ev.clientX - x0, ev.clientY - y0, a, b, c); av(); }; const up = () => { gr.removeEventListener('pointermove', mv); gr.removeEventListener('pointerup', up); L.lw = lw; L.rw = rw; L.oh = oh; save(false); }; gr.addEventListener('pointermove', mv); gr.addEventListener('pointerup', up); }); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  drag(gripL, (dx, dy, a) => { if (L.lshut) return; lw = clamp(a + dx, 240, 520); wb.style.setProperty('--lw', lw + 'px'); });
  drag(gripR, (dx, dy, a, b) => { if (L.rshut) return; rw = clamp(b - dx, 260, 520); wb.style.setProperty('--rw', rw + 'px'); });
  drag(hgrip, (dx, dy, a, b, c) => { oh = clamp(c - dy, 120, Math.max(200, window.innerHeight - 320)); out.style.height = oh + 'px'; });
  const key = (gr, fn) => gr.addEventListener('keydown', e => { const st = e.shiftKey ? 60 : 20; const d = { ArrowLeft: -st, ArrowRight: st, ArrowUp: -st, ArrowDown: st }[e.key]; if (d) { e.preventDefault(); fn(d); av(); L.lw = lw; L.rw = rw; L.oh = oh; save(false); } });
  key(gripL, d => { lw = clamp(lw + d, 240, 520); wb.style.setProperty('--lw', lw + 'px'); });
  key(gripR, d => { rw = clamp(rw - d, 260, 520); wb.style.setProperty('--rw', rw + 'px'); });
  key(hgrip, d => { oh = clamp(oh - d, 120, 560); out.style.height = oh + 'px'; });
  function av() { [[gripL, lw, 240, 520], [gripR, rw, 260, 520], [hgrip, oh, 120, 560]].forEach(([g, v, a, b]) => { g.setAttribute('aria-valuenow', Math.round(v)); g.setAttribute('aria-valuemin', a); g.setAttribute('aria-valuemax', b); }); }
  av();
  lay();
  shell(title, eyebrow, el('div', { class: 'stack', style: { gap: '10px' } }, [mtabs, wb]), { back, extra, raw: true });
  const pg = document.querySelector('.main'); pg.lastChild.style.padding = window.innerWidth < 1024 ? '10px 12px 100px' : '0';
  Py.start().catch(() => { });
}
function tablesBox() {
  const box = el('div', { class: 'stack', style: { gap: '6px' } }, [el('span', { class: 'lbl', text: 'Sample tables (tap to load)' })]);
  const btn = el('button', { class: 'btn sm', onclick: async () => { btn.disabled = true; btn.textContent = 'Loading…'; try { const t = await Py.json('tables', []); btn.remove(); t.forEach(x => box.appendChild(el('div', { class: 'schema' }, [el('b', { text: x.name }), ' · ' + x.rows + ' rows', el('br'), x.cols.join(', ')]))); } catch (e) { btn.disabled = false; btn.textContent = 'Retry'; } } }, 'Show tables and columns');
  box.appendChild(btn);
  box.appendChild(el('div', { class: 'muted', style: { fontSize: '13px' }, text: 'A small ride-hailing dataset: cities, riders, drivers, trips, payments, trip_events, clicks, employees, plus modelling tables (rider_tier_snapshots, dim_rider_tier, rider_tier_today, rider_activity_cumulated, referrals, trip_promos) and legacy_daily_city_revenue and query_log for the leadership module. PySpark reads them with spark.table(\'trips\') or spark.read.parquet(\'s3://lake/trips\').' }));
  return box;
}

/* ---------------- Projects ---------------- */
function msDone(id) { return (S.proj[id] && S.proj[id].ms) || {}; }
function vProjects() {
  const cards = DATA.projects.map(x => {
    const ms = x.ms || [], d = msDone(x.id), n = ms.filter(m => d[m[0]]).length;
    return el('a', { class: 'item', href: '#/project/' + x.id, style: { alignItems: 'flex-start', padding: '12px 14px' } }, [
      el('span', { class: 'chip ' + (x.status === 'ready' ? 'c-dsa' : 'c-test'), style: { flex: 'none' }, text: modLabel(x.mod) }),
      el('span', { class: 'grow' }, [el('span', { class: 't', text: x.title }), el('br'), el('span', { class: 's', text: x.goal })]),
      el('span', { class: 's', style: { flex: 'none', fontWeight: 700 }, text: x.status === 'ready' ? (ms.length ? n + '/' + ms.length : '') : 'brief' })]);
  });
  shell('Projects', 'One real build per module · open source and free tier only', [
    el('section', { class: 'card pad stack' }, [el('h2', { text: 'How projects work' }),
      el('p', { style: { margin: 0 }, text: 'Most modules end with a project you build for real. The brief, steps, lessons and checks live here. The environment (object store, Iceberg, Spark, Trino, Airflow, ClickHouse, Git and VS Code) opens with one button in GitHub Codespaces, which runs in the browser on your iPad, iPhone or MacBook and is free for about 30 hours a month on a 4-core machine. You can also run it on your MacBook with Docker.' }),
      el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' }, text: 'Ready now: the AI agent toolkit (modules AI 1–3, a light 2-core Codespace) and the lakehouse (DE 1–2). The other projects show their brief and plan; their environments come in later updates.' })]),
    el('div', { class: 'list' }, cards)]);
}
async function vProject(id) {
  const x = DATA.projects.find(p => p.id === id);
  if (!x) { location.hash = '#/projects'; return; }
  const st = S.proj[id] = S.proj[id] || { ms: {} };
  const msList = el('div', { class: 'stack', style: { gap: '8px' } });
  const paintMs = () => { msList.textContent = ''; (x.ms || []).forEach(([n, t, how]) => { const d = !!st.ms[n]; msList.appendChild(el('div', { class: 'block' + (d ? ' done' : '') }, [el('button', { class: 'check', 'aria-pressed': String(d), 'aria-label': (d ? 'Mark not done: ' : 'Mark done: ') + t, onclick: () => { st.ms[n] = !d; save(); paintMs(); } }, d ? svg(I.check, 16) : null), el('div', { class: 'grow stack', style: { gap: '2px' } }, [el('span', { class: 't', text: 'Milestone ' + n + ' · ' + t }), el('span', { class: 's mono', style: { fontSize: '13px' }, text: how })])])); }); };
  paintMs();
  const codeIn = el('input', { type: 'text', placeholder: 'e.g. F19D62-12345', 'aria-label': 'Completion code from make check', class: 'grow', autocapitalize: 'characters', style: { minHeight: '44px', border: '1px solid var(--line2)', borderRadius: '10px', padding: '0 12px', fontFamily: 'var(--mono)' } });
  const codeOut = el('span', { class: 'muted', style: { fontSize: '14px' } });
  const verify = async () => {
    const m = /^([0-9A-F]{6})-(\d*)$/.exec(codeIn.value.trim().toUpperCase());
    if (!m) { codeOut.textContent = 'That does not look like a code from make check.'; return; }
    const done = m[2].split('').map(Number);
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode('lakehouse' + done.join(',')));
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 6).toUpperCase();
    if (hex !== m[1]) { codeOut.textContent = 'Code does not match. Copy the last line of make check exactly.'; return; }
    DATA.projects.filter(p => p.env === x.env).forEach(p => { const s2 = S.proj[p.id] = S.proj[p.id] || { ms: {} }; (p.ms || []).forEach(([n]) => { if (done.includes(n)) s2.ms[n] = true; }); });
    save(); paintMs(); codeOut.textContent = 'Verified: milestones ' + done.join(', ') + ' marked done.'; toast('Milestones verified');
  };
  const envCard = x.status === 'ready' ? el('section', { class: 'card pad stack', style: { borderColor: '#BFE3D6' } }, [el('h3', { text: 'Open the environment' }),
    el('div', { class: 'row wrap' }, [el('a', { class: 'btn pri', href: x.codespaces, target: '_blank', rel: 'noopener', text: 'Open in GitHub Codespaces' }), el('a', { class: 'btn', href: 'https://github.com/raghav511/de-architect/tree/main/projects/' + (x.env === 'ai' ? 'ai-foundations' : 'lakehouse'), target: '_blank', rel: 'noopener', text: 'Code on GitHub' })]),
    x.env === 'ai' ? el('span', { style: { fontSize: '14.5px' }, html: 'The default <b>2-core</b> machine is enough. It opens VS Code with Python, the harness and the labs ready. Every lab runs offline with the mock model first; add a free Gemini or Groq key, or a local Ollama, in <code>.env</code> to use a real model. <b>Stop the codespace</b> when you finish.' }) : el('span', { style: { fontSize: '14.5px' }, html: 'Choose the <b>4-core</b> machine. First start ≈ 10 min (images download), later ≈ 1 min. VS Code, Git, a terminal, Jupyter, Trino, Airflow and ClickHouse open as tabs. <b>Stop the codespace</b> when you finish so your free hours last.' }),
    el('details', {}, [el('summary', { style: { cursor: 'pointer', fontWeight: 700 }, text: 'Run on your MacBook instead' }), el('pre', { class: 'schema', style: { whiteSpace: 'pre-wrap' }, text: x.env === 'ai' ? 'git clone https://github.com/raghav511/de-architect\ncd de-architect/projects/ai-foundations\npython3 -m venv .venv && source .venv/bin/activate\npip install -r requirements.txt && cp .env.example .env\npytest -q   # lab tests' : 'Install Docker Desktop (8 GB+ memory)\ngit clone https://github.com/raghav511/de-architect\ncd de-architect/projects/lakehouse\nmake up-all\n# Jupyter :8888 · Trino :8080 · Airflow :8081 (admin/admin)' })]),
    x.env !== 'lakehouse' ? el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'Tick each milestone below when its check passes.' }) : el('div', { class: 'stack', style: { gap: '6px', borderTop: '1px solid var(--line)', paddingTop: '10px' } }, [el('b', { text: 'Finished a milestone? Paste the code from make check' }), el('div', { class: 'row' }, [codeIn, el('button', { class: 'btn', onclick: verify, text: 'Verify' })]), codeOut])]) : el('section', { class: 'card pad' }, [el('p', { style: { margin: 0 }, text: 'This project\'s environment comes in a later update. Use the brief to plan it, sketch the architecture in the design studio, and note the questions you want answered.' })]);
  const body = [
    el('section', { class: 'card pad stack' }, [el('span', { class: 'lbl', text: 'Module ' + modLabel(x.mod) + ' project · ' + weeksText(schedule().span[x.mod]) + (x.status === 'ready' ? ' · ready to build' : ' · brief') }), el('h1', { style: { fontSize: '26px' }, text: x.title }), el('p', { style: { margin: 0, fontSize: '17px' }, text: x.goal }),
      el('div', { class: 'row wrap', style: { gap: '6px' } }, x.stack.map(t => el('span', { class: 'chip c-core', text: t }))),
      el('ul', { style: { margin: 0, paddingLeft: '20px' } }, x.parts.map(t => el('li', { text: t })))]),
    envCard,
    x.ms ? el('section', { class: 'card pad stack' }, [el('h3', { text: 'Milestones' }), msList]) : null,
    x.env === 'lakehouse' ? icebergDiagram() : null,
    x.refs ? el('section', { class: 'card pad stack' }, [el('h3', { text: 'References' }), el('div', { class: 'list' }, x.refs.map(([t, u]) => el('a', { class: 'item', href: u, target: '_blank', rel: 'noopener' }, [el('span', { class: 'grow t', text: t }), el('span', { class: 's', text: new URL(u).hostname })])))]) : null];
  const guide = el('article', { class: 'card pad' }, [el('p', { class: 'muted', text: x.readme ? 'Loading the project guide…' : '' })]);
  if (x.readme) body.push(guide);
  shell(x.title, 'Module ' + modLabel(x.mod) + ' project', body, { back: '#/projects' });
  if (x.readme) { try { const t = await fetch(x.readme).then(r => r.text()); guide.textContent = ''; guide.appendChild(el('h2', { text: 'Project guide and lessons' })); guide.appendChild(mdEl(t)); } catch (e) { guide.textContent = 'Could not load the guide. It is also in the repo at ' + x.readme; } }
}
/* Iceberg metadata tree + zero copy vs copy, step by step */
function icebergDiagram() {
  const STEPS = [
    ['Catalog', 'The catalog (here the REST catalog) stores one pointer per table: where the current metadata.json is.', 'cat'],
    ['metadata.json', 'Schema, partition spec, properties and the list of snapshots. Every commit writes a new one.', 'meta'],
    ['Snapshot → manifest list', 'A snapshot is the table at one moment. Its manifest list says which manifests belong to it, with partition ranges.', 'snap'],
    ['Manifests', 'Each manifest lists data files with min/max, null counts and partition values per column. Engines skip files here.', 'man'],
    ['Data files', 'Plain Parquet files. Iceberg never edits them; new writes add files and a new snapshot.', 'data'],
    ['Zero copy: add_files', 'The Parquet files already in s3://landing are listed in a new manifest. Only metadata is written. Bytes copied: 0.', 'zero'],
    ['Copy: CTAS / INSERT', 'Rows are read and rewritten as new files in s3://warehouse. Needed for JSON/CSV or a new layout. Costs time and storage.', 'copy']];
  let i = 0, playing = true;
  const host = el('div', { class: 'stack', style: { gap: '8px' } });
  const ctr = el('span', { class: 'lbl', style: { minWidth: '48px', textAlign: 'center' } });
  const play = el('button', { class: 'btn sm', onclick: () => { playing = !playing; play.textContent = playing ? 'Pause' : 'Play'; } }, 'Pause');
  const go = d => { playing = false; play.textContent = 'Play'; i = (i + d + STEPS.length) % STEPS.length; draw(); };
  const box = (t, on, c) => el('div', { style: { padding: '8px 10px', borderRadius: '10px', fontWeight: 700, fontSize: '14px', textAlign: 'center', background: on ? c[0] : '#fff', color: on ? '#fff' : c[1], border: '2px solid ' + c[0], transition: 'all .3s' } }, t);
  function draw() {
    const k = STEPS[i][2]; ctr.textContent = (i + 1) + ' / ' + STEPS.length; host.textContent = '';
    const on = n => k === n || (k === 'zero' && (n === 'man' || n === 'land')) || (k === 'copy' && (n === 'data' || n === 'man'));
    host.append(
      el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: '8px', alignItems: 'center' } }, [
        box('Catalog\npointer', on('cat'), ['#7A3E9D', '#5A2A75']), box('metadata.json', on('meta'), ['#2B59C3', '#1E3F8F']), box('snapshot → manifest list', on('snap'), ['#2B59C3', '#1E3F8F']), box('manifests (min/max)', on('man'), ['#B45F06', '#7A3E05']), box('data files (Parquet)', on('data'), ['#0B7A67', '#0B3D33'])]),
      el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '8px' } }, [
        el('div', { style: { borderRadius: '10px', padding: '8px 10px', border: '2px ' + (k === 'zero' ? 'solid #0B7A67' : 'dashed #C9CFC4'), background: k === 'zero' ? '#F3FAF7' : '#fff' } }, [el('b', { text: 's3://landing/trips/' }), el('div', { class: 'mono', style: { fontSize: '12.5px' }, text: 'dt=…/part-0000.parquet × 7' }), el('div', { style: { fontSize: '13px' }, text: k === 'zero' ? '← the table now points here. Nothing moved.' : 'raw files from upstream' })]),
        el('div', { style: { borderRadius: '10px', padding: '8px 10px', border: '2px ' + (k === 'copy' ? 'solid #B4432A' : 'dashed #C9CFC4'), background: k === 'copy' ? '#FDF0EC' : '#fff' } }, [el('b', { text: 's3://warehouse/…/data/' }), el('div', { class: 'mono', style: { fontSize: '12.5px' }, text: k === 'copy' ? 'new files written (full copy)' : 'Silver and Gold files' }), el('div', { style: { fontSize: '13px' }, text: k === 'copy' ? 'every row read and rewritten' : 'tables the platform owns' })])]),
      el('p', { style: { margin: 0, fontWeight: 600, background: '#FFF7EA', borderRadius: '10px', padding: '8px 12px' } }, [el('b', { text: STEPS[i][0] + ': ' }), STEPS[i][1]]),
      el('p', { style: { margin: 0, fontSize: '14px' }, html: '<b>Watch out:</b> after add_files the table treats those files as its own. A Trino DROP TABLE deleted them in testing, so Bronze here is read-only for engines and has <code>gc.enabled=false</code>.' }));
  }
  const t = setInterval(() => { if (playing && document.body.contains(host)) { i = (i + 1) % STEPS.length; draw(); } }, 2600); cleanup.push(() => clearInterval(t));
  draw();
  return el('section', { class: 'fig' }, [el('div', { class: 'row wrap' }, [el('b', { text: 'Animated lesson · how an Iceberg table works, and zero copy vs copy' }), el('div', { class: 'row', style: { gap: '6px', marginLeft: 'auto' } }, [el('button', { class: 'btn icon sm', 'aria-label': 'Previous step', onclick: () => go(-1) }, svg(I.back, 18)), ctr, el('button', { class: 'btn icon sm', 'aria-label': 'Next step', onclick: () => go(1) }, svg(I.fwd, 18)), play])]), host]);
}

/* ---------------- Practice list ---------------- */
async function vPractice(f) {
  const nDue = revDue().length;
  const tabs = [['all', 'All'], ['review', 'Review' + (nDue ? ' (' + nDue + ' due)' : '')], ['py', 'Python'], ['model', 'Module exercises'], ['dsa', 'DSA'], ['sql', 'SQL'], ['spark', 'PySpark'], ['opt', 'Optimize only'], ['tests', 'Coding tests']];
  const tb = el('div', { class: 'tabs', role: 'tablist' }, tabs.map(([k, n]) => el('button', { role: 'tab', 'aria-selected': String(k === f), onclick: () => { location.hash = '#/practice/' + k; }, text: n })));
  const body = el('div', { class: 'stack' });
  shell('Coding practice', 'Python · DSA · SQL · PySpark · coding tests · separate from the daily hour', [tb, body]);
  const item = (k, x, sub) => el('a', { class: 'item', href: '#/' + k + '/' + x.id + (sub === 'review' ? '/review' : '') }, [chip(k), el('span', { class: 'grow' }, [el('span', { class: 't', text: x.t }), el('br'), el('span', { class: 's', text: sub && sub !== 'review' ? sub : (x.k ? (x.k === 'O' ? 'Optimize · ' : 'Write · ') : '') + x.lv + (sub === 'review' ? ' · ' + revText(S.rev[x.id]) : '') })]), S.solved[x.id] && sub !== 'review' ? el('span', { class: 'ok', text: '✓' }) : sub === 'review' ? el('span', { class: 's', text: 'Review ›' }) : null]);
  if (f === 'review') {
    const all = Object.keys(S.rev || {}).filter(id => findQ(id)), due = revDue(), t = iso(new Date());
    const later = all.filter(id => S.rev[id].due && S.rev[id].due > t).sort((a, b) => S.rev[a].due < S.rev[b].due ? -1 : 1), learned = all.filter(id => !S.rev[id].due);
    body.appendChild(el('section', { class: 'card pad stack' }, [el('h3', { text: 'How review works' }), el('p', { style: { margin: 0 }, text: 'A problem joins this queue when you open its solution, need two or more hints, or need three or more runs to solve it. You can also add any problem from its Coach panel. It comes back after 3 days, then 7, then 21. Each review starts from a blank editor. Pass without the solution to move it along; open the solution and it starts again at 3 days.' })]));
    body.appendChild(el('section', { class: 'card pad stack' }, [el('div', { class: 'row' }, [el('h3', { class: 'grow', text: 'Due now' }), el('span', { class: 'muted', text: String(due.length) })]), due.length ? el('div', { class: 'list' }, due.map(x => item(kindOf(x.id), x, 'review'))) : el('p', { class: 'muted', style: { margin: 0 }, text: all.length ? 'Nothing due today.' : 'Nothing here yet. Problems you struggle with will appear here.' })]));
    if (later.length) body.appendChild(el('section', { class: 'card pad stack' }, [el('div', { class: 'row' }, [el('h3', { class: 'grow', text: 'Coming up' }), el('span', { class: 'muted', text: String(later.length) })]), el('div', { class: 'list' }, later.map(id => item(kindOf(id), findQ(id), revText(S.rev[id]))))]));
    if (learned.length) body.appendChild(el('section', { class: 'card pad stack' }, [el('div', { class: 'row' }, [el('h3', { class: 'grow', text: 'Learned' }), el('span', { class: 'muted', text: String(learned.length) })]), el('div', { class: 'list' }, learned.map(id => item(kindOf(id), findQ(id), 'passed all three reviews')))]));
    return;
  }
  if (f === 'py' || f === 'model') {
    body.appendChild(el('p', { class: 'muted', style: { margin: 0 }, text: f === 'py' ? 'Exercises for the Python track. They are part of each Python module\'s daily plan, and you can redo any of them here.' : 'Exercises for the data modelling, platform and leadership modules: SCDs, as-of joins, cumulative tables, fact types, reading Scala, distributed systems mechanisms, migration reconciliation and cost attribution. They run on the sample tables in your browser.' }));
    (f === 'py' ? ['s00'] : []).concat(MODS.filter(m => f === 'py' ? m[0] === 'p' : 'mjrd'.includes(m[0]))).forEach(m => {
      const k = f === 'py' ? 'py' : ['sql', 'spark', 'py'].find(b => DATA[b].some(x => x.m === m)) || 'sql';
      const xs = DATA[k].filter(x => x.m === m); if (!xs.length) return;
      body.appendChild(el('section', { class: 'card pad stack' }, [el('div', { class: 'row' }, [el('h3', { class: 'grow', text: (m === 's00' ? 'Python level check' : modLabel(m) + ' · ' + modTitle(m)) }), el('span', { class: 'muted', text: xs.filter(x => S.solved[x.id]).length + ' / ' + xs.length })]), el('div', { class: 'list' }, xs.map(x => item(k, x)))]));
    });
    return;
  }
  if (f === 'tests') {
    body.appendChild(el('p', { class: 'muted', style: { margin: 0 }, text: 'Timed coding tests from the course, with hidden tests that run in your browser.' }));
    for (const w of MODS) {
      const s = DATA.sprints[w]; if (!s || !s.coding.length) continue;
      body.appendChild(el('section', { class: 'card pad stack' }, [el('h3', { text: 'Module ' + modLabel(w) + ' · ' + modTitle(w) }), el('div', { class: 'list' }, s.coding.map((c, i) => el('a', { class: 'item', href: '#/test/' + w + '/' + i }, [chip(c.KIND === 'sql' ? 'sql' : c.KIND === 'pyspark' ? 'spark' : 'dsa'), el('span', { class: 'grow' }, [el('span', { class: 't', text: c.TITLE }), el('br'), el('span', { class: 's', text: (c.MIN || '?') + ' min' + (c.SRC ? ' · ' + c.SRC : '') })]), S.solved['t' + qk(w) + '_' + i] ? el('span', { class: 'ok', text: '✓' }) : null])))]));
    }
    return;
  }
  for (let w = 1; w <= 12; w++) {
    let items = [];
    if (f === 'all' || f === 'dsa') items = items.concat(byWeek(DATA.dsa, w).map(x => ['dsa', x]));
    if (f === 'all' || f === 'sql' || f === 'opt') items = items.concat(byWeek(DATA.sql, w).filter(x => f !== 'opt' || x.k === 'O').map(x => ['sql', x]));
    if (f === 'all' || f === 'spark' || f === 'opt') items = items.concat(byWeek(DATA.spark, w).filter(x => f !== 'opt' || x.k === 'O').map(x => ['spark', x]));
    const solved = items.filter(([, x]) => S.solved[x.id]).length;
    body.appendChild(el('section', { class: 'card pad stack' }, [el('div', { class: 'row' }, [el('h3', { class: 'grow', text: 'Set ' + w + ' · ' + WEEKS[w - 1][4] }), el('span', { class: 'muted', text: solved + ' / ' + items.length })]),
      el('div', { class: 'list' }, items.map(([k, x]) => el('a', { class: 'item', href: '#/' + k + '/' + x.id }, [chip(k), el('span', { class: 'grow' }, [el('span', { class: 't', text: x.t }), el('br'), el('span', { class: 's', text: (x.k ? (x.k === 'O' ? 'Optimize · ' : 'Write · ') : '') + x.lv })]), S.solved[x.id] ? el('span', { class: 'ok', text: '✓' }) : null])))]));
  }
}

/* ---------------- Design studio ---------------- */
function vDesign(m) {
  const sc = schedule();
  const withD = MODS.filter(x => DATA.design[x]);
  m = DATA.design[midOf(m)] ? midOf(m) : (DATA.design[sc.cur] ? sc.cur : withD[0]);
  const D = DATA.design[m], du = sc.units.find(u => u.uid === m + ':design');
  const STEPS = [['Requirements', 'Ask before you draw. Who reads the data, how fresh, how much, what breaks if it is wrong?', 'System Design Interview ch. 3 · Fundamentals of DE ch. 3'], ['Estimate', 'Events per second, storage per year, peak vs average. Use the calculator.', 'System Design Interview ch. 2'], ['High-level design', 'Five to seven boxes: source, ingest, store, process, serve, orchestrate, observe.', 'DDIA ch. 1 · Fundamentals of DE ch. 2'], ['Deep dive', 'Pick the riskiest box. Partitioning, ordering, exactly-once, schema evolution.', 'DDIA ch. 6 and 11'], ['Trade-offs', 'For each box, say what you chose, what you rejected, and the cost.', 'DDIA ch. 12'], ['Wrap up', 'Failure modes, monitoring, cost, and what you would build next.', 'System Design Interview ch. 1']];
  let step = +(S.layout.dstep || 0);
  const v = Object.assign({ trips: 2000000, events: 6, bytes: 800, peak: 3, years: 1, repl: 3 }, S.layout.calc || {});
  const out = el('div', { class: 'stack', style: { gap: '6px' } });
  const calc = () => {
    const perDay = v.trips * v.events, avg = perDay / 86400, peak = avg * v.peak, perYear = perDay * v.bytes * 365 * v.years * v.repl;
    const f = n => n >= 1e12 ? (n / 1e12).toFixed(1) + ' TB' : n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : (n / 1e6).toFixed(1) + ' MB';
    out.textContent = '';
    [['Requests or events per day', Math.round(perDay).toLocaleString()], ['Average per second', Math.round(avg).toLocaleString()], ['Peak per second', Math.round(peak).toLocaleString()], ['Storage (raw, replicated)', f(perYear)], ['Partitions (5k/s per consumer)', String(Math.max(1, Math.ceil(peak / 5000)))]].forEach(([k, x]) => out.appendChild(el('div', { class: 'row' }, [el('span', { class: 'grow', text: k }), el('b', { class: 'mono', text: x })])));
    S.layout.calc = v; save(false);
  };
  const inp = (k, label) => { const i = el('input', { type: 'number', inputmode: 'decimal', value: v[k], min: '0', id: 'c_' + k }); i.addEventListener('input', () => { v[k] = +i.value || 0; calc(); }); return el('div', { class: 'field' }, [el('label', { for: 'c_' + k, class: 'lbl', text: label }), i]); };
  const stepBox = el('div', { class: 'stack' });
  const tabs = el('div', { class: 'tabs', role: 'tablist' });
  const paint = () => {
    tabs.textContent = ''; STEPS.forEach((s, i) => tabs.appendChild(el('button', { role: 'tab', 'aria-selected': String(i === step), onclick: () => { step = i; S.layout.dstep = i; save(false); paint(); }, text: (i + 1) + ' · ' + s[0] })));
    stepBox.textContent = '';
    stepBox.append(el('h2', { text: 'Step ' + (step + 1) + ' · ' + STEPS[step][0] }), el('p', { style: { margin: 0 }, text: STEPS[step][1] }), el('span', { class: 'muted', text: 'Read: ' + STEPS[step][2] }));
    const notesKey = 'design_' + m + '_' + step;
    const ta = el('textarea', { class: 'code', style: { minHeight: '160px', border: '1px solid var(--line2)', borderRadius: '10px' }, 'aria-label': 'Your answer for this step', placeholder: 'Your answer for "' + D.title + '", step ' + (step + 1) + '. Saved and synced.' });
    ta.value = S.code[notesKey] || ''; ta.addEventListener('input', () => { S.code[notesKey] = ta.value; save(); });
    stepBox.append(ta);
  };
  paint(); calc();
  let secs = 0, run = false; const clock = el('b', { class: 'mono', style: { fontSize: '22px' }, text: '40:00' });
  const t = setInterval(() => { if (run) { secs++; const r = Math.max(0, 2400 - secs); clock.textContent = Math.floor(r / 60) + ':' + String(r % 60).padStart(2, '0'); } }, 1000); cleanup.push(() => clearInterval(t));
  const tb = el('button', { class: 'btn', onclick: () => { run = !run; tb.textContent = run ? 'Pause' : 'Start the 40-minute round'; } }, 'Start the 40-minute round');
  const sel = el('select', { class: 'btn sm', 'aria-label': 'Design problem', onchange: e => { location.hash = '#/design/' + e.target.value; } }, withD.map(x => el('option', { value: x, selected: x === m ? 'selected' : null, text: modLabel(x) + ' · ' + DATA.design[x].title })));
  const when = du ? (du.isDone ? 'Done' : du.day === sc.today ? 'Planned for today' : 'Planned for ' + dayName(du.day) + ' ' + shortDate(du.day).slice(4) + ' (week ' + weekOf(du.day) + ')') : '';
  const problem = el('section', { class: 'card pad stack', style: { borderColor: '#D9C6E6' } }, [
    el('div', { class: 'row wrap', style: { gap: '8px' } }, [el('span', { class: 'chip c-arch', text: 'Module ' + modLabel(m) }), el('span', { class: 'chip c-test', text: when + ' · 40 min' }), el('span', { class: 'grow' }), sel]),
    el('h1', { style: { fontSize: '26px' }, text: D.title }),
    el('div', { class: 'stack', style: { gap: '4px' } }, [el('span', { class: 'lbl', text: 'Problem statement' }), el('p', { style: { margin: 0, fontSize: '16.5px' }, text: D.prompt })]),
    el('div', { class: 'stack', style: { gap: '4px' } }, [el('span', { class: 'lbl', text: 'What you hand in' }), el('p', { style: { margin: 0 }, text: D.deliverable })]),
    el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'Work through the six steps below in one sitting, writing your answer in each box. Then ask the coach (bottom right) to review it like an interviewer.' }),
    du ? el('button', { class: 'btn', style: { alignSelf: 'flex-start' }, onclick: () => toggleUnit(du), text: du.isDone ? 'Mark not done' : 'Mark this design done' }) : null]);
  shell('System design studio', 'Design problem · module ' + modLabel(m), [problem, tabs,
    el('div', { class: 'grid2' }, [el('section', { class: 'card pad stack' }, [stepBox]),
      el('div', { class: 'stack', style: { gap: '18px' } }, [
        el('section', { class: 'card pad stack' }, [el('h3', { text: 'Back-of-envelope calculator' }), el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '10px' } }, [inp('trips', 'Users or trips per day'), inp('events', 'Events per user'), inp('bytes', 'Bytes per event'), inp('peak', 'Peak ÷ average'), inp('years', 'Years kept'), inp('repl', 'Replication factor')]), out]),
        el('section', { class: 'card pad row wrap' }, [el('div', { class: 'grow stack', style: { gap: '2px' } }, [el('span', { class: 'lbl', text: 'Round timer' }), clock]), tb, el('button', { class: 'btn', onclick: () => { secs = 0; clock.textContent = '40:00'; }, text: 'Reset' })])])])]);
}

/* ---------------- Quiz ---------------- */
async function vQuiz(m) {
  m = MOD[midOf(m)] ? midOf(m) : curMid(); const w = qk(m);
  shell('Module quiz', 'Module ' + modLabel(m) + ' · ' + modTitle(m), [el('p', { class: 'muted', text: 'Loading…' })], { back: '#/today' });
  let s; try { s = await sprint(m); } catch (e) { $('#page').textContent = 'Could not load this quiz.'; return; }
  const qs = s.quiz; const st = S.quiz[w] = S.quiz[w] || { a: {}, sub: false, i: 0 };
  const page = $('#page'); let i = Math.min(st.i || 0, qs.length - 1);
  const weekSel = el('select', { class: 'btn sm', 'aria-label': 'Module', onchange: e => { location.hash = '#/quiz/' + e.target.value; } }, MODS.map(x => el('option', { value: x, selected: x === m ? 'selected' : null, text: modLabel(x) + ' · ' + modTitle(x) })));
  const grade = (q, a) => { if (a == null || a === '') return 0; if (q.TYPE === 'mcq') return a === q.ANS ? 1 : 0; if (q.TYPE === 'fill') { const nz = x => String(x).toLowerCase().replace(/^\s*(the|a|an)\s+/, '').replace(/[^a-z0-9]/g, '').replace(/s$/, ''); const ok = q.ANS.split('|').map(nz); return ok.includes(nz(a)) ? 1 : 0; } return a.self || 0; };
  function draw() {
    page.textContent = '';
    st.i = i; save(false);
    const answered = qs.filter((q, k) => st.a[k] !== undefined && st.a[k] !== '').length;
    page.appendChild(el('div', { class: 'row wrap' }, [weekSel, el('span', { class: 'muted grow', text: answered + ' of ' + qs.length + ' answered' }),
      el('button', { class: 'btn sm', onclick: async () => { const v = await confirmBox('Reset this quiz?', 'All answers for module ' + modLabel(m) + ' are cleared. Undo is available for 10 seconds.', [{ t: 'Reset and exit', cls: 'warn', v: 1 }, { t: 'Cancel', v: null }]); if (v) { const snap = JSON.stringify(st); S.quiz[w] = { a: {}, sub: false, i: 0 }; save(); location.hash = '#/today'; setTimeout(() => toast('Quiz reset', () => { S.quiz[w] = JSON.parse(snap); save(); }), 50); } }, text: 'Reset and exit' }),
      el('button', { class: 'btn sm', onclick: async () => { const v = await confirmBox('Leave the quiz?', 'Your answers are kept. You can come back and finish later.', [{ t: 'Leave, keep answers', cls: 'pri', v: 1 }, { t: 'Stay', v: null }]); if (v) location.hash = '#/today'; }, text: 'Leave' })]));
    if (st.sub) {
      const score = qs.reduce((a, q, k) => a + grade(q, st.a[k]), 0), pct = Math.round(100 * score / qs.length);
      if (!st.best || pct > st.best) { st.best = pct; save(); }
      const toMark = qs.filter((q, k) => q.TYPE === 'short' && st.a[k] && st.a[k].t && st.a[k].self === undefined).length;
      page.appendChild(el('section', { class: 'card pad stack' }, [el('h2', { text: 'Score: ' + score + ' of ' + qs.length + ' (' + pct + '%)' }), el('span', { class: 'muted', text: (st.best ? 'Best: ' + st.best + '% · ' : '') + (pct >= 80 ? 'Pass mark reached (80%).' : 'The pass mark is 80%. Review the ones marked Review, then retake.') + (toMark ? ' ' + toMark + ' short answer' + (toMark > 1 ? 's' : '') + ' still to mark yourself below.' : '') }), el('div', { class: 'row wrap' }, [el('button', { class: 'btn pri', onclick: () => { S.quiz[w] = { a: {}, sub: false, i: 0, best: st.best }; save(); vQuiz(m); }, text: 'Retake' }), el('a', { class: 'btn', href: '#/today', text: 'Back to Today' })])]));
      const yours = (q, a) => a == null || a === '' ? 'no answer' : q.TYPE === 'mcq' ? a + ') ' + ((q.opts || []).find(o => o[0] === a) || ['', ''])[1] : q.TYPE === 'fill' ? String(a) : (a.t || 'no answer');
      qs.forEach((q, k) => {
        const g = grade(q, st.a[k]), sh = q.TYPE === 'short' && st.a[k] && st.a[k].t;
        page.appendChild(el('section', { class: 'card pad stack' }, [el('div', { class: 'row' }, [el('span', { class: 'lbl grow', text: 'Q' + (k + 1) }), el('span', { class: 'badge ' + (g ? 'b-ok' : sh && st.a[k].self === undefined ? 'b-warn' : 'b-bad'), text: g ? 'Right' : sh && st.a[k].self === undefined ? 'Mark yourself' : 'Review' })]), el('div', { html: mdi(q.Q) }),
          el('div', { style: { fontSize: '14.5px' } }, [el('b', { text: 'Your answer: ' }), el('span', { html: mdi(yours(q, st.a[k])) })]),
          el('div', { class: 'muted', html: '<b>' + (q.TYPE === 'short' ? 'Model answer' : 'Answer') + ':</b> ' + mdi(q.TYPE === 'mcq' ? q.ANS + ') ' + ((q.opts || []).find(o => o[0] === q.ANS) || ['', ''])[1] : q.TYPE === 'fill' ? q.ANS.split('|')[0] : (q.MODEL || q.ANS || '')) }), q.WHY ? el('div', { class: 'why', html: mdi(q.WHY) }) : null,
          sh ? el('div', { class: 'row wrap' }, [el('span', { class: 'muted', text: 'Compare with the model answer:' }), el('button', { class: 'btn sm', 'aria-pressed': String(st.a[k].self === 1), onclick: () => { st.a[k].self = 1; save(); draw(); }, text: 'I got it' }), el('button', { class: 'btn sm', 'aria-pressed': String(st.a[k].self === 0), onclick: () => { st.a[k].self = 0; save(); draw(); }, text: 'Not yet' })]) : null]));
      });
      return;
    }
    const q = qs[i];
    const pal = el('div', { class: 'pal', 'aria-label': 'Jump to a question' }, qs.map((_, k) => el('button', { class: (st.a[k] !== undefined && st.a[k] !== '' ? 'ans ' : '') + (k === i ? 'cur' : ''), 'aria-label': 'Question ' + (k + 1), onclick: () => { i = k; draw(); }, text: String(k + 1) })));
    const card = el('section', { class: 'card pad stack' }, [el('div', { class: 'row' }, [el('span', { class: 'lbl grow', text: 'Question ' + (i + 1) + ' of ' + qs.length + ' · ' + (q.TYPE === 'mcq' ? 'multiple choice' : q.TYPE === 'fill' ? 'fill in the blank' : 'short answer') })]), el('div', { style: { fontSize: '17px' }, html: mdi(q.Q) })]);
    if (q.TYPE === 'mcq') (q.opts || []).forEach(([k, t]) => card.appendChild(el('button', { class: 'opt', 'aria-pressed': String(st.a[i] === k), onclick: () => { st.a[i] = k; save(); draw(); } }, [el('b', { text: k }), el('span', { html: mdi(t) })])));
    else if (q.TYPE === 'fill') { const inp = el('input', { type: 'text', value: st.a[i] || '', 'aria-label': 'Your answer', style: { minHeight: '46px', border: '1px solid var(--line2)', borderRadius: '10px', padding: '0 12px' } }); inp.addEventListener('input', () => { st.a[i] = inp.value; save(); }); card.appendChild(inp); }
    else { const ta = el('textarea', { class: 'code', style: { minHeight: '140px', border: '1px solid var(--line2)', borderRadius: '10px', fontFamily: 'var(--body)', fontSize: '16px' }, 'aria-label': 'Your answer' }); ta.value = (st.a[i] && st.a[i].t) || ''; ta.addEventListener('input', () => { st.a[i] = Object.assign({}, st.a[i] || {}, { t: ta.value }); save(); }); card.appendChild(ta);
      card.appendChild(el('div', { class: 'row wrap' }, [el('span', { class: 'muted', text: 'After submitting you compare with the model answer and mark yourself.' })])); }
    page.append(card, el('div', { class: 'row wrap' }, [el('button', { class: 'btn', disabled: i === 0 ? true : null, onclick: () => { i--; draw(); }, text: 'Previous' }), el('span', { class: 'grow' }), i < qs.length - 1 ? el('button', { class: 'btn pri', onclick: () => { i++; draw(); }, text: 'Save and next' }) : null,
      el('button', { class: 'btn dark', onclick: async () => { const left = qs.length - answered; const v = await confirmBox('Submit the quiz?', left ? left + ' question' + (left > 1 ? 's are' : ' is') + ' unanswered. They count as wrong.' : 'All questions answered.', [{ t: 'Submit', cls: 'pri', v: 1 }, { t: 'Keep answering', v: null }]); if (v) { st.sub = true; const qu = modUnits(m).find(u => u.kind === 'quiz'); if (qu && !S.done[qu.uid]) { S.done[qu.uid] = iso(new Date()); S.doneAt = S.doneAt || {}; S.doneAt[qu.uid] = Date.now(); } save(); draw(); window.scrollTo(0, 0); } }, text: 'Submit' })]), el('section', { class: 'card pad stack' }, [el('span', { class: 'lbl', text: 'Questions' }), pal]));
  }
  draw();
}

/* ---------------- Interview ---------------- */
async function vInterview(m, focus) {
  m = MOD[midOf(m)] ? midOf(m) : curMid(); const w = qk(m);
  shell('Interview set', 'Module ' + modLabel(m) + ' · past questions with model answers', [el('p', { class: 'muted', text: 'Loading…' })], { back: '#/today' });
  let s; try { s = await sprint(m); } catch (e) { return; }
  const page = $('#page'); page.textContent = '';
  const st = S.iv[w] = S.iv[w] || {};
  const ivCount = el('span', { class: 'muted', 'aria-live': 'polite' }); const paintCount = () => { ivCount.textContent = Object.values(st).filter(Boolean).length + ' of ' + s.interview.length + ' ticked · tick a question when you can answer it out loud'; };
  page.appendChild(el('div', { class: 'row wrap' }, [el('select', { class: 'btn sm', 'aria-label': 'Module', onchange: e => { location.hash = '#/interview/' + e.target.value; } }, MODS.map(x => el('option', { value: x, selected: x === m ? 'selected' : null, text: modLabel(x) + ' · ' + modTitle(x) }))), ivCount])); paintCount();
  s.interview.forEach((q, k) => {
    const ans = mdEl(q.A || ''); ans.style.display = 'none';
    const tick = el('button', { class: 'check', 'aria-pressed': String(!!st[k]), 'aria-label': 'I can answer this', style: st[k] ? { background: 'var(--teal)', borderColor: 'var(--teal)' } : {}, onclick: () => { st[k] = !st[k]; save(); tick.setAttribute('aria-pressed', String(!!st[k])); tick.style.background = st[k] ? 'var(--teal)' : ''; tick.style.borderColor = st[k] ? 'var(--teal)' : ''; tick.textContent = ''; if (st[k]) tick.appendChild(svg(I.check, 16)); paintCount(); } }, st[k] ? svg(I.check, 16) : null);
    const show = el('button', { class: 'btn sm', 'aria-expanded': 'false', onclick: () => { const o = ans.style.display === 'none'; ans.style.display = o ? 'block' : 'none'; show.textContent = o ? 'Hide model answer' : 'Show model answer'; show.setAttribute('aria-expanded', String(o)); } }, 'Show model answer');
    page.appendChild(el('section', { class: 'card pad stack' }, [el('div', { class: 'row', style: { alignItems: 'flex-start' } }, [tick, el('div', { class: 'grow stack', style: { gap: '4px' } }, [el('b', { style: { fontSize: '16.5px' }, html: mdi(q.Q) }), el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: [q.TAG ? chipFor(q.TAG)[0] : '', q.SRC].filter(Boolean).join(' · ') })])]), show, ans]));
  });
  if (!s.interview.length) page.appendChild(el('section', { class: 'card pad' }, [el('p', { style: { margin: 0 }, text: 'This module has no interview set. ' }), el('a', { href: '#/path/' + m, text: 'Back to the module' })]));
  if (s.raw.mock) { const mk = el('section', { class: 'card pad', id: 'mock' }, [el('h2', { text: 'Mock interview' }), mdEl(s.raw.mock)]); page.appendChild(mk); if (focus === 'mock') setTimeout(() => mk.scrollIntoView({ block: 'start' }), 50); }
}

/* ---------------- Progress ---------------- */
function vProgress() {
  const pct = arr => arr.length ? Math.round(100 * arr.filter(x => S.solved[x.id]).length / arr.length) : 0;
  const sqlW = DATA.sql.filter(x => x.k === 'W' && !x.m), sqlO = DATA.sql.filter(x => x.k === 'O'), spW = DATA.spark.filter(x => x.k === 'W'), spO = DATA.spark.filter(x => x.k === 'O');
  const quizP = (() => { let got = 0, n = 0; for (const w in S.quiz) if (S.quiz[w].sub) { n++; } return Math.round(100 * n / MODS.length); })();
  const ivP = (() => { let t = 0; for (const w in S.iv) t += Object.values(S.iv[w]).filter(Boolean).length; return Math.min(100, Math.round(t / 2)); })();
  const rows = [['Python', pct(DATA.py.filter(x => x.m !== 's00')), '#5B7A1E'], ['Data modelling', pct(DATA.sql.filter(x => x.m)), 'var(--plum)'], ['DSA', pct(DATA.dsa), 'var(--teal)'], ['SQL write', pct(sqlW), '#164C7E'], ['SQL optimize', pct(sqlO), '#164C7E'], ['PySpark write', pct(spW), '#8A3A0C'], ['PySpark optimize', pct(spO), '#8A3A0C'], ['Module quizzes', quizP, 'var(--blue)'], ['Interview sets', ivP, 'var(--plum)']];
  const grid = el('div', { class: 'dsa-grid', 'aria-label': '84 daily DSA problems' }, DATA.dsa.map((x, i) => el('a', { href: '#/dsa/' + x.id, title: (i + 1) + '. ' + x.t, class: S.solved[x.id] ? 'done' : i === dayIndex() % 84 ? 'today' : '' })));
  shell('Progress', 'Program, readiness and sync', [programCard(),
    el('div', { class: 'grid2' }, [
      el('section', { class: 'card pad stack' }, [el('span', { class: 'lbl', text: 'Readiness by interview round' })].concat(rows.map(([n, p, c]) => el('div', { style: { display: 'grid', gridTemplateColumns: '140px minmax(0,1fr) 44px', gap: '10px', alignItems: 'center' } }, [el('span', { style: { fontWeight: 600 }, text: n }), el('div', { class: 'bar' }, el('i', { style: { width: p + '%', background: c } })), el('b', { style: { textAlign: 'right' }, text: p + '%' })])))),
      el('section', { class: 'card pad stack' }, [el('div', { class: 'row' }, [el('span', { class: 'lbl grow', text: 'DSA ladder · 84 days' }), el('b', { text: DATA.dsa.filter(x => S.solved[x.id]).length + ' solved' })]), grid, el('span', { class: 'muted', style: { fontSize: '13px' }, text: 'Each row is two weeks. Tap a square to open that problem.' })])]),
    el('section', { class: 'card pad stack' }, [el('h3', { text: 'Sync across MacBook, iPad and iPhone' }), el('p', { style: { margin: 0 }, text: S.settings.syncUrl ? 'Sync is set up. Tap Sync progress at the top on each device.' : 'Sync is not set up yet. Open Settings (gear icon) and paste your Google Apps Script URL. The repo has the script in sync/Code.gs and the steps in README.md.' }), el('div', { class: 'row wrap' }, [el('button', { class: 'btn', onclick: settings, text: 'Open settings' }), el('button', { class: 'btn', onclick: exportProgress, text: 'Download a backup' }), el('label', { class: 'btn' }, ['Restore a backup', el('input', { type: 'file', accept: 'application/json', style: { display: 'none' }, onchange: importProgress })])]), el('span', { class: 'muted', style: { fontSize: '13px' }, text: 'Last change: ' + (S.updated ? new Date(S.updated).toLocaleString() : 'never') + (S.lastSync ? ' · last sync: ' + new Date(S.lastSync).toLocaleString() : '') })])]);
}
function exportProgress() { const b = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }); const a = el('a', { href: URL.createObjectURL(b), download: 'data-architect-progress-' + iso(new Date()) + '.json' }); document.body.appendChild(a); a.click(); a.remove(); }
function importProgress(e) { const f = e.target.files[0]; if (!f) return; f.text().then(t => { const old = JSON.stringify(S); try { S = Object.assign(load(), JSON.parse(t)); save(); toast('Backup restored', () => { S = JSON.parse(old); save(); route(); }); route(); } catch (x) { toast('That file is not a Data Architect backup.'); } }); }

/* ---------------- Settings, sync, update ---------------- */
function syncLabel() { return S.syncing ? 'Syncing…' : S.lastSync && Date.now() - S.lastSync < 60000 ? 'Synced' : 'Sync progress'; }
function settings() {
  const f = (id, label, val, type, ph) => el('div', { class: 'field' }, [el('label', { for: id, class: 'lbl', text: label }), el('input', { id, type: type || 'text', value: val || '', placeholder: ph || '', autocomplete: 'off' })]);
  const body = el('div', { class: 'stack' }, [
    f('st_start', 'Week 1 starts (pick any day in that week)', S.start, 'date'),
    el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '10px' } }, [f('st_wd', 'Weekday minutes', S.settings.capWd || 60, 'number'), f('st_we', 'Weekend minutes', S.settings.capWe || 120, 'number'), f('st_time', 'Study time', S.settings.studyTime || '07:00', 'time')]),
    el('div', { class: 'field' }, [el('label', { for: 'st_theme', class: 'lbl', text: 'Theme' }), el('select', { id: 'st_theme', class: 'btn' }, [['auto', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']].map(([v, t]) => el('option', { value: v, selected: (S.settings.theme || 'auto') === v ? 'selected' : null, text: t })))]),
    f('st_sync', 'Sync URL (Google Apps Script web app)', S.settings.syncUrl, 'url', 'https://script.google.com/macros/s/…/exec'),
    f('st_key', 'Coach AI key (optional, Anthropic API key, kept only on this device)', S.settings.aiKey, 'password', 'sk-ant-…'),
    f('st_model', 'Coach model', S.settings.aiModel || 'claude-haiku-5-5', 'text'),
    el('span', { class: 'muted', style: { fontSize: '13px' }, text: 'The key never leaves this device except to call the AI provider. Without a key the coach still gives the step-by-step hints.' })]);
  confirmBox('Settings', body, [{ t: 'Save', cls: 'pri', v: 1 }, { t: 'Cancel', v: null }]).then(v => {
    if (!v) return;
    const g = id => body.querySelector('#' + id).value.trim();
    const st0 = g('st_start'); if (/^\d{4}-\d\d-\d\d$/.test(st0)) { const d = new Date(st0 + 'T00:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); S.start = iso(d); } S.settings.syncUrl = g('st_sync'); S.settings.aiKey = g('st_key'); S.settings.aiModel = g('st_model') || 'claude-haiku-5-5';
    const wd = Math.round(+g('st_wd')), we = Math.round(+g('st_we')); S.settings.capWd = wd >= 15 && wd <= 600 ? wd : 60; S.settings.capWe = we >= 15 && we <= 720 ? we : 120; S.settings.studyTime = g('st_time') || '07:00'; S.settings.theme = g('st_theme') || 'auto'; applyTheme();
    S.updated = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Could not save settings in this browser.'); return; }
    toast('Settings saved'); route();
  });
}
async function doSync() {
  const url = S.settings.syncUrl;
  if (!url) { toast('Set up sync first: open Settings (gear icon).'); settings(); return; }
  S.syncing = true; const b = $('#syncBtn'); if (b) b.querySelector('.t').textContent = 'Syncing…';
  try {
    const remote = await fetch(url + (url.includes('?') ? '&' : '?') + 'action=load', { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    const local = JSON.parse(JSON.stringify(S));
    let merged = local;
    if (remote && remote.data) merged = mergeState(remote.data, local);
    const keepSettings = S.settings;
    S = Object.assign(load(), merged, { settings: keepSettings });
    const body = JSON.parse(JSON.stringify(S)); delete body.settings; delete body.syncing;
    await fetch(url, { method: 'POST', body: JSON.stringify({ action: 'save', data: body }), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    S.lastSync = Date.now(); S.syncing = false; save(false); toast('Progress synced'); route();
  } catch (e) { S.syncing = false; toast('Sync failed. Your progress is safe on this device; try again.'); if (b) b.querySelector('.t').textContent = 'Sync progress'; }
}
function mergeState(a, b) {
  const out = Object.assign({}, a, b);
  ['done', 'solved'].forEach(k => { out[k] = Object.assign({}, a[k] || {}, b[k] || {}); });
  ['code', 'runs', 'hints', 'secs', 'quiz', 'iv', 'layout'].forEach(k => { out[k] = (b.updated || 0) >= (a.updated || 0) ? Object.assign({}, a[k] || {}, b[k] || {}) : Object.assign({}, b[k] || {}, a[k] || {}); });
  ['runs', 'hints', 'secs'].forEach(k => { for (const id in (a[k] || {})) out[k][id] = Math.max(a[k][id] || 0, (b[k] || {})[id] || 0); });
  /* un-ticked steps stay un-ticked: a later "undone" on either device beats an older "done" */
  out.doneAt = Object.assign({}, a.doneAt || {}, b.doneAt || {}); out.undone = Object.assign({}, a.undone || {}, b.undone || {});
  for (const id in out.doneAt) out.doneAt[id] = Math.max((a.doneAt || {})[id] || 0, (b.doneAt || {})[id] || 0);
  for (const id in out.undone) { out.undone[id] = Math.max((a.undone || {})[id] || 0, (b.undone || {})[id] || 0); if (out.undone[id] > (out.doneAt[id] || 0)) delete out.done[id]; }
  out.proj = {};
  new Set(Object.keys(a.proj || {}).concat(Object.keys(b.proj || {}))).forEach(id => { const x = (a.proj || {})[id] || { ms: {} }, y = (b.proj || {})[id] || { ms: {} }; out.proj[id] = Object.assign({}, x, y, { ms: {} }); new Set(Object.keys(x.ms || {}).concat(Object.keys(y.ms || {}))).forEach(k => { out.proj[id].ms[k] = !!((x.ms || {})[k] || (y.ms || {})[k]); }); });
  /* review queue: the newer entry per problem wins */
  out.rev = Object.assign({}, a.rev || {}, b.rev || {});
  for (const id in out.rev) { const x = (a.rev || {})[id], y = (b.rev || {})[id]; out.rev[id] = !x ? y : !y ? x : (x.t || 0) >= (y.t || 0) ? x : y; }
  out.updated = Math.max(a.updated || 0, b.updated || 0);
  return out;
}
async function doUpdate() {
  toast('Checking for updates…');
  try {
    const v = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json());
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) { await reg.update(); if (reg.waiting) reg.waiting.postMessage('skip'); }
    if (v.version !== VERSION || (reg && reg.waiting)) { toast('Updating to ' + v.version + '…'); if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } setTimeout(() => location.reload(), 600); }
    else toast('You have the latest version (' + VERSION + ').');
  } catch (e) { toast('Could not check for updates. Are you online?'); }
}

/* ---------------- Coach ---------------- */
let coachOpen = false;
function coachFab() {
  const wrap = el('div');
  const msgs = el('div', { class: 'msgs', 'aria-live': 'polite' });
  const inp = el('input', { type: 'text', class: 'grow', placeholder: 'Ask about this page…', 'aria-label': 'Message the coach', style: { minHeight: '44px', border: '1px solid var(--line2)', borderRadius: '10px', padding: '0 12px' } });
  const send = (t, img) => { if (!t && !img) return; msgs.appendChild(el('div', { class: 'm me', text: t || '(photo)' })); inp.value = ''; askCoach(t, { title: document.title, page: ($('.top .title b') || {}).textContent, img }, msgs); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') send(inp.value); });
  const mic = el('button', { class: 'btn icon', 'aria-label': 'Speak', title: 'Speak', onclick: () => {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { toast('Voice input is not available in this browser.'); return; }
    const r = new R(); r.lang = 'en-IN'; r.interimResults = true; mic.style.background = 'var(--amber-l)';
    r.onresult = e => { inp.value = Array.from(e.results).map(x => x[0].transcript).join(' '); };
    r.onend = () => { mic.style.background = ''; }; r.onerror = () => { mic.style.background = ''; toast('Could not hear you. Check microphone permission.'); };
    r.start();
  } }, svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>', 18));
  const file = el('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' }, onchange: e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => send(inp.value || 'Explain this image', rd.result); rd.readAsDataURL(f); } });
  const cam = el('label', { class: 'btn icon', 'aria-label': 'Photo', title: 'Photo' }, [svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 18), file]);
  const panel = el('div', { class: 'coach', role: 'dialog', 'aria-label': 'Ask the coach', style: { display: coachOpen ? 'flex' : 'none' } }, [el('div', { class: 'row' }, [el('b', { class: 'grow', text: 'Ask the coach' }), el('button', { class: 'btn icon sm', 'aria-label': 'Close', onclick: () => toggle(false) }, '×')]),
    el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: 'It sees this page and gives hints and questions before answers. Type, speak or send a photo.' }), msgs, el('div', { class: 'row' }, [inp, mic, cam, el('button', { class: 'btn pri', onclick: () => send(inp.value), text: 'Send' })])]);
  const fab = el('button', { class: 'fab', 'aria-label': 'Ask the coach', 'aria-expanded': String(coachOpen), onclick: () => toggle(!coachOpen) }, svg(I.spark, 24));
  function toggle(v) { coachOpen = v; panel.style.display = v ? 'flex' : 'none'; fab.setAttribute('aria-expanded', String(v)); if (v) setTimeout(() => inp.focus(), 30); }
  wrap.append(panel, fab);
  return wrap;
}
async function askCoach(q, ctx, box) {
  q = (q || '').trim();
  const reply = el('div', { class: 'm' }, [el('span', { class: 'spin' })]);
  box.appendChild(reply);
  const key = S.settings.aiKey;
  if (!key) {
    const hs = ctx.hints || [];
    reply.textContent = hs.length ? 'Try this question first: ' + (hs[Math.min(hs.length - 1, (S.hints[location.hash.split('/')[2]] || 0))] || hs[0]) + ' (Add an AI key in Settings for free-form answers.)' : 'Break the problem into the smallest step you can test, then run it. Add an AI key in Settings for free-form answers.';
    return;
  }
  try {
    const content = [];
    if (ctx.img) content.push({ type: 'image', source: { type: 'base64', media_type: ctx.img.split(';')[0].slice(5), data: ctx.img.split(',')[1] } });
    content.push({ type: 'text', text: 'Page: ' + (ctx.title || ctx.page || '') + (ctx.problem ? '\nProblem: ' + ctx.problem : '') + (ctx.code ? '\nMy code:\n' + ctx.code.slice(0, 4000) : '') + '\n\nMy question: ' + (q || 'Give me a hint.') });
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: S.settings.aiModel || 'claude-haiku-5-5', max_tokens: 600, system: 'You are a data engineering interview coach for a senior data engineer preparing for tier-1 and architect roles. Give intuition and a guiding question before answers. Never give a full solution unless the user explicitly asks for it. Keep replies under 150 words, plain language.', messages: [{ role: 'user', content }] }) });
    const j = await r.json();
    reply.innerHTML = md((j.content || []).map(c => c.text || '').join('') || (j.error && j.error.message) || 'No answer.');
  } catch (e) { reply.textContent = 'The coach could not reach the AI service. Check the key in Settings and your connection.'; }
}

/* ---------------- boot ---------------- */
function applyTheme() { const t = S.settings.theme; if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
applyTheme();
let navCount = 0;
window.addEventListener('hashchange', () => { navCount++; route(); });
/* a tab left open overnight shows the new day's plan when you come back */
let lastDay = iso(new Date());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && iso(new Date()) !== lastDay) { lastDay = iso(new Date()); if (!/^#\/(dsa|sql|spark|test)\//.test(location.hash)) route(); } });
window.addEventListener('keydown', e => { if (e.key === '`' && (e.ctrlKey || e.metaKey)) { const b = Array.from(document.querySelectorAll('.otab')).find(x => x.textContent === 'Terminal'); if (b) { e.preventDefault(); b.click(); } } });
(async () => {
  try { await loadData(); } catch (e) { $('#root').innerHTML = '<div style="padding:24px">Could not load the question bank. Check your connection and reload.</div>'; return; }
  route();
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller; /* first install: no reload; later updates: reload once */
    navigator.serviceWorker.register('sw.js').catch(() => { });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !window.__reloading) { window.__reloading = true; location.reload(); } });
  }
})();
