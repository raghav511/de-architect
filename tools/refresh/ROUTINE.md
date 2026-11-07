# Daily refresh routine

Run by the scheduled task `data-architect-weekly-refresh` every evening (the name is kept so its history stays in one place). It keeps three things current and ships them as one PR that it merges itself:

1. **Recent interview questions** in `data/recent.json`.
2. **What is new in AI and data** in `data/news.json`.
3. **Module content**, only where something changed in the field that a learner preparing now should know.

Work in a clean clone (`~/.data-architect/refresh-repo`), on a new branch `refresh/YYYY-MM-DD`.

## 1. Recent interview questions (since the last run)

**Companies.** Use every company in `tools/refresh/companies.txt`, which holds the learner's own interview folder plus top data companies. If a search turns up a strong data company that isn't listed, add it to the file.

**What to search.** Look for data engineering, analytics engineering, data platform and data architect interview questions reported in the last 7 days. For each company, search the web restricted to the past week:

- Google web search, with its date filter set to the past week.
- Public LinkedIn posts that come up in search results, for example `site:linkedin.com/posts "<company>" "data engineer" interview`.
- YouTube interview-experience videos (use the title and description only).
- Public interview-experience pages, for example Glassdoor, LeetCode Discuss, GeeksforGeeks, Blind and InstaHire.

**Access.** Read only pages that are public without signing in. Never sign in, never create accounts, and never get around paywalls or bot checks.

**Keep a question only if all of these hold:**

- The page says it was asked at that company.
- The page is dated, or says when the question was asked, within the last 7 days.
- It's a real technical or behavioural question for a data role.

Skip duplicates of questions already in `data/recent.json` (same company and same question meaning).

**Each item:**

| Field | What goes in it |
|---|---|
| `id` | `rq-YYYYMMDD-<company-slug>-<n>` |
| `company`, `level` | Level only if stated |
| `asked` | Date asked, if stated |
| `found` | Today, as YYYY-MM-DD |
| `TAG` | One of: sql, dsa, py, spark, streaming, modeling, design, arch, cloud, ai, core, behavioral, git |
| `mid` | The module that teaches it. Modules are in `js/plan.js` `BASE_MODS`; see each module's `@@meta` title in `data/program/<mid>.txt`. Use "" only if nothing fits. |
| `sec` | The chapter section number it belongs to, the first word of that `## ` heading in the module (for example `5.7` or `A3.6`). The app shows the question inside that section; leave it out only if no section fits (it then shows at the top of the module's chapter). |
| `Q` | The question, in your own short words (one or two sentences, never a long quote) |
| `A` | A model answer written fresh for this app: 4–10 lines, structure first, with the key trade-off, written as a senior data engineer would answer out loud |
| `src` | Site name |
| `url` | The https page where it was reported |

Set `updated` to today. Keep items no older than 120 days, newest first, at most 300.

## 2. What is new (`data/news.json`)

- Find 3–6 developments from the last 7 days that matter to a data engineer or architect: data platforms (Databricks, Snowflake, BigQuery, Iceberg, Delta, Kafka, Flink, Spark, dbt, Airflow), AI for data (LLMs over warehouses, agents, MCP, vector search, evals) and cloud data services.
- Use primary sources (the vendor's blog, docs, release notes, the official announcement).
- Each item has: `title`, `summary` (what changed, with the date), `why` (why it matters to this learner), `try` (a small way to test the claim in this app's labs), `url` and `source`.
- Replace the items and set `updated` to today. Keep `note`.

## 3. Module content

Only when a change from step 2 makes a module's chapter wrong or incomplete (for example a renamed feature, a new default, or a deprecated tool):

- Make the smallest correct edit in `data/program/<mid>.txt`.
- Note it under `## Recent changes` in `CLAUDE.md`.

The app's update tracker marks the edited steps "Updated" and returns them to not done for the learner, so edit only when it's worth re-reading.

## 4. Check and ship

1. `python3 tools/validate.py` must print 0 errors. Fix any error before shipping.
2. Ship with `tools/refresh/ship.sh <next patch version> "Weekly refresh YYYY-MM-DD" "<note 1>" ["<note 2>"]`.
   - Get the next version by adding 1 to the last number of `version.json`'s `version`.
   - The notes are shown to the learner, in plain words. For example: "12 new interview questions asked this week at Uber, Google and Databricks." and "What is new: 4 items on Iceberg, Snowflake and MCP."
3. If nothing new was found, ship nothing and say so.

## Rules

- Never put the learner's data, the sync URL or any key into the repository.
- Never copy long passages from a source: questions are paraphrased, and answers are your own.
- Never invent a question, a date or a source. If you can't confirm when it was asked, leave it out.
- If `ship.sh` prints `NEEDS YOUR MERGE`, report the PR link in the summary.
- End with a three-line summary: questions added (by company), news items, and any module edits, plus the PR link.

## Placement of What is new items

Every item in `data/news.json` also gets `mid` (the module it belongs to, from `BASE_MODS` in `js/plan.js`) and `sec` (the section number, as above). The app shows each item inside that section of the module's chapter as well as on the What is new page. Nothing is marked done for the learner.

## Reels for next week's reading

Find the modules on the learner's plan for the coming week (the next modules in `BASE_MODS` after the current one; the coach digest names the current module). For each chapter section of those modules that has no hand-written reel yet, add one or more reels to `tools/reels/r_<mid>.py` (copy the shape of `r_p01.py`), then run `python3 tools/reels/build.py`, which writes `data/reels.json` and refuses any reel outside 30 to 60 seconds (70 to 150 words).

- One idea per reel. A point that does not fit goes into the next reel (`'part': '2 of 2'`).
- Explain cause and effect in plain words: never "the disk never seeks" alone, but what a seek is, why it is slow, and what Kafka does instead.
- Beats: a hook question, two or three ideas, each with a picture (`big`, `points`, `flow`, `bars`, `code`, `disk`, `shift`, or `fig` with a figure name from `js/figs.js`).
- End with a `check` (one multiple-choice question with `why`) and a `work` list of two or three things to do at work.
- Write everything yourself from the module's chapter; never copy course or article text.
- Then record the narration: `python3 tools/reels/voice.py` (Kokoro, Heart voice, on this Mac, no key; about 4 seconds a beat). It records only beats that are new or changed and links them in `data/reels.json`; commit the new files in `audio/reels/` with the PR.

## Daily window

Search the last 24 hours first (the past-day filter where offered), then the last 7 days for anything not already in `data/recent.json` (match on source URL and on the question's meaning). On Saturday, search the full week for every company in `tools/refresh/companies.txt`; on other days, cover at least 25 companies, rotating through the list by the day of the year, plus every company in the learner's folder list.

## 5. Coding problems (`tools/bank_*.py`)

When this run found a coding question (DSA, SQL, PySpark or Python) that the bank does not already cover, add it to the matching `tools/bank_*.py` in the same shape as its neighbours: a fresh problem statement in your own words, tests, hints, a reference solution and a starter that fails. Tag it with the week (`w`) or module (`m`) whose topic it practises. Run `python3 tools/build_bank.py`: every solution must pass and every starter must fail, or the problem is not added. At most 3 new problems a day.

## 6. System design (`data/design.json`)

When a design question asked this week is not already covered by a module's design problem, add it to the matching module's entry only if the module has none, otherwise add it to `data/recent.json` with `TAG: design` (it then shows in the module's interview page, the section and Today). Design answers follow the module's existing deliverable shape: requirements, estimates, a diagram in words, the deep dive, trade-offs and what you rejected.

## 7. Reels for everything new or changed

Last step before shipping, after every content edit of the day:

1. `python3 tools/reels/write.py`: writes reels for every chapter section that is new or changed (it fingerprints each section). It uses Claude Code on this Mac; if it reports a login or authentication error, write the reels yourself instead, into `tools/reels/auto/<mid>.json` in the same shape (`{"<heading>": {"hash": "", "sec": "<number>", "reels": [...]}}`), following the rules in the section above.
2. `python3 tools/reels/build.py` (refuses reels outside 30 to 60 seconds).
3. `python3 tools/reels/voice.py` records the new beats in the Heart voice.
4. Commit `tools/reels/auto/`, `data/reels.json` and `audio/reels/` with the day's PR.

If nothing new was found today and no section changed, ship nothing.
