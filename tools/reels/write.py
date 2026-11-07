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
    't': {'type': 'string', 'enum': ['scene', 'big', 'points', 'flow', 'bars', 'code']},
    'title': {'type': 'string'}, 'kicker': {'type': 'string'},
    'nodes': {'type': 'array', 'items': {'type': 'object'}}, 'edges': {'type': 'array', 'items': {'type': 'array'}}, 'steps': {'type': 'array', 'items': {'type': 'object'}},
    'text': {'type': 'string'}, 'sub': {'type': 'string'}, 'note': {'type': 'string'}, 'unit': {'type': 'string'},
    'items': {'type': 'array', 'items': {'type': 'string'}},
    'bars': {'type': 'array', 'items': {'type': 'object', 'properties': {'label': {'type': 'string'}, 'value': {'type': 'number'}, 'note': {'type': 'string'}}, 'required': ['label', 'value']}}},
    'required': ['t']}
SCHEMA = {'type': 'object', 'properties': {'reels': {'type': 'array', 'minItems': 2, 'maxItems': 8, 'items': {'type': 'object', 'properties': {
    'title': {'type': 'string'}, 'level': {'type': 'string', 'enum': ['New to it', 'How it works', 'Inside and caveats', 'Architect']},
    'beats': {'type': 'array', 'minItems': 2, 'maxItems': 5, 'items': {'type': 'object', 'properties': {'say': {'type': 'string'}, 'show': SHOW}, 'required': ['say', 'show']}},
    'check': {'type': 'object', 'properties': {'q': {'type': 'string'}, 'opts': {'type': 'array', 'minItems': 3, 'maxItems': 4, 'items': {'type': 'string'}}, 'ans': {'type': 'integer'}, 'why': {'type': 'string'}}, 'required': ['q', 'opts', 'ans', 'why']},
    'work': {'type': 'array', 'minItems': 2, 'maxItems': 3, 'items': {'type': 'string'}}}, 'required': ['title', 'level', 'beats', 'check', 'work']}}}, 'required': ['reels']}
SYSTEM = """You write short narrated explainer reels that teach one data engineering concept in and out, for a learner
preparing for staff and architect interviews. You write a SERIES for the section: one or more reels at each of four levels,
in this order, each level its own reel:
  New to it          an everyday analogy for someone new or non-technical; no jargon without saying what it means.
  How it works       the technical mechanism, step by step, with concrete numbers.
  Inside and caveats internals, edge cases, failure modes and the gotchas interviewers probe.
  Architect          trade-offs, when not to use it, cost, scale limits, what you would choose instead and why.
If a level needs more than one reel, add another reel at the same level ("part" is set later). Skip a level only if the
section has nothing for it. Teach the concept only: never talk about the course, the app, modules or scoring.
Rules for every reel:
- Spoken in 30 to 60 seconds: 75 to 145 words of narration in total across its beats. Count carefully.
- Beat 1 is a hook: a question or a surprising fact. Then 1 to 3 beats that answer it.
- Explain cause and effect in plain spoken English, never a mechanism without why it matters (not "Kafka never seeks",
  but what a seek is, why it is slow, and what Kafka does instead). Prefer concrete numbers and examples.
- Words are read aloud: no markdown or code symbols in "say"; spell symbols out. Short sentences.
- Pictures are animated scenes. Prefer t "scene": {"t":"scene","title":"headline with one *highlighted* word",
  "nodes":[{"id","label","sub","x","y","tone"}] (x and y are percent of a tall stage, keep at most 3 nodes per row and
  labels short; tone is blue, teal, amber, red, plum or grey; kind "disk" draws a disk), "edges":[["a","b"]],
  "steps":[{"at":0.0-1.0, then one of: "show":"id" or [ids], "packet":["a","b"],"n":3, "chip":{"text","tone","icon"},
  "count":{"key","label","to","unit","tone"}, "cells":{"label","items":[["offset","value"]]},
  "race":{"items":[["label",number,"tone"]],"unit"}, "glow":"id", "dim":"id", "seek":"id"}]}.
  Components appear when the narration names them; dots show each interaction; chips state the takeaway.
  You may also use big, points, flow, bars or code for simple beats.
- End each reel with check: one multiple-choice question that tests the idea (not trivia), the right option index in ans
  (0-based), and why. Write every option at about the same length and in the same style: the right option must not be
  the longest or the most detailed, and each wrong option is a real misconception that stays clearly wrong. Put the
  right option at any index (the app shuffles the order on screen). Then work: 2 or 3 concrete things to do at work because of this idea.
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
    import runpy  # only a hand-written series with all four levels stops the writer; a single older reel is rewritten
    rs = runpy.run_path(p)['REELS']
    return {s for s in {r['sec'] for r in rs} if all(r.get('level') for r in rs if r['sec'] == s)}


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
    for lv in {r.get('level') for r in out}:  # parts count within one level
        same = [r for r in out if r.get('level') == lv]
        for i, r in enumerate(same):
            if len(same) > 1: r['part'] = '%d of %d' % (i + 1, len(same))
    order = ['New to it', 'How it works', 'Inside and caveats', 'Architect']
    return sorted(out, key=lambda r: order.index(r['level']) if r.get('level') in order else 9)


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
