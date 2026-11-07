"""Keep finished quizzes finished when only their answer options are reworded.

    python3 tools/quiz/same.py REF [--check]   # REF: the git ref the content was edited from, e.g. origin/main; --check writes nothing

For every module whose @@quiz differs from REF, it checks that the change is wording of options only: the same
questions in the same order, the same TYPE, TAG, Q, ANS, WHY and MODEL, and the same option letters. Then it adds the
quiz's old fingerprints (the plan step's and the quiz tab's, the same fnv the app computes) to `quiz-same:` in @@meta,
so the update tracker (`quizSame` in js/plan.js) treats the new text as the quiz you finished. Any other change fails
here and goes through the update tracker as usual (the quiz reopens, old answers move to the archive).
"""
import re, subprocess, sys, glob, os

def fnv(t):
    h = 0x811c9dc5
    b = t.encode('utf-16-le')
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8); h = (h * 16777619) & 0xffffffff
    s, n = '', h
    while True:
        n, r = divmod(n, 36); s = '0123456789abcdefghijklmnopqrstuvwxyz'[r] + s
        if not n: return s

def sections(text):
    out, name, buf = {}, None, []
    for l in re.split(r'\r?\n', text):
        m = re.match(r'^@@([a-z]+)\s*$', l)
        if m:
            if name: out[name] = '\n'.join(buf)
            name, buf = m.group(1), []
        else: buf.append(l)
    if name: out[name] = '\n'.join(buf)
    return out

def parts(quiz):
    """each question as (fields without option text, option letters)"""
    res = []
    for b in re.split(r'\n---[ \t]*(?=\n|$)', quiz or ''):
        if not b.strip(): continue
        keep, letters = [], []
        for l in b.split('\n'):
            o = re.match(r'^([A-D])\)\s', l)
            if o: letters.append(o.group(1))
            else: keep.append(l)
        res.append(('\n'.join(keep).strip(), letters))
    return res

def quiz_title(sec):
    for l in (sec.get('tickets') or '').split('\n'):
        c = [x.strip() for x in l.split('|')]
        if len(c) >= 6 and c[5].split(':')[0] == 'quiz': return c[3]
    return None

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    ref, check = (args[0] if args else 'origin/main'), '--check' in sys.argv
    bad = 0
    for f in sorted(glob.glob('data/program/*.txt')):
        new = open(f).read()
        try: old = subprocess.run(['git', 'show', ref + ':' + f], capture_output=True, text=True, check=True).stdout
        except subprocess.CalledProcessError: continue
        so, sn = sections(old), sections(new)
        if (so.get('quiz') or '') == (sn.get('quiz') or ''): continue
        if parts(so.get('quiz')) != parts(sn.get('quiz')):
            print('NOT options-only:', f, '(goes through the update tracker)'); bad += 1; continue
        if check: print('ok', os.path.basename(f), 'options-only'); continue
        t = quiz_title(so)
        hs = [fnv(t + '|' + so['quiz'])] if t else []
        hs.append(fnv(so['quiz']))
        meta = sn['meta']; m = re.search(r'^quiz-same:(.*)$', meta, re.M)
        have = m.group(1).split() if m else []
        want = have + [h for h in hs if h not in have]
        line = 'quiz-same: ' + ' '.join(want)
        new = new.replace('@@meta\n' + meta, '@@meta\n' + (re.sub(r'^quiz-same:.*$', line, meta, flags=re.M) if m else meta.rstrip('\n') + '\n' + line + '\n'), 1)
        open(f, 'w').write(new); print('ok', os.path.basename(f), line)
    sys.exit(1 if bad else 0)
