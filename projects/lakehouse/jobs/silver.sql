-- SILVER: cleaned, deduplicated, typed trips. Idempotent: MERGE on trip_id, so reruns never duplicate.
-- Rules: keep the latest copy of each trip (retried exports create duplicates), reject impossible values.
CREATE SCHEMA IF NOT EXISTS lake.silver;

CREATE TABLE IF NOT EXISTS lake.silver.trips (
  trip_id varchar, rider_id varchar, driver_id varchar, city varchar, status varchar,
  distance_km double, fare_inr double, pickup_ts timestamp(6), trip_date date, ingested_at timestamp(6)
) WITH (partitioning = ARRAY['day(pickup_ts)'], format_version = 2);

CREATE TABLE IF NOT EXISTS lake.silver.trip_rejects (
  trip_id varchar, reason varchar, fare_inr double, distance_km double, pickup_ts timestamp(6), rejected_at timestamp(6)
) WITH (format_version = 2);

MERGE INTO lake.silver.trips t
USING (
  SELECT trip_id, rider_id, driver_id, city, status, distance_km, fare_inr, pickup_ts, CAST(pickup_ts AS date) AS trip_date, ingested_at
  FROM (
    SELECT *, row_number() OVER (PARTITION BY trip_id ORDER BY ingested_at DESC) AS rn
    FROM lake.bronze.trips
    WHERE trip_id IS NOT NULL AND fare_inr >= 0 AND distance_km BETWEEN 0 AND 200
  ) WHERE rn = 1
) s
ON t.trip_id = s.trip_id
WHEN MATCHED AND s.ingested_at > t.ingested_at THEN UPDATE SET
  rider_id = s.rider_id, driver_id = s.driver_id, city = s.city, status = s.status, distance_km = s.distance_km,
  fare_inr = s.fare_inr, pickup_ts = s.pickup_ts, trip_date = s.trip_date, ingested_at = s.ingested_at
WHEN NOT MATCHED THEN INSERT VALUES (s.trip_id, s.rider_id, s.driver_id, s.city, s.status, s.distance_km, s.fare_inr, s.pickup_ts, s.trip_date, s.ingested_at);

DELETE FROM lake.silver.trip_rejects;
INSERT INTO lake.silver.trip_rejects
SELECT DISTINCT trip_id, CASE WHEN trip_id IS NULL THEN 'missing trip_id' WHEN fare_inr < 0 THEN 'negative fare' ELSE 'distance out of range' END,
       fare_inr, distance_km, pickup_ts, current_timestamp(6)
FROM lake.bronze.trips
WHERE trip_id IS NULL OR fare_inr < 0 OR distance_km NOT BETWEEN 0 AND 200;

CREATE TABLE IF NOT EXISTS lake.silver.trip_events (
  trip_id varchar, event_type varchar, event_ts timestamp(6), city varchar, dt date
) WITH (partitioning = ARRAY['dt'], format_version = 2);

MERGE INTO lake.silver.trip_events t
USING (SELECT DISTINCT trip_id, event_type, event_ts, city, dt FROM lake.bronze.trip_events) s
ON t.trip_id = s.trip_id AND t.event_type = s.event_type AND t.event_ts = s.event_ts
WHEN NOT MATCHED THEN INSERT VALUES (s.trip_id, s.event_type, s.event_ts, s.city, s.dt);
