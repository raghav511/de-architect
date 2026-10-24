"""BRONZE: register raw Parquet files already in the landing bucket as an Iceberg table, with NO data copy.

PyIceberg's add_files reads each file's footer (schema + column statistics), writes Iceberg metadata
(manifests + a new snapshot) that points at the existing objects, and never rewrites the bytes.
Partition values come from the column statistics: bronze is partitioned by day(pickup_ts), and each
landing file holds exactly one day, so every file maps to one partition.

Run it again after new files land: only files the table does not know yet are added (idempotent).
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import s3, catalog
from pyiceberg.schema import Schema
from pyiceberg.types import NestedField, StringType, DoubleType, TimestampType
from pyiceberg.partitioning import PartitionSpec, PartitionField
from pyiceberg.transforms import DayTransform
import pyarrow.fs as pafs

cat = catalog()
cat.create_namespace_if_not_exists('bronze')
schema = Schema(
    NestedField(1, 'trip_id', StringType()), NestedField(2, 'rider_id', StringType()), NestedField(3, 'driver_id', StringType()),
    NestedField(4, 'city', StringType()), NestedField(5, 'status', StringType()), NestedField(6, 'distance_km', DoubleType()),
    NestedField(7, 'fare_inr', DoubleType()), NestedField(8, 'pickup_ts', TimestampType()), NestedField(9, 'ingested_at', TimestampType()))
spec = PartitionSpec(PartitionField(source_id=8, field_id=1000, transform=DayTransform(), name='pickup_day'))
ident = 'bronze.trips'
tbl = cat.create_table_if_not_exists(ident, schema=schema, partition_spec=spec, properties={'format-version': '2', 'gc.enabled': 'false', 'comment': 'Bronze: raw trips registered in place from s3://landing/trips (zero copy)'})

fs = s3()
found = [f'{"s3://"}{i.path}' for i in fs.get_file_info(pafs.FileSelector('landing/trips', recursive=True)) if i.path.endswith('.parquet')]
known = set(tbl.inspect.files().column('file_path').to_pylist()) if tbl.current_snapshot() else set()
new = sorted(p for p in found if p not in known)
print(f'landing files: {len(found)} · already in bronze: {len(known)} · new: {len(new)}')
if new:
    tbl.add_files(file_paths=new)
    tbl = cat.load_table(ident)
s = tbl.current_snapshot()
print('snapshot', s.snapshot_id if s else None, (s.summary.additional_properties if s else {}))
print('bytes copied: 0 (metadata only). Data files referenced:')
for p in tbl.inspect.files().column('file_path').to_pylist():
    print('  ', p)
