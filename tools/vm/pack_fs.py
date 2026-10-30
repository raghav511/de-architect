"""Index rootfs/ for the emulator's 9p file system (the basefs JSON format, version 3) and copy file contents
to a flat folder named by a short SHA-256, so the browser downloads each file only when the guest first reads it.
Usage: python3 pack_fs.py ROOT OUTDIR [--exclude /path ...]"""
import hashlib, json, os, shutil, stat, sys

HASH_LEN = 10

def main(root, out, exclude):
    flat = os.path.join(out, 'flat'); os.makedirs(flat, exist_ok=True)
    seen, total = {}, 0

    def node(path, name):
        nonlocal total
        st = os.lstat(path)
        o = [name, st.st_size, int(st.st_mtime), st.st_mode, 0, 0]  # everything is owned by root inside the guest
        if stat.S_ISLNK(st.st_mode):
            o.append(os.readlink(path))
        elif stat.S_ISDIR(st.st_mode):
            o[1] = 0
            o.append([node(os.path.join(path, c), c) for c in sorted(os.listdir(path)) if '/' + os.path.relpath(os.path.join(path, c), root) not in exclude])
        elif stat.S_ISREG(st.st_mode):
            h = hashlib.sha256(open(path, 'rb').read()).hexdigest()
            fn = h[:HASH_LEN] + '.bin'
            assert seen.get(fn, h) == h, 'short hash collision ' + fn
            seen[fn] = h
            if not os.path.exists(os.path.join(flat, fn)): shutil.copyfile(path, os.path.join(flat, fn))
            o.append(fn); total += st.st_size
        else:
            return None
        return o

    kids = [n for n in (node(os.path.join(root, c), c) for c in sorted(os.listdir(root)) if '/' + c not in exclude) if n]
    json.dump({'fsroot': kids, 'version': 3, 'size': total}, open(os.path.join(out, 'fs.json'), 'w'), separators=(',', ':'))
    print('files', len(seen), 'MB', round(total / 1e6, 1))

if __name__ == '__main__':
    a = sys.argv[1:]; ex = set()
    while '--exclude' in a:
        i = a.index('--exclude'); ex.add(a[i + 1].rstrip('/')); del a[i:i + 2]
    main(a[0], a[1], ex)
