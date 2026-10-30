// Boot once, then for every Git lab: set up, apply a known-good fix, and check. Proves each lab can pass in the in-app Linux.
import { V86 } from './node_modules/v86/build/libv86.mjs';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const D = path.dirname(fileURLToPath(import.meta.url));
const FIX = {
  1: 'git add dag.py && git commit -q --amend -m "add pipeline and dag"',
  2: 'git merge -q feature; printf "select city,\\n count(distinct trip_id) as completed_trips\\nfrom trips\\ngroup by city\\n" > report.sql; git add report.sql; git commit -qm "merge feature"',
  3: 'git switch -q feature && git rebase -q main',
  4: 'git switch -q feature && git reset -q --soft main && git commit -qm "add work file"',
  5: 'git revert --no-edit HEAD~1 >/dev/null && git push -q origin main',
  6: 'git branch experiment $(git log --all --reflog --format="%H %s" | grep "important experiment" | head -1 | cut -d" " -f1)',
  7: 'git stash -q && echo fixed > hotfix.txt && git add hotfix.txt && git commit -qm hotfix && git stash pop -q',
  8: 'git switch -q release && git cherry-pick $(git log main --format="%H %s" | grep "fix: null" | cut -d" " -f1) >/dev/null && git switch -q main',
  9: 'git bisect start HEAD $(git rev-list --max-parents=0 HEAD) >/dev/null && git bisect run ../09-test.sh >/dev/null 2>&1; git log -1 --format=%s refs/bisect/bad > ../09-answer.txt; git bisect reset >/dev/null 2>&1',
  10: 'git branch rescue HEAD && git switch -q main',
  11: 'git fetch -q origin && git rebase -q --no-fork-point origin/main && git push -q origin main',
  12: 'git filter-branch -f --index-filter "git rm -q --cached --ignore-unmatch .env" -- --all >/dev/null 2>&1; rm -rf .git/refs/original; git reflog expire --expire=now --all; git gc -q --prune=now; echo .env > .gitignore; git add .gitignore; git commit -qm "ignore .env"',
  13: 'git merge -q feature; printf \'{"deps": {"a": "1.1", "b": "2.0"}}\\n\' > lock.json; git add lock.json; git commit -qm "merge feature"',
  14: 'git worktree add -q ../14-hotfix hotfix && (cd ../14-hotfix && echo fix > hotfix.txt && git add hotfix.txt && git commit -qm hotfix) && git worktree remove ../14-hotfix',
  15: 'printf \'#!/bin/sh\\nif git diff --cached | grep -q "sk-live-"; then echo "secret found"; exit 1; fi\\n\' > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit',
  16: 'git switch -qc feat/readme && echo "project, documented" > README.md && git commit -qam "docs: readme" && git push -q -u origin feat/readme && echo "PR: feat/readme -> main" > pr.txt && git switch -q main',
};
const emu = new V86({ wasm_path: D + '/node_modules/v86/build/v86.wasm', bios: { url: D + '/bios/seabios.bin' }, vga_bios: { url: D + '/bios/vgabios.bin' },
  bzimage: { url: D + '/out/bzimage.bin' }, initrd: { url: D + '/out/initrd.img' }, cmdline: 'console=ttyS0 quiet loglevel=3 tsc=reliable mitigations=off random.trust_cpu=on',
  filesystem: { basefs: D + '/served/fs.json', baseurl: D + '/served/flat/' }, memory_size: 192 * 1024 * 1024, autostart: true, disable_keyboard: true, disable_mouse: true });
let log = '';
emu.add_listener('serial0-output-byte', b => { log += String.fromCharCode(b); });
let lastOut = '';
const wait = (re, ms) => new Promise((res, rej) => { const t0 = Date.now(); const k = () => { const m = re.exec(log); if (m) { lastOut = log.slice(0, m.index + m[0].length).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''); log = log.slice(m.index + m[0].length); return res(m); } if (Date.now() - t0 > ms) return rej(new Error('timeout ' + re)); setTimeout(k, 100); }; k(); });
const run = async (cmd, re, ms) => { emu.serial0_send(cmd + '\n'); return wait(re, ms || 90000); };
(async () => {
  await wait(/DA-READY[\s\S]*\$ $/, 240000);
  const res = [];
  for (const n of Object.keys(FIX).map(Number).filter(n => !process.env.ONLY || process.env.ONLY.split(',').includes(String(n)))) {
    try {
      await run('lab ' + n, new RegExp('\\[lab ' + n + ' ready: (\\d+)\\]'));
      const f = await run(FIX[n] + '; echo "FIX""-DONE"', /FIX-DONE\r?\n/); if (process.env.ONLY) console.log('FIX OUT', n, JSON.stringify(lastOut));
      const m = await run('labcheck ' + n, new RegExp('\\[check ' + n + ': (\\d+)\\]'));
      res.push(n + (m[1] === '0' ? ' PASS' : ' FAIL'));
      if (m[1] !== '0') console.log('lab', n, 'check output:', JSON.stringify(lastOut.slice(-700)));
    } catch (e) { res.push(n + ' ERROR ' + e.message); }
  }
  console.log(res.join('\n')); emu.stop(); process.exit(res.every(r => /PASS/.test(r)) ? 0 : 1);
})();
