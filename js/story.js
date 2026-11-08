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
  const tag = el('span', { class: 'upn storytag', text: storyOn() ? 'Previously on Meridian' : 'Start with recall' });
  if (storyOn()) storyData().then(() => { const a = storyArcs()[st.m]; if (a) { tag.textContent = 'Previously on Meridian · ' + storyTag(a); scene.textContent = a.scenes[st.i] || a.scenes[a.scenes.length - 1]; } });
  return el('section', { class: 'card pad storyopen storycard' }, [el('div', {}, [el('div', { class: 'stack', style: { gap: '10px' } }, [tag, storyOn() ? scene : null,
    recallDue ? el('span', { class: 'muted', style: { fontSize: '14.5px' }, text: 'First, answer ' + r.t.replace(/^Recall · /, '').replace(/ from memory$/, '') + ' from memory: what you learned on earlier days, before today starts.' }) : null,
    el('div', { class: 'row wrap acts', style: { gap: '8px' } }, [recallDue ? el('a', { class: 'btn pri', href: '#/recall', onclick: mark, text: 'Recall · ' + r.mins + ' min' }) : el('button', { class: 'btn pri', onclick: () => { mark(); route(); }, text: 'Start today\'s episode' }),
      recallDue ? el('button', { class: 'btn', onclick: () => { mark(); route(); }, text: 'Skip to today\'s plan' }) : null])])])]);
}

/* the end of the day: no autoplay, a hard stop, tomorrow's hook and a one-tap plan for tomorrow */
function storyCliff(k) {
  const st = storyDay(k); if (!st) return null;
  const tm = dayAdd(k, 1), plan = (storyState(tm) || {}).plan, time = S.settings.studyTime || '07:00';
  const hook = el('p', { style: { margin: 0, fontSize: '16px', lineHeight: 1.5 } }), tag = el('span', { class: 'upn storytag', text: 'That\'s today\'s episode' });
  const nxt = (() => { try { const it = daySet(tm).find(x => !x.done); return it ? (it.unit ? it.unit.title : it.x.t) : ''; } catch (e) { return ''; } })();
  if (nxt) { tag.textContent = 'Tomorrow'; hook.textContent = 'Up first: ' + nxt + '.'; } /* plain text when the story is off or a scene is missing */
  if (storyOn()) storyData().then(() => { const A = storyArcs(), a = A[st.m]; if (!a) return;
    if (storyModDone(st.m)) { tag.textContent = 'Season ' + a.season + ' · ' + a.ep + ' · finale'; hook.textContent = a.finale; }
    else { tag.textContent = 'Tomorrow on Meridian'; hook.textContent = a.teasers[st.i] || a.teasers[a.teasers.length - 1]; } });
  return el('section', { class: 'card pad storycliff storycard' }, [el('div', {}, [el('div', { class: 'stack', style: { gap: '10px' } }, [tag, storyOn() || nxt ? hook : null,
    el('span', { class: 'muted', style: { fontSize: '14.5px' }, text: 'Today\'s set is done. Nothing plays next; One more in each tab is there if you want it.' }),
    el('div', { class: 'row wrap acts', style: { gap: '8px' } }, [plan ? el('span', { class: 'chip c-core', text: 'Tomorrow at ' + plan + ' · planned' }) : el('button', { class: 'btn pri', onclick: () => { S.story = S.story || {}; S.story[tm] = Object.assign({}, S.story[tm], { plan: time }); save(); storyIcs(tm, time); route(); }, text: 'Plan tomorrow at ' + time }),
      el('a', { class: 'btn', href: '#/story', text: 'The series' })])])])]);
}
/* a one-event calendar file for tomorrow's episode, made on the device */
function storyIcs(k, time) {
  const d = k.replace(/-/g, ''), t = time.replace(':', '') + '00', end = String(+time.slice(0, 2) + 1).padStart(2, '0') + time.slice(3) + '00';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Data Architect//EN', 'BEGIN:VEVENT', 'UID:da-' + d + '@data-architect', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', 'DTSTART:' + d + 'T' + t, 'DTEND:' + d + 'T' + end, 'SUMMARY:Data Architect: today\'s episode', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'data-architect-' + k + '.ics'; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { }
}
/* the Sunday boss round, framed as the week's finale */
function storyBoss(k) { if (!storyOn() || !DATA.story) return ''; const st = storyDay(k), a = st && storyArcs()[st.m]; return a ? a.boss : ''; }

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
      el('ol', { class: 'stack', style: { gap: '10px', margin: 0, paddingLeft: '20px' } }, (s.modules || []).map(a => { const n = seen[a.mid] || 0, fin = storyModDone(a.mid);
        return el('li', {}, [el('b', { text: a.ep }), el('span', { class: 'muted', text: ' · module ' + modLabel(a.mid) + (fin ? ' · done' : a.mid === st.m ? ' · now' : '') }),
          n || fin ? el('p', { style: { margin: '4px 0 0', fontSize: '14.5px' }, text: a.logline }) : el('p', { class: 'muted', style: { margin: '4px 0 0', fontSize: '14px' }, text: 'Coming up.' }),
          n ? el('details', {}, [el('summary', { class: 'tlink', text: 'Scenes so far (' + Math.min(n, a.scenes.length) + ')' }), el('ol', { style: { fontSize: '14.5px' } }, a.scenes.slice(0, n).map(x => el('li', { text: x })))]) : null,
          fin && a.zoe ? el('p', { class: 'muted', style: { margin: '4px 0 0', fontSize: '14px' }, text: 'At dinner: ' + a.zoe }) : null]); }))]));
  });
}
