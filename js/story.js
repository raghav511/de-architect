/* Data Architect · the Meridian series (ENGAGE, user-approved 2026-11-08: light story, recall before the plan).
   Five seasons follow Marcus Bell, Meridian's new staff data architect (data/story.json, bible in qa/story/BIBLE.md). Each day
   is an episode: Today opens with "Previously on Meridian", a short scene and the day's recall before the plan (skippable); the
   finished set ends on "Tomorrow on Meridian", a one-line hook and a one-tap plan for tomorrow, with no autoplay; the Sunday
   boss round is the week's finale. The story
   only frames the day's real work, and Profile › Look › Meridian story turns the text off. State S.story[date] =
   { m, i, open, plan }, merged per date. Loaded before app.js. */
'use strict';

function storyOn() { return S.settings.story !== 'off'; }
function storyData() {
  if (DATA.story) return Promise.resolve(DATA.story);
  if (!DATA.storyP) DATA.storyP = fetch('data/story.json').then(r => r.json()).then(d => (DATA.story = d)).catch(() => (DATA.story = { seasons: [], cast: [] }));
  return DATA.storyP;
}
function storyArcs() { const d = DATA.story || {}, out = {}; (d.seasons || []).forEach(s => (s.modules || []).forEach((a, j) => { out[a.mid] = Object.assign({ season: s.season, stitle: s.title, n: j + 1 }, a); })); return out; }
function storyState(k) { S.story = S.story || {}; return S.story[k]; }
/* the episode of day k: today's module and how many earlier days it has run (scene index, 0 to 5) */
function storyDay(k) {
  S.story = S.story || {};
  if (S.story[k] && S.story[k].m) return S.story[k];
  const sc = schedule(), m = MODS[dayCurIdx(sc)] || sc.cur; if (!m || isCC(m)) return null;
  const i = Math.min(5, Object.entries(S.story).filter(([d, x]) => d < k && x && x.m === m).length);
  if (k === iso(new Date())) { S.story[k] = Object.assign({}, S.story[k], { m, i }); save(false); }
  return { m, i };
}
function storyModDone(m) { const us = schedule().units.filter(u => u.mid === m); return us.length > 0 && us.every(u => u.isDone); }
function storyTag(a) { return 'S' + a.season + ' · E' + a.n + ' · ' + a.ep; }

/* Previously on Meridian: the scene and today's recall, before the plan. Returns null once opened or skipped today. */
function storyColdOpen(k) {
  const st = storyDay(k), r = typeof recallItem === 'function' ? recallItem() : null, recallDue = r && !r.auto;
  if (!st || (storyState(k) || {}).open) return null;
  if (!Object.keys(S.dayset || {}).some(d => d < k) && !Object.keys(S.story || {}).some(d => d < k)) return null; /* "Previously on" needs a previous episode: from the second day */
  if (!recallDue && !storyOn()) return null;
  const mark = () => { S.story[k] = Object.assign({}, S.story[k], { open: Date.now() }); save(); };
  const scene = el('p', { class: 'storyscene', style: { margin: 0, fontSize: '16px', lineHeight: 1.5 } });
  const ask = el('p', { class: 'storyrecall muted', style: { margin: 0, fontSize: '15px', fontStyle: 'italic' } }), go = el('a', { class: 'btn storygo', hidden: 'hidden', onclick: () => mark(), text: 'Open the scene\'s practice' }); /* recall[i] and to[i] from tools/story (w3) */
  const tag = el('span', { class: 'upn storytag', text: storyOn() ? 'Previously on Meridian' : 'Start with recall' });
  if (storyOn()) storyData().then(() => { const a = storyArcs()[st.m]; if (a) { tag.textContent = 'Previously on Meridian · ' + storyTag(a); scene.textContent = a.scenes[st.i] || a.scenes[a.scenes.length - 1];
    const q = (a.recall || [])[st.i], h = (a.to || [])[st.i]; if (q) ask.textContent = q; else ask.remove(); if (h && /^#\//.test(h)) { go.href = h; go.hidden = false; } } });
  return el('section', { class: 'card pad storyopen storycard' }, [el('div', {}, [el('div', { class: 'stack', style: { gap: '10px' } }, [tag, storyOn() ? scene : null, storyOn() ? ask : null,
    recallDue ? el('span', { class: 'muted', style: { fontSize: '14.5px' }, text: 'First, answer ' + r.t.replace(/^Recall · /, '').replace(/ from memory$/, '') + ' from memory: what you learned on earlier days, before today starts.' }) : null,
    el('div', { class: 'row wrap acts', style: { gap: '8px' } }, [recallDue ? el('a', { class: 'btn pri', href: '#/recall', onclick: mark, text: 'Recall · ' + r.mins + ' min' }) : el('button', { class: 'btn pri', onclick: () => { mark(); route(); }, text: 'Start today\'s episode' }),
      recallDue ? el('button', { class: 'btn', onclick: () => { mark(); route(); }, text: 'Skip to today\'s plan' }) : null, storyOn() ? go : null])])])]);
}

/* the end of the day: no autoplay, a hard stop, tomorrow's hook and a one-tap plan for tomorrow */
function storyCliff(k) {
  const st = storyDay(k); if (!st) return null;
  const tm = dayAdd(k, 1), plan = (storyState(tm) || {}).plan, time = S.settings.studyTime || '07:00';
  const hook = el('p', { style: { margin: 0, fontSize: '16px', lineHeight: 1.5 } }), tag = el('span', { class: 'upn storytag', text: 'That\'s today\'s episode' });
  const ahead = el('a', { class: 'btn storygo', hidden: 'hidden', text: 'Look ahead' }); /* to[i + 1]: where tomorrow's scene leads; a link, nothing plays */
  const nxt = (() => { try { const it = daySet(tm).find(x => !x.done); return it ? (it.unit ? it.unit.title : it.x.t) : ''; } catch (e) { return ''; } })();
  if (nxt) { tag.textContent = 'Tomorrow'; hook.textContent = 'Up first: ' + nxt + '.'; } /* plain text when the story is off or a scene is missing */
  if (storyOn()) storyData().then(() => { const A = storyArcs(), a = A[st.m]; if (!a) return;
    if (storyModDone(st.m)) { tag.textContent = 'Season ' + a.season + ' · ' + a.ep + ' · finale'; hook.textContent = a.finale; }
    else { tag.textContent = 'Tomorrow on Meridian'; hook.textContent = a.teasers[st.i] || a.teasers[a.teasers.length - 1]; const h = (a.to || [])[Math.min(st.i + 1, 5)]; if (h && /^#\//.test(h)) { ahead.href = h; ahead.hidden = false; } } });
  return el('section', { class: 'card pad storycliff storycard' }, [el('div', {}, [el('div', { class: 'stack', style: { gap: '10px' } }, [tag, storyOn() || nxt ? hook : null,
    el('span', { class: 'muted', style: { fontSize: '14.5px' }, text: 'Today\'s set is done. Nothing plays next; One more in each tab is there if you want it.' }),
    el('div', { class: 'row wrap acts', style: { gap: '8px' } }, [plan ? el('span', { class: 'chip c-core', text: 'Tomorrow at ' + plan + ' · planned' }) : el('button', { class: 'btn pri', onclick: () => { S.story = S.story || {}; S.story[tm] = Object.assign({}, S.story[tm], { plan: time }); save(); storyIcs(tm, time); route(); }, text: 'Plan tomorrow at ' + time }),
      el('a', { class: 'btn', href: '#/story', text: 'The series' }), storyOn() ? ahead : null]),
    plan ? storyIcsCopy(tm, plan) : null])])]);
}
/* where a download cannot run (an embedded copy, some in-app browsers): the calendar text to copy instead */
function storyIcsCopy(k, time) {
  const ics = storyIcsText(k, time), box = el('textarea', { class: 'storyics', readonly: 'readonly', rows: 4, 'aria-label': 'Calendar file text', style: { width: '100%', fontSize: '12.5px' } }); box.value = ics;
  return el('details', { class: 'storyicsd' }, [el('summary', { class: 'tlink', text: 'No calendar file? Copy it instead' }),
    el('p', { class: 'muted', style: { margin: '6px 0', fontSize: '14px' }, text: 'Paste it into a new file named tomorrow.ics, or add the event by hand at ' + time + '.' }), box,
    el('button', { class: 'btn sm', onclick: e => { const b = e.currentTarget; (navigator.clipboard ? navigator.clipboard.writeText(ics) : Promise.reject()).then(() => { b.textContent = 'Copied'; }, () => { box.select(); b.textContent = 'Select all, then copy'; }); }, text: 'Copy' })]);
}
/* a one-event calendar file for tomorrow's episode, made on the device */
function storyIcsText(k, time) {
  const d = k.replace(/-/g, ''), t = time.replace(':', '') + '00', end = String(+time.slice(0, 2) + 1).padStart(2, '0') + time.slice(3) + '00';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Data Architect//EN', 'BEGIN:VEVENT', 'UID:da-' + d + '@data-architect', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', 'DTSTART:' + d + 'T' + t, 'DTEND:' + d + 'T' + end, 'SUMMARY:Data Architect: today\'s episode', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return ics;
}
function storyIcs(k, time) {
  const ics = storyIcsText(k, time);
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'data-architect-' + k + '.ics'; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { }
}
/* the Sunday boss round, framed as the week's finale */
function storyBoss(k) { const r = storyBossLine(k); if (!storyOn() || !DATA.story) return r.trim(); const st = storyDay(k), a = st && storyArcs()[st.m]; return r + (a ? a.boss : ''); }

/* ---------------- ENGAGE 2, 4, 5: arcs frame the work, the weekend finale with a rematch, the season map ---------------- */
/* XP earned in a module's steps and what they are worth (the same weights as modXP) */
function storyModXP(m) { const us = schedule().units.filter(u => u.mid === m), w = u => XP_KIND[u.kind] || 10; return [us.filter(u => u.isDone).reduce((s, u) => s + w(u), 0), us.reduce((s, u) => s + w(u), 0)]; }
function storySeasonOf(m) { const d = DATA.story || {}; return (d.seasons || []).find(s => (s.modules || []).some(a => a.mid === m)) || null; }
/* one line that puts the module's work inside its episode: on the module card, the module's Path page and its week steps */
function storyFrame(m, opts) {
  if (!storyOn() || !m || isCC(m)) return null;
  const line = el('p', { class: 'storyframe muted', style: { margin: 0, fontSize: '14px' } });
  storyData().then(() => { const a = storyArcs()[m]; if (!a) { line.remove(); return; }
    const s = storySeasonOf(m), mods = s ? s.modules.map(x => x.mid) : [m], [xa, xb] = mods.reduce((t, x) => { const v = storyModXP(x); return [t[0] + v[0], t[1] + v[1]]; }, [0, 0]);
    const [ma] = storyModXP(m), fresh = schedule().units.filter(u => u.mid === m && u.kind === 'learn').every(u => !u.isDone);
    line.textContent = 'Meridian · ' + storyTag(a) + (opts && opts.short ? '' : ': ' + a.logline) + (opts && opts.season ? ' · season ' + xa + ' / ' + xb + ' XP' : '') + (opts && opts.season && fresh && ma > 0 ? ' · you start this episode with ' + ma + ' XP from work you already did' : ''); });
  return line;
}
/* the Sunday boss round is the week's finale; a result under 3.0 opens a rematch next Sunday, never a loss */
const STORY_PASS = 3.0;
function storySunday(d) { return new Date(d + 'T00:00:00').getDay() === 0; }
function storyBossAvg(x) { const v = Object.values((x && x.ans) || {}).map(liveAvg).filter(n => !isNaN(n)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; }
function storyRematch(k) {
  const bs = Object.entries(S.live || {}).filter(([d, x]) => d < k && x && x.done && x.kind === 'we' && storySunday(d)).sort((a, b) => b[0].localeCompare(a[0]));
  const last = bs[0]; if (!last) return null; const av = storyBossAvg(last[1]);
  return !isNaN(av) && av < STORY_PASS ? { date: last[0], avg: av, m: last[1].mod } : null;
}
function storyFinaleNote(k, x, avg) {
  if (!storyOn() || !x || x.kind !== 'we' || !storySunday(k)) return null;
  const a = DATA.story && storyArcs()[x.mod], ep = a ? a.ep : modTitle(x.mod), pass = avg >= STORY_PASS;
  return el('div', { class: 'why storyfinale' }, [el('b', { text: (pass ? 'Finale passed: ' : 'Finale, round one: ') + ep + '. ' }),
    pass ? 'The week\'s incident review is closed.' : 'A rematch opens next Sunday on the same arc. It is practice, never a loss: your weakest answers come back first.']);
}
function storyBossLine(k) { const r = storyOn() && storyRematch(k); return r ? 'Rematch: last Sunday\'s finale scored ' + r.avg.toFixed(1) + '. ' + ((DATA.story && DATA.story.rematch) ? DATA.story.rematch + ' ' : '') : ''; }

/* ---------------- the series page ---------------- */
async function vStory() {
  shell('Meridian', 'The series', [el('p', { class: 'muted', text: 'Loading…' })], { back: '#/today' });
  const d = await storyData(), A = storyArcs(), k = iso(new Date()), st = storyDay(k) || {}, page = $('#page'); page.textContent = '';
  const seen = {}; Object.values(S.story || {}).forEach(x => { if (x && x.m) seen[x.m] = Math.max(seen[x.m] || 0, (x.i || 0) + 1); });
  page.appendChild(el('section', { class: 'card pad stack' }, [el('p', { style: { margin: 0 }, text: d.logline || 'Marcus Bell joins Meridian as its first staff data architect. Each day of your plan is an episode of his first two years.' }),
    el('div', { class: 'row wrap', style: { gap: '10px' } }, [el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'The story frames each day\'s lesson; turn it off in Profile › Look.' }), el('a', { class: 'btn sm', href: '#/today', text: 'Today\'s episode' })])]));
  if (d.cast && d.cast.length) page.appendChild(el('details', { class: 'card pad' }, [el('summary', { text: 'The cast' }), el('ul', { style: { margin: '10px 0 0' } }, d.cast.map(c => el('li', {}, [el('b', { text: c.name + ': ' }), c.role])))]));
  (d.seasons || []).forEach(s => {
    const mods = (s.modules || []).map(a => a.mid), done = mods.filter(storyModDone).length, here = mods.includes(st.m);
    page.appendChild(el('details', Object.assign({ class: 'card pad stack' }, here ? { open: 'open' } : {}), [el('summary', {}, [el('b', { text: 'Season ' + s.season + ': ' + s.title }), el('span', { class: 'muted', text: ' · ' + done + ' of ' + mods.length + ' episodes' })]),
      el('p', { class: 'muted', style: { margin: '8px 0' }, text: s.logline }),
      el('div', { class: 'storymap', role: 'list', 'aria-label': 'Season ' + s.season + ' episodes' }, (s.modules || []).map((a, j) => { const [xa, xb] = storyModXP(a.mid), fin = storyModDone(a.mid), now = a.mid === st.m;
        return el('a', { class: 'storytile' + (fin ? ' done' : now ? ' now' : ''), role: 'listitem', href: '#/path/' + a.mid, 'aria-label': 'Episode ' + (j + 1) + ', ' + a.ep + ': ' + xa + ' of ' + xb + ' XP' + (fin ? ', done' : now ? ', now' : '') }, [
          el('b', { text: (fin ? '✓ ' : '') + 'E' + (j + 1) }), el('span', { text: a.ep }), el('i', { class: 'bar' }, el('i', { style: { width: (xb ? Math.round(100 * xa / xb) : 0) + '%' } }))]); })),
      el('ol', { class: 'stack', style: { gap: '10px', margin: 0, paddingLeft: '20px' } }, (s.modules || []).map(a => { const n = seen[a.mid] || 0, fin = storyModDone(a.mid);
        return el('li', {}, [el('b', { text: a.ep }), el('span', { class: 'muted', text: ' · module ' + modLabel(a.mid) + (fin ? ' · done' : a.mid === st.m ? ' · now' : '') }),
          n || fin ? el('p', { style: { margin: '4px 0 0', fontSize: '14.5px' }, text: a.logline }) : el('p', { class: 'muted', style: { margin: '4px 0 0', fontSize: '14px' }, text: 'Coming up.' }),
          n ? el('details', {}, [el('summary', { class: 'tlink', text: 'Scenes so far (' + Math.min(n, a.scenes.length) + ')' }), el('ol', { style: { fontSize: '14.5px' } }, a.scenes.slice(0, n).map(x => el('li', { text: x })))]) : null,
          fin && a.zoe ? el('p', { class: 'muted', style: { margin: '4px 0 0', fontSize: '14px' }, text: 'At dinner: ' + a.zoe }) : null]); }))]));
  });
}
