# PySpark bank: 12 weeks x 5. Code runs on the practice engine (minispark over DuckDB) against the sample tables.
# Every answer must assign the final DataFrame to `result`. Read tables with spark.table('trips') or spark.read.parquet('s3://lake/trips').
P = []
def q(**k): P.append(k)
H = "from pyspark.sql import functions as F\nfrom pyspark.sql import Window\n"

# Week 1
q(w=1, k='W', lv='Easy', t='Completed trips per city', p='Count completed trips per city_id. Columns: city_id, completed.',
  start=H + "trips = spark.table('trips')\nresult = trips  # filter, group, count\nresult.show()",
  sol=H + "result = spark.table('trips').filter(F.col('status') == 'completed').groupBy('city_id').agg(F.count('*').alias('completed'))",
  h=['filter() then groupBy().agg().', "F.col('status') == 'completed'.", "F.count('*').alias('completed')."], why='The hello-world of PySpark interviews.')
q(w=1, k='W', lv='Easy', t='Daily active riders per city', p='Distinct riders with a completed trip per trip_date and city_id. Columns: trip_date, city_id, active_riders.',
  start=H + "trips = spark.read.parquet('s3://lake/trips')\nresult = trips\nresult.show()",
  sol=H + "result = spark.table('trips').filter(F.col('status') == 'completed').groupBy('trip_date', 'city_id').agg(F.countDistinct('rider_id').alias('active_riders'))",
  h=['One row per day and city.', 'count() counts trips; countDistinct() counts people.', 'Filter before grouping so it is pushed into the scan.'], why='count vs countDistinct is the classic trap.')
q(w=1, k='W', lv='Medium', t='Join trips to city names', p='Return city_name and total completed fare (rounded 2). Columns: city_name, revenue.',
  start=H + "trips = spark.table('trips')\ncities = spark.table('cities')\nresult = trips\nresult.show()",
  sol=H + "t = spark.table('trips').filter(F.col('status') == 'completed')\nresult = t.join(spark.table('cities'), 'city_id').groupBy('city_name').agg(F.round(F.sum('fare'), 2).alias('revenue'))",
  h=["join(other, 'city_id') joins on a shared column name.", 'Aggregate after the join.', 'cities is tiny: in real Spark it would be broadcast.'], why='Join + aggregate with a small dimension.')
q(w=1, k='W', lv='Medium', t='Riders with no completed trip', p='Return rider_id and name of riders without any completed trip.',
  start=H + "riders = spark.table('riders')\ntrips = spark.table('trips')\nresult = riders\nresult.show()",
  sol=H + "done = spark.table('trips').filter(F.col('status') == 'completed').select('rider_id')\nresult = spark.table('riders').join(done, 'rider_id', 'left_anti').select('rider_id', 'name')",
  h=['An anti-join keeps rows with no match.', "how='left_anti'.", 'Select the two columns at the end.'], why='Spark has semi and anti joins; interviewers like to see them.')
q(w=1, k='O', lv='Medium', t='Filter early, select few columns', p='This job joins everything, then filters. Make it filter and prune first. Result: trip_id, city_name for completed trips in country IN.',
  start=H + "t = spark.table('trips')\nc = spark.table('cities')\nresult = t.join(c, 'city_id').filter((F.col('status') == 'completed') & (F.col('country') == 'IN')).select('trip_id', 'city_name')",
  sol=H + "t = spark.table('trips').filter(F.col('status') == 'completed').select('trip_id', 'city_id')\nc = spark.table('cities').filter(F.col('country') == 'IN').select('city_id', 'city_name')\nresult = t.join(c, 'city_id').select('trip_id', 'city_name')",
  need=[[r"spark\.table\('trips'\)\s*\.filter|trips'\)\.filter|t\s*=\s*t\.filter", 'Filter trips before the join.'], [r"select\('trip_id',\s*'city_id'\)|select\(\"trip_id\"", 'Select only the columns you need before joining.']],
  rec=['shuffles 2 B rows × 9 columns · 6 min', '1.4 B rows × 2 columns, cities broadcast · 1.5 min'],
  h=['Catalyst often pushes filters down, but not through every UDF or complex expression.', 'Filter and select on each side before the join.', 'Smaller inputs mean a smaller shuffle.'],
  fups=[['Does Spark push the filter down anyway?', 'Usually yes for simple predicates (check PushedFilters in explain). Writing it early makes intent clear and protects you when a UDF blocks pushdown.'], ['How do you check what was pruned?', "df.explain('formatted'): look for PushedFilters and ReadSchema on the FileScan node."]], why='Reading less data is the first Spark optimisation.')

# Week 2
q(w=2, k='W', lv='Medium', t='Top 3 drivers per city (ties kept)', p='Columns: city_id, driver_id, total, rk. Completed trips only, driver_id not null.',
  start=H + "trips = spark.table('trips')\nw = Window.partitionBy('city_id').orderBy(F.col('total').desc())\nresult = trips\nresult.show()",
  sol=H + "e = spark.table('trips').filter((F.col('status') == 'completed') & F.col('driver_id').isNotNull()).groupBy('city_id', 'driver_id').agg(F.sum('fare').alias('total'))\nw = Window.partitionBy('city_id').orderBy(F.col('total').desc())\nresult = e.withColumn('rk', F.dense_rank().over(w)).filter(F.col('rk') <= 3)",
  h=['Aggregate to one row per driver first.', 'F.dense_rank().over(w) keeps ties.', 'Filter rk <= 3.'], why='Window functions in the DataFrame API.')
q(w=2, k='W', lv='Medium', t='Latest event per trip', p='From trip_events keep only the newest event per trip_id (tie-break event_id). Columns: trip_id, event_type.',
  start=H + "e = spark.table('trip_events')\nresult = e\nresult.show()",
  sol=H + "w = Window.partitionBy('trip_id').orderBy(F.col('event_ts').desc(), F.col('event_id').desc())\nresult = spark.table('trip_events').withColumn('rn', F.row_number().over(w)).filter(F.col('rn') == 1).select('trip_id', 'event_type')",
  h=['row_number per trip, newest first.', 'Two sort keys make it deterministic.', 'Keep rn == 1 and select.'], why='Dedupe to current state, the core of CDC.')
q(w=2, k='W', lv='Medium', t='Running daily revenue', p='Columns: trip_date, day_total, running (both rounded 2), completed trips only.',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "d = spark.table('trips').filter(F.col('status') == 'completed').groupBy('trip_date').agg(F.sum('fare').alias('s'))\nw = Window.orderBy('trip_date').rowsBetween(Window.unboundedPreceding, Window.currentRow)\nresult = d.select('trip_date', F.round('s', 2).alias('day_total'), F.round(F.sum('s').over(w), 2).alias('running'))",
  h=['Aggregate per day first.', 'A window with rowsBetween(unboundedPreceding, currentRow).', 'A window with no partition moves all rows to one task in real Spark; fine for a small daily table.'], why='Running totals and the single-partition warning.')
q(w=2, k='W', lv='Medium', t='Previous trip gap', p='For completed trips: rider_id, trip_id, days_since previous completed trip (null for first).',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "w = Window.partitionBy('rider_id').orderBy('pickup_ts', 'trip_id')\nresult = spark.table('trips').filter(F.col('status') == 'completed').select('rider_id', 'trip_id', F.datediff(F.col('trip_date'), F.lag('trip_date').over(w)).alias('days_since'))",
  h=['F.lag over a window per rider.', 'F.datediff(end, start).', 'The first trip has no previous: null.'], why='LAG features for churn models.')
q(w=2, k='O', lv='Medium', t='Use a window, not a groupBy + join', p='This finds each driver\'s best fare with a groupBy then joins back. Rewrite with one window. Result: driver_id, trip_id, fare for each driver\'s highest-fare trip (ties: lowest trip_id).',
  start=H + "t = spark.table('trips').filter(F.col('driver_id').isNotNull())\nm = t.groupBy('driver_id').agg(F.max('fare').alias('fare'))\nresult = t.join(m, ['driver_id', 'fare']).groupBy('driver_id', 'fare').agg(F.min('trip_id').alias('trip_id')).select('driver_id', 'trip_id', 'fare')",
  sol=H + "w = Window.partitionBy('driver_id').orderBy(F.col('fare').desc(), F.col('trip_id'))\nresult = spark.table('trips').filter(F.col('driver_id').isNotNull()).withColumn('rn', F.row_number().over(w)).filter(F.col('rn') == 1).select('driver_id', 'trip_id', 'fare')",
  avoid=[[r'\.join\(', 'Still joining back. One window pass is enough.']], need=[[r'row_number\(\)', 'Use F.row_number().over(w).']],
  rec=['2 shuffles + a sort-merge join · 4 min', '1 shuffle + sort within partitions · 1.6 min'],
  h=['groupBy + join-back reads and shuffles twice.', 'row_number over a window partitioned by driver.', 'Order by fare desc, then trip_id for ties.'],
  fups=[['Is a window always cheaper?', 'It still shuffles by the partition key and sorts within it. With huge partitions (skewed driver) a window can spill; then a two-step aggregate can be better.'], ['What does spill look like in the Spark UI?', 'Spill (memory) and Spill (disk) columns on the stage; tasks much slower than the median.']], why='Fewer shuffles is the Spark tuning mindset.')

# Week 3 joins, skew
q(w=3, k='W', lv='Medium', t='Find the hot keys', p='Return driver_id and count of trips for the top 3 most frequent driver_id values, including NULL. Columns: driver_id, n.',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "result = spark.table('trips').groupBy('driver_id').agg(F.count('*').alias('n')).orderBy(F.col('n').desc(), F.col('driver_id')).limit(3)", ordered=False,
  h=['groupBy the join key and count.', 'Sort by count descending.', 'NULL is a key too, and often the hottest.'], why='The first command you run when one task is slow.')
q(w=3, k='W', lv='Medium', t='Enrich trips with driver names (left join)', p='Keep all trips. Columns: trip_id, driver_id, name.',
  start=H + "t = spark.table('trips')\nd = spark.table('drivers')\nresult = t\nresult.show()",
  sol=H + "result = spark.table('trips').join(spark.table('drivers').select('driver_id', 'name'), 'driver_id', 'left').select('trip_id', 'driver_id', 'name')",
  h=["how='left' keeps trips without a driver.", 'Select only driver_id and name from drivers first.', 'Then select the output columns.'], why='Left joins and the NULL key problem.')
q(w=3, k='O', lv='Hard', t='Join stuck: one task runs 18 minutes', p='Joining trips to drivers on driver_id has one straggler task. Rewrite so NULL driver_ids skip the join. Result: trip_id, driver_id, name for all trips.',
  start=H + "t = spark.table('trips')\nd = spark.table('drivers').select('driver_id', 'name')\nresult = t.join(d, 'driver_id', 'left').select('trip_id', 'driver_id', 'name')",
  sol=H + "t = spark.table('trips')\nd = spark.table('drivers').select('driver_id', 'name')\nhas = t.filter(F.col('driver_id').isNotNull()).join(d, 'driver_id', 'left').select('trip_id', 'driver_id', 'name')\nnone = t.filter(F.col('driver_id').isNull()).select('trip_id', 'driver_id', F.lit(None).alias('name'))\nresult = has.unionByName(none)",
  need=[[r'isNull\(\)', 'Split out the NULL keys with isNull().'], [r'union', 'Union the NULL rows back with unionByName.']], fixes=True,
  rec=['1 task holds 600 M NULL keys · 19 min', 'even tasks · 1.2 min'],
  h=['Open the Spark UI tab: one bar is huge.', 'NULL never matches in a join, so those rows need no shuffle.', 'Join the non-NULL rows, union the NULL rows back.'],
  fups=[['Why not just broadcast drivers?', 'Broadcast copies the table to every executor. 400 MB is far above the 10 MB default and risks memory errors. Fine for small dimensions only.'], ['What does AQE skew join do?', 'With spark.sql.adaptive.skewJoin.enabled, Spark splits partitions much larger than the median into smaller tasks at runtime. It helps without code changes.'], ['When would you salt?', 'When a real key is hot and cannot be filtered out. Add a random salt to the big side, replicate the small side, join on (key, salt).']], why='Skew is the number one Spark optimisation question.')
q(w=3, k='W', lv='Medium', t='Broadcast a small dimension', p='Join trips to cities using F.broadcast on cities. Columns: trip_id, country.',
  start=H + "t = spark.table('trips')\nc = spark.table('cities')\nresult = t\nresult.show()",
  sol=H + "result = spark.table('trips').join(F.broadcast(spark.table('cities')), 'city_id').select('trip_id', 'country')",
  h=['F.broadcast(df) is a hint.', 'Use it when the dimension fits comfortably in memory.', 'The big side then needs no shuffle.'], why='Broadcast hash join: the cheapest join Spark has.')
q(w=3, k='W', lv='Medium', t='Driver share of city trips', p='Columns: driver_id, city_id, n, pct (1 decimal) of that city\'s completed trips.',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "c = spark.table('trips').filter((F.col('status') == 'completed') & F.col('driver_id').isNotNull()).groupBy('driver_id', 'city_id').agg(F.count('*').alias('n'))\nw = Window.partitionBy('city_id')\nresult = c.withColumn('pct', F.round(F.col('n') * 100.0 / F.sum('n').over(w), 1))",
  h=['Count per driver and city.', 'A window without orderBy gives the partition total.', 'n * 100.0 / total.'], why='Totals with windows avoid a second join.')

# Week 4 modeling
q(w=4, k='W', lv='Medium', t='Daily fact table', p='Columns: trip_date, city_id, trips, completed, revenue (completed fare, rounded 2).',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "s = F.col('status') == 'completed'\nresult = spark.table('trips').groupBy('trip_date', 'city_id').agg(F.count('*').alias('trips'), F.sum(F.when(s, 1).otherwise(0)).alias('completed'), F.round(F.sum(F.when(s, F.col('fare')).otherwise(0)), 2).alias('revenue'))",
  h=['State the grain: one row per day and city.', 'F.sum(F.when(cond, 1).otherwise(0)) for conditional counts.', 'Revenue only for completed trips.'], why='Building a fact table in PySpark.')
q(w=4, k='W', lv='Medium', t='Pivot statuses', p='Columns: city_id, completed, cancelled, no_driver (trip counts).',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "st = F.col('status')\nresult = spark.table('trips').groupBy('city_id').agg(*[F.sum(F.when(st == s, 1).otherwise(0)).alias(s) for s in ['completed', 'cancelled', 'no_driver']])",
  h=['One conditional sum per status.', 'A list comprehension builds the expressions.', 'groupBy().pivot() also exists in real Spark.'], why='Manual pivot that works everywhere.')
q(w=4, k='W', lv='Medium', t='First trip per rider', p='Columns: rider_id, first_trip (min trip_date of completed trips).',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "result = spark.table('trips').filter(F.col('status') == 'completed').groupBy('rider_id').agg(F.min('trip_date').alias('first_trip'))",
  h=['Min per rider.', 'Filter completed first.', 'alias the column.'], why='Activation dimensions.')
q(w=4, k='W', lv='Hard', t='SCD2 initial load', p='From riders build: rider_id, tier, valid_from (= signup_date), valid_to (null date), is_current (true).',
  start=H + "r = spark.table('riders')\nresult = r\nresult.show()",
  sol=H + "result = spark.table('riders').select('rider_id', 'tier', F.col('signup_date').alias('valid_from'), F.lit(None).cast('date').alias('valid_to'), F.lit(True).alias('is_current'))",
  h=['select with aliases.', "F.lit(None).cast('date') gives a typed null.", 'F.lit(True) for the flag.'], why='SCD2 starts with a clean first load.')
q(w=4, k='O', lv='Medium', t='Avoid collecting to the driver', p='This brings every trip to the driver to count by city in Python. Do it in Spark. Result: city_id, n.',
  start=H + "rows = spark.table('trips').collect()\ncounts = {}\nfor r in rows:\n    counts[r.city_id] = counts.get(r.city_id, 0) + 1\nresult = spark.createDataFrame(list(counts.items()), ['city_id', 'n'])",
  sol=H + "result = spark.table('trips').groupBy('city_id').agg(F.count('*').alias('n'))",
  avoid=[[r'\.collect\(\)', 'collect() pulls every row to the driver.'], [r'for\s+\w+\s+in', 'No Python loops over data; let Spark aggregate.']],
  rec=['2 B rows to the driver · OutOfMemoryError', '8 rows to the driver · 35 s'],
  h=['collect() moves all data to one machine.', 'groupBy().agg() runs on the executors.', 'Only the small result comes back.'],
  fups=[['When is collect() fine?', 'When the result is known to be small, like a few hundred rows of a final aggregate. Use limit() or take() to inspect data.'], ['What about toPandas()?', 'Same risk. Turn on Arrow, and only call it on small, aggregated results.']], why='Driver OOM is the most common beginner production failure.')

# Week 5 streaming-style
q(w=5, k='W', lv='Medium', t='Trips per hour', p='Columns: hr (hour of pickup_ts), trips.',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "result = spark.table('trips').groupBy(F.hour('pickup_ts').alias('hr')).agg(F.count('*').alias('trips'))",
  h=['F.hour(col).', 'You can group by an expression with an alias.', 'count per hour.'], why='Time bucketing.')
q(w=5, k='W', lv='Hard', t='Sessionise clicks', p='New session after more than 30 minutes idle. Columns: user_id, session_no, clicks.',
  start=H + "c = spark.table('clicks')\nresult = c\nresult.show()",
  sol=H + "w = Window.partitionBy('user_id').orderBy('ts')\nc = spark.table('clicks').withColumn('gap', F.unix_timestamp('ts') - F.unix_timestamp(F.lag('ts').over(w)))\nc = c.withColumn('new_s', F.when(F.col('gap') > 1800, 1).otherwise(0))\nc = c.withColumn('session_no', F.sum('new_s').over(w.rowsBetween(Window.unboundedPreceding, Window.currentRow)) + 1)\nresult = c.groupBy('user_id', 'session_no').agg(F.count('*').alias('clicks'))",
  h=['Gap to the previous click with lag.', 'Flag gaps over 1,800 seconds.', 'Running sum of flags + 1 = session number.'], why='Sessionisation in batch, the same logic as session windows in streaming.')
q(w=5, k='W', lv='Medium', t='Request-to-complete minutes', p='Columns: trip_id, minutes between requested and completed events (completed trips only).',
  start=H + "e = spark.table('trip_events')\nresult = e\nresult.show()",
  sol=H + "e = spark.table('trip_events')\nreq = e.filter(F.col('event_type') == 'requested').groupBy('trip_id').agg(F.min('event_ts').alias('a'))\ndone = e.filter(F.col('event_type') == 'completed').groupBy('trip_id').agg(F.max('event_ts').alias('b'))\nresult = req.join(done, 'trip_id').select('trip_id', ((F.unix_timestamp('b') - F.unix_timestamp('a')) / 60).cast('int').alias('minutes'))",
  h=['Two aggregates, one per event type.', 'Join them on trip_id.', 'Difference of unix timestamps / 60.'], why='Durations from event streams.')
q(w=5, k='W', lv='Medium', t='Dedupe retried events', p='Remove duplicate events with the same (trip_id, event_type, event_ts). Columns: trip_id, event_type, event_ts.',
  start=H + "e = spark.table('trip_events')\nresult = e\nresult.show()",
  sol=H + "result = spark.table('trip_events').select('trip_id', 'event_type', 'event_ts').dropDuplicates(['trip_id', 'event_type', 'event_ts'])",
  h=['dropDuplicates(subset).', 'Choose the natural key, not event_id.', 'In streaming you also need a watermark to bound state.'], why='Idempotency for at-least-once streams.')
q(w=5, k='O', lv='Medium', t='Avoid a Python UDF', p='This uses a Python UDF to label long trips. Use built-in functions. Result: trip_id, label ("long" if distance_km > 15 else "short").',
  start=H + "def label(km):\n    return 'long' if km > 15 else 'short'\nrows = [(r.trip_id, label(r.distance_km)) for r in spark.table('trips').collect()]\nresult = spark.createDataFrame(rows, ['trip_id', 'label'])",
  sol=H + "result = spark.table('trips').select('trip_id', F.when(F.col('distance_km') > 15, 'long').otherwise('short').alias('label'))",
  avoid=[[r'def\s+\w+\(', 'Replace the Python function with F.when().'], [r'collect\(\)', 'Do not collect.']],
  rec=['Python UDF: rows serialised to Python workers · 11 min', 'built-in expression, code-generated · 50 s'],
  h=['Python UDFs move every row between the JVM and Python.', 'F.when(cond, a).otherwise(b) runs inside Spark.', 'Built-ins also let Catalyst optimise.'],
  fups=[['If you must use Python logic?', 'Use a pandas UDF (vectorised, Arrow) instead of a row-at-a-time UDF.'], ['Why do UDFs block optimisation?', 'Catalyst cannot see inside them, so it cannot push filters through or prune columns used by them.']], why='UDF overhead is a top interview topic.')

# Week 6 CDC and reconciliation
q(w=6, k='W', lv='Medium', t='Completed trips without payment', p='Columns: trip_id, fare.',
  start=H + "t = spark.table('trips')\np = spark.table('payments')\nresult = t\nresult.show()",
  sol=H + "result = spark.table('trips').filter(F.col('status') == 'completed').join(spark.table('payments').select('trip_id'), 'trip_id', 'left_anti').select('trip_id', 'fare')",
  h=['Anti-join trips to payments.', 'Filter completed first.', 'Select the columns.'], why='Reconciliation in Spark.')
q(w=6, k='W', lv='Medium', t='Fare vs payment mismatch', p='Columns: trip_id, fare, amount where abs difference > 0.01.',
  start=H + "t = spark.table('trips')\np = spark.table('payments')\nresult = t\nresult.show()",
  sol=H + "result = spark.table('trips').join(spark.table('payments'), 'trip_id').filter(F.abs(F.col('fare') - F.col('amount')) > 0.01).select('trip_id', 'fare', 'amount')",
  h=['Join on trip_id.', 'F.abs(a - b) > 0.01.', 'Tolerances for floating point.'], why='Money checks need tolerances.')
q(w=6, k='W', lv='Hard', t='Current state from a change log', p='Treat trip_events as a change log. Keep the latest event per trip and return trip_id, event_type as status.',
  start=H + "e = spark.table('trip_events')\nresult = e\nresult.show()",
  sol=H + "w = Window.partitionBy('trip_id').orderBy(F.col('event_ts').desc(), F.col('event_id').desc())\nresult = spark.table('trip_events').withColumn('rn', F.row_number().over(w)).filter('rn = 1').select('trip_id', F.col('event_type').alias('status'))",
  h=['Latest record per key.', 'row_number over a descending window.', 'Rename with alias.'], why='Collapsing CDC into a current-state table before a MERGE.')
q(w=6, k='W', lv='Medium', t='Insert or update?', p='Source: riders signed up since 2026-07-01. Target: riders signed up before 2026-09-01. Columns: rider_id, action ("insert" or "update").',
  start=H + "r = spark.table('riders')\nresult = r\nresult.show()",
  sol=H + "r = spark.table('riders')\nsrc = r.filter(F.col('signup_date') >= '2026-07-01').select('rider_id')\ntgt = r.filter(F.col('signup_date') < '2026-09-01').select(F.col('rider_id').alias('tid'))\nresult = src.join(tgt, F.col('rider_id') == F.col('tid'), 'left').select('rider_id', F.when(F.col('tid').isNull(), 'insert').otherwise('update').alias('action'))",
  h=['Left join source to target.', 'No match means insert.', 'Rename the target key to avoid ambiguity.'], why='What a MERGE decides for each row.')
q(w=6, k='O', lv='Hard', t='Overwrite one partition, not the table', p='The job rewrites the whole table nightly. Compute only 2026-10-21. Result: city_id, trip_date, revenue (rounded 2), completed trips.',
  start=H + "d = spark.table('trips').filter(F.col('status') == 'completed').groupBy('city_id', 'trip_date').agg(F.round(F.sum('fare'), 2).alias('revenue'))\nresult = d.filter(F.col('trip_date') == '2026-10-21')",
  sol=H + "result = spark.table('trips').filter((F.col('status') == 'completed') & (F.col('trip_date') == '2026-10-21')).groupBy('city_id', 'trip_date').agg(F.round(F.sum('fare'), 2).alias('revenue'))",
  need=[[r"trip_date'\)\s*==\s*'2026-10-21'\)\)?\s*\.groupBy|&\s*\(F\.col\('trip_date'\)", 'Filter trip_date before groupBy so only one partition is read.']],
  rec=['aggregates 730 days · overwrite 730 partitions · 25 min', 'reads and overwrites 1 partition · 30 s'],
  h=['Filter on the partition column first.', "Write with mode('overwrite') and partitionOverwriteMode=dynamic so only that day is replaced.", 'Rerunning the day gives the same result: idempotent.'],
  fups=[['What is dynamic partition overwrite?', "spark.sql.sources.partitionOverwriteMode=dynamic replaces only the partitions present in the output, instead of truncating the whole table."], ['How would Delta do it?', "replaceWhere: df.write.format('delta').option('replaceWhere', \"trip_date = '2026-10-21'\").mode('overwrite')."]], why='Idempotent partition overwrites are the backbone of batch pipelines.')

# Week 7 cost and layout
q(w=7, k='W', lv='Medium', t='Fare per km by city', p='Columns: city_id, fare_per_km = sum(fare)/sum(distance_km) rounded 2, completed trips.',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "result = spark.table('trips').filter(F.col('status') == 'completed').groupBy('city_id').agg(F.round(F.sum('fare') / F.sum('distance_km'), 2).alias('fare_per_km'))",
  h=['Ratio of sums.', 'Not the average of per-trip ratios.', 'Round at the end.'], why='Correct ratio metrics.')
q(w=7, k='W', lv='Medium', t='Weekly active riders', p="Columns: week (date_trunc('week', trip_date)), riders (distinct completed riders).",
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "result = spark.table('trips').filter(F.col('status') == 'completed').groupBy(F.date_trunc('week', 'trip_date').alias('week')).agg(F.countDistinct('rider_id').alias('riders'))",
  h=["F.date_trunc('week', col).", 'countDistinct riders.', 'Group by the truncated date.'], why='WAU in PySpark.')
q(w=7, k='W', lv='Medium', t='Long trip share', p='Columns: city_id, pct_long (percent of completed trips over 15 km, 1 decimal).',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "result = spark.table('trips').filter(F.col('status') == 'completed').groupBy('city_id').agg(F.round(F.avg(F.when(F.col('distance_km') > 15, 1).otherwise(0)) * 100, 1).alias('pct_long'))",
  h=['Average of a 0/1 flag.', 'F.when(...).otherwise(0).', 'Times 100, round 1.'], why='Shares in one pass.')
q(w=7, k='W', lv='Medium', t='Busiest day per city', p='Columns: city_id, trip_date, n for the day with most trips (keep ties).',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "c = spark.table('trips').groupBy('city_id', 'trip_date').agg(F.count('*').alias('n'))\nw = Window.partitionBy('city_id').orderBy(F.col('n').desc())\nresult = c.withColumn('rk', F.rank().over(w)).filter('rk = 1').select('city_id', 'trip_date', 'n')",
  h=['Count per city and day.', 'rank() per city.', 'Keep rank 1.'], why='Argmax per group.')
q(w=7, k='O', lv='Medium', t='Cache only what you reuse', p='The job re-reads and re-filters trips three times. Filter once, cache, reuse. Result: one row with completed and cancelled_pct (1 decimal) for city 1.',
  start=H + "n = spark.table('trips').filter(F.col('city_id') == 1).filter(F.col('status') == 'completed').count()\nc = spark.table('trips').filter(F.col('city_id') == 1).filter(F.col('status') == 'cancelled').count()\na = spark.table('trips').filter(F.col('city_id') == 1).count()\nresult = spark.createDataFrame([(n, round(100.0 * c / a, 1))], ['completed', 'cancelled_pct'])",
  sol=H + "t = spark.table('trips').filter(F.col('city_id') == 1)\nresult = t.agg(F.sum(F.when(F.col('status') == 'completed', 1).otherwise(0)).alias('completed'), F.round(F.avg(F.when(F.col('status') == 'cancelled', 1).otherwise(0)) * 100, 1).alias('cancelled_pct'))",
  avoid=[[r'\.count\(\)', 'Each count() is a separate job. Compute all metrics in one agg().']],
  rec=['3 jobs · 3 full reads · 2.5 min', '1 job · 1 read · 50 s'],
  h=['Every action (count) triggers a full job.', 'One agg() with several conditional expressions.', 'cache() helps only when you reuse a DataFrame across several actions.'],
  fups=[['When does cache() hurt?', 'When the data is used once, or is huge and evicts other blocks. It costs memory and a full materialisation.'], ['cache vs persist?', 'cache() is persist(MEMORY_AND_DISK) for DataFrames. persist lets you choose the storage level.']], why='Understanding actions vs transformations.')

# Week 8 lakehouse
q(w=8, k='W', lv='Medium', t='Upsert source batch', p="Columns: rider_id, name, tier for riders with signup_date >= '2026-07-01'.",
  start=H + "r = spark.table('riders')\nresult = r\nresult.show()",
  sol=H + "result = spark.table('riders').filter(F.col('signup_date') >= '2026-07-01').select('rider_id', 'name', 'tier')",
  h=['Filter on the change column.', 'Select the MERGE columns.', 'Dedupe the batch before a real MERGE.'], why='The USING side of a MERGE.')
q(w=8, k='W', lv='Medium', t='Partition size check', p='Columns: trip_date, n, pct (1 decimal) of all rows.',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "c = spark.table('trips').groupBy('trip_date').agg(F.count('*').alias('n'))\nresult = c.withColumn('pct', F.round(F.col('n') * 100.0 / F.sum('n').over(Window.partitionBy()), 1))",
  h=['Count per partition value.', 'An empty partitionBy() window gives the grand total.', 'Spot skewed partitions.'], why='Checking layout before choosing partition columns.')
q(w=8, k='W', lv='Hard', t='Snapshot diff', p="Yesterday: drivers rating >= 4.5. Today: drivers joined before 2025-06-01. Columns: driver_id, change ('added' or 'removed').",
  start=H + "d = spark.table('drivers')\nresult = d\nresult.show()",
  sol=H + "d = spark.table('drivers')\ny = d.filter(F.col('rating') >= 4.5).select('driver_id')\nt = d.filter(F.col('joined_on') < '2025-06-01').select('driver_id')\nresult = t.join(y, 'driver_id', 'left_anti').withColumn('change', F.lit('added')).unionByName(y.join(t, 'driver_id', 'left_anti').withColumn('change', F.lit('removed')))",
  h=['Two anti-joins.', 'In today but not yesterday: added.', 'In yesterday but not today: removed.'], why='CDC by snapshot comparison.')
q(w=8, k='W', lv='Medium', t='Latest rating per city', p='Columns: city_id, best_driver (name of the highest-rated driver; tie: lowest driver_id), rating.',
  start=H + "d = spark.table('drivers')\nresult = d\nresult.show()",
  sol=H + "w = Window.partitionBy('city_id').orderBy(F.col('rating').desc(), F.col('driver_id'))\nresult = spark.table('drivers').withColumn('rn', F.row_number().over(w)).filter('rn = 1').select('city_id', F.col('name').alias('best_driver'), 'rating')",
  h=['row_number per city.', 'Two sort keys for ties.', 'Rename name.'], why='Deterministic winners for serving tables.')
q(w=8, k='O', lv='Hard', t='Too many small output files', p='This writes one file per row group. Reduce to a few files per date by repartitioning on trip_date before writing. Result: the same rows (trip_id, trip_date) as a DataFrame named result.',
  start=H + "t = spark.table('trips').select('trip_id', 'trip_date')\nresult = t.repartition(2000)\nresult.write.mode('overwrite').parquet('s3://lake/trips_small')",
  sol=H + "result = spark.table('trips').select('trip_id', 'trip_date').repartition('trip_date')\nresult.write.mode('overwrite').parquet('s3://lake/trips_small')",
  avoid=[[r'repartition\(\s*2000', '2,000 partitions × each date writes up to 2,000 tiny files per day.']], need=[[r"repartition\(\s*'trip_date'|repartition\(\s*F\.col\('trip_date'\)", "repartition('trip_date') groups each day into one task."]],
  rec=['2.8 M files of 40 KB · reads take 12 min', '730 files of ~150 MB · reads take 40 s'],
  h=['Each task writes its own file for each partition value it sees.', 'repartition by the output partition column first.', 'Target files of 128 MB to 1 GB.'],
  fups=[['How do you fix small files already written?', 'Compaction: Delta OPTIMIZE, Iceberg rewrite_data_files, or a Spark job that reads and rewrites a partition with fewer files.'], ['Why are small files slow?', 'Each file costs a list call, an open, and footer reads; planning time and S3 request costs explode.']], why='Small files are the most common lake performance problem.')

# Week 9 data quality
q(w=9, k='W', lv='Easy', t='Null rates', p='One row: null_driver_pct, null_rider_pct (1 decimal).',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "result = spark.table('trips').agg(F.round(F.avg(F.when(F.col('driver_id').isNull(), 1).otherwise(0)) * 100, 1).alias('null_driver_pct'), F.round(F.avg(F.when(F.col('rider_id').isNull(), 1).otherwise(0)) * 100, 1).alias('null_rider_pct'))",
  h=['Average of an is-null flag.', 'Several metrics in one agg().', 'Round 1.'], why='Profiling in one pass.')
q(w=9, k='W', lv='Medium', t='Orphan driver ids', p='Columns: trip_id, driver_id for trips whose non-null driver_id is missing from drivers.',
  start=H + "t = spark.table('trips')\nd = spark.table('drivers')\nresult = t\nresult.show()",
  sol=H + "result = spark.table('trips').filter(F.col('driver_id').isNotNull()).join(spark.table('drivers').select('driver_id'), 'driver_id', 'left_anti').select('trip_id', 'driver_id')",
  h=['Anti-join to the dimension.', 'Exclude real nulls.', 'Empty result = pass.'], why='Referential integrity at scale.')
q(w=9, k='W', lv='Medium', empty=True, t='Duplicate keys check', p='Columns: trip_id, n for trip_ids that appear more than once in trips (expect none).',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "result = spark.table('trips').groupBy('trip_id').agg(F.count('*').alias('n')).filter(F.col('n') > 1)",
  h=['Group by the key.', 'Keep counts over 1.', 'An empty result is good news.'], why='Primary-key tests in data contracts.')
q(w=9, k='W', lv='Medium', t='Rule violations with reasons', p="Columns: trip_id, reason for completed trips with fare <= 0 ('bad fare') or distance_km > 100 ('bad distance').",
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "t = spark.table('trips').filter(F.col('status') == 'completed')\nresult = t.filter((F.col('fare') <= 0) | (F.col('distance_km') > 100)).select('trip_id', F.when(F.col('fare') <= 0, 'bad fare').otherwise('bad distance').alias('reason'))",
  h=['Combine rules with |, in brackets.', 'Label with when/otherwise.', 'Expect zero rows on clean data.'], why='Explaining failures, not just counting them.')
q(w=9, k='O', lv='Medium', t='One pass for all checks', p='Four separate jobs each scan trips. Return one row: total, null_driver, cancelled, riders (distinct).',
  start=H + "t = spark.table('trips')\ntotal = t.count()\nnd = t.filter(F.col('driver_id').isNull()).count()\ncx = t.filter(F.col('status') == 'cancelled').count()\nrd = t.select('rider_id').distinct().count()\nresult = spark.createDataFrame([(total, nd, cx, rd)], ['total', 'null_driver', 'cancelled', 'riders'])",
  sol=H + "t = spark.table('trips')\nresult = t.agg(F.count('*').alias('total'), F.sum(F.when(F.col('driver_id').isNull(), 1).otherwise(0)).alias('null_driver'), F.sum(F.when(F.col('status') == 'cancelled', 1).otherwise(0)).alias('cancelled'), F.countDistinct('rider_id').alias('riders'))",
  avoid=[[r'\.count\(\)', 'Each count() is a separate Spark job.']],
  rec=['4 jobs · 4 scans · 2.7 min', '1 job · 1 scan · 45 s'],
  h=['Actions trigger jobs.', 'Put every metric in one agg().', 'Conditional sums for the filtered counts.'],
  fups=[['How do you run checks without slowing the pipeline?', 'Compute metrics in the same pass as the write (or from table stats), and block only on hard failures.'], ['Where do results go?', 'A checks table with run_id, rule, value and status, which feeds alerts and a dashboard.']], why='Cheap checks are checks that stay on.')

# Week 10 serving
q(w=10, k='W', lv='Medium', t='Percentile fares', p='Columns: city_id, p50 (median completed fare, rounded 2).',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "result = spark.table('trips').filter(F.col('status') == 'completed').groupBy('city_id').agg(F.round(F.expr('quantile_cont(fare, 0.5)'), 2).alias('p50'))",
  h=['Spark has percentile_approx; the practice engine accepts F.expr with quantile_cont.', 'Group by city.', 'Round 2.'], why='Percentiles for SLOs.')
q(w=10, k='W', lv='Medium', t='Leaderboard', p='Top 10 drivers by completed trips: driver_id, name, trips. Ties: driver_id ascending.',
  start=H + "t = spark.table('trips')\nd = spark.table('drivers')\nresult = t\nresult.show()",
  sol=H + "c = spark.table('trips').filter(F.col('status') == 'completed').groupBy('driver_id').agg(F.count('*').alias('trips'))\nresult = c.join(spark.table('drivers').select('driver_id', 'name'), 'driver_id').orderBy(F.col('trips').desc(), F.col('driver_id')).limit(10)", ordered=True,
  h=['Aggregate, then join the small result.', 'Deterministic order.', 'limit(10).'], why='Aggregate before joining for serving queries.')
q(w=10, k='W', lv='Hard', t='Route pairs', p='Columns: from_city, to_city, trips for the top 5 (rider home city → trip city) pairs by completed trips; ties by names.',
  start=H + "t = spark.table('trips')\nr = spark.table('riders')\nc = spark.table('cities')\nresult = t\nresult.show()",
  sol=H + "c = spark.table('cities')\nt = spark.table('trips').filter(F.col('status') == 'completed').select('rider_id', F.col('city_id').alias('to_id'))\nr = spark.table('riders').select('rider_id', F.col('city_id').alias('from_id'))\nj = t.join(r, 'rider_id')\nj = j.join(c.select(F.col('city_id').alias('from_id'), F.col('city_name').alias('from_city')), 'from_id')\nj = j.join(c.select(F.col('city_id').alias('to_id'), F.col('city_name').alias('to_city')), 'to_id')\nresult = j.groupBy('from_city', 'to_city').agg(F.count('*').alias('trips')).orderBy(F.col('trips').desc(), 'from_city', 'to_city').limit(5)", ordered=True,
  h=['Rename keys before joining the same table twice.', 'Join cities once as from, once as to.', 'Sort, then limit.'], why='Role-playing dimensions in Spark.')
q(w=10, k='W', lv='Medium', t='Daily summary for a dashboard', p='Columns: trip_date, city_id, completed, revenue (rounded 2).',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "result = spark.table('trips').filter(F.col('status') == 'completed').groupBy('trip_date', 'city_id').agg(F.count('*').alias('completed'), F.round(F.sum('fare'), 2).alias('revenue'))",
  h=['The grain the tile needs.', 'Filter, group, aggregate.', 'Materialise and serve from it.'], why='Precomputed serving tables.')
q(w=10, k='O', lv='Medium', t='Avoid a wide orderBy on everything', p='This sorts 2 B rows to take the top 10. Use an aggregate first. Result: top 10 cities by completed trips: city_id, n.',
  start=H + "t = spark.table('trips').filter(F.col('status') == 'completed')\nrows = t.orderBy('city_id').collect()\nfrom collections import Counter\ncnt = Counter(r.city_id for r in rows)\nresult = spark.createDataFrame(cnt.most_common(10), ['city_id', 'n'])",
  sol=H + "result = spark.table('trips').filter(F.col('status') == 'completed').groupBy('city_id').agg(F.count('*').alias('n')).orderBy(F.col('n').desc()).limit(10)",
  avoid=[[r'collect\(\)', 'Do not collect 2 B rows.'], [r'Counter', 'Count in Spark, not in Python.']],
  rec=['global sort of 2 B rows + collect · fails', 'aggregate to 8 rows, sort 8 rows · 30 s'],
  h=['Reduce first, then sort the small result.', 'groupBy + count, then orderBy + limit.', 'Spark turns orderBy + limit into an efficient TakeOrdered.'],
  fups=[['What is TakeOrderedAndProject?', 'Spark plans orderBy().limit(n) as a top-N per partition plus a final merge, avoiding a full global sort.'], ['When do you need a global sort?', 'When writing sorted output for clustering or range partitioning; it costs a range-partition shuffle.']], why='Order of operations decides cost.')

# Week 11 product
q(w=11, k='W', lv='Medium', t='Funnel counts', p='One row: requested, assigned, completed (distinct trips at each stage, from trip_events).',
  start=H + "e = spark.table('trip_events')\nresult = e\nresult.show()",
  sol=H + "e = spark.table('trip_events')\nresult = e.agg(*[F.countDistinct(F.when(F.col('event_type') == s, F.col('trip_id'))).alias(a) for s, a in [('requested', 'requested'), ('driver_assigned', 'assigned'), ('completed', 'completed')]])",
  h=['countDistinct of a conditional column.', 'F.when without otherwise gives null, which is not counted.', 'One agg with three expressions.'], why='Funnels for product teams.')
q(w=11, k='W', lv='Hard', t='Week-1 retention by cohort', p="Riders signed up in 2026. Columns: cohort (date_trunc month of signup_date), pct_week1 (percent with a completed trip within 7 days, 1 decimal).",
  start=H + "r = spark.table('riders')\nt = spark.table('trips')\nresult = r\nresult.show()",
  sol=H + "r = spark.table('riders').filter(F.col('signup_date') >= '2026-01-01')\nt = spark.table('trips').filter(F.col('status') == 'completed').select('rider_id', 'trip_date')\nj = r.join(t, 'rider_id', 'left').withColumn('ok', F.when((F.col('trip_date') >= F.col('signup_date')) & (F.col('trip_date') <= F.date_add(F.col('signup_date'), 7)), F.col('rider_id')))\nresult = j.groupBy(F.date_trunc('month', 'signup_date').alias('cohort')).agg(F.round(F.countDistinct('ok') * 100.0 / F.countDistinct('rider_id'), 1).alias('pct_week1'))",
  h=['Left join trips to riders.', 'Mark rider_id only when the trip is within 7 days.', 'countDistinct(marked) / countDistinct(all).'], why='Cohort retention in Spark.')
q(w=11, k='W', lv='Medium', t='Tier comparison', p='Columns: tier, riders, trips_per_rider (2 decimals).',
  start=H + "r = spark.table('riders')\nt = spark.table('trips')\nresult = r\nresult.show()",
  sol=H + "t = spark.table('trips').filter(F.col('status') == 'completed').select('rider_id', 'trip_id')\nj = spark.table('riders').join(t, 'rider_id', 'left')\nresult = j.groupBy('tier').agg(F.countDistinct('rider_id').alias('riders'), F.round(F.count('trip_id') / F.countDistinct('rider_id'), 2).alias('trips_per_rider'))",
  h=['Every rider in the denominator: left join.', 'count(trip_id) skips nulls.', 'Divide, round.'], why='Per-unit metrics for experiments.')
q(w=11, k='W', lv='Medium', t='Cancellation rate by hour', p='Columns: hr, cancel_pct (1 decimal) for hours with at least 20 trips.',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "result = spark.table('trips').groupBy(F.hour('pickup_ts').alias('hr')).agg(F.count('*').alias('n'), F.round(F.avg(F.when(F.col('status') == 'cancelled', 1).otherwise(0)) * 100, 1).alias('cancel_pct')).filter(F.col('n') >= 20).select('hr', 'cancel_pct')",
  h=['Group by hour.', 'Rate = avg of a flag.', 'Filter small groups after aggregating.'], why='Honest metrics with minimum sample sizes.')
q(w=11, k='O', lv='Medium', t='Approximate distinct counts', p='Exact distinct riders per day is slow on 6 B events. Use approx_count_distinct. Columns: event_date, dau.',
  start=H + "result = spark.table('trip_events').groupBy('event_date').agg(F.countDistinct('rider_id').alias('dau'))",
  sol=H + "result = spark.table('trip_events').groupBy('event_date').agg(F.approx_count_distinct('rider_id').alias('dau'))",
  need=[[r'approx_count_distinct', 'Use F.approx_count_distinct (HyperLogLog++).']], approx=True,
  rec=['exact: shuffles every rider id · 7 min', 'HLL++: ~2% error · 40 s'],
  h=['Exact distinct needs every id in one place per group.', 'HyperLogLog keeps a tiny sketch.', 'Use rsd to trade accuracy for memory.'],
  fups=[['Can you combine daily sketches into weekly?', 'Not with approx_count_distinct output (a number). Store sketches (e.g. Spark 3.5 hll_sketch_agg, or Datasketches) and merge them.'], ['When must you stay exact?', 'Billing, payouts and anything audited.']], why='Approximation is an architect trade-off.')

# Week 12 mixed
q(w=12, k='W', lv='Hard', t='Longest active streak', p='Columns: rider_id, longest (consecutive days with a completed trip).',
  start=H + "t = spark.table('trips')\nresult = t\nresult.show()",
  sol=H + "d = spark.table('trips').filter(F.col('status') == 'completed').select('rider_id', 'trip_date').distinct()\nw = Window.partitionBy('rider_id').orderBy('trip_date')\ng = d.withColumn('grp', F.col('trip_date') - F.expr('CAST(row_number() OVER (PARTITION BY rider_id ORDER BY trip_date) AS INT)'))\nresult = g.groupBy('rider_id', 'grp').agg(F.count('*').alias('n')).groupBy('rider_id').agg(F.max('n').alias('longest'))",
  h=['Distinct days.', 'date minus row_number is constant inside a streak.', 'Count per group, max per rider.'], why='Gaps and islands in PySpark.')
q(w=12, k='W', lv='Medium', t='Second highest salary per dept', p='Columns: dept, second (null if none).',
  start=H + "e = spark.table('employees')\nresult = e\nresult.show()",
  sol=H + "w = Window.partitionBy('dept').orderBy(F.col('salary').desc())\nr = spark.table('employees').withColumn('rk', F.dense_rank().over(w))\nresult = r.groupBy('dept').agg(F.max(F.when(F.col('rk') == 2, F.col('salary'))).alias('second'))",
  h=['dense_rank per dept.', 'max(when(rk == 2, salary)) keeps departments with no second.', 'Null when missing.'], why='Edge cases in ranking.')
q(w=12, k='W', lv='Medium', t='Payment mix per city', p='Columns: city_id, method, pct (1 decimal) of that city\'s payments.',
  start=H + "p = spark.table('payments')\nt = spark.table('trips')\nresult = p\nresult.show()",
  sol=H + "j = spark.table('payments').join(spark.table('trips').select('trip_id', 'city_id'), 'trip_id')\nc = j.groupBy('city_id', 'method').agg(F.count('*').alias('n'))\nresult = c.withColumn('pct', F.round(F.col('n') * 100.0 / F.sum('n').over(Window.partitionBy('city_id')), 1)).select('city_id', 'method', 'pct')",
  h=['Join to get city.', 'Count per city and method.', 'Share with a window.'], why='Share-of-total per group.')
q(w=12, k='W', lv='Medium', t='Org depth (iterative)', p='Columns: emp_id, depth (0 for the top boss). Loop joins until no new rows (graphs need iteration in Spark).',
  start=H + "e = spark.table('employees')\nresult = e\nresult.show()",
  sol=H + "e = spark.table('employees')\nlevel = e.filter(F.col('manager_id').isNull()).select('emp_id', F.lit(0).alias('depth'))\nresult = level\nd = 0\nwhile True:\n    d += 1\n    nxt = e.join(level.select(F.col('emp_id').alias('manager_id')), 'manager_id').select('emp_id', F.lit(d).alias('depth'))\n    if nxt.count() == 0:\n        break\n    result = result.unionByName(nxt)\n    level = nxt",
  h=['Start from the people with no manager.', 'Each loop joins the next level.', 'Stop when a level is empty.'], why='Iterative algorithms in Spark (no recursive CTE in DataFrames).')
q(w=12, k='O', lv='Hard', t='Timed mock: three problems', p='Fix: a Python loop over collect(), a UDF and a needless join to trip_events. Result: city_id, revenue (completed fare, rounded 2).',
  start=H + "def ok(s):\n    return s == 'completed'\nrows = spark.table('trips').join(spark.table('trip_events').select('trip_id'), 'trip_id').collect()\nrev = {}\nseen = set()\nfor r in rows:\n    if ok(r.status) and r.trip_id not in seen:\n        seen.add(r.trip_id)\n        rev[r.city_id] = rev.get(r.city_id, 0) + r.fare\nresult = spark.createDataFrame([(k, round(v, 2)) for k, v in rev.items()], ['city_id', 'revenue'])",
  sol=H + "result = spark.table('trips').filter(F.col('status') == 'completed').groupBy('city_id').agg(F.round(F.sum('fare'), 2).alias('revenue'))",
  avoid=[[r'collect\(\)', 'No collect().'], [r'def\s+\w+\(', 'No Python UDF/function on rows.'], [r'trip_events', 'trip_events is not needed.']],
  rec=['join 12 B rows, collect, Python loop · fails', '1 scan, 1 aggregate · 40 s'],
  h=['Find all three problems before writing code.', 'Everything the loop does is one groupBy.', 'Status is already on trips.'],
  fups=[['How would you present this fix?', 'Before and after (fails vs 40 s), the three causes in one line each, and proof the numbers match the old output on a sample.'], ['What would you monitor after?', 'Job duration, input rows vs output rows, and a revenue reconciliation against payments.']], why='Mocks combine several smells in one job.')

# ---------- Platform 1: read Scala, write PySpark (module j01) ----------
q(m='j01', k='W', lv='Easy', t='Translate Scala: revenue per city', p='A teammate\'s Scala job:\n\n```scala\nval result = spark.table("trips")\n  .filter($"status" === "completed")\n  .groupBy($"city_id")\n  .agg(round(sum($"fare"), 2).as("revenue"))\n```\n\nWrite the same job in PySpark. Columns: `city_id, revenue`.',
  start=H + "result = spark.table('trips')\nresult.show()",
  sol=H + "result = spark.table('trips').filter(F.col('status') == 'completed').groupBy('city_id').agg(F.round(F.sum('fare'), 2).alias('revenue'))",
  h=['$"col" in Scala is F.col("col") in Python.', 'Scala compares columns with ===; Python uses ==.', '.as("x") in Scala is .alias("x") in Python.'],
  why='Most Spark and Flink code in big companies is Scala or Java; you must be able to read it in a code review.')
q(m='j01', k='W', lv='Medium', t='Translate Scala: when/otherwise bands', p='Scala:\n\n```scala\nval banded = spark.table("trips")\n  .filter($"status" === "completed")\n  .withColumn("band",\n    when($"distance_km" < 5, "short")\n      .when($"distance_km" < 15, "medium")\n      .otherwise("long"))\nval result = banded.groupBy("band").agg(count(lit(1)).as("trips"))\n```\n\nWrite it in PySpark. Columns: `band, trips`.',
  start=H + "result = spark.table('trips')\nresult.show()",
  sol=H + "banded = spark.table('trips').filter(F.col('status') == 'completed').withColumn('band', F.when(F.col('distance_km') < 5, 'short').when(F.col('distance_km') < 15, 'medium').otherwise('long'))\nresult = banded.groupBy('band').agg(F.count(F.lit(1)).alias('trips'))",
  h=['when(...).when(...).otherwise(...) chains the same way in both languages.', 'Scala\'s val is just a name binding, like Python assignment.', 'count(lit(1)) counts rows: F.count(F.lit(1)).'],
  why='Translating between the two APIs shows you understand Spark, not one language\'s syntax.')
q(m='j01', k='W', lv='Medium', t='Translate Scala: minutes since the driver\'s previous trip', p='Scala:\n\n```scala\nimport org.apache.spark.sql.expressions.Window\nval w = Window.partitionBy("driver_id").orderBy("pickup_ts")\nval result = spark.table("trips")\n  .filter($"driver_id".isNotNull && $"status" === "completed")\n  .withColumn("prev_ts", lag($"pickup_ts", 1).over(w))\n  .withColumn("gap_min",\n    (unix_timestamp($"pickup_ts") - unix_timestamp($"prev_ts")) / 60)\n  .select("trip_id", "driver_id", "gap_min")\n```\n\nWrite it in PySpark. Columns: `trip_id, driver_id, gap_min` (NULL for a driver\'s first trip).',
  start=H + "result = spark.table('trips')\nresult.show()",
  sol=H + "w = Window.partitionBy('driver_id').orderBy('pickup_ts')\nresult = (spark.table('trips')\n  .filter(F.col('driver_id').isNotNull() & (F.col('status') == 'completed'))\n  .withColumn('prev_ts', F.lag('pickup_ts', 1).over(w))\n  .withColumn('gap_min', (F.unix_timestamp('pickup_ts') - F.unix_timestamp('prev_ts')) / 60)\n  .select('trip_id', 'driver_id', 'gap_min'))",
  h=['Window.partitionBy(...).orderBy(...) is identical in Python.', 'Scala && is Python &, and each side needs brackets in Python.', 'isNotNull in Scala has no brackets; in Python it is isNotNull().'],
  why='Window functions in Scala jobs are a common code-review and debugging task on JVM-heavy teams.')
