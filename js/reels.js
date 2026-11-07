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
async function reelsFor(m) {
  if (reelCache[m]) return reelCache[m];
  const s = await sprint(m).catch(() => null); if (!s) return [];
  const hand = ((DATA.reels || {})[m] || []), parts = (s.raw.chapter || '').split(/\n(?=## )/), out = [];
  parts.forEach((p, i) => {
    const head = (/^## (.+)/.exec(p.trim()) || [])[1]; if (!head) return;
    const h = hand.filter(r => r.sec === head.split(' ')[0] || r.sec === head).map(r => Object.assign({ head, m }, r));
    (h.length ? h : autoReels(m, head, p.replace(/^## .+\n/, ''), i)).forEach(r => out.push(r));
  });
  return (reelCache[m] = out);
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
  return q;
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

/* the player: a full-screen vertical card over the app */
async function vReels(id) {
  shell('Reels', 'Short explainers', [el('p', { class: 'muted', text: 'Loading reels…' })], { back: '#/today' });
  let q;
  if (id && reelMid(id)) { const rs = await reelsFor(reelMid(id)); const i = rs.findIndex(r => r.id === id); q = i >= 0 ? rs.slice(i) : rs; }
  else q = await reelQueue();
  if (!q.length) { $('#page').textContent = ''; $('#page').appendChild(el('section', { class: 'card pad' }, el('p', { text: 'No reels for this week yet.' }))); return; }
  reelPlayer(q);
}
function reelPlayer(q) {
  let qi = 0, bi = 0, playing = false, timer = null, utter = null, started = false;
  const speed = () => +S.settings.reelSpeed || 1;
  const ov = el('div', { class: 'reelv', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Reels' });
  const close = () => { stop(); ov.remove(); if (history.length > 1) history.back(); else location.hash = '#/today'; };
  document.body.appendChild(ov);
  cleanup.push(() => { stop(); ov.remove(); });
  let audio = null;
  function stop() { clearTimeout(timer); timer = null; if (audio) { audio.onended = audio.onerror = null; audio.pause(); audio = null; } try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { } }
  function say(text, done, file) {
    stop();
    /* the recorded natural voice (Kokoro, Heart) when this beat has one and no device voice was picked */
    if (file && S.settings.reelVoice !== false && !S.settings.reelVoiceName) {
      audio = new Audio(file); audio.playbackRate = speed(); audio.preservesPitch = true;
      audio.onended = () => done(); audio.onerror = () => { audio = null; say(text, done); };
      audio.play().catch(() => { audio = null; say(text, done); }); return;
    }
    if (speakOK()) { utter = new SpeechSynthesisUtterance(text); const v = reelVoice(); if (v) utter.voice = v; utter.rate = speed() * 0.97; utter.pitch = 1; utter.onend = () => { if (utter && utter._me === myTok) done(); }; const myTok = utter._me = Math.random(); speechSynthesis.speak(utter);
      timer = setTimeout(() => { if (playing && !speechSynthesis.speaking) done(); }, (text.split(' ').length / 2.2 / speed() + 3) * 1000); } /* safety net if the voice never reports the end */
    else timer = setTimeout(done, (text.split(' ').length / 2.5 / speed()) * 1000);
  }
  function play() { playing = true; started = true; draw(); runBeat(); }
  function pause() { playing = false; stop(); draw(); }
  function runBeat() { const r = q[qi]; if (!playing || bi >= r.beats.length) return; say(r.beats[bi].say, () => { if (!playing) return; bi++; draw(); if (bi < r.beats.length) runBeat(); else { playing = false; reelDone(r); draw(); } }, r.beats[bi].audio); }
  function goBeat(d) { const r = q[qi]; stop(); bi = Math.max(0, Math.min(r.beats.length, bi + d)); if (bi >= r.beats.length) { playing = false; reelDone(r); } draw(); if (playing) runBeat(); }
  function goReel(d) { const n = qi + d; if (n < 0 || n >= q.length) { if (d > 0) { toast('That was the last reel in this feed.'); } return; } stop(); qi = n; bi = 0; const was = started; draw(); if (was) { playing = true; runBeat(); draw(); } }
  function reelDone(r) { S.reels = S.reels || {}; const x = S.reels[r.id] = S.reels[r.id] || {}; if (!x.seen) { x.seen = iso(new Date()); if (typeof gameNote === 'function') gameNote('reel'); } save(); }
  function draw() {
    const r = q[qi], end = bi >= r.beats.length, b = r.beats[Math.min(bi, r.beats.length - 1)];
    ov.textContent = '';
    const bars = el('div', { class: 'rbars' }, r.beats.concat([null]).map((_, i) => el('i', { class: i < bi ? 'on' : i === bi ? 'cur' : '' })));
    const head = el('div', { class: 'rhead' }, [el('button', { class: 'rbtn', 'aria-label': 'Close reels', onclick: close }, '✕'), el('div', { class: 'grow' }, [el('b', { text: r.title + (r.part ? ' · ' + r.part : '') }), el('span', { text: modLabel(r.m) + ' · ' + (r.head || r.sec) + ' · ' + reelSecs(r) + ' s' + (r.auto ? ' · quick reel' : '') })]), el('span', { class: 'rcount', text: (qi + 1) + '/' + q.length })]);
    const stage = el('div', { class: 'rstage' }, end ? reelEnd(r, () => goReel(1), () => { bi = 0; play(); }) : [reelShow(b.show || {}), el('p', { class: 'rcap', 'aria-live': 'polite', text: b.say })]);
    const ctl = el('div', { class: 'rctl' }, [
      el('button', { class: 'rbtn', 'aria-label': 'Previous reel', onclick: () => goReel(-1) }, '↑'),
      el('button', { class: 'rbtn', 'aria-label': 'Previous point', onclick: () => goBeat(-1) }, '‹'),
      el('button', { class: 'rbtn rplay', 'aria-label': playing ? 'Pause' : 'Play', onclick: () => playing ? pause() : (end ? (bi = 0, play()) : play()) }, playing ? '❚❚' : '▶'),
      el('button', { class: 'rbtn', 'aria-label': 'Next point', onclick: () => goBeat(1) }, '›'),
      el('button', { class: 'rbtn', 'aria-label': 'Next reel', onclick: () => goReel(1) }, '↓'),
      el('button', { class: 'rbtn rsm', 'aria-label': 'Speed ' + speed() + 'x', onclick: () => { const v = { 1: 1.25, 1.25: 1.5, 1.5: 1 }[speed()] || 1; S.settings.reelSpeed = v; save(); draw(); if (playing) runBeat(); } }, speed() + '×'),
      el('button', { class: 'rbtn rsm', 'aria-label': 'Choose a voice: ' + (S.settings.reelVoice === false ? 'off' : ((reelVoice() || {}).name || 'default')), onclick: () => { const was = playing; pause(); ov.appendChild(reelVoiceSheet(() => { draw(); if (was) play(); })); } }, S.settings.reelVoice === false ? 'Muted' : 'Voice')]);
    ov.append(bars, head, stage, ctl);
    if (!started && !end) ov.appendChild(el('button', { class: 'rstart', onclick: play }, [el('b', { text: '▶ Play' }), el('span', { text: 'Swipe up for the next reel · tap left or right to step' })]));
  }
  /* gestures: swipe up or down changes reel; a tap on the left or right third steps */
  let t0 = null;
  ov.addEventListener('touchstart', e => { const t = e.touches[0]; t0 = [t.clientX, t.clientY, Date.now()]; }, { passive: true });
  ov.addEventListener('touchend', e => { if (!t0) return; const t = e.changedTouches[0], dx = t.clientX - t0[0], dy = t.clientY - t0[1]; const tgt = e.target; t0 = null;
    if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) { goReel(dy < 0 ? 1 : -1); return; }
    if (tgt.closest('button,a,input,label')) return;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && tgt.closest('.rstage')) { const w = innerWidth; if (t.clientX < w / 3) goBeat(-1); else if (t.clientX > 2 * w / 3) goBeat(1); else (playing ? pause() : play()); } });
  let wheelAt = 0;
  ov.addEventListener('wheel', e => { if (Date.now() - wheelAt < 700 || Math.abs(e.deltaY) < 30) return; wheelAt = Date.now(); goReel(e.deltaY > 0 ? 1 : -1); }, { passive: true });
  const key = e => { if (!document.body.contains(ov)) return document.removeEventListener('keydown', key); if (e.key === 'ArrowDown') goReel(1); else if (e.key === 'ArrowUp') goReel(-1); else if (e.key === 'ArrowRight') goBeat(1); else if (e.key === 'ArrowLeft') goBeat(-1); else if (e.key === 'Escape') close(); else if (e.key === ' ') { e.preventDefault(); playing ? pause() : play(); } else return; };
  document.addEventListener('keydown', key);
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause(); });
  draw();
  ov.querySelector('.rstart, .rplay').focus();
}
/* the end card: a quick check that schedules reviews, then the work checklist */
function reelEnd(r, next, replay) {
  const x = (S.reels || {})[r.id] || {}, kids = [];
  if (r.check) {
    const c = r.check, res = el('div', { role: 'status' });
    const opts = el('div', { class: 'stack', style: { gap: '6px' } }, c.opts.map((o, i) => el('button', { class: 'btn ropt' + (x.ans === i ? (i === c.ans ? ' ok' : ' no') : ''), onclick: () => {
      S.reels = S.reels || {}; const y = S.reels[r.id] = S.reels[r.id] || {}, ok = i === c.ans, wasDue = reelDue(r.id); y.ans = i; y.ok = ok;
      if (!ok) { y.box = 0; y.due = iso(new Date(Date.now() + REEL_GAPS[0] * 864e5)); }
      else if (wasDue || y.box) { y.box = (y.box || 0) + 1; y.due = y.box < REEL_GAPS.length ? iso(new Date(Date.now() + REEL_GAPS[y.box] * 864e5)) : null; }
      else if (!wasDue) y.due = y.due && y.due > iso(new Date()) ? y.due : null;
      if (ok && typeof blip === 'function') blip(true);
      save(); opts.querySelectorAll('button').forEach((b, j) => { b.classList.toggle('ok', j === c.ans); b.classList.toggle('no', j === i && !ok); });
      res.textContent = (ok ? 'Right. ' : 'Not quite: this reel comes back in 3 days. ') + c.why; } }, o)));
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
