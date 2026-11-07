/* Design simulator engine check: node tools/sim/engine_test.js.
   Every challenge must fail as given and pass once its hint's fix (SIM_HINTS, the same steps Show me plays) is applied.
   Every Teach me walkthrough must break when its failure is injected and recover with its fix. */
const fs = require('fs'), vm = require('vm');
const ctx = { console, S: {}, Date, Math, JSON }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../../js/sim.js'), 'utf8') + ';Object.assign(this,{SIM,SIM_SC,SIM_HINTS,SIM_TPL,simFromSc,simApplyFix,simChaosFor})', ctx);
const { SIM, SIM_SC, SIM_HINTS, SIM_TPL, simFromSc, simApplyFix } = ctx;
let bad = 0;
const show = g => g.res.map(r => r[1] + (r[3] ? '✓' : '✗')).join(' ');
SIM_SC.forEach(sc => {
  const h = SIM_HINTS[sc.id]; if (!h || !h.look || !h.idea || !h.change || !h.fix.length) { bad++; console.log('BAD ' + sc.id + ': hint ladder incomplete'); return; }
  const g0 = SIM.grade(simFromSc(sc), sc), d1 = simFromSc(sc); const applied = h.fix.map(f => simApplyFix(d1, f)); const g1 = SIM.grade(d1, sc);
  const ok = !g0.pass && g1.pass && applied.every(Boolean); if (!ok) bad++;
  console.log((ok ? 'ok   ' : 'BAD  ') + sc.id.padEnd(11) + ' start: ' + show(g0) + ' | fixed: ' + show(g1));
});
SIM_TPL.forEach(t => {
  const tc = t.teach; if (!tc) { bad++; console.log('BAD teach ' + t.id + ': no walkthrough'); return; }
  if (tc.steps.length !== t.nodes.length) { bad++; console.log('BAD teach ' + t.id + ': one step per box needed'); }
  const sc = { secs: 40, chaos: [{ type: tc.brk.type, on: tc.brk.on, from: 5, to: null }], goals: tc.goals };
  const d0 = simFromSc(t), g0 = SIM.grade(d0, sc), d1 = simFromSc(t); tc.fix.forEach(f => simApplyFix(d1, f)); const g1 = SIM.grade(d1, sc);
  const base = SIM.grade(simFromSc(t), { secs: 40, goals: tc.goals });
  const ok = base.pass && !g0.pass && g1.pass; if (!ok) bad++;
  console.log((ok ? 'ok   ' : 'BAD  ') + ('teach ' + t.id).padEnd(16) + ' healthy: ' + show(base) + ' | broken: ' + show(g0) + ' | fixed: ' + show(g1));
});
process.exit(bad ? 1 : 0);
