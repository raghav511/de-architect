# Improvement backlog

Top unblocked item goes next. Each item: goal served (1 understand, 2 remember, 3 perform, 4 apply, 5 keep coming back) and how it is tested.

## Next

2. **Ship the recorded reels** (2): every iteration, run `tools/reels/build.py` to link the Heart recordings finished so far and ship them; when the recording of all 1,194 reels finishes, ship the last batch. Test: reels flow, every beat has audio.
4. **Architect's lens: Spark (s03)** (1, 3). Same test.
8. **Architect's lens: Snowflake and Databricks (s08)** (1, 3).
9. **Architect's lens: Debezium and CDC (s06)** (1, 3).
10. **Architect's lens: Flink and streaming engines (s05)** (1, 3).
11. **Architect's lens: Postgres internals (d01)** (1, 3).
12. **Module O1: data mesh and data products** (1, 4): after s10; add to BASE_MODS, sw.js PROGRAM, validate.py mods; chapter, lab, quiz, interview, reels. Test: validate, path order, learn flow.
13. **Module O2: golden paths and self-serve templates** (1, 4).
14. **Module O3: governance (contracts, lineage, access, PII, retention)** (1, 4).
15. **Module O4: running the platform as a product (SLOs, adoption, cost showback, roadmap)** (1, 4).
16. **Module O5: capstone foundation blueprint** (4): after r01; end-to-end design using the simulator. Test: simulator scenario passes, capstone steps tick.
17. **Live scorecards in the nightly coach digest** (`tools/coach/coach.py`) (3). Test: digest includes the last live mock's averages and weakest dimension.
18. **In-browser labs for modules 2, 3, 7, 8** where they still assume Docker or a cloud account (4). One module per iteration.
19. **Duplicate guard for company questions** in `tools/validate.py` (same normalised question text under two ids) (5).
20. **iPhone Safari pass** with the simulator or mobile-mcp (5): Today, Reels audio, live mock mic, simulator touch.
21. **Review 2026-11-21: Spark Real-Time Mode with aggregations and dedup** (s05 5.7): only an aggregator reported it so far; confirm on the Spark or Databricks release notes, then update 5.7 and its reels. Test: validate, reels build.
22. **Review 2026-11-21: deny policies on AI securables and pipeline flows as Unity Catalog objects** (o03, beta on Databricks 12 Nov): one paragraph in the access section once GA. Test: validate.
23. **Review 2026-11-21: company questions have not grown since 7 Nov** (`data/recent.json`): the refresh cannot confirm dated reports from search summaries alone; try public dated sources (LeetCode Discuss, Medium posts with dates) and log what was searched. Test: refresh note lists searches.
24. **Review 2026-11-21: reel beats for the 8.4 dynamic tables default and 4.6 batched tests**: add one Inside and caveats beat each in `tools/reels/auto/s08.json` and `s04.json` and record them. Test: build.py, voice.py.
25. **Review 2026-11-27: Postgres 19 in the Postgres lens** (d01 D1.9; released 19 Nov 2026): read the release notes, say which answers change and add the release each feature needs. Test: validate, flows Postgres lens.
26. **Review 2026-11-27: 36 chapter sections have no reel series** (a03 A3.6, a06 A6.10 to A6.12, c13 four, c14 three, c15 two, o04 seven, o05 eight, s09 9.6): `python3 tools/reels/write.py <mid>` one module a night, then build and record. Test: build.py, smoke Reels.
27. **Review 2026-11-27: a network layer and customer-owned retention in guardrails** (a06 A6.11): AWS WAF AI Security rules for LLM, MCP and A2A endpoints (GA 23 Nov) and Anthropic Enterprise Frontier Safeguards (beta); one paragraph and one interview question. Test: validate.
28. **Review 2026-11-27: vector sizing with 16, 4 and 2 bits per dimension** (a05 A5.9, OpenSearch 3.9): extend the 10 million documents sizing answer. Test: validate.
29. **Review 2026-11-27: AI 7 has no design problem** (validate.py warning): add one to `data/design.json`. Test: validate has no warning for a07.

## Needs approval (do not build until the user approves in chat)

- **Rewrite git history** to remove the old Gmail author address and name from past commits (force push to main): only if the user says so.
- **GitHub secret scanning and push protection**: a repo setting the user turns on.
- Anything the morning suggestions routine proposes (`tools/insights/`).
- **UX proposals from the Mobbin benchmark** (`tools/crawl/UX.md`, 2026-11-07), each needs a yes before building: (1) Up next shows two section names and "+N more"; (2) a week strip of streak days on the level chip; (3) one primary button on Up next; (4) reel title and module at the bottom above the caption; (5) reel filters folded into one chip; (6) no 1/1175 counter in Shuffle; (7) one progress line for reels with many beats; (8) right or wrong right after each practice-quiz answer with a one-line why; (9) one Continue button in quizzes; (10) live mock Start and level on the first iPhone screen; (11) one way out of a quiz (Back or ✕, not both).

## Done

- Reels page error (backlog 1): the cause was reel pictures in a shape the engine did not draw (flows given as steps or nodes) in a neighbouring reel; the engine now never throws on a picture, build.py normalizes and checks every picture, reels without beats are dropped; Q41; the reels journey no longer clicks a fixed option of a shuffled check.
- Unguessable quizzes (critic review item 3): per-attempt option order, answers by option, 189 options reworded (right option longest 87% → 21%), validate.py rule, quiz-same, Q36–Q39. Left: about 1,000 reel checks still have the right option longest (order is now shuffled; the daily reel review rewords up to 15 a day).
- 1.35.2: Iceberg architect's lens (2.9, linked from 8.5) with 6 internals answers (v3 deletion vectors), 3 interview and 3 quiz questions, 8 reels.
- 1.32.0: Kafka architect's lens (5.9) with 6 internals answers (v3 deletion vectors), 3 interview questions, 8 reels.
- 1.32.0: sign-in turned on with the exam app's client ID, sign-ins bound to Data Architect (nonce), cache clean-up limited to this app (user request: no data shared with the exam app).
- 1.31.1: `tools/smoke.js` (16 checks, Chromium and WebKit; 1 real issue found and fixed: start-up stuck on Loading when a download stalls) and a real-Safari reel check in the iOS Simulator.
- 1.31.0: Sign in with Google with 24-hour sessions (user request). Waiting on the user: create the OAuth client ID and set CLIENT_ID and OWNERS in the deployed sync script.
- 1.29.0: security review (secret scan on commit and ship, profile out of the repo, CSP, private commit email, grader sandbox reads) and the approved home page reorganization.
- 1.28.1: the 4 long-failing journeys pass (3 outdated tests, 1 real issue: New this week source links did not say they open a new tab).
- 1.28.0: QA trust release (22 trust tests, 15 confirmed issues fixed) and four-level reels for every section.
