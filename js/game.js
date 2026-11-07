/* Data Architect · the fun layer: a career ladder with XP, streaks with freezes, daily quests, a 60-second warm-up
   (#/warm), a weekend boss round (the live mock), a "shipped to production" moment per module, a card of the day and
   a skill map. XP is computed from real work in S, never stored, so it cannot drift or be lost. S.game keeps only
   activity days, warm-up results and which modules were celebrated. Loaded before app.js. */
'use strict';
const LADDER = [['Intern', 0], ['Junior', 300], ['Mid-level', 900], ['Senior', 2000], ['Staff', 4000, 3.0], ['Principal', 7000, 3.3], ['Architect', 11000, 3.5]]; /* [title, XP, boss score needed at staff level] */
const XP_KIND = { learn: 10, build: 25, ai: 25, incident: 25, practice: 15, quiz: 30, test: 30, talk: 20, git: 15, news: 5, design: 25, cc: 20 };
const XP_LV = { Easy: 10, Medium: 20, Hard: 30 };

function gameState() { S.game = S.game || {}; S.game.days = S.game.days || {}; S.game.warm = S.game.warm || {}; S.game.shipped = S.game.shipped || {}; return S.game; }
/* record that something real happened today (a step, a solve, a warm-up, a mock) */
function gameNote(kind) { if (typeof mEvent === 'function') mEvent('did_' + kind); const g = gameState(), k = iso(new Date()); const d = g.days[k] = g.days[k] || {}; d[kind] = (d[kind] || 0) + 1; }
function funOn() { return S.settings.fun !== false && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }

function gameXP() {
  const sc = schedule(), g = gameState(); let xp = 0;
  sc.units.forEach(u => { if (u.isDone) xp += XP_KIND[u.kind] || 10; });
  ['py', 'dsa', 'sql', 'spark'].forEach(k => (DATA[k] || []).forEach(x => { if (S.solved[x.id]) xp += XP_LV[x.lv] || 15; }));
  Object.values(S.live || {}).forEach(m => { if (m && m.done) { const a = Object.values(m.ans || {}).map(liveAvg).filter(v => !isNaN(v)); xp += 40 + (a.length ? Math.round(10 * a.reduce((x, y) => x + y, 0) / a.length) : 0); } });
  Object.values(S.mock || {}).forEach(m => { if (m && m.sub) xp += 30; });
  Object.values(g.warm).forEach(w => { xp += 2 * (w.right || 0) + (w.best || 0); });
  xp += 5 * Object.keys(S.rq || {}).length;
  Object.values(S.reels || {}).forEach(r => { if (r.seen) xp += 3; if (r.ok) xp += 2; });
  xp += 25 * Object.keys((S.sim && S.sim.done) || {}).length; /* design simulator challenges passed */
  if (S.loop) { xp += 15 * Object.values(S.loop.cc || {}).filter(x => x && x.fixed).length + 10 * Object.values(S.loop.stories || {}).filter(x => x && !x.del && x.title).length; } /* interview loop: code fixed, stories written */
  return xp;
}
/* the best weekend (boss) round at each level */
function bossBest(level) { return Math.max(0, ...Object.entries(S.live || {}).filter(([k, m]) => m && m.done && m.kind === 'we' && (level !== 'staff' || m.level === 'staff')).map(([, m]) => { const a = Object.values(m.ans || {}).map(liveAvg).filter(v => !isNaN(v)); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; })); }
function gameLevel(xp) {
  const best = bossBest('staff'); let i = 0;
  for (let j = 1; j < LADDER.length; j++) { if (xp < LADDER[j][1]) break; if (LADDER[j][2] && best < LADDER[j][2]) return { i, gated: j, best }; i = j; }
  return { i, gated: 0, best };
}
/* days with real activity; a missed day is covered by that week's one freeze */
function gameDays() {
  const g = gameState(), days = new Set(Object.keys(g.days));
  Object.values(S.doneAt || {}).forEach(t => { if (t) days.add(iso(new Date(t))); });
  Object.entries(S.live || {}).forEach(([k, m]) => { if (m && m.done) days.add(k); });
  Object.entries(S.mock || {}).forEach(([k, m]) => { if (m && m.sub) days.add(k); });
  Object.values(S.rq || {}).forEach(k => { if (typeof k === 'string') days.add(k); });
  Object.values(S.reels || {}).forEach(r => { if (r.seen) days.add(r.seen); });
  return days;
}
function gameStreak() {
  const days = gameDays(), used = {}, d = new Date(); d.setHours(0, 0, 0, 0);
  const wk = x => { const m = new Date(x); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return iso(m); };
  if (!days.has(iso(d))) d.setDate(d.getDate() - 1); /* today still counts until midnight */
  let n = 0, frozen = 0;
  for (let guard = 0; guard < 2000; guard++) {
    const k = iso(d);
    if (days.has(k)) n++;
    else if (!used[wk(d)] && n > 0) { used[wk(d)] = 1; frozen++; }
    else break;
    d.setDate(d.getDate() - 1);
  }
  return { n, frozen, freezeLeft: used[wk(new Date())] ? 0 : 1 };
}
function gameQuests() {
  const k = iso(new Date()), d = gameState().days[k] || {}, sc = schedule();
  const stepToday = sc.units.some(u => u.isDone && u.kind === 'learn' && (S.doneAt || {})[u.uid] && iso(new Date(S.doneAt[u.uid])) === k);
  return [['Warm-up', !!d.warm, '#/warm'], ['Read a part', stepToday || !!d.step, '#/today'], ['Solve one', !!d.solve, '#/practice'], ['Live mock', !!((S.live || {})[k] || {}).done, '#/live/' + k]];
}

/* the strip at the top of Today: level, XP bar, streak, quests */
function gameStrip() {
  const xp = gameXP(), L = gameLevel(xp), cur = LADDER[L.i], nx = LADDER[L.i + 1], st = gameStreak(), q = gameQuests();
  const lo = cur[1], hi = nx ? nx[1] : cur[1], pct = nx ? Math.min(100, Math.round(100 * (xp - lo) / (hi - lo))) : 100;
  const gateTxt = L.gated ? LADDER[L.gated][0] + ' unlocks when you pass a weekend boss round at staff level with ' + LADDER[L.gated][2].toFixed(1) + '+' : '';
  return el('div', { class: 'gstrip' }, [
    el('div', { class: 'row', style: { gap: '10px' } }, [
      el('span', { class: 'glv', 'aria-hidden': 'true', text: 'L' + (L.i + 1) }),
      el('div', { class: 'grow' }, [el('div', { class: 'row', style: { gap: '6px' } }, [el('b', { text: cur[0] + ' data engineer' }), el('span', { class: 'muted', style: { fontSize: '13px' }, text: xp.toLocaleString() + ' XP' })]),
        el('div', { class: 'gbar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': nx ? (hi - xp) + ' XP to ' + nx[0] : 'Top of the ladder' }, el('i', { style: { width: pct + '%' } })),
        el('span', { class: 'muted gsub', style: { fontSize: '12.5px' }, text: gateTxt || (nx ? Math.max(0, hi - xp).toLocaleString() + ' XP to ' + nx[0] : 'Top of the ladder') })]),
      el('a', { class: 'gfire', href: '#/progress', 'aria-label': st.n + ' day streak' + (st.freezeLeft ? ', 1 freeze left this week' : ', freeze used this week') }, [svg('<path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z"/>', 22), el('b', { text: String(st.n) })])]),
    el('div', { class: 'gquests', role: 'list', 'aria-label': 'Today\'s quests' }, q.map(([t, dn, h]) => el('a', { role: 'listitem', class: 'gq' + (dn ? ' on' : ''), href: h, 'aria-label': t + (dn ? ', done' : '') }, [dn ? svg(I.check, 13) : null, t])))]);
}

/* phones: a small chip in the Today heading instead of the strip, so Up next stays on the first screen */
function gameMini() {
  const xp = gameXP(), L = gameLevel(xp), st = gameStreak(), q = gameQuests(), n = q.filter(x => x[1]).length;
  return el('a', { class: 'gmini', href: '#/progress', 'aria-label': LADDER[L.i][0] + ', ' + st.n + ' day streak, ' + n + ' of 4 quests done' }, [el('b', { text: 'L' + (L.i + 1) }), svg('<path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z"/>', 14), el('span', { text: st.n + ' · ' + n + '/4' })]);
}
/* card of the day: one under-the-hood fact from a module you have reached */
async function gameCard() {
  const reach = MODS.slice(0, Math.max(2, MODS.indexOf(curMid()) + 2)).filter(m => !isCC(m)), items = [];
  for (const m of reach) { const s = await sprint(m).catch(() => null); if (!s) continue; const ch = s.raw.chapter || '', at = ch.indexOf('### Under the hood'); liveDeep(at >= 0 ? ch.slice(at) : '').concat(liveDeep(s.raw.practice)).forEach(x => items.push(Object.assign(x, { m }))); }
  if (!items.length) return null;
  const k = iso(new Date()); let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) | 0;
  const x = items[Math.abs(h) % items.length];
  return el('details', { class: 'gcard' }, [el('summary', {}, [el('span', { class: 'lbl', text: '✦ Card of the day · ' + modLabel(x.m) }), el('b', { text: x.q })]), mdEl(x.model)]);
}

/* a module whose steps are all done gets its "shipped to production" moment, once */
function gameShipCheck() {
  const sc = schedule(), g = gameState(), fresh = MODS.filter(m => !isCC(m) && sc.span[m] && sc.span[m].n && sc.span[m].done === sc.span[m].n && !g.shipped[m]);
  if (!fresh.length) return;
  fresh.forEach(m => g.shipped[m] = iso(new Date())); save();
  const m = fresh[fresh.length - 1], goal = (MOD[m] && MOD[m].goal || '').split('. ')[0];
  const ov = el('div', { class: 'gship', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Module shipped' }, [el('div', { class: 'card pad stack gshipcard' }, [
    el('span', { class: 'gbadge', 'aria-hidden': 'true', text: modLabel(m) }),
    el('h2', { text: 'Shipped to production' }),
    el('p', { style: { margin: 0 }, text: modTitle(m) + ' is done.' + (goal ? ' At Meridian: ' + goal.replace(/\.$/, '') + '.' : '') }),
    el('span', { class: 'muted', text: '+' + sc.units.filter(u => u.mid === m).reduce((a, u) => a + (XP_KIND[u.kind] || 10), 0) + ' XP from this module' }),
    el('button', { class: 'btn pri', onclick: () => ov.remove() }, 'Next module')])]);
  document.body.appendChild(ov); confetti(); ov.querySelector('button').focus();
}
function confetti() {
  if (!funOn()) return;
  const c = el('div', { class: 'confetti', 'aria-hidden': 'true' }), cols = ['#0B7A67', '#2B59C3', '#E08A1E', '#7A3E9D', '#B4432A'];
  for (let i = 0; i < 60; i++) c.appendChild(el('i', { style: { left: Math.random() * 100 + '%', background: cols[i % 5], animationDelay: (Math.random() * .6) + 's', animationDuration: (1.6 + Math.random()) + 's', transform: 'rotate(' + Math.random() * 360 + 'deg)' } }));
  document.body.appendChild(c); setTimeout(() => c.remove(), 3200);
}
let gAudio = null;
function blip(ok) {
  if (!S.settings.sound) return;
  try { gAudio = gAudio || new (window.AudioContext || window.webkitAudioContext)(); const o = gAudio.createOscillator(), v = gAudio.createGain(); o.frequency.value = ok ? 880 : 220; v.gain.value = .05; o.connect(v); v.connect(gAudio.destination); o.start(); v.gain.exponentialRampToValueAtTime(.0001, gAudio.currentTime + .18); o.stop(gAudio.currentTime + .2); } catch (e) { }
}

/* 60-second warm-up: quick cards from quizzes you have reached, review-queue topics first */
async function vWarm() {
  shell('Warm-up', '60 seconds · quick cards', [el('p', { class: 'muted', text: 'Shuffling your cards…' })], { back: '#/today' });
  const ci = MODS.indexOf(curMid()), pool = [];
  for (const m of MODS.slice(0, Math.max(2, ci + 2)).filter(x => !isCC(x))) { const s = await sprint(m).catch(() => null); if (s) s.quiz.forEach(q => { if ((q.TYPE === 'mcq' && q.opts) || q.TYPE === 'fill') pool.push(Object.assign({ m }, q)); }); }
  const page = $('#page'); page.textContent = '';
  if (!pool.length) { page.appendChild(el('section', { class: 'card pad' }, el('p', { text: 'No cards yet.' }))); return; }
  let h = Date.now() | 0; const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e5) / 1e5; };
  const deck = pool.slice().sort(() => rnd() - .5);
  const k = iso(new Date()), g = gameState(), w = { right: 0, wrong: 0, best: 0 }; let combo = 0, left = 60, i = 0, over = false;
  const clock = el('b', { class: 'mono' }), comboEl = el('span', { class: 'gcombo' }), card = el('div', { class: 'stack' });
  const box = el('section', { class: 'card pad stack gwarm' }, [el('div', { class: 'row' }, [el('span', { class: 'lbl grow', text: 'Warm-up' }), comboEl, clock]), card]);
  page.appendChild(box);
  const paint = () => { clock.textContent = '0:' + String(Math.max(0, left)).padStart(2, '0'); comboEl.textContent = combo > 1 ? 'combo ×' + combo : ''; };
  const finish = () => {
    if (over) return; over = true; clearInterval(t);
    const prev = g.warm[k]; if (!prev || (prev.right || 0) < w.right) g.warm[k] = w; gameNote('warm'); save();
    card.textContent = ''; if (w.right >= 5) confetti();
    card.append(el('h2', { text: w.right + ' right' + (w.wrong ? ', ' + w.wrong + ' to review' : '') }), el('span', { class: 'muted', text: 'Best combo ×' + w.best + ' · +' + (2 * w.right + w.best) + ' XP' }), el('a', { class: 'btn pri', href: '#/today', text: 'On to today\'s plan' }));
  };
  const t = setInterval(() => { if (document.visibilityState !== 'visible') return; left--; paint(); if (left <= 0) finish(); }, 1000);
  window.warmFinish = finish; /* tests end the minute early */
  cleanup.push(() => clearInterval(t));
  const answer = (ok, why) => {
    if (ok) { w.right++; combo++; w.best = Math.max(w.best, combo); } else { w.wrong++; combo = 0; }
    blip(ok); paint();
    card.querySelectorAll('button,input').forEach(b => b.disabled = true);
    card.appendChild(el('div', { class: ok ? 'gok' : 'gno', role: 'status', text: (ok ? 'Right. ' : 'Not quite. ') + (why || '') }));
    setTimeout(() => { if (!over) { i++; show(); } }, ok ? 700 : 1800);
  };
  function show() {
    if (i >= deck.length) return finish();
    const q = deck[i]; card.textContent = '';
    card.appendChild(el('div', { class: 'gq-q', html: mdi(q.Q) }));
    if (q.TYPE === 'mcq') card.appendChild(el('div', { class: 'stack', style: { gap: '6px' } }, q.opts.map(([l, tx]) => el('button', { class: 'btn gopt', onclick: () => answer(l === q.ANS, q.WHY), html: mdi(tx) }))));
    else { const inp = el('input', { class: 'btn', style: { justifyContent: 'flex-start', width: '100%' }, 'aria-label': 'Your answer', autocomplete: 'off', autocapitalize: 'off' });
      const go = () => { const v = inp.value.trim().toLowerCase(); answer(!!v && q.ANS.split('|').map(s => s.trim().toLowerCase()).includes(v), 'Answer: ' + q.ANS.split('|')[0].trim() + '. ' + (q.WHY || '')); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      card.append(inp, el('button', { class: 'btn pri', onclick: go }, 'Check')); setTimeout(() => inp.focus(), 30); }
  }
  paint(); show();
}

/* skill map for Progress: one tile per module, filled by its share of steps done */
function skillMap() {
  const sc = schedule();
  return el('section', { class: 'card pad stack' }, [el('h2', { text: 'Skill map' }), el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'Each tile is a module; it fills as you finish its steps and turns solid when it ships.' }),
    el('div', { class: 'gmap' }, MODS.filter(m => !isCC(m)).map(m => { const s = sc.span[m] || { n: 0, done: 0 }, p = s.n ? Math.round(100 * s.done / s.n) : 0;
      return el('a', { class: 'gtile' + (p === 100 ? ' full' : m === sc.cur ? ' cur' : ''), href: '#/learn/' + m, title: modTitle(m), 'aria-label': modLabel(m) + ' ' + modTitle(m) + ', ' + p + '% done' }, [el('i', { style: { height: p + '%' } }), el('b', { text: modLabel(m) })]); }))]);
}
