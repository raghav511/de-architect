/* Data Architect · daily recall (review 4). Interview Q/As you opened or ticked and quiz items you submitted come back
   on a spaced schedule (1, 3, 7, 21 days) as a short Recall set on Today (#/recall): answer from memory, then the
   model answer shows and you mark it easy, hard or missed. Easy moves it to the next gap, hard repeats the gap, missed
   brings it back tomorrow. An item's id is its module and a hash of its question, so an edited question starts fresh
   and the old entry is kept, never deleted. State S.recall[id] = { box, due, at, n, last }, merged per entry (newer
   at wins). Loaded before app.js. */
'use strict';
const RECALL_GAPS = [1, 3, 7, 21], RECALL_N = 5;
function recallHash(t) { let h = 2166136261; for (const ch of String(t || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function recallId(kind, m, q) { return kind + ':' + m + ':' + recallHash(q.Q); }
function recallDay(off) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + (off || 0)); return iso(d); }
/* seen today: first recall tomorrow; an item already in the queue keeps its place */
function recallEnroll(kind, m, qs) { S.recall = S.recall || {}; let n = 0; (qs || []).forEach(q => { if (!q || !q.Q) return; const id = recallId(kind, m, q); if (!S.recall[id]) { S.recall[id] = { box: 0, due: recallDay(1), at: Date.now(), n: 0 }; n++; } }); return n; }
/* every item that can be recalled: [id, kind, module, question] */
function recallAll() {
  const out = [];
  MODS.forEach(m => { const s = DATA.sprints[m]; if (!s) return; (s.interview || []).forEach(q => q.Q && q.A && out.push([recallId('iv', m, q), 'iv', m, q])); (s.quiz || []).forEach(q => q.Q && recallAnswer('qz', q) && out.push([recallId('qz', m, q), 'qz', m, q])); });
  return out;
}
function recallAnswer(kind, q) {
  if (kind === 'iv') return q.A || '';
  const right = q.TYPE === 'mcq' && q.opts ? (q.opts.find(o => o[0] === q.ANS) || [])[1] : q.TYPE === 'short' ? (q.MODEL || q.ANS) : q.ANS;
  return right ? (q.TYPE === 'mcq' || q.TYPE === 'fill' ? '**' + right + '**' : right) + (q.WHY ? '\n\n' + q.WHY : '') : '';
}
/* items you saw before this queue existed (ticked interview questions, submitted quizzes) count as due today */
function recallSeen(kind, m, q, k) { return kind === 'iv' ? !!((S.iv || {})[qk(m)] || {})[k] : !!((S.quiz || {})[qk(m)] || {}).sub; }
function recallState() {
  const R = S.recall || {}, t = recallDay(0), all = recallAll(), byId = {};
  const idx = {}; all.forEach(x => { const s = DATA.sprints[x[2]], list = x[1] === 'iv' ? s.interview : s.quiz; idx[x[0]] = list.indexOf(x[3]); byId[x[0]] = x; });
  const ratedToday = all.filter(([id]) => R[id] && R[id].last === t);
  const due = all.filter(([id, kind, m, q]) => { const r = R[id]; return r ? r.last !== t && r.due && r.due <= t : recallSeen(kind, m, q, idx[id]); })
    .sort((a, b) => { const x = R[a[0]], y = R[b[0]]; return (x ? x.due : t).localeCompare(y ? y.due : t) || (x ? 0 : 1) - (y ? 0 : 1); }); /* oldest due first, then items seen before */
  const left = due.slice(0, Math.max(0, RECALL_N - ratedToday.length));
  return { ratedToday, left, dueAll: due.length, byId };
}
function recallRate(id, how) {
  S.recall = S.recall || {}; const r = S.recall[id] || { box: 0, n: 0 }, t = recallDay(0);
  const box = how === 'easy' ? Math.min(RECALL_GAPS.length - 1, (r.n ? r.box + 1 : 1)) : how === 'hard' ? r.box || 0 : 0;
  S.recall[id] = { box, due: recallDay(RECALL_GAPS[box]), at: Date.now(), n: (r.n || 0) + 1, last: t, how };
  if (typeof gameNote === 'function') gameNote('recall'); save();
  return RECALL_GAPS[box];
}
/* the Today row: one short set a day, ticks itself when the set is marked */
function recallItem() {
  const st = recallState(), n = st.ratedToday.length + st.left.length;
  if (!n) return null;
  return { id: 'recall', chip: 'talk', t: 'Recall · ' + n + ' from memory', sub: 'Interview answers and quiz items you have seen come back after 1, 3, 7 and 21 days. Answer before the model answer shows.', mins: 5, href: '#/recall', auto: !st.left.length };
}

async function vRecall() {
  shell('Daily recall', 'Answer from memory first, then check', [el('p', { class: 'muted', text: 'Loading…' })], { back: '#/today' });
  const page = $('#page'); page.textContent = '';
  const st = recallState(), done = st.ratedToday.length, total = done + st.left.length, cur = st.left[0];
  if (!cur) {
    const R = S.recall || {}, next = Object.values(R).map(r => r.due).filter(Boolean).sort()[0];
    const how = st.ratedToday.reduce((a, [id]) => { const h = (R[id] || {}).how; a[h] = (a[h] || 0) + 1; return a; }, {});
    page.appendChild(el('section', { class: 'card pad stack' }, [el('h2', { text: done ? 'Recall done for today' : 'Nothing to recall yet' }),
      el('p', { style: { margin: 0 }, text: done ? done + ' recalled: ' + (how.easy || 0) + ' easy, ' + (how.hard || 0) + ' hard, ' + (how.missed || 0) + ' missed. Missed ones come back tomorrow.' : 'Open a model answer on an interview page, tick a question, or submit a quiz: those items come back here the next day.' }),
      st.dueAll ? el('span', { class: 'muted', text: st.dueAll + ' more ' + (st.dueAll === 1 ? 'is' : 'are') + ' due; they come first tomorrow.' }) : next ? el('span', { class: 'muted', text: 'Next one due ' + shortDate(next) + '.' }) : null,
      el('a', { class: 'btn pri', href: '#/today', text: 'Back to Today' })]));
    return;
  }
  const [id, kind, m, q] = cur, ans = el('div', { class: 'stack', style: { display: 'none' } }), ta = el('textarea', { class: 'code', 'aria-label': 'Your answer from memory', placeholder: 'Say it out loud or type it: structure first, then detail.', style: { minHeight: '110px', border: '1px solid var(--line2)', borderRadius: '10px', fontFamily: 'var(--body)', fontSize: '16px' } });
  const r = (S.recall || {})[id], gap = how => RECALL_GAPS[how === 'easy' ? Math.min(RECALL_GAPS.length - 1, r && r.n ? r.box + 1 : 1) : how === 'hard' ? (r && r.box) || 0 : 0];
  const rate = how => { const d = recallRate(id, how); toast(how === 'missed' ? 'Back tomorrow.' : 'Back in ' + d + ' day' + (d === 1 ? '' : 's') + '.'); vRecall(); };
  const show = el('button', { class: 'btn pri', id: 'rc_show', onclick: () => { show.remove(); ans.style.display = ''; } }, 'Show the answer');
  ans.append(el('b', { text: kind === 'iv' ? 'Model answer' : 'Answer' }), mdEl(recallAnswer(kind, q)), el('span', { class: 'lbl', text: 'How did it go?' }),
    el('div', { class: 'row wrap', role: 'group', 'aria-label': 'Mark this recall', style: { gap: '8px' } }, [['easy', 'Easy'], ['hard', 'Hard'], ['missed', 'Missed']].map(([h, t]) => el('button', { class: 'btn' + (h === 'easy' ? ' pri' : ''), 'data-rate': h, onclick: () => rate(h) }, t + ' · ' + (h === 'missed' ? 'tomorrow' : gap(h) + ' d')))));
  page.appendChild(el('section', { class: 'card pad stack' }, [
    el('div', { class: 'row wrap' }, [el('span', { class: 'lbl grow', text: (done + 1) + ' of ' + total + ' · ' + (kind === 'iv' ? 'Interview' : 'Quiz') + ' · ' + modLabel(m) + ' ' + modTitle(m) }), r && r.n ? el('span', { class: 'chip c-ai', text: 'review ' + (r.n + 1) }) : null]),
    el('div', { class: 'lq', html: mdi(q.Q) }), ta, show, ans]));
}
