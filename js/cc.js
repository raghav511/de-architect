/* Data Architect · Claude Code tests. Each task is done in a real terminal (your Mac or a Codespace), then you
   paste what it asks for and it is graded at once by the grader on your Mac (js/grader.js). */
const CODESPACE_URL = 'https://codespaces.new/raghav511/de-architect?devcontainer_path=.devcontainer/claude-code/devcontainer.json';

function whereToPractise() {
  const open = !S.layout.ccWhereSeen;
  const d = el('details', { class: 'card pad', open: open ? '' : null, ontoggle: () => { S.layout.ccWhereSeen = 1; save(false); } }, [
    el('summary', { class: 'lbl', style: { cursor: 'pointer' }, text: 'Where to practise: your terminal' }),
    el('div', { class: 'grid2', style: { marginTop: '10px' } }, [
      el('div', { class: 'stack', style: { gap: '6px' } }, [el('b', { text: 'On your MacBook' }), mdEl('Once: `git clone https://github.com/raghav511/de-architect ~/de-architect`\n\nFor each lesson, a fresh practice project:\n\n```bash\nbash ~/de-architect/labs/cc/new_sandbox.sh\ncd ~/cc-sandbox && claude\n```')]),
      el('div', { class: 'stack', style: { gap: '6px' } }, [el('b', { text: 'On iPad or iPhone' }), el('span', { style: { fontSize: '14.5px' }, text: 'Open a Codespace: a real terminal in Safari with Claude Code installed and the practice project open. Sign in to Claude the first time you run claude there. Stop the Codespace when you finish (free hours are limited).' }), el('a', { class: 'btn', href: CODESPACE_URL, target: '_blank', rel: 'noopener', style: { alignSelf: 'flex-start' }, text: 'Open the Codespace' })])])]);
  return d;
}

async function vCC(m, n) {
  m = isCC(m) ? m : 'c01'; n = Math.max(1, +n || 1);
  if (!aiOn()) { shell('Claude Code test', modLabel(m), [el('section', { class: 'card pad stack' }, [el('p', { style: { margin: 0 }, text: 'AI features are off, so the Claude Code track is hidden from your plan.' }), el('button', { class: 'btn', style: { alignSelf: 'flex-start' }, onclick: settings, text: 'Open settings' })])], { back: '#/today' }); return; }
  shell('Claude Code test', modLabel(m), [el('p', { class: 'muted', text: 'Loading…' })], { back: '#/today' });
  let s; try { s = await sprint(m); } catch (e) { $('#page').textContent = 'Could not load this test.'; return; }
  const tasks = s.tasks || [], T = tasks[n - 1];
  if (!T) { location.hash = '#/cc/' + m + '/1'; return; }
  const key = 'cc:' + m + ':' + (n - 1), ak = 'cc_' + m + '_' + n;
  const status = i => { const g = (S.grades || {})['cc:' + m + ':' + i]; return !g || g.s !== 'done' || !g.r ? null : g.r.score; };
  const page = $('#page'); page.textContent = '';
  const nav = el('div', { class: 'row wrap' }, [el('select', { class: 'btn sm', 'aria-label': 'Module', onchange: e => { location.hash = '#/cc/' + e.target.value + '/1'; } }, CC_MODS.filter(x => MOD[x]).map(x => el('option', { value: x, selected: x === m ? 'selected' : null, text: modLabel(x) + ' · ' + modTitle(x) })))].concat(
    tasks.map((t, i) => { const sc = status(i); return el('a', { class: 'btn sm', href: '#/cc/' + m + '/' + (i + 1), 'aria-current': String(i === n - 1), style: i === n - 1 ? { borderColor: 'var(--ink)' } : {}, text: 'Task ' + (i + 1) + (sc ? ' · ' + sc + '/5' : '') }); }),
    [el('a', { class: 'btn sm', href: '#/learn/' + m + '/chapter', text: 'Lesson' }), el('a', { class: 'btn sm', href: '#/learn/' + m + '/lab', text: 'Practice lab' })]));
  const ta = el('textarea', { class: 'code', 'aria-label': 'Your submission', placeholder: T.SUBMIT ? 'Paste here: ' + T.SUBMIT.trim() : 'Paste your answer here', style: { minHeight: '200px', border: '1px solid var(--line2)', borderRadius: '10px', fontSize: '14px' } });
  ta.value = S.code[ak] || ''; ta.addEventListener('input', () => { S.code[ak] = ta.value; save(); });
  const rubric = el('div');
  const paintRubric = () => { rubric.textContent = ''; if (status(n - 1)) rubric.appendChild(el('details', {}, [el('summary', { style: { cursor: 'pointer', fontWeight: 600 }, text: 'What a strong answer covers' }), mdEl(T.RUBRIC || '')])); };
  paintRubric();
  const passedAll = () => tasks.every((t, i) => (status(i) || 0) >= 4);
  page.append(...[nav, whereToPractise(),
    el('section', { class: 'card pad stack' }, [el('div', { class: 'row wrap' }, [el('span', { class: 'chip c-ai', text: modLabel(m) }), el('span', { class: 'lbl grow', text: 'Task ' + n + ' of ' + tasks.length }), el('span', { class: 'muted', text: 'Pass mark: 4 / 5 on every task' })]),
      el('h1', { style: { fontSize: '24px' }, text: T.TITLE.trim() }), mdEl(T.TASK || '')]),
    T.RUN ? runBox({ key: m + '_t' + n, title: 'Try it here first (optional)', starter: T.RUN.trim(), claudeMd: true }) : null,
    el('section', { class: 'card pad stack' }, [el('h3', { text: 'Your submission' }), T.SUBMIT ? el('span', { class: 'muted', style: { fontSize: '14px' }, html: mdi('Paste: ' + T.SUBMIT.trim()) }) : null,
      el('span', { class: 'muted', style: { fontSize: '13px' }, text: 'Never paste a real key, token or customer data here. Use the fake values from the practice project.' }), ta,
      gradeBox({ kind: 'cc', key, title: modLabel(m) + ' · ' + T.TITLE.trim(), label: 'Grade my work', text: () => ta.value, payload: () => ({ task: T.TASK, rubric: T.RUBRIC, submission: ta.value }),
        onResult: g => { paintRubric(); if (g.r.score >= 4) toast(passedAll() ? 'Passed every task in ' + modLabel(m) + '. The test step is ticked.' : 'Passed task ' + n + '.' + (n < tasks.length ? ' Next: task ' + (n + 1) + '.' : '')); } }), rubric]),
    el('div', { class: 'row wrap' }, [n > 1 ? el('a', { class: 'btn', href: '#/cc/' + m + '/' + (n - 1), text: 'Previous task' }) : null, el('span', { class: 'grow' }), n < tasks.length ? el('a', { class: 'btn pri', href: '#/cc/' + m + '/' + (n + 1), text: 'Next task' }) : el('a', { class: 'btn pri', href: '#/quiz/' + m, text: 'Then: the quiz' })])].filter(Boolean)); /* append() would print null as text */
}
