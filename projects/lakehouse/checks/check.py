"""Project checks: run after each milestone. Prints PASS/FAIL per check and a short code to paste into the app."""
import os, sys, hashlib
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'jobs'))
from common import trino
cur = trino().cursor()
def q(sql):
    cur.execute(sql); return cur.fetchall()
def scalar(sql):
    return q(sql)[0][0]
results = []
def check(milestone, name, fn):
    try:
        ok, note = fn()
    except Exception as e:
        ok, note = False, str(e).split('\n')[0][:140]
    results.append((milestone, name, ok, note))
    print(('PASS' if ok else 'FAIL').ljust(5), f'M{milestone}', name, '-', note)

def exists(schema, table):
    return bool(q(f"SELECT 1 FROM lake.information_schema.tables WHERE table_schema = '{schema}' AND table_name = '{table}'"))

# M1 environment
check(1, 'Catalog and engines are up', lambda: (scalar('SELECT 1') == 1, 'Trino answers and sees the lake catalog'))
# M2 bronze zero-copy
def zero_copy():
    if not exists('bronze', 'trips'): return False, 'lake.bronze.trips does not exist yet: run make bronze'
    paths = [r[0] for r in q('SELECT file_path FROM lake.bronze."trips$files"')]
    inplace = all(p.startswith('s3://landing/') for p in paths)
    return inplace and len(paths) > 0, f'{len(paths)} data files, all still in s3://landing (no copy)' if inplace else 'some files were copied into the warehouse'
check(2, 'Bronze trips registered in place (zero copy)', zero_copy)
def protected():
    try:
        cur.execute('DELETE FROM lake.bronze.trips WHERE false'); cur.fetchall()
        return False, 'Bronze is writable from Trino: a DROP would delete the landing files'
    except Exception as e:
        return 'Access Denied' in str(e), 'Trino cannot DROP or DELETE Bronze'
check(2, 'Bronze is read-only for engines', protected)
check(2, 'Bronze events ingested', lambda: (exists('bronze', 'trip_events') and scalar('SELECT count(*) FROM lake.bronze.trip_events') > 0, 'events copied into Iceberg'))
# M3 silver
def silver_unique():
    n, u = q('SELECT count(*), count(DISTINCT trip_id) FROM lake.silver.trips')[0]
    return n == u and n > 0, f'{n} rows, {u} unique trip_ids'
check(3, 'Silver has one row per trip', silver_unique)
check(3, 'Bad rows are quarantined, not in Silver', lambda: (scalar('SELECT count(*) FROM lake.silver.trips WHERE fare_inr < 0') == 0 and scalar('SELECT count(*) FROM lake.silver.trip_rejects') > 0, 'rejects table holds negative fares and bad distances'))
def silver_covers():
    b = scalar("SELECT count(DISTINCT trip_id) FROM lake.bronze.trips WHERE fare_inr >= 0 AND distance_km BETWEEN 0 AND 200")
    s = scalar('SELECT count(*) FROM lake.silver.trips')
    return b == s, f'bronze valid unique {b} = silver {s}'
check(3, 'Silver matches Bronze (nothing lost, nothing doubled)', silver_covers)
# M4 gold
check(4, 'Gold models built by dbt', lambda: (all(exists('gold', t) for t in ['daily_city_metrics', 'driver_features', 'city_context']), 'daily_city_metrics, driver_features, city_context'))
def reconcile():
    a = scalar("SELECT round(sum(fare_inr), 2) FROM lake.silver.trips WHERE status = 'completed'")
    b = scalar('SELECT round(sum(revenue_inr), 2) FROM lake.gold.daily_city_metrics')
    return abs((a or 0) - (b or 0)) < 0.05, f'silver {a} vs gold {b}'
check(4, 'Gold revenue reconciles to Silver', reconcile)
# M5 orchestration + time travel
def second_day():
    n = scalar('SELECT count(*) FROM lake.bronze."trips$snapshots"')
    return n >= 2 and silver_unique()[0], f'{n} Bronze snapshots (one per landing run); Silver still has one row per trip'
check(5, 'Pipeline ran again for a new day, no duplicates', second_day)
print('Tip: time travel works on every table, e.g. SELECT count(*) FROM lake.silver.trips FOR VERSION AS OF <snapshot_id from lake.silver."trips$snapshots">')

passed = [r for r in results if r[2]]
done = sorted({m for m in range(1, 6) if all(r[2] for r in results if r[0] == m)})
code = hashlib.sha1(('lakehouse' + ','.join(map(str, done))).encode()).hexdigest()[:6].upper()
print(f'\n{len(passed)}/{len(results)} checks pass · milestones complete: {done or "none"} · code {code}-{"".join(map(str, done))}')
