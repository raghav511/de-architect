# Module 3 lab runs in the app: Spark under load
- Module 3's lab now runs in your browser, with no Spark cluster needed: a small simulated cluster runs the enrichment join one task per shuffle partition, spills and runs out of memory under skew, and writes a real Spark event log.
- Four exercises with real tests: read the plan (shuffles, join strategies, pushed filters); write the stage summary tool from 3.9; find the hot key and the NULLs from the partition sizes; and drop the NULLs and salt the hot key so the failing join finishes with the same rows.
- The Docker lab with a real Spark setup stays below as optional.
