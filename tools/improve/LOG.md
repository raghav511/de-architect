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
- 2026-11-07 · 1.35.2 · Iceberg architect's lens · new flows lens journey (7 rows, 6 internals, interview and quiz sets, 4-level reels, 8.5 link) · pass
- 2026-11-07 · release train · reels page error (backlog 1): broken pictures in neighbouring reels; engine fallback, build.py checks, reelPlayable · Q41 (fails without the fix), reels journey de-flaked · 40/40 trust (now 41 with F1's Q40), smoke Reels 3/3, reels journey 7 of the last 7
- 2026-11-08 · release train · reels player F3–F6 (user feedback): Instagram-style layout, one frame for loading and playing, speeds 0.25×–2× · new reels player journey in flows.js · reels journeys 3/3, smoke Reels, Q23, Q41
- 2026-11-08 · release train · module a06 AI engineering in production, part 1 (sources review items 2 and 3): serving, latency, cost, gateway, lens, evals in production, tracing, seven stub-only exercises · module A6 journey · validate 0 errors, bank 0 problems
- 2026-11-08 · release train · flows "platform and leadership" journey checks the real order: only the Org modules (o01, o02, o03, … as they land) between DE 10 and Leadership 1, and AI 6 right after AI 5 · passes on main
- 2026-11-08 · release train · module a06 part 2 (sources review items 5 and 6): approach and model choice, guardrails and governance, four stub-only exercises · module A6 journey extended · validate 0 errors, bank 0 problems
