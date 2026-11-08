"""minilake: small, real versions of Kafka, S3 and Airflow that run inside the browser (Pyodide), so the system labs
need no Docker. They keep the behaviour interviews ask about and leave out the operations:

  Broker      topics split into partitions; a key always lands in the same partition; offsets; consumer groups
              that share partitions and commit offsets; lag.
  ObjectStore buckets and keys like S3; list by prefix; Parquet written and read through DuckDB.
  Dag         tasks with dependencies, run once per data interval with retries; backfill over a range.
  DeltaTable  a Delta-style table: Parquet-like data files plus a _delta_log of numbered JSON commits with add and
              remove actions, replayed to find the live files; optimistic commits, VERSION AS OF, history,
              OPTIMIZE, DELETE that rewrites files, VACUUM, and a zero-copy CLONE.
  Table       an Iceberg-style table on the ObjectStore: every commit is a snapshot listing its data files, files
              are partitioned by day, columns are tracked by id (a rename never rewrites files), time travel,
              files and snapshots metadata, optimistic commits, compaction and snapshot expiry.
  MiniCluster a Spark-style join stage under load: hash partitioning, one task per shuffle partition, executor
              memory with spill and out-of-memory, broadcast joins, adaptive skew splits, and a real Spark event log
              (SparkListenerTaskEnd lines) that the chapter's stage_summary reads unchanged.
  Athena      bytes scanned and cost for a query over JSON or columnar files, with dt= partition pruning; iam_allows
              evaluates an IAM-style policy (explicit Deny wins, wildcards).
"""
import datetime as _dt, io, json, os, re, tempfile, zlib


# ---------------- Kafka-style broker ----------------
class Broker:
    def __init__(self):
        self.topics = {}      # name -> list of partitions; a partition is a list of (key, value)
        self.commits = {}     # (group, topic, partition) -> next offset to read

    def create_topic(self, name, partitions=3):
        if name not in self.topics:
            self.topics[name] = [[] for _ in range(partitions)]
        return self

    def partition_for(self, topic, key):
        """Same key, same partition: ordering holds per key. crc32 stands in for Kafka's murmur2."""
        n = len(self.topics[topic])
        return zlib.crc32(str(key).encode()) % n

    def produce(self, topic, key, value):
        """Append to the key's partition; returns (partition, offset)."""
        p = self.partition_for(topic, key)
        log = self.topics[topic][p]
        log.append((key, value))
        return p, len(log) - 1

    def end_offsets(self, topic):
        return [len(p) for p in self.topics[topic]]

    def consumer(self, group, topic, member='c1', members=None):
        return Consumer(self, group, topic, member, members or [member])

    def lag(self, group, topic):
        return sum(len(log) - self.commits.get((group, topic, i), 0) for i, log in enumerate(self.topics[topic]))


class Consumer:
    """One member of a consumer group. Partitions are split between the group's members by range assignment."""
    def __init__(self, broker, group, topic, member, members):
        self.b, self.group, self.topic = broker, group, topic
        ms = sorted(members); n = len(broker.topics[topic]); k = ms.index(member)
        base, extra = divmod(n, len(ms))
        start = k * base + min(k, extra)
        self.partitions = list(range(start, start + base + (1 if k < extra else 0)))
        self.pos = {p: broker.commits.get((group, topic, p), 0) for p in self.partitions}

    def poll(self, max_records=100):
        """Records after the current position: dicts with partition, offset, key, value."""
        out = []
        for p in self.partitions:
            log = self.b.topics[self.topic][p]
            while self.pos[p] < len(log) and len(out) < max_records:
                k, v = log[self.pos[p]]
                out.append({'partition': p, 'offset': self.pos[p], 'key': k, 'value': v})
                self.pos[p] += 1
        return out

    def commit(self):
        """Save positions so a restarted consumer continues where this one stopped."""
        for p, o in self.pos.items():
            self.b.commits[(self.group, self.topic, p)] = o

    def seek(self, partition, offset):
        self.pos[partition] = offset


# ---------------- S3-style object store ----------------
class ObjectStore:
    def __init__(self):
        self.objects = {}   # 's3://bucket/key' -> bytes

    @staticmethod
    def _norm(path):
        if not path.startswith('s3://'):
            raise ValueError('paths look like s3://bucket/key, got ' + path)
        return path

    def put(self, path, data):
        self.objects[self._norm(path)] = data if isinstance(data, bytes) else str(data).encode()

    def get(self, path):
        return self.objects[self._norm(path)]

    def list(self, prefix):
        """Keys under a prefix, sorted, like an S3 listing."""
        return sorted(k for k in self.objects if k.startswith(prefix))

    def delete(self, path):
        self.objects.pop(self._norm(path), None)

    def write_parquet(self, path, rows):
        """rows: list of dicts with the same keys. Written as one Parquet file by DuckDB."""
        import duckdb
        if not rows:
            raise ValueError('no rows to write')
        con = duckdb.connect()
        cols = list(rows[0].keys())
        con.execute('create table t as select * from (values ' + ','.join('(' + ','.join('?' for _ in cols) + ')' for _ in rows) + ') v(' + ','.join('"' + c + '"' for c in cols) + ')', [r[c] for r in rows for c in cols])
        fd, tmp = tempfile.mkstemp(suffix='.parquet'); os.close(fd)
        con.execute("copy t to '" + tmp + "' (format parquet)")
        self.put(path, open(tmp, 'rb').read()); os.remove(tmp)
        return len(rows)

    def duckdb(self, prefix, view='raw'):
        """A DuckDB connection with every Parquet file under prefix as one view, with Hive-style dt=/hour= columns."""
        import duckdb
        d = tempfile.mkdtemp(); files = []
        for k in self.list(prefix):
            if not k.endswith('.parquet'):
                continue
            local = os.path.join(d, k[len('s3://'):])
            os.makedirs(os.path.dirname(local), exist_ok=True)
            open(local, 'wb').write(self.objects[k]); files.append(local)
        con = duckdb.connect()
        if files:
            lit = '[' + ','.join("'" + f.replace("'", "''") + "'" for f in files) + ']'  # views cannot take parameters
            con.execute("create view " + view + " as select * from read_parquet(" + lit + ", hive_partitioning = true)")
        return con


# ---------------- Iceberg-style table ----------------
class CommitConflict(Exception):
    """Another writer committed first: re-read the table and retry on the new snapshot."""


class Table:
    """An Iceberg-style table. Data files are JSON lines here (Parquet in the real thing) so you can read them; what
    matters is the metadata: a snapshot is the full list of data files at one commit, and readers use one snapshot."""
    def __init__(self, store, location, columns, ts_col='event_ts'):
        self.store, self.location, self.ts_col = store, location.rstrip('/'), ts_col
        self.ids = {c: i + 1 for i, c in enumerate(columns)}   # column name -> id; files store ids, not names
        self.next_id, self.snaps, self.current, self._n = len(columns) + 1, [], None, 0

    # --- reading ---
    def snapshot(self, snapshot_id=None):
        sid = self.current if snapshot_id is None else snapshot_id
        for s in self.snaps:
            if s['snapshot_id'] == sid:
                return s
        if sid is None:
            return {'snapshot_id': None, 'files': []}
        raise KeyError('no snapshot %s (expired?)' % sid)

    def snapshot_as_of(self, ts):
        """The snapshot that was current at time ts (a commit counter here)."""
        old = [s for s in self.snaps if s['committed_at'] <= ts]
        return old[-1]['snapshot_id'] if old else None

    def scan(self, snapshot_id=None, day=None):
        """Rows of one snapshot (the current one by default), with today's column names."""
        names = {i: c for c, i in self.ids.items()}
        out = []
        for f in self.snapshot(snapshot_id)['files']:
            if day is not None and f['partition'] != day:
                continue  # partition pruning: the file's metadata says it cannot match
            for line in self.store.get(f['path']).decode().splitlines():
                r = json.loads(line)
                out.append({names[int(k)]: v for k, v in r.items() if int(k) in names})
        return out

    def files(self, snapshot_id=None):
        """The .files metadata table: one row per data file."""
        return [dict(f) for f in self.snapshot(snapshot_id)['files']]

    def snapshots(self):
        """The .snapshots metadata table."""
        return [{k: s[k] for k in ('snapshot_id', 'parent_id', 'committed_at', 'operation', 'added_files', 'deleted_files')} for s in self.snaps]

    # --- writing ---
    def _write_file(self, day, rows):
        self._n += 1
        path = '%s/data/day=%s/%05d.jsonl' % (self.location, day, self._n)
        body = '\n'.join(json.dumps({str(self.ids[c]): v for c, v in r.items() if c in self.ids}, sort_keys=True) for r in rows)
        self.store.put(path, body)
        return {'path': path, 'partition': day, 'record_count': len(rows), 'size': len(body)}

    def day_of(self, row):
        return str(row[self.ts_col])[:10]

    def commit(self, add_rows=(), delete_files=(), base=None, operation=None):
        """Atomically replace delete_files with new files holding add_rows (one file per day). base is the snapshot
        id the writer read; if another commit landed since, CommitConflict is raised and nothing changes."""
        if base is not None and base != self.current:
            raise CommitConflict('table moved from snapshot %s to %s' % (base, self.current))
        gone = {f['path'] if isinstance(f, dict) else f for f in delete_files}
        keep = [f for f in self.snapshot()['files'] if f['path'] not in gone]
        by_day = {}
        for r in add_rows:
            by_day.setdefault(self.day_of(r), []).append(r)
        added = [self._write_file(d, rs) for d, rs in sorted(by_day.items())]
        sid = len(self.snaps) + 1 if not self.snaps else self.snaps[-1]['snapshot_id'] + 1
        self.snaps.append({'snapshot_id': sid, 'parent_id': self.current, 'committed_at': sid, 'files': keep + added,
                           'operation': operation or ('overwrite' if gone else 'append'), 'added_files': len(added), 'deleted_files': len(gone)})
        self.current = sid
        return sid

    def append(self, rows):
        return self.commit(add_rows=rows)

    # --- schema and maintenance ---
    def rename_column(self, old, new):
        """Metadata only: the id stays, so every old file still reads under the new name."""
        if new in self.ids:
            raise ValueError(new + ' already exists')
        self.ids[new] = self.ids.pop(old)

    def add_column(self, name):
        self.ids[name] = self.next_id; self.next_id += 1

    def expire_snapshots(self, keep_last=1):
        """Drop all but the newest keep_last snapshots, then delete data files no kept snapshot uses."""
        self.snaps = self.snaps[-keep_last:]
        live = {f['path'] for s in self.snaps for f in s['files']}
        for k in self.store.list(self.location + '/data/'):
            if k not in live:
                self.store.delete(k)
# ---------------- Spark-style cluster under load ----------------
def hash_partition(key, n):
    """The shuffle partition a key goes to (Spark's HashPartitioning; crc32 stands in for murmur3). NULL keys all
    land in partition 0, which is why a column with many NULLs skews a join."""
    return 0 if key is None else zlib.crc32(str(key).encode()) % n


def enrich_plan(broadcast_zones=False, filter_first=True, aqe=False):
    """explain("formatted")-style text for the module 3 enrichment job: trips joined to drivers and zones."""
    zj = 'BroadcastHashJoin Inner BuildRight (zone_id)' if broadcast_zones else 'SortMergeJoin Inner (zone_id)'
    lines = ['== Physical Plan ==', ('AdaptiveSparkPlan isFinalPlan=true' if aqe else 'AdaptiveSparkPlan isFinalPlan=false'),
             '+- Project [trip_id, driver_id, rating, vehicle_type, zone_name, surge]',
             '   +- ' + zj]
    left = ['      :- SortMergeJoin Inner (driver_id)',
            '      :  :- Sort [driver_id ASC]',
            '      :  :  +- Exchange hashpartitioning(driver_id, 200)',
            ('      :  :     +- Filter (status = completed) AND isnotnull(driver_id)' if filter_first else '      :  :     +- Project [trip_id, driver_id, zone_id, status]'),
            '      :  :        +- Scan parquet silver.trips PushedFilters: [' + ('EqualTo(status,completed), IsNotNull(driver_id)' if filter_first else '') + ']',
            '      :  +- Sort [driver_id ASC]',
            '      :     +- Exchange hashpartitioning(driver_id, 200)',
            '      :        +- Scan parquet silver.drivers PushedFilters: [IsNotNull(driver_id)]']
    if not broadcast_zones:
        left = ['      :- Sort [zone_id ASC]', '      :  +- Exchange hashpartitioning(zone_id, 200)'] + ['   ' + l for l in left]
    right = (['      +- BroadcastExchange HashedRelationBroadcastMode(zone_id)', '         +- Scan parquet silver.zones PushedFilters: []'] if broadcast_zones else
             ['      +- Sort [zone_id ASC]', '         +- Exchange hashpartitioning(zone_id, 200)', '            +- Scan parquet silver.zones PushedFilters: []'])
    return '\n'.join(lines + left + right)


class MiniCluster:
    """One join stage of a Spark job, modelled closely enough to show skew, spill and OOM. Each shuffle partition is
    one task; a task's time and shuffle read grow with its rows. Rows over the task's memory spill to disk (slower);
    rows over four times the memory fail the task with an out-of-memory error, which fails the job."""
    def __init__(self, executor_mem_mb=1024, row_bytes=200000, secs_per_row=0.004):
        # one simulated row stands for about a thousand real ones, so a lab-sized run behaves like a day of trips
        self.task_mem_rows = executor_mem_mb * 8          # rows one task can hold before it spills (1 GB: 8,192)
        self.row_bytes, self.secs_per_row = row_bytes, secs_per_row

    def run_join(self, big, small, key, shuffle_partitions=200, broadcast=False, aqe=False, log_path=None):
        """Join big to small on key (inner). Returns {"rows", "failed", "max_task_s", "total_s", "log"}: the joined
        row count and the path of a Spark event log with one SparkListenerTaskEnd line per task."""
        n = shuffle_partitions
        index = {}
        for r in small:
            index.setdefault(r.get(key), []).append(r)
        out = sum(len(index.get(r.get(key), ())) for r in big if r.get(key) is not None)
        events, clock = [], [0]

        def task(stage, tid, rows, shuffle, held=None):
            held = rows if held is None else held   # rows the task must hold in memory (a scan or broadcast join streams; it holds only the small side)
            spill = max(0.0, held - self.task_mem_rows)
            secs = 0.2 + rows * self.secs_per_row * (1 + 2 * spill / max(held, 1))
            failed = held > 4 * self.task_mem_rows
            launch = clock[0]; clock[0] += 1
            events.append({'Event': 'SparkListenerTaskEnd', 'Stage ID': stage, 'Task Info': {'Task ID': tid, 'Launch Time': launch * 1000, 'Finish Time': int(launch * 1000 + secs * 1000), 'Failed': failed},
                           'Task End Reason': {'Reason': 'ExceptionFailure', 'Description': 'java.lang.OutOfMemoryError: Java heap space'} if failed else {'Reason': 'Success'},
                           'Task Metrics': {'Shuffle Read Metrics': {'Remote Bytes Read': int(rows * self.row_bytes * 0.75) if shuffle else 0, 'Local Bytes Read': int(rows * self.row_bytes * 0.25) if shuffle else 0},
                                            'Disk Bytes Spilled': int(spill * self.row_bytes)}})
            return secs, failed

        per_scan = 5000
        for stage, side in ((0, big), (1, small)):
            for i in range(max(1, -(-len(side) // per_scan))):
                task(stage, len(events), min(per_scan, len(side) - i * per_scan), False, held=0)
        results = []
        if broadcast:
            for i in range(max(1, -(-len(big) // per_scan))):
                results.append(task(2, len(events), min(per_scan, len(big) - i * per_scan), False, held=len(small)))
        else:
            sizes = [0] * n
            for r in big:
                sizes[hash_partition(r.get(key), n)] += 1
            for r in small:
                sizes[hash_partition(r.get(key), n)] += 1
            if aqe:   # adaptive skew join: a partition over 5x the median (and big enough) is split into median-sized pieces
                med = sorted(sizes)[n // 2] or 1
                split = []
                for s in sizes:
                    split += [med] * (s // med) + ([s % med] if s % med else []) if s > 5 * med and s > 1000 else [s]
                sizes = split
            for s in sizes:
                results.append(task(2, len(events), s, True))
        path = log_path or tempfile.mkstemp(suffix='.json')[1]
        with open(path, 'w') as f:
            f.write('\n'.join(json.dumps(e) for e in events))
        failed = any(f for _, f in results)
        return {'rows': None if failed else out, 'failed': failed, 'max_task_s': round(max(s for s, _ in results), 1), 'total_s': round(sum(s for s, _ in results), 1), 'log': path}


def trips_for_join(n=50000, hot_share=0.0, null_share=0.0, seed=11):
    """Trips and zones for the module 3 labs. hot_share of trips go to zone 1 (one city with most of the rows),
    null_share have no zone_id."""
    import random
    r = random.Random(seed)
    zones = [{'zone_id': z, 'zone_name': 'zone-%d' % z} for z in range(1, 201)]
    trips = []
    for i in range(n):
        x = r.random()
        z = None if x < null_share else 1 if x < null_share + hot_share else r.randint(2, 200)
        trips.append({'trip_id': i, 'zone_id': z})
    return trips, zones


# ---------------- Delta-style table ----------------
class ConcurrentModification(Exception):
    """Another writer created this commit number first: re-read the log and retry on top."""


class DeltaTable:
    """A Delta-style table on the ObjectStore. Data files are JSON lines (Parquet in the real thing); the truth is the
    log: <location>/_delta_log/00000000000000000000.json, ...0001.json, each a list of actions such as
    {"add": {"path": ..., "rows": n}} and {"remove": {"path": ...}}. The table at version v is the replay of commits
    0..v. Removed files stay on storage until vacuum, which is why old versions (and deleted rows) are still readable."""
    def __init__(self, store, location):
        self.store, self.location, self._n = store, location.rstrip('/'), 0
        self.log = self.location + '/_delta_log/'

    def _commit_path(self, v):
        return self.log + '%020d.json' % v

    def version(self):
        """The latest commit number, or -1 for a table with no commits."""
        ks = [k for k in self.store.list(self.log) if k.endswith('.json')]
        return int(ks[-1][len(self.log):-5]) if ks else -1

    def _actions(self, v):
        return json.loads(self.store.get(self._commit_path(v)).decode())

    def files(self, version=None):
        """Live data files at a version: replay add and remove actions from commit 0."""
        v = self.version() if version is None else version
        live = {}
        for i in range(v + 1):
            for a in self._actions(i):
                if 'add' in a:
                    live[a['add']['path']] = a['add']
                elif 'remove' in a:
                    live.pop(a['remove']['path'], None)
        return sorted(live)

    def read(self, version=None):
        """Rows at a version (VERSION AS OF). Raises FileNotFoundError when vacuum removed a file it needs."""
        out = []
        for f in self.files(version):
            if f not in self.store.objects:
                raise FileNotFoundError(f + ' was vacuumed: this version can no longer be read')
            out += [json.loads(l) for l in self.store.get(f).decode().splitlines() if l]
        return out

    def history(self):
        """DESCRIBE HISTORY: one row per commit."""
        rows = []
        for i in range(self.version() + 1):
            acts = self._actions(i)
            op = next((a['commitInfo']['operation'] for a in acts if 'commitInfo' in a), 'WRITE')
            rows.append({'version': i, 'operation': op, 'added': sum('add' in a for a in acts), 'removed': sum('remove' in a for a in acts)})
        return rows

    def _write(self, rows):
        self._n += 1
        path = '%s/part-%05d-%d.jsonl' % (self.location, self._n, zlib.crc32(self.location.encode()) % 997)
        self.store.put(path, '\n'.join(json.dumps(r, sort_keys=True) for r in rows))
        return {'add': {'path': path, 'rows': len(rows)}}

    def commit(self, add_rows=(), remove=(), operation='WRITE', read_version=None):
        """Write add_rows as one new file and remove the given file paths, as the next numbered commit. If
        read_version is given and someone committed after it, ConcurrentModification is raised."""
        v = self.version() + 1
        if read_version is not None and read_version != v - 1:
            raise ConcurrentModification('version %d was written after you read version %d' % (v - 1, read_version))
        acts = [{'commitInfo': {'operation': operation}}] + [{'remove': {'path': p}} for p in remove]
        if add_rows:
            acts.append(self._write(list(add_rows)))
        if self._commit_path(v) in self.store.objects:   # put-if-absent: only one writer gets this number
            raise ConcurrentModification('commit %d already exists' % v)
        self.store.put(self._commit_path(v), json.dumps(acts))
        return v

    def append(self, rows):
        return self.commit(add_rows=rows, operation='WRITE')

    def delete(self, where):
        """DELETE FROM ... WHERE: every file with a matching row is rewritten without it (copy-on-write)."""
        hit, keep = [], []
        for f in self.files():
            rows = [json.loads(l) for l in self.store.get(f).decode().splitlines() if l]
            if any(where(r) for r in rows):
                hit.append(f); keep += [r for r in rows if not where(r)]
        if not hit:
            return 0
        n = sum(1 for f in hit for l in self.store.get(f).decode().splitlines() if l and where(json.loads(l)))
        self.commit(add_rows=keep, remove=hit, operation='DELETE')
        return n

    def optimize(self):
        """OPTIMIZE: rewrite all live files as one."""
        fs = self.files()
        if len(fs) > 1:
            self.commit(add_rows=self.read(), remove=fs, operation='OPTIMIZE')
        return len(fs)

    def vacuum(self, keep_versions=None):
        """VACUUM: physically delete data files no kept version uses. keep_versions=None keeps every version
        (Delta's 7-day default, in effect); keep_versions=1 keeps only the latest (a short retention)."""
        last = self.version()
        first = 0 if keep_versions is None else max(0, last - keep_versions + 1)
        needed = set()
        for v in range(first, last + 1):
            needed |= set(self.files(v))
        gone = [k for k in self.store.list(self.location + '/') if not k.startswith(self.log) and k not in needed]
        for k in gone:
            self.store.delete(k)
        return len(gone)

    def clone(self, location):
        """A zero-copy clone (Snowflake CLONE, Delta shallow clone): a new log whose first commit adds the same files."""
        c = DeltaTable(self.store, location)
        c.store.put(c._commit_path(0), json.dumps([{'commitInfo': {'operation': 'CLONE'}}] + [{'add': {'path': f, 'rows': None}} for f in self.files()]))
        return c


# ---------------- Airflow-style DAG ----------------
class Dag:
    """dag = Dag('trips_hourly'); dag.task('ingest', fn); dag.task('check', fn2, after=['ingest']); dag.run(start, end)
    Each task gets a context dict: data_interval_start, data_interval_end, ds, results (outputs of earlier tasks)."""
    def __init__(self, dag_id, retries=0):
        self.dag_id, self.retries, self.tasks, self.order, self.runs = dag_id, retries, {}, [], []

    def task(self, task_id, fn, after=None):
        self.tasks[task_id] = {'fn': fn, 'after': list(after or [])}
        self.order.append(task_id)
        return self

    def _topo(self):
        done, out = set(), []
        while len(out) < len(self.order):
            ready = [t for t in self.order if t not in done and all(a in done for a in self.tasks[t]['after'])]
            if not ready:
                raise ValueError('the DAG has a cycle or an unknown dependency')
            for t in ready:
                done.add(t); out.append(t)
        return out

    def run(self, start, end):
        """One DAG run for [start, end). A task that raises is retried; its downstream tasks are skipped."""
        ctx = {'data_interval_start': start, 'data_interval_end': end, 'ds': str(start)[:10], 'results': {}}
        state = {}
        for t in self._topo():
            if any(state.get(a) != 'success' for a in self.tasks[t]['after']):
                state[t] = 'upstream_failed'; continue
            for attempt in range(self.retries + 1):
                try:
                    ctx['results'][t] = self.tasks[t]['fn'](ctx); state[t] = 'success'; break
                except Exception as e:
                    state[t] = 'failed'; ctx['results'][t] = 'error: ' + str(e)
        run = {'interval': (str(start), str(end)), 'state': state, 'results': ctx['results'],
               'ok': all(s == 'success' for s in state.values())}
        self.runs.append(run)
        return run

    def backfill(self, start, end, step_hours=1):
        """One run per interval between start and end, oldest first, like airflow dags backfill."""
        out, t = [], start
        while t < end:
            out.append(self.run(t, t + _dt.timedelta(hours=step_hours)))
            t += _dt.timedelta(hours=step_hours)
        return out


def trip_events(n=200, seed=7, hour='2026-10-11T09'):
    """The lab's event generator: completed and other trip events in one hour; about 1% sent twice; a few late."""
    import random
    r = random.Random(seed); out = []
    cities = ['Bengaluru', 'Pune', 'Mumbai', 'Delhi']
    for i in range(n):
        ts = _dt.datetime.fromisoformat(hour + ':00:00') + _dt.timedelta(seconds=r.randint(0, 3599))
        if i % 37 == 5:
            ts -= _dt.timedelta(hours=1)  # late: belongs to the previous hour
        e = {'event_id': 'e%04d' % i, 'event_type': r.choice(['completed', 'completed', 'cancelled', 'requested']), 'trip_id': 't-%05d' % r.randint(1, 120),
             'city': r.choice(cities), 'fare_amount': round(r.uniform(80, 900), 2), 'event_ts': ts.isoformat() + 'Z'}
        out.append(e)
        if i % 97 == 3:
            out.append(dict(e))  # duplicate delivery
    return out


# ---------------- Cloud: an Athena-style scanner and an IAM policy check (module 7) ----------------
ATHENA_USD_PER_TB = 5.0          # Athena SQL pricing per TB scanned
ATHENA_MIN_BYTES = 10 * 1024 ** 2  # every query is billed for at least 10 MB


def write_columns(store, path, rows):
    """A columnar file (Parquet stands in): one JSON list per column, so a reader can fetch only the columns it needs."""
    cols = sorted({c for r in rows for c in r})
    store.put(path, json.dumps({c: [r.get(c) for r in rows] for c in cols}, sort_keys=True))
    return len(rows)


class Athena:
    """Scans files under a table location and counts the bytes it reads, the way Athena bills.
    - JSON lines files (.json, .jsonl) are read whole: every byte of every row.
    - Columnar files (.col, written by write_columns) are read one column at a time: only the columns a query uses.
    - A path segment dt=YYYY-MM-DD is a partition: a query with day= skips files of other days without reading them."""
    def __init__(self, store):
        self.store, self.bytes_scanned = store, 0

    def query(self, location, columns, day=None):
        """Rows (dicts with only `columns`) from every file under location, optionally for one day."""
        out = []
        for k in self.store.list(location.rstrip('/') + '/'):
            m = re.search(r'/dt=(\d{4}-\d{2}-\d{2})/', k)
            if day is not None and m and m.group(1) != day:
                continue  # partition pruning: never opened
            body = self.store.get(k)
            need = list(columns) + (['event_ts'] if day is not None and not m and 'event_ts' not in columns else [])
            if k.endswith('.col'):
                data = json.loads(body)
                n = len(next(iter(data.values()))) if data else 0
                for c in need:
                    self.bytes_scanned += len(json.dumps(data.get(c, [None] * n)))
                rows = [{c: data.get(c, [None] * n)[i] for c in need} for i in range(n)]
            else:
                self.bytes_scanned += len(body)
                rows = [{c: r.get(c) for c in need} for r in (json.loads(l) for l in body.decode().splitlines() if l.strip())]
            if day is not None and not m:  # no partition in the path: every row was read, now filter by event time
                rows = [r for r in rows if str(r.get('event_ts', '')).startswith(day)]
                rows = [{c: r[c] for c in columns} for r in rows]
            out.extend(rows)
        return out


def athena_cost(bytes_scanned):
    """Dollars for one query, with the 10 MB minimum."""
    return max(bytes_scanned, ATHENA_MIN_BYTES) / 1024 ** 4 * ATHENA_USD_PER_TB


def iam_allows(policy, action, resource):
    """Evaluate an IAM-style policy: {"Statement": [{"Effect": "Allow"|"Deny", "Action": str|list, "Resource": str|list}]}.
    Wildcards * and ? work as in IAM. An explicit Deny wins; otherwise any matching Allow allows; otherwise denied."""
    import fnmatch
    def match(pats, value):
        pats = [pats] if isinstance(pats, str) else list(pats)
        return any(fnmatch.fnmatchcase(value, p) for p in pats)
    hit = False
    for st in policy.get('Statement', []):
        if match(st.get('Action', []), action) and match(st.get('Resource', []), resource):
            if st.get('Effect') == 'Deny':
                return False
            if st.get('Effect') == 'Allow':
                hit = True
    return hit
