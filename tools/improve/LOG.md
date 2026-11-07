# Improvement log

- 2026-11-07 · 1.28.0 · QA trust release and four-level reels · tools/qa_trust.js Q01–Q22 · 22/22 pass, 101/106 flows (4 long-standing failures queued as backlog item 1)
- 2026-11-07 · 1.28.1 · fix the 4 long-failing journeys · updated 3 tests, fixed source-link labels · 4/4 pass
- 2026-11-07 · 1.28.2 · user report: reels silent (1,133 of 1,194 had no recording and fell back to silence) · Q23 (fails on 1.28.1, passes) · device voice fallback; loop now tests every feature
- 2026-11-07 · 1.29.0 · security review + approved home page reorganization · Q24, Q25, 8 journeys updated to the tabbed plan, dark-mode reel button contrast · 25/25 trust, 117/117 flows (8 re-run after update), a11y 0
- 2026-11-07 · 1.31.0 · user request: Sign in with Google, 24-hour sessions · Q26–Q28 · 28/28 trust, sync/profile/today journeys pass, real Google button loads under CSP
- 2026-11-07 · 1.31.1 · every-feature smoke test · tools/smoke.js 16 checks both engines, Q29 (fails live, passes) · iOS Simulator: recorded reel plays with sound in Mobile Safari
- 2026-11-07 · 1.32.0 · Kafka architect's lens · flows lens test extended (7 rows, 5 internals, interview set) · pass
- 2026-11-07 · Airflow architect's lens (1.9) · lens test extended (7 rows, 5 internals, interview set) · pass
- 2026-11-07 · 1.32.0 (code, shipped with the Kafka lens) and 1.33.1 (notes) · user request: reuse the exam app's client ID without sharing data · Q30–Q32 (Q30 found the update step deleting the exam app's caches) · 32/32 trust (Q23 flaky once, queued)
- 2026-11-07 · dbt (4.10) and dimensional modelling (M1.8) lenses · lens test extended (cards, internals counts, interview sets, M1.8 scheduled) · pass
- 2026-11-07 · 1.35.1 · Iceberg architect's lens · new flows lens journey (7 rows, 6 internals, interview and quiz sets, 4-level reels, 8.5 link) · pass
