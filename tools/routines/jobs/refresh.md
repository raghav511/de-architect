# Job: daily refresh

Folder and branch: the ones `run.py prep refresh` printed (`~/.data-architect/runs/refresh`, `refresh/<date>`).

Read `tools/refresh/ROUTINE.md` completely and follow it step by step, including its Daily window section:

- Recent interview questions since the last run for the companies in `tools/refresh/companies.txt` (rotating daily, the full list on Saturday) into `data/recent.json`, each with a paraphrased question, a fresh model answer, the module (`mid`), section (`sec`) and the https source.
- What is new in AI and data in `data/news.json`, each with `mid` and `sec`.
- Module content edits for new topics, only when needed.
- New coding problems in `tools/bank_*.py` (checked by `tools/build_bank.py`) and system design questions.
- Reels for every section that is new or changed (`tools/reels/write.py`, `build.py`, `voice.py`).
- Validation, then shipping and merging with `tools/refresh/ship.sh`.

Rules: use WebSearch (with the date filter where offered) and WebFetch on public pages only. Never invent a question, a date or a source; leave out anything you cannot confirm was asked recently. Paraphrase; write answers, problems and reels fresh. If nothing new was found and no section changed, ship nothing (`--result nothing`).

The `--note` for `run.py done`: questions added by company, news items, coding and design additions, module edits, reels written and recorded.
