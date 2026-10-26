"""Nightly coach tools. Run from the repo root.
  python3 tools/coach/coach.py fetch  OUT.json             download synced progress and the last coach report
  python3 tools/coach/coach.py digest IN.json [--now ISO]  print a compact report of recent activity for the coach
  python3 tools/coach/coach.py post   COACH.json [--dry-run]  validate a coach report and upload it
The sync URL (with ?k=KEY) comes from $DA_SYNC_URL or ~/.data-architect/config.json {"sync_url": "..."}.
Your progress never goes into this repository: it travels only between the app, your Google Drive and this Mac."""
import json, os, re, sys, glob, datetime as dt, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCHEMA_VERSION = 1


def sync_url():
    u = os.environ.get('DA_SYNC_URL')
    if not u:
        try:
            u = json.load(open(os.path.expanduser('~/.data-architect/config.json')))['sync_url']
        except (OSError, KeyError, ValueError):
            sys.exit('No sync URL: set DA_SYNC_URL or create ~/.data-architect/config.json with {"sync_url": "https://script.google.com/.../exec?k=..."}')
    return u


def fetch(out):
    u = sync_url()
    with urllib.request.urlopen(u + ('&' if '?' in u else '?') + 'action=load', timeout=60) as r:
        body = json.loads(r.read().decode())
    if body.get('ok') is False:
        sys.exit('Sync refused: ' + str(body.get('error')))
    json.dump(body, open(out, 'w'))
    print('saved', out, '·', len(json.dumps(body.get('data', {}))), 'bytes of progress')


# ---------- program content ----------
def sections(t):
    out, name, buf = {}, None, []
    for l in t.split('\n'):
        m = re.match(r'^@@([a-z]+)\s*$', l)
        if m:
            if name: out[name] = '\n'.join(buf)
            name, buf = m.group(1), []
        else:
            buf.append(l)
    if name: out[name] = '\n'.join(buf)
    return out


def blocks(text, keys):
    res, b, f = [], None, None
    rx = re.compile('^(' + '|'.join(keys) + r'):\s?(.*)$')
    for l in (text or '').split('\n'):
        if l.strip() == '---':
            if b: res.append(b)
            b = f = None; continue
        m = rx.match(l)
        if m: b = b or {}; f = m.group(1); b[f] = m.group(2); continue
        if b is not None and f: b[f] += '\n' + l
    if b: res.append(b)
    return res


def program():
    src = open(os.path.join(ROOT, 'js/plan.js')).read()
    order = re.findall(r"'([a-z]\d\d)'", src[src.index('const BASE_MODS'):src.index(';', src.index('const BASE_MODS'))])
    mods = {}
    for m in order:
        p = os.path.join(ROOT, 'data/program/%s.txt' % m)
        if not os.path.exists(p): continue
        s = sections(open(p, encoding='utf-8').read())
        meta = dict((l.split(':', 1)[0].strip(), l.split(':', 1)[1].strip()) for l in s.get('meta', '').split('\n') if ':' in l)
        tickets = [[x.strip() for x in l.split('|')] for l in s.get('tickets', '').split('\n') if l.count('|') == 5]
        heads = [l[3:].strip() for l in s.get('chapter', '').split('\n') if l.startswith('## ')]
        mods[m] = {'title': meta.get('title', m), 'tickets': tickets, 'heads': heads, 'quiz': blocks(s.get('quiz'), ['TYPE', 'TAG', 'Q', 'ANS', 'WHY', 'MODEL']), 'interview': blocks(s.get('interview'), ['Q', 'SRC', 'TAG', 'A'])}
    banks = {}
    for k in ('py', 'dsa', 'sql', 'spark'):
        for x in json.load(open(os.path.join(ROOT, 'data/bank/%s.json' % k))):
            banks[x['id']] = dict(x, kind=k)
    return order, mods, banks


def label(m):
    k, n = m[0], int(m[1:])
    return {'a': 'AI', 'p': 'Python', 'm': 'Modelling', 'j': 'Platform', 'r': 'Leadership', 'd': 'Systems', 'x': 'Extra'}.get(k, 'Setup' if n == 0 else 'DE') + ('' if (k == 's' and n == 0) else ' %d' % n)


def short(s, n=160):
    s = re.sub(r'\s+', ' ', re.sub(r'[*`]', '', s or '')).strip()
    return s if len(s) <= n else s[:n - 1] + '…'


def digest(path, now=None):
    body = json.load(open(path))
    S, prev = body.get('data') or body, body.get('coach') or {}
    order, mods, banks = program()
    now = now or dt.datetime.now()
    day = dt.timedelta(days=1)
    ms = lambda t: dt.datetime.fromtimestamp(t / 1000)
    done, done_at = S.get('done', {}), S.get('doneAt', {})
    out = ['# Coach digest · %s' % now.strftime('%A %d %b %Y, %H:%M'), '']
    # where the learner is
    status = []
    for m in order:
        if m not in mods: continue
        ids = [t[0] for t in mods[m]['tickets'] if t[5] != 'coding']
        got = [i for i in ids if any(k == m + ':' + i or k.startswith(m + ':' + i + '.') for k in done)]
        status.append((m, len(got), len(ids)))
    cur = next((m for m, g, n in status if g < n), order[-1])
    out.append('## Position in the program')
    out.append('Current module: **%s · %s** (%s). Program order: %s.' % (label(cur), mods[cur]['title'], cur, ', '.join('%s %d/%d' % (label(m), g, n) for m, g, n in status if g or m == cur)))
    out.append('Plan start (week 1 Monday): %s. Daily budget %s min, weekend %s min.' % (S.get('start'), (S.get('settings') or {}).get('capWd', 60), (S.get('settings') or {}).get('capWe', 120)))
    # steps done recently
    recent = sorted(((ms(t), uid) for uid, t in done_at.items() if uid in done and now - ms(t) < 7 * day), reverse=True)
    out += ['', '## Steps ticked in the last 7 days (%d; last 24 h: %d)' % (len(recent), sum(1 for t, _ in recent if now - t < day))]
    for t, uid in recent[:25]:
        m, tid = uid.split(':', 1)
        tk = next((x for x in mods.get(m, {}).get('tickets', []) if x[0] == tid.split('.')[0]), None)
        out.append('- %s · %s · %s' % (t.strftime('%a %H:%M'), label(m) if m in mods else m, tk[3] if tk else tid))
    # quizzes
    out += ['', '## Quizzes submitted']
    for w, q in sorted((S.get('quiz') or {}).items(), key=lambda kv: kv[1].get('at', 0), reverse=True):
        if not q.get('sub'): continue
        m = w if isinstance(w, str) and re.match(r'^[a-z]\d\d$', w) else 's%02d' % int(w)
        qs = mods.get(m, {}).get('quiz', [])
        when = ms(q['at']).strftime('%a %d %b') if q.get('at') else 'earlier'
        out.append('- %s (%s): last %s%%, best %s%%' % (label(m), when, q.get('last', '?'), q.get('best', '?')))
        for k in (q.get('miss') or [])[:6]:
            if k < len(qs): out.append('  - missed [%s] %s' % (qs[k].get('TAG', ''), short(qs[k].get('Q'))))
    # problems
    touched = set(S.get('runs', {})) | set(S.get('hints', {})) | set(k for k, v in S.get('secs', {}).items() if v > 60)
    seen = S.get('seen', {})
    rows = []
    for qid in touched:
        x = banks.get(qid)
        if not x: continue
        h, H = S.get('hints', {}).get(qid, 0), len(x.get('h', []))
        rows.append((seen.get(qid, 0), qid, x, h, H))
    rows.sort(key=lambda r: -r[0])
    out += ['', '## Problems worked on (most recent first; %d total)' % len(rows)]
    for t, qid, x, h, H in rows[:30]:
        when = ms(t).strftime('%a %d %b %H:%M') if t else 'unknown time'
        rv = (S.get('rev') or {}).get(qid)
        out.append('- %s · `%s` %s · %s · %s · %s · runs %d · hints %d/%d%s · %d min%s' % (
            when, qid, x['kind'], short(x['t'], 60), x.get('lv', ''), 'SOLVED' if S.get('solved', {}).get(qid) else 'not solved', S.get('runs', {}).get(qid, 0), min(h, H), H,
            ' · SOLUTION OPENED' if h > H else '', S.get('secs', {}).get(qid, 0) // 60, (' · review box %s due %s' % (rv.get('box'), rv.get('due'))) if rv else ''))
    rev = S.get('rev') or {}
    due = [k for k, r in rev.items() if r.get('due') and r['due'] <= now.strftime('%Y-%m-%d')]
    out += ['', '## Review queue', '%d problems in the queue, %d due now: %s' % (len(rev), len(due), ', '.join(due[:15]) or 'none')]
    # mocks
    graded = prev.get('mock_feedback') or {}
    out += ['', '## Mock interviews to grade']
    pending = [(k, v) for k, v in sorted((S.get('mock') or {}).items()) if v.get('sub') and k not in graded]
    if not pending: out.append('None submitted since the last report.')
    for k, v in pending:
        out.append('### %s · %s round · %d of %d min used' % (k, v.get('kind'), (v.get('secs') or 0) // 60, v.get('mins', 15)))
        for i, q in enumerate(v.get('qs', [])):
            a = (v.get('a') or {}).get(str(i)) or (v.get('a') or {}).get(i) or ''
            out.append('**Q%d [%s]** %s' % (i + 1, q.get('tag', ''), short(q.get('q'), 600)))
            out.append('Answer (%d words): %s' % (len(a.split()), a.strip() or '(no answer)'))
    missed = [k for k, v in (S.get('mock') or {}).items() if not v.get('sub') and k < now.strftime('%Y-%m-%d')]
    if missed: out.append('Started but not submitted: ' + ', '.join(sorted(missed)[-7:]))
    asked = sorted({short(q.get('q'), 90) for v in (S.get('mock') or {}).values() for q in v.get('qs', [])})
    out += ['', '## Questions already asked in mocks (do not repeat within 14 days)'] + ['- ' + q for q in asked[-40:]]
    # valid links
    i_cur = order.index(cur)
    near = [m for m in order[max(0, i_cur - 3):i_cur + 2] if m in mods]
    for w, q in (S.get('quiz') or {}).items():  # modules where he took a quiz in the last 14 days
        m = w if re.match(r'^[a-z]\d\d$', str(w)) else 's%02d' % int(w)
        if q.get('at') and now - ms(q['at']) < 14 * day and m in mods and m not in near: near.append(m)
    for uid, t in done_at.items():  # and modules where he ticked steps
        m = uid.split(':')[0]
        if now - ms(t) < 14 * day and m in mods and m not in near: near.append(m)
    near.sort(key=order.index)
    out += ['', '## Valid links for focus items (use these hrefs exactly)']
    for m in near:
        hs = mods[m]['heads']
        out.append('- %s chapter sections: ' % label(m) + '; '.join('`#/learn/%s/chapter/%d-%d` %s' % (m, i, i, short(h, 50)) for i, h in enumerate(hs)))
        out.append('  quiz `#/quiz/%s` · interview set `#/interview/%s` · path `#/path/%s`' % (m, m, m))
    route = {'py': 'py', 'dsa': 'dsa', 'sql': 'sql', 'spark': 'spark'}
    unsolved = [x for qid, x in banks.items() if not S.get('solved', {}).get(qid) and (x.get('m') in near)]
    out.append('- Problems in these modules not yet solved: ' + '; '.join('`#/%s/%s` %s' % (route[x['kind']], x['id'], short(x['t'], 40)) for x in unsolved[:20]))
    out.append('- Any problem id above can go in review_add. Weekly practice sets: DSA `#/dsa/<id>`, SQL `#/sql/<id>`, PySpark `#/spark/<id>`.')
    out += ['', '## Previous coach report', 'Generated %s. Summary: %s' % (prev.get('generated_at', 'never'), short(prev.get('summary', ''), 400)),
            'Previous weaknesses: ' + '; '.join(prev.get('weaknesses', []) or ['none'])]
    if prev.get('week'): out.append('Previous week carry-forward: ' + '; '.join(prev['week'].get('carry_forward', [])))
    print('\n'.join(out))


def validate(c, banks, state=None):
    errs = []
    need = ['version', 'generated_at', 'summary', 'strengths', 'weaknesses', 'focus', 'review_add', 'mock_feedback', 'next_mock']
    for k in need:
        if k not in c: errs.append('missing ' + k)
    if c.get('version') != SCHEMA_VERSION: errs.append('version must be %d' % SCHEMA_VERSION)
    gen = None
    try:
        gen = dt.datetime.fromisoformat(c.get('generated_at', '').replace('Z', '+00:00'))
        if gen.tzinfo is None: errs.append('generated_at needs a timezone offset')
        elif gen > dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=1): errs.append('generated_at is in the future')
    except ValueError: errs.append('generated_at must be ISO 8601')
    gday = gen.date() if gen else dt.date.today()
    for f in c.get('focus', []):
        if not re.match(r'^#/(learn|quiz|interview|path|py|dsa|sql|spark|git|design|mock|practice)/', f.get('href', '')): errs.append('bad focus href %r' % f.get('href'))
        if not f.get('title'): errs.append('focus item without title')
        m = re.match(r'^#/(py|dsa|sql|spark)/([a-z0-9]+)$', f.get('href', ''))
        if m and m.group(2) not in banks: errs.append('focus links to unknown problem ' + m.group(2))
    if len(c.get('focus', [])) > 4: errs.append('at most 4 focus items')
    for i in c.get('review_add', []):
        if i not in banks: errs.append('review_add unknown id ' + i)
    for k, fb in c.get('mock_feedback', {}).items():
        if not re.match(r'^\d{4}-\d\d-\d\d$', k): errs.append('mock_feedback key must be a date: ' + k); continue
        if dt.date.fromisoformat(k) > gday: errs.append('mock_feedback for a future day: ' + k)
        sm = ((state or {}).get('mock') or {}).get(k)
        if sm and len(fb.get('items', [])) != len(sm.get('qs', [])): errs.append('mock_feedback %s has %d items but that mock had %d questions' % (k, len(fb.get('items', [])), len(sm.get('qs', []))))
        for it in fb.get('items', []):
            if not (isinstance(it.get('score'), int) and 1 <= it['score'] <= 5): errs.append('mock score must be 1-5 on ' + k)
            if not it.get('feedback'): errs.append('mock item without feedback on ' + k)
    for k, nm in c.get('next_mock', {}).items():
        if not re.match(r'^\d{4}-\d\d-\d\d$', k): errs.append('next_mock key must be a date: ' + k); continue
        if not (gday <= dt.date.fromisoformat(k) <= gday + dt.timedelta(days=2)): errs.append('next_mock %s must be for today or the next two days' % k)
        want = 5 if dt.date.fromisoformat(k).weekday() == 6 else 3
        if len(nm.get('questions', [])) != want: errs.append('next_mock %s needs %d questions' % (k, want))
        for q in nm.get('questions', []):
            if not q.get('q'): errs.append('next_mock question without text on ' + k)
    return errs


def post(path, dry, state_path=None):
    c = json.load(open(path))
    _, _, banks = program()
    state = None
    if state_path:
        b = json.load(open(state_path)); state = b.get('data') or b
    errs = validate(c, banks, state)
    if errs:
        sys.exit('Coach report is invalid:\n- ' + '\n- '.join(errs))
    if dry:
        print('valid; not uploaded (dry run)'); return
    u = sync_url()
    req = urllib.request.Request(u, data=json.dumps({'action': 'saveCoach', 'coach': c}).encode(), headers={'Content-Type': 'text/plain;charset=utf-8'}, method='POST')
    with urllib.request.urlopen(req, timeout=60) as r:
        res = json.loads(r.read().decode())
    if res.get('ok') is False: sys.exit('Upload refused: ' + str(res.get('error')))
    print('uploaded coach report generated', c['generated_at'])


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) >= 2 and a[0] == 'fetch': fetch(a[1])
    elif len(a) >= 2 and a[0] == 'digest': digest(a[1], dt.datetime.fromisoformat(a[a.index('--now') + 1]) if '--now' in a else None)
    elif len(a) >= 2 and a[0] == 'post': post(a[1], '--dry-run' in a, a[a.index('--state') + 1] if '--state' in a else None)
    else: print(__doc__)
