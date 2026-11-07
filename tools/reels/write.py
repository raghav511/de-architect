"""Writes reel scripts for every chapter section that has no hand-written reel (tools/reels/r_<mid>.py), using
Claude Code on this Mac (`claude -p`, all tools off, no MCP, no session saved), the same way the grader does.

  python3 tools/reels/write.py                 every module, only sections that are new or changed since last time
  python3 tools/reels/write.py p02 s05         just these modules
  python3 tools/reels/write.py --limit 2       stop after two sections (a quick look at quality)

Each section's text is fingerprinted, so a section added or edited by the daily refresh gets new reels and an
unchanged one is never rewritten. Output: tools/reels/auto/<mid>.json, merged by build.py; then run voice.py."""
import concurrent.futures as cf, hashlib, json, os, re, shutil, subprocess, sys, tempfile, threading

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
AUTO = os.path.join(os.path.dirname(__file__), 'auto')
MODEL = os.environ.get('DA_REEL_MODEL', 'sonnet')
SHOW = {'type': 'object', 'properties': {
    't': {'type': 'string', 'enum': ['big', 'points', 'flow', 'bars', 'code']},
    'text': {'type': 'string'}, 'sub': {'type': 'string'}, 'note': {'type': 'string'}, 'unit': {'type': 'string'},
    'items': {'type': 'array', 'items': {'type': 'string'}},
    'bars': {'type': 'array', 'items': {'type': 'object', 'properties': {'label': {'type': 'string'}, 'value': {'type': 'number'}, 'note': {'type': 'string'}}, 'required': ['label', 'value']}}},
    'required': ['t']}
SCHEMA = {'type': 'object', 'properties': {'reels': {'type': 'array', 'minItems': 1, 'maxItems': 4, 'items': {'type': 'object', 'properties': {
    'title': {'type': 'string'},
    'beats': {'type': 'array', 'minItems': 2, 'maxItems': 5, 'items': {'type': 'object', 'properties': {'say': {'type': 'string'}, 'show': SHOW}, 'required': ['say', 'show']}},
    'check': {'type': 'object', 'properties': {'q': {'type': 'string'}, 'opts': {'type': 'array', 'minItems': 3, 'maxItems': 4, 'items': {'type': 'string'}}, 'ans': {'type': 'integer'}, 'why': {'type': 'string'}}, 'required': ['q', 'opts', 'ans', 'why']},
    'work': {'type': 'array', 'minItems': 2, 'maxItems': 3, 'items': {'type': 'string'}}}, 'required': ['title', 'beats', 'check', 'work']}}}, 'required': ['reels']}
SYSTEM = """You write short narrated explainer reels for a senior data engineer preparing for staff and architect interviews.
Rules:
- Each reel is spoken in 30 to 60 seconds: 75 to 145 words of narration in total across its beats. Count carefully.
- One idea per reel. If the section has more than one big idea, write 2 to 4 reels and split the ideas between them.
- Beat 1 is a hook: a question or a surprising fact the learner wants answered. Then 1 to 3 beats that answer it.
- Explain cause and effect in plain spoken English. Never state a mechanism without saying why it matters, e.g. not
  "Kafka never seeks" but what a seek is, why it is slow, and what Kafka does instead. Prefer concrete numbers and examples.
- Words are read aloud: no markdown, no code symbols in "say", spell out symbols ("n squared", "equals"). Short sentences.
- Each beat has a picture: big (text plus sub, a short headline), points (2 to 4 short items), flow (2 to 5 steps),
  bars (2 or 3 bars with numeric value and unit, for comparisons), or code (a few lines, only when the section is about code).
- End each reel with check: one multiple-choice question that tests the idea (not trivia), the right option index in ans
  (0-based), and why. Then work: 2 or 3 concrete things to do at work tomorrow because of this idea.
- Write everything yourself from the section below. Do not copy sentences from it word for word.
Reply with JSON only."""


def claude_bin():
    return os.environ.get('DA_CLAUDE_BIN') or shutil.which('claude') or os.path.expanduser('~/.local/bin/claude')


def sections(mid):
    t = open(os.path.join(ROOT, 'data/program/%s.txt' % mid), encoding='utf-8').read()
    m = re.search(r'^@@chapter\s*$(.*?)(?=^@@[a-z]+\s*$|\Z)', t, re.S | re.M)
    title = (re.search(r'^title:\s*(.+)$', t, re.M) or [None, mid])[1]
    out = []
    for part in re.split(r'\n(?=## )', (m.group(1) if m else '').strip()):
        h = re.match(r'## (.+)', part.strip())
        if h: out.append((h.group(1).strip(), part.strip()))
    return title, out


def hand_secs(mid):
    p = os.path.join(os.path.dirname(__file__), 'r_%s.py' % mid)
    if not os.path.exists(p): return set()
    import runpy
    return {r['sec'] for r in runpy.run_path(p)['REELS']}


def words(r): return sum(len(b['say'].split()) for b in r['beats'])


def ask(mtitle, head, body):
    prompt = 'Module: %s\nSection: %s\n\n%s' % (mtitle, head, body[:7000])
    cmd = [claude_bin(), '-p', '--model', MODEL, '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
           '--disable-slash-commands', '--no-session-persistence', '--output-format', 'json', '--json-schema', json.dumps(SCHEMA), '--system-prompt', SYSTEM]
    with tempfile.TemporaryDirectory() as empty:
        r = subprocess.run(cmd, input=prompt, capture_output=True, text=True, timeout=300, cwd=empty)
    if r.returncode != 0: raise RuntimeError((r.stderr or r.stdout)[-300:])
    j = json.loads(r.stdout)
    res = j.get('structured_output') or j.get('result')
    if isinstance(res, str): res = json.loads(res[res.index('{'):res.rindex('}') + 1])
    return res['reels']


def tidy(reels):
    out = []
    for r in reels:
        for b in r['beats']:
            s = b['show']
            if s.get('t') == 'bars': s['items'] = [[x['label'], x['value'], x.get('note', '')] for x in s.pop('bars', [])] or [['', 1, '']]
        c = r['check']; c['ans'] = max(0, min(len(c['opts']) - 1, int(c['ans'])))
        out.append(r)
    for i, r in enumerate(out):
        if len(out) > 1: r['part'] = '%d of %d' % (i + 1, len(out))
    return out


def main(a):
    limit = int(a[a.index('--limit') + 1]) if '--limit' in a else 10 ** 6
    mods = [x for x in a if re.fullmatch(r'[a-z]\d\d', x)] or sorted(os.path.basename(p)[:-4] for p in os.listdir(os.path.join(ROOT, 'data/program')) if p.endswith('.txt'))
    os.makedirs(AUTO, exist_ok=True)
    jobs, lock, done = [], threading.Lock(), [0]
    for mid in mods:
        f = os.path.join(AUTO, mid + '.json'); old = json.load(open(f)) if os.path.exists(f) else {}
        mtitle, secs = sections(mid); hs = hand_secs(mid)
        for head, body in secs:
            sec = head.split(' ')[0] if re.match(r'^[A-Z]?\d+(\.\d+)?$', head.split(' ')[0]) else head
            if sec in hs or head in hs: continue
            h = hashlib.sha1(body.encode()).hexdigest()[:12]
            if (old.get(head) or {}).get('hash') == h: continue
            jobs.append((mid, mtitle, head, sec, body, h))
    jobs = jobs[:limit]
    print(len(jobs), 'sections to write', flush=True)

    def run(job):
        mid, mtitle, head, sec, body, h = job
        for attempt in range(2):
            try:
                reels = tidy(ask(mtitle, head, body))
                bad = [words(r) for r in reels if not 65 <= words(r) <= 155]
                if bad and attempt == 0: continue
                break
            except Exception as e:
                reels, err = None, str(e)
        with lock:
            done[0] += 1
            if not reels: print('[%d/%d] %s %s: failed (%s)' % (done[0], len(jobs), mid, head, err[:120]), flush=True); return
            f = os.path.join(AUTO, mid + '.json'); cur = json.load(open(f)) if os.path.exists(f) else {}
            cur[head] = {'hash': h, 'sec': sec, 'reels': reels}
            json.dump(cur, open(f, 'w'), ensure_ascii=False, indent=1)
            print('[%d/%d] %s %s: %d reels, %s words' % (done[0], len(jobs), mid, head[:40], len(reels), '/'.join(str(words(r)) for r in reels)), flush=True)

    with cf.ThreadPoolExecutor(int(os.environ.get('DA_REEL_JOBS', '3'))) as ex: list(ex.map(run, jobs))


if __name__ == '__main__':
    main(sys.argv[1:])
