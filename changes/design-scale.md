# Design at real scale (review 8)
- Module 10's capacity section now works at staff scale: 1 million events a second, Kafka per-partition throughput, S3 request rates per prefix, a multi-petabyte backfill with its cost, and multi-region RPO and RTO, with the arithmetic shown.
- A unit costs table (storage tiers, cost per TB scanned, per vCPU-hour, spot, egress and transfer between regions) lets you put a price on any design.
- Four new simulator challenges at staff scale (One million events a second, S3 request rate per prefix, Backfill on a budget, Lose a region) fail at those numbers until you fix them; the chapter links to each, and the interview loop's designs list them.
- The design set grows to twelve: ads attribution at billions a day, an experimentation platform, GDPR deletion across a petabyte lake, and a lineage and catalog platform, plus three staff-level interview questions.
