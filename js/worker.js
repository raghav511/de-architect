/* Python runtime in a Web Worker: Pyodide + DuckDB + minispark. */
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
let fetched = true;
try { importScripts(PYODIDE + 'pyodide.js'); } catch (e) { fetched = false; } /* offline before the runtime was ever cached */
let py = null;
const ready = (async () => {
  if (!fetched) throw new Error('the Python runtime could not be downloaded (you seem to be offline)');
  py = await loadPyodide({ indexURL: PYODIDE });
  postMessage({ type: 'progress', text: 'Loading DuckDB…' });
  await py.loadPackage(['duckdb']);
  for (const f of ['minispark.py', 'runtime.py']) {
    const src = await (await fetch('../py/' + f, { cache: 'no-cache' })).text();
    py.FS.writeFile('/home/pyodide/' + f, src);
  }
  py.runPython('import sys; sys.path.insert(0, "/home/pyodide"); import runtime; runtime.seed()');
  postMessage({ type: 'ready' });
})().catch(e => postMessage({ type: 'fatal', text: String(e && e.message || e) }));

onmessage = async (ev) => {
  const { id, fn, args } = ev.data;
  try {
    await ready;
    const rt = py.pyimport('runtime');
    const out = rt[fn](...(args || []));
    postMessage({ id, ok: true, value: typeof out === 'string' ? out : String(out) });
  } catch (e) {
    postMessage({ id, ok: false, value: String(e && e.message || e).split('\n').slice(-3).join('\n') });
  }
};
