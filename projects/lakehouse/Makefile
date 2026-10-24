# One-word commands for the lakehouse project. Run from projects/lakehouse.
DC = docker compose
SPARK = $(DC) exec -T spark
.PHONY: up up-all down reset land bronze silver silver-spark gold check pipeline airflow clickhouse trino-shell logs ps
up:            ## core stack: object store, Iceberg catalog, Spark (Jupyter :8888), Trino (:8080)
	$(DC) up -d
up-all:        ## core + Airflow (:8081, admin/admin) + ClickHouse (:8123)
	$(DC) --profile airflow --profile clickhouse up -d --build
down:
	$(DC) --profile airflow --profile clickhouse down
reset:         ## delete ALL data and start fresh
	$(DC) --profile airflow --profile clickhouse down -v
land:          ## write 7 days of raw files to s3://landing
	$(SPARK) python3 /home/iceberg/generator/generate.py --days 7
bronze:        ## zero-copy register trips + copy events into Iceberg
	$(SPARK) python3 /home/iceberg/jobs/bronze_zero_copy.py
	$(SPARK) python3 /home/iceberg/jobs/bronze_events.py
silver:        ## clean + dedupe with Trino MERGE
	$(DC) exec -T trino trino --file /dev/stdin < jobs/silver.sql
silver-spark:  ## the same Silver logic in PySpark (writes lake.silver_spark)
	$(SPARK) spark-submit /home/iceberg/jobs/silver_spark.py
gold:          ## dbt models + tests on Trino (needs the Airflow image: make up-all)
	$(DC) exec -T -e DBT_PROFILES_DIR=/opt/lakehouse/dbt -w /opt/lakehouse/dbt airflow /home/airflow/dbt/bin/dbt build --target-path /tmp/dbt-target --log-path /tmp/dbt-logs
check:         ## run the project checks and print your completion code
	$(DC) run --rm --no-deps -e TRINO_HOST=trino --entrypoint /home/airflow/jobs/bin/python airflow /opt/lakehouse/checks/check.py
pipeline:      ## run the whole Airflow DAG once for a date: make pipeline DAY=2026-10-08
	$(DC) exec -T airflow airflow dags test lakehouse_daily $(or $(DAY),2026-10-08)
trino-shell:
	$(DC) exec trino trino --catalog lake
clickhouse:    ## query Gold straight from S3 with ClickHouse (zero copy)
	@LOC=$$($(DC) exec -T trino trino --output-format TSV --execute "SHOW CREATE TABLE lake.gold.daily_city_metrics" 2>/dev/null | grep -o "s3://[^']*" | head -1 | sed 's#s3://#http://s3:8333/#'); \
	echo "Iceberg table at $$LOC"; \
	$(DC) exec -T clickhouse clickhouse-client --user admin --password password -q "SELECT city, round(sum(revenue_inr)) AS revenue FROM icebergS3('$$LOC', 'admin', 'password') GROUP BY city ORDER BY revenue DESC"
ps:
	$(DC) --profile airflow --profile clickhouse ps
logs:
	$(DC) logs -f --tail 50
