/* Main-thread wrapper for the Python worker, with a kill switch for infinite loops. */
const Py = (() => {
  let w = null, seq = 0, pending = {}, state = 'idle', listeners = [], readyP = null;
  function emit(s, text) { state = s; listeners.forEach(f => f(s, text)); }
  function start() {
    if (w) return readyP;
    emit('loading', 'Starting Python in your browser (first time: about 15 s)…');
    w = new Worker('js/worker.js');
    readyP = new Promise((res, rej) => {
      w.onerror = e => { e.preventDefault(); const why = 'Could not start Python. If you are offline, open any coding problem once while online so it is saved for offline use.'; emit('error', why); const p = pending; pending = {}; Object.values(p).forEach(x => { clearTimeout(x.t); x.rej(new Error(why)); }); w = null; readyP = null; rej(why); };
      w.onmessage = (ev) => {
        const m = ev.data;
        if (m.type === 'progress') emit('loading', m.text);
        else if (m.type === 'ready') { emit('ready', 'Python ready'); res(); }
        else if (m.type === 'fatal') { const why = 'Could not start Python: ' + m.text + '. Connect once and open a coding problem; after that it also works offline.'; emit('error', why); w.terminate(); w = null; readyP = null; rej(new Error(why)); }
        else if (m.id && pending[m.id]) { const p = pending[m.id]; delete pending[m.id]; clearTimeout(p.t); m.ok ? p.res(m.value) : p.rej(new Error(m.value)); }
      };
    });
    return readyP;
  }
  function kill(reason) {
    if (w) w.terminate();
    w = null; readyP = null;
    Object.values(pending).forEach(p => p.rej(new Error(reason)));
    pending = {};
    emit('idle', reason);
  }
  async function call(fn, args, timeoutMs) {
    await start();
    const id = ++seq;
    return new Promise((res, rej) => {
      const t = setTimeout(() => kill('Stopped after ' + Math.round((timeoutMs || 20000) / 1000) + ' s. Is there an infinite loop? Python will restart on the next run.'), timeoutMs || 20000);
      pending[id] = { res, rej, t };
      w.postMessage({ id, fn, args });
    });
  }
  async function json(fn, args, t) { return JSON.parse(await call(fn, args, t)); }
  return { start, call, json, kill, on: f => listeners.push(f), get state() { return state; } };
})();
