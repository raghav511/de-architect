"""minilake: small, real versions of Kafka, S3 and Airflow that run inside the browser (Pyodide), so the system labs
need no Docker. They keep the behaviour interviews ask about and leave out the operations:

  Broker      topics split into partitions; a key always lands in the same partition; offsets; consumer groups
              that share partitions and commit offsets; lag.
  ObjectStore buckets and keys like S3; list by prefix; Parquet written and read through DuckDB.
  Dag         tasks with dependencies, run once per data interval with retries; backfill over a range.
"""
import datetime as _dt, io, json, os, tempfile, zlib


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
