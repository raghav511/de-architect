# Project 1 · Medallion lakehouse for AI/ML on open source

**Weeks 1–2 project.** Build the lakehouse that later projects reuse: raw files land in an S3-compatible bucket, Bronze registers them as Apache Iceberg tables **without copying**, Silver cleans and deduplicates, Gold serves metrics, ML features and LLM-ready context. Airflow runs it daily; ClickHouse serves the same tables at OLAP speed.

Everything is open source and free: it runs in GitHub Codespaces (free monthly hours) or on your MacBook with Docker.

```
 upstream ──► s3://landing (Parquet + JSON)
                │  zero copy (add_files)         copy (JSON → Parquet)
                ▼                                  ▼
           bronze.trips  ◄─ Iceberg REST catalog ─► bronze.trip_events
                │  Trino MERGE (or Spark)
                ▼
           silver.trips · silver.trip_rejects · silver.trip_events
                │  dbt on Trino (+ tests)
                ▼
           gold.daily_city_metrics · gold.driver_features · gold.city_context
                │                       │
             Trino / BI        ClickHouse icebergS3() (zero copy)
 Airflow: land → bronze → silver → gold → checks   (daily, idempotent)
```

## The stack and what it stands in for

| Here (free, open source) | Role | In AWS | In Databricks |
|---|---|---|---|
| SeaweedFS S3 API (or MinIO / RustFS) | object store | S3 | cloud storage |
| Apache Iceberg + Iceberg REST catalog | table format + catalog | Glue Data Catalog / S3 Tables | Delta + Unity Catalog |
| Apache Spark 3.5 (+ Jupyter) | batch processing | EMR / Glue jobs | clusters / serverless |
| Trino 476 | SQL engine | Athena | SQL warehouse |
| dbt-trino | transformations + tests | dbt on Athena/Redshift | dbt on Databricks |
| Apache Airflow 2.10 | orchestration | MWAA | Workflows |
| ClickHouse 25.3 | fast serving / OLAP | Redshift / ClickHouse Cloud | (Photon) |

**Why not MinIO?** MinIO stopped publishing free community Docker images, so the default here is SeaweedFS (Apache 2.0). It speaks the same S3 API, so nothing else changes. To use MinIO or RustFS instead, swap the `s3` service image and keep the endpoint `http://s3:8333` (or change it in the configs).

## Start

**Codespaces (iPad, iPhone, any laptop):** open the project from the app (Projects → Lakehouse → *Open the environment*), or go to
`https://codespaces.new/raghav511/de-architect?devcontainer_path=.devcontainer/lakehouse/devcontainer.json`.
Pick the **4-core** machine. First start takes about 10 minutes (images download); later starts take about 1 minute. Stop the codespace when you finish so your free hours last.

**MacBook:** install Docker Desktop (give it 8 GB+ memory), then:

```
cd projects/lakehouse
make up-all
```

Open: Jupyter http://localhost:8888 · Trino http://localhost:8080 · Airflow http://localhost:8081 (admin / admin).

## Milestones (run `make check` after each)

1. **Environment up.** `make up-all`, then `make ps`. Open Jupyter and Trino.
2. **Bronze, zero copy.** `make land` writes 7 days of raw files. `make bronze` registers the trips Parquet files as `lake.bronze.trips` with no data copy, and copies the JSON events into `lake.bronze.trip_events`. Read `jobs/bronze_zero_copy.py` line by line.
3. **Silver.** `make silver` runs `jobs/silver.sql`: dedupe with `row_number()`, quarantine bad rows, `MERGE` on `trip_id`. Run it twice; the second run changes 0 rows. Then `make silver-spark` and compare the Spark UI with the Trino query page.
4. **Gold with dbt.** `make gold` builds three Gold models and runs 7 tests. Open `dbt/models/gold/`.
5. **Orchestrate.** In Airflow, run `lakehouse_daily` (or `make pipeline DAY=2026-10-08`). It lands a new day and runs every layer; checks must still pass.

Stretch: open `notebooks/lakehouse/iceberg_internals.ipynb` in Jupyter (snapshots, manifests, time travel, schema and partition evolution, compaction), and `make clickhouse` to query Gold from ClickHouse straight off S3.

`make check` prints PASS/FAIL per check and a code like `F19D62-12345`. Type it into the app to mark the project done.

## Lesson: Apache Iceberg in 10 minutes

An Iceberg table is **files plus metadata**:

- **Catalog** (here the REST catalog) stores one pointer per table: the current `metadata.json`.
- **metadata.json** holds the schema, partition spec, properties and the list of **snapshots**.
- Each snapshot points to a **manifest list**, which points to **manifests**.
- Each manifest lists **data files** (Parquet) with per-column min/max, null counts and partition values.

A write never edits a file. It writes new data files and a new metadata version, then swaps the catalog pointer in one atomic step. That gives you ACID transactions on object storage, time travel (`FOR VERSION AS OF`), safe concurrent readers, schema evolution without rewrites, and partition evolution.

Engines prune at three levels: partition values in the manifest list, min/max stats per file in manifests, and row groups inside Parquet.

## Lesson: zero copy from an S3 data lake into Iceberg

You already have Parquet files in S3 (or MinIO). You want them to be an Iceberg table **without paying to rewrite terabytes**. Options:

| Method | What it does | Copies data? | Use when |
|---|---|---|---|
| `add_files` (PyIceberg `table.add_files`, Spark `CALL system.add_files`, Trino `ALTER TABLE … EXECUTE add_files` for unpartitioned tables) | Reads file footers and writes metadata that points at the existing files | **No** | Plain Parquet files in a folder (this project) |
| Spark `CALL system.snapshot('db.hive_tbl', 'db.ice_tbl')` | New Iceberg table over a Hive table's files; the Hive table stays | No | Try Iceberg next to a live Hive table |
| Spark `CALL system.migrate('db.hive_tbl')` | Replaces a Hive table with an Iceberg table over the same files | No | Cut over for good |
| `register_table` (Spark / Trino / PyIceberg) | Registers an existing Iceberg `metadata.json` in a catalog | No | Moving catalogs (Glue → REST, Hive → Polaris) |
| `CREATE TABLE … AS SELECT` / `INSERT` | Rewrites every row as new Iceberg files | **Yes** | You need a new layout, sort order or format (CSV/JSON sources) |

**Gotchas you learn in this project (and that interviewers ask about):**

- After `add_files`, **the table thinks it owns those files**. In this stack, a Trino `DROP TABLE` deleted the landing files. That is why Bronze has `gc.enabled=false` and Trino has an access rule that makes Bronze read-only (`conf/trino/rules.json`). Also never run `expire_snapshots` or `DROP … PURGE` on a zero-copy table you do not own.
- Partition values come from the files. PyIceberg reads them from column stats, so each file must hold one partition value (here, one day per file). Spark's `add_files` can read Hive-style `dt=…` folders instead.
- Schemas must match. Iceberg maps columns by name on import; types must be compatible.
- Upstream still owns the files. If they overwrite a file in place, the table's stats are wrong. Agree on a contract: append new files only.
- JSON and CSV are not Iceberg data formats, so they **must** be copied (see `bronze_events.py`).

## Lesson: AWS on your laptop

Every AWS service you would use has an open-source stand-in here: S3 → SeaweedFS/MinIO, Glue Catalog → Iceberg REST, Athena → Trino, EMR → Spark, MWAA → Airflow, Redshift → ClickHouse/Trino. The code talks to the S3 API with an endpoint override, so moving to real AWS means changing endpoint and credentials, not code. The week 7 project adds LocalStack for SQS/Lambda-style pieces and Terraform for IAM.

## Optional: the same Gold layer on Databricks Free Edition

Databricks has a **Free Edition** (serverless only, small quotas, no commercial use). Search for "Databricks Free Edition" to sign up, then:

1. Upload `gold.daily_city_metrics` as CSV (`make` it from Trino: `SELECT * FROM lake.gold.daily_city_metrics`) or recreate Silver from the generator.
2. Create a Delta table in Unity Catalog (`main.default.daily_city_metrics`), add a comment and tags, and open the lineage tab.
3. Compare: Iceberg REST catalog + Trino rules here vs Unity Catalog grants and lineage there. Write five lines on when you would pick each.

## Interview questions this project prepares you for

- Walk me through a medallion architecture you built. What exactly is Bronze for?
- How do you move an existing S3 data lake to Iceberg without rewriting it? What can go wrong?
- How do you make a daily pipeline idempotent? Show me the MERGE.
- Iceberg vs Delta vs Hudi: when would you choose each?
- How would you serve the same tables to BI, ML and an LLM assistant?
- How do Iceberg snapshots, manifests and min/max stats speed up a query?

## Files

```
docker-compose.yml        the stack (profiles: airflow, clickhouse)
conf/                     S3 identity, Spark catalog, Trino catalog + access rules
generator/generate.py     raw ride data with realistic dirt (duplicates, bad fares, NULL drivers)
jobs/bronze_zero_copy.py  zero-copy registration (PyIceberg add_files)
jobs/bronze_events.py     copy ingestion for JSON
jobs/silver.sql           Trino MERGE + quarantine
jobs/silver_spark.py      the same in PySpark
dbt/                      Gold models + tests
airflow/dags/             lakehouse_daily DAG
checks/check.py           milestone checks + completion code
notebooks/                Iceberg internals notebook
```
