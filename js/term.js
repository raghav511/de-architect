/* In-app terminal: a small Alpine Linux (bash, git, busybox) running in your browser on the v86 emulator.
   Nothing to install and no server: the kernel boots in the page, files load from vm/sys/ only when first read,
   and the Linux keeps running while you move around the app. Built by tools/vm/ (see vm/README.md). */
const VMV = 'vm3'; /* bump when vm/sys is rebuilt, so cached copies are replaced */
const VM = { emu: null, term: null, fit: null, box: null, ready: false, log: '', status: '', onStatus: null, gate: '' };
function loadJs(src) { return new Promise((res, rej) => { if (document.querySelector('script[src="' + src + '"]')) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('could not load ' + src)); document.head.appendChild(s); }); }
function vmSay(t) { VM.status = t; if (VM.onStatus) VM.onStatus(t); }
async function vmStart() {
  if (VM.emu) return;
  VM.emu = 'starting';
  vmSay('Loading the terminal…');
  if (!document.querySelector('link[href^="vm/xterm.css"]')) document.head.appendChild(el('link', { rel: 'stylesheet', href: 'vm/xterm.css?' + VMV }));
  try { await Promise.all([loadJs('vm/libv86.js?' + VMV), loadJs('vm/xterm.js?' + VMV)]); await loadJs('vm/addon-fit.js?' + VMV); }
  catch (e) { VM.emu = null; vmSay('Could not load the terminal. Open it once while online; after that it works offline.'); return; }
  const dark = matchMedia('(prefers-color-scheme: dark)').matches || document.documentElement.dataset.theme === 'dark';
  VM.term = new Terminal({ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: innerWidth < 560 ? 13 : 14, cursorBlink: true, convertEol: false, scrollback: 3000,
    theme: dark ? { background: '#0F1720', foreground: '#E6EDF3' } : { background: '#14212B', foreground: '#E9EEF2' } });
  VM.fit = new FitAddon.FitAddon(); VM.term.loadAddon(VM.fit);
  VM.box = el('div', { class: 'xtbox' }); VM.term.open(VM.box);
  VM.term.onData(d => { if (VM.ready) VM.emu.serial0_send(d); });
  const S9 = 'vm/sys/';
  /* Safari: v86 starts its timer worker from a blob URL and revokes the URL at once; WebKit loads workers later, so the
     worker never starts and the CPU never runs. Delay revocations while the emulator starts. */
  const revoke = URL.revokeObjectURL; URL.revokeObjectURL = u => setTimeout(() => revoke.call(URL, u), 10000);
  setTimeout(() => { URL.revokeObjectURL = revoke; }, 30000);
  VM.emu = new V86({
    wasm_path: 'vm/v86.wasm?' + VMV, bios: { url: S9 + 'seabios.bin?' + VMV }, vga_bios: { url: S9 + 'vgabios.bin?' + VMV },
    bzimage: { url: S9 + 'bzimage.bin?' + VMV }, initrd: { url: S9 + 'initrd.img?' + VMV },
    cmdline: 'console=ttyS0 quiet loglevel=3 tsc=reliable mitigations=off random.trust_cpu=on',
    filesystem: { basefs: S9 + 'fs.json?' + VMV, baseurl: S9 + 'flat/' },
    memory_size: 192 * 1024 * 1024, autostart: true, disable_keyboard: true, disable_mouse: true, disable_speaker: true });
  let mb = 0;
  VM.emu.add_listener('download-progress', e => { if (e.total && /bzimage|initrd|v86/.test(e.file_name || '')) { const m = Math.round(e.loaded / 1e6); if (m !== mb) { mb = m; vmSay('Starting Linux… downloading (' + m + ' MB)'); } } });
  VM.emu.add_listener('emulator-ready', () => vmSay('Starting Linux… booting (up to a minute on a phone)'));
  /* boot messages stay hidden; the terminal shows from the first prompt */
  let pend = [];
  const flush = () => { if (pend.length) { VM.term.write(new Uint8Array(pend)); pend = []; } };
  VM.emu.add_listener('serial0-output-byte', b => {
    const c = String.fromCharCode(b);
    VM.log = (VM.log + c).slice(-40000);
    if (!VM.ready) { if (/DA-READY[\s\S]*\$ $/.test(VM.log)) { VM.ready = true; pend.push(...Array.from(VM.log.slice(VM.log.lastIndexOf('\n') + 1), ch => ch.charCodeAt(0))); requestAnimationFrame(flush); VM.log = ''; if (/^Starting/.test(VM.status)) vmSay(''); setTimeout(vmFitNow, 50); } return; } /* ready at bash's first prompt, which is then shown */
    pend.push(b); if (pend.length === 1) requestAnimationFrame(flush);
  });
}
/* tell the shell the real window size when it changes, so lines wrap where you see them */
function vmFitNow() { if (!VM.fit || !VM.box.isConnected) return; try { VM.fit.fit(); } catch (e) { } const sz = VM.term.cols + 'x' + VM.term.rows; if (VM.ready && sz !== VM.sz) { VM.sz = sz; VM.emu.serial0_send(' stty cols ' + VM.term.cols + ' rows ' + VM.term.rows + '\n'); } }
/* run a command as if typed, and resolve with the output once the marker line appears */
function vmRun(cmd, marker, ms) {
  return new Promise((res, rej) => {
    if (!VM.ready) return rej(new Error('not ready'));
    const start = VM.log.length, t0 = Date.now(), re = new RegExp(marker);
    VM.emu.serial0_send(cmd + '\n');
    const tick = () => { const out = VM.log.slice(Math.max(0, start - 10)); const m = re.exec(out); if (m) return res({ out, m }); if (Date.now() - t0 > (ms || 60000)) return rej(new Error('timed out')); setTimeout(tick, 150); };
    tick();
  });
}
function vmWhenReady(ms) { return new Promise((res, rej) => { const t0 = Date.now(); const k = () => VM.ready ? res() : Date.now() - t0 > (ms || 180000) ? rej(new Error('Linux did not start')) : setTimeout(k, 200); k(); }); }

function vTerminal(kind, n) {
  const G = DATA.git || [], g = kind === 'git' ? G.find(x => x.n === +n) : null, nn = g ? String(g.n).padStart(2, '0') : '';
  const status = el('span', { class: 'muted', role: 'status', style: { fontSize: '14px' }, text: VM.status || (VM.ready ? '' : 'Starting Linux… the first start takes a few seconds on a computer and up to a minute on a phone') });
  VM.onStatus = t => { status.textContent = t; };
  const holder = el('div', { class: 'xthold', 'aria-label': 'Terminal' });
  const key = (label, seq, aria) => el('button', { class: 'btn sm', 'aria-label': aria || label, onclick: () => { if (VM.ready) { VM.emu.serial0_send(seq); VM.term.focus(); } }, text: label });
  const keys = el('div', { class: 'row wrap xtkeys', style: { gap: '6px' } }, [key('Tab', '\t'), key('Ctrl-C', '\x03', 'Control C: stop the command'), key('Esc', '\x1b', 'Escape'), key('↑', '\x1b[A', 'Previous command'), key('↓', '\x1b[B', 'Next command'), key('←', '\x1b[D', 'Left'), key('→', '\x1b[C', 'Right'), key('Clear', 'clear\n', 'Clear the screen')]);
  const done = g && (S.gitlab || {})[g.n];
  const result = el('div', { class: 'stack', style: { gap: '4px' } });
  /* status and results live with the terminal, so a re-render of the page shows them again */
  const paintResult = () => { result.textContent = ''; (VM.result || []).forEach(l => result.appendChild(el('span', { class: /^PASS/.test(l) ? 'ok' : 'bad', text: (/^PASS/.test(l) ? '✓ ' : '✗ ') + l.replace(/^(PASS|FAIL)\s+/, '') }))); };
  if (g && VM.lab === g.n) paintResult();
  const setup = async () => {
    vmSay('Setting up lab ' + g.n + '…');
    try { await vmWhenReady(); await vmRun('lab ' + g.n, '\\[lab ' + g.n + ' ready: \\d+\\]', 60000); vmSay('Lab ' + g.n + ' is ready. The task is printed in the terminal.'); VM.term.focus(); }
    catch (e) { vmSay('Setup did not finish: ' + e.message); }
  };
  const check = async () => {
    vmSay('Checking your fix…'); VM.result = []; paintResult();
    try {
      await vmWhenReady();
      const r = await vmRun('labcheck ' + g.n, '\\[check ' + g.n + ': (\\d+)\\]', 60000);
      const lines = r.out.split('\n').map(l => l.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r/g, '').trim()).filter(l => /^(PASS|FAIL)\s/.test(l)); /* drop colour and line-control codes */
      VM.result = lines; paintResult();
      if (r.m[1] === '0') { S.gitlab = S.gitlab || {}; S.gitlab[g.n] = iso(new Date()); save(); vmSay('Lab ' + g.n + ' passed. The Git step on your plan is ticked.'); toast('Git lab ' + g.n + ' passed'); }
      else vmSay('Not yet: fix the lines marked ✗ and check again.');
    } catch (e) { vmSay('Check did not finish: ' + e.message); }
  };
  const side = g ? el('section', { class: 'card pad stack termside' }, [
    el('span', { class: 'lbl', text: 'Git lab ' + g.n + ' of ' + G.length + (done ? ' · passed ' + shortDate(done) : '') }),
    el('h2', { style: { margin: 0 }, text: g.title }),
    el('div', { class: 'row wrap', style: { gap: '8px' } }, [el('button', { class: 'btn pri', onclick: setup, text: 'Set up the lab' }), el('button', { class: 'btn', onclick: check, text: 'Check my fix' }), el('a', { class: 'btn', href: '#/git/' + g.n, text: 'Lesson' })]),
    status, result,
    el('details', {}, [el('summary', { text: 'The commands for this lab' }), el('pre', { class: 'schema', style: { whiteSpace: 'pre-wrap' }, text: g.commands })])])
    : el('section', { class: 'card pad stack termside' }, [el('h2', { style: { margin: 0 }, text: 'A real Linux in your browser' }), status,
      el('span', { class: 'muted', style: { fontSize: '14px' }, text: 'bash, git and the usual commands, with nothing to install. Type gitlab list to see the Git labs, or open one from a Git lesson. The terminal starts fresh each time you open the app.' })]);
  shell(g ? 'Terminal · Git lab ' + g.n : 'Terminal', 'Linux, bash and git in your browser', [el('div', { class: 'termgrid' }, [side, el('section', { class: 'card stack termcard' }, [holder, keys])])], { back: g ? '#/git/' + g.n : '#/today' });
  vmStart().then(() => { if (VM.box) { holder.appendChild(VM.box); setTimeout(vmFitNow, 30); } });
  if (VM.box) { holder.appendChild(VM.box); setTimeout(vmFitNow, 30); }
  const onR = () => { clearTimeout(VM.rt); VM.rt = setTimeout(vmFitNow, 250); }; addEventListener('resize', onR); cleanup.push(() => removeEventListener('resize', onR));
  if (g && VM.lab !== g.n) { VM.lab = g.n; VM.result = []; setup(); } /* opening a lab sets it up once per app start */
}
