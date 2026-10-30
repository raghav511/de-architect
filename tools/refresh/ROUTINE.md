# Weekly refresh routine

Run by the scheduled task `data-architect-weekly-refresh` once a week. It keeps three things current and ships them as one PR that it merges itself:

1. **Recent interview questions** in `data/recent.json`.
2. **What is new in AI and data** in `data/news.json`.
3. **Module content**, only where something changed in the field that a learner preparing now should know.

Work in a clean clone (`~/.data-architect/refresh-repo`), on a new branch `refresh/YYYY-MM-DD`.

## 1. Recent interview questions (last 7 days)

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
