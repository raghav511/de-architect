#!/usr/bin/env python3
"""One nightly runner for every Data Architect scheduled job (tools/routines/ROUTINE.md).

  run.py plan                 wait for the network, then list the jobs due tonight (catch-up included)
  run.py prep JOB             clean clone on main plus tonight's branch; prints the folder and branch
  run.py done JOB --result ok|nothing|failed [--note TEXT] [--pr URL]
  run.py health [--no-gh]     prints NEEDS YOU lines only when something needs the learner; else "all good"

State lives outside the repository in ~/.data-architect/runs/status.json (DA_HOME overrides the
~/.data-architect folder, for tests). Local settings (the shared scratch folder) come from
~/.data-architect/routines.json, never from the repository.
"""
import datetime as dt
import json
import os
import socket
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_URL = 'https://github.com/raghav511/de-architect'
DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
NET_URLS = [REPO_URL]
NET_WAITS = [30, 60, 120, 300, 600, 900]   # seconds between network checks, about 33 minutes in all
NIGHT_SHIFT = 6                             # a run before 6 AM belongs to the night before
HISTORY = 30
SHIP_PREFIXES = ('refresh/', 'reels-review/', 'sim/', 'review/', 'rev-')


def home():
    return os.environ.get('DA_HOME') or os.path.expanduser('~/.data-architect')


def status_path():
    return os.path.join(home(), 'runs', 'status.json')


def jobs():
    with open(os.path.join(HERE, 'jobs.json')) as f:
        return json.load(f)['jobs']


def job(jid):
    for j in jobs():
        if j['id'] == jid:
            return j
    sys.exit('unknown job: %s (known: %s)' % (jid, ', '.join(j['id'] for j in jobs())))


def settings():
    p = os.path.join(home(), 'routines.json')
    try:
        with open(p) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def now():
    v = os.environ.get('DA_NOW')   # tests: an ISO time
    return dt.datetime.fromisoformat(v) if v else dt.datetime.now()


def night(t=None):
    t = t or now()
    return (t - dt.timedelta(hours=NIGHT_SHIFT)).date()


def load():
    try:
        with open(status_path()) as f:
            s = json.load(f)
    except (OSError, ValueError):
        s = {}
    s.setdefault('since', night().isoformat())
    s.setdefault('jobs', {})
    return s


def save(s):
    os.makedirs(os.path.dirname(status_path()), exist_ok=True)
    tmp = status_path() + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(s, f, indent=1, sort_keys=True)
    os.replace(tmp, status_path())


def last_slot(j, n):
    """The latest night on or before n when job j should have run."""
    if j['every'] == 'day':
        return n
    want = DAYS.index(j['day'])
    return n - dt.timedelta(days=(n.weekday() - want) % 7)


def interval(j):
    return 1 if j['every'] == 'day' else 7


def is_due(j, st, n):
    """Due when it has not succeeded since its latest slot. A missed Friday runs on the next night."""
    slot = last_slot(j, n)
    since = dt.date.fromisoformat(st.get('since', n.isoformat()))
    if slot < since and j['every'] == 'week':
        return False   # the slot was before this runner existed
    ok = (st['jobs'].get(j['id']) or {}).get('last_ok')
    return not ok or dt.date.fromisoformat(ok) < slot


def reach(url):
    """Raises OSError unless GitHub answers. Uses git (system certificates and proxy), which every job needs anyway."""
    r = subprocess.run(['git', 'ls-remote', '--heads', url, 'main'], capture_output=True, text=True, timeout=60)
    if r.returncode:
        raise OSError((r.stderr or 'git ls-remote failed').strip().splitlines()[-1])


def wait_for_network(resolve=reach, sleep=time.sleep, waits=NET_WAITS):
    for i in range(len(waits) + 1):
        try:
            for u in NET_URLS:
                resolve(u)
            return True
        except OSError as e:
            if i == len(waits):
                print('network: still down after %d checks (%s)' % (i + 1, e))
                return False
            print('network: down (%s), checking again in %d s' % (e, waits[i]), flush=True)
            sleep(waits[i])
    return False


def git(cwd, *args, check=True):
    r = subprocess.run(['git', '-C', cwd] + list(args), capture_output=True, text=True)
    if check and r.returncode:
        raise RuntimeError('git %s: %s' % (' '.join(args), (r.stderr or r.stdout).strip()))
    return r.stdout.strip()


def prep(jid, url=None):
    j = job(jid)
    d = os.path.join(home(), j['clone'])
    url = url or os.environ.get('DA_REPO_URL') or REPO_URL
    notes = []
    if not os.path.isdir(os.path.join(d, '.git')):
        os.makedirs(os.path.dirname(d), exist_ok=True)
        subprocess.run(['git', 'clone', '-q', url, d], check=True)
        notes.append('cloned')
    git(d, 'fetch', '-q', 'origin')
    if git(d, 'status', '--porcelain'):
        tag = 'routines %s %s' % (jid, now().strftime('%Y-%m-%d %H:%M'))
        git(d, 'stash', 'push', '-u', '-q', '-m', tag)
        notes.append('left-over changes kept in git stash "%s"' % tag)
    git(d, 'checkout', '-q', 'main')
    r = subprocess.run(['git', '-C', d, 'merge', '-q', '--ff-only', 'origin/main'], capture_output=True, text=True)
    if r.returncode or git(d, 'rev-list', '--count', 'origin/main..main') != '0':
        raise RuntimeError('main in %s has commits that are not on GitHub; fix by hand' % d)
    br = ''
    if j.get('branch'):
        base = j['branch'].replace('{date}', night().isoformat())
        br, k = base, 2
        while git(d, 'branch', '--list', br) or git(d, 'ls-remote', '--heads', 'origin', br, check=False):
            br, k = '%s-%d' % (base, k), k + 1
        git(d, 'checkout', '-q', '-b', br)
    return d, br, notes


def inbox(line):
    sc = settings().get('scratch')
    p = sc and os.path.join(sc, 'qa', 'LEADER-INBOX.md')
    if p and os.path.isfile(p):
        with open(p, 'a') as f:
            f.write('- %s %s\n' % (now().strftime('%Y-%m-%d %H:%M'), line))


def done(jid, result, note='', pr=''):
    j = job(jid)
    if result not in ('ok', 'nothing', 'failed'):
        sys.exit('result must be ok, nothing or failed')
    s = load()
    e = s['jobs'].setdefault(jid, {})
    n = night().isoformat()
    e['last_result'] = result
    e['last_run'] = n
    if result == 'failed':
        e['fails'] = e.get('fails', 0) + 1
    else:
        e['fails'] = 0
        e['last_ok'] = n
    h = e.setdefault('history', [])
    h.append({'night': n, 'result': result, 'note': note[:300], 'pr': pr, 'at': now().isoformat(timespec='minutes')})
    del h[:-HISTORY]
    save(s)
    what = {'ok': 'shipped' if pr else 'done', 'nothing': 'nothing shipped', 'failed': 'FAILED'}[result]
    inbox('%s (nightly runner): %s%s%s' % (j['title'], what, ' ' + pr if pr else '', ': ' + note if note else ''))
    return e


def open_prs():
    r = subprocess.run(['gh', 'pr', 'list', '--repo', 'raghav511/de-architect', '--state', 'open',
                        '--json', 'number,headRefName,createdAt,url'], capture_output=True, text=True)
    if r.returncode:
        return None
    return json.loads(r.stdout or '[]')


def health(prs=None):
    """What needs the learner. Nothing here means nobody has to look."""
    s, n, out = load(), night(), []
    since = dt.date.fromisoformat(s['since'])
    for j in jobs():
        e = s['jobs'].get(j['id']) or {}
        if e.get('fails', 0) >= 2:
            out.append('%s failed %d nights in a row: %s' % (j['title'], e['fails'], (e.get('history') or [{}])[-1].get('note', '')))
            continue
        ok = e.get('last_ok')
        ref = dt.date.fromisoformat(ok) if ok else since - dt.timedelta(days=1)
        late = (n - ref).days
        if late > 2 * interval(j) and (ok or (n - since).days >= 2 * interval(j)):
            out.append('%s has not finished for %d days' % (j['title'], late))
    if prs is not None:
        cut = now().astimezone() - dt.timedelta(hours=12)
        for p in prs:
            if p['headRefName'].startswith(SHIP_PREFIXES):
                made = dt.datetime.fromisoformat(p['createdAt'].replace('Z', '+00:00'))
                if made < cut:
                    out.append('PR %s (%s) is still open: merge or close it' % (p['url'], p['headRefName']))
    return out


def main(a):
    if not a or a[0] in ('-h', '--help'):
        print(__doc__)
        return 0
    cmd = a[0]
    if cmd == 'plan':
        s = load()
        save(s)
        net = wait_for_network()
        n = night()
        due = [j for j in jobs() if is_due(j, s, n)]
        print('night %s, network %s' % (n, 'up' if net else 'DOWN'))
        sc = settings().get('scratch')
        print('shared folder <scratch>: %s' % (sc if sc and os.path.isdir(sc) else '(none: skip its steps)'))
        if not due:
            print('nothing due')
        for j in due:
            caught = ' (catch-up)' if last_slot(j, n) < n else ''
            print('due: %s  %s%s  budget %d min  brief %s' % (j['id'], j['title'], caught, j['minutes'],
                                                              os.path.join(HERE, j['brief'])))
        return 0 if net else 3
    if cmd == 'prep':
        try:
            d, br, notes = prep(a[1])
        except (RuntimeError, subprocess.CalledProcessError) as e:
            print('prep failed: %s' % e)
            return 4
        print('folder: %s' % d)
        print('branch: %s' % (br or '(none: this job never commits)'))
        for x in notes:
            print('note: %s' % x)
        return 0
    if cmd == 'done':
        jid, opts = a[1], {'--result': '', '--note': '', '--pr': ''}
        i = 2
        while i < len(a):
            opts[a[i]] = a[i + 1]
            i += 2
        e = done(jid, opts['--result'], opts['--note'], opts['--pr'])
        print('%s: %s (fails in a row %d)' % (jid, e['last_result'], e.get('fails', 0)))
        return 0
    if cmd == 'health':
        prs = None if '--no-gh' in a else open_prs()
        out = health(prs)
        for x in out:
            print('NEEDS YOU: ' + x)
        if not out:
            print('all good')
        if prs is None and '--no-gh' not in a:
            print('note: could not list open PRs (gh)')
        return 0
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
