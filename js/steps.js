/* Data Architect · integrated week steps (feedback F7, pilot on s05). A module's @@steps block holds up to five short
   steps (10 minutes at most) that run in its week, just before the quiz: Design it (a simulator challenge), Read and fix
   (a bug-fix exercise with real tests), Run it on the platform (cloud, Kubernetes and cost, with one check), Lead it
   (an R01-style question with a model answer) and With AI (how LLM tooling applies, plus a Claude Code task that takes
   that week's Claude Code slot). Each is a plan step (uid m:st.KIND) with its block text as fingerprint, so the update
   tracker covers edits; nothing is marked done for the learner except by the work itself (a passed challenge, passing
   tests, a right check, a grade of 4+). Work in S.steps[uid], merged per entry (newer at). Loaded before app.js. */
'use strict';
const STEP_KEYS = ['STEP', 'TITLE', 'MIN', 'SIM', 'BODY', 'SPEC', 'CODE', 'FIX', 'BUG', 'TESTS', 'CHECK', 'Q', 'A', 'TASK', 'RUBRIC'];
const STEP_KIND = { design: 'design', fix: 'build', platform: 'learn', lead: 'talk', ai: 'ai' }; /* plan kinds: chip and XP */
const STEP_NAME = { design: 'Design it', fix: 'Read and fix', platform: 'Run it on the platform', lead: 'Lead it', ai: 'With AI' };
const STEP_CACHE = {};
function stepJSON(t, d) { try { return JSON.parse(t); } catch (e) { return d; } }
function stepCode(t) { return String(t || '').replace(/^```\w*\n?/, '').replace(/\n?```$/, ''); }
/* the parsed steps of a module, in file order */
function stepList(m) {
  const s = DATA.sprints[m], raw = s && s.raw.steps; if (!raw) return [];
  if (STEP_CACHE[m] && STEP_CACHE[m].raw === raw) return STEP_CACHE[m].list;
  const list = blocks(raw, STEP_KEYS, false).filter(x => STEP_NAME[x.STEP]).map(x => Object.assign(x, {
    uid: m + ':st.' + x.STEP, mins: Math.min(10, +x.MIN || 10), sims: (x.SIM || '').split(',').map(v => v.trim()).filter(Boolean),
    tests: stepJSON(x.TESTS, []), check: stepJSON(x.CHECK, null), code: stepCode(x.CODE), fixed: stepCode(x.FIX),
    src: STEP_KEYS.map(k => x[k] || '').join('|') }));
  STEP_CACHE[m] = { raw, list }; return list;
}
function stepState(uid) { S.steps = S.steps || {}; return S.steps[uid] = S.steps[uid] || {}; }
function stepPut(uid, o) { Object.assign(stepState(uid), o, { at: Date.now() }); save(); }
/* done by the work itself: a passed challenge, passing tests, the right check, a grade of 4 or 5 */
function stepAuto(m, x) {
  const r = (S.steps || {})[x.uid] || {}, g = (S.grades || {})['step:' + x.uid];
  if (x.STEP === 'design') return x.sims.length > 0 && !!((S.sim || {}).done || {})[x.sims[0]];
  if (x.STEP === 'fix') return !!r.fixed;
  if (x.STEP === 'platform') return !!x.check && r.pick === x.check.a;
  return !!(g && g.s === 'done' && g.r && g.r.score >= 4);
}
/* the plan steps for modUnits(), inserted before the module's quiz */
function stepUnits(m) {
  return stepList(m).map(x => ({ mid: m, uid: x.uid, kind: STEP_KIND[x.STEP], mins: x.mins, title: x.TITLE, src: x.src, step: x.STEP, ccSwap: x.STEP === 'ai',
    goal: (x.BODY || x.Q || '').split('\n')[0].replace(/\*\*/g, '').slice(0, 220), done: { design: 'The first challenge passes in the simulator.', fix: 'Your fix passes every test.', platform: 'You answered the check.', lead: 'You answered out loud, wrote the short version and compared it with the model answer.', ai: 'You ran the Claude Code task and checked its answer against the chapter.' }[x.STEP],
    href: '#/step/' + m + '/' + x.STEP, cta: 'Open', links: [], auto: () => stepAuto(m, x) }));
}
/* With AI takes the Claude Code slot of its week: when packing reaches it, scheduleNow() puts it at the head of the
   Claude Code queue (cq), so it fills the next Claude Code slot and the track's own steps follow one slot later */

async function vStep(m, kind) {
  m = midOf(m); shell('Week step', '', [el('p', { class: 'muted', text: 'Loading…' })], { back: '#/today' });
  try { await sprint(m); } catch (e) { return; }
  const list = stepList(m), x = list.find(s => s.STEP === kind) || list[0];
  if (!x) { location.replace('#/path/' + m); return; }
  const i = list.indexOf(x), nx = list[i + 1], u = schedule().units.find(v => v.uid === x.uid), r = stepState(x.uid);
  shell(x.TITLE, 'Module ' + modLabel(m) + ' · ' + modTitle(m) + ' · step ' + (i + 1) + ' of ' + list.length, [], { back: '#/today' });
  const page = $('#page'); page.textContent = '';
  page.appendChild(el('div', { class: 'row wrap', role: 'tablist', 'aria-label': 'This week\'s steps', style: { gap: '6px' } }, list.map(s => el('a', { class: 'btn sm' + (s === x ? ' pri' : ''), role: 'tab', 'aria-selected': String(s === x), href: '#/step/' + m + '/' + s.STEP, text: (schedule().units.find(v => v.uid === s.uid) || {}).isDone ? '✓ ' + STEP_NAME[s.STEP] : STEP_NAME[s.STEP] }))));
  const card = el('section', { class: 'card pad stack' }, [el('span', { class: 'lbl', text: STEP_NAME[x.STEP] + ' · ' + x.mins + ' min' })]);
  page.appendChild(card);
  const ta = (key, label, ph) => { const t = el('textarea', { class: 'code', 'aria-label': label, placeholder: ph, style: { minHeight: '120px', border: '1px solid var(--line2)', borderRadius: '10px', fontFamily: 'var(--body)', fontSize: '16px' } }); t.value = r[key] || ''; t.addEventListener('input', () => stepPut(x.uid, { [key]: t.value })); return t; };
  if (x.STEP === 'design') {
    if (x.BODY) card.appendChild(mdEl(x.BODY));
    card.appendChild(el('div', { class: 'list' }, x.sims.map((id, k) => { const sc = typeof SIM_SC !== 'undefined' && SIM_SC.find(c => c.id === id), ok = !!((S.sim || {}).done || {})[id];
      return el('a', { class: 'item', href: '#/sim/sc/' + id }, [el('span', { class: 'grow' }, [el('span', { class: 't', text: (sc ? sc.t : id) }), el('br'), el('span', { class: 's', text: k === 0 ? 'Passing this one finishes the step' : 'More practice' })]), ok ? el('span', { class: 'ok', text: '✓' }) : el('span', { class: 's', text: 'Open ›' })]); })));
  } else if (x.STEP === 'fix') {
    card.append(el('div', { class: 'hint' }, [el('b', { text: 'The spec: ' }), el('span', { text: x.SPEC || '' })]));
    const code = el('textarea', { class: 'code lpfix', id: 'st_code', spellcheck: 'false', 'aria-label': 'The code: find the bug and fix it' }); code.value = r.code || x.code;
    code.addEventListener('input', () => stepPut(x.uid, { code: code.value }));
    code.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const s = code.selectionStart; code.setRangeText('    ', s, code.selectionEnd, 'end'); code.dispatchEvent(new Event('input')); } });
    const out = el('div', { class: 'stack', 'aria-live': 'polite' });
    const run = el('button', { class: 'btn pri sm', id: 'st_run', onclick: async () => { run.disabled = true; out.textContent = ''; out.append(el('span', { class: 'muted', text: 'Running the tests… the first run starts Python (about 15 seconds).' }));
      let res; try { res = await Py.json('check_py', [JSON.stringify({ tests: x.tests }), code.value], 20000); } catch (e) { res = { err: String(e.message || e), tests: [] }; }
      run.disabled = false; out.textContent = ''; if (res.err) out.append(el('pre', { class: 'lpcode bad', text: res.err }));
      (res.tests || []).forEach(t => out.append(el('div', { class: 'lptest ' + (t.ok ? 'ok' : 'bad') }, [el('b', { text: (t.ok ? '✓ ' : '✗ ') + t.call }), t.ok ? null : el('small', { text: ' expected ' + t.want + ', got ' + t.got })])));
      if (!res.err && res.tests.length && res.tests.every(t => t.ok) && !stepState(x.uid).fixed) { stepPut(x.uid, { fixed: Date.now() }); gameNote('step'); toast('All tests pass: step done.'); vStep(m, kind); } } }, 'Run the tests');
    card.append(code, el('div', { class: 'row wrap' }, [run, el('button', { class: 'btn sm', onclick: () => { code.value = x.code; stepPut(x.uid, { code: x.code }); } }, 'Reset'), el('span', { class: 'grow' }), el('button', { class: 'btn sm', onclick: () => { stepPut(x.uid, { shown: 1 }); vStep(m, kind); } }, r.shown ? 'Fix shown below' : 'Show a fix')]), out);
    if (r.fixed) card.appendChild(el('span', { class: 'badge b-ok', style: { alignSelf: 'flex-start' }, text: 'Tests pass' }));
    if (r.fixed || r.shown) card.append(el('details', { open: r.shown ? '' : null }, [el('summary', { text: 'One good fix and why' }), el('pre', { class: 'lpcode', text: x.fixed }), mdEl(x.BODY || '')]));
  } else if (x.STEP === 'platform') {
    card.appendChild(mdEl(x.BODY || ''));
    if (x.check) card.appendChild(el('div', { class: 'stack' }, [el('span', { class: 'lbl', text: 'Check' }), loopChoice(x.check.q, x.check.c, r.pick != null ? r.pick : null, x.check.a, x.check.why, k => { stepPut(x.uid, { pick: k }); vStep(m, kind); })]));
  } else if (x.STEP === 'lead') {
    card.append(el('div', { class: 'lq', html: mdi(x.Q || '') }), mdEl(x.BODY || ''), ta('a', 'Your answer', 'The short version: the fear behind the request, the trade-off, your default and its exception, how you bring them along.'));
    const ans = el('div', { style: { display: r.seen ? '' : 'none' } }, [el('b', { text: 'Model answer' }), mdEl(x.A || '')]);
    card.append(el('button', { class: 'btn sm', 'aria-expanded': String(!!r.seen), style: { alignSelf: 'flex-start' }, onclick: e => { const o = ans.style.display === 'none'; ans.style.display = o ? '' : 'none'; e.target.setAttribute('aria-expanded', String(o)); if (o) stepPut(x.uid, { seen: Date.now() }); } }, 'Show the model answer'), ans,
      gradeBox({ kind: 'answer', key: 'step:' + x.uid, title: x.Q, label: 'Grade my answer', text: () => stepState(x.uid).a || '', payload: () => ({ question: x.Q, model_answer: x.A || '', answer: stepState(x.uid).a || '' }) }));
  } else if (x.STEP === 'ai') {
    card.append(mdEl(x.BODY || ''), el('div', { class: 'why' }, [el('b', { text: 'Claude Code task: ' }), mdEl(x.TASK || '')]), ta('a', 'Your prompt and Claude Code\'s answer', 'Paste the prompt you gave and the answer you got, then one line on what you would verify before acting.'),
      el('details', {}, [el('summary', { style: { cursor: 'pointer' }, text: 'What a good result looks like' }), mdEl(x.RUBRIC || '')]),
      gradeBox({ kind: 'answer', key: 'step:' + x.uid, title: x.TITLE, label: 'Grade my result', text: () => stepState(x.uid).a || '', payload: () => ({ question: x.TASK, model_answer: x.RUBRIC || '', answer: stepState(x.uid).a || '' }) }));
    if (typeof aiOn === 'function' && aiOn()) card.appendChild(el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: 'This step takes this week\'s Claude Code slot; the Claude Code track continues in the next slot.' }));
  }
  const done = u && u.isDone;
  page.appendChild(el('div', { class: 'row wrap', style: { gap: '8px' } }, [
    el('button', { class: 'btn' + (done ? '' : ' pri'), id: 'st_done', onclick: () => { if (u && !u.isDone) toggleUnit(u); location.hash = nx ? '#/step/' + m + '/' + nx.STEP : '#/today'; } }, done ? (nx ? 'Next step' : 'Back to Today') : nx ? 'Done, next step' : 'Done'),
    done && u && !(u.auto && u.auto()) ? el('button', { class: 'btn sm', onclick: () => { toggleUnit(u); vStep(m, kind); } }, 'Not done yet') : null]));
}
