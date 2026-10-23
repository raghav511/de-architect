# Keystone · DE architect prep

A 12-week, phone-friendly study app for senior data engineer and data architect interviews. It runs entirely in the browser (GitHub Pages) and works on MacBook Chrome, iPad and iPhone. You can add it to the home screen.

## What is inside

- **Today**: a daily plan that mixes DSA, a lesson, SQL, PySpark, an architecture drill and an agent lab, all on one ride-hailing platform. Tick blocks off as you go.
- **12-week path**: weekly themes for core DE, architecture, agentic AI and a DSA pattern, with the books to read.
- **Lessons**: the full chapter, readings, lab and warm-ups for every week. Week 1 has step-through Kafka diagrams with ‹ › controls.
- **DSA coach**: 84 problems (7 a week, easy to medium). Python runs in your browser (Pyodide) against real tests, including a large-input speed test. Hints open one step at a time; the solution unlocks after two runs or 15 minutes. There is a terminal (⌘/Ctrl + Enter runs, Enter runs a terminal line).
- **SQL and PySpark lab**: 60 SQL and 60 PySpark questions (5 + 5 a week), half "write" and half "optimize". SQL runs on DuckDB in the browser; PySpark runs on a small PySpark-compatible engine on top of DuckDB. Answers are checked against a reference on the same sample data, optimize questions also check *how* you wrote it, and show recorded before/after numbers on full data. Interviewer follow-ups with answers.
- **Coding tests, quizzes and interview sets** from the course files, with palette, leave/submit confirmation, reset with undo, and model answers.
- **System design studio**: six steps with notes, a back-of-envelope calculator and a 45-minute timer.
- **Progress** and **Sync progress** across devices, plus backup and restore.
- **Coach button** (bottom right): type, speak or send a photo. It gives hints from the ladder; with your own API key in Settings it answers free-form.

## Publish on GitHub Pages

Settings → Pages → Build and deployment → Deploy from a branch → `main` / root. The app appears at `https://<user>.github.io/de-architect/`.

## Sync between devices

1. Go to script.google.com → New project → paste `sync/Code.gs`.
2. Deploy → New deployment → Web app → Execute as **Me** → Who has access **Only myself** (use **Anyone** if Safari will not sign in).
3. Copy the `/exec` URL into Keystone → Settings (gear) → Sync URL on every device.
4. Tap **Sync progress** at the top right after a study session.

## Update the app

Tap **Update app** at the top right. It checks `version.json`, refreshes the offline cache and reloads (this also fixes stale versions on iPad Safari).

## For content changes

Question banks live in `tools/bank_*.py`. Rebuild and validate every reference answer with:

```
pip install duckdb
python tools/build_bank.py
```

Sprint content (chapters, quizzes, coding tests, interview sets) is in `data/program/sNN.txt`.
