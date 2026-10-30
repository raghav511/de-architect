"""Build a tiny 32-bit Alpine root filesystem for the in-app terminal (v86), without Docker.
Alpine packages are tar.gz archives: resolve dependencies from APKINDEX, download, and unpack into rootfs/.
Usage: python3 build_rootfs.py   (writes pkgs/*.apk and rootfs/)"""
import tarfile, io, os, re, sys, urllib.request, shutil

REL, ARCH = 'v3.20', 'x86'
WANT = ['alpine-baselayout', 'alpine-baselayout-data', 'busybox', 'busybox-static', 'musl', 'bash', 'git', 'less', 'ncurses-terminfo-base', 'linux-virt', 'tzdata']
SKIP_DEPS = {'linux-firmware-any', 'mkinitfs', 'busybox-binsh', 'alpine-keys', 'apk-tools', 'ca-certificates-bundle', 'perl', 'git-perl'}

def index(repo):
    t = tarfile.open('pkgs/APKINDEX-%s.tar.gz' % repo)
    raw = t.extractfile('APKINDEX').read().decode()
    pk = {}
    for block in raw.strip().split('\n\n'):
        d = {}
        for l in block.split('\n'):
            if len(l) > 2 and l[1] == ':': d.setdefault(l[0], []).append(l[2:])
        name = d['P'][0]
        pk[name] = {'V': d['V'][0], 'D': (d.get('D') or [''])[0].split(), 'p': (d.get('p') or [''])[0].split(), 'repo': repo}
    return pk

PK = {}
for r in ('main', 'community'): PK.update({k: v for k, v in index(r).items() if k not in PK})
PROV = {}
for n, v in PK.items():
    for p in v['p']:
        PROV.setdefault(re.split('[=<>~]', p)[0], n)

def resolve(dep):
    dep = re.split('[=<>~]', dep)[0]
    if dep.startswith('!'): return None
    if dep in PK: return dep
    return PROV.get(dep)

need, todo = set(), list(WANT)
while todo:
    n = resolve(todo.pop())
    if not n or n in need or n in SKIP_DEPS: continue
    need.add(n)
    todo.extend(PK[n]['D'])
print(len(need), 'packages:', ' '.join(sorted(need)))

shutil.rmtree('rootfs', ignore_errors=True); os.makedirs('rootfs')
total = 0
for n in sorted(need):
    v = PK[n]; f = 'pkgs/%s-%s.apk' % (n, v['V'])
    if not os.path.exists(f):
        url = 'https://dl-cdn.alpinelinux.org/alpine/%s/%s/%s/%s-%s.apk' % (REL, v['repo'], ARCH, n, v['V'])
        import subprocess; subprocess.run(["curl", "-sSfL", "-o", f, url], check=True)
    data = open(f, 'rb').read(); total += len(data)
    # an .apk is several gzip streams concatenated (signature, control, data); tarfile reads them as one archive
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as t:
        for m in t.getmembers():
            if m.name.startswith('.') and '/' not in m.name: continue  # .PKGINFO, .SIGN.*, scripts
            if m.isdev(): continue
            try: t.extract(m, 'rootfs', set_attrs=True, filter='fully_trusted')
            except Exception as e: print('skip', n, m.name, e)
print('downloaded MB', round(total / 1e6, 1))
