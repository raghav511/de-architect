"""Make the boot pieces for the in-app terminal: an initramfs that loads the 9p modules and switches to the root
served by the browser, plus the root's own start script and git settings. Writes out/initrd.img and edits rootfs/."""
import gzip, io, os, stat, shutil

K = 'rootfs/lib/modules/6.6.142-0-virt/kernel/'
MODS = ['fs/netfs/netfs', 'fs/fscache/fscache', 'net/9p/9pnet', 'net/9p/9pnet_virtio', 'fs/9p/9p']

INIT = r'''#!/bin/busybox sh
/bin/busybox --install -s /bin
mount -t proc proc /proc; mount -t sysfs sys /sys; mount -t devtmpfs dev /dev
for m in netfs fscache 9pnet 9pnet_virtio 9p; do insmod /lib/$m.ko; done
mount -t 9p -o trans=virtio,version=9p2000.L,cache=loose,msize=512000 host9p /mnt || { echo "could not mount the app's files"; exec sh; }
mount --move /proc /mnt/proc; mount --move /sys /mnt/sys; mount --move /dev /mnt/dev
exec switch_root /mnt /sbin/da-init
'''

DA_INIT = r'''#!/bin/sh
# Data Architect terminal: one shell on the serial line, restarted if you exit
mkdir -p /dev/pts /tmp /run; mount -t devpts devpts /dev/pts 2>/dev/null; mount -t tmpfs tmpfs /tmp; mount -t tmpfs tmpfs /run
hostname data-architect
export HOME=/root TERM=xterm-256color LANG=C.UTF-8 PAGER=cat GIT_PAGER=cat EDITOR=vi
cd /root
echo "DA-READY"
while true; do setsid -c /bin/bash -l </dev/ttyS0 >/dev/ttyS0 2>&1; echo; echo "(new shell)"; done
'''

PROFILE = r'''export HISTCONTROL=ignorespace DA_APP=1
lab() { gitlab setup "$1" && cd ~/git-labs/$(printf %02d "$1") && { [ -d me ] && cd me; true; }; echo "[lab $1 ready: $?]"; }
labcheck() { (cd ~/git-labs/$(printf %02d "$1") && gitlab check "$1"); echo "[check $1: $?]"; }
export PS1='\[\e[1;32m\]learner\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]$ '
export HOME=/root PAGER=cat GIT_PAGER=cat EDITOR=vi
alias ll='ls -la'
stty cols 100 rows 30 2>/dev/null
'''

GITCONFIG = '''[user]
\tname = Learner
\temail = learner@data-architect.local
[init]
\tdefaultBranch = main
[core]
\tpager = cat
\teditor = vi
[advice]
\tdetachedHead = true
[color]
\tui = auto
'''

def w(path, text, mode=0o644):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w').write(text); os.chmod(path, mode)

# root filesystem additions
# Alpine makes busybox's command links at install time; packages unpacked by hand have none, so add the common ones
APPLETS = ('sh ash ls cat cp mv rm mkdir rmdir ln chmod chown echo grep egrep fgrep sed awk head tail wc sort uniq tr cut diff find xargs '
           'touch date env sleep printf test [ [[ true false pwd basename dirname clear vi stty setsid hostname mount umount ps kill uname id '
           'whoami tee more realpath readlink seq md5sum sha256sum gzip gunzip zcat tar which du df free stat cmp expr yes nproc mktemp od '
           'hexdump reset patch base64 install sync dmesg less_disabled').split()
os.makedirs('rootfs/usr/bin', exist_ok=True)
if not os.path.lexists('rootfs/usr/bin/env'): os.symlink('/bin/busybox', 'rootfs/usr/bin/env')  # scripts start with #!/usr/bin/env bash
for a in APPLETS:
    if a.endswith('_disabled'): continue
    p = 'rootfs/bin/' + a
    if not os.path.lexists(p) and not os.path.exists('rootfs/usr/bin/' + a): os.symlink('busybox', p)
w('rootfs/sbin/da-init', DA_INIT, 0o755)
w('rootfs/root/.bash_profile', PROFILE)
w('rootfs/etc/gitconfig', GITCONFIG)
os.makedirs('rootfs/root', exist_ok=True); os.makedirs('rootfs/mnt', exist_ok=True)
for d in ('proc', 'sys', 'dev', 'tmp', 'run'): os.makedirs('rootfs/' + d, exist_ok=True)

# initramfs (newc cpio, gzip)
def cpio(entries):
    out = io.BytesIO(); ino = 1
    def hdr(name, mode, data=b'', nlink=1):
        nonlocal ino
        n = name.encode() + b'\0'
        h = '070701' + ''.join('%08X' % x for x in (ino, mode, 0, 0, nlink, 0, len(data), 0, 0, 0, 0, len(n), 0))
        ino += 1
        out.write(h.encode() + n); out.write(b'\0' * ((4 - (110 + len(n)) % 4) % 4))
        out.write(data); out.write(b'\0' * ((4 - len(data) % 4) % 4))
    for name, mode, data in entries: hdr(name, mode, data)
    hdr('TRAILER!!!', 0)
    return out.getvalue()

E = [(d, stat.S_IFDIR | 0o755, b'') for d in ('bin', 'dev', 'proc', 'sys', 'mnt', 'lib')]
E.append(('bin/busybox', stat.S_IFREG | 0o755, open('rootfs/bin/busybox.static', 'rb').read()))
E.append(('init', stat.S_IFREG | 0o755, INIT.encode()))
for m in MODS:
    E.append(('lib/' + os.path.basename(m) + '.ko', stat.S_IFREG | 0o644, gzip.decompress(open(K + m + '.ko.gz', 'rb').read())))
os.makedirs('out', exist_ok=True)
open('out/initrd.img', 'wb').write(gzip.compress(cpio(E), 9))
shutil.copy('rootfs/boot/vmlinuz-virt', 'out/bzimage.bin')
print('initrd', os.path.getsize('out/initrd.img'), 'kernel', os.path.getsize('out/bzimage.bin'))
