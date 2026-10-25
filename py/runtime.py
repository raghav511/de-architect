"""Runtime for the app: sample data, Python REPL, checkers for DSA, SQL and PySpark."""
import duckdb, random, json, io, sys, time, traceback, asyncio, heapq, datetime as dt
import minispark

con = None
spark = None
NS = {}


def seed():
    """Small, deterministic ride-hailing dataset used by every SQL and Spark question."""
    global con, spark
    con = duckdb.connect()
    r = random.Random(7)
    cities = [(1, 'Bengaluru', 'IN'), (2, 'Mumbai', 'IN'), (3, 'Delhi', 'IN'), (4, 'Hyderabad', 'IN'), (5, 'Singapore', 'SG'), (6, 'Jakarta', 'ID'), (7, 'London', 'UK'), (8, 'Austin', 'US')]
    con.execute('create table cities(city_id int, city_name varchar, country varchar)')
    con.executemany('insert into cities values (?,?,?)', cities)
    first = ['Asha', 'Bala', 'Chitra', 'Dev', 'Esha', 'Farid', 'Gita', 'Hari', 'Ira', 'Jay', 'Kavya', 'Lakshmi', 'Manoj', 'Nila', 'Om', 'Priya', 'Ravi', 'Sana', 'Tara', 'Uma', 'Vikram', 'Wen', 'Yash', 'Zara']
    base = dt.date(2026, 10, 1)
    riders = []
    for i in range(1, 61):
        riders.append((i, first[i % 24] + ' ' + chr(65 + i % 26), r.randint(1, 8), base - dt.timedelta(days=r.randint(0, 400)), r.choice(['free', 'free', 'plus'])))
    con.execute('create table riders(rider_id int, name varchar, city_id int, signup_date date, tier varchar)')
    con.executemany('insert into riders values (?,?,?,?,?)', riders)
    drivers = []
    for i in range(1, 31):
        drivers.append((i, first[(i * 5) % 24] + ' ' + chr(70 + i % 20), r.randint(1, 8), round(r.uniform(3.6, 5.0), 2), base - dt.timedelta(days=r.randint(30, 900))))
    con.execute('create table drivers(driver_id int, name varchar, city_id int, rating double, joined_on date)')
    con.executemany('insert into drivers values (?,?,?,?,?)', drivers)
    trips, pays, events = [], [], []
    eid = 1
    for t in range(1, 601):
        rid = r.randint(1, 60)
        city = riders[rid - 1][2] if r.random() < .85 else r.randint(1, 8)
        status = r.choices(['completed', 'cancelled', 'no_driver'], [78, 15, 7])[0]
        did = None if status == 'no_driver' else (r.randint(1, 30) if r.random() > .25 else r.choice([3, 3, 7]))
        day = base + dt.timedelta(days=r.randint(0, 20))
        ts = dt.datetime.combine(day, dt.time(r.randint(0, 23), r.randint(0, 59)))
        km = round(r.uniform(1, 25), 1)
        fare = round(40 + km * r.uniform(9, 16), 2) if status == 'completed' else 0.0
        trips.append((t, rid, did, city, status, fare, km, ts, day))
        if status == 'completed':
            pays.append((len(pays) + 1, t, fare, r.choice(['card', 'upi', 'cash', 'wallet']), ts + dt.timedelta(minutes=r.randint(10, 60))))
        for k, et in enumerate(['requested'] + (['driver_assigned'] if did else []) + (['completed'] if status == 'completed' else ['cancelled'])):
            events.append((eid, t, rid, city, et, ts + dt.timedelta(minutes=k * r.randint(2, 15)), day))
            eid += 1
    # a few duplicate events, like a retried producer
    for e in r.sample(events, 25):
        events.append((eid,) + e[1:])
        eid += 1
    # realistic dirt so data-quality and anti-join questions have answers
    for i in range(61, 66):
        riders.append((i, first[i % 24] + ' ' + chr(65 + i % 26), r.randint(1, 8), base + dt.timedelta(days=r.randint(0, 20)), 'free'))
    con.executemany('insert into riders values (?,?,?,?,?)', riders[60:])
    for k in (17, 222, 431):
        t = list(trips[k]); t[2] = 99; trips[k] = tuple(t)
    done_ids = [t[0] for t in trips if t[4] == 'completed']
    zero = done_ids[5]
    trips = [tuple(list(t[:5]) + [0.0] + list(t[6:])) if t[0] == zero else t for t in trips]
    far = done_ids[40]
    trips = [tuple(list(t[:6]) + [140.0] + list(t[7:])) if t[0] == far else t for t in trips]
    missing = set(done_ids[10:400:37])
    pays = [p for p in pays if p[1] not in missing]
    pays = [(p[0], p[1], round(p[2] + 5.0, 2), p[3], p[4]) if p[1] in set(done_ids[3:300:61]) else p for p in pays]
    spike = base + dt.timedelta(days=14)
    extra = []
    for k in range(60):
        rid = r.randint(1, 60)
        ts = dt.datetime.combine(spike, dt.time(r.randint(6, 22), r.randint(0, 59)))
        km = round(r.uniform(1, 25), 1)
        extra.append((601 + k, rid, r.randint(1, 30), r.randint(1, 8), 'completed', round(40 + km * 12, 2), km, ts, spike))
    for t in extra:
        pays.append((len(pays) + 1000, t[0], t[5], 'upi', t[7] + dt.timedelta(minutes=20)))
        for j, et in enumerate(['requested', 'driver_assigned', 'completed']):
            events.append((eid, t[0], t[1], t[3], et, t[7] + dt.timedelta(minutes=j * 6), t[8]))
            eid += 1
    trips += extra
    con.execute('create table trips(trip_id int, rider_id int, driver_id int, city_id int, status varchar, fare double, distance_km double, pickup_ts timestamp, trip_date date)')
    con.executemany('insert into trips values (?,?,?,?,?,?,?,?,?)', trips)
    con.execute('create table payments(payment_id int, trip_id int, amount double, method varchar, paid_ts timestamp)')
    con.executemany('insert into payments values (?,?,?,?,?)', pays)
    con.execute('create table trip_events(event_id int, trip_id int, rider_id int, city_id int, event_type varchar, event_ts timestamp, event_date date)')
    con.executemany('insert into trip_events values (?,?,?,?,?,?,?)', events)
    clicks = []
    for u in range(1, 21):
        t0 = dt.datetime(2026, 10, 20, 8, 0) + dt.timedelta(minutes=r.randint(0, 600))
        for k in range(r.randint(4, 14)):
            t0 += dt.timedelta(minutes=r.choice([1, 2, 3, 5, 8, 12, 40, 75]))
            clicks.append((u, t0, r.choice(['home', 'search', 'quote', 'book', 'pay', 'help'])))
    con.execute('create table clicks(user_id int, ts timestamp, page varchar)')
    con.executemany('insert into clicks values (?,?,?)', clicks)
    emps = [(1, 'Meera', None, 'Eng', 310), (2, 'Arun', 1, 'Eng', 240), (3, 'Divya', 1, 'Data', 255), (4, 'Kiran', 2, 'Eng', 190), (5, 'Neha', 2, 'Eng', 250), (6, 'Rahul', 3, 'Data', 180), (7, 'Sneha', 3, 'Data', 260),
            (8, 'Tarun', 3, 'Data', 175), (9, 'Vani', 1, 'Ops', 140), (10, 'Zubin', 9, 'Ops', 150), (11, 'Isha', 9, 'Ops', 120), (12, 'Gopal', 2, 'Eng', 190)]
    con.execute('create table employees(emp_id int, name varchar, manager_id int, dept varchar, salary int)')
    con.executemany('insert into employees values (?,?,?,?,?)', emps)
    _seed_modelling(riders, trips)
    spark = minispark.install(con)
    reset_ns()
    return 'ready'


def _seed_modelling(riders, trips):
    """Tables for the data modelling modules. Uses its own random generator so the tables above never change."""
    r = random.Random(11)
    base = dt.date(2026, 10, 1)
    # daily tier snapshots for riders 1-20, Oct 1-21: tiers change now and then (and sometimes change back)
    snaps, tier_now = [], {i: riders[i - 1][4] for i in range(1, 21)}
    for d in range(21):
        day = base + dt.timedelta(days=d)
        for i in range(1, 21):
            if (d and r.random() < 0.06) or (d == 20 and i in (3, 7)):  # riders 3 and 7 always change on the last day
                tier_now[i] = 'plus' if tier_now[i] == 'free' else 'free'
            snaps.append((day, i, tier_now[i]))
    con.execute('create table rider_tier_snapshots(snapshot_date date, rider_id int, tier varchar)')
    con.executemany('insert into rider_tier_snapshots values (?,?,?)', snaps)
    # a Type 2 dimension built from the snapshots up to Oct 20; other riders get one open row
    dim, key = [], 0
    for i in range(1, 21):
        rows = [s for s in snaps if s[1] == i and s[0] <= base + dt.timedelta(days=19)]
        start = rows[0]
        for k in range(1, len(rows) + 1):
            if k == len(rows) or rows[k][2] != start[2]:
                key += 1
                end = rows[k][0] if k < len(rows) else None
                dim.append((key, i, start[2], start[0], end, end is None))
                if k < len(rows):
                    start = rows[k]
    for rd in riders[20:]:
        key += 1
        dim.append((key, rd[0], rd[4], dt.date(2025, 1, 1), None, True))
    con.execute('create table dim_rider_tier(rider_key int, rider_id int, tier varchar, valid_from date, valid_to date, is_current boolean)')
    con.executemany('insert into dim_rider_tier values (?,?,?,?,?,?)', dim)
    today = [(s[1], s[2]) for s in snaps if s[0] == base + dt.timedelta(days=20)] + [(66, 'free'), (67, 'plus')]
    con.execute('create table rider_tier_today(rider_id int, tier varchar)')
    con.executemany('insert into rider_tier_today values (?,?)', today)
    # cumulative activity table as of Oct 20: every completed-trip date per rider, newest first
    act = {}
    for t in trips:
        if t[4] == 'completed' and t[8] <= base + dt.timedelta(days=19):
            act.setdefault(t[1], set()).add(t[8])
    con.execute('create table rider_activity_cumulated(rider_id int, dates_active date[], as_of date)')
    for rid in sorted(act):
        con.execute('insert into rider_activity_cumulated values (?, ?, ?)', [rid, sorted(act[rid], reverse=True), base + dt.timedelta(days=19)])
    # a referral graph between riders (edges with a type and a date)
    edges = [(1, 2), (1, 3), (2, 4), (2, 5), (4, 9), (3, 6), (6, 7), (7, 8), (10, 11), (10, 12), (12, 13), (5, 14), (14, 15), (20, 21)]
    con.execute('create table referrals(referrer_id int, referred_id int, referred_on date)')
    con.executemany('insert into referrals values (?,?,?)', [(a, b, base - dt.timedelta(days=200 - 10 * k)) for k, (a, b) in enumerate(edges)])
    # promotions on trips: a many-to-many bridge with allocation weights that sum to 1 per trip
    done = [t for t in trips if t[4] == 'completed']
    promos = []
    for t in r.sample(done, 40):
        codes = r.sample(['WELCOME', 'MONSOON', 'AIRPORT', 'PLUS10'], r.choice([1, 1, 2]))
        w = [1.0] if len(codes) == 1 else [0.5, 0.5]
        promos += [(t[0], c, x) for c, x in zip(codes, w)]
    con.execute('create table trip_promos(trip_id int, promo_code varchar, weight double)')
    con.executemany('insert into trip_promos values (?,?,?)', promos)


def reset_ns():
    global NS
    NS = {'__name__': '__main__', 'con': con, 'spark': spark, 'F': minispark.F, 'Window': minispark.Window}
    return 'ok'


def _capture(fn):
    out, err = io.StringIO(), None
    old = sys.stdout
    sys.stdout = out
    t0 = time.time()
    try:
        val = fn()
    except Exception as e:
        val = None
        err = ''.join(traceback.format_exception_only(type(e), e)).strip()
        tb = traceback.extract_tb(e.__traceback__)
        user = [f for f in tb if f.filename in ('<user>', '<exec>')]
        if user:
            err = 'line ' + str(user[-1].lineno) + ': ' + err
    finally:
        sys.stdout = old
    return val, out.getvalue(), err, round((time.time() - t0) * 1000)


def repl(line):
    """One terminal line: expressions print their value, statements just run."""
    def go():
        try:
            code = compile(line, '<user>', 'eval')
            v = eval(code, NS)
            if v is not None:
                if isinstance(v, minispark.DataFrame):
                    v.show(10)
                else:
                    print(repr(v))
        except SyntaxError:
            exec(compile(line, '<user>', 'exec'), NS)
    _, out, err, ms = _capture(go)
    return json.dumps({'out': out, 'err': err, 'ms': ms})


def run_script(code):
    def go():
        exec(compile(code, '<user>', 'exec'), NS)
    _, out, err, ms = _capture(go)
    return json.dumps({'out': out, 'err': err, 'ms': ms})


def _norm(rows):
    def v(x):
        if type(x).__name__ == 'Decimal':
            x = float(x)
        if isinstance(x, float):
            return round(x, 2)
        if isinstance(x, (dt.date, dt.datetime)):
            return str(x)
        if isinstance(x, (list, tuple)):
            return tuple(v(i) for i in x)
        if isinstance(x, dict):
            return tuple(sorted((k, v(i)) for k, i in x.items()))
        return x
    return [tuple(v(x) for x in r) for r in rows]


def _table(names, rows, n=50):
    return {'cols': list(names), 'rows': [[None if x is None else str(x) for x in r] for r in rows[:n]], 'total': len(rows)}



class ListNode:
    def __init__(self, val=0, next=None):
        self.val, self.next = val, next

    def __repr__(self):
        return 'ListNode(' + str(to_list(self)) + ')'


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val, self.left, self.right = val, left, right

    def __repr__(self):
        return 'TreeNode(' + str(self.val) + ')'


def build_list(xs, pos=-1):
    head = cur = None
    nodes = []
    for x in xs:
        n = ListNode(x)
        nodes.append(n)
        if cur:
            cur.next = n
        else:
            head = n
        cur = n
    if pos is not None and 0 <= pos < len(nodes):
        cur.next = nodes[pos]
    return head


def to_list(h, limit=10000):
    out = []
    while h is not None and len(out) < limit:
        out.append(h.val)
        h = h.next
    return out


def build_tree(xs):
    if not xs or xs[0] is None:
        return None
    it = iter(xs)
    root = TreeNode(next(it))
    q = [root]
    i = 0
    for v in it:
        node = q[i // 2] if False else None
        break
    q, idx = [root], 1
    while q and idx < len(xs):
        n = q.pop(0)
        if idx < len(xs) and xs[idx] is not None:
            n.left = TreeNode(xs[idx]); q.append(n.left)
        idx += 1
        if idx < len(xs) and xs[idx] is not None:
            n.right = TreeNode(xs[idx]); q.append(n.right)
        idx += 1
    return root


def tree_to_list(root):
    out, q = [], [root]
    while q:
        n = q.pop(0)
        if n is None:
            out.append(None)
            continue
        out.append(n.val)
        q.append(n.left)
        q.append(n.right)
    while out and out[-1] is None:
        out.pop()
    return out


def find_node(root, v):
    st = [root]
    while st:
        n = st.pop()
        if n is None:
            continue
        if n.val == v:
            return n
        st += [n.left, n.right]
    return None


def _conv_in(kind, x, args):
    if kind == 'list':
        return build_list(x)
    if kind == 'tree':
        return build_tree(x)
    if kind and kind.startswith('cycle'):
        return build_list(x[0], x[1])
    return x


def _conv_out(kind, v):
    if kind == 'list':
        return to_list(v)
    if kind == 'tree':
        return tree_to_list(v)
    if kind == 'val':
        return None if v is None else v.val
    return v


def check_dsa(spec_json, code):
    spec = json.loads(spec_json)
    ns = {'ListNode': ListNode, 'TreeNode': TreeNode, 'List': list, 'Optional': object}
    res = {'tests': [], 'out': '', 'err': None}
    from typing import List, Optional
    ns['List'], ns['Optional'] = List, Optional

    def load():
        exec(compile(code, '<user>', 'exec'), ns)
    _, out, err, _ = _capture(load)
    res['out'] = out
    if err:
        res['err'] = err
        return json.dumps(res)
    fn = ns.get(spec['fn'])
    if not callable(fn):
        res['err'] = 'Define ' + ('a class' if spec.get('cls') else 'a function') + ' named ' + spec['fn']
        return json.dumps(res)
    conv = spec.get('in') or []
    for t in spec['tests']:
        args, want = t[0], t[1]
        a = json.loads(json.dumps(args))
        if spec.get('cls'):
            def play(a=a):
                ops, params = a
                obj, outs = None, []
                for op, pr in zip(ops, params):
                    if obj is None:
                        obj = fn(*pr)
                        outs.append(None)
                    else:
                        outs.append(getattr(obj, op)(*pr))
                return outs
            val, o, e, ms = _capture(play)
        else:
            if spec.get('lca'):
                root = build_tree(a[0])
                a = [root, find_node(root, a[1]), find_node(root, a[2])]
            else:
                a = [_conv_in(conv[i] if i < len(conv) else None, x, a) for i, x in enumerate(a)]
            val, o, e, ms = _capture(lambda: fn(*a))
            if not e and spec.get('inplace') is not None:
                val = a[spec['inplace']]
            if not e:
                val = _conv_out(spec.get('out'), val)
            if not e and spec.get('sortout') and isinstance(val, list):
                val = sorted(sorted(x) if isinstance(x, list) else x for x in val)
                want = sorted(sorted(x) if isinstance(x, list) else x for x in want)
        ok = False
        if not e:
            if spec.get('unordered') and isinstance(val, list) and isinstance(want, list):
                try:
                    ok = sorted(map(json.dumps, val)) == sorted(map(json.dumps, want))
                except Exception:
                    ok = False
            else:
                ok = json.loads(json.dumps(val, default=str)) == want
        res['tests'].append({'call': spec['fn'] + '(' + ', '.join(json.dumps(x) for x in args)[:80] + ')', 'want': json.dumps(want)[:60], 'got': (e or json.dumps(val, default=str))[:80], 'ok': ok, 'ms': ms})
        res['out'] += o
    big = spec.get('big')
    if big and all(t['ok'] for t in res['tests']):
        args = eval(big, {})
        _, _, e, ms = _capture(lambda: fn(*args))
        res['tests'].append({'call': 'large input (' + spec.get('bigLabel', 'n = 100,000') + ')', 'want': 'under ' + str(spec.get('ms', 1500)) + ' ms', 'got': e or (str(ms) + ' ms'), 'ok': (not e) and ms <= spec.get('ms', 1500), 'ms': ms, 'perf': True})
    return json.dumps(res)


class _MiniLoop(asyncio.AbstractEventLoop):
    """A small event loop on virtual time. Pyodide's browser loop cannot block in asyncio.run(),
    so exercises run on this one: sleeps jump the clock forward instead of waiting."""

    def __init__(self):
        self._ready, self._timers, self._now, self._seq, self._closed = [], [], 0.0, 0, False

    def time(self):
        return self._now

    def call_soon(self, cb, *args, context=None):
        h = asyncio.Handle(cb, args, self, context)
        self._ready.append(h)
        return h

    def call_at(self, when, cb, *args, context=None):
        h = asyncio.TimerHandle(when, cb, args, self, context)
        self._seq += 1
        heapq.heappush(self._timers, (when, self._seq, h))
        return h

    def call_later(self, delay, cb, *args, context=None):
        return self.call_at(self._now + max(0, delay), cb, *args, context=context)

    def _timer_handle_cancelled(self, handle):
        pass

    def create_future(self):
        return asyncio.Future(loop=self)

    def create_task(self, coro, *, name=None, context=None):
        return asyncio.Task(coro, loop=self, name=name)

    def get_debug(self):
        return False

    def is_closed(self):
        return self._closed

    def is_running(self):
        return asyncio.events._get_running_loop() is self

    def close(self):
        self._closed = True

    def call_exception_handler(self, context):
        pass

    def run_until_complete(self, coro):
        fut = asyncio.ensure_future(coro, loop=self)
        old = asyncio.events._get_running_loop()
        asyncio.events._set_running_loop(self)
        try:
            steps = 0
            while not fut.done():
                steps += 1
                if steps > 1_000_000:
                    raise RuntimeError('event loop ran too long: is something waiting forever?')
                if not self._ready:
                    if not self._timers:
                        raise RuntimeError('deadlock: every task is waiting and nothing will wake it')
                    when, _, h = heapq.heappop(self._timers)
                    self._now = max(self._now, when)
                    if not h.cancelled():
                        self._ready.append(h)
                    continue
                h = self._ready.pop(0)
                if not h.cancelled():
                    h._run()
            return fut.result()
        finally:
            asyncio.events._set_running_loop(old)


def _mini_run(coro, debug=None):
    loop = _MiniLoop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def check_py(spec_json, code):
    """Python-track exercises. Each test is [name, snippet, expected]: the snippet runs against the user's
    namespace and the value of its last line is compared with expected (as JSON)."""
    spec = json.loads(spec_json)
    real_run, asyncio.run = asyncio.run, _mini_run
    try:
        return _check_py(spec, code)
    finally:
        asyncio.run = real_run


def _check_py(spec, code):
    ns = {'__name__': '__main__'}
    res = {'tests': [], 'out': '', 'err': None}
    _, out, err, _ = _capture(lambda: exec(compile(code, '<user>', 'exec'), ns))
    res['out'] = out
    if err:
        res['err'] = err
        return json.dumps(res)
    for name, snippet, want in spec['tests']:
        tns = dict(ns)

        def go(snippet=snippet, tns=tns):
            lines = snippet.strip().split('\n')
            if len(lines) > 1:
                exec(compile('\n'.join(lines[:-1]), '<test>', 'exec'), tns)
            return eval(compile(lines[-1], '<test>', 'eval'), tns)
        val, o, e, ms = _capture(go)
        try:
            got = json.loads(json.dumps(val, default=str))
        except Exception:
            got = repr(val)
        res['tests'].append({'call': name, 'want': json.dumps(want)[:60], 'got': (e or json.dumps(got))[:80], 'ok': (not e) and got == want, 'ms': ms})
        res['out'] += o
    return json.dumps(res)


def run_sql(q):
    val, out, err, ms = _capture(lambda: con.execute(q))
    if err:
        return json.dumps({'err': err.replace('duckdb.duckdb.', ''), 'ms': ms})
    try:
        names = [d[0] for d in val.description] if val.description else []
        rows = val.fetchall() if names else []
    except Exception as e:
        return json.dumps({'err': str(e), 'ms': ms})
    return json.dumps({'table': _table(names, rows), 'ms': ms})


def check_sql(user_q, ref_q, ordered=False):
    u = json.loads(run_sql(user_q))
    if u.get('err'):
        return json.dumps(u)
    ref = con.execute(ref_q)
    rn = [d[0] for d in ref.description]
    rr = ref.fetchall()
    ur = con.execute(user_q).fetchall()
    a, b = _norm(ur), _norm(rr)
    same = (a == b) if ordered else (sorted(a, key=repr) == sorted(b, key=repr))
    tests = [{'name': 'Same number of rows', 'ok': len(a) == len(b), 'note': str(len(a)) + ' rows, expected ' + str(len(b))},
             {'name': 'Same rows' + (' in the same order' if ordered else ''), 'ok': same, 'note': 'matches the reference answer on the sample data' if same else _diff(a, b)}]
    if len(u['table']['cols']) != len(rn):
        tests.append({'name': 'Same columns', 'ok': False, 'note': 'you return ' + str(len(u['table']['cols'])) + ' columns, expected ' + str(len(rn)) + ' (' + ', '.join(rn) + ')'})
    u['tests'] = tests
    u['pass'] = all(t['ok'] for t in tests)
    return json.dumps(u)


def _diff(a, b):
    sa, sb = set(a), set(b)
    extra, miss = [x for x in a if x not in sb], [x for x in b if x not in sa]
    if extra:
        return 'unexpected row, e.g. ' + repr(extra[0])[:70]
    if miss:
        return 'missing row, e.g. ' + repr(miss[0])[:70]
    return 'same rows but different order or duplicates'


def check_spark(user_code, ref_code, var='result', ordered=False):
    reset_ns()
    _, out, err, ms = _capture(lambda: exec(compile(user_code, '<user>', 'exec'), NS))
    res = {'out': out, 'err': err, 'ms': ms}
    if err:
        return json.dumps(res)
    df = NS.get(var)
    if not isinstance(df, minispark.DataFrame):
        res['err'] = 'Assign your final DataFrame to a variable named ' + var
        return json.dumps(res)
    ref_ns = {'spark': spark, 'F': minispark.F, 'Window': minispark.Window}
    exec(ref_code, ref_ns)
    rdf = ref_ns[var]
    _, _, e2, _ = _capture(lambda: df.collect())
    if e2:
        res['err'] = e2
        return json.dumps(res)
    ur, rr = df.collect(), rdf.collect()
    a, b = _norm(ur), _norm(rr)
    same = (a == b) if ordered else (sorted(a, key=repr) == sorted(b, key=repr))
    res['table'] = _table(df.columns, [tuple(r) for r in ur])
    res['tests'] = [{'name': 'Same number of rows', 'ok': len(a) == len(b), 'note': str(len(a)) + ' rows, expected ' + str(len(b))},
                    {'name': 'Same rows', 'ok': same, 'note': 'matches the reference on the sample data' if same else _diff(a, b)}]
    plan = io.StringIO()
    old = sys.stdout
    sys.stdout = plan
    try:
        df.explain()
    finally:
        sys.stdout = old
    res['plan'] = plan.getvalue()
    res['pass'] = all(t['ok'] for t in res['tests'])
    return json.dumps(res)


def tables():
    out = []
    for (n,) in con.execute("select table_name from information_schema.tables where table_schema='main' order by 1").fetchall():
        cols = con.execute("select column_name, data_type from information_schema.columns where table_name=? order by ordinal_position", [n]).fetchall()
        cnt = con.execute('select count(*) from "' + n + '"').fetchone()[0]
        out.append({'name': n, 'rows': cnt, 'cols': [c[0] + ' ' + c[1].lower() for c in cols]})
    return json.dumps(out)


def run_program_test(code, test_code, kind):
    """Run a test block from the course files. Q is the user's SQL; for python/dsa the user's code is exec'd first."""
    tcon = duckdb.connect()
    ns = {'con': tcon, 'duckdb': duckdb}
    if kind == 'sql':
        ns['Q'] = code
    else:
        exec(compile(code, '<user>', 'exec'), ns)
    if kind == 'pyspark':
        ns['spark'] = minispark.install(tcon)
        ns['F'] = minispark.F
    _, out, err, ms = _capture(lambda: exec(test_code, ns))
    if kind == 'pyspark':
        minispark.install(con)
    return json.dumps({'ok': not err, 'err': err, 'out': out, 'ms': ms})
