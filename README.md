# Keystone · DE architect prep

An AI-first study app for senior data engineer and data architect roles. It runs entirely in the browser (GitHub Pages) on MacBook Chrome, iPad and iPhone, and can be added to the home screen.

## What is inside

- **Today**: a time-boxed plan (60 min on weekdays, 120 on weekends; change it in Settings). Each step says what to do, when it is done, how long it takes, and opens the exact section. Unfinished steps roll to the next free day. A week strip, an "Up next" button and **Add to calendar** (.ics with reminders).
- **Path**: modules AI 1–3 (agent loops, harness engineering, prompts and credits, evals, self-fixing and self-improving agents, MCP, an on-call agent), Setup, then DE 1–12. Every step in order with its planned day, plus a roadmap. Extra modules (big-tech papers and problems, new questions on old topics) are added weekly by a scheduled research task.
- **Coding track**, separate from the hour: 84 DSA, 60 SQL and 60 PySpark questions plus timed coding tests, run in the browser (Pyodide, DuckDB and a PySpark-compatible engine) against real tests.
- **Lessons, labs, quizzes, interview sets and mocks** per module. AI labs run in a light Codespace (`projects/ai-foundations`), the lakehouse in a 4-core one (`projects/lakehouse`).
- **Git**: one hands-on lesson per module; `labs/git/gitlab.sh` builds a broken repo and checks your fix (16 labs).
- **System design studio**: a problem statement and deliverable per module, six steps with notes, calculator and timer.
- **What is new in AI**, refreshed weekly. **Search** everything with ⌘K or `/`.
- **Progress**, **Sync progress** across devices (Google Apps Script), backup and restore, and a coach (hints; free-form with your own API key).

## Test loop

`bash tools/test_all.sh` runs everything: content checks (`tools/validate.py`, including every coding test's reference solution), the question banks (`tools/build_bank.py`), the scheduler (`tools/sched_test.js`), every reference solution through the in-browser editor and wrong answers that must fail (`tools/editor_test.js`), the Git labs (`tools/test_gitlabs.sh`), 30+ user journeys such as ticking steps, quizzes, editor hints, backup and sync (`tools/flows.js`), axe accessibility checks in light and dark (`tools/a11y.js`), and a crawler that opens every screen at Mac, iPad and iPhone sizes and clicks every button (`tools/crawl.js`). Needs Python with duckdb and Node with Playwright.

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
