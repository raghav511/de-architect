"""SILVER, Spark version: same rules as jobs/silver.sql, written with the DataFrame API + MERGE INTO.
Compare plans and run times with the Trino version (Spark UI: http://localhost:4040 while it runs).
Writes lake.silver_spark.trips so it never collides with the Trino-built table."""
from pyspark.sql import SparkSession, functions as F, Window
spark = SparkSession.builder.appName('silver_spark').getOrCreate()
spark.sql('CREATE NAMESPACE IF NOT EXISTS lake.silver_spark')
spark.sql('''CREATE TABLE IF NOT EXISTS lake.silver_spark.trips (
  trip_id STRING, rider_id STRING, driver_id STRING, city STRING, status STRING, distance_km DOUBLE, fare_inr DOUBLE,
  pickup_ts TIMESTAMP_NTZ, trip_date DATE, ingested_at TIMESTAMP_NTZ) USING iceberg PARTITIONED BY (days(pickup_ts))''')
w = Window.partitionBy('trip_id').orderBy(F.col('ingested_at').desc())
src = (spark.table('lake.bronze.trips')
       .where(F.col('trip_id').isNotNull() & (F.col('fare_inr') >= 0) & F.col('distance_km').between(0, 200))
       .withColumn('rn', F.row_number().over(w)).where('rn = 1').drop('rn')
       .withColumn('trip_date', F.to_date('pickup_ts')))
src.createOrReplaceTempView('src')
spark.sql('''MERGE INTO lake.silver_spark.trips t USING src s ON t.trip_id = s.trip_id
WHEN MATCHED AND s.ingested_at > t.ingested_at THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *''')
print('silver_spark.trips rows:', spark.table('lake.silver_spark.trips').count())
