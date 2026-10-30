// Boot the in-app terminal's Linux headless in Node and run git, to prove the image works before any UI exists.
import { V86 } from './node_modules/v86/build/libv86.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const D = path.dirname(fileURLToPath(import.meta.url));
const t0 = Date.now();
const emu = new V86({
  wasm_path: D + '/node_modules/v86/build/v86.wasm',
  bios: { url: D + '/bios/seabios.bin' }, vga_bios: { url: D + '/bios/vgabios.bin' },
  bzimage: { url: D + '/out/bzimage.bin' }, initrd: { url: D + '/out/initrd.img' },
  cmdline: 'console=ttyS0 quiet loglevel=3 tsc=reliable mitigations=off random.trust_cpu=on',
  filesystem: { basefs: D + '/served/fs.json', baseurl: D + '/served/flat/' },
  memory_size: 192 * 1024 * 1024, autostart: true, disable_keyboard: true, disable_mouse: true,
});
let out = '', ready = false, done = false;
const CMD = 'git --version && cd /tmp && git init -q lab && cd lab && echo hi > a.txt && git add . && git commit -qm first && git switch -qc feature && echo x >> a.txt && git commit -qam second && git switch -q main && git merge -q feature && git log --oneline | wc -l && git rebase --help >/dev/null 2>&1; echo RESULT-$(git log --format=%s | tr "\\n" ,)\n';
emu.add_listener('serial0-output-byte', b => {
  const c = String.fromCharCode(b); out += c; process.stdout.write(c);
  if (!ready && out.includes('DA-READY')) { ready = true; console.error('\n[booted in ' + (Date.now() - t0) + ' ms]'); setTimeout(() => emu.serial0_send(CMD), 1500); }
  if (!done && /RESULT-[a-z,]+\r?\n/.test(out)) { done = true; console.error('\n[git done at ' + (Date.now() - t0) + ' ms]'); emu.stop(); process.exit(/RESULT-second,first,/.test(out) ? 0 : 1); }
});
setTimeout(() => { console.error('\n[timeout]'); process.exit(2); }, 240000);
