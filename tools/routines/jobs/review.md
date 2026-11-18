# Job: weekly review (Fridays)

Folder and branch: the ones `run.py prep review` printed (`~/.data-architect/runs/review`, `review/<date>`).

The learner's standing instruction (2026-11-08): review the entire app and its content every week, bring in the latest from data and AI engineering, and fill the gaps in the course, without waiting for approval.

1. Review the whole app on current main: every module (data engineering s/d/m/p, AI a*, organisation o*, leadership r*), the interview loop, simulator, labs, reels and the Meridian story, against the course maps in `<scratch>/qa/` (AI-COURSE-MAP.md, SOURCES-*.md) when that folder exists, and against what changed in the last week.
2. Research the last week's changes that matter for staff data architects and AI engineers (table formats, streaming, warehouses and lakehouses, orchestration, governance; LLM APIs, RAG, evals, agents, MCP, fine-tuning, serving and cost, LLMOps, safety and regulation) and what interview loops now ask. Prefer primary sources and summarise in your own words.
3. Write the review (stale facts by module and section, missing topics, outdated interview questions, and a ranked list of at most 10 updates: where, what changes, why, how it is tested) to `<scratch>/qa/reviews/<date>.md`, or to the job's final report when there is no `<scratch>`.
4. Implement the small updates on this branch within the budget: edit, run `python3 tools/validate.py` and the tests for what you changed, then ship and merge them as one PR with `tools/refresh/ship.sh`. Bigger items go to `tools/improve/BACKLOG.md` in the same PR, one line each with the review date.

The `--note`: updates shipped, items added to the backlog.
