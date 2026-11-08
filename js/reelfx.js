/* Data Architect · reel animation engine. Each reel beat is a small scene on a dark, glowing canvas: components appear
   when the narration reaches them, dots travel along the connections, counters tick, log cells fill, bars race and
   chips pop in. FX.build(show) returns { el, start(ms), stop() }; start() spreads the scene's steps over the beat's
   spoken duration. Hand-written scenes use { t: 'scene', title, nodes, edges, steps }; the older picture types
   (big, points, flow, bars, code, disk, shift) are turned into scenes automatically, so every reel animates. */
'use strict';
const FX = (() => {
  const TONE = { blue: '#6E9BFF', teal: '#2FD1A8', amber: '#F5A524', red: '#FF6B5E', plum: '#B794FF', grey: '#93A7B8' };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const emph = s => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const div = (cls, html, style) => { const d = document.createElement('div'); d.className = cls; if (html != null) d.innerHTML = html; if (style) Object.assign(d.style, style); return d; };
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function headline(t, kicker) { return div('fxhead fxin', (kicker ? '<span>' + esc(kicker) + '</span>' : '') + '<b>' + emph(t) + '</b>'); }

  /* explicit scene: nodes at x,y percent of the stage, edges between node ids, timed steps */
  function scene(s) {
    const root = div('fx'), stage = div('fxstage'), steps = [], N = {};
    if (s.title) root.appendChild(headline(s.title, s.kicker));
    root.appendChild(stage);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.classList.add('fxwires'); stage.appendChild(svg);
    (s.nodes || []).forEach(n => {
      const tone = TONE[n.tone || 'blue'];
      const el = div('fxnode fxin' + (n.kind ? ' fx-' + n.kind : ''), (n.icon ? '<i>' + esc(n.icon) + '</i>' : '') + '<b>' + esc(n.label) + '</b>' + (n.sub ? '<small>' + esc(n.sub) + '</small>' : ''), { left: n.x + '%', top: n.y + '%', '--tone': tone, width: n.w ? n.w + '%' : null });
      if (n.kind === 'disk') el.innerHTML = '<svg viewBox="0 0 40 40" class="fxdisk"><circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="20" r="2.5" fill="currentColor"/><line class="fxarm" x1="34" y1="6" x2="22" y2="18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><b>' + esc(n.label) + '</b>' + (n.sub ? '<small>' + esc(n.sub) + '</small>' : '');
      stage.appendChild(el); N[n.id] = Object.assign({ el, tone }, n);
    });
    (s.edges || []).forEach(([a, b, lab]) => {
      const A = N[a], B = N[b]; if (!A || !B) return;
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); ['x1', A.x, 'y1', A.y, 'x2', B.x, 'y2', B.y].reduce((k, v, i, arr) => { if (i % 2) l.setAttribute(arr[i - 1], v); return k; }, 0);
      l.setAttribute('class', 'fxwire'); l.dataset.e = a + '>' + b; svg.appendChild(l);
      if (lab) { const t = div('fxlab', esc(lab), { left: (A.x + B.x) / 2 + '%', top: (A.y + B.y) / 2 + '%' }); t.dataset.e = a + '>' + b; stage.appendChild(t); }
    });
    const chips = div('fxchips'); root.appendChild(chips);
    const show = id => { const n = N[id]; if (n) n.el.classList.add('on'); svg.querySelectorAll('line').forEach(l => { const [a, b] = l.dataset.e.split('>'); if (N[a].el.classList.contains('on') && N[b].el.classList.contains('on')) l.classList.add('on'); }); stage.querySelectorAll('.fxlab').forEach(t => { const [a, b] = t.dataset.e.split('>'); if (N[a].el.classList.contains('on') && N[b].el.classList.contains('on')) t.classList.add('on'); }); };
    const anims = [];
    const packet = (a, b, n, color, ms) => { const A = N[a], B = N[b]; if (!A || !B) return; for (let i = 0; i < (n || 3); i++) { const p = div('fxdot', null, { left: A.x + '%', top: A.y + '%', background: color || A.tone, boxShadow: '0 0 10px ' + (color || A.tone) }); stage.appendChild(p);
        if (reduce()) { p.style.left = B.x + '%'; p.style.top = B.y + '%'; continue; }
        const an = p.animate([{ left: A.x + '%', top: A.y + '%', opacity: 0 }, { opacity: 1, offset: .15 }, { left: B.x + '%', top: B.y + '%', opacity: 1, offset: .9 }, { left: B.x + '%', top: B.y + '%', opacity: 0 }], { duration: ms || 900, delay: i * (ms || 900) / 3, iterations: 1, easing: 'ease-in-out', fill: 'forwards' }); anims.push(an); } };
    const counter = (c) => { let el = root.querySelector('.fxcount[data-k="' + c.key + '"]'); if (!el) { el = div('fxcount fxin on', '<span>' + esc(c.label) + '</span><b>0</b>', { '--tone': TONE[c.tone || 'amber'] }); root.insertBefore(el, chips); el.dataset.k = c.key; }
      const b = el.querySelector('b'), from = +b.textContent.replace(/\D/g, '') || 0, to = c.to, t0 = performance.now(), d = reduce() ? 1 : (c.ms || 900);
      const tick = now => { const k = Math.min(1, (now - t0) / d); b.textContent = Math.round(from + (to - from) * k).toLocaleString() + (c.unit || ''); if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); };
    const chip = c => { const el = div('fxchip fxin', (c.icon ? '<i>' + esc(c.icon) + '</i>' : '') + emph(c.text), { '--tone': TONE[c.tone || 'teal'] }); chips.appendChild(el); requestAnimationFrame(() => el.classList.add('on')); };
    const cells = c => { let row = root.querySelector('.fxcells'); if (!row) { row = div('fxcells fxin on'); if (c.label) row.appendChild(div('fxcap', esc(c.label))); root.insertBefore(row, chips); }
      (c.items || []).forEach((x, i) => setTimeout(() => { const el = div('fxcell fxin', '<small>' + esc(x[0]) + '</small><b>' + esc(x[1]) + '</b>', { '--tone': TONE[x[2] || 'teal'] }); row.appendChild(el); requestAnimationFrame(() => el.classList.add('on')); }, i * (c.gap || 260))); };
    const race = r => { const box = div('fxrace fxin on'); root.insertBefore(box, chips); const mx = Math.max(...r.items.map(x => x[1])), lg = r.log;
      r.items.forEach(([lab, v, tone]) => { const row = div('fxbar', '<span>' + esc(lab) + '</span><i><u></u></i><b>0</b>', { '--tone': TONE[tone || 'teal'] }); box.appendChild(row);
        const w = lg ? 100 * Math.log10(1 + v) / Math.log10(1 + mx) : 100 * v / mx, u = row.querySelector('u'), b = row.querySelector('b'), t0 = performance.now(), d = reduce() ? 1 : (r.ms || 1400);
        const tick = now => { const k = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - k, 3); u.style.width = Math.max(2, w * e) + '%'; b.textContent = '~' + Math.round(v * e).toLocaleString() + ' ' + (r.unit || ''); if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }); };
    const glow = id => { const n = N[id]; if (n) { n.el.classList.add('glow'); setTimeout(() => n.el.classList.remove('glow'), 1200); } };
    const dim = id => { const n = N[id]; if (n) n.el.classList.add('dim'); };
    const seek = (id, on) => { const n = N[id]; if (n) n.el.classList.toggle('seeking', on !== false); };
    (s.steps || []).forEach(st => {
      const fn = () => { if (st.show) [].concat(st.show).forEach(show); if (st.packet) packet(st.packet[0], st.packet[1], st.n, st.color && TONE[st.color], st.ms); if (st.count) counter(st.count); if (st.chip) chip(st.chip); if (st.cells) cells(st.cells); if (st.race) race(st.race); if (st.glow) glow(st.glow); if (st.dim) dim(st.dim); if (st.seek) seek(st.seek, st.on); };
      steps.push({ at: st.at || 0, fn: () => { try { fn(); } catch (e) { console.warn('reel step skipped', e); } } }); /* one bad step never stops the reel */
    });
    return { root, steps, anims };
  }

  /* older picture types become scenes */
  function legacy(s) {
    const t = s.t || 'big';
    if (t === 'scene') return s;
    /* written reels sometimes describe a flow as steps [{label, sub}] or nodes [{label}] instead of items */
    if (!Array.isArray(s.items)) s = Object.assign({}, s, { items: (s.steps || s.nodes || []).map(x => typeof x === 'string' ? x : x.label || x.text || '').filter(Boolean) });
    if (t === 'big') return { title: s.text, kicker: s.sub, steps: [] };
    if (t === 'points') return { steps: (s.items || []).map((x, i) => ({ at: 0.08 + i * (0.8 / Math.max(1, s.items.length)), chip: { text: x, tone: ['teal', 'blue', 'plum', 'amber'][i % 4], icon: '●' } })) };
    if (t === 'flow') { const n = s.items.length, nodes = s.items.map((x, i) => ({ id: 'n' + i, label: x, x: 50, y: n === 1 ? 50 : 10 + i * (80 / (n - 1)), tone: ['blue', 'teal', 'plum', 'amber', 'teal'][i % 5], w: 74 }));
      const steps = []; nodes.forEach((nd, i) => { steps.push({ at: i * (0.75 / n), show: nd.id }); if (i) steps.push({ at: i * (0.75 / n) + 0.04, packet: ['n' + (i - 1), nd.id], n: 2, ms: 700 }); });
      if (s.note) steps.push({ at: 0.85, chip: { text: s.note, tone: 'amber', icon: '!' } });
      return { title: s.title, nodes, edges: nodes.slice(1).map((nd, i) => ['n' + i, nd.id]), steps, tall: true }; }
    if (t === 'bars') { const mx = Math.max(...s.items.map(x => x[1])), mn = Math.min(...s.items.map(x => x[1])); return { steps: [{ at: 0.05, race: { items: s.items.map((x, i) => [x[0], x[1], i === s.items.length - 1 ? 'teal' : 'red']), unit: s.unit, log: mx / Math.max(1e-9, mn) > 1000 } }].concat(s.items.filter(x => x[2]).map((x, i) => ({ at: 0.55 + i * 0.15, chip: { text: x[0] + ': ' + x[2], tone: i === s.items.length - 1 ? 'teal' : 'red' } }))) }; }
    if (t === 'code') return { code: s.text, steps: [] };
    if (t === 'disk') return { nodes: [{ id: 'd', label: 'Disk', sub: s.mode === 'seq' ? 'arm stays put' : 'arm jumps for every write', kind: 'disk', x: 50, y: 45, tone: 'amber' }], steps: [{ at: 0, show: 'd' }, { at: 0.15, seek: 'd', on: s.mode !== 'seq' }, { at: 0.5, chip: { text: s.mode === 'seq' ? 'One continuous run' : 'Each move ≈ 10 ms', tone: s.mode === 'seq' ? 'teal' : 'red', icon: s.mode === 'seq' ? '✓' : '✕' } }] };
    if (t === 'shift') return { cells0: true, steps: [{ at: 0.05, cells: { label: 'list in memory', items: [['0', 'a', 'red'], ['1', 'b'], ['2', 'c'], ['3', 'd'], ['4', 'e']], gap: 120 } }, { at: 0.5, chip: { text: 'pop(0): every item *shifts* left', tone: 'red', icon: '✕' } }, { at: 0.7, chip: { text: 'pop(): one slot, *O(1)*', tone: 'teal', icon: '✓' } }] };
    if (t === 'fig') return { fig: s, steps: [] };
    return { title: s.text || '', steps: [] };
  }

  /* a picture the engine cannot draw (reel data is written by a model and the daily refresh) becomes a plain caption card,
     never a page error that stops the player: it also renders the neighbouring reels, so one bad picture broke a whole feed */
  function build(show) {
    try { return make(show); } catch (e) { console.warn('reel picture replaced', e); return make({ t: 'big', text: (show && (show.title || show.text)) || '' }); }
  }
  function make(show) {
    const sp = legacy(show || {});
    const sc = scene(sp);
    if (sp.tall) sc.root.classList.add('fxtall');
    if (sp.code != null) { const pre = div('fxcode fxin on'); sc.root.insertBefore(pre, sc.root.querySelector('.fxchips')); const lines = String(sp.code).split('\n');
      lines.forEach((l, i) => sc.steps.push({ at: i * (0.7 / lines.length), fn: () => { const d = div('fxline', esc(l) || '&nbsp;'); pre.appendChild(d); requestAnimationFrame(() => d.classList.add('on')); } })); }
    if (sp.fig && typeof FIGS !== 'undefined') sc.root.insertBefore(div('fxfig', FIGS.svgOf(sp.fig.name, sp.fig.step)), sc.root.querySelector('.fxchips'));
    if (!sc.root.querySelector('.fxstage .fxnode')) sc.root.querySelector('.fxstage').remove();
    let timers = [];
    return {
      el: sc.root,
      start(ms) { this.stop(); sc.root.classList.add('run'); const head = sc.root.querySelector('.fxhead'); if (head) head.classList.add('on'); sc.steps.sort((a, b) => a.at - b.at).forEach(s => timers.push(setTimeout(s.fn, reduce() ? 0 : s.at * ms))); },
      finish() { this.stop(); sc.steps.forEach(s => { try { s.fn(); } catch (e) { } }); const head = sc.root.querySelector('.fxhead'); if (head) head.classList.add('on'); },
      stop() { timers.forEach(clearTimeout); timers = []; sc.anims.forEach(a => { try { a.cancel(); } catch (e) { } }); }
    };
  }
  return { build };
})();
