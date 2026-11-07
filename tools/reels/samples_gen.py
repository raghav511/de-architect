# One-off: writes a sample reel on the hardest topic of each module into tools/reels/r_<mid>.py (appending if the file exists).
import os
S = {}
def R(mid, sec, title, beats, check, work): S.setdefault(mid, []).append({'sec': sec, 'title': title, 'beats': [{'say': s, 'show': w} for s, w in beats], 'check': check, 'work': work})
B = lambda text, sub='': {'t': 'big', 'text': text, 'sub': sub}
P = lambda *i: {'t': 'points', 'items': list(i)}
F = lambda *i, note='': {'t': 'flow', 'items': list(i), 'note': note}
C = lambda code: {'t': 'code', 'text': code}
BAR = lambda unit, *i: {'t': 'bars', 'unit': unit, 'items': [list(x) for x in i]}
K = lambda q, opts, ans, why: {'q': q, 'opts': opts, 'ans': ans, 'why': why}

R('a01', 'A1.4', 'Context engineering: what the model sees', [
 ('Your agent did great for ten steps, then started forgetting the task and repeating itself. The model did not get worse. Its context did.', B('Step 11: the agent forgets', 'the context filled up')),
 ('Every turn, the model only sees what you put in its window: instructions, tool results, history. Dump a 20,000 line log into it and the important lines are buried, the bill goes up, and older instructions get pushed out or ignored.', P('Instructions', 'Tool results', 'History', 'All compete for one window')),
 ('Context engineering means choosing what goes in: summarise old turns, return only the 30 relevant log lines from a tool, and keep the goal and rules pinned at the top.', P('Summarise old turns', 'Tools return the minimum', 'Pin the goal and rules'))],
 K('An agent gets worse after many steps. What do you fix first?', ['Switch to a bigger model', 'What goes into its context each turn', 'Add more tools'], 1, 'Bloated context hides the goal and the key facts; trim tool output and summarise history.'),
 ['Make tools return a short, structured result instead of raw dumps', 'Log tokens per turn and alert when context grows past a budget'])
R('p03', 'P3.2', 'Generators: functions that pause', [
 ('How do you process a 50 gigabyte file on a laptop with 8 gigabytes of memory? You never hold more than one record at a time. Generators make that easy.', B('50 GB file, 8 GB laptop', 'one record at a time')),
 ('A function with yield does not run when you call it. It returns a generator. Each time the loop asks for the next value, it runs until the next yield, hands back one value, and pauses right there, keeping its local variables.', C('def read_trips(path):\n    with open(path) as f:\n        for line in f:\n            yield parse(line)   # pause here')),
 ('So memory stays flat whatever the file size. The catch: a generator is used once. Loop over it a second time and you get nothing.', P('Lazy: one value at a time', 'Memory stays flat', 'Used once: second loop is empty'))],
 K('You loop over the same generator twice. What does the second loop see?', ['The same values again', 'Nothing', 'An error'], 1, 'A generator is exhausted after one pass; make a new one or store a list if it is small.'),
 ['Read big inputs with generators that yield parsed records', 'Never pass a generator to two consumers; create one per pass'])
R('p04', 'P4.6', 'Composition over inheritance', [
 ('You have a CSV loader and a Parquet loader. Then someone needs Parquet with retries, and CSV from S3 with retries. With inheritance you end up with a class for every combination.', B('ParquetRetryS3Loader', 'one class per combination')),
 ('Inheritance says a thing is a kind of another thing, and it locks behaviour in at design time. Composition says a thing has parts: a loader holds a reader, a source and a retry policy, each a small object you can swap.', F('Loader', 'has a reader (CSV, Parquet)', 'has a source (local, S3)', 'has a retry policy')),
 ('Three readers, three sources and two policies are eight small pieces, not eighteen classes. And each piece is easy to test alone.', BAR('classes to write', ['Inheritance: every combination', 18, ''], ['Composition: the parts', 8, '']))],
 K('Why does composition scale better than inheritance for loaders?', ['It runs faster', 'Parts combine freely instead of needing a class per combination', 'Python does not support inheritance'], 1, 'You assemble behaviour from swappable parts rather than encoding every mix in a class tree.'),
 ['Pass collaborators (reader, client, policy) into a class instead of subclassing', 'Use inheritance only for a true is-a relationship with shared behaviour'])
R('a02', 'A2.2', 'Graders that do not lie', [
 ('Your agent scores 95 percent on your evals, then fails on real tickets. Often the grader is the problem, not the agent.', B('95% on evals', 'and failing in production')),
 ('A grader that checks for keywords passes an answer that mentions the right table but gives the wrong number. A model grader asked is this good tends to say yes, especially to long, confident answers.', P('Keyword checks pass wrong answers', 'Model graders are too generous', 'Length looks like quality')),
 ('Honest graders check the outcome: run the SQL and compare the result, give the model grader a rubric with failing examples, and check the grader itself on cases you labelled by hand.', P('Check the result, not the wording', 'Rubric plus bad examples', 'Test the grader against human labels'))],
 K('What is the strongest grader for a text-to-SQL agent?', ['Check the SQL mentions the right tables', 'Run the SQL and compare its result with the expected result', 'Ask a model if the SQL looks good'], 1, 'Execution checks the outcome, which keywords and impressions cannot.'),
 ['Label 20 real cases by hand and measure how often your grader agrees', 'Prefer executable checks wherever the task has a checkable result'])
R('p05', 'P5.3', 'Context managers: cleanup you cannot forget', [
 ('A job opens a database connection, fails halfway, and the connection stays open. Run it a hundred times and the database refuses new connections.', B('Too many connections', 'a cleanup that never ran')),
 ('A with block guarantees the cleanup. Python calls enter at the start and exit at the end, and exit runs even when an exception flies out of the block. Files close, locks release, transactions roll back.', F('with conn:', 'enter: open', 'your code (may fail)', 'exit: always closes')),
 ('You can write your own with contextmanager: code before yield is the setup, code after yield, in a finally, is the cleanup.', C('@contextmanager\ndef connection():\n    c = connect()\n    try:\n        yield c\n    finally:\n        c.close()'))],
 K('An exception is raised inside a with block. Does the cleanup run?', ['No, the exception skips it', 'Yes, exit always runs', 'Only if you catch the exception'], 1, 'That guarantee is the reason to use with for every resource.'),
 ['Open files, connections and locks only with "with"', 'Wrap temporary changes (env vars, working directory) in a small context manager'])
R('p06', 'P6.2', 'Threads and the GIL', [
 ('You add eight threads to a CPU-heavy Python job and it gets no faster, sometimes slower. Yet eight threads make your API ingestion eight times faster. Why both?', BAR('speed-up with 8 threads', ['CPU-heavy parsing', 1, 'GIL'], ['Waiting on APIs', 8, 'GIL released while waiting'])),
 ('Python has a global interpreter lock: only one thread runs Python code at a time. For computing, threads just take turns. But while a thread waits for the network or disk, it lets go of the lock, so other threads run.', P('One thread runs Python at a time', 'Waiting releases the lock', 'So threads help I/O, not CPU')),
 ('For CPU work, use processes, or libraries like NumPy that do the work outside Python.', P('I/O bound: threads or asyncio', 'CPU bound: processes', 'Or vectorised libraries'))],
 K('Which job do threads speed up in standard Python?', ['Parsing a large file in pure Python', 'Calling 500 slow APIs', 'Computing a big sum in a loop'], 1, 'Threads release the GIL while waiting on I/O.'),
 ['Use a thread pool for API and database calls', 'Use a process pool or Spark for CPU-heavy transformations'])
R('a03', 'A3.3', 'When one agent becomes many', [
 ('Splitting work across several agents sounds powerful. It also multiplies cost and creates new ways to fail. When is it worth it?', B('Many agents?', 'only when the work splits cleanly')),
 ('It pays off when sub-tasks are independent and each needs a lot of its own reading, like checking ten pipelines in parallel. A coordinator gives each worker a narrow brief and gets back a short summary, so no single context fills up.', F('Coordinator', 'Worker per pipeline', 'Short summaries back', 'One decision')),
 ('It fails when the parts depend on each other: workers redo each other\'s work or contradict. Then one agent with good tools is cheaper and more reliable.', P('Independent parts: split', 'Tightly coupled: one agent', 'Measure cost per task'))],
 K('When does a multi-agent design beat one agent?', ['Always, more agents are smarter', 'When sub-tasks are independent and each needs lots of its own context', 'When the task is small'], 1, 'Parallel independent work with separate contexts is the case it is built for.'),
 ['Start with one agent and split only when context or time limits bite', 'Give each worker a narrow brief and ask for a short structured summary'])
R('m01', 'M1.4', 'Slowly changing dimensions, type 2', [
 ('A driver moves from Pune to Bengaluru. Last year\'s Pune revenue suddenly drops, because every old trip now joins to Bengaluru. Nobody changed the trips.', B('Last year changed?', 'the dimension was overwritten')),
 ('Overwriting the city is type 1: history is lost. Type 2 keeps history. Close the old row with an end date, and insert a new row with a new surrogate key, the new city and a start date.', C('driver_sk  driver_id  city       valid_from  valid_to\n101        D7         Pune       2024-01-01  2026-03-31\n245        D7         Bengaluru  2026-04-01  9999-12-31')),
 ('Facts store the surrogate key that was current when the trip happened, so old trips keep Pune and new ones get Bengaluru.', P('Close the old row', 'Insert a new row, new key', 'Facts point at the key of their time'))],
 K('In type 2, how does an old trip keep the old city?', ['The trip stores the city name', 'The trip stores the surrogate key that was current at trip time', 'Queries filter by date'], 1, 'Each version has its own key, and facts are joined on that key.'),
 ['Decide per attribute whether history matters (type 2) or not (type 1)', 'Test that every natural key has exactly one current row'])
R('m02', 'M2.7', 'Date lists: a month of activity in one number', [
 ('Counting monthly active users by scanning 30 days of events every night is slow and expensive. What if one row per user already knew which days they were active?', B('30 days of scans', 'every single night')),
 ('A date list stores activity as bits: one bit per day, 1 if the user was active. Each night you shift yesterday\'s number by one and add today\'s bit. Thirty days of history fit in one integer.', C('day:    30 29 ... 2 1\nbits:    1  0 ... 1 1   -> one 32-bit integer')),
 ('Then active in the last 7 days is a single bit mask, no scan. Rows drop from users times days to just users.', BAR('rows read for a monthly active count', ['Scan raw events', 3000000000, ''], ['Date list per user', 100000000, '']))],
 K('How is the date list updated each night?', ['Re-scan all 30 days', 'Shift the previous value and add today\'s bit', 'Append a row per day'], 1, 'It is cumulative: yesterday\'s state plus one new bit.'),
 ['Build a cumulative table for any metric computed over a rolling window', 'Store activity as bits when you need many "active in last N days" metrics'])
R('m03', 'M3.3', 'Data Vault: model for change, not for queries', [
 ('Your company has twelve source systems, and they change every quarter. A star schema in the cleaned layer breaks every time. Data Vault is built for that churn.', B('12 sources', 'changing every quarter')),
 ('It splits data three ways. Hubs hold business keys, like customer id. Links hold relationships, like customer placed order. Satellites hold the descriptive attributes with load dates, one per source. A new source adds a satellite and changes nothing else.', F('Hub: business key', 'Link: relationship', 'Satellite: attributes over time', note='new source = new satellite')),
 ('The price: many joins. So you build stars on top for analysts, and keep the vault as the auditable record.', P('Easy to add sources', 'Full history and audit', 'Too many joins for analysts'))],
 K('A new source system arrives. What changes in a Data Vault?', ['Every hub is rebuilt', 'You add a satellite (and links if needed); existing tables stay', 'The star schema is dropped'], 1, 'Additive change is the point of the vault.'),
 ['Use a vault in the integration layer when sources change often', 'Serve analysts from stars or wide tables built on top'])
R('s01', '1.7', 'Idempotency: the idea that connects everything', [
 ('Your nightly job failed at 3 a.m. Airflow retried it. Now yesterday\'s revenue is double. The retry did exactly what it was told.', B('Retry = double revenue', 'the job appended again')),
 ('A job is idempotent when running it twice leaves the same result as running it once. Appending is not: each run adds the rows again. Overwriting the day\'s partition is: the second run replaces the first.', BAR('rows for 1 Nov after two runs', ['Append', 2000000, 'doubled'], ['Overwrite the partition', 1000000, 'correct'])),
 ('Retries, backfills and replays all assume it. Overwrite partitions, or merge on a key, never blind append.', P('Overwrite the partition', 'MERGE on a unique key', 'Never blind append'))],
 K('Which write makes a daily job safe to rerun?', ['INSERT the day\'s rows', 'Overwrite that day\'s partition', 'Append and deduplicate later'], 1, 'The second run replaces the first instead of adding to it.'),
 ['Check every scheduled job: what happens if it runs twice?', 'Write by partition overwrite or merge on a key'])
R('s02', '2.5', 'Iceberg: a table is a tree of metadata', [
 ('Two jobs write the same lake table at once and a reader sees half of each. Plain Parquet folders cannot stop that. Iceberg can, without a database server.', B('Half-written table', 'what readers see on plain folders')),
 ('An Iceberg table is a tree. The catalog points at the current metadata file. That lists snapshots, each snapshot lists manifest files, and manifests list the data files with their column statistics.', F('Catalog pointer', 'Metadata file', 'Snapshot', 'Manifests', 'Data files')),
 ('A commit writes new files, then swaps the catalog pointer in one atomic step. Readers see the old snapshot or the new one, never half. Old snapshots give time travel, and statistics let queries skip files.', P('Atomic pointer swap', 'Readers see whole snapshots', 'Time travel', 'Statistics skip files'))],
 K('What makes an Iceberg commit atomic?', ['A lock on every data file', 'Swapping the catalog\'s pointer to a new metadata file in one step', 'Writing everything into one file'], 1, 'Everything else is written first; the commit is a single pointer change.'),
 ['Expire old snapshots and compact small files on a schedule', 'Use a catalog that supports atomic swaps (REST, Glue, Nessie)'])
R('s03', '3.3', 'The shuffle: where Spark jobs get slow', [
 ('Your Spark job reads a terabyte in two minutes, then spends forty minutes on one group by. That forty minutes is the shuffle.', BAR('minutes', ['Read 1 TB', 2, ''], ['Shuffle for groupBy', 40, ''])),
 ('To group by city, every row for Pune must end up on the same executor. So each task writes its rows to local disk, split by key, and then every task fetches its piece from every other machine over the network. That is disk, network and sorting, all at once.', F('Map tasks write by key', 'Network: everyone fetches from everyone', 'Reduce tasks sort and combine')),
 ('Shuffle less: filter and select columns first, broadcast small tables, and partition on the join key.', P('Filter and prune first', 'Broadcast small tables', 'Avoid repeated shuffles on the same key'))],
 K('Why is a shuffle expensive?', ['It runs on the driver', 'Data is written to disk and sent over the network between executors', 'It uses Python'], 1, 'Every task exchanges data with every other task.'),
 ['Read the plan for Exchange steps and ask whether each is needed', 'Broadcast dimension tables under a few hundred megabytes'])
R('s04', '4.7', 'Late data and backfills', [
 ('Yesterday\'s revenue report is published at 6 a.m. At 9 a.m., two thousand trips from a phone that was offline arrive, all dated yesterday. Is the report now wrong?', B('Trips arrive 3 hours late', 'dated yesterday')),
 ('Yes, unless the pipeline expects it. Partition by event date, not load date, and reprocess the last few days each night, so late rows land in the right day. Mark days as final only after the lateness window passes.', P('Partition by event date', 'Reprocess a lookback window', 'Mark days final after it')),
 ('A backfill is the same job pointed at older dates. If every step overwrites its partition, a backfill is safe to run any time.', F('Late rows arrive', 'Rerun last 3 days', 'Partitions overwritten', 'Report corrected')),],
 K('Where should late-arriving trips land?', ['In today\'s partition, the load date', 'In the partition of their event date', 'In a separate late table forever'], 1, 'Event-date partitions plus a lookback window keep each day\'s numbers right.'),
 ['Measure how late your data really arrives and set the lookback to cover it', 'Publish a "final" flag per day for finance'])
R('a04', 'A4.3', 'Semantic layers: one definition of revenue', [
 ('Ask an LLM for last month\'s revenue and it writes perfect SQL that returns the wrong number. Gross or net? Refunds? Which currency? The SQL was fine; the definition was missing.', B('Perfect SQL, wrong number', 'the definition was missing')),
 ('A semantic layer writes the business definitions down once: revenue is net of refunds, in rupees, by trip date. Dashboards, notebooks and the LLM all ask the layer for revenue instead of writing their own formula.', F('Question: revenue last month', 'Semantic layer: the definition', 'Generated SQL', 'Same answer everywhere')),
 ('For text to SQL this is the biggest accuracy win: the model chooses metrics and filters; the layer supplies the logic.', P('One definition per metric', 'Shared by people and models', 'Model picks, layer computes'))],
 K('Why does a semantic layer improve text-to-SQL accuracy?', ['It makes the model larger', 'The model reuses governed metric definitions instead of inventing formulas', 'It caches answers'], 1, 'Most wrong answers come from wrong definitions, not wrong syntax.'),
 ['Define your top 10 metrics in a semantic layer before building an AI SQL assistant', 'Test the assistant on questions with known answers'])
R('d01', 'D1.5', 'Write skew: both checks pass, the rule breaks', [
 ('Two on-call engineers each check that at least one other person is on call, and both go off call at the same moment. Each check was true. Now nobody is on call.', B('Two valid checks', 'nobody on call')),
 ('This is write skew. Each transaction read a snapshot, saw two people on call, and updated a different row, its own. Snapshot isolation only stops two writes to the same row, so it lets this through.', F('T1 reads: 2 on call', 'T2 reads: 2 on call', 'T1 updates Ann', 'T2 updates Raj', note='different rows, so no conflict')),
 ('Fixes: run at serializable isolation and retry on failure, or lock the rows you checked with select for update, or turn the rule into a constraint.', P('SERIALIZABLE plus retry', 'SELECT ... FOR UPDATE on what you read', 'A database constraint'))],
 K('Why does snapshot isolation allow write skew?', ['It allows dirty reads', 'The two transactions update different rows, so no write conflict is detected', 'It has no snapshots'], 1, 'The rule spans rows that neither transaction locked.'),
 ['Look for business rules that read several rows and update one', 'Protect them with serializable isolation or explicit row locks'])
R('s05', '5.3', 'Exactly once is really at least once plus', [
 ('Kafka promises exactly once. Yet your sink table has duplicates after a crash. Both statements can be true.', B('Exactly once?', 'duplicates after a crash')),
 ('A consumer reads, writes to the sink, then commits its offset. If it crashes after writing but before committing, it restarts from the old offset and writes those rows again. That is at least once.', F('Read offset 37 to 40', 'Write to sink', 'Crash before commit', 'Restart at 37: written twice')),
 ('Exactly once in effect needs the sink to cooperate: either commit output and offsets together in one transaction, or make writes idempotent with a merge on the event id. Then a replay changes nothing.', P('Commit output and offsets together', 'Or MERGE on event_id', 'Replays become harmless'))],
 K('A consumer crashes after writing but before committing offsets. What happens on restart?', ['Those records are lost', 'Those records are processed and written again', 'Kafka deletes them'], 1, 'It resumes from the last committed offset, so the sink must handle repeats.'),
 ['Give every event a unique id and merge on it in the sink', 'Store offsets in the same transaction as the output where the sink allows'])
R('s06', '6.2', 'Log-based change capture', [
 ('Your nightly job copies orders where updated at is after yesterday. It misses deleted orders, and rows updated twice in a day show only once. The database already keeps a perfect record of every change.', B('Missing deletes', 'and missing in-between updates')),
 ('Every database writes each change to its log before applying it, for crash recovery. Debezium reads that log, the write ahead log in Postgres or the binlog in MySQL, and turns every insert, update and delete into an event, in commit order.', F('Commit', 'Write-ahead log', 'Debezium reads it', 'Kafka event per change')),
 ('No extra load on the tables, no missed deletes, and every change in order. Debezium remembers its log position, so after a restart it carries on where it stopped.', P('Every change, including deletes', 'In commit order', 'Resumes from its log position'))],
 K('Why does log-based CDC catch deletes when an updated_at query does not?', ['It scans tables faster', 'Deletes are written to the database log like any other change', 'It runs more often'], 1, 'A deleted row is gone from the table but its delete is in the log.'),
 ['Prefer log-based CDC over timestamp queries for tables with deletes', 'Monitor replication slot lag so the database log does not fill the disk'])
R('a05', 'A5.2', 'Chunking: where most RAG systems fail', [
 ('Your RAG assistant answers from the wrong runbook, or from half a step. Usually the model is fine. The way the documents were cut up is not.', B('Wrong half of the runbook', 'a chunking problem')),
 ('Retrieval finds chunks whose embeddings are close to the question. Chunks too big blur several topics into one vector, so nothing matches sharply. Chunks too small lose the context that makes a step make sense.', P('Too big: blurry vectors', 'Too small: lost context', 'Split on headings and steps')),
 ('Split on the document\'s own structure, add a small overlap, and keep the title and section as text in every chunk. Then measure retrieval with real questions before tuning the model.', P('Split by structure', 'Small overlap', 'Title in every chunk', 'Measure recall first'))],
 K('Why do very large chunks hurt retrieval?', ['They are slower to store', 'One vector mixes several topics, so no topic matches strongly', 'Models cannot read them'], 1, 'Embedding a long mixed passage averages its meanings.'),
 ['Build a set of 30 real questions with the right chunk for each', 'Track retrieval recall before changing the generation prompt'])
R('s07', '7.3', 'IAM: who may do what to which bucket', [
 ('An analytics job only needs to read one folder in S3. It was given admin access because that worked. A leaked key from that job can now delete every bucket.', B('Read one folder', 'got admin on everything')),
 ('In AWS every request is checked against policies: which principal, which action, on which resource. Deny wins, otherwise an explicit allow is needed. A role is an identity a service assumes for short-lived keys, so nothing long-lived sits in code.', F('Who: the role', 'What: s3:GetObject', 'Which: lake/trips/*', 'Allowed or denied')),
 ('Least privilege means the job gets get object on that one prefix, nothing more, and its role expires its keys automatically.', P('Roles, not user keys', 'Exact actions and prefixes', 'Deny beats allow'))],
 K('Which grants least privilege to a job that reads trips data?', ['s3:* on all buckets', 's3:GetObject on arn:aws:s3:::lake/trips/*', 'AdministratorAccess for convenience'], 1, 'Only the action and the prefix the job needs.'),
 ['Replace long-lived access keys with roles', 'Use access analyzer to find unused permissions and remove them'])
R('j01', 'J1.4', 'The JVM under your Spark job', [
 ('Your Spark executors freeze for twenty seconds at a time, and tasks time out. The code did not change. The garbage collector is cleaning up a heap full of objects.', B('20-second freezes', 'garbage collection')),
 ('Spark runs on the Java virtual machine. Objects live on a heap, and the garbage collector periodically finds and frees the dead ones. A huge heap with millions of small objects means long pauses, and during a full pause the executor does nothing.', P('Objects on the heap', 'GC frees dead ones', 'Big heap, many objects: long pauses')),
 ('Spark avoids this with off-heap binary data in DataFrames, which is one reason they beat RDDs of Python objects. Check GC time in the Spark UI; above about ten percent, act.', P('Use DataFrames, not RDDs of objects', 'Moderate executor heaps', 'Watch GC time in the UI'))],
 K('Why are DataFrames kinder to the garbage collector than RDDs of objects?', ['They are written in Python', 'They store rows in compact binary form instead of millions of objects', 'They never use memory'], 1, 'Fewer objects means less for the collector to scan.'),
 ['Check the GC time column in the Spark UI for slow stages', 'Prefer several moderate executors over a few giant heaps'])
R('s08', '8.2', 'Delta Lake: a table is its transaction log', [
 ('A Delta table looks like a folder of Parquet files. But reading the files directly gives wrong answers: deleted rows come back. The truth is in a folder called delta log.', B('Read the files directly?', 'deleted rows come back')),
 ('Every commit adds a numbered JSON file to the log, listing the data files it added and removed. To read version 12, Delta replays the log up to 12. Every ten commits it writes a Parquet checkpoint so readers do not replay thousands of files.', F('00011.json add, remove', '00012.json add, remove', 'Checkpoint every 10', 'Reader builds version 12')),
 ('Two writers race to create the same next number; only one succeeds. The other checks for conflicts and retries.', P('Commit = next numbered file', 'Checkpoints speed reads', 'Optimistic concurrency'))],
 K('How does a Delta reader know which files make up the current table?', ['It lists the folder', 'It replays the transaction log from the last checkpoint', 'It asks the driver'], 1, 'Files on disk may be removed or uncommitted; only the log says what counts.'),
 ['Never read Delta tables as plain Parquet folders', 'Run OPTIMIZE and VACUUM on a schedule with retention you agree with the business'])
R('s09', '9.4', 'Write, audit, publish', [
 ('A bad load wrote negative fares into the revenue table at 2 a.m. By 9 a.m. three dashboards and a finance export had used them.', B('Bad data at 2 a.m.', 'everywhere by 9 a.m.')),
 ('Write, audit, publish stops that. The job writes to a staging branch or table that nobody reads. Checks run there: row counts, nulls, ranges, uniqueness. Only if they pass does the job publish, by swapping the new data in at once.', F('Write to staging', 'Audit: checks run', 'Pass: publish atomically', 'Fail: alert, old data stays')),
 ('With Iceberg branches or a table swap, publishing is one atomic step, so readers never see half-checked data.', P('Readers only see checked data', 'Failures stay invisible', 'Publish is one atomic step'))],
 K('Where do the checks run in write, audit, publish?', ['On the published table after readers use it', 'On a staging copy before it is published', 'In the dashboard'], 1, 'Auditing before publishing is the whole point.'),
 ['Add a staging step and checks before your most-read tables are updated', 'Alert and keep yesterday\'s data when an audit fails'])
R('s10', '10.3', 'Capacity arithmetic in two minutes', [
 ('In a design round the interviewer says: ten million riders, design the trip events pipeline. Before boxes and arrows, they want numbers.', B('10 million riders', 'what does that mean per second?')),
 ('Say it out loud: ten million riders, two trips a day, fifty events per trip, is a billion events a day. A day has about a hundred thousand seconds, so ten thousand events a second on average, maybe thirty thousand at peak. At one kilobyte each, a terabyte a day.', F('10M riders x 2 trips x 50 events', '1 billion events a day', '10k a second, 30k peak', '1 TB a day')),
 ('Those numbers choose the design: partitions, storage, and whether one machine is enough.', P('Round hard', 'State assumptions', 'Let numbers pick the design'))],
 K('Roughly how many seconds are in a day, for quick estimates?', ['10,000', '100,000', '1,000,000'], 1, '86,400, rounded to a hundred thousand for mental maths.'),
 ['Do the arithmetic before drawing any design', 'Plan for peak, usually 2 to 5 times the average'])
R('r01', 'R1.3', 'Migrations without drama', [
 ('Most platform migrations fail in the last ten percent: the few jobs nobody understands, which keep the old system alive for years.', B('The last 10%', 'keeps the old system alive')),
 ('Plan it like a product. Inventory every job and owner first. Migrate in waves, easiest first, to build the tooling. Run old and new side by side and compare outputs automatically, so each wave is proven, not promised.', F('Inventory and owners', 'Wave 1: easy jobs, build tooling', 'Parallel run and compare', 'Switch, then retire')),
 ('And set a date when the old system becomes read-only. Without a deadline, the last ten percent never moves.', P('Inventory first', 'Waves, easiest first', 'Automated comparison', 'A date for read-only'))],
 K('What usually stalls a big migration?', ['The first easy jobs', 'The last few unowned, poorly understood jobs', 'The new platform\'s speed'], 1, 'Find owners early and set a read-only date for the old system.'),
 ['Publish a migration dashboard: jobs moved, compared clean, retired', 'Agree a read-only date for the old platform with leadership'])
R('s11', '11.5', 'Experiments: was it the feature or the week?', [
 ('Bookings rose eight percent the week the new home screen shipped. The product manager wants to celebrate. It was also the start of the festival season.', B('Bookings up 8%', 'feature, or festival?')),
 ('A before and after comparison cannot separate the two. An experiment can: randomly show the new screen to half the users at the same time. The festival hits both halves equally, so the difference between them is the feature.', F('Randomly split users', 'Half see the new screen', 'Same week, same festival', 'Difference = the feature')),
 ('Decide the metric and the sample size before starting, and do not stop the moment it looks good; early peeks make noise look like wins.', P('Pick the metric first', 'Size the sample first', 'No early stopping'))],
 K('Why does a randomised split answer the question when before-and-after cannot?', ['It has more users', 'Both groups share the same week, so outside effects cancel', 'It runs longer'], 1, 'Randomisation balances everything except the change you made.'),
 ['Ask for a control group before claiming a feature moved a metric', 'Write down the metric and stopping rule before the test starts'])
R('s12', '12.3', 'Order your interviews', [
 ('You have six companies to interview with and one dream company. Most people book the dream company first, while they are least practised.', B('Dream company first?', 'usually a mistake')),
 ('Interviewing is a skill that improves with each loop. Start with two companies you would accept but care less about, then the mid group, and put your top choices in the same two weeks at the end, when you are sharpest.', F('Practice loops', 'Mid-choice loops', 'Top choices, same two weeks')),
 ('Grouping the final ones together also means offers arrive together, which gives you options and leverage when you negotiate.', P('Warm up on lower-stakes loops', 'Cluster the top choices', 'Offers arrive together'))],
 K('Why cluster your top-choice interviews at the end?', ['Recruiters prefer it', 'You are most practised then, and offers arrive together', 'They are easier later'], 1, 'Peak skill and parallel offers both help.'),
 ['List your companies in three tiers and book the lowest tier first', 'Ask recruiters for timelines so your final offers land in the same week'])

for mid, reels in S.items():
    p = os.path.join(os.path.dirname(__file__), 'r_%s.py' % mid)
    if os.path.exists(p):
        old = open(p).read()
        if 'samples_gen' in old: continue
        txt = old.rstrip().rstrip(']') + '\n # samples_gen\n' + ''.join(' %r,\n' % r for r in reels) + ']\n'
    else:
        txt = '# %s: sample reel on the hardest topic (samples_gen)\nMID = %r\nREELS = [\n%s]\n' % (mid, mid, ''.join(' %r,\n' % r for r in reels))
    open(p, 'w').write(txt)
print(len(S), 'modules')
