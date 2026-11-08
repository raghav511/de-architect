/* Data Architect · live mock interview (#/live/DATE). One question per screen, answered by voice or typing.
   Built from the week's modules: concept, under the hood, architect's lens, one staff-level slot that rotates by
   weekday (data/staff.json), and recall from an earlier week. Weekends: a 35-minute, 7-question round in one company's style.
   An AI interviewer (Claude Code on the Mac) asks a follow-up and scores each answer on a rubric;
   with AI off you mark yourself against the model answer. State: S.live[date]. Loaded before app.js. */
'use strict';
const LIVE_LEN = { wd: [20, 4], we: [35, 5], one: [5, 5] }; /* minutes, minutes per question; one: a weekday's single question (F9) */
const LIVE_ROT = { 1: 'scale', 2: 'page', 3: 'defend', 4: 'metric', 5: 'lead' }; /* Monday to Friday staff slot */
const LIVE_WE = ['org', 'migrate', 'cost', 'estimate', 'deep'];
const LIVE_DIMS = [['correct', 'Correctness'], ['depth', 'Depth, internals'], ['trade', 'Trade-offs'], ['clear', 'Structure, clarity']];
const LIVE_CHECKS = [['rejected', 'Named what you rejected'], ['limits', 'Said where it stops scaling'], ['operate', 'Said how you would run it']];
const LIVE_STYLES = ['Uber', 'Meta', 'Google', 'Salesforce'];

/* F9: Monday to Friday one question, Saturday the full 5-question mock, Sunday the 7-question boss round (liveMode in js/dayset.js) */
function liveWeekend(k) { return new Date(k + 'T00:00:00').getDay() === 0; }
/* the main-path modules planned in the week of day k (Monday to Sunday), plus the current one */
function liveWeekMods(k) {
  const sc = schedule(), d0 = new Date(k + 'T00:00:00'); d0.setDate(d0.getDate() - ((d0.getDay() + 6) % 7));
  const set = new Set([sc.cur]);
  for (let i = 0; i < 7; i++) { const d = new Date(d0); d.setDate(d0.getDate() + i); (sc.byDay[iso(d)] || []).forEach(u => { if (!isCC(u.mid)) set.add(u.mid); }); }
  return MODS.filter(m => set.has(m));
}
function liveRand(k) {
  let h = 2166136261; for (const ch of 'live' + k) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const r = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  return { pick: a => a.length ? a[Math.floor(r() * a.length)] : null, shuffle: a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; } };
}
/* "**N. question**" followed by a <details> model answer: the Under the hood blocks and the explain-it warm-ups */
function liveDeep(text) {
  const out = [], rx = /\*\*\d+\.\s+([^*]+?)\*\*\s*\n<details><summary>[^<]*<\/summary>\s*([\s\S]*?)<\/details>/g; let x;
  while ((x = rx.exec(text || ''))) out.push({ q: x[1].trim(), model: x[2].trim() });
  return out;
}
async function liveQuestions(k) {
  const week = liveWeekMods(k), cur = week.includes(curMid()) ? curMid() : week[0], R = liveRand(k), we = liveWeekend(k);
  const iv = [], deep = [], early = [];
  for (const m of week) { const s = await sprint(m).catch(() => null); if (!s) continue;
    s.interview.forEach(q => iv.push({ q: q.Q, model: q.A || '', tag: q.TAG || 'core', m }));
    const ch = s.raw.chapter || '', at = ch.indexOf('### Under the hood');
    liveDeep(at >= 0 ? ch.slice(at) : '').forEach(x => deep.push(Object.assign(x, { m })));
    liveDeep(s.raw.practice).filter(x => /^(why|how)\b/i.test(x.q)).forEach(x => deep.push(Object.assign(x, { m }))); }
  /* early in the program a week may have few interview questions: borrow from the next modules, as the written mock does */
  for (let j = MODS.indexOf(week[week.length - 1]) + 1; j < MODS.length && iv.length < 6; j++) { if (isCC(MODS[j])) continue; const s = await sprint(MODS[j]).catch(() => null); if (s) s.interview.forEach(q => iv.push({ q: q.Q, model: q.A || '', tag: q.TAG || 'core', m: MODS[j] })); }
  const first = MODS.indexOf(week[0]);
  for (const m of MODS.slice(0, Math.max(0, first)).filter(x => !isCC(x))) { const s = await sprint(m).catch(() => null); if (s) s.interview.forEach(q => early.push({ q: q.Q, model: q.A || '', tag: q.TAG || 'core', m })); }
  const staff = ((DATA.staff || {}).items || []), used = new Set();
  const take = x => { if (x) used.add(x.q); return x; }, free = a => a.filter(x => !used.has(x.q));
  const staffFor = kind => { const ok = staff.filter(s => s.kind === kind && !used.has(s.q)); return take(R.pick(ok.filter(s => s.mids.some(m => week.includes(m)))) || R.pick(ok.filter(s => s.mids.includes('*'))) || R.pick(ok)); };
  const S2 = (slot, label, x, src) => x && { slot, label, q: x.q, model: x.model || '', points: x.points || [], m: x.m || cur, src };
  const curFirst = a => R.shuffle(a.filter(x => x.m === cur)).concat(R.shuffle(a.filter(x => x.m !== cur)));
  const concept = () => take(curFirst(free(iv.filter(x => x.tag !== 'arch')))[0]);
  const qs = [];
  qs.push(S2('concept', 'Concept', concept(), 'interview set'));
  if (!we) qs.push(S2('deep', 'Under the hood', take(curFirst(free(deep))[0]) || concept(), 'under the hood'));
  if (we) LIVE_WE.forEach(kind => { const s = staffFor(kind); qs.push(s && S2(kind, DATA.staff.kinds[kind], s, 'staff-level bank')); });
  else {
    const lens = take(curFirst(free(iv.filter(x => x.tag === 'arch')))[0]) || staffFor('defend');
    qs.push(S2('lens', 'Architect\'s lens', lens, lens && lens.points ? 'staff-level bank' : 'interview set'));
    const kind = LIVE_ROT[new Date(k + 'T00:00:00').getDay()], s = staffFor(kind);
    qs.push(s && S2(kind, DATA.staff.kinds[kind], s, 'staff-level bank'));
  }
  const rec = take(R.pick(free(early))) || concept();
  qs.push(S2('recall', 'Recall', rec, rec && early.includes(rec) ? 'earlier week · ' + modLabel(rec.m) : 'interview set'));
  let list = qs.filter(Boolean);
  /* weak or skipped answers from the last live mock on this module open today's, at most two */
  const prev = Object.keys(S.live || {}).filter(d => d < k).sort().reverse().map(d => [d, S.live[d]]).find(([, x]) => x && x.mod === cur && x.done && !x.carriedTo);
  if (prev) { const weak = prev[1].qs.map((q, i) => [q, (prev[1].ans || {})[i] || {}]).filter(([q, a]) => a.skipped || liveAvg(a) < 2.5).slice(0, 2).map(([q]) => Object.assign({}, q, { carried: prev[0] }));
    if (weak.length) { prev[1].carriedTo = k; list = weak.concat(list.filter(x => !weak.some(w => w.q === x.q))).slice(0, list.length); } }
  return { qs: list, week, mod: cur };
}
/* who scored an answer (review 5): 'ai' (API key or the Mac grader), 'self' (AI off, or the AI reply could not be read), 'skip';
   answers saved before this field existed are 'self' when marked by hand, else AI */
function liveBy(a) { return !a ? '' : a.skipped ? 'skip' : a.by || (a.self ? 'self' : a.sc ? 'ai' : ''); }
function liveAvg(a) { const s = a && a.sc; if (!s) return NaN; const v = LIVE_DIMS.map(d => +s[d[0]] || 0); return Math.max(1, v.reduce((x, y) => x + y, 0) / v.length - 0.25 * (+a.simHints || 0)); } /* simulator suggestions opened while sketching cost 0.25 each */
function liveRouteName() { return !aiOn() ? 'you' : 'mac'; }

/* one AI turn; returns the reply text or throws */
async function liveAsk(system, user) {
  const r = await macCall('chat', { page: 'Live mock interview (' + new Date().toDateString() + ')', problem: '', code: '', question: system + '\n\n' + user, history: [] });
  if (!r || !r.text) throw new Error('No answer came back from your Mac.');
  return r.text;
}
function liveJSON(t) { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b <= a) return null; try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; } }
function liveSystem(m) {
  return 'You are a ' + (m.style ? m.style + '-style ' : '') + 'interviewer running a live mock interview for a ' + (m.level === 'staff' ? 'staff or architect' : 'senior') + ' data engineer role. Be direct and fair, like a real interviewer at that level. Plain language. Reply with JSON only.';
}
async function liveFollowup(m, q, a) {
  const t = await liveAsk(liveSystem(m), 'Question: ' + q.q + '\nWhat a strong answer covers: ' + (q.points.length ? q.points.join('; ') : q.model.slice(0, 900)) + '\nCandidate answer: ' + a + '\n\nAsk ONE follow-up question (at most 30 words) that probes the weakest part: why, when not, internals, scale limits, failure or cost. JSON: {"followup": "..."}');
  const j = liveJSON(t); return j && j.followup ? String(j.followup) : '';
}
async function liveScore(m, q, x) {
  const t = await liveAsk(liveSystem(m), 'Question: ' + q.q + '\nWhat a strong answer covers: ' + (q.points.length ? q.points.join('; ') : q.model.slice(0, 1200)) + '\nCandidate answer: ' + (x.a || '(no answer)') + (x.fu ? '\nFollow-up: ' + x.fu + '\nCandidate answer to the follow-up: ' + (x.fa || '(no answer)') : '') +
    '\n\nScore 1 to 4 (1 weak, 2 below the bar, 3 at the bar, 4 strong) at the ' + m.level + ' level on: correct (correctness), depth (internals and why), trade (trade-offs and alternatives), clear (structure and clarity). Also say whether the candidate named an alternative they rejected (rejected), said where the design stops scaling (limits), and said how they would run it in production: alerts, on-call, cost (operate). JSON: {"scores":{"correct":n,"depth":n,"trade":n,"clear":n},"rejected":bool,"limits":bool,"operate":bool,"feedback":"at most 60 words, the one thing to fix first","better":"a stronger answer in at most 120 words"}');
  const j = liveJSON(t); if (!j || !j.scores) throw new Error('The interviewer\'s scores could not be read.');
  /* QA fix 12: a reply missing a score is unreadable (you mark yourself), never a silent 1 of 4 */
  if (LIVE_DIMS.some(([d]) => !(+j.scores[d] >= 1 && +j.scores[d] <= 4))) throw new Error('The interviewer\'s scores were incomplete.');
  const c = v => Math.max(1, Math.min(4, Math.round(+v)));
  return { sc: { correct: c(j.scores.correct), depth: c(j.scores.depth), trade: c(j.scores.trade), clear: c(j.scores.clear) }, checks: { rejected: !!j.rejected, limits: !!j.limits, operate: !!j.operate }, fb: String(j.feedback || ''), better: String(j.better || '') };
}
function liveHire(avg, m) {
  const ch = liveCheckRate(m), staff = m.level === 'staff';
  let i = avg >= 3.4 ? 3 : avg >= 2.9 ? 2 : avg >= 2.4 ? 1 : 0; if (staff && ch < .5 && i > 0) i--;
  return ['No hire', 'Lean no hire', 'Hire', 'Strong hire'][i] + ' at ' + (staff ? 'staff' : 'senior');
}
function liveCheckRate(m) { const a = Object.values(m.ans || {}).filter(x => x.checks); return a.length ? a.reduce((s, x) => s + LIVE_CHECKS.filter(c => x.checks[c[0]]).length, 0) / (a.length * LIVE_CHECKS.length) : 0; }

/* speech to text where the browser has it (Chrome, Safari); appends final words to the text box */
function liveMic(ta, onText) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  let rec = null, on = false;
  const b = el('button', { class: 'btn', 'aria-pressed': 'false', 'aria-label': 'Speak your answer' }, [svg('<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', 18), el('span', { text: 'Speak' })]);
  const stop = () => { on = false; b.setAttribute('aria-pressed', 'false'); b.lastChild.textContent = 'Speak'; b.classList.remove('rec'); try { rec && rec.stop(); } catch (e) { } };
  b.onclick = () => {
    if (on) return stop();
    rec = new SR(); rec.continuous = true; rec.interimResults = false; rec.lang = navigator.language || 'en-US';
    rec.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { ta.value = (ta.value ? ta.value.replace(/\s*$/, ' ') : '') + e.results[i][0].transcript.trim(); onText(); } };
    rec.onerror = e => { stop(); if (e.error === 'not-allowed') toast('Microphone access is blocked for this site. Allow it in the browser settings, or type your answer.'); };
    rec.onend = () => { if (on) { try { rec.start(); } catch (e) { stop(); } } };
    try { rec.start(); on = true; b.setAttribute('aria-pressed', 'true'); b.lastChild.textContent = 'Stop'; b.classList.add('rec'); } catch (e) { toast('Speech input could not start. Type your answer instead.'); }
  };
  cleanup.push(stop);
  return { b, stop };
}

async function vLive(k) {
  const today = iso(new Date());
  k = /^\d{4}-\d\d-\d\d$/.test(k || '') ? k : today;
  S.live = S.live || {};
  shell('Live mock', shortDate(k), [el('p', { class: 'muted', text: 'Preparing your questions…' })], { back: '#/today' });
  let m = S.live[k];
  if (!m) {
    if (k !== today) { $('#page').textContent = ''; $('#page').appendChild(el('section', { class: 'card pad stack' }, [el('p', { style: { margin: 0 }, text: 'There was no live mock on this day.' }), el('a', { href: '#/live', text: 'Go to today\'s live mock' })])); return; }
    const we = liveWeekend(k), r = await liveQuestions(k), one = !we && typeof liveMode === 'function' && liveMode(k) === 'one', kd = we ? 'we' : one ? 'one' : 'wd';
    /* a weekday's one question: a carried weak answer first, else the slot of the day (Mon concept, Tue under the hood, Wed lens, Thu staff, Fri recall) */
    if (one) { const g = new Date(k + 'T00:00:00').getDay(), slot = ['concept', 'deep', 'lens', LIVE_ROT[g], 'recall'][g - 1]; r.qs = [r.qs.find(x => x.carried) || r.qs.find(x => x.slot === slot) || r.qs[Math.min(g - 1, r.qs.length - 1)]].filter(Boolean); }
    m = S.live[k] = { kind: kd, mins: LIVE_LEN[kd][0], per: LIVE_LEN[kd][1], level: S.settings.liveLevel || 'staff', style: we ? LIVE_STYLES[Math.floor(new Date(k + 'T00:00:00').getTime() / 864e5 / 7) % LIVE_STYLES.length] : '', week: r.week, mod: r.mod, qs: r.qs, ans: {}, i: -1, t: Date.now() };
    save();
  }
  const page = $('#page'); page.textContent = '';
  if (m.done || m.i >= m.qs.length) return liveCard(page, k, m);
  if (m.i < 0) return liveStart(page, k, m);
  liveQuestion(page, k, m);
}

function liveStart(page, k, m) {
  const via = liveRouteName();
  const lv = el('div', { class: 'tabs', role: 'radiogroup', 'aria-label': 'Level' }, [['senior', 'Senior'], ['staff', 'Staff']].map(([v, t]) => el('button', { role: 'radio', 'aria-checked': String(m.level === v), 'aria-selected': String(m.level === v), onclick: () => { m.level = v; S.settings.liveLevel = v; save(); route(); }, text: t })));
  page.appendChild(el('section', { class: 'card pad stack live' }, [
    el('div', { class: 'row wrap' }, [el('h2', { class: 'grow', text: 'Live mock · ' + new Date(k + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' }) }), el('b', { text: m.mins + ' min' })]),
    el('span', { class: 'muted', text: 'Built from this week: ' + m.week.map(x => modLabel(x)).join(', ') + (m.style ? ' · ' + m.style + '-style round' : '') }),
    el('ol', { class: 'lslots' }, m.qs.map(q => el('li', {}, [el('b', { text: q.label }), q.carried ? el('span', { class: 'chip c-ai', text: 'from ' + shortDate(q.carried) }) : null, el('span', { class: 'muted', text: ' · ' + q.q.replace(/\*\*|`/g, '').slice(0, 70) + (q.q.length > 70 ? '…' : '') })]))),
    el('div', { class: 'row wrap' }, [el('span', { class: 'lbl', text: 'Level' }), lv]),
    el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: via === 'mac' ? 'Follow-ups and scores come from Claude Code on your Mac (it must be awake).' : 'AI features are off: after each answer you compare with the model answer and mark yourself. Self-marked rounds count for practice and XP; promotions past Senior on the ladder need AI scoring.' }),
    el('button', { class: 'btn pri', onclick: () => { m.i = 0; m.started = Date.now(); save(); route(); } }, 'Start'),
    el('a', { href: '#/mock/' + k, class: 'muted tlink', style: { fontSize: '14px' }, text: 'Prefer writing long answers? Take the written mock instead' })]));
}

function liveQuestion(page, k, m) {
  const i = m.i, q = m.qs[i], x = m.ans[i] = m.ans[i] || {}, via = liveRouteName();
  x.secs = x.secs || 0;
  const clock = el('b', { class: 'mono' }), paint = () => { const left = m.per * 60 - x.secs; clock.textContent = (left < 0 ? '+' : '') + Math.floor(Math.abs(left) / 60) + ':' + String(Math.abs(left) % 60).padStart(2, '0'); clock.style.color = left < 0 ? 'var(--red-d)' : ''; };
  let stage = x.sc ? 'scored' : x.fu !== undefined && x.fu !== '' ? 'followup' : x.self ? 'self' : 'answer';
  const tick = setInterval(() => { if (document.visibilityState === 'visible' && (stage === 'answer' || stage === 'followup')) { x.secs++; if (x.secs % 10 === 0) save(false); paint(); } }, 1000);
  cleanup.push(() => { clearInterval(tick); save(false); }); paint();
  const box = (key, label) => { const ta = el('textarea', { class: 'code', 'aria-label': label, placeholder: 'Speak or type your answer', style: { minHeight: '130px', border: '1px solid var(--line2)', borderRadius: '10px', fontFamily: 'var(--body)', fontSize: '16px' } }); ta.value = x[key] || ''; const on = () => { x[key] = ta.value; save(); }; ta.addEventListener('input', on); const mic = liveMic(ta, on); return { ta, mic }; };
  const body = el('div', { class: 'stack' }), note = el('div', { role: 'status', class: 'muted', style: { fontSize: '14px' } });
  page.appendChild(el('section', { class: 'card pad stack live' }, [
    el('div', { class: 'row wrap' }, [el('span', { class: 'lbl grow', text: (i + 1) + ' of ' + m.qs.length + ' · ' + q.label }), q.carried ? el('span', { class: 'chip c-ai', text: 'from ' + shortDate(q.carried) }) : null, clock]),
    el('div', { class: 'lq', html: mdi(q.q) }), typeof simSketch === 'function' && /design|scale|architect|pipeline|system|throughput|latency|estimate|migrat|stream|kafka|outage|page|fail|cost|serv/i.test(q.q + ' ' + q.label) ? el('div', { class: 'row wrap' }, [simSketch(q.q, null, { k, i }), x.simHints ? el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: 'Simulator suggestions viewed: ' + x.simHints + ' (−0.25 each on this answer)' }) : null]) : null, body, note]));
  const next = () => { m.i = i + 1; if (m.i >= m.qs.length) { m.done = Date.now(); gameNote('live'); if (typeof confetti === 'function' && m.kind === 'we') confetti(); } save(); route(); };
  const showScored = () => {
    body.textContent = ''; const av = liveAvg(x);
    if (x.a) body.appendChild(el('div', { class: 'lyou' }, [el('b', { text: 'You: ' }), x.a]));
    if (x.fu) body.appendChild(el('div', { class: 'lfu' }, [el('b', { text: 'Follow-up: ' }), x.fu, x.fa ? el('div', { class: 'muted', text: 'You: ' + x.fa }) : null]));
    body.appendChild(el('div', { class: 'lscore' }, LIVE_DIMS.map(([d, t]) => el('div', { class: 'row' }, [el('span', { class: 'grow', text: t }), el('b', { text: (x.sc[d] || '–') + ' / 4' })]))));
    if (x.fb) body.appendChild(el('div', { class: 'why' }, [el('b', { text: 'Fix first: ' }), x.fb]));
    const model = x.better || (q.points.length ? q.points.map(p => '- ' + p).join('\n') : q.model);
    if (model) body.appendChild(el('details', {}, [el('summary', { style: { cursor: 'pointer', fontWeight: 600 }, text: x.better ? 'A stronger answer' : 'Model answer' }), mdEl(model)]));
    body.appendChild(el('button', { class: 'btn pri', onclick: next }, i + 1 < m.qs.length ? 'Next question' : 'See your scorecard'));
    note.textContent = isNaN(av) ? '' : 'Average ' + av.toFixed(1) + ' of 4' + (liveBy(x) === 'self' ? ' (marked by you)' : '') + (av < 2.5 ? ': this one opens your next mock on this module.' : '.');
  };
  const selfMark = () => {
    stage = 'self'; x.self = true; save(); body.textContent = '';
    body.appendChild(el('div', { class: 'why' }, [el('b', { text: 'Compare with the model answer, then mark yourself.' })]));
    body.appendChild(mdEl(q.points.length ? q.points.map(p => '- ' + p).join('\n') : (q.model || '_No model answer for this one: mark how sure you felt._')));
    const sc = x.scDraft = x.scDraft || {}, ck = x.ckDraft = x.ckDraft || {};
    LIVE_DIMS.forEach(([d, t]) => body.appendChild(el('div', { class: 'row wrap' }, [el('span', { class: 'grow', text: t }), el('div', { class: 'row', role: 'radiogroup', 'aria-label': t, style: { gap: '4px' } }, [1, 2, 3, 4].map(n => el('button', { class: 'btn sm', role: 'radio', 'aria-checked': String(sc[d] === n), onclick: e => { sc[d] = n; save(); e.target.parentNode.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(+b.textContent === n))); }, text: String(n) })))])));
    LIVE_CHECKS.forEach(([c, t]) => { const cb = el('input', { type: 'checkbox', id: 'lc' + c }); cb.checked = !!ck[c]; cb.onchange = () => { ck[c] = cb.checked; save(); }; body.appendChild(el('label', { class: 'row', for: 'lc' + c, style: { gap: '8px', minHeight: '36px' } }, [cb, t])); });
    body.appendChild(el('button', { class: 'btn pri', onclick: () => { if (LIVE_DIMS.some(([d]) => !sc[d])) { note.textContent = 'Mark all four before going on.'; return; } x.sc = Object.assign({}, sc); x.checks = Object.assign({}, ck); x.by = 'self'; stage = 'scored'; save(); showScored(); } }, 'Save my marks'));
  };
  const score = async () => {
    stage = 'scoring'; body.textContent = ''; note.textContent = ''; body.append(el('span', { class: 'spin' }), ' The interviewer is scoring your answer…');
    try { Object.assign(x, await liveScore(m, q, x), { by: 'ai' }); stage = 'scored'; save(); showScored(); }
    catch (e) { body.textContent = ''; note.textContent = String(e.message || e) + ' Marking it yourself instead.'; selfMark(); }
  };
  const followup = () => {
    stage = 'followup'; body.textContent = '';
    if (x.a) body.appendChild(el('div', { class: 'lyou' }, [el('b', { text: 'You: ' }), x.a]));
    body.appendChild(el('div', { class: 'lfu' }, [el('b', { text: 'Follow-up: ' }), x.fu]));
    const { ta, mic } = box('fa', 'Your answer to the follow-up');
    body.append(ta, el('div', { class: 'row wrap' }, [mic ? mic.b : null, el('span', { class: 'grow' }), el('button', { class: 'btn pri', onclick: () => { mic && mic.stop(); score(); } }, 'Done')]));
  };
  const answer = () => {
    stage = 'answer'; body.textContent = '';
    const { ta, mic } = box('a', 'Your answer');
    body.append(ta, el('div', { class: 'row wrap' }, [mic ? mic.b : el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: 'This browser has no speech input: type, or use the keyboard\'s dictation key.' }), el('span', { class: 'grow' }),
      el('button', { class: 'btn', onclick: () => { mic && mic.stop(); x.skipped = true; x.sc = { correct: 1, depth: 1, trade: 1, clear: 1 }; x.checks = {}; save(); next(); } }, 'Skip'),
      el('button', { class: 'btn pri', onclick: async () => {
        mic && mic.stop();
        if (!(ta.value || '').trim()) { note.textContent = 'Say or type an answer first, or tap Skip.'; return; }
        if (via === 'you') return selfMark();
        body.textContent = ''; body.append(el('span', { class: 'spin' }), ' The interviewer is thinking…');
        try { x.fu = await liveFollowup(m, q, x.a); save(); if (x.fu) followup(); else score(); }
        catch (e) { body.textContent = ''; note.textContent = String(e.message || e) + ' Marking it yourself instead.'; selfMark(); }
      } }, 'Done')]));
  };
  if (stage === 'scored') showScored(); else if (stage === 'self') selfMark(); else if (stage === 'followup') followup(); else answer();
}

function liveCard(page, k, m) {
  const done = m.qs.map((q, i) => [q, m.ans[i] || {}]), av = done.map(([, a]) => liveAvg(a)).filter(v => !isNaN(v));
  const all = av.length ? av.reduce((a, b) => a + b, 0) / av.length : 0;
  const dim = LIVE_DIMS.map(([d, t]) => { const v = done.map(([, a]) => a.sc && +a.sc[d]).filter(Boolean); return [t, v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0]; });
  const weakest = dim.slice().sort((a, b) => a[1] - b[1])[0], weak = done.filter(([, a]) => a.skipped || liveAvg(a) < 2.5).length;
  const checks = LIVE_CHECKS.map(([c, t]) => [t, done.filter(([, a]) => a.checks && a.checks[c]).length]);
  page.appendChild(el('section', { class: 'card pad stack live' }, [
    el('div', { class: 'row wrap' }, [el('h2', { class: 'grow', text: 'Scorecard · ' + shortDate(k) }), el('b', { text: all.toFixed(1) + ' of 4' })]),
    el('div', { class: 'lhire', text: liveHire(all, m) }),
    done.some(([, a]) => liveBy(a) === 'self') ? el('p', { class: 'muted lselfnote', style: { margin: 0, fontSize: '13px' }, text: (done.filter(([, a]) => liveBy(a) === 'self').length) + ' answer' + (done.filter(([, a]) => liveBy(a) === 'self').length === 1 ? ' was' : 's were') + ' marked by you. Self-marked rounds count for practice and XP, but promotions past Senior need a round scored by the AI interviewer.' }) : null,
    done.some(([, a]) => a.fb) ? el('p', { class: 'muted', style: { margin: 0, fontSize: '13px' }, text: 'Scored by an AI interviewer, which can be wrong. Check each answer against the model answer below before you trust a score.' }) : null, /* QA fix 13 */
    el('div', { class: 'lscore' }, dim.map(([t, v]) => el('div', { class: 'row' }, [el('span', { class: 'grow', text: t }), el('b', { text: v ? v.toFixed(1) : '–' })]))),
    el('div', { class: 'lscore' }, checks.map(([t, n]) => el('div', { class: 'row' }, [el('span', { class: 'grow', text: t }), el('b', { text: n + ' of ' + m.qs.length })]))),
    weakest && weakest[1] ? el('div', { class: 'why' }, [el('b', { text: 'Weakest: ' }), weakest[0].toLowerCase() + '. ', weak ? weak + (weak === 1 ? ' answer opens' : ' answers open') + ' your next live mock on this module.' : 'Nothing carries over.']) : null,
    el('div', { class: 'list' }, done.map(([q, a], i) => el('details', { class: 'item', style: { display: 'block' } }, [el('summary', { style: { cursor: 'pointer' } }, [el('b', { text: (i + 1) + '. ' + q.label }), el('span', { class: 'muted', text: ' · ' + (a.skipped ? 'skipped' : isNaN(liveAvg(a)) ? '–' : liveAvg(a).toFixed(1) + ' of 4' + (liveBy(a) === 'self' ? ' · self' : '')) })]),
      el('div', { class: 'stack', style: { gap: '6px', marginTop: '6px' } }, [el('div', { html: mdi(q.q) }), a.a ? el('div', { class: 'lyou', text: 'You: ' + a.a }) : null, a.fb ? el('div', { class: 'why', text: a.fb }) : null, (a.better || q.points.length || q.model) ? mdEl(a.better || (q.points.length ? q.points.map(p => '- ' + p).join('\n') : q.model)) : null])]))),
    el('a', { class: 'btn pri', href: '#/today', text: 'Back to Today' })]));
}
