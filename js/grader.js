/* Data Architect · instant grading.
   Answers go to the grader on your Mac (tools/grader/grader.py), which grades them with Claude Code:
   directly at 127.0.0.1:8765 when this page runs on that Mac, otherwise through the sync script's job queue
   (works on iPhone and iPad while the Mac is awake). Grades are kept in S.grades and synced. */
const GRADER = 'http://127.0.0.1:8765';
const GRADE_POLL_MS = 4000, GRADE_WAIT_MS = 150000, GRADE_EXPIRE_MS = 3 * 864e5;
const gradeWatch = {}, gradeInflight = {};
/* Settings → AI features: off hides grading, practice runs and the Claude Code track (for studying without AI) */
function aiOn() { return S.settings.ai !== false; }

function gsig(s) { let h = 0; s = String(s || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h.toString(36); }
function gradeId() { return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function onTouchDevice() { return 'ontouchend' in document || navigator.maxTouchPoints > 1; } /* iPadOS says "Macintosh" too */
function withTimeout(p, ms) { return Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]); }

async function graderHealthy() {
  if (onTouchDevice()) return false;
  try { const r = await withTimeout(fetch(GRADER + '/health', { cache: 'no-store' }), 1500); return r.ok && (await r.json()).ok === true; } catch (e) { return false; }
}
async function gradeDirect(kind, payload) {
  const r = await withTimeout(fetch(GRADER + '/grade', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ kind, payload }) }), 200000);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'grader error');
  return j.result;
}
function relayUrl(extra) { const u = S.settings.syncUrl; return u + (u.includes('?') ? '&' : '?') + extra; }
async function relayAsk(id, kind, payload) {
  const r = await fetch(S.settings.syncUrl, { method: 'POST', body: JSON.stringify({ action: 'ask', job: { id, kind, payload } }), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
  const j = await r.json().catch(() => null);
  if (!r.ok || (j && j.ok === false)) throw new Error((j && j.error) || 'the sync script refused the job');
}
async function relayResult(id) {
  const j = await fetch(relayUrl('action=results&ids=' + encodeURIComponent(id)), { cache: 'no-store' }).then(r => r.json());
  return (j.results || {})[id] || null;
}

/* Grades one answer. Resolves when graded, or when still waiting after GRADE_WAIT_MS (status stays 'pending'). */
function gradeNow(key, kind, payload, text, title) {
  const p = gradeRun(key, kind, payload, text, title);
  gradeInflight[key] = p; p.finally(() => { if (gradeInflight[key] === p) delete gradeInflight[key]; });
  return p;
}
async function gradeRun(key, kind, payload, text, title) {
  S.grades = S.grades || {};
  const prev = S.grades[key];
  const hist = ((prev && prev.hist) || []).concat(prev && prev.s === 'done' && prev.r ? [{ at: prev.at, q: prev.q, score: prev.r.score, model: prev.r.model, turns: prev.r.turns, tokens: prev.r.tokens, cost: prev.r.cost, ms: prev.r.ms }] : []).slice(-6);
  const g = S.grades[key] = { s: 'pending', kind, sig: gsig(text), q: String(title || '').slice(0, 140), at: Date.now(), hist };
  save();
  if (await graderHealthy()) {
    try { g.r = await gradeDirect(kind, payload); g.s = 'done'; } catch (e) { g.s = 'error'; g.err = String(e.message || e).slice(0, 200); }
    g.at = Date.now(); save(); return g;
  }
  if (!S.settings.syncUrl) { g.s = 'error'; g.err = 'nograder'; save(); return g; }
  g.job = gradeId(); save();
  try { await relayAsk(g.job, kind, payload); } catch (e) { g.s = 'error'; g.err = 'relay: ' + String(e.message || e).slice(0, 160); save(); return g; }
  return pollGrade(key);
}
async function pollGrade(key) {
  const g = S.grades[key];
  if (!g || g.s !== 'pending' || !g.job || gradeWatch[key]) return g;
  gradeWatch[key] = true;
  const until = Date.now() + GRADE_WAIT_MS;
  try {
    while (Date.now() < until && S.grades[key] === g) {
      await new Promise(r => setTimeout(r, GRADE_POLL_MS));
      let res = null; try { res = await relayResult(g.job); } catch (e) { /* offline for a moment: keep trying */ }
      if (res && res.status === 'done') {
        if (res.result && res.result.error) { g.s = 'error'; g.err = res.result.error; } else { g.s = 'done'; g.r = res.result; }
        g.at = Date.now(); save(); break;
      }
      if (Date.now() - g.at > GRADE_EXPIRE_MS) { g.s = 'error'; g.err = 'expired'; save(); break; }
    }
  } finally { delete gradeWatch[key]; }
  return g;
}

function scoreBadge(n) { return el('span', { class: 'badge ' + (n >= 4 ? 'b-ok' : n >= 3 ? 'b-warn' : 'b-bad'), text: n + ' / 5' }); }
function gradeView(g) {
  const r = g.r || {};
  const list = (items, cls) => items && items.length ? el('ul', { class: cls, style: { margin: '0', paddingLeft: '20px' } }, items.map(t => el('li', { html: mdi2(t) }))) : null;
  return el('div', { class: 'stack', style: { gap: '8px' } }, [
    el('div', { class: 'row wrap' }, [scoreBadge(r.score), el('b', { class: 'grow', html: mdi2(r.verdict || '') })]),
    r.strengths && r.strengths.length ? el('div', {}, [el('span', { class: 'lbl', text: 'What worked' }), list(r.strengths)]) : null,
    r.issues && r.issues.length ? el('div', {}, [el('span', { class: 'lbl', text: 'What to fix' }), list(r.issues)]) : null,
    r.improve ? el('div', { class: 'hint' }, [el('b', { text: 'Do this next time: ' }), el('span', { html: mdi2(r.improve) })]) : null,
    r.better ? el('details', {}, [el('summary', { style: { cursor: 'pointer', fontWeight: 600 }, text: 'A stronger answer' }), el('div', { class: 'prose', html: md2(r.better) })]) : null,
    el('span', { class: 'muted', style: { fontSize: '12.5px' }, text: 'Graded ' + new Date(g.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) + (r.model ? ' by Claude ' + r.model : '') + (r.ms ? ' in ' + Math.round(r.ms / 1000) + ' s' : '') + '. Graded by AI: check anything that looks wrong.' })]);
}
function gradeErrText(err) {
  if (err === 'nograder') return 'Instant grading is not set up on this device yet, so compare your answer with the model answer instead. To turn it on: run bash tools/grader/install.sh on your Mac once, and set up Sync for iPhone and iPad. Do not want AI? Settings → AI features → Off hides this.';
  if (err === 'expired') return 'Your Mac did not pick this up within 3 days. Grade it again with your Mac awake.';
  if (/^relay/.test(err || '')) return 'Could not send this to your Mac through the sync script (' + err.slice(7) + '). If you just updated the script, deploy it as a new version.';
  return 'The grader could not grade this: ' + err;
}

/* A "Grade me" box. opts: { kind, key, title, text: () => answer text, payload: () => payload, onResult: g => {} , label } */
function gradeBox(opts) {
  if (!aiOn()) return el('span');
  const box = el('div', { class: 'stack gradebox', style: { gap: '8px' }, 'aria-live': 'polite' });
  const paint = () => {
    box.textContent = '';
    const g = (S.grades || {})[opts.key];
    const changed = g && g.sig !== gsig(opts.text());
    const btn = el('button', { class: 'btn ' + (g && g.s === 'done' && !changed ? 'sm' : 'pri sm'), style: { alignSelf: 'flex-start' }, onclick: go, text: g && g.s === 'done' ? (changed ? 'Grade my new answer' : 'Grade again') : opts.label || 'Grade me now' });
    if (!g) { box.append(btn); return; }
    if (g.s === 'pending') {
      if (!g.job && !gradeInflight[opts.key]) { box.append(el('div', { class: 'why', text: 'Grading was interrupted (the page was closed). Grade it again.' }), btn); return; }
      const waiting = g.job && Date.now() - g.at > GRADE_WAIT_MS;
      box.append(el('div', { class: 'row' }, [el('span', { class: 'spin' }), el('span', { class: 'muted', text: waiting ? 'Waiting for your Mac to grade this. It is graded as soon as the Mac is awake; come back any time.' : 'Grading… usually 10 to 30 seconds.' })]));
      if (gradeInflight[opts.key]) gradeInflight[opts.key].then(done);
      else { const p = pollGrade(opts.key); gradeInflight[opts.key] = p; p.finally(() => { if (gradeInflight[opts.key] === p) delete gradeInflight[opts.key]; }).then(done); }
      return;
    }
    if (g.s === 'error') { box.append(el('div', { class: 'why', text: gradeErrText(g.err) }), btn); return; }
    if (changed) box.append(el('span', { class: 'badge b-warn', style: { alignSelf: 'flex-start' }, text: 'You edited your answer after this grade' }));
    box.append(gradeView(g), btn);
  };
  function done(g) { if (g && g.s === 'done' && opts.onResult && !g.applied) { g.applied = 1; opts.onResult(g); save(); } if (box.isConnected) paint(); }
  async function go() {
    const t = opts.text();
    if (!String(t || '').trim()) { toast('Write your answer first, then grade it.'); return; }
    const p = gradeNow(opts.key, opts.kind, opts.payload(), t, opts.title);
    paint();
    await p;
  }
  paint();
  return box;
}

/* One call to Claude Code on the Mac without storing a grade: direct on the Mac, else through the sync script.
   Resolves with the result, or rejects with 'nograder' / 'timeout' / an error message. */
async function macCall(kind, payload, onWait) {
  if (await graderHealthy()) return gradeDirect(kind, payload);
  if (!S.settings.syncUrl) throw new Error('nograder');
  const id = gradeId(); await relayAsk(id, kind, payload);
  const until = Date.now() + GRADE_WAIT_MS; let warned = false;
  while (Date.now() < until) {
    await new Promise(r => setTimeout(r, GRADE_POLL_MS));
    let res = null; try { res = await relayResult(id); } catch (e) { }
    if (res && res.status === 'done') { if (res.result && res.result.error) throw new Error(res.result.error); return res.result; }
    if (!warned && Date.now() > until - GRADE_WAIT_MS + 20000 && onWait) { warned = true; onWait(); }
  }
  throw new Error('timeout');
}

/* Recent grades for the progress page and the nightly coach. */
function recentGrades(days) {
  const since = Date.now() - (days || 7) * 864e5;
  return Object.entries(S.grades || {}).filter(([, g]) => g.s === 'done' && g.at >= since && g.r && g.r.score).map(([k, g]) => ({ key: k, kind: g.kind, q: g.q, score: g.r.score, improve: g.r.improve, at: g.at })).sort((a, b) => b.at - a.at);
}

/* ---------- practice runs: your prompt, run by Claude Code on your Mac against the practice project ---------- */
function tokTotal(t) { return t ? (t.input || 0) + (t.cache_read || 0) + (t.cache_write || 0) : 0; }
function runMetrics(r) {
  const t = r.tokens || {};
  return el('div', { class: 'row wrap', style: { gap: '6px' } }, [['Model', r.model], ['Turns', r.turns], ['Tokens in', tokTotal(t).toLocaleString() + (t.cache_read ? ' (' + Math.round(100 * t.cache_read / Math.max(1, tokTotal(t))) + '% from cache)' : '')], ['Tokens out', (t.output || 0).toLocaleString()], ['Cost', '$' + (r.cost || 0).toFixed(4)], ['Time', Math.round((r.ms || 0) / 1000) + ' s']]
    .map(([k, v]) => el('span', { class: 'chip c-test', text: k + ': ' + v })));
}
/* opts: { key, title, placeholder, starter, claudeMd (bool: offer a CLAUDE.md box) } */
function runBox(opts) {
  if (!aiOn()) return el('span');
  const pk = 'run_' + opts.key, mk = 'runmd_' + opts.key;
  if (S.code[pk] === undefined && opts.starter) S.code[pk] = opts.starter;
  const ta = el('textarea', { class: 'code', 'aria-label': 'Your prompt for Claude Code', placeholder: opts.placeholder || 'Type a prompt as you would in Claude Code…', style: { minHeight: '110px', border: '1px solid var(--line2)', borderRadius: '10px', fontSize: '14.5px' } });
  ta.value = S.code[pk] || ''; ta.addEventListener('input', () => { S.code[pk] = ta.value; save(); });
  const md = el('textarea', { class: 'code', 'aria-label': 'CLAUDE.md for this run', placeholder: '# CLAUDE.md\nProject facts and rules Claude should know…', style: { minHeight: '90px', border: '1px solid var(--line2)', borderRadius: '10px', fontSize: '13.5px' } });
  md.value = S.code[mk] || ''; md.addEventListener('input', () => { S.code[mk] = md.value; save(); });
  const model = el('select', { class: 'btn sm', 'aria-label': 'Model' }, [['haiku', 'Haiku (cheapest)'], ['sonnet', 'Sonnet']].map(([v, t]) => el('option', { value: v, selected: (S.layout.runModel || 'haiku') === v ? 'selected' : null, text: t })));
  model.addEventListener('change', () => { S.layout.runModel = model.value; save(false); });
  const out = el('div', { class: 'stack', style: { gap: '8px' }, 'aria-live': 'polite' });
  const key = 'run:' + opts.key;
  const paint = () => {
    out.textContent = '';
    const g = (S.grades || {})[key];
    if (!g) return;
    if (g.s === 'pending') {
      if (!g.job && !gradeInflight[key]) { out.append(el('div', { class: 'why', text: 'The run was interrupted (the page was closed). Run it again.' })); return; }
      out.append(el('div', { class: 'row' }, [el('span', { class: 'spin' }), el('span', { class: 'muted', text: g.job && Date.now() - g.at > GRADE_WAIT_MS ? 'Waiting for your Mac to run this.' : 'Claude Code is working on your prompt in a copy of the practice project… usually 10 to 60 seconds.' })]));
      if (gradeInflight[key]) gradeInflight[key].then(() => box.isConnected && paint());
      else { const p = pollGrade(key); gradeInflight[key] = p; p.finally(() => { if (gradeInflight[key] === p) delete gradeInflight[key]; }).then(() => box.isConnected && paint()); }
      return;
    }
    if (g.s === 'error') { out.append(el('div', { class: 'why', text: gradeErrText(g.err) })); return; }
    const r = g.r || {};
    out.append(...[el('span', { class: 'lbl', text: 'Claude Code answered' }), runMetrics(r),
      r.stopped ? el('span', { class: 'badge b-warn', text: 'Stopped early: ' + r.stopped + ' (the run has a $0.25 cap)' }) : null,
      r.denied && r.denied.length ? el('span', { class: 'muted', style: { fontSize: '13px' }, text: 'Blocked (practice runs are read-only): ' + r.denied.join(', ') }) : null,
      el('div', { class: 'prose', style: { border: '1px solid var(--line)', borderRadius: '10px', padding: '10px 12px', maxHeight: '420px', overflow: 'auto' }, html: md2(r.result) })].filter(Boolean));
    if ((g.hist || []).length) out.append(el('details', {}, [el('summary', { style: { cursor: 'pointer', fontWeight: 600 }, text: 'Compare with your earlier runs' }),
      el('div', { class: 'scroll' }, el('table', {}, [el('tr', {}, ['When', 'Prompt', 'Model', 'Turns', 'Tokens in', 'Out', 'Cost'].map(h => el('th', { text: h })))].concat(g.hist.concat([{ at: g.at, q: g.q, model: r.model, turns: r.turns, tokens: r.tokens, cost: r.cost }]).reverse().map(h => el('tr', {}, [new Date(h.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), (h.q || '').slice(0, 60), h.model, h.turns, tokTotal(h.tokens).toLocaleString(), ((h.tokens || {}).output || 0).toLocaleString(), '$' + (h.cost || 0).toFixed(4)].map(x => el('td', { text: String(x == null ? '' : x) })))))))]));
  };
  const go = async () => {
    const p = ta.value.trim();
    if (!p) { toast('Type a prompt first.'); return; }
    const pr = gradeNow(key, 'run', { prompt: p, model: model.value, claude_md: opts.claudeMd ? md.value : '' }, p, p);
    paint(); await pr; if (box.isConnected) paint();
  };
  const box = el('section', { class: 'card pad stack', style: { borderColor: '#D9C6E6' } }, [
    el('div', { class: 'row wrap' }, [el('h3', { class: 'grow', text: opts.title || 'Try it in Claude Code' }), el('span', { class: 'chip c-ai', text: 'runs on your Mac' })]),
    el('span', { class: 'muted', style: { fontSize: '13.5px' }, text: 'Your prompt runs in real Claude Code on your Mac, in a fresh copy of the practice project, with read-only tools (Read, Grep, Glob) and a $0.25 cap. You see the answer, the turns, the tokens and the cost, so you can compare prompts.' }),
    ta, opts.claudeMd ? el('details', { open: md.value ? '' : null }, [el('summary', { style: { cursor: 'pointer', fontWeight: 600 }, text: 'Add a CLAUDE.md to this run' }), md]) : null,
    el('div', { class: 'row wrap' }, [model, el('span', { class: 'grow' }), el('button', { class: 'btn pri', onclick: go, text: 'Run in Claude Code' })]), out]);
  paint();
  return box;
}
/* AI output is shown as markdown with scripts and event handlers stripped */
function mdi2(s) { return clean2(mdi(s || '')); }
function md2(s) { return clean2(md(s || '')); }
function clean2(h) { const t = document.createElement('template'); t.innerHTML = h; /* a template is inert: nothing loads or runs while it is cleaned */ t.content.querySelectorAll('script,iframe,object,embed,style,link,meta,form').forEach(x => x.remove()); t.content.querySelectorAll('*').forEach(x => [...x.attributes].forEach(a => { if (/^on/i.test(a.name) || /^\s*(javascript|data):/i.test(a.value)) x.removeAttribute(a.name); })); return t.innerHTML; }
