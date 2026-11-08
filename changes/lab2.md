# Module 2 lab runs in the app: an Iceberg-style table
- Module 2's lab now runs in your browser, with no Docker or Spark needed: an Iceberg-style table with snapshots, day partitions, columns tracked by id and time travel.
- Four exercises with real tests: a MERGE on event id whose rerun adds nothing; files per day and a time-travel count read from the table's metadata; compacting 48 tiny files a day into one without changing the rows; and a view that keeps the Finance report working after a column rename.
- The Docker lab with Spark, a catalog and Trino stays below as optional.
