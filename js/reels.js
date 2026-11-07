/* Data Architect · reels: 30 to 60 second narrated explainers for every chapter section (#/reels, #/reels/ID).
   Hand-written scripts live in data/reels.json (built by tools/reels/build.py); a section without one gets a quick reel
   made from its own bold key points. The device's voice reads each beat with captions; tap to step, swipe up for the
   next reel. Each reel ends with a quick check (missed checks come back after 3, 7 and 21 days) and a "use it at work"
   list you can save to My playbook (#/playbook). State: S.reels[id], S.playbook[id]. Loaded before app.js. */
'use strict';
const REEL_GAPS = [3, 7, 21];
const reelCache = {};
const reelWords = r => r.beats.reduce((a, b) => a + (b.say.match(/\S+/g) || []).length, 0);
const reelSecs = r => r.secs || Math.round(reelWords(r) / 2.5);
const reelMid = id => (/^(?:auto-)?([a-z]\d\d)/.exec(id || '') || [])[1];
const plainMd = s => String(s || '').replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
const firstSentences = (s, max) => { const ss = plainMd(s).match(/[^.!?]+[.!?]+(\s|$)/g) || [plainMd(s)]; let out = ''; for (const x of ss) { if ((out + x).split(' ').length > max && out) break; out += x; } return out.trim(); };

/* a quick reel from a section's own text: its opening sentence, then its bold key points, split into parts of at most ~140 words */
function autoReels(m, head, md, idx) {
  const lines = md.split('\n'), pts = [], extra = []; let fence = false, intro = '';
  for (const l of lines) {
    if (l.startsWith('```')) { fence = !fence; continue; }
    if (fence || /^\s*\|/.test(l) || /^#/.test(l) || /^<div/.test(l) || !l.trim()) continue;
    const b = /^\s*(?:[-*]|\d+\.)?\s*\*\*([^*]{2,80}?)\*\*[:.]?\s*(.*)$/.exec(l);
    if (b) { pts.push([plainMd(b[1]).replace(/[:.]$/, ''), firstSentences(b[2] || '', 34)]); continue; }
    if (!intro && !/^\s*[-*]/.test(l)) intro = firstSentences(l, 40); else (plainMd(l).match(/[^.!?]+[.!?]+/g) || []).forEach(s => extra.push(s.trim()));
  }
  if (!pts.length) lines.filter(l => l.trim() && !/^[#|`<\s-]/.test(l)).slice(1, 4).forEach(l => { const s = firstSentences(l, 34); if (s) pts.push([s.split(' ').slice(0, 5).join(' ') + '…', s]); });
  const hook = { say: plainMd(head.replace(/^[A-Z]?\d+(\.\d+)?\s+/, '')) + '. ' + (intro || ''), show: { t: 'big', text: head.replace(/^[A-Z]?\d+(\.\d+)?\s+/, ''), sub: 'Quick reel from the chapter' } };
  const beats = pts.filter(p => p[1] || p[0]).map(([k, v]) => ({ say: (k.endsWith('…') ? '' : k + '. ') + v, show: { t: 'big', text: k, sub: v.length > 120 ? v.slice(0, 117) + '…' : v } }));
  /* a short section still gets a 30-second reel: add its other sentences, two per beat */
  let have = reelWords({ beats: [hook].concat(beats) });
  for (let i = 0; i < extra.length && have < 75; i += 2) { const say = extra.slice(i, i + 2).join(' '); if (!say || say.split(' ').length < 4) continue; beats.push({ say, show: { t: 'big', text: say.split(' ').slice(0, 6).join(' ') + '…', sub: '' } }); have += say.split(' ').length; }
  const out = []; let cur = [hook], w = reelWords({ beats: cur });
  beats.forEach(b => { const n = reelWords({ beats: [b] }); if (w + n > 140 && cur.length > 1) { out.push(cur); cur = []; w = 0; } cur.push(b); w += n; });
  if (cur.length) out.push(cur);
  return out.map((bs, k) => ({ id: 'auto-' + m + '-' + idx + '-' + k, sec: head.split(' ')[0], head, title: head.replace(/^[A-Z]?\d+(\.\d+)?\s+/, ''), part: out.length > 1 ? (k + 1) + ' of ' + out.length : '', beats: bs, auto: true, m }));
}
/* every reel of a module in chapter order: hand-written ones for a section replace its quick reel */
/* reels teach concepts only: sections about the program itself (how it works, scoring, setup) get no reel */
const REEL_META = /^(?:[A-Z]?\d+(?:\.\d+)?\s+)?(how this (program|track) works|what a module contains|how scoring works|two rules about using ai|what happens after|why this sprint exists|what this sprint is for|why a data engineer needs this|setup|accounts|then start|from your lab to an interview story|after the program|the platform you will build|from a platform to a data foundation)/i;
async function reelsFor(m) {
  if (m === 's00') return [];
  if (reelCache[m]) return reelCache[m];
  await DATA.reelsP;
  const s = await sprint(m).catch(() => null); if (!s) return [];
  const hand = ((DATA.reels || {})[m] || []), parts = (s.raw.chapter || '').split(/\n(?=## )/), out = [];
  parts.forEach((p, i) => {
    const head = (/^## (.+)/.exec(p.trim()) || [])[1]; if (!head || REEL_META.test(head)) return;
    const h = hand.filter(r => r.sec === head.split(' ')[0] || r.sec === head).map(r => Object.assign({ head, m }, r));
    (h.length ? h : autoReels(m, head, p.replace(/^## .+\n/, ''), i)).forEach(r => out.push(r));
  });
  reelCarry(m, out);
  return (reelCache[m] = out);
}
/* a section's reels are rewritten with new ids (a four-level series replaces an older single reel): carry each old
   reel's history, such as a review due after a missed check, to the first new reel of the same section (QA fix 9) */
function reelCarry(m, list) {
  if (!((DATA.reels || {})[m] || []).length) return; /* scripts not loaded (offline): move nothing */
  const R = S.reels || {}, ids = new Set(list.map(r => r.id)), base = id => id.replace(/-w?\d+$/, ''); let moved = 0;
  for (const id of Object.keys(R)) { if (ids.has(id) || reelMid(id) !== m) continue; const to = list.find(r => base(r.id) === base(id) && !R[r.id]); if (to) { R[to.id] = Object.assign({}, R[id]); delete R[to.id].ans; delete R[to.id].q; delete R[id]; moved++; } }
  if (moved) save(false);
}
function reelDue(id) { const r = (S.reels || {})[id]; return r && r.due && r.due <= iso(new Date()); }
/* the feed: today's reading first, then the rest of this week's modules, then reels due for review */
async function reelQueue() {
  const sc = schedule(), k = iso(new Date()), today = (sc.byDay[k] || []).filter(u => u.kind === 'learn' && !isCC(u.mid));
  const week = typeof liveWeekMods === 'function' ? liveWeekMods(k) : [sc.cur], first = [], rest = [], due = [];
  for (const u of today) { const rs = await reelsFor(u.mid), r = /chapter\/(\d+)-(\d+)/.exec(u.href || ''), heads = (MOD[u.mid] || {}).ch || [];
    const want = r ? heads.slice(+r[1], +r[2] + 1) : heads; rs.filter(x => want.includes(x.head)).forEach(x => first.push(x)); }
  for (const m of week) (await reelsFor(m)).forEach(x => rest.push(x));
  for (const id of Object.keys(S.reels || {}).filter(reelDue)) { const m = reelMid(id); if (m) { const x = (await reelsFor(m)).find(y => y.id === id); if (x) due.push(x); } }
  const seen = new Set(), q = [];
  first.concat(rest.filter(x => !(S.reels || {})[x.id]), due, rest).forEach(x => { if (!seen.has(x.id)) { seen.add(x.id); q.push(x); } });
  /* a thin week (early in the program) continues with the next modules on the path */
  for (let j = MODS.indexOf(week[week.length - 1]) + 1; q.length < 10 && j < MODS.length; j++) (await reelsFor(MODS[j])).forEach(x => { if (!seen.has(x.id)) { seen.add(x.id); q.push(x); } });
  return q;
}

const REEL_TRACKS = [['all', 'Everything'], ['weak', 'Weak spots'], ['seen', 'Done before'], ['py', 'Python'], ['data', 'Data engineering'], ['model', 'Modelling'], ['sys', 'Systems and design'], ['ai', 'AI']];
const reelTrack = m => /^p/.test(m) ? 'py' : /^m/.test(m) ? 'model' : /^[ac]/.test(m) ? 'ai' : /^(d01|s10|j01|r01)$/.test(m) ? 'sys' : 'data';
async function reelShuffle(filter) {
  const all = (await Promise.all(MODS.filter(m => m !== 's00').map(m => reelsFor(m).catch(() => [])))).flat();
  const R = S.reels || {}, keep = r => filter === 'weak' ? (R[r.id] && (R[r.id].ok === false || reelDue(r.id))) : filter === 'seen' ? !!(R[r.id] && R[r.id].seen) : filter && filter !== 'all' ? reelTrack(r.m) === filter : true;
  const groups = {}; all.filter(keep).forEach(r => (groups[r.m + '|' + r.head] = groups[r.m + '|' + r.head] || []).push(r));
  const g = Object.values(groups);
  for (let i = g.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [g[i], g[j]] = [g[j], g[i]]; }
  return g.flat(); /* a random order of concepts; the levels of one concept stay together, in order */
}
function speakOK() { return 'speechSynthesis' in window && S.settings.reelVoice !== false; }
/* the most natural English voice on this device: Premium and Enhanced voices (downloaded in iOS or macOS settings) first,
   then the well-known natural ones; the learner's pick (S.settings.reelVoiceName) wins */
function reelVoices() {
  if (!('speechSynthesis' in window)) return [];
  const score = v => (/premium/i.test(v.name) ? 100 : /enhanced|neural|natural/i.test(v.name) ? 80 : 0) + (/Ava|Zoe|Evan|Nathan|Samantha|Serena|Allison|Susan|Isha|Siri|Aria|Jenny|Sonia|Google UK English Female|Google US English/i.test(v.name) ? 20 : 0) + (/^en[-_](US|GB|IN)/i.test(v.lang) ? 5 : 0) - (/Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Ralph|Kathy|Grandma|Grandpa|Rocko|Shelley|Sandy|Eddy|Flo|Reed/i.test(v.name) ? 200 : 0);
  return speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)).sort((a, b) => score(b) - score(a)).filter(v => score(v) > -100);
}
function reelVoice() { const vs = reelVoices(); return vs.find(v => v.name === S.settings.reelVoiceName) || vs[0] || null; }
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {};
function reelVoiceSheet(onPick) {
  const vs = reelVoices(), sample = 'Kafka never writes in scattered places. Each new message goes at the end, so the disk keeps streaming.';
  const cur = S.settings.reelVoice === false ? '' : S.settings.reelVoiceName ? (reelVoice() || {}).name : 'recorded';
  const sheet = el('div', { class: 'rsheet', role: 'dialog', 'aria-label': 'Choose a voice' }, [el('div', { class: 'row' }, [el('b', { class: 'grow', text: 'Voice' }), el('button', { class: 'rbtn', 'aria-label': 'Close', onclick: () => sheet.remove() }, '✕')]),
    el('span', { class: 'rnote', style: { textAlign: 'left' }, text: 'Hand-written reels use the recorded Heart voice. Quick reels fall back to a device voice below. Smoother device voices: on iPhone, Settings › Accessibility › Spoken Content › Voices › English, download a Premium voice (Ava, Zoe or Evan); on a Mac, System Settings › Accessibility › Spoken Content › System voice › Manage Voices. Then reopen this list.' }),
    el('div', { class: 'rvlist' }, [el('div', { class: 'row', style: { gap: '6px' } }, [el('button', { class: 'rvopt grow' + (cur === 'recorded' ? ' on' : ''), onclick: () => { S.settings.reelVoice = true; S.settings.reelVoiceName = ''; save(); sheet.remove(); onPick(); } }, 'Heart · natural recorded voice (recommended)'), el('button', { class: 'rbtn rsm', 'aria-label': 'Try Heart', onclick: () => { speechSynthesis.cancel(); new Audio('audio/reels/sample-heart.m4a').play().catch(() => {}); } }, 'Try')]), el('button', { class: 'rvopt' + (!cur ? ' on' : ''), onclick: () => { S.settings.reelVoice = false; save(); sheet.remove(); onPick(); } }, 'Voice off (captions only)')].concat(vs.slice(0, 12).map(v => el('div', { class: 'row', style: { gap: '6px' } }, [
      el('button', { class: 'rvopt grow' + (v.name === cur ? ' on' : ''), onclick: () => { S.settings.reelVoice = true; S.settings.reelVoiceName = v.name; save(); sheet.remove(); onPick(); } }, v.name + ' · ' + v.lang),
      el('button', { class: 'rbtn rsm', 'aria-label': 'Try ' + v.name, onclick: () => { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(sample); u.voice = v; u.rate = +S.settings.reelSpeed || 1; speechSynthesis.speak(u); } }, 'Try')]))))]);
  return sheet;
}

/* the player: a vertical feed like Shorts. Every reel is a full-screen slide that snaps; the slide in view plays,
   all others are silent; only the slides next to the current one are kept rendered, and the next reel's first
   recording is fetched ahead */
async function vReels(id) {
  shell('Reels', 'Short explainers', [el('p', { class: 'muted', text: 'Loading reels…' })], { back: '#/today' });
  let q, at = 0;
  const mode = S.settings.reelMode || 'shuffle';
  if (id && reelMid(id)) { q = await reelsFor(reelMid(id)); at = Math.max(0, q.findIndex(r => r.id === id)); }
  else q = mode === 'week' ? await reelQueue() : await reelShuffle(S.settings.reelFilter || 'all');
  if (!q.length && mode !== 'week') { toast('Nothing matches that filter yet. Showing everything.'); S.settings.reelFilter = 'all'; q = await reelShuffle('all'); }
  if (!q.length) { $('#page').textContent = ''; $('#page').appendChild(el('section', { class: 'card pad' }, el('p', { text: 'No reels for this week yet.' }))); return; }
  reelPlayer(q, at, !(id && reelMid(id)));
}
let reelUnlocked = false; /* browsers allow sound only after a first tap */
function reelPlayer(q, at, feedMode) {
  const speed = () => +S.settings.reelSpeed || 1;
  const ov = el('div', { class: 'reelv', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Reels' });
  const feed = el('div', { class: 'rfeed' });
  const slides = q.map((r, i) => el('section', { class: 'rslide', 'data-i': String(i), 'aria-label': r.title }));
  feed.append(...slides); ov.appendChild(feed);
  let cur = -1, C = null; /* C: the playing slide's controller */
  const close = () => { if (C) C.stop(); ov.remove(); if (history.length > 1) history.back(); else location.hash = '#/today'; };
  const mode = S.settings.reelMode || 'shuffle', setMode = (m, f) => { S.settings.reelMode = m; if (f) S.settings.reelFilter = f; save(); if (C) C.stop(); ov.remove(); vReels(); };
  const sw = feedMode ? el('div', { class: 'rmode', role: 'tablist', 'aria-label': 'Reel order' }, [['week', 'My week'], ['shuffle', 'Shuffle']].map(([k, n]) => el('button', { role: 'tab', 'aria-selected': String(mode === k), onclick: () => setMode(k) }, n))) : el('span', { class: 'grow' });
  const top = el('div', { class: 'rtop' }, [el('button', { class: 'rbtn', 'aria-label': 'Close reels', onclick: close }, '✕'), el('span', { class: 'grow' }), sw, el('span', { class: 'grow' }), el('span', { class: 'rcount' })]);
  if (feedMode && mode === 'shuffle') ov.classList.add('hasfilt'); /* room under the filter row for the reel title */
  if (feedMode && mode === 'shuffle') ov.appendChild(el('div', { class: 'rfilters', role: 'toolbar', 'aria-label': 'Shuffle filter' }, REEL_TRACKS.map(([k, n]) => el('button', { class: (S.settings.reelFilter || 'all') === k ? 'on' : '', 'aria-pressed': String((S.settings.reelFilter || 'all') === k), onclick: () => setMode('shuffle', k) }, n))));
  ov.appendChild(top);
  document.body.appendChild(ov);
  cleanup.push(() => { if (C) C.stop(); ov.remove(); });
  function controller(i) {
    const r = q[i], slide = slides[i];
    let bi = 0, playing = false, fx = null, audio = null, timer = null, tok = 0;
    const bars = el('div', { class: 'rbars' }), stage = el('div', { class: 'rstage' }), cap = el('p', { class: 'rcap', 'aria-live': 'polite' }), hint = el('div', { class: 'rtap' });
    const head = el('div', { class: 'rhead' }, [el('div', { class: 'grow' }, [r.level ? el('span', { class: 'rlevel', text: r.level }) : null, el('b', { text: r.title + (r.part ? ' · ' + r.part : '') }), el('span', { text: modLabel(r.m) + ' · ' + (r.head || r.sec) + ' · ' + reelSecs(r) + ' s' + (r.auto ? ' · quick reel' : '') })])]);
    const saved = () => !!(S.playbook || {})[r.id];
    const rail = el('div', { class: 'rrail' }, [
      el('button', { class: 'rbtn rheart' + (saved() ? ' on' : ''), 'aria-label': 'Save to My playbook', onclick: e => { if (!r.work) { toast('This quick reel has no work list yet.'); return; } S.playbook = S.playbook || {}; if (saved()) delete S.playbook[r.id]; else S.playbook[r.id] = { title: r.title, m: r.m, sec: r.head || r.sec, items: r.work, at: iso(new Date()) }; save(); e.currentTarget.classList.toggle('on', saved()); } }, '♥'),
      el('button', { class: 'rbtn rsm', 'aria-label': 'Speed', onclick: e => { S.settings.reelSpeed = { 1: 1.25, 1.25: 1.5, 1.5: 1 }[speed()] || 1; save(); e.currentTarget.textContent = speed() + '×'; if (playing) beat(); } }, speed() + '×'),
      el('button', { class: 'rbtn rsm', 'aria-label': 'Choose a voice', onclick: () => { const was = playing; pause(); ov.appendChild(reelVoiceSheet(() => { if (was) play(); })); } }, S.settings.reelVoice === false ? 'Muted' : 'Voice')]);
    slide.textContent = ''; slide.append(bars, head, stage, cap, rail, hint);
    function paintBars() { bars.textContent = ''; r.beats.concat([null]).forEach((_, k) => bars.appendChild(el('i', { class: k < bi ? 'on' : k === bi ? 'cur' : '' }))); }
    let wd = null; /* watchdog: a recording that stops arriving falls back to captions (QA fix 8) */
    function stop() { tok++; clearTimeout(timer); timer = null; clearInterval(wd); wd = null; if (audio) { audio.onended = audio.onerror = audio.onloadedmetadata = null; audio.pause(); audio = null; } try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { } if (fx) fx.stop(); }
    function render() {
      paintBars(); stage.textContent = '';
      if (bi >= r.beats.length) { cap.textContent = ''; stage.append(...reelEnd(r, () => go(i + 1), () => { bi = 0; play(); })); return null; }
      const b = r.beats[bi]; fx = FX.build(b.show || {}); stage.appendChild(fx.el); cap.textContent = b.say; return b;
    }
    function beat() {
      stop(); const b = render(); if (!b) { playing = false; reelDone(r); slide.classList.remove('playing'); return; }
      const my = tok, next = () => { if (my !== tok || !playing) return; bi++; beat(); };
      const est = (b.say.split(' ').length / 2.5 / speed()) * 1000;
      const viaVoice = () => { if (speakOK()) { /* no recording yet (or it failed): the best device voice reads it, never silence */ const u = new SpeechSynthesisUtterance(b.say), v = reelVoice(); if (v) u.voice = v; u.rate = speed() * 0.97; u.onend = next; speechSynthesis.speak(u); fx.start(est); timer = setTimeout(() => { if (!speechSynthesis.speaking) next(); }, est + 4000); } else { fx.start(est); timer = setTimeout(next, est); } };
      if (b.audio && S.settings.reelVoice !== false && !S.settings.reelVoiceName) {
        audio = new Audio(b.audio); audio.playbackRate = speed(); audio.preservesPitch = true;
        let started = false; const go2 = ms => { if (started || my !== tok) return; started = true; fx.start(ms); };
        audio.onloadedmetadata = () => go2(audio.duration * 1000 / speed());
        audio.onended = next; audio.onerror = () => { if (my === tok) { audio = null; viaVoice(); } };
        audio.play().then(() => setTimeout(() => go2(est), 250)).catch(() => { if (my === tok) { audio = null; viaVoice(); } });
        let last = -1, still = 0; wd = setInterval(() => { if (my !== tok || !audio) return clearInterval(wd); if (audio.paused && started) return; const ct = audio.currentTime; still = ct === last ? still + 1 : 0; last = ct; if (still >= 6) { clearInterval(wd); wd = null; const a0 = audio; audio = null; a0.onended = a0.onerror = null; a0.pause(); go2(est); timer = setTimeout(next, Math.max(1500, est - ct * 1000)); } }, 1000);
      } else if (S.settings.reelVoice === false) { fx.start(est); timer = setTimeout(next, est); }
      else viaVoice();
    }
    function play() { reelUnlocked = true; playing = true; slide.classList.add('playing'); hint.textContent = ''; beat(); }
    function pause() { playing = false; stop(); if (fx) fx.finish(); slide.classList.remove('playing'); }
    function step(d) { const was = playing; stop(); bi = Math.max(0, Math.min(r.beats.length, bi + d)); if (was && bi < r.beats.length) beat(); else { const b = render(); if (b && fx) fx.finish(); if (!b) { playing = false; reelDone(r); } } }
    /* taps: left third back, right third forward, middle pause or play (like stories) */
    slide.addEventListener('click', e => { if (e.target.closest('button,a,input,label,.rendcard,.rsheet')) return; const x = e.clientX - slide.getBoundingClientRect().left, w = slide.clientWidth; if (x < w / 3) step(-1); else if (x > 2 * w / 3) step(1); else (playing ? pause() : play()); });
    const b0 = render(); if (b0 && fx) fx.finish();
    return { play, pause, stop: () => { playing = false; stop(); slide.classList.remove('playing'); }, step, get playing() { return playing; }, slide };
  }
  const built = {};
  function activate(i) {
    if (i === cur || i < 0 || i >= q.length) return;
    if (C) { if (cur >= 0 && C.playing) mEvent('reel_skip'); C.stop(); }
    mEvent('reel_open');
    cur = i; top.querySelector('.rcount').textContent = (i + 1) + '/' + q.length;
    Object.keys(built).forEach(k => { if (Math.abs(+k - i) > 1) { slides[k].textContent = ''; delete built[k]; } }); /* keep only neighbours rendered */
    for (const k of [i - 1, i, i + 1]) if (k >= 0 && k < q.length && !built[k]) built[k] = controller(k);
    C = built[i];
    if (reelUnlocked) C.play(); else { const h = slides[i].querySelector('.rtap'); h.appendChild(el('button', { class: 'rstart', onclick: e => { e.stopPropagation(); C.play(); } }, [el('b', { text: '▶ Play' }), el('span', { text: 'Swipe up for the next reel · tap the sides to step' })])); }
    const nb = q[i + 1] && (q[i + 1].beats[0] || {}).audio; if (nb) { const a = new Audio(); a.preload = 'auto'; a.src = nb; } /* fetch the next reel's first line ahead */
  }
  function go(i) { if (i < 0 || i >= q.length) { if (i >= q.length) toast('That was the last reel in this feed.'); return; } feed.scrollTo({ top: slides[i].offsetTop, behavior: 'smooth' }); }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && e.intersectionRatio > 0.6) activate(+e.target.dataset.i); }), { root: feed, threshold: [0.6] });
  slides.forEach(s => io.observe(s));
  cleanup.push(() => io.disconnect());
  const key = e => { if (!document.body.contains(ov)) return document.removeEventListener('keydown', key); if (e.key === 'ArrowDown') { e.preventDefault(); go(cur + 1); } else if (e.key === 'ArrowUp') { e.preventDefault(); go(cur - 1); } else if (e.key === 'ArrowRight') C && C.step(1); else if (e.key === 'ArrowLeft') C && C.step(-1); else if (e.key === 'Escape') close(); else if (e.key === ' ') { e.preventDefault(); C && (C.playing ? C.pause() : C.play()); } };
  document.addEventListener('keydown', key);
  const vis = () => { if (document.hidden && C) C.pause(); }; document.addEventListener('visibilitychange', vis); cleanup.push(() => document.removeEventListener('visibilitychange', vis));
  requestAnimationFrame(() => { feed.scrollTop = slides[at].offsetTop; activate(at); });
  window.reelGo = go; /* tests */
}
function reelDone(r) { S.reels = S.reels || {}; const x = S.reels[r.id] = S.reels[r.id] || {}; if (typeof mEvent === 'function') mEvent('reel_finish'); if (!x.seen) { x.seen = iso(new Date()); if (typeof gameNote === 'function') gameNote('reel'); } save(); }
/* the end card: a quick check that schedules reviews, then the work checklist */
function reelEnd(r, next, replay) {
  const x0 = (S.reels || {})[r.id] || {}, x = r.check && x0.q && x0.q !== r.check.q ? Object.assign({}, x0, { ans: undefined }) : x0, kids = []; /* an answer to an older version of the question is not shown (QA fix 10) */
  if (r.check) {
    const c = r.check, res = el('div', { role: 'status' });
    /* a fresh order on every showing; y.ans stays the option's index in the reel file (unguessable answers, 1.36) */
    const order = seeded(c.opts.map((o, i) => i), newSeed());
    const opts = el('div', { class: 'stack', style: { gap: '6px' } }, order.map(i => el('button', { class: 'btn ropt' + (x.ans === i ? (i === c.ans ? ' ok' : ' no') : ''), 'data-i': i, onclick: () => {
      S.reels = S.reels || {}; const y = S.reels[r.id] = S.reels[r.id] || {}, ok = i === c.ans, wasDue = reelDue(r.id); y.ans = i; y.ok = ok; y.q = c.q; y.at = Date.now(); mEvent(ok ? 'check_right' : 'check_wrong');
      if (!ok) { y.box = 0; y.due = iso(new Date(Date.now() + REEL_GAPS[0] * 864e5)); }
      else if (wasDue || y.box) { y.box = (y.box || 0) + 1; y.due = y.box < REEL_GAPS.length ? iso(new Date(Date.now() + REEL_GAPS[y.box] * 864e5)) : null; }
      else if (!wasDue) y.due = y.due && y.due > iso(new Date()) ? y.due : null;
      if (ok && typeof blip === 'function') blip(true);
      save(); opts.querySelectorAll('button').forEach(b => { const j = +b.dataset.i; b.classList.toggle('ok', j === c.ans); b.classList.toggle('no', j === i && !ok); });
      res.textContent = (ok ? 'Right. ' : 'Not quite: this reel comes back in 3 days. ') + c.why; } }, c.opts[i])));
    kids.push(el('b', { class: 'rq', text: 'Quick check: ' + c.q }), opts, res);
  }
  if (r.work && r.work.length) {
    const saved = !!(S.playbook || {})[r.id];
    kids.push(el('b', { class: 'rq', text: 'Use it at work' }), el('ol', { class: 'rwork' }, r.work.map(w => el('li', { text: w }))),
      el('button', { class: 'btn', onclick: e => { S.playbook = S.playbook || {}; if (S.playbook[r.id]) delete S.playbook[r.id]; else S.playbook[r.id] = { title: r.title, m: r.m, sec: r.head || r.sec, items: r.work, at: iso(new Date()) }; save(); e.target.textContent = S.playbook[r.id] ? '✓ Saved to My playbook' : 'Save to My playbook'; } }, saved ? '✓ Saved to My playbook' : 'Save to My playbook'));
  }
  if (r.auto) kids.push(el('span', { class: 'muted', text: 'A quick reel made from the chapter text. Read the section for the full explanation.' }));
  kids.push(el('div', { class: 'row wrap' }, [el('button', { class: 'btn', onclick: replay }, 'Replay'), el('a', { class: 'btn', href: '#/learn/' + r.m + '/chapter', text: 'Read the section' }), el('span', { class: 'grow' }), el('button', { class: 'btn pri', onclick: next }, 'Next reel ↓')]));
  return [el('div', { class: 'stack rendcard' }, kids)];
}
/* one beat's picture */
function reelShow(s) {
  const t = s.t || 'big';
  if (t === 'code') return el('pre', { class: 'rcode', text: s.text });
  if (t === 'points') return el('ul', { class: 'rpoints' }, s.items.map(x => el('li', { text: x })));
  if (t === 'flow') return el('div', { class: 'rflow' }, s.items.map((x, i) => [i ? el('span', { class: 'rarrow', 'aria-hidden': 'true', text: '↓' }) : null, el('span', { class: 'rnode', text: x })]).flat().filter(Boolean).concat(s.note ? [el('span', { class: 'rnote', text: s.note })] : []));
  if (t === 'bars') { const mx = Math.max(...s.items.map(x => x[1])), lg = mx / Math.max(1e-9, Math.min(...s.items.map(x => x[1]))) > 1000;
    const w = v => lg ? Math.max(3, 100 * Math.log10(1 + v) / Math.log10(1 + mx)) : Math.max(3, 100 * v / mx);
    const box = el('div', { class: 'rbarsv' }, s.items.map(([l, v, n]) => el('div', { class: 'rbar' }, [el('span', { class: 'rbl', text: l }), el('span', { class: 'rbt' }, el('i', { style: { width: '0%' }, 'data-w': w(v) + '%' })), el('span', { class: 'rbv', text: v.toLocaleString() + ' ' + (s.unit || '') + (n ? ' · ' + n : '') })])).concat(lg ? [el('span', { class: 'rnote', text: 'bar lengths on a log scale' })] : []));
    setTimeout(() => box.querySelectorAll('i[data-w]').forEach(i => i.style.width = i.dataset.w), 60); return box; }
  if (t === 'disk') return el('div', { class: 'rdisk ' + (s.mode || 'random'), 'aria-label': s.mode === 'seq' ? 'The arm stays still and data goes down in one run' : 'The arm jumps to a new place for every write', role: 'img', html: '<svg viewBox="0 0 200 140"><circle cx="80" cy="70" r="62" fill="#F8F9F5" stroke="#C9CFC4" stroke-width="2"/><circle cx="80" cy="70" r="8" fill="#C9CFC4"/>' + (s.mode === 'seq' ? '<path d="M80 22 A48 48 0 0 1 128 70" stroke="#0B7A67" stroke-width="7" fill="none" stroke-linecap="round" class="rseq"/>' : '<circle cx="50" cy="40" r="5" fill="#E08A1E"/><circle cx="118" cy="98" r="5" fill="#E08A1E"/><circle cx="104" cy="30" r="5" fill="#E08A1E"/><circle cx="44" cy="102" r="5" fill="#E08A1E"/>') + '<g class="rarm"><line x1="185" y1="125" x2="110" y2="55" stroke="#12202F" stroke-width="5" stroke-linecap="round"/><circle cx="185" cy="125" r="8" fill="#12202F"/></g></svg>' });
  if (t === 'shift') return el('div', { class: 'rshift', role: 'img', 'aria-label': 'Removing the first item shifts every other item one place left' }, ['a', 'b', 'c', 'd', 'e', 'f'].map((x, i) => el('span', { class: i === 0 ? 'gone' : 'mv', text: x })));
  if (t === 'fig' && typeof FIGS !== 'undefined') return el('div', { class: 'rfig', html: FIGS.svgOf(s.name, s.step) });
  return el('div', { class: 'rbig' }, [el('b', { text: s.text || '' }), s.sub ? el('span', { text: s.sub }) : null]);
}

/* a button under a chapter heading for that section's reels */
function reelButton(rs) {
  const secs = rs.reduce((a, r) => a + reelSecs(r), 0), mm = Math.floor(secs / 60), ss = String(secs % 60).padStart(2, '0');
  return el('a', { class: 'rsec', href: '#/reels/' + rs[0].id, 'aria-label': 'Watch ' + (rs.length > 1 ? rs.length + ' reels' : 'the reel') + ' for this section, ' + secs + ' seconds' }, [el('span', { class: 'rsecp', 'aria-hidden': 'true', text: '▶' }), el('span', { text: rs.length > 1 ? rs.length + ' reels · ' + mm + ':' + ss : 'Reel · ' + secs + ' s' }), rs[0].auto ? el('span', { class: 'muted', text: 'quick' }) : null]);
}
async function reelMount(m, ch) {
  const rs = await reelsFor(m);
  ch.querySelectorAll('h2').forEach(h => { const head = h.textContent.trim(), mine = rs.filter(r => r.head === head); if (mine.length && document.body.contains(h)) h.after(reelButton(mine)); });
}
/* Today: the reels for today's reading, below the plan */
async function reelToday() {
  const q = (await reelQueue()).slice(0, 8);
  if (!q.length) return null;
  return el('section', { class: 'card pad stack rtoday' }, [el('div', { class: 'row' }, [el('h2', { class: 'grow', text: 'Reels for today' }), el('a', { class: 'btn pri sm', href: '#/reels', text: '▶ Play all' })]),
    el('div', { class: 'rstrip' }, q.map(r => el('a', { class: 'rthumb' + ((S.reels || {})[r.id] && !reelDue(r.id) ? ' seen' : ''), href: '#/reels/' + r.id }, [el('b', { text: r.title }), el('span', { text: modLabel(r.m) + ' · ' + reelSecs(r) + ' s' + (reelDue(r.id) ? ' · review' : '') })])))]);
}
/* My playbook: every saved "use it at work" list */
function vPlaybook() {
  const P = S.playbook || {}, ids = Object.keys(P).sort((a, b) => MODS.indexOf(P[a].m) - MODS.indexOf(P[b].m));
  const list = el('div', { class: 'stack' }), inp = el('input', { class: 'btn', type: 'search', placeholder: 'Search your playbook', 'aria-label': 'Search your playbook', style: { width: '100%', justifyContent: 'flex-start' } });
  const paint = () => { const s = inp.value.trim().toLowerCase(); list.textContent = ''; const hit = ids.filter(id => !s || (P[id].title + ' ' + P[id].items.join(' ')).toLowerCase().includes(s));
    if (!hit.length) list.appendChild(el('p', { class: 'muted', text: ids.length ? 'Nothing matches.' : 'Save the "Use it at work" list at the end of any reel and it appears here.' }));
    hit.forEach(id => list.appendChild(el('section', { class: 'card pad stack' }, [el('div', { class: 'row wrap' }, [el('b', { class: 'grow', text: P[id].title }), el('span', { class: 'muted', style: { fontSize: '13px' }, text: modLabel(P[id].m) + ' · ' + P[id].sec })]), el('ol', { style: { margin: 0, paddingLeft: '20px' } }, P[id].items.map(x => el('li', { text: x }))), el('div', { class: 'row' }, [el('a', { class: 'btn sm', href: '#/reels/' + id, text: '▶ Watch again' }), el('button', { class: 'btn sm', onclick: () => { delete S.playbook[id]; save(); route(); } }, 'Remove')])]))); };
  inp.addEventListener('input', paint);
  shell('My playbook', ids.length + ' saved · what to do at work', [inp, list]); paint();
}
