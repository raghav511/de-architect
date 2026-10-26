# Orders pipeline (Claude Code practice project)

A deliberately imperfect little pipeline for the Claude Code lessons in Data Architect. It reads raw order
files, cleans them, loads them into a SQLite "warehouse" and prints revenue by country.

```
pipeline/ingest.py   read and clean raw orders (dedupe, date window, amounts)
pipeline/load.py     load clean rows into warehouse.db
pipeline/run.py      the entry point: python3 -m pipeline.run 2026-10-01 2026-10-07
pipeline/config.py   settings from environment variables (.env.example)
tests/               python3 -m unittest -q
data/orders.csv      synthetic orders (the names and emails are fake)
docs/                notes from the upstream vendor
```

It has known bugs, a security hole and a privacy leak. The lessons ask you to find them with Claude Code,
so do not read the hints in the lessons before you have tried.

Make a fresh copy any time with `bash labs/cc/new_sandbox.sh` (on your Mac) or by rebuilding the Codespace.
