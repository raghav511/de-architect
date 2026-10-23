# SQL bank: 12 weeks x 5. Runs on the sample ride-hailing tables (see py/runtime.py seed()).
# k: 'W' write or 'O' optimize. For O, 'start' is the slow query (it returns the right answer) and
# 'avoid'/'need' are [regex, message] rules about HOW the answer is written. 'rec' = recorded numbers on full data.
S = []
def q(**k): S.append(k)

# Week 1 joins, aggregation, NULLs
q(w=1, k='W', lv='Easy', t='Completed trips per city', p='Return city_name and the number of completed trips, most first. Include every city, even with 0.',
  sol="SELECT c.city_name, COUNT(t.trip_id) AS completed\nFROM cities c\nLEFT JOIN trips t ON t.city_id = c.city_id AND t.status = 'completed'\nGROUP BY c.city_name\nORDER BY completed DESC, c.city_name", ordered=True,
  h=['Every city must appear, so start from cities.', "LEFT JOIN, and put the status filter in ON (in WHERE it would drop cities with 0).", 'COUNT(t.trip_id) counts only matched trips; COUNT(*) would count 1 for empty cities.'], why='The most common first SQL question: outer join plus aggregation.')
q(w=1, k='W', lv='Easy', t='Riders who never completed a trip', p='Return the names of riders with no completed trip, ordered by name.',
  sol="SELECT r.name FROM riders r\nWHERE NOT EXISTS (SELECT 1 FROM trips t WHERE t.rider_id = r.rider_id AND t.status = 'completed')\nORDER BY r.name", ordered=True,
  h=['An anti-join: riders without a matching completed trip.', 'NOT EXISTS is NULL-safe. NOT IN breaks when the subquery has a NULL.', 'LEFT JOIN ... WHERE t.trip_id IS NULL also works if the status test is in ON.'], why='Tests NULL awareness: NOT IN vs NOT EXISTS.')
q(w=1, k='W', lv='Medium', t='Employees who earn more than their manager', p='From employees, return the employee name and their manager name where the employee earns more.',
  sol='SELECT e.name AS employee, m.name AS manager\nFROM employees e JOIN employees m ON e.manager_id = m.emp_id\nWHERE e.salary > m.salary',
  h=['Join the table to itself.', 'e.manager_id = m.emp_id links a person to their manager.', 'The top boss has no manager, so an inner join drops them.'], why='Self-joins come up in almost every loop.')
q(w=1, k='W', lv='Medium', t='Average fare by payment method', p='For completed trips, return payment method and the average fare rounded to 2 decimals, highest first.',
  sol='SELECT p.method, ROUND(AVG(t.fare), 2) AS avg_fare\nFROM payments p JOIN trips t ON t.trip_id = p.trip_id\nGROUP BY p.method ORDER BY avg_fare DESC', ordered=True,
  h=['Payments only exist for completed trips.', 'Join payments to trips on trip_id.', 'ROUND(AVG(...), 2).'], why='Join then aggregate, with the grain stated clearly.')
q(w=1, k='O', lv='Medium', t='Rider spend: remove the correlated subquery', p='This report runs one subquery per rider. Return rider_id and total completed spend for riders who spent over 1,000, without a subquery in SELECT.',
  start="SELECT r.rider_id,\n  (SELECT SUM(t.fare) FROM trips t WHERE t.rider_id = r.rider_id AND t.status = 'completed') AS spend\nFROM riders r\nWHERE (SELECT SUM(t.fare) FROM trips t WHERE t.rider_id = r.rider_id AND t.status = 'completed') > 1000",
  sol="SELECT rider_id, SUM(fare) AS spend FROM trips\nWHERE status = 'completed'\nGROUP BY rider_id HAVING SUM(fare) > 1000",
  avoid=[[r'\(\s*select', 'There is still a subquery. Aggregate once with GROUP BY instead.']], need=[[r'group\s+by', 'Use GROUP BY to compute every rider once.'], [r'having', 'Filter aggregated values with HAVING.']],
  rec=['42 s · 60 M subquery runs', '3.1 s · 1 scan + 1 aggregate'],
  h=['The same SUM runs twice per rider.', 'One GROUP BY over trips gives every rider at once.', 'Filters on aggregates go in HAVING.'],
  fups=[['Why is the correlated version slow?', 'It runs the inner query once per outer row (60 M riders = 60 M scans or index probes). GROUP BY reads trips once.'], ['Do modern engines rewrite it for you?', 'Often they decorrelate it, but not always, and not across every engine. Write the set-based version and confirm with EXPLAIN.']], why='Correlated subqueries are a classic "make this faster" prompt.')

# Week 2 window functions
q(w=2, k='W', lv='Medium', t='Top 3 drivers by earnings in each city', p='Return city_id, driver_id, total earnings and rank for the top 3 drivers per city. Keep ties.',
  sol="SELECT city_id, driver_id, total, rk FROM (\n  SELECT city_id, driver_id, SUM(fare) AS total,\n         DENSE_RANK() OVER (PARTITION BY city_id ORDER BY SUM(fare) DESC) AS rk\n  FROM trips WHERE status = 'completed' AND driver_id IS NOT NULL\n  GROUP BY city_id, driver_id) x\nWHERE rk <= 3",
  h=['Aggregate to one row per driver and city first.', 'DENSE_RANK() OVER (PARTITION BY city_id ORDER BY total DESC).', 'ROW_NUMBER would drop a tied driver.'], why='Top-N per group with ties is the most asked window question.')
q(w=2, k='W', lv='Medium', t='Running total of fares per day', p='Return trip_date, daily completed fare total and a running total over days, by date.',
  sol="SELECT trip_date, ROUND(SUM(fare), 2) AS day_total,\n  ROUND(SUM(SUM(fare)) OVER (ORDER BY trip_date), 2) AS running\nFROM trips WHERE status = 'completed'\nGROUP BY trip_date ORDER BY trip_date", ordered=True,
  h=['Daily totals first.', 'SUM(day_total) OVER (ORDER BY trip_date) is a running sum.', 'You can nest SUM(SUM(fare)) OVER ... in one query.'], why='Cumulative metrics are everywhere in dashboards.')
q(w=2, k='W', lv='Medium', t='Days between a rider\'s trips', p='For each completed trip, return rider_id, trip_id, trip_date and days since that rider\'s previous completed trip (NULL for the first).',
  sol="SELECT rider_id, trip_id, trip_date,\n  trip_date - LAG(trip_date) OVER (PARTITION BY rider_id ORDER BY pickup_ts, trip_id) AS days_since\nFROM trips WHERE status = 'completed'",
  h=['Look at the previous row for the same rider.', 'LAG(trip_date) OVER (PARTITION BY rider_id ORDER BY pickup_ts).', 'Date minus date gives days in DuckDB.'], why='LAG/LEAD power churn and frequency features.')
q(w=2, k='W', lv='Hard', t='Latest status per trip from events', p='trip_events has several events per trip and some duplicates. Return trip_id and the event_type of the latest event per trip.',
  sol='SELECT trip_id, event_type FROM (\n  SELECT trip_id, event_type, ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY event_ts DESC, event_id DESC) AS rn\n  FROM trip_events) x\nWHERE rn = 1',
  h=['One row per trip: the newest event.', 'ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY event_ts DESC).', 'Add a tie-breaker (event_id) so duplicates cannot both win.'], why='Dedupe to the latest record is how CDC tables become current-state tables.')
q(w=2, k='O', lv='Medium', t='Latest event: self-join to window', p='This finds each trip\'s latest event with a self-join on MAX. Return trip_id and event_type of the latest event using a window function instead.',
  start='SELECT e.trip_id, e.event_type\nFROM trip_events e\nJOIN (SELECT trip_id, MAX(event_id) AS mx FROM trip_events GROUP BY trip_id) m\n  ON e.trip_id = m.trip_id AND e.event_id = m.mx',
  sol='SELECT trip_id, event_type FROM (\n  SELECT trip_id, event_type, ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY event_id DESC) AS rn FROM trip_events) x WHERE rn = 1',
  avoid=[[r'max\s*\(', 'Still using MAX plus a join. Rank rows with a window function.']], need=[[r'over\s*\(', 'Use a window function (ROW_NUMBER() OVER ...).']],
  rec=['2 scans of 6 B rows + a shuffle join · 9 min', '1 scan + 1 window sort · 3.5 min'],
  h=['The table is read twice.', 'A window function can find the max per group in the same pass.', 'Filter rn = 1 outside.'],
  fups=[['When is the self-join version still fine?', 'When the grouped side is tiny and broadcast, or the engine has a good index. On big lake tables the single pass usually wins.'], ['What is QUALIFY?', 'In Snowflake, BigQuery and DuckDB, QUALIFY ROW_NUMBER() OVER (...) = 1 filters a window result without a subquery.']], why='Reading a big table once instead of twice.')

# Week 3 joins at scale
q(w=3, k='W', lv='Medium', t='Driver utilisation', p='For each driver, return driver_id, name, completed trips and their share of all completed trips in their city (as a percent, 1 decimal).',
  sol="WITH d AS (SELECT driver_id, city_id, COUNT(*) AS n FROM trips WHERE status = 'completed' AND driver_id IS NOT NULL GROUP BY 1, 2)\nSELECT d.driver_id, dr.name, d.n AS completed, ROUND(100.0 * d.n / SUM(d.n) OVER (PARTITION BY d.city_id), 1) AS pct_of_city\nFROM d JOIN drivers dr ON dr.driver_id = d.driver_id",
  h=['Count per driver and city.', 'SUM(n) OVER (PARTITION BY city_id) gives the city total without another join.', 'Multiply by 100.0 to avoid integer division.'], why='Share-of-total with windows instead of a second aggregate join.')
q(w=3, k='W', lv='Medium', t='Trips with no driver by city', p='Return city_name and how many trips had no driver assigned (driver_id IS NULL), most first.',
  sol='SELECT c.city_name, COUNT(*) AS no_driver\nFROM trips t JOIN cities c ON c.city_id = t.city_id\nWHERE t.driver_id IS NULL GROUP BY c.city_name ORDER BY no_driver DESC, c.city_name', ordered=True,
  h=['Filter on IS NULL, not = NULL.', 'Join cities for the name.', 'Order by the count.'], why='NULL keys are the root of most join skew.')
q(w=3, k='W', lv='Hard', t='Hot drivers: is the load skewed?', p='Return driver_id and trip count for drivers whose trip count is more than twice the average per driver.',
  sol="WITH c AS (SELECT driver_id, COUNT(*) AS n FROM trips WHERE driver_id IS NOT NULL GROUP BY driver_id)\nSELECT driver_id, n FROM c WHERE n > 2 * (SELECT AVG(n) FROM c)",
  h=['Count per driver.', 'Compare with the average of those counts.', 'A CTE lets you use the counts twice.'], why='This is the query you run first when a Spark join has a straggler.')
q(w=3, k='W', lv='Medium', t='Revenue per rider tier', p='Return tier, number of riders who completed at least one trip, and total completed fare, by tier.',
  sol="SELECT r.tier, COUNT(DISTINCT t.rider_id) AS riders, ROUND(SUM(t.fare), 2) AS revenue\nFROM trips t JOIN riders r ON r.rider_id = t.rider_id\nWHERE t.status = 'completed' GROUP BY r.tier",
  h=['Join trips to riders for the tier.', 'COUNT(DISTINCT rider_id) counts people.', 'Filter completed trips.'], why='Distinct counts after a one-to-many join.')
q(w=3, k='O', lv='Hard', t='Fan-out: aggregate before joining', p='This joins trips to trip_events before counting, which multiplies rows. Return city_id, completed trips and total fare correctly and cheaply.',
  start="SELECT t.city_id, COUNT(DISTINCT t.trip_id) AS trips, ROUND(SUM(DISTINCT t.fare), 2) AS fare\nFROM trips t JOIN trip_events e ON e.trip_id = t.trip_id\nWHERE t.status = 'completed'\nGROUP BY t.city_id",
  sol="SELECT city_id, COUNT(*) AS trips, ROUND(SUM(fare), 2) AS fare FROM trips WHERE status = 'completed' GROUP BY city_id",
  avoid=[[r'trip_events', 'trip_events is not needed and multiplies rows.'], [r'distinct', 'DISTINCT is hiding a fan-out. Remove the join instead.']],
  rec=['12 B joined rows · 14 min · and SUM(DISTINCT fare) is wrong when two trips share a fare', '2 B rows · 40 s · correct'],
  h=['Each trip has several events, so the join copies each trip several times.', 'SUM(DISTINCT fare) is a bug: two trips with the same fare count once.', 'Aggregate at the trip grain; join only if you need event data.'],
  fups=[['How do you spot a fan-out in a plan?', 'The join output row count is far bigger than either side you expected to keep. Check row counts after each join in EXPLAIN ANALYZE or the Spark UI.'], ['Why is SUM(DISTINCT) dangerous?', 'It removes equal values, not duplicate rows. Two different trips with fare 120.00 add up once.']], why='Grain mistakes are the most common real-world SQL bug.')

# Week 4 modeling
q(w=4, k='W', lv='Medium', t='Daily city fact table', p='Build a daily fact: trip_date, city_id, trips (all), completed, cancelled, revenue (completed fare).',
  sol="SELECT trip_date, city_id, COUNT(*) AS trips,\n  COUNT(*) FILTER (WHERE status = 'completed') AS completed,\n  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,\n  ROUND(SUM(fare) FILTER (WHERE status = 'completed'), 2) AS revenue\nFROM trips GROUP BY trip_date, city_id",
  h=['One row per day and city: that is the grain.', 'Conditional counts: COUNT(*) FILTER (WHERE ...) or SUM(CASE WHEN ...).', 'Revenue only for completed trips.'], why='Declaring the grain first is what modeling interviews test.')
q(w=4, k='W', lv='Medium', t='Pivot trips by status', p='Return city_id and three columns completed, cancelled, no_driver with trip counts.',
  sol="SELECT city_id,\n  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,\n  SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,\n  SUM(CASE WHEN status = 'no_driver' THEN 1 ELSE 0 END) AS no_driver\nFROM trips GROUP BY city_id",
  h=['One output column per status.', 'SUM(CASE WHEN status = ... THEN 1 ELSE 0 END).', 'Works in every engine, unlike PIVOT syntax.'], why='Manual pivots appear in most reporting rounds.')
q(w=4, k='W', lv='Hard', t='SCD Type 2: rider tier history', p='Treat riders as the current snapshot. Build rows rider_id, tier, valid_from (signup_date), valid_to (NULL), is_current (TRUE) ready to load into a Type 2 dimension.',
  sol='SELECT rider_id, tier, signup_date AS valid_from, CAST(NULL AS DATE) AS valid_to, TRUE AS is_current FROM riders',
  h=['A Type 2 row has the value plus a validity window.', 'New rows start with valid_to NULL and is_current TRUE.', 'CAST(NULL AS DATE) gives the column a type.'], why='SCD2 shows up in every warehouse round; start with the initial load.')
q(w=4, k='W', lv='Medium', t='First trip date per rider', p='Return rider_id and the date of their first completed trip, plus how many days after signup it happened.',
  sol="SELECT t.rider_id, MIN(t.trip_date) AS first_trip, MIN(t.trip_date) - r.signup_date AS days_to_first\nFROM trips t JOIN riders r ON r.rider_id = t.rider_id\nWHERE t.status = 'completed' GROUP BY t.rider_id, r.signup_date",
  h=['MIN(trip_date) per rider.', 'Join riders for signup_date.', 'Group by the columns you select.'], why='Activation metrics for a product team.')
q(w=4, k='O', lv='Medium', t='Star schema: stop joining for every query', p='A dashboard joins 3 tables to get revenue by country. Rewrite it so it reads only trips and cities: country and completed revenue from trips.fare (payments has known amount mismatches, so it should not be the source of truth).',
  start="SELECT c.country, ROUND(SUM(p.amount), 2) AS revenue\nFROM payments p\nJOIN trips t ON t.trip_id = p.trip_id\nJOIN cities c ON c.city_id = t.city_id\nGROUP BY c.country",
  sol="SELECT c.country, ROUND(SUM(t.fare), 2) AS revenue\nFROM trips t JOIN cities c ON c.city_id = t.city_id\nWHERE t.status = 'completed' GROUP BY c.country",
  avoid=[[r'payments', 'payments repeats what trips already stores (fare for completed trips).']],
  rec=['3-way join · 2.4 TB shuffled · 6 min', '1 broadcast join to a 600-row dimension · 35 s'],
  h=['payments.amount equals trips.fare for completed trips.', 'Read the fact table and one small dimension.', 'A small dimension is broadcast, so no shuffle.'],
  fups=[['Fact vs dimension?', 'Facts are events at a grain (a trip) with measures (fare). Dimensions describe them (city, rider). Facts are big and append; dimensions are small and change slowly.'], ['When would you denormalise country onto trips?', 'When nearly every query needs it and the dimension rarely changes. You trade storage and update work for fewer joins.']], why='Modeling is about making common queries cheap.')

# Week 5 time and streams
q(w=5, k='W', lv='Medium', t='Trips per hour of day', p='Return hour (0-23) and number of trips, for all 24 hours that appear, by hour.',
  sol='SELECT HOUR(pickup_ts) AS hr, COUNT(*) AS trips FROM trips GROUP BY hr ORDER BY hr', ordered=True,
  h=['Extract the hour from pickup_ts.', 'HOUR(ts) or EXTRACT(hour FROM ts).', 'Order by hour.'], why='Time bucketing is the first step of any streaming metric.')
q(w=5, k='W', lv='Hard', t='Sessionise clicks (30-minute gap)', p='A new session starts when a user is idle for more than 30 minutes. Return user_id, session number (1, 2, ...) and clicks in that session.',
  sol="WITH g AS (SELECT user_id, ts, CASE WHEN ts - LAG(ts) OVER (PARTITION BY user_id ORDER BY ts) > INTERVAL 30 MINUTE THEN 1 ELSE 0 END AS new_s FROM clicks),\ns AS (SELECT user_id, 1 + SUM(new_s) OVER (PARTITION BY user_id ORDER BY ts ROWS UNBOUNDED PRECEDING) AS session_no FROM g)\nSELECT user_id, session_no, COUNT(*) AS clicks FROM s GROUP BY user_id, session_no",
  h=['Mark a click as a new session when the gap to the previous click is over 30 minutes.', 'A running SUM of those marks numbers the sessions.', 'The first click has no previous click: LAG is NULL, so it is not marked, and 1 + 0 = session 1.'], why='Sessionisation is the classic "gaps and islands" streaming question.')
q(w=5, k='W', lv='Medium', t='Rolling 3-day completed trips', p='Return trip_date, completed trips that day and a rolling sum over that day and the 2 previous days.',
  sol="WITH d AS (SELECT trip_date, COUNT(*) AS n FROM trips WHERE status = 'completed' GROUP BY trip_date)\nSELECT trip_date, n, SUM(n) OVER (ORDER BY trip_date ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS rolling_3d FROM d ORDER BY trip_date", ordered=True,
  h=['Daily counts first.', 'ROWS BETWEEN 2 PRECEDING AND CURRENT ROW.', 'Missing days would need a date spine; here every day has trips.'], why='Rolling windows are sliding windows in SQL.')
q(w=5, k='W', lv='Medium', t='Time from request to completion', p='Using trip_events, return trip_id and minutes between the requested and completed events for completed trips.',
  sol="SELECT trip_id, DATEDIFF('minute', MIN(event_ts) FILTER (WHERE event_type = 'requested'), MAX(event_ts) FILTER (WHERE event_type = 'completed')) AS minutes\nFROM trip_events GROUP BY trip_id\nHAVING COUNT(*) FILTER (WHERE event_type = 'completed') > 0",
  h=['Pivot two event times per trip.', "MIN(event_ts) FILTER (WHERE event_type = 'requested').", 'Keep only trips that have a completed event.'], why='Turning event streams into durations is core to ops dashboards.')
q(w=5, k='O', lv='Medium', t='Hourly counts: range filters, not functions', p='Return hour and trip count for 20 Oct 2026 only. The current query wraps the timestamp in a function; rewrite it with a plain range so the engine can prune.',
  start="SELECT HOUR(pickup_ts) AS hr, COUNT(*) AS trips FROM trips\nWHERE CAST(pickup_ts AS DATE) = DATE '2026-10-20'\nGROUP BY hr",
  sol="SELECT HOUR(pickup_ts) AS hr, COUNT(*) AS trips FROM trips\nWHERE pickup_ts >= TIMESTAMP '2026-10-20 00:00:00' AND pickup_ts < TIMESTAMP '2026-10-21 00:00:00'\nGROUP BY hr",
  avoid=[[r'(cast|date|date_trunc)\s*\(\s*pickup_ts', 'A function on pickup_ts in WHERE hides it from pruning and min/max stats.']], need=[[r'pickup_ts\s*>=', 'Use a half-open range: pickup_ts >= day AND pickup_ts < next day.']],
  rec=['reads all 730 days · 4.2 TB · 48 s', 'reads 1 day · 5.8 GB · 1.6 s'],
  h=['Filters on bare columns can use partition and min/max statistics.', 'Rewrite as pickup_ts >= start AND pickup_ts < end.', 'Half-open ranges avoid 23:59:59 bugs.'],
  fups=[['Why half-open ranges?', 'pickup_ts < next day includes every fraction of a second of the day; BETWEEN ... 23:59:59 can miss 23:59:59.5.'], ['What if the table is partitioned by trip_date instead?', 'Add trip_date = DATE ... as well. The partition column is what prunes files; the timestamp range then trims rows.']], why='The single most common optimisation interviewers expect.')

# Week 6 CDC and reconciliation
q(w=6, k='W', lv='Medium', t='Reconcile trips and payments', p='Return completed trips that have no payment row (trip_id, fare).',
  sol="SELECT t.trip_id, t.fare FROM trips t\nLEFT JOIN payments p ON p.trip_id = t.trip_id\nWHERE t.status = 'completed' AND p.trip_id IS NULL",
  h=['Anti-join from trips to payments.', 'LEFT JOIN and keep rows where the payment side is NULL.', 'Filter completed trips.'], why='Reconciliation between two systems is a daily data-quality job.')
q(w=6, k='W', lv='Medium', t='Amount mismatches', p='Return trip_id, fare and payment amount where they differ by more than 0.01.',
  sol='SELECT t.trip_id, t.fare, p.amount FROM trips t JOIN payments p ON p.trip_id = t.trip_id WHERE ABS(t.fare - p.amount) > 0.01',
  h=['Join on trip_id.', 'Compare with a tolerance; floats are not exact.', 'ABS(a - b) > 0.01.'], why='Money reconciliation needs tolerances and exact keys.')
q(w=6, k='W', lv='Hard', t='Duplicate events from retries', p='Return trip_id, event_type and how many copies exist for events that appear more than once (same trip, type and timestamp).',
  sol='SELECT trip_id, event_type, COUNT(*) AS copies FROM trip_events GROUP BY trip_id, event_type, event_ts HAVING COUNT(*) > 1',
  h=['Duplicates share the business key, not event_id.', 'Group by the natural key.', 'HAVING COUNT(*) > 1.'], why='Retries create duplicates; you must find them by business key.')
q(w=6, k='W', lv='Medium', t='Clean event table', p='Return the events with duplicates removed: one row per (trip_id, event_type, event_ts), keeping the lowest event_id. Columns: event_id, trip_id, event_type, event_ts.',
  sol='SELECT MIN(event_id) AS event_id, trip_id, event_type, event_ts FROM trip_events GROUP BY trip_id, event_type, event_ts',
  h=['Keep one row per natural key.', 'MIN(event_id) picks a stable survivor.', 'ROW_NUMBER() = 1 works too.'], why='Idempotent dedupe makes reruns safe.')
q(w=6, k='O', lv='Hard', t='Incremental load instead of full rebuild', p='The nightly job recomputes city revenue for all days. Rewrite it to compute only the newest day (2026-10-21). Return city_id, trip_date, revenue for that day.',
  start="SELECT city_id, trip_date, ROUND(SUM(fare), 2) AS revenue FROM trips\nWHERE status = 'completed'\nGROUP BY city_id, trip_date\nHAVING trip_date = DATE '2026-10-21'",
  sol="SELECT city_id, trip_date, ROUND(SUM(fare), 2) AS revenue FROM trips\nWHERE status = 'completed' AND trip_date = DATE '2026-10-21'\nGROUP BY city_id, trip_date",
  avoid=[[r'having\s+trip_date', 'Filtering the date in HAVING aggregates every day first. Filter in WHERE.']], need=[[r'where[\s\S]*trip_date\s*=', "Put trip_date = DATE '2026-10-21' in WHERE."]],
  rec=['aggregates 730 days, keeps 1 · 6 min', 'reads 1 partition · 9 s'],
  h=['HAVING runs after GROUP BY: all days are aggregated, then 729 are thrown away.', 'WHERE filters before aggregating and prunes partitions.', 'Then MERGE or overwrite only that partition in the target.'],
  fups=[['How do you make an incremental load safe to rerun?', 'Write the day with INSERT OVERWRITE of that partition, or MERGE on (city_id, trip_date). Never plain INSERT.'], ['What about late data for earlier days?', 'Reprocess a small trailing window (say 3 days) each run, or drive the window from the max updated_at you saw.']], why='Incremental processing is how you cut cost by 100x.')

# Week 7 cost and pruning
q(w=7, k='W', lv='Easy', t='Busiest day per city', p='Return city_id, the trip_date with the most trips and that count. Keep ties.',
  sol='SELECT city_id, trip_date, n FROM (SELECT city_id, trip_date, COUNT(*) AS n, RANK() OVER (PARTITION BY city_id ORDER BY COUNT(*) DESC) AS rk FROM trips GROUP BY city_id, trip_date) x WHERE rk = 1',
  h=['Count per city and day.', 'RANK() per city by count.', 'Keep rk = 1 (ties included).'], why='Argmax per group.')
q(w=7, k='W', lv='Medium', t='Long trips share', p='Return city_id and the percent of completed trips longer than 15 km, 1 decimal.',
  sol="SELECT city_id, ROUND(100.0 * AVG(CASE WHEN distance_km > 15 THEN 1 ELSE 0 END), 1) AS pct_long FROM trips WHERE status = 'completed' GROUP BY city_id",
  h=['A share is the average of a 0/1 flag.', 'AVG(CASE WHEN ... THEN 1 ELSE 0 END).', 'Multiply by 100.0.'], why='Ratios without a second query.')
q(w=7, k='W', lv='Medium', t='Cost per city: fare per km', p='Return city_name and average fare per km for completed trips, 2 decimals, highest first.',
  sol="SELECT c.city_name, ROUND(SUM(t.fare) / SUM(t.distance_km), 2) AS fare_per_km FROM trips t JOIN cities c USING (city_id) WHERE t.status = 'completed' GROUP BY c.city_name ORDER BY fare_per_km DESC", ordered=True,
  h=['Ratio of sums, not the average of ratios.', 'SUM(fare) / SUM(distance_km).', 'Average of per-trip ratios weights short trips too much.'], why='Ratio-of-sums vs average-of-ratios is a favourite trap.')
q(w=7, k='W', lv='Medium', t='Weekly active riders', p='Return the week start (date_trunc week of trip_date) and distinct riders with a completed trip, by week.',
  sol="SELECT DATE_TRUNC('week', trip_date) AS week, COUNT(DISTINCT rider_id) AS riders FROM trips WHERE status = 'completed' GROUP BY week ORDER BY week", ordered=True,
  h=['Truncate the date to the week.', 'COUNT(DISTINCT rider_id).', 'Order by week.'], why='WAU is the metric every product team asks for.')
q(w=7, k='O', lv='Medium', t='Only read the columns you need', p='This export reads every column and filters later in Python. Return only trip_id, city_id and fare for completed trips in city 1.',
  start='SELECT * FROM trips',
  sol="SELECT trip_id, city_id, fare FROM trips WHERE status = 'completed' AND city_id = 1",
  avoid=[[r'select\s+\*', 'SELECT * reads every column of a columnar file.']], need=[[r'where', 'Filter in SQL, not after loading.']],
  rec=['44 of 44 columns · 2 B rows to the client · 22 min', '3 columns · 41 M rows · 50 s'],
  h=['Parquet stores each column separately.', 'Name the 3 columns.', 'Push the filters into WHERE so fewer rows leave the engine.'],
  fups=[['Why is SELECT * worse on Parquet than on Postgres?', 'Columnar files read only the requested columns. SELECT * throws that away and reads all of them; on row stores you read whole rows anyway.'], ['What else reduces bytes scanned?', 'Partition pruning, clustering/Z-order on filter columns, and min/max statistics per row group.']], why='Bytes scanned is the bill in BigQuery, Athena and Snowflake.')

# Week 8 lakehouse upserts
q(w=8, k='W', lv='Medium', t='Upsert source: latest row per rider', p='Simulate a CDC batch: from riders, return rider_id, name and tier for riders who signed up on or after 2026-07-01 (the batch to MERGE).',
  sol="SELECT rider_id, name, tier FROM riders WHERE signup_date >= DATE '2026-07-01'",
  h=['The batch is the set of changed rows.', 'Filter on the change column.', 'This is the USING side of a MERGE.'], why='Every MERGE starts with a clean, deduped source.')
q(w=8, k='W', lv='Medium', t='Rows to insert vs update', p='Compare this batch (riders signed up since 2026-07-01) with a target of riders who signed up before 2026-09-01. Return rider_id and action: insert or update.',
  sol="WITH src AS (SELECT rider_id FROM riders WHERE signup_date >= DATE '2026-07-01'), tgt AS (SELECT rider_id FROM riders WHERE signup_date < DATE '2026-09-01')\nSELECT s.rider_id, CASE WHEN t.rider_id IS NULL THEN 'insert' ELSE 'update' END AS action FROM src s LEFT JOIN tgt t ON t.rider_id = s.rider_id",
  h=['Matched keys are updates, unmatched are inserts.', 'LEFT JOIN source to target.', 'CASE on the target key being NULL.'], why='This is what MERGE does under the hood.')
q(w=8, k='W', lv='Medium', t='Partition sizes', p='Return trip_date and row count per day, plus each day\'s percent of all rows (1 decimal), to spot skewed partitions.',
  sol='SELECT trip_date, COUNT(*) AS n, ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct FROM trips GROUP BY trip_date',
  h=['Count per partition value.', 'SUM(COUNT(*)) OVER () is the grand total.', 'Big percentages mean skew.'], why='Checking partition balance before choosing a layout.')
q(w=8, k='W', lv='Hard', t='Snapshot diff', p='Treat drivers with rating >= 4.5 as yesterday\'s snapshot and drivers joined before 2025-06-01 as today\'s. Return driver_id and change: added, removed.',
  sol="WITH y AS (SELECT driver_id FROM drivers WHERE rating >= 4.5), t AS (SELECT driver_id FROM drivers WHERE joined_on < DATE '2025-06-01')\nSELECT COALESCE(y.driver_id, t.driver_id) AS driver_id, CASE WHEN y.driver_id IS NULL THEN 'added' ELSE 'removed' END AS change\nFROM y FULL JOIN t ON y.driver_id = t.driver_id WHERE y.driver_id IS NULL OR t.driver_id IS NULL",
  h=['FULL OUTER JOIN the two snapshots on the key.', 'Missing on one side means added or removed.', 'COALESCE the key.'], why='Snapshot diffs drive CDC when the source has no change log.')
q(w=8, k='O', lv='Hard', t='MERGE on a narrowed target', p='The MERGE scans the whole target. Write the source query so it carries the partition column, and return rider_id, signup_date for the batch (signup on/after 2026-07-01), so the MERGE can add `AND t.signup_date >= DATE \'2026-07-01\'`.',
  start="SELECT rider_id FROM riders WHERE signup_date >= DATE '2026-07-01'",
  sol="SELECT rider_id, signup_date FROM riders WHERE signup_date >= DATE '2026-07-01'",
  need=[[r'signup_date\s*(,|from)', 'Return signup_date too, so the MERGE can prune the target.']],
  rec=['MERGE rewrites files across 730 partitions · 18 min', 'MERGE touches 4 partitions · 40 s'],
  h=['MERGE cost is driven by which target files must be read and rewritten.', 'Give the MERGE a partition filter it can prune on.', 'That needs the partition column in the source.'],
  fups=[['Why do MERGEs get slow over time in Delta/Iceberg?', 'Each one rewrites files that contain matched rows. Without a partition or clustering filter every file is a candidate. Compaction and Z-order help.'], ['Copy-on-write vs merge-on-read?', 'Copy-on-write rewrites data files at write time (fast reads). Merge-on-read writes delete files and merges at read time (fast writes).']], why='Lakehouse upserts are the top cost item in many platforms.')

# Week 9 data quality
q(w=9, k='W', lv='Easy', t='Null rate per column', p='Return the percent of NULL driver_id and NULL rider_id in trips, 1 decimal each.',
  sol='SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE driver_id IS NULL) / COUNT(*), 1) AS null_driver_pct, ROUND(100.0 * COUNT(*) FILTER (WHERE rider_id IS NULL) / COUNT(*), 1) AS null_rider_pct FROM trips',
  h=['Count NULLs over all rows.', 'COUNT(*) FILTER (WHERE col IS NULL).', 'Multiply by 100.0.'], why='The first check in any data-quality suite.')
q(w=9, k='W', lv='Medium', t='Orphan foreign keys', p='Return trips whose driver_id is not NULL and does not exist in drivers (trip_id, driver_id).',
  sol='SELECT t.trip_id, t.driver_id FROM trips t LEFT JOIN drivers d ON d.driver_id = t.driver_id WHERE t.driver_id IS NOT NULL AND d.driver_id IS NULL',
  h=['Anti-join to the dimension.', 'Exclude real NULLs, which are allowed.', 'Zero rows means the check passes.'], why='Referential integrity checks guard every join.')
q(w=9, k='W', lv='Medium', t='Volume anomaly', p='Return trip_date and trips where the day\'s trips differ from the trailing 7-day average by more than 30%.',
  sol='WITH d AS (SELECT trip_date, COUNT(*) AS n FROM trips GROUP BY trip_date), a AS (SELECT trip_date, n, AVG(n) OVER (ORDER BY trip_date ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING) AS avg7 FROM d)\nSELECT trip_date, n FROM a WHERE avg7 IS NOT NULL AND ABS(n - avg7) > 0.3 * avg7',
  h=['Daily counts.', 'Average of the 7 days before (not including today).', 'Flag big deviations.'], why='Freshness and volume monitors catch silent failures.')
q(w=9, k='W', lv='Medium', t='Out-of-range values', p='Return completed trips with fare <= 0 or distance_km > 100 or rating-impossible drivers (rating > 5). Columns: trip_id, reason.',
  sol="SELECT t.trip_id, CASE WHEN t.fare <= 0 THEN 'bad fare' WHEN t.distance_km > 100 THEN 'bad distance' ELSE 'bad rating' END AS reason\nFROM trips t LEFT JOIN drivers d ON d.driver_id = t.driver_id\nWHERE t.status = 'completed' AND (t.fare <= 0 OR t.distance_km > 100 OR d.rating > 5)",
  h=['Combine rule checks with OR.', 'Label which rule failed with CASE.', 'An empty result means clean data.'], why='Range rules are the bulk of data contracts.')
q(w=9, k='O', lv='Medium', t='One pass for many checks', p='Five separate queries each scan trips. Return one row with: total rows, null drivers, cancelled, zero-fare completed, distinct riders.',
  start="SELECT (SELECT COUNT(*) FROM trips) AS total, (SELECT COUNT(*) FROM trips WHERE driver_id IS NULL) AS null_driver, (SELECT COUNT(*) FROM trips WHERE status = 'cancelled') AS cancelled, (SELECT COUNT(*) FROM trips WHERE status = 'completed' AND fare = 0) AS zero_fare, (SELECT COUNT(DISTINCT rider_id) FROM trips) AS riders",
  sol="SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE driver_id IS NULL) AS null_driver, COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled, COUNT(*) FILTER (WHERE status = 'completed' AND fare = 0) AS zero_fare, COUNT(DISTINCT rider_id) AS riders FROM trips",
  avoid=[[r'\(\s*select', 'Each subquery is another scan. Use conditional aggregates in one SELECT.']],
  rec=['5 full scans · 5 × 40 s', '1 scan · 45 s'],
  h=['Each subquery reads the whole table.', 'FILTER (WHERE ...) or SUM(CASE ...) computes many counts in one pass.', 'COUNT(DISTINCT) can share the same pass.'],
  fups=[['How does Great Expectations or dbt test this at scale?', 'Many tools run one query per test. Batch related checks into one query per table, or profile once and evaluate rules on the profile.'], ['What do you alert on?', 'Hard failures (orphans, nulls in keys) block the pipeline; soft ones (volume drift) warn and open a ticket.']], why='Cheap data quality is data quality people keep running.')

# Week 10 serving and rollups
q(w=10, k='W', lv='Medium', t='Rollup with subtotals', p='Return country, city_name and completed revenue, with a subtotal row per country and a grand total (use ROLLUP).',
  sol="SELECT c.country, c.city_name, ROUND(SUM(t.fare), 2) AS revenue FROM trips t JOIN cities c USING (city_id) WHERE t.status = 'completed' GROUP BY ROLLUP (c.country, c.city_name)",
  h=['ROLLUP(a, b) gives (a, b), (a) and () groupings.', 'Subtotal rows have NULL in the rolled-up columns.', 'GROUPING() tells real NULLs from subtotal NULLs.'], why='Pre-aggregated cubes power fast dashboards.')
q(w=10, k='W', lv='Medium', t='Percentile fares', p='Return city_id with the median and 90th percentile completed fare (2 decimals).',
  sol="SELECT city_id, ROUND(QUANTILE_CONT(fare, 0.5), 2) AS p50, ROUND(QUANTILE_CONT(fare, 0.9), 2) AS p90 FROM trips WHERE status = 'completed' GROUP BY city_id",
  h=['Percentiles are ordered-set aggregates.', 'QUANTILE_CONT / PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fare).', 'Approximate versions exist for huge tables.'], why='p50/p90 latency and fare metrics for serving layers.')
q(w=10, k='W', lv='Hard', t='Top route pairs', p='Treat the pair (rider city, trip city) as a route. Return the top 5 pairs by completed trips with names: from_city, to_city, trips.',
  sol="SELECT rc.city_name AS from_city, tc.city_name AS to_city, COUNT(*) AS trips\nFROM trips t JOIN riders r ON r.rider_id = t.rider_id JOIN cities rc ON rc.city_id = r.city_id JOIN cities tc ON tc.city_id = t.city_id\nWHERE t.status = 'completed' GROUP BY 1, 2 ORDER BY trips DESC, from_city, to_city LIMIT 5", ordered=True,
  h=['Join cities twice with different aliases.', 'Group by both names.', 'Deterministic ORDER BY before LIMIT.'], why='Role-playing dimensions (the same table used twice).')
q(w=10, k='W', lv='Medium', t='Driver leaderboard with ties broken', p='Return the top 10 drivers by completed trips: driver_id, name, trips, avg rating; break ties by higher rating then driver_id.',
  sol="SELECT d.driver_id, d.name, COUNT(*) AS trips, d.rating FROM trips t JOIN drivers d USING (driver_id) WHERE t.status = 'completed' GROUP BY d.driver_id, d.name, d.rating ORDER BY trips DESC, d.rating DESC, d.driver_id LIMIT 10", ordered=True,
  h=['Count completed trips per driver.', 'Order by count, then rating, then id.', 'Ties need a deterministic rule for a stable API.'], why='Serving APIs need stable ordering.')
q(w=10, k='O', lv='Medium', t='Serve from a summary table', p='A dashboard tile runs this over raw trips on every page load. Write the summary query you would materialise once: trip_date, city_id, completed, revenue.',
  start="SELECT t.trip_date, t.city_id, COUNT(*) AS completed, ROUND(SUM(t.fare), 2) AS revenue FROM trips t JOIN trip_events e ON e.trip_id = t.trip_id WHERE e.event_type = 'completed' GROUP BY t.trip_date, t.city_id",
  sol="SELECT trip_date, city_id, COUNT(*) AS completed, ROUND(SUM(fare), 2) AS revenue FROM trips WHERE status = 'completed' GROUP BY trip_date, city_id",
  avoid=[[r'trip_events', 'Do not join events: the status is already on trips, and duplicates inflate counts.']],
  rec=['raw join per page view · 12 s · 4,000 views/day', 'summary built hourly · 30 ms per view'],
  h=['The tile only needs daily totals per city.', 'Read trips once and aggregate; status is already there.', 'Refresh the summary on a schedule, serve from it.'],
  fups=[['Materialised view or a scheduled table?', 'Use a materialised view if the engine refreshes incrementally and cheaply; otherwise a dbt model on a schedule with a freshness check.'], ['How do you keep it correct with late data?', 'Rebuild the last few days each run, and expose a freshness timestamp on the dashboard.']], why='Precompute for read-heavy workloads.')

# Week 11 product metrics
q(w=11, k='W', lv='Medium', t='Conversion funnel', p='From trip_events, return how many trips reached each stage: requested, driver_assigned, completed (one row, three columns).',
  sol="SELECT COUNT(DISTINCT trip_id) FILTER (WHERE event_type = 'requested') AS requested, COUNT(DISTINCT trip_id) FILTER (WHERE event_type = 'driver_assigned') AS assigned, COUNT(DISTINCT trip_id) FILTER (WHERE event_type = 'completed') AS completed FROM trip_events",
  h=['Count distinct trips per stage.', 'Duplicates exist, so use DISTINCT.', 'One row with conditional counts.'], why='Funnels are the first metric in a customer discovery call.')
q(w=11, k='W', lv='Hard', t='Week-1 retention by signup month', p='For riders who signed up in 2026, return signup month and the percent who completed a trip within 7 days of signing up (1 decimal).',
  sol="SELECT DATE_TRUNC('month', r.signup_date) AS cohort, ROUND(100.0 * COUNT(DISTINCT t.rider_id) / COUNT(DISTINCT r.rider_id), 1) AS pct_week1\nFROM riders r LEFT JOIN trips t ON t.rider_id = r.rider_id AND t.status = 'completed' AND t.trip_date BETWEEN r.signup_date AND r.signup_date + INTERVAL 7 DAY\nWHERE r.signup_date >= DATE '2026-01-01' GROUP BY cohort",
  h=['Cohort = signup month.', 'LEFT JOIN trips within 7 days of signup (condition in ON).', 'Distinct retained riders / distinct cohort riders.'], why='Cohort retention is the classic product analytics question.')
q(w=11, k='W', lv='Medium', t='Plus vs free riders: A/B style comparison', p='Return tier, riders, completed trips per rider (2 decimals) and average fare (2 decimals).',
  sol="SELECT r.tier, COUNT(DISTINCT r.rider_id) AS riders, ROUND(COUNT(t.trip_id) * 1.0 / COUNT(DISTINCT r.rider_id), 2) AS trips_per_rider, ROUND(AVG(t.fare), 2) AS avg_fare FROM riders r LEFT JOIN trips t ON t.rider_id = r.rider_id AND t.status = 'completed' GROUP BY r.tier",
  h=['Per-rider metrics need every rider in the denominator.', 'LEFT JOIN with the status filter in ON.', 'COUNT(t.trip_id) ignores riders without trips.'], why='Experiment readouts start with clean per-unit metrics.')
q(w=11, k='W', lv='Medium', t='Cancellation rate by hour', p='Return hour of day and cancellation rate (percent of trips cancelled, 1 decimal) for hours with at least 20 trips.',
  sol="SELECT HOUR(pickup_ts) AS hr, ROUND(100.0 * AVG(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 1) AS cancel_pct FROM trips GROUP BY hr HAVING COUNT(*) >= 20",
  h=['Rate = average of a 0/1 flag.', 'Group by hour.', 'HAVING drops small, noisy groups.'], why='Small-sample filters keep metrics honest.')
q(w=11, k='O', lv='Medium', t='COUNT(DISTINCT) at scale', p='Daily active riders over 6 B events is slow. Return event_date and approximate distinct riders using APPROX_COUNT_DISTINCT.',
  start='SELECT event_date, COUNT(DISTINCT rider_id) AS dau FROM trip_events GROUP BY event_date',
  sol='SELECT event_date, APPROX_COUNT_DISTINCT(rider_id) AS dau FROM trip_events GROUP BY event_date',
  need=[[r'approx_count_distinct', 'Use APPROX_COUNT_DISTINCT (HyperLogLog).']], approx=True,
  rec=['exact distinct · shuffles every rider id · 7 min', 'HyperLogLog sketch · ~2% error · 40 s'],
  h=['Exact distinct must shuffle every id to one place per group.', 'A HyperLogLog sketch is tiny and mergeable.', 'Fine for dashboards, not for billing.'],
  fups=[['Why are HLL sketches mergeable?', 'Each sketch keeps per-bucket maxima; merging takes the max per bucket. So you can store daily sketches and combine them into weekly uniques.'], ['When must it be exact?', 'Billing, payouts, compliance counts. Use exact counts there and pay for it.']], why='Knowing when approximate is good enough is an architect skill.')

# Week 12 mixed
q(w=12, k='W', lv='Hard', t='Gaps and islands: active streaks', p='Return rider_id and their longest run of consecutive days with a completed trip.',
  sol="WITH d AS (SELECT DISTINCT rider_id, trip_date FROM trips WHERE status = 'completed'), g AS (SELECT rider_id, trip_date, trip_date - CAST(ROW_NUMBER() OVER (PARTITION BY rider_id ORDER BY trip_date) AS INT) AS grp FROM d)\nSELECT rider_id, MAX(n) AS longest FROM (SELECT rider_id, grp, COUNT(*) AS n FROM g GROUP BY rider_id, grp) x GROUP BY rider_id",
  h=['Distinct days first.', 'date - ROW_NUMBER() is constant inside a run of consecutive days.', 'Count per run, then take the max per rider.'], why='The single most famous SQL interview pattern.')
q(w=12, k='W', lv='Hard', t='Second highest salary per department', p='Return dept and the second highest distinct salary (NULL if none).',
  sol='SELECT dept, MAX(salary) FILTER (WHERE rk = 2) AS second FROM (SELECT dept, salary, DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS rk FROM employees) x GROUP BY dept',
  h=['Distinct salaries ranked per department.', 'DENSE_RANK = 2.', 'Departments with one salary still need a row (NULL).'], why='Classic Nth-highest with edge cases.')
q(w=12, k='W', lv='Medium', t='Manager chain depth', p='Using a recursive CTE, return emp_id, name and depth (0 for the top boss).',
  sol='WITH RECURSIVE chain AS (SELECT emp_id, name, 0 AS depth FROM employees WHERE manager_id IS NULL UNION ALL SELECT e.emp_id, e.name, c.depth + 1 FROM employees e JOIN chain c ON e.manager_id = c.emp_id) SELECT emp_id, name, depth FROM chain',
  h=['Start from people with no manager.', 'Join employees to the chain on manager_id.', 'Depth + 1 each step.'], why='Hierarchies: org charts, category trees, lineage graphs.')
q(w=12, k='W', lv='Medium', t='Payment method mix per city', p='Return city_name, method and its share of that city\'s payments (percent, 1 decimal).',
  sol='SELECT c.city_name, p.method, ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY c.city_name), 1) AS pct FROM payments p JOIN trips t USING (trip_id) JOIN cities c USING (city_id) GROUP BY c.city_name, p.method',
  h=['Count per city and method.', 'Divide by the city total with a window.', 'SUM(COUNT(*)) OVER (PARTITION BY city).'], why='Share-of-total per group, a staple.')
q(w=12, k='O', lv='Hard', t='Timed mock: fix three problems at once', p='This query has three performance problems. Return city_id and completed revenue for 2026-10-20 to 2026-10-21 with one clean query.',
  start="SELECT * FROM (\n  SELECT t.city_id, (SELECT SUM(x.fare) FROM trips x WHERE x.city_id = t.city_id AND x.status = 'completed' AND CAST(x.pickup_ts AS DATE) BETWEEN DATE '2026-10-20' AND DATE '2026-10-21') AS revenue\n  FROM trips t GROUP BY t.city_id) y",
  sol="SELECT city_id, SUM(fare) AS revenue FROM trips WHERE status = 'completed' AND trip_date BETWEEN DATE '2026-10-20' AND DATE '2026-10-21' GROUP BY city_id",
  avoid=[[r'\(\s*select', 'Remove the correlated subquery.'], [r'cast\s*\(\s*\w*\.?pickup_ts', 'Filter on the partition column trip_date, not a function of pickup_ts.'], [r'select\s+\*', 'Do not wrap in SELECT *; select what you need.']],
  rec=['correlated subquery × full scans · 25 min', '2 partitions · 1 aggregate · 4 s'],
  h=['Find all three: subquery per row, function on a timestamp, needless wrapping.', 'One GROUP BY with a WHERE on trip_date.', 'Check your answer matches before tuning further.'],
  fups=[['How would you explain the fix to a customer?', 'Lead with the outcome (25 minutes to 4 seconds, cost down ~100x), then the one-line reason for each change, then how you verified the numbers match.'], ['What would you check next if it was still slow?', 'The plan: is trips pruned to 2 partitions? Is there skew in city_id? Is the result cache or a summary table a better answer?']], why='Interviews often give several problems in one query.')
