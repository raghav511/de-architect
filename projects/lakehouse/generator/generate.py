"""Write raw ride-hailing data to the landing bucket, the way an upstream team or vendor would.
Parquet trips partitioned by dt (Hive style), plus JSON trip events. Includes realistic dirt:
duplicates, late events, NULL drivers, bad fares. Usage: python generate.py --days 7 --start 2026-10-01
"""
import argparse, json, os, random, tempfile, datetime as dt
import pyarrow as pa, pyarrow.parquet as pq, pyarrow.fs as pafs

ap = argparse.ArgumentParser()
ap.add_argument('--days', type=int, default=7)
ap.add_argument('--start', default='2026-10-01')
ap.add_argument('--trips-per-day', type=int, default=4000)
ap.add_argument('--seed', type=int, default=7)
ap.add_argument('--endpoint', default=os.environ.get('S3_ENDPOINT', 'http://s3:8333'))
a = ap.parse_args()
r = random.Random(a.seed)
start = dt.date.fromisoformat(a.start)
CITIES = ['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune']
out = tempfile.mkdtemp()
tid = 1
for d in range(a.days):
    day = start + dt.timedelta(days=d)
    rows, events = [], []
    tid = 1
    for _ in range(a.trips_per_day):
        status = r.choices(['completed', 'cancelled', 'no_driver'], [80, 14, 6])[0]
        km = round(r.uniform(1, 30), 2)
        ts = dt.datetime.combine(day, dt.time(r.randint(0, 23), r.randint(0, 59), r.randint(0, 59)))
        row = {'trip_id': f't-{day:%Y%m%d}-{tid:06d}', 'rider_id': f'r-{r.randint(1, 3000):05d}', 'driver_id': None if status == 'no_driver' else f'd-{r.randint(1, 600):04d}',
               'city': r.choice(CITIES), 'status': status, 'distance_km': km, 'fare_inr': round(40 + km * r.uniform(10, 18), 2) if status == 'completed' else 0.0,
               'pickup_ts': ts, 'ingested_at': dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)}
        if r.random() < 0.003:
            row['fare_inr'] = -1.0          # bad value for data-quality checks
        rows.append(row)
        if r.random() < 0.01:
            rows.append(dict(row))          # duplicate from a retried export
        for k, et in enumerate(['requested', 'driver_assigned', status]):
            if et == 'driver_assigned' and row['driver_id'] is None:
                continue
            events.append({'trip_id': row['trip_id'], 'event_type': et, 'event_ts': (ts + dt.timedelta(minutes=k * r.randint(2, 12))).isoformat(), 'city': row['city']})
        tid += 1
    path = os.path.join(out, 'trips', f'dt={day.isoformat()}')
    os.makedirs(path, exist_ok=True)
    t = pa.Table.from_pylist(rows, schema=pa.schema([('trip_id', pa.string()), ('rider_id', pa.string()), ('driver_id', pa.string()), ('city', pa.string()), ('status', pa.string()),
                                                     ('distance_km', pa.float64()), ('fare_inr', pa.float64()), ('pickup_ts', pa.timestamp('us')), ('ingested_at', pa.timestamp('us'))]))
    pq.write_table(t, os.path.join(path, 'part-0000.parquet'))
    ep = os.path.join(out, 'events', f'dt={day.isoformat()}')
    os.makedirs(ep, exist_ok=True)
    with open(os.path.join(ep, 'events.jsonl'), 'w') as f:
        for e in events:
            f.write(json.dumps(e) + '\n')
    print(day, len(rows), 'trips', len(events), 'events')
s3 = pafs.S3FileSystem(endpoint_override=a.endpoint, access_key=os.environ.get('AWS_ACCESS_KEY_ID', 'admin'), secret_key=os.environ.get('AWS_SECRET_ACCESS_KEY', 'password'),
                      region='us-east-1', scheme='https' if a.endpoint.startswith('https') else 'http')
for root, _, files in os.walk(out):
    for name in files:
        src = os.path.join(root, name)
        key = 'landing/' + os.path.relpath(src, out).replace(os.sep, '/')
        with open(src, 'rb') as f, s3.open_output_stream(key) as o:
            o.write(f.read())
print('Uploaded to s3://landing/trips/ and s3://landing/events/')
