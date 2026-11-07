"""Stops secrets and personal data from reaching this public repository.

  python3 tools/secret_scan.py            scan the files staged for commit (the pre-commit hook and ship.sh run this)
  python3 tools/secret_scan.py --all      scan every tracked file

Blocks: API keys (Anthropic, OpenAI, AWS, GitHub, Google, Slack), private keys, Apps Script sync URLs, sync keys
(?k=...), email addresses, home-folder paths, and any word listed in ~/.data-architect/private_terms.txt (one per
line: your name, employer, anything personal). Test values (testkey, topsecret, sk-ant-test-...) are allowed."""
import os, re, subprocess, sys

PATTERNS = [
    ('Anthropic API key', r'sk-ant-(?!test)[A-Za-z0-9_-]{16,}'),
    ('OpenAI API key', r'\bsk-(?:proj-)?[A-Za-z0-9]{32,}'),
    ('AWS access key', r'\bAKIA[0-9A-Z]{16}\b'),
    ('GitHub token', r'\bgh[pousr]_[A-Za-z0-9]{30,}'),
    ('Google API key', r'\bAIza[0-9A-Za-z_-]{35}\b'),
    ('Slack token', r'\bxox[bpas]-[A-Za-z0-9-]{10,}'),
    ('private key', r'-----BEGIN [A-Z ]*PRIVATE KEY'),
    ('Apps Script sync URL', r'script\.google\.com/macros/s/[A-Za-z0-9_-]{20,}'),
    ('sync key', r'[?&]k=(?!(?:test|testkey|e2ekey|topsecret|mine|old|x|key|your|KEY)\b)[A-Za-z0-9_-]{8,}'),
    ('email address', r'\b[A-Za-z0-9._%+-]+@(?:gmail|googlemail|yahoo|outlook|hotmail|icloud|me|proton|protonmail)\.(?:com|me)\b'),
    ('home folder path', r'/Users/(?!me\b|you\b|name\b)[a-z][a-z0-9._-]{2,}/'),
]
SKIP = re.compile(r'\.(png|jpg|jpeg|gif|webp|ico|m4a|mp3|wasm|woff2?|onnx|bin|gz|zip)$|^vm/|^js/vendor/|^audio/')


def private_terms():
    try:
        return [w.strip() for w in open(os.path.expanduser('~/.data-architect/private_terms.txt'), encoding='utf-8') if w.strip() and not w.startswith('#')]
    except OSError:
        return []


def files(all_files):
    cmd = ['git', 'ls-files'] if all_files else ['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR']
    return [f for f in subprocess.run(cmd, capture_output=True, text=True).stdout.split('\n') if f and not SKIP.search(f)]


def text(f, all_files):
    if all_files:
        try:
            return open(f, encoding='utf-8', errors='ignore').read()
        except OSError:
            return ''
    return subprocess.run(['git', 'show', ':' + f], capture_output=True, text=True, errors='ignore').stdout


def main(a):
    all_files = '--all' in a
    pats = [(n, re.compile(p)) for n, p in PATTERNS] + [('private term', re.compile(r'\b' + re.escape(w) + r'\b', re.I)) for w in private_terms()]
    hits = []
    for f in files(all_files):
        if f == 'tools/secret_scan.py':
            continue
        for i, line in enumerate(text(f, all_files).split('\n'), 1):
            for n, p in pats:
                m = p.search(line)
                if m:
                    hits.append('%s:%d  %s  (%s…)' % (f, i, n, m.group(0)[:6]))
    if hits:
        print('Blocked: secrets or personal data in files about to go public:\n  ' + '\n  '.join(hits[:40]))
        print('Remove them (keys belong in ~/.data-architect/config.json, personal details in ~/.data-architect/profile.txt).')
        sys.exit(1)
    print('secret scan: clean (%d files)' % len(files(all_files)))


if __name__ == '__main__':
    main(sys.argv[1:])
