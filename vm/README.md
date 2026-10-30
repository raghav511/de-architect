# In-app terminal

A small 32-bit Alpine Linux (bash, git, busybox) that boots inside the browser on the [v86](https://github.com/copy/v86) x86 emulator. Used by `js/term.js` for the Terminal page and the Git labs. Nothing is installed and no server runs it: the kernel boots in the page, and files in `sys/flat/` are fetched only when the guest first reads them, then cached by the service worker for offline use.

| File | What it is | Licence |
|---|---|---|
| `libv86.js`, `v86.wasm` | v86 emulator 0.5.472 (npm `v86`) | BSD-2-Clause |
| `xterm.js`, `xterm.css`, `addon-fit.js` | xterm.js 5.5.0 and the fit addon 0.10.0 | MIT |
| `sys/seabios.bin`, `sys/vgabios.bin` | SeaBIOS and the VGA BIOS shipped with v86 | LGPL-3.0 |
| `sys/bzimage.bin` | Alpine `linux-virt` 6.6 kernel (x86) | GPL-2.0 |
| `sys/initrd.img` | busybox (static) and the five 9p kernel modules, plus a short start script | GPL-2.0 |
| `sys/fs.json`, `sys/flat/` | Alpine 3.20 x86 packages: musl, busybox, bash, git, less and their libraries | Each package's own licence (GPL, MIT, BSD and others) |

Source for every Alpine binary is available from the Alpine Linux project (aports, tag `v3.20`), and for the kernel at `https://dl-cdn.alpinelinux.org/alpine/v3.20/main/x86/` as source packages on request from Alpine.

## Rebuild

From `tools/vm/` (needs Python 3 and curl, no Docker):

```
python3 build_rootfs.py     # resolve and unpack the Alpine packages into rootfs/
cp ../../labs/git/gitlab.sh rootfs/usr/local/bin/gitlab
python3 build_boot.py       # start scripts, git settings, initrd
python3 pack_fs.py rootfs served --exclude /lib/modules --exclude /boot --exclude /usr/share/zoneinfo --exclude /usr/share/man --exclude /usr/share/doc
node boot_test.mjs          # boots headless and runs git (needs npm i v86)
```

Copy `out/bzimage.bin`, `out/initrd.img`, `served/fs.json` and `served/flat/` into `vm/sys/`, then bump `VMV` in `js/term.js` so browsers fetch the new files.
