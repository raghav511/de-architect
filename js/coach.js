/* Data Architect · mock interviews and the nightly coach.
   Loaded before app.js; uses its globals (S, DATA, el, shell, save, iso, ...) at call time.
   The coach runs as a scheduled Claude task on the Mac at night: it reads synced progress, grades submitted mocks,
   and writes coach JSON back through the sync script. Sync brings it here. */
'use strict';
const MOCK_LEN = { daily: [15, 3], sunday: [30, 5] }; /* minutes, questions */
function mockKind(k) { return new Date(k + 'T00:00:00').getDay() === 0 ? 'sunday' : 'daily'; }
function coachData() { return S.coach || {}; }
const coachTime = c => { const t = Date.parse((c || {}).generated_at || ''); return isNaN(t) ? 0 : t; };
/* trust fix 1: a report older than about a day and a half is labelled stale, with its age */
function coachAgeDays(c) { const t = coachTime(c); return t ? Math.floor((Date.now() - t) / 864e5) : null; }
function coachStale(c) { const t = coachTime(c); return !!t && Date.now() - t > 36 * 36e5; }
/* trust fix 9: a focus item that links to a problem counts as done once you solve it after the report */
function focusDone(f, c) { const m = /^#\/(py|dsa|sql|spark)\/([a-z0-9]+)/.exec(f.href || ''); return !!(m && S.solved[m[2]] && ((S.seen || {})[m[2]] || 0) > coachTime(c)); }

/* questions for a day: the coach's plan if it wrote one, otherwise a seeded pick from the interview sets up to the current module */
async function mockQuestions(k) {
  const plan = (coachData().next_mock || {})[k];
  if (plan && (plan.questions || []).length) return plan.questions.map(q => ({ q: q.q, tag: q.tag || 'core', why: q.why || '', src: 'chosen by your coach' }));
  const kind = mockKind(k), n = MOCK_LEN[kind][1], cur = curMid(), ci = MODS.indexOf(cur);
  const pool = [];
  /* modules up to the current one; early in the program, borrow from the next modules until there are enough questions */
  for (let i = 0; i < MODS.length && (i <= ci || pool.length < 2 * n); i++) { const s = await sprint(MODS[i]).catch(() => null); if (s) s.interview.forEach(q => pool.push({ q: q.Q, tag: q.TAG || 'core', m: MODS[i] })); }
  let h = 2166136261; for (const ch of k) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const curQ = shuffle(pool.filter(x => x.m === cur)).slice(0, Math.ceil(n / 2)), qs = curQ.concat(shuffle(pool.filter(x => !curQ.includes(x)))).slice(0, n);
  const D = DATA.design[cur];
  if (kind === 'sunday' && D) qs.splice(n - 1, 1, { q: '**Design round (10 minutes).** ' + D.prompt + ' Hand in: ' + D.deliverable, tag: 'design' });
  return qs.map(x => ({ q: x.q, tag: x.tag, why: '', src: x.m ? 'interview set ' + modLabel(x.m) : 'design problem ' + modLabel(cur) }));
}

/* apply a coach file that sync just brought in: weak problems become due today in the review queue */
function applyCoach(c) {
  const today = iso(new Date()), gen = coachTime(c);
  if (!c || !gen) return 0;
  /* trust fix 5: if today's mock was opened before this sync but not answered, use the questions the coach chose */
  const plan = (c.next_mock || {})[today], m = (S.mock || {})[today];
  if (plan && (plan.questions || []).length && m && !m.sub && !Object.values(m.a || {}).some(x => (x || '').trim()) && m.src !== 'coach') {
    m.qs = plan.questions.map(q => ({ q: q.q, tag: q.tag || 'core', why: q.why || '', src: 'chosen by your coach' })); m.src = 'coach'; m.t = Date.now();
  }
  /* trust fix 7: apply each report once (the marker syncs across devices), and never re-queue a problem you touched after the report */
  if (S.coachApplied && Date.parse(S.coachApplied) >= gen) return 0;
  let n = 0;
  (c.review_add || []).forEach(id => {
    if (!findQ(id)) return; S.rev = S.rev || {}; const r = S.rev[id];
    if ((r && (r.t || 0) > gen) || ((S.seen || {})[id] || 0) > gen) return;
    if (!r || !r.due || r.due > today) { S.rev[id] = { box: r && r.due ? r.box : 0, due: today, t: Date.now(), coach: true }; n++; }
  });
  S.coachApplied = c.generated_at;
  return n;
}

function mockStatus(k) {
  const m = (S.mock || {})[k], fb = (coachData().mock_feedback || {})[k];
  if (fb) return ['Feedback ready', 'b-ok'];
  /* trust fixes 2-4: say exactly why a submitted mock has no feedback yet */
  if (m && m.sub && !S.settings.syncUrl) return ['Submitted · set up Sync to get it graded', 'b-bad'];
  if (m && m.sub && (m.subAt || 0) > (S.lastSync || 0)) return ['Submitted · not synced yet', 'b-warn'];
  if (m && m.sub && k < iso(new Date(Date.now() - 864e5))) return ['Not graded yet', 'b-bad'];
  if (m && m.sub) return ['Submitted · graded tonight', 'b-warn'];
  if (m && Object.values(m.a || {}).some(Boolean)) return ['In progress', 'b-warn'];
  return ['Not started', ''];
}

/* ---------------- Today: the coach card ---------------- */
function coachCard() {
  const c = coachData(), today = iso(new Date()), kind = mockKind(today), [mins, nq] = MOCK_LEN[kind], [st, cls] = mockStatus(today);
  const focus = (c.focus || []).slice(0, 4), stale = coachStale(c), age = coachAgeDays(c);
  return el('section', { class: 'card pad stack', style: { borderColor: '#D9C6E6' } }, [
    el('div', { class: 'row wrap' }, [el('h2', { class: 'grow', text: 'Coach' }), el('span', { class: 'muted', style: { fontSize: '13px' }, text: c.generated_at ? 'last run ' + shortDate(c.generated_at.slice(0, 10)) : 'not run yet' })]),
    !S.settings.syncUrl ? el('div', { class: 'hint', style: { background: 'var(--amber-l)', borderColor: 'var(--amber-b)' } }, [el('b', { text: 'Sync is not set up. ' }), 'Your coach cannot see your work or grade your mock until it is. ', el('button', { class: 'btn sm', onclick: settings, text: 'Open settings' })]) : null,
    stale ? el('div', { class: 'hint', style: { background: 'var(--amber-l)', borderColor: 'var(--amber-b)' } }, [el('b', { text: 'This report is ' + age + ' day' + (age === 1 ? '' : 's') + ' old. ' }), 'The nightly coach has not reached this device since. Tap Sync progress; if it stays old, check that the Claude app was open on your Mac at midnight.']) : null,
    el('div', { class: 'item', style: { cursor: 'default' } }, [el('span', { class: 'grow' }, [el('span', { class: 't', text: (kind === 'sunday' ? 'Sunday mock interview' : 'Daily mock interview') + ' · ' + mins + ' min · ' + nq + ' questions' }), el('br'), el('span', { class: 's', text: 'Separate from the hour. Answer as you would out loud; your coach grades it tonight.' })]),
      cls ? el('span', { class: 'badge ' + cls, text: st }) : null, el('a', { class: 'btn sm pri', href: '#/mock/' + today, text: st === 'Not started' ? 'Start' : 'Open' })]),
    c.summary ? el('div', { style: { fontSize: '14.5px' }, html: mdi(c.summary) }) : el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'Every night your coach reads your day (steps, quizzes, problems, hints, the mock), grades your mock answers, and writes targeted practice here. It needs Sync set up in Settings.' }),
    focus.length ? el('div', { class: 'list', style: stale ? { opacity: 0.7 } : {} }, focus.map(f => el('a', { class: 'item', href: /^#\//.test(f.href || '') ? f.href : '#/coach' }, [el('span', { class: 'grow' }, [el('span', { class: 't', text: f.title }), el('br'), el('span', { class: 's', text: (f.mins ? f.mins + ' min · ' : '') + (f.why || '') })]), focusDone(f, c) ? el('span', { class: 'ok', text: '✓ done' }) : el('span', { class: 's', text: 'Open ›' })]))) : null,
    c.generated_at ? el('a', { href: '#/coach', style: { fontWeight: 600, fontSize: '14px' }, text: 'Full coach report ›' }) : null]);
}

/* ---------------- Coach report ---------------- */
function vCoach() {
  const c = coachData();
  const list = (t, xs) => xs && xs.length ? el('section', { class: 'card pad stack' }, [el('h3', { text: t }), el('ul', { style: { margin: 0, paddingLeft: '20px' } }, xs.map(x => el('li', { html: mdi(x) })))]) : null;
  const mocks = Object.keys(S.mock || {}).sort().reverse();
  shell('Coach', c.generated_at ? 'Last run ' + new Date(c.generated_at).toLocaleString() : 'Waiting for the first nightly run', [
    el('section', { class: 'card pad stack' }, [el('h2', { text: 'Last night' }), c.summary ? el('div', { html: md(c.summary) }) : el('p', { class: 'muted', style: { margin: 0 }, text: 'No report yet. Set up Sync in Settings; the coach runs at midnight on your Mac and the report arrives the next time you sync.' })]),
    el('div', { class: 'grid2' }, [list('Strengths', c.strengths), list('Work on', c.weaknesses)]),
    (c.focus || []).length ? el('section', { class: 'card pad stack' }, [el('h3', { text: 'Targeted practice' }), el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'Extra to your plan, which stays as it is. Problems the coach picked are also due in your review queue today.' }), el('div', { class: 'list' }, c.focus.map(f => el('a', { class: 'item', href: /^#\//.test(f.href || '') ? f.href : '#/today' }, [el('span', { class: 'grow' }, [el('span', { class: 't', text: f.title }), el('br'), el('span', { class: 's', text: (f.mins ? f.mins + ' min · ' : '') + (f.why || '') })])])))]) : null,
    c.week ? el('section', { class: 'card pad stack' }, [el('h3', { text: 'This week, and what carries into next week' }), el('div', { html: md(c.week.summary || '') }), list('Carry forward', c.week.carry_forward)]) : null,
    el('section', { class: 'card pad stack' }, [el('h3', { text: 'Mock interviews' }), mocks.length ? el('div', { class: 'list' }, mocks.map(k => { const [st, cls] = mockStatus(k), fb = (c.mock_feedback || {})[k]; return el('a', { class: 'item', href: '#/mock/' + k }, [el('span', { class: 'grow' }, [el('span', { class: 't', text: shortDate(k) + ' · ' + (S.mock[k].kind === 'sunday' ? 'Sunday round' : 'Daily round') }), el('br'), el('span', { class: 's', text: fb && fb.score ? 'Score ' + fb.score + ' / 5' : st })]), cls ? el('span', { class: 'badge ' + cls, text: st }) : null]); })) : el('p', { class: 'muted', style: { margin: 0 }, text: 'No mock interviews yet.' })])], { back: '#/today' });
}

/* ---------------- Mock interview ---------------- */
async function vMock(k) {
  const today = iso(new Date());
  k = /^\d{4}-\d\d-\d\d$/.test(k || '') ? k : today;
  S.mock = S.mock || {};
  shell('Mock interview', shortDate(k), [el('p', { class: 'muted', text: 'Preparing your questions…' })], { back: '#/today' });
  let m = S.mock[k];
  if (!m) {
    if (k !== today) { $('#page').textContent = ''; $('#page').appendChild(el('section', { class: 'card pad' }, [el('p', { style: { margin: 0 }, text: 'There was no mock interview on this day.' }), el('a', { href: '#/mock', text: 'Go to today\'s mock' })])); return; }
    const kind = mockKind(k);
    const qs = await mockQuestions(k);
    m = S.mock[k] = { kind, mins: MOCK_LEN[kind][0], qs, a: {}, secs: 0, sub: false, t: Date.now(), src: qs[0] && qs[0].src === 'chosen by your coach' ? 'coach' : 'bank' };
    save();
  }
  const fb = (coachData().mock_feedback || {})[k];
  const page = $('#page'); page.textContent = '';
  let running = !m.sub && k === today;
  const clock = el('b', { class: 'mono', style: { fontSize: '20px' } });
  const paint = () => { const left = m.mins * 60 - (m.secs || 0); clock.textContent = (left < 0 ? '+' : '') + Math.floor(Math.abs(left) / 60) + ':' + String(Math.abs(left) % 60).padStart(2, '0'); clock.style.color = left < 0 ? 'var(--red-d)' : ''; };
  const tick = setInterval(() => { if (running && document.visibilityState === 'visible') { m.secs = (m.secs || 0) + 1; if (m.secs % 10 === 0) save(false); paint(); } }, 1000);
  cleanup.push(() => { clearInterval(tick); save(false); });
  paint();
  page.appendChild(el('section', { class: 'card pad stack' }, [
    el('div', { class: 'row wrap' }, [el('span', { class: 'chip c-arch', text: m.kind === 'sunday' ? 'Sunday round · 30 min' : 'Daily round · 15 min' }), el('span', { class: 'grow' }), m.sub ? null : el('span', { class: 'muted', text: 'time left' }), m.sub ? null : clock]),
    el('span', { style: { fontSize: '14.5px' }, text: m.sub ? (fb ? 'Graded by your coach. Read the feedback and the stronger answer for each question, then say the stronger version out loud once.' : 'Submitted. Each answer is graded below as soon as your Mac picks it up. Tap Sync progress too: tonight\'s coach reviews the whole round and plans tomorrow around it.') : 'Answer each question as you would out loud: lead with the structure, then the detail, with numbers where you can. Type, or use your keyboard\'s dictation (the microphone on iPhone and iPad). Go past the time if you need to; the overrun is part of the feedback.' }),
    fb ? el('div', { class: 'hint' }, [el('b', { text: (fb.score ? 'Overall ' + fb.score + ' / 5. ' : '') }), el('span', { html: mdi(fb.overall || '') })]) : m.sub ? el('span', { class: 'badge ' + mockStatus(k)[1], text: mockStatus(k)[0] }) : null]));
  m.qs.forEach((q, i) => {
    const f = fb && (fb.items || [])[i];
    const ta = el('textarea', { class: 'code', 'aria-label': 'Your answer to question ' + (i + 1), style: { minHeight: '150px', border: '1px solid var(--line2)', borderRadius: '10px', fontFamily: 'var(--body)', fontSize: '16px' } });
    ta.value = (m.a || {})[i] || ''; if (m.sub) ta.readOnly = true;
    const wc = el('span', { class: 'muted', style: { fontSize: '13px' } }); const pw = () => { const n = (ta.value.match(/\S+/g) || []).length; wc.textContent = n + ' words'; }; pw();
    ta.addEventListener('input', () => { m.a = m.a || {}; m.a[i] = ta.value; m.t = Date.now(); save(); pw(); });
    page.appendChild(el('section', { class: 'card pad stack' }, [
      el('div', { class: 'row wrap' }, [el('span', { class: 'lbl grow', text: 'Question ' + (i + 1) + ' of ' + m.qs.length }), chip(q.tag || 'core'), f && f.score ? el('span', { class: 'badge ' + (f.score >= 4 ? 'b-ok' : f.score >= 3 ? 'b-warn' : 'b-bad'), text: f.score + ' / 5' }) : null]),
      el('div', { style: { fontSize: '16.5px' }, html: mdi(q.q) }), q.why ? el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: 'Why this question: ' + q.why }) : null,
      ta, wc,
      m.sub && (ta.value || '').trim() ? gradeBox({ kind: 'answer', key: 'mock:' + k + ':' + i, title: q.q, label: 'Grade this answer now', text: () => ta.value, payload: () => ({ question: q.q, answer: ta.value }) }) : null,
      f ? el('div', { class: 'stack', style: { gap: '8px' } }, [el('div', { class: 'why' }, [el('b', { text: 'Feedback: ' }), el('span', { html: mdi(f.feedback || '') })]), f.better ? el('details', {}, [el('summary', { style: { cursor: 'pointer', fontWeight: 600 }, text: 'A stronger answer' }), el('div', { html: md(f.better) })]) : null]) : null]));
  });
  if (!m.sub && k === today) page.appendChild(el('div', { class: 'row wrap' }, [el('a', { class: 'btn', href: '#/today', text: 'Save and leave' }), el('span', { class: 'grow' }),
    el('button', { class: 'btn pri', onclick: async () => { const left = m.qs.filter((q, i) => !((m.a || {})[i] || '').trim()).length; const v = await confirmBox('Submit this mock?', left ? left + ' question' + (left > 1 ? 's have' : ' has') + ' no answer. The coach grades them as missed.' : 'All questions answered. Your coach grades it tonight.', [{ t: 'Submit', cls: 'pri', v: 1 }, { t: 'Keep answering', v: null }]); if (!v) return; m.sub = true; m.qs.forEach((q, i) => { const t = ((m.a || {})[i] || '').trim(); if (t) gradeNow('mock:' + k + ':' + i, 'answer', { question: q.q, answer: t }, t, q.q); }); m.subAt = Date.now(); m.t = Date.now(); running = false; save(); toast(S.settings.syncUrl ? 'Submitted. Tap Sync progress so tonight\'s coach can grade it.' : 'Submitted. Set up Sync in Settings so the coach can grade it.', null, 6000); vMock(k); }, text: 'Submit for grading' })]));
}
