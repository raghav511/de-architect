/* Data Architect · Interview loop (#/loop): the six rounds of a big-tech interview loop (recruiter screen, coding, system design,
   code comprehension, behavioural, leadership with a past-project deep dive). Each round has what they look for, how to prepare,
   and practice inside the app: a pitch builder, a complexity drill, design topics in the simulator and estimates, code to read,
   fix (run in Python) and explain, a STAR story bank, and a project deep dive with follow-up questions.
   Rounds 7 to 9 make it a data engineering staff loop: timed SQL (the Hard items of data/bank/sql.json), data modelling and
   product sense with metrics, each a prompt answered part by part, then a model answer and a rubric. The design round uses data platforms at real scale.
   Content: data/loop.json (tools/loop/build.py; tools/loop/check.py tests the code items). State: S.loop, merged per entry in mergeState. */
'use strict';
const LOOP_R = { r1: 'Recruiter screen', r2: 'Coding (DSA)', r3: 'System design', r4: 'Code comprehension', r5: 'Behavioural', r6: 'Leadership and past project', r7: 'SQL, live', r8: 'Data modelling', r9: 'Product sense and metrics' };
const LOOP_TABS = { r1: [['about', 'About'], ['pitch', 'My pitch'], ['practice', 'Practice']], r2: [['about', 'About'], ['method', 'Method'], ['cx', 'Complexity']],
  r3: [['about', 'About'], ['topics', 'Topics'], ['est', 'Estimate']], r4: [['about', 'About'], ['code', 'Exercises']],
  r5: [['about', 'About'], ['stories', 'My stories'], ['practice', 'Practice']], r6: [['about', 'About'], ['project', 'My project'], ['practice', 'Practice']],
  r7: [['about', 'About'], ['timed', 'Timed round'], ['patterns', 'Patterns']], r8: [['about', 'About'], ['cases', 'Cases']], r9: [['about', 'About'], ['cases', 'Cases']] };
/* a short drill a day, by weekday (Sunday first) */
const LOOP_DAY = [['r3', 'topics', 'Design one data platform with the simulator'], ['r7', 'timed', 'Solve one Hard SQL problem against the clock'], ['r8', 'cases', 'Model one product: grain, facts, dimensions'],
  ['r9', 'cases', 'Define the metrics, events and pipeline for one product'], ['r4', 'code', 'Read, fix and explain one piece of code'], ['r5', 'practice', 'Tell one story in STAR form'], ['r6', 'practice', 'Answer one follow-up about your project']];
const LOOP_PARTS = { r8: [['ask', 'Questions you ask first'], ['grain', 'Grain of each table'], ['facts', 'Facts and measures'], ['dims', 'Dimensions and history (SCD)'], ['keys', 'Keys and late data'], ['query', 'One business question in SQL']],
  r9: [['goal', 'The goal'], ['metrics', 'Metrics: north star, supporting, guardrail'], ['events', 'Events to log'], ['pipeline', 'Pipeline and tables'], ['sql', 'The metric in SQL'], ['diag', 'It dropped 10%: diagnose it']] };
const LOOP_SQL_SECS = 15 * 60;
const LOOP_PITCH = [['now', 'Now', 'Your role, team and what you own today.'], ['before', 'Before', 'The path that led here, in one or two sentences.'], ['win', 'Best result', 'One result you are proud of, with a number.'], ['why', 'Why this role', 'What you want next and why this team fits.']];
const LOOP_CHECKS = { r5: ['Said I, not we', 'The result had a number', 'Under two minutes', 'Said what I learned'], r6: ['Named the alternative I rejected', 'Gave a number', 'Said what I would change', 'Kept it under two minutes'], r1: ['Under the time', 'Positive and specific', 'Ended on why this role'] };
let loopTab = {}, loopPos = {}, loopFollow = 'follow';

function loopState() {
  S.loop = S.loop || {}; const L = S.loop;
  ['stories', 'cc', 'cx', 'est', 'ans', 'reps', 'cases', 'sql'].forEach(k => { L[k] = L[k] || {}; }); L.pitch = L.pitch || {}; L.proj = L.proj || {};
  return L;
}
async function loopData() { if (!DATA.loop) DATA.loop = await fetch('data/loop.json').then(r => r.json()); return DATA.loop; }
const loopWords = s => (String(s || '').match(/\S+/g) || []).length;
const loopClock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
function loopRep(r) { if (!r) return; const L = loopState(), k = iso(new Date()); L.reps[k] = Object.assign({}, L.reps[k], { [r]: 1 }); }

/* how ready each round is, 0 to 100, from real work only */
function loopReady(D) {
  const L = loopState(), cap = x => Math.max(0, Math.min(100, Math.round(x)));
  const ansN = pre => Object.keys(L.ans).filter(k => k.startsWith(pre) && loopWords(L.ans[k].t) >= 15).length;
  const stories = Object.values(L.stories).filter(s => s && !s.del), sim = typeof simState === 'function' ? simState() : { done: {}, taught: {} };
  const pitch = LOOP_PITCH.filter(([k]) => loopWords(L.pitch[k]) >= 5).length;
  const cxOk = D.cx.filter(x => (L.cx[x.id] || {}).ok).length, solved = (DATA.dsa || []).filter(x => S.solved[x.id]).length;
  const estOk = Object.values(L.est).filter(e => e && e.score >= 3).length, taught = D.topics.filter(t => (sim.taught || {})[t.tpl]).length;
  const ccOk = D.cc.filter(x => (L.cc[x.id] || {}).fixed).length, cov = D.behC.filter(([c]) => stories.some(s => (s.tags || []).includes(c))).length;
  const proj = D.proj.filter(([k]) => loopWords(L.proj[k]) >= 3).length;
  const hard = loopHard(), timed = hard.filter(x => (L.sql[x.id] || {}).secs).length, hardOk = hard.filter(x => S.solved[x.id]).length;
  const cases = (set, r) => set.filter(c => LOOP_PARTS[r].filter(([k]) => loopWords((L.cases[c.id] || {})[k]) >= 4).length >= 4).length / set.length;
  return { r1: cap(pitch / 4 * 50 + Math.min(ansN('r1:'), 5) / 5 * 50), r2: cap(cxOk / D.cx.length * 50 + Math.min(solved, 20) / 20 * 50),
    r3: cap(Math.min(estOk, 4) / 4 * 35 + taught / D.topics.length * 35 + Math.min(Object.keys(sim.done || {}).length, 8) / 8 * 30), r4: cap(ccOk / D.cc.length * 100),
    r5: cap(cov / D.behC.length * 60 + Math.min(ansN('r5:'), 8) / 8 * 40), r6: cap(proj / D.proj.length * 60 + Math.min(ansN('r6:'), 6) / 6 * 40),
    r7: cap(Math.min(hardOk, 8) / 8 * 60 + Math.min(timed, 5) / 5 * 40), r8: cap(cases(D.model, 'r8') * 100), r9: cap(cases(D.metrics, 'r9') * 100) };
}

/* ---------------- small parts ---------------- */
function loopTimer(target) {
  let t = 0, on = false, iv = null;
  const b = el('button', { class: 'btn sm lptimer', 'aria-pressed': 'false' });
  const paint = () => { b.textContent = (on ? '■ ' : '▶ ') + loopClock(t) + ' of ' + loopClock(target); b.classList.toggle('over', t > target); b.setAttribute('aria-pressed', String(on)); };
  b.onclick = () => { on = !on; clearInterval(iv); if (on) { if (t > target) t = 0; iv = setInterval(() => { t++; paint(); }, 1000); } paint(); };
  cleanup.push(() => clearInterval(iv)); paint(); return b;
}
function loopChecks(key, list) {
  const L = loopState();
  return el('div', { class: 'lpchecks' }, list.map((c, i) => el('label', { class: 'lpchk' }, [el('input', { type: 'checkbox', checked: ((L.ans[key] || {}).chk || {})[i] ? '' : null,
    onchange: e => { const a = L.ans[key] = Object.assign({}, L.ans[key]); a.chk = Object.assign({}, a.chk, { [i]: e.target.checked }); a.at = Date.now(); save(); } }), el('span', { text: c })])));
}
/* one question: write or speak the answer, time it, tick the checks, and get it graded when AI is on */
function loopAnswer(key, q, o) {
  o = o || {}; const L = loopState();
  const ta = el('textarea', { class: 'code lpta', 'aria-label': 'Your answer', placeholder: o.ph || 'Answer as you would out loud. Speak or type.' });
  ta.value = (L.ans[key] || {}).t || '';
  const wc = el('span', { class: 'muted lpwc' });
  const pw = () => { const n = loopWords(ta.value); wc.textContent = n + ' words · about ' + loopClock(Math.round(n / 2.5)) + ' out loud'; };
  const put = () => { L.ans[key] = Object.assign({}, L.ans[key], { t: ta.value, at: Date.now() }); loopRep(key.split(':')[0]); save(); pw(); };
  ta.addEventListener('input', put); pw();
  const mic = typeof liveMic === 'function' ? liveMic(ta, put) : null;
  return el('section', { class: 'card pad stack lpans' }, [el('b', { class: 'lpq', text: q }), o.tip ? el('div', { class: 'hint', text: o.tip }) : null, o.extra || null, ta,
    el('div', { class: 'row wrap' }, [mic && mic.b, loopTimer(o.secs || 120), el('span', { class: 'grow' }), wc]),
    o.checks ? loopChecks(key, o.checks) : null,
    typeof gradeBox === 'function' ? gradeBox({ kind: 'answer', key: 'loop:' + key, title: q, label: 'Grade my answer', text: () => ta.value, payload: () => ({ question: q, answer: ta.value }) }) : null]);
}
/* one item per screen, with Back and Next */
function loopStepper(items, key, render) {
  const box = el('div', { class: 'stack' });
  const paint = () => {
    const i = loopPos[key] = Math.max(0, Math.min(items.length - 1, loopPos[key] || 0)); box.textContent = '';
    box.append(el('div', { class: 'row lpnav' }, [el('button', { class: 'btn sm', disabled: i === 0, onclick: () => { loopPos[key]--; paint(); } }, '‹ Back'),
      el('span', { class: 'grow muted', style: { textAlign: 'center' }, text: (i + 1) + ' of ' + items.length }),
      el('button', { class: 'btn sm pri', disabled: i === items.length - 1, onclick: () => { loopPos[key]++; paint(); } }, 'Next ›')]), render(items[i], i));
  };
  paint(); return box;
}
function loopField(get, k, label, hint, rows, onIn) {
  const ta = el('textarea', { class: 'code lpta', rows: rows || 2, 'aria-label': label, placeholder: hint });
  ta.value = get()[k] || '';
  ta.addEventListener('input', () => { const o = get(); o[k] = ta.value; o.at = Date.now(); save(); if (onIn) onIn(); });
  return el('label', { class: 'stack lpf' }, [el('b', { text: label }), ta]);
}
const loopCode = s => el('pre', { class: 'lpcode' }, el('code', { text: s }));
function loopChoice(q, choices, picked, ans, why, onPick) {
  return el('div', { class: 'stack lpchoice' }, [el('b', { text: q }), el('div', { class: 'stack', style: { gap: '6px' } }, choices.map((c, i) => el('button', {
    class: 'btn lpopt' + (picked == null ? '' : i === ans ? ' ok' : i === picked ? ' bad' : ''), disabled: picked != null, 'aria-pressed': picked === i ? 'true' : null, onclick: () => onPick(i) }, c))),
    picked != null && why ? el('div', { class: 'why' }, [el('b', { text: picked === ans ? 'Right. ' : 'Not quite. ' }), el('span', { text: why })]) : null]);
}

/* ---------------- Today: one short drill a day ---------------- */
/* the day's interview loop drill as a row in Today's Interview part; it ticks itself once you practise that round today */
function loopTodayItem(k) {
  const [r, tab, t] = LOOP_DAY[new Date(k + 'T00:00:00').getDay()], done = !!(loopState().reps[k] || {})[r];
  return { id: 'loop:' + r, chip: 'talk', t: 'Interview loop: ' + t, sub: 'Round ' + r.slice(1) + ' · ' + LOOP_R[r], mins: 10, href: '#/loop/' + r + '/' + tab, auto: done };
}
function loopToday() {
  const [r, tab, t] = LOOP_DAY[new Date().getDay()], done = (loopState().reps[iso(new Date())] || {})[r];
  return el('section', { class: 'card pad row wrap looptoday' }, [el('span', { class: 'simab', style: { background: 'var(--blue)' }, text: 'R' + r[1] }),
    el('div', { class: 'grow stack', style: { gap: '0' } }, [el('b', { text: 'Interview loop: ' + t }), el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'Round ' + r[1] + ' · ' + LOOP_R[r] + ' · about 10 minutes' + (done ? ' · done today' : '') })]),
    el('a', { class: 'btn sm' + (done ? '' : ' pri'), href: '#/loop/' + r + '/' + tab, text: done ? 'Again' : 'Start' })]);
}

/* ---------------- pages ---------------- */
async function vLoop(a, b) {
  shell('Interview loop', 'Interview', [el('p', { class: 'muted', text: 'Loading…' })]);
  let D; try { D = await loopData(); } catch (e) { $('#page').textContent = ''; $('#page').append(el('section', { class: 'card pad' }, el('p', { text: 'The interview loop could not load. Connect once and try again.' }))); return; }
  loopState();
  if (a === 'cc' && b) return loopCC(D, b);
  const R = D.rounds.find(x => x.id === a);
  if (!R) return loopHub(D);
  const tabs = LOOP_TABS[R.id], tab = tabs.some(t => t[0] === b) ? b : (loopTab[R.id] || (Object.keys(loopState().reps).length ? tabs[1][0] : 'about'));
  loopTab[R.id] = tab;
  const body = el('div', { class: 'stack' });
  const bar = el('div', { class: 'tabs', role: 'tablist', 'aria-label': R.t }, tabs.map(([k, t]) => el('button', { role: 'tab', 'aria-selected': String(k === tab), onclick: () => { location.replace('#/loop/' + R.id + '/' + k); } }, t)));
  shell(R.t, 'Interview loop · round ' + R.n + ' of ' + D.rounds.length, [bar, body], { back: '#/loop' });
  const f = { about: loopAbout, pitch: loopPitch, practice: R.id === 'r1' ? loopR1Practice : R.id === 'r5' ? loopR5Practice : loopR6Practice, method: loopMethod, cx: loopCx,
    topics: loopTopics, est: loopEst, code: loopCodeList, stories: loopStories, project: loopProject, timed: loopSqlRound, patterns: loopSqlPat, cases: loopCases }[tab];
  body.append(f(D, R));
}
function loopHub(D) {
  const rd = loopReady(D), L = loopState(), today = L.reps[iso(new Date())] || {};
  const next = { r1: 'pitch', r2: 'cx', r3: 'topics', r4: 'code', r5: 'stories', r6: 'project', r7: 'timed', r8: 'cases', r9: 'cases' };
  const avg = Math.round(D.rounds.reduce((s, r) => s + rd[r.id], 0) / D.rounds.length);
  shell('Interview loop', 'Interview · ' + avg + '% ready', [
    el('section', { class: 'card pad stack' }, [el('p', { style: { margin: 0 }, text: 'The rounds of a data engineering staff loop at big tech: what each looks for, and practice here. Formats vary by company and level.' }),
      el('details', { class: 'lpco' }, [el('summary', { text: 'Typical loops by company' }), el('div', { class: 'stack', style: { gap: '8px', marginTop: '8px' } }, D.companies.map(([co, d, rs]) => el('div', { class: 'stack', style: { gap: '4px' } }, [el('b', { text: co }), el('span', { class: 'muted', style: { fontSize: '14px' }, text: d }),
        el('div', { class: 'row wrap', style: { gap: '4px' } }, rs.map(r => el('a', { class: 'chip c-arch', href: '#/loop/' + r, text: r[1] + '. ' + LOOP_R[r] })))])))])]),
    loopToday(),
    el('div', { class: 'lpgrid' }, D.rounds.map(r => el('a', { class: 'card pad stack lpround', href: '#/loop/' + r.id + '/' + next[r.id], 'data-round': r.id }, [
      el('div', { class: 'row' }, [el('span', { class: 'chip c-arch', text: 'Round ' + r.n }), el('span', { class: 'grow' }), today[r.id] ? el('span', { class: 'badge b-ok', text: 'practised today' }) : null]),
      el('b', { class: 'lpt', text: r.t }), el('span', { class: 'muted', style: { fontSize: '14px' }, text: r.s }),
      el('div', { class: 'lpbar', role: 'img', 'aria-label': rd[r.id] + '% ready' }, el('i', { style: { width: rd[r.id] + '%' } })), el('small', { class: 'muted', text: rd[r.id] + '% ready' })])))]);
}
function loopAbout(D, R) {
  const main = LOOP_TABS[R.id][1];
  return el('div', { class: 'stack' }, [el('section', { class: 'card pad stack' }, [el('p', { style: { margin: 0, fontSize: '16.5px' }, text: R.s }), el('h3', { text: 'What they look for' }),
    el('div', { class: 'stack', style: { gap: '8px' } }, R.look.map(([t, d]) => el('div', { class: 'lplook' }, [el('b', { text: t }), el('span', { class: 'muted', text: d })])))]),
    el('section', { class: 'card pad stack' }, [el('h3', { text: 'How to prepare' }), el('ol', { style: { margin: 0, paddingLeft: '20px' } }, R.prep.map(x => el('li', { text: x })))]),
    R.id === 'r8' ? el('div', { class: 'row wrap' }, [el('a', { class: 'btn sm', href: '#/learn/m01/practice', text: 'Model it out loud (Modelling 1)' }), el('a', { class: 'btn sm', href: '#/learn/m02', text: 'Fact modelling (Modelling 2)' })]) : null,
    R.id === 'r9' ? el('a', { class: 'btn sm', href: '#/learn/s11/chapter', style: { alignSelf: 'flex-start' }, text: 'Product metrics and experiments (DE 11)' }) : null,
    el('a', { class: 'btn pri', href: '#/loop/' + R.id + '/' + main[0], style: { alignSelf: 'flex-start' }, text: 'Practise: ' + main[1] })]);
}

/* round 1: pitch and recruiter questions */
function loopPitch(D, R) {
  const L = loopState(), out = el('div', { class: 'lppitch' }), meta = el('span', { class: 'muted' });
  const paint = () => { const t = LOOP_PITCH.map(([k]) => (L.pitch[k] || '').trim()).filter(Boolean).join(' '), n = loopWords(t); out.textContent = t || 'Fill the four parts and your pitch appears here, ready to say.'; meta.textContent = n + ' words · about ' + loopClock(Math.round(n / 2.5)) + (n < 120 ? ' · a little short: aim for 150 to 220 words' : n > 230 ? ' · long: aim for 60 to 90 seconds' : ' · a good length'); };
  const box = el('div', { class: 'stack' }, [el('section', { class: 'card pad stack' }, [el('span', { class: 'muted', text: 'Tell me about yourself, in 60 to 90 seconds. Write each part in a sentence or two; it saves as you type.' })].concat(LOOP_PITCH.map(([k, t, h]) => loopField(() => loopState().pitch, k, t, h, 2, paint)))),
    el('section', { class: 'card pad stack' }, [el('h3', { text: 'Your pitch' }), out, el('div', { class: 'row wrap' }, [loopTimer(90), el('span', { class: 'grow' }), meta]), loopChecks('r1:pitch', LOOP_CHECKS.r1)])]);
  paint(); return box;
}
function loopR1Practice(D) {
  return loopStepper(D.recruiter, 'r1', q => el('div', { class: 'stack' }, [el('span', { class: 'chip c-test', style: { alignSelf: 'flex-start' }, text: q.c }),
    loopAnswer('r1:' + q.id, q.q, { tip: q.tip, secs: q.id === 'q1' ? 90 : 60, checks: LOOP_CHECKS.r1 })]));
}

/* round 2: method and complexity */
function loopMethod(D) {
  const core = (DATA.dsa || []).filter(x => !x.st), n = core.length, solved = (DATA.dsa || []).filter(x => S.solved[x.id]).length, p = n ? core[dayIndex() % n] : null;
  return el('div', { class: 'stack' }, [el('section', { class: 'card pad stack' }, [el('h3', { text: 'The same seven steps, every problem' }),
    el('ol', { class: 'lpsteps' }, D.dsaSteps.map(([t, d]) => el('li', {}, [el('b', { text: t + '. ' }), el('span', { text: d })])))]),
    p ? el('section', { class: 'card pad stack' }, [el('b', { text: 'Today\'s problem: ' + p.t }), el('span', { class: 'muted', text: p.lv + ' · ' + solved + ' of ' + n + ' problems solved. Say each step out loud as you go, then the complexity.' }),
      el('div', { class: 'row wrap' }, [el('a', { class: 'btn pri sm', href: '#/dsa/' + p.id, text: 'Solve it' }), el('a', { class: 'btn sm', href: '#/loop/r2/cx', text: 'Complexity drill' })])]) : null]);
}
function loopCx(D) {
  const L = loopState(), ok = () => D.cx.filter(x => (L.cx[x.id] || {}).ok).length, score = el('span', { class: 'muted' });
  const sc = () => { score.textContent = ok() + ' of ' + D.cx.length + ' right'; };
  const st = loopStepper(D.cx, 'cx', x => { const box = el('section', { class: 'card pad stack' });
    const paint = () => { const r = L.cx[x.id]; box.textContent = ''; box.append(el('b', { text: 'What is the time complexity?' }), loopCode(x.code),
      loopChoice('Pick one', D.cxChoices, r && r.pick != null ? r.pick : null, D.cxChoices.indexOf(x.ans), x.why, i => { L.cx[x.id] = { pick: i, ok: D.cxChoices[i] === x.ans, at: Date.now() }; loopRep('r2'); save(); sc(); paint(); }),
      r ? el('button', { class: 'btn sm', style: { alignSelf: 'flex-start' }, onclick: () => { delete L.cx[x.id]; save(); sc(); paint(); } }, 'Try again') : null); };
    paint(); return box; });
  sc(); return el('div', { class: 'stack' }, [score, st]);
}

/* round 3: design topics and estimates */
function loopTopics(D) {
  const sim = typeof simState === 'function' ? simState() : { done: {}, taught: {} };
  const scs = typeof SIM_SC !== 'undefined' ? SIM_SC : [];
  const parts = t => [['Functional requirements', t.fr], ['Non-functional', t.nfr], [t.mid ? 'Interfaces' : 'API', t.api], ['Data model', t.data], ['Key decisions', t.decide]].map(([h, xs]) => el('div', { class: 'stack', style: { gap: '4px' } }, [el('span', { class: 'lbl', text: h }), el('ul', { style: { margin: 0, paddingLeft: '20px' } }, xs.map(x => el('li', { text: x })))]));
  const topic = (t, i, est) => el('details', { class: 'card pad lptopic', 'data-topic': t.id }, [
    el('summary', {}, [el('b', { text: t.t }), t.mid ? el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'Module ' + modLabel(t.mid) }) : null, (sim.taught || {})[t.tpl] ? el('span', { class: 'badge b-ok', text: 'taught' }) : null]),
    el('div', { class: 'stack', style: { marginTop: '10px' } }, [
      el('div', { class: 'row wrap' }, [el('a', { class: 'btn pri sm', href: '#/sim/teach/' + t.tpl, text: 'Teach me in the simulator' }), typeof simSketch === 'function' ? simSketch(t.t, 'Sketch it myself') : null, est ? el('a', { class: 'btn sm', href: '#/loop/r3/est', onclick: () => { loopPos.est = i; }, text: 'Estimate it' }) : null]),
      (t.sc || []).length ? el('div', { class: 'stack', style: { gap: '4px' } }, [el('span', { class: 'lbl', text: 'Prove it: simulator challenges' }), el('div', { class: 'row wrap', style: { gap: '6px' } }, t.sc.map(id => scs.find(x => x.id === id)).filter(Boolean).map(x => el('a', { class: 'chip ' + ((sim.done || {})[x.id] ? 'c-dsa' : 'c-arch'), href: '#/sim/sc/' + x.id, text: ((sim.done || {})[x.id] ? '✓ ' : '') + x.t })))]) : null,
      t.mid ? el('a', { href: '#/learn/' + t.mid + '/chapter', style: { fontSize: '14px' }, text: 'Read the module: ' + modLabel(t.mid) + ' · ' + (typeof modTitle === 'function' ? modTitle(t.mid) : '') }) : null,
      ...parts(t)])]);
  return el('div', { class: 'stack' }, [el('section', { class: 'card pad stack' }, [el('b', { text: 'Data platform designs start from the same flow' }),
    el('span', { class: 'muted', text: 'Sources → ingestion (Kafka, CDC, file drops) → processing (stream or batch) → storage (lake, warehouse, serving store) → consumers. Size every arrow with numbers, then go deep where the interviewer points: exactly once, late data, backfills, cost.' }),
    el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'The simulator\'s ' + scs.length + ' challenges test these designs under failure: ' + Object.keys(sim.done || {}).length + ' passed.' })])]
    .concat(D.topics.map((t, i) => topic(t, i, true)), [el('details', { class: 'card pad lpweb' }, [el('summary', { text: 'Classic web designs (also asked at Google)' }), el('div', { class: 'stack', style: { marginTop: '10px' } }, (D.webTopics || []).map((t, i) => topic(t, i, false)))])]));
}
/* back-of-the-envelope: four numbers from one scenario, accepted within 30% */
function loopEstQs(t, f) {
  const e = t.est, users = e.users * f, perDay = users * e.per, avg = perDay / 86400, store = perDay * e.ws * e.wb * 365, bw = perDay * e.rb / 86400;
  const su = store >= 1e15 ? [1e15, 'PB'] : store >= 1e12 ? [1e12, 'TB'] : [1e9, 'GB'], fast = bw >= 1e9;
  const fmt = n => n >= 100 ? Math.round(n).toLocaleString('en') : n.toPrecision(2);
  return [['avg', 'Average requests a second', avg, 'per second', fmt(perDay) + ' a day ÷ 86,400 seconds = ' + fmt(avg) + ' a second'],
    ['peak', 'Peak requests a second (×' + e.peak + ')', avg * e.peak, 'per second', fmt(avg) + ' × ' + e.peak + ' = ' + fmt(avg * e.peak)],
    ['store', 'New storage a year', store / su[0], su[1], fmt(perDay) + ' × ' + e.ws + ' kept × ' + fmt(e.wb) + ' bytes × 365 = ' + fmt(store / su[0]) + ' ' + su[1]],
    ['bw', e.bwl || 'Outbound bandwidth on average', bw / (fast ? 1e9 : 1e6), fast ? 'GB/s' : 'MB/s', fmt(perDay) + ' × ' + fmt(e.rb) + ' bytes ÷ 86,400 = ' + fmt(bw / (fast ? 1e9 : 1e6)) + (fast ? ' GB/s' : ' MB/s')]];
}
function loopEst(D) {
  const L = loopState(), F = [1, 2, 0.5, 4, 3];
  return loopStepper(D.topics, 'est', t => {
    const key = t.id, rec = L.est[key] || {}, f = F[(rec.n || 0) % F.length], qs = loopEstQs(t, f), users = t.est.users * f;
    const box = el('section', { class: 'card pad stack lpest', 'data-topic': t.id }), ins = {};
    const res = el('div', { class: 'stack', 'aria-live': 'polite' });
    box.append(el('b', { text: t.t }), el('p', { style: { margin: 0 }, text: users.toLocaleString('en') + ' ' + (t.est.who || 'daily users') + ', ' + t.est.per + ' ' + t.est.act + ' each a day. ' + t.est.note }),
      el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'Round freely: interviewers want the order of magnitude and the working. Within 30% counts.' }),
      ...qs.map(([k, lab, , unit]) => { ins[k] = el('input', { class: 'btn lpnum', type: 'number', inputmode: 'decimal', step: 'any', 'aria-label': lab + ' in ' + unit }); return el('label', { class: 'row wrap lpestrow' }, [el('span', { class: 'grow', text: lab }), ins[k], el('span', { class: 'muted lpunit', text: unit })]); }),
      el('div', { class: 'row wrap' }, [el('button', { class: 'btn pri sm', onclick: () => {
        let s = 0; res.textContent = '';
        qs.forEach(([k, lab, v, unit, how]) => { const g = parseFloat(ins[k].value), ok = g > 0 && Math.abs(g - v) / v <= 0.3; s += ok; ins[k].classList.toggle('ok', ok); ins[k].classList.toggle('bad', !ok);
          res.append(el('div', { class: 'why' }, [el('b', { text: (ok ? '✓ ' : '✗ ') + lab + ': ' }), el('span', { text: how })])); });
        L.est[key] = { n: (rec.n || 0) + 1, score: Math.max(s, (L.est[key] || {}).score || 0), last: s, at: Date.now() }; loopRep('r3'); save();
        res.prepend(el('b', { text: s + ' of 4 within 30%' + (s === 4 ? '. Ready for the design.' : '.') }));
        res.append(el('button', { class: 'btn sm', style: { alignSelf: 'flex-start' }, onclick: () => { route(); } }, 'New numbers'));
      } }, 'Check'), rec.score != null ? el('span', { class: 'muted', text: 'Best ' + rec.score + ' of 4' }) : null]), res);
    return box;
  });
}

/* round 4: code comprehension */
function loopCodeList(D) {
  const L = loopState();
  return el('div', { class: 'stack' }, [el('span', { class: 'muted', text: 'Each one: say what it promises, tap the line with the bug, fix it and run the tests, improve it, then explain your approach. ' + D.cc.filter(x => (L.cc[x.id] || {}).fixed).length + ' of ' + D.cc.length + ' fixed.' }),
    el('div', { class: 'stack', style: { gap: '6px' } }, D.cc.map(x => { const r = L.cc[x.id] || {}; return el('a', { class: 'simsc', href: '#/loop/cc/' + x.id, 'data-cc': x.id }, [el('span', { class: 'grow' }, [el('b', { text: (r.fixed ? '✓ ' : '') + x.t }), el('small', { text: x.lv + ' · ' + modLabel(x.mid) + (r.fixed ? (r.shown ? ' · fix shown' : r.tries === 1 ? ' · bug found first try' : '') : '') })]), el('span', { class: 'chip ' + (r.fixed ? 'c-dsa' : 'c-arch'), text: r.fixed ? 'Fixed' : 'Start' })]); }))]);
}
function loopCC(D, id) {
  const x = D.cc.find(c => c.id === id); if (!x) { location.replace('#/loop/r4/code'); return; }
  const L = loopState(), i = D.cc.indexOf(x), ai = D.aiq[i % D.aiq.length], next = D.cc[i + 1];
  const R = () => L.cc[id] = L.cc[id] || {}, put = o => { Object.assign(R(), o, { at: Date.now() }); loopRep('r4'); save(); };
  const page = el('div', { class: 'stack' });
  shell(x.t, 'Interview loop · code comprehension', [page], { back: '#/loop/r4/code' });
  const paint = () => {
    const r = R(), lines = x.code.split('\n'); page.textContent = '';
    page.append(el('section', { class: 'card pad stack' }, [el('div', { class: 'row wrap' }, [el('span', { class: 'chip c-arch', text: x.lv }), el('span', { class: 'muted', text: 'Module ' + modLabel(x.mid) })]), el('div', { class: 'hint' }, [el('b', { text: 'The spec: ' }), el('span', { text: x.spec })]),
      el('div', { class: 'lpcode lplines', role: 'group', 'aria-label': 'The code, one button per line' }, lines.map((ln, k) => el('button', { class: 'lpln' + (r.line && x.bug.includes(k + 1) ? ' hit' : (r.miss || []).includes(k + 1) ? ' miss' : ''), 'data-line': k + 1, disabled: r.what == null || r.line ? true : null,
        onclick: () => { if (x.bug.includes(k + 1)) put({ line: k + 1, tries: (r.tries || 0) + 1 }); else { put({ miss: (r.miss || []).concat(k + 1), tries: (r.tries || 0) + 1 }); toast('Not this line. Try the input in the spec that is easiest to get wrong.'); } paint(); } }, [el('span', { class: 'lpno', text: String(k + 1) }), el('span', { text: ln || ' ' })])))]));
    /* step 1: understand */
    page.append(el('section', { class: 'card pad stack' }, [el('span', { class: 'lbl', text: 'Step 1 · Understand' }), loopChoice(x.what.q, x.what.c, r.what != null ? r.what : null, x.what.a, r.what != null ? 'Say this in one sentence before touching the code.' : null, k => { put({ what: k }); paint(); })]));
    if (r.what == null) return;
    /* step 2: find */
    page.append(el('section', { class: 'card pad stack lpstep' }, [el('span', { class: 'lbl', text: 'Step 2 · Find the bug' }), r.line ? el('div', { class: 'why' }, [el('b', { text: 'Line ' + r.line + (r.tries === 1 ? ', first try. ' : '. ') }), el('span', { text: x.edge })]) : el('span', { text: 'Tap the line in the code above that breaks the spec.' })]));
    if (!r.line) return;
    /* step 3: fix and run */
    const ta = el('textarea', { class: 'code lpfix', spellcheck: 'false', 'aria-label': 'Your fixed code' }); ta.value = r.code || x.code;
    ta.addEventListener('input', () => { R().code = ta.value; R().at = Date.now(); save(); });
    ta.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('    ', s, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); } });
    const out = el('div', { class: 'stack', 'aria-live': 'polite' });
    const run = el('button', { class: 'btn pri sm', onclick: async () => { run.disabled = true; out.textContent = ''; out.append(el('span', { class: 'muted', text: 'Running the tests… the first run starts Python (about 15 seconds).' }));
      let res; try { res = await Py.json('check_py', [JSON.stringify({ tests: x.tests }), ta.value], 20000); } catch (e) { res = { err: String(e.message || e), tests: [] }; }
      run.disabled = false; out.textContent = ''; if (res.err) out.append(el('pre', { class: 'lpcode bad', text: res.err }));
      res.tests.forEach(t => out.append(el('div', { class: 'lptest ' + (t.ok ? 'ok' : 'bad') }, [el('b', { text: (t.ok ? '✓ ' : '✗ ') + t.call }), t.ok ? null : el('small', { text: ' expected ' + t.want + ', got ' + t.got })])));
      const pass = !res.err && res.tests.length && res.tests.every(t => t.ok);
      if (pass && !R().fixed) { put({ fixed: Date.now() }); toast('All tests pass. Now improve it and explain it.'); paint(); } } }, 'Run the tests');
    page.append(el('section', { class: 'card pad stack lpstep' }, [el('span', { class: 'lbl', text: 'Step 3 · Fix it and run the tests' }), ta,
      el('div', { class: 'row wrap' }, [run, el('button', { class: 'btn sm', onclick: () => { ta.value = x.code; R().code = x.code; save(); } }, 'Reset'), el('span', { class: 'grow' }),
        el('button', { class: 'btn sm', onclick: () => { put({ shown: 1 }); paint(); } }, r.shown ? 'Fix shown below' : 'Show a fix')]), out,
      r.shown ? el('details', { open: true }, [el('summary', { text: 'One good fix' }), loopCode(x.fixed)]) : null, r.fixed ? el('span', { class: 'badge b-ok', style: { alignSelf: 'flex-start' }, text: 'Tests pass' }) : null]));
    if (!r.fixed && !r.shown) return;
    /* step 4 and 5: improve, and use AI well */
    page.append(el('section', { class: 'card pad stack lpstep' }, [el('span', { class: 'lbl', text: 'Step 4 · Improve' }), loopChoice(x.better.q, x.better.c, r.better != null ? r.better : null, x.better.a, x.better.why, k => { put({ better: k }); paint(); })]));
    if (r.better == null) return;
    page.append(el('section', { class: 'card pad stack lpstep' }, [el('span', { class: 'lbl', text: 'Step 5 · If an AI assistant is allowed' }), loopChoice(ai.q, ai.c, r.ai != null ? r.ai : null, ai.a, ai.why, k => { put({ ai: k }); paint(); })]));
    if (r.ai == null) return;
    /* step 6: explain */
    page.append(el('div', { class: 'lpstep' }, loopAnswer('r4:' + id, 'Step 6 · Explain your approach to the interviewer', { tip: 'What was wrong, the input that shows it, your fix, the test you would add, and one trade-off. About a minute.', secs: 75, checks: ['Named the failing input', 'Explained the fix', 'Said which test I would add', 'Gave a trade-off'] })),
      el('div', { class: 'row wrap' }, [el('a', { class: 'btn', href: '#/loop/r4/code', text: 'All exercises' }), el('span', { class: 'grow' }), next ? el('a', { class: 'btn pri', href: '#/loop/cc/' + next.id, text: 'Next: ' + next.t }) : null]));
  };
  paint();
}

/* round 5: STAR stories */
function loopStories(D) {
  const L = loopState(), box = el('div', { class: 'stack' });
  const live = () => Object.entries(L.stories).filter(([, s]) => s && !s.del).sort((p, q) => (q[1].at || 0) - (p[1].at || 0));
  const paint = () => {
    box.textContent = ''; const list = live(), cur = loopPos.story && L.stories[loopPos.story] && !L.stories[loopPos.story].del ? loopPos.story : null;
    box.append(el('div', { class: 'lpcov', 'aria-label': 'Stories per area' }, D.behC.map(([c, t]) => { const n = list.filter(([, s]) => (s.tags || []).includes(c)).length; return el('span', { class: 'chip ' + (n ? 'c-dsa' : 'c-test'), text: t + ' · ' + n }); })));
    if (cur) { box.append(loopStoryEdit(D, cur, () => { loopPos.story = null; paint(); })); return; }
    box.append(el('button', { class: 'btn pri', style: { alignSelf: 'flex-start' }, onclick: () => { const id = 's' + Date.now().toString(36); L.stories[id] = { title: '', tags: [], at: Date.now() }; save(); loopPos.story = id; paint(); } }, '+ New story'));
    if (!list.length) box.append(el('p', { class: 'muted', text: 'Aim for 6 to 8 stories that together cover every area above. One good story often answers several questions.' }));
    list.forEach(([id, s]) => box.append(el('button', { class: 'simsc lpstory', onclick: () => { loopPos.story = id; paint(); } }, [el('span', { class: 'grow' }, [el('b', { text: s.title || 'Untitled story' }), el('small', { text: (s.tags || []).map(c => (D.behC.find(x => x[0] === c) || [, c])[1]).join(', ') + ' · ' + loopWords(['s', 't', 'a', 'r'].map(k => s[k]).join(' ')) + ' words' })]), el('span', { class: 'chip c-arch', text: 'Edit' })])));
  };
  paint(); return box;
}
function loopStoryEdit(D, id, done) {
  const L = loopState(), get = () => L.stories[id], meta = el('span', { class: 'muted' });
  const pw = () => { const n = loopWords(['s', 't', 'a', 'r'].map(k => get()[k]).join(' ')); meta.textContent = n + ' words · about ' + loopClock(Math.round(n / 2.5)) + ' out loud' + (n > 330 ? ' · trim it to two minutes' : ''); };
  const title = el('input', { class: 'btn lptitle', 'aria-label': 'Story title', placeholder: 'A short title, e.g. "The late partner files"', value: get().title || '' });
  title.addEventListener('input', () => { get().title = title.value; get().at = Date.now(); save(); });
  const tags = el('div', { class: 'row wrap', role: 'group', 'aria-label': 'What this story shows' }, D.behC.map(([c, t]) => { const b = el('button', { class: 'btn sm lptag', 'aria-pressed': String((get().tags || []).includes(c)), onclick: () => { const s = get(), on = (s.tags || []).includes(c); s.tags = on ? s.tags.filter(x => x !== c) : (s.tags || []).concat(c); s.at = Date.now(); save(); b.setAttribute('aria-pressed', String(!on)); } }, t); return b; }));
  pw();
  return el('section', { class: 'card pad stack lpedit' }, [el('div', { class: 'row' }, [el('button', { class: 'btn sm', onclick: done }, '‹ All stories'), el('span', { class: 'grow' }),
    el('button', { class: 'btn sm', onclick: async () => { const v = await confirmBox('Delete this story?', 'It is removed on every device.', [{ t: 'Delete', cls: 'pri', v: 1 }, { t: 'Keep it', v: 0 }]); if (v) { L.stories[id] = { del: 1, at: Date.now() }; save(); done(); } } }, 'Delete')]),
    title, el('span', { class: 'lbl', text: 'What it shows' }), tags]
    .concat(D.star.map(([k, t, h]) => loopField(get, k, t, h, k === 'a' ? 4 : 2, pw)), [el('div', { class: 'row wrap' }, [loopTimer(120), el('span', { class: 'grow' }), meta])]));
}
function loopR5Practice(D) {
  const L = loopState();
  return loopStepper(D.beh, 'beh', q => { const fit = Object.entries(L.stories).filter(([, s]) => s && !s.del && (s.tags || []).some(t => q.tags.includes(t)));
    const ex = el('div', { class: 'stack', style: { gap: '6px' } }, [el('span', { class: 'muted', style: { fontSize: '14px' }, text: fit.length ? 'Stories that fit (tap to read):' : 'No story is tagged for this yet. Answer anyway, then save it as a story in My stories.' })].concat(fit.map(([, s]) =>
      el('details', { class: 'lpfit' }, [el('summary', { text: s.title || 'Untitled story' }), el('div', { class: 'stack', style: { gap: '4px', marginTop: '6px' } }, D.star.map(([k, t]) => s[k] ? el('p', { style: { margin: 0 } }, [el('b', { text: t + ': ' }), s[k]]) : null))]))));
    return el('div', { class: 'stack' }, [el('div', { class: 'row wrap' }, q.tags.map(t => el('span', { class: 'chip c-test', text: (D.behC.find(x => x[0] === t) || [, t])[1] }))), loopAnswer('r5:' + q.id, q.q, { tip: 'Situation, Task, Action, Result. Mostly Action; end with a number and what you learned.', extra: ex, checks: LOOP_CHECKS.r5 })]); });
}

/* round 6: project deep dive, follow-ups and leadership questions */
function loopProject(D) {
  const L = loopState(), meter = el('span', { class: 'muted' });
  const pw = () => { meter.textContent = D.proj.filter(([k]) => loopWords(L.proj[k]) >= 3).length + ' of ' + D.proj.length + ' parts written'; };
  const draw = el('button', { class: 'btn sm', onclick: () => { const st = simState(), P = loopState().proj; let d = P.simId && st.d[P.simId] && !st.d[P.simId].del ? st.d[P.simId] : null;
    if (!d) { d = simNewFrom('', (P.name || 'My project').slice(0, 58), '#/loop/r6/project'); P.simId = d.id; P.at = Date.now(); } st.cur = d.id; save(); location.hash = '#/sim'; } }, L.proj.simId ? 'Open my drawing in the simulator' : 'Draw it in the simulator');
  pw();
  return el('div', { class: 'stack' }, [el('section', { class: 'card pad stack' }, [el('span', { class: 'muted', text: 'One project from your resume that you know end to end. Interviewers dig into why you designed it that way, what you rejected and what you would change. It saves as you type.' }), el('div', { class: 'row wrap' }, [draw, el('span', { class: 'grow' }), meter])]),
    el('section', { class: 'card pad stack' }, D.proj.map(([k, t, h, rows]) => loopField(() => loopState().proj, k, t, h, rows, pw))),
    el('a', { class: 'btn pri', href: '#/loop/r6/practice', style: { alignSelf: 'flex-start' }, text: 'Practise the follow-up questions' })]);
}
function loopR6Practice(D) {
  const L = loopState(), wrap = el('div', { class: 'stack' });
  const paint = () => { wrap.textContent = '';
    const seg = el('div', { class: 'seg', role: 'tablist', 'aria-label': 'Question set' }, [['follow', 'Project follow-ups'], ['lead', 'Leadership']].map(([k, t]) => el('button', { role: 'tab', 'aria-selected': String(loopFollow === k), onclick: () => { loopFollow = k; paint(); } }, t)));
    const P = L.proj, ctx = P.name || P.arch ? el('details', { class: 'lpfit' }, [el('summary', { text: 'My project: ' + (P.name || 'untitled') }), el('div', { class: 'stack', style: { gap: '4px', marginTop: '6px' } }, D.proj.filter(([k]) => P[k]).map(([k, t]) => el('p', { style: { margin: 0 } }, [el('b', { text: t + ': ' }), P[k]])))]) : el('a', { href: '#/loop/r6/project', text: 'Write your project first: answers are easier with it in front of you.' });
    wrap.append(seg, loopFollow === 'follow' ? loopStepper(D.follow, 'follow', (q, i) => loopAnswer('r6:f' + i, q, { extra: ctx, tip: 'Answer about your project: the decision, the alternative, the numbers.', checks: LOOP_CHECKS.r6 }))
      : loopStepper(D.lead, 'lead', q => loopAnswer('r6:' + q.id, q.q, { tip: 'A real example in STAR form: what you did, how others came along, the result.', checks: LOOP_CHECKS.r5 }))); };
  paint(); return wrap;
}

/* round 7: SQL against the clock, using the Hard problems of the SQL bank */
function loopHard() { return (DATA.sql || []).filter(x => x.lv === 'Hard'); }
function loopSqlStart(id) { const L = loopState(); L.sqlCur = { id, t0: Date.now() }; loopRep('r7'); save(); location.hash = '#/sql/' + id; }
/* called when a SQL problem is solved (js/app.js): records the time if it is the timed one */
function loopSolved(id) {
  const L = S.loop, c = L && L.sqlCur; if (!c || c.id !== id || c.done) return;
  const secs = Math.round((Date.now() - c.t0) / 1000), r = L.sql[id] = Object.assign({}, L.sql[id]);
  r.secs = r.secs ? Math.min(r.secs, secs) : secs; r.last = secs; r.at = Date.now(); c.done = secs;
  toast('Solved in ' + loopClock(secs) + (secs <= LOOP_SQL_SECS ? ', inside the 15 minutes.' : '. Over 15 minutes: try it again in a week.'));
}
/* the clock on the SQL problem page while it is the timed one */
function loopBanner(id) {
  const c = S.loop && S.loop.sqlCur; if (!c || c.id !== id || c.done) return null;
  const t = el('b', { class: 'mono' }), b = el('div', { class: 'hint row wrap lpsqlbar' }, [el('span', { text: 'Timed SQL round · ' }), t, el('span', { class: 'grow' }), el('a', { href: '#/loop/r7/timed', text: 'Back to the round' })]);
  const tick = () => { const left = LOOP_SQL_SECS - Math.round((Date.now() - c.t0) / 1000); t.textContent = (left < 0 ? 'over by ' : '') + loopClock(Math.abs(left)) + (left < 0 ? '' : ' left'); b.classList.toggle('over', left < 0); if (c.done) b.remove(); };
  const iv = setInterval(tick, 1000); cleanup.push(() => clearInterval(iv)); tick(); return b;
}
function loopSqlRound(D) {
  const L = loopState(), hard = loopHard(), c = L.sqlCur, cur = c && !c.done && hard.find(x => x.id === c.id);
  const nextQ = hard.find(x => !(L.sql[x.id] || {}).secs) || hard[0];
  const done = hard.filter(x => (L.sql[x.id] || {}).secs);
  return el('div', { class: 'stack' }, [el('section', { class: 'card pad stack' }, [el('span', { class: 'muted', text: '15 minutes a problem, the pace of a live SQL round. The clock runs on the problem page; say the output grain before you type. ' + done.length + ' of ' + hard.length + ' done against the clock.' }),
    cur ? el('div', { class: 'row wrap' }, [el('b', { class: 'grow', text: 'Running: ' + cur.t }), el('a', { class: 'btn pri sm', href: '#/sql/' + cur.id, text: 'Back to it' })])
      : nextQ ? el('button', { class: 'btn pri', style: { alignSelf: 'flex-start' }, onclick: () => loopSqlStart(nextQ.id) }, 'Start the clock: ' + nextQ.t) : null]),
    el('div', { class: 'stack', style: { gap: '6px' } }, hard.map(x => { const r = L.sql[x.id] || {}; return el('button', { class: 'simsc lpstory', 'data-sql': x.id, onclick: () => loopSqlStart(x.id) }, [el('span', { class: 'grow' }, [el('b', { text: (S.solved[x.id] ? '✓ ' : '') + x.t }), el('small', { text: (x.k === 'O' ? 'Optimise' : 'Write') + (x.m ? ' · ' + modLabel(x.m) : '') + (r.secs ? ' · best ' + loopClock(r.secs) : '') })]), el('span', { class: 'chip ' + (r.secs && r.secs <= LOOP_SQL_SECS ? 'c-dsa' : 'c-arch'), text: r.secs ? loopClock(r.secs) : 'Start' })]); }))]);
}
function loopSqlPat(D) {
  return el('div', { class: 'stack' }, [el('span', { class: 'muted', text: 'Eight patterns cover most live SQL questions. Read one, close it, write it from memory.' })].concat(D.sqlPat.map(([t, d, q]) => el('details', { class: 'card pad lptopic' }, [el('summary', {}, [el('b', { text: t })]), el('div', { class: 'stack', style: { marginTop: '8px' } }, [el('span', { class: 'muted', text: d }), loopCode(q)])]))));
}

/* rounds 8 and 9: one prompt answered part by part, then the model answer under each part and a rubric */
function loopCases(D, R) {
  const L = loopState(), set = R.id === 'r8' ? D.model : D.metrics, parts = LOOP_PARTS[R.id];
  return loopStepper(set, 'case' + R.id, c => {
    const get = () => (L.cases[c.id] = L.cases[c.id] || {}), box = el('div', { class: 'stack' });
    const paint = () => { box.textContent = ''; const shown = !!(L.cases[c.id] || {}).shown;
      box.append(el('section', { class: 'card pad stack lpcase', 'data-case': c.id }, [el('div', { class: 'row wrap' }, [el('span', { class: 'chip c-arch', text: c.co }), el('a', { class: 'muted', href: '#/learn/' + c.mid + '/chapter', style: { fontSize: '14px' }, text: 'Module ' + modLabel(c.mid) }), el('span', { class: 'grow' }), loopTimer(R.id === 'r8' ? 2100 : 1800)]),
        el('b', { class: 'lpq', text: c.t }), el('p', { style: { margin: 0, fontSize: '16.5px' }, text: c.q }), el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'Answer each part as you would at the whiteboard, then compare. It saves as you type.' })]));
      parts.forEach(([k, t]) => box.append(el('section', { class: 'card pad stack' }, [loopField(get, k, t, '', k === 'ask' || k === 'goal' ? 2 : 3), shown ? el('div', { class: 'why lpmodel' }, [el('b', { text: 'Model answer: ' }), el('span', { text: c.a[k] })]) : null])));
      if (!shown) box.append(el('button', { class: 'btn pri', style: { alignSelf: 'flex-start' }, onclick: () => { Object.assign(get(), { shown: 1, at: Date.now() }); loopRep(R.id); save(); paint(); } }, 'Compare with the model answer'));
      else box.append(el('section', { class: 'card pad stack' }, [el('b', { text: 'Rubric: tick what your answer did' }), loopChecks(R.id + ':' + c.id, c.rubric),
        typeof gradeBox === 'function' ? gradeBox({ kind: 'answer', key: 'loop:' + R.id + ':' + c.id, title: c.t, label: 'Grade my answer', text: () => parts.map(([k, t]) => t + ': ' + (get()[k] || '')).join('\n'), payload: () => ({ question: c.q, model_answer: parts.map(([k, t]) => t + ': ' + c.a[k]).join('\n'), answer: parts.map(([k, t]) => t + ': ' + (get()[k] || '')).join('\n') }) }) : null]));
      if (R.id === 'r8') { const sq = (DATA.sql || []).filter(x => /^m0[1-3]$/.test(x.m || '')).slice(0, 6); if (sq.length) box.append(el('section', { class: 'card pad stack' }, [el('b', { text: 'SQL on a model like this' }), el('div', { class: 'stack', style: { gap: '6px' } }, sq.map(x => el('a', { class: 'simsc', href: '#/sql/' + x.id }, [el('span', { class: 'grow' }, [el('b', { text: (S.solved[x.id] ? '✓ ' : '') + x.t }), el('small', { text: x.lv + ' · ' + modLabel(x.m) })])])))])); }
    };
    paint(); return box;
  });
}
