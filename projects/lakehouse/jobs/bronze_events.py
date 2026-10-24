"""BRONZE (copy ingestion): raw JSON events -> Iceberg table bronze.trip_events.
Unlike trips (Parquet, registered in place), JSON is not an Iceberg data format, so these rows ARE copied
and rewritten as Parquet. Each landing day is replaced atomically, so reruns never duplicate (idempotent).
"""
import os, sys, json, datetime as dt
sys.path.insert(0, os.path.dirname(__file__))
from common import s3, catalog
import pyarrow as pa, pyarrow.fs as pafs
from pyiceberg.schema import Schema
from pyiceberg.types import NestedField, StringType, TimestampType, DateType
from pyiceberg.partitioning import PartitionSpec, PartitionField
from pyiceberg.transforms import IdentityTransform
from pyiceberg.expressions import EqualTo

cat, fs = catalog(), s3()
cat.create_namespace_if_not_exists('bronze')
schema = Schema(NestedField(1, 'trip_id', StringType()), NestedField(2, 'event_type', StringType()), NestedField(3, 'event_ts', TimestampType()),
                NestedField(4, 'city', StringType()), NestedField(5, 'dt', DateType()), NestedField(6, 'source_file', StringType()))
tbl = cat.create_table_if_not_exists('bronze.trip_events', schema=schema, partition_spec=PartitionSpec(PartitionField(5, 1000, IdentityTransform(), 'dt')),
                                     properties={'format-version': '2', 'comment': 'Bronze: raw trip events copied from s3://landing/events (JSON)'})
arrow_schema = pa.schema([('trip_id', pa.string()), ('event_type', pa.string()), ('event_ts', pa.timestamp('us')), ('city', pa.string()), ('dt', pa.date32()), ('source_file', pa.string())])
for info in sorted(fs.get_file_info(pafs.FileSelector('landing/events', recursive=True)), key=lambda i: i.path):
    if not info.path.endswith('.jsonl'):
        continue
    day = dt.date.fromisoformat(info.path.split('dt=')[1].split('/')[0])
    with fs.open_input_stream(info.path) as f:
        rows = [json.loads(l) for l in f.read().decode().splitlines() if l.strip()]
    for r in rows:
        r['event_ts'] = dt.datetime.fromisoformat(r['event_ts'])
        r['dt'] = day
        r['source_file'] = 's3://' + info.path
    tbl.overwrite(pa.Table.from_pylist(rows, schema=arrow_schema), overwrite_filter=EqualTo('dt', day.isoformat()))
    print(day, len(rows), 'events')
