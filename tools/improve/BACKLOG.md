# Improvement backlog

Top unblocked item goes next. Each item: goal served (1 understand, 2 remember, 3 perform, 4 apply, 5 keep coming back) and how it is tested.

## Next

2. **Ship the recorded reels** (2): every iteration, run `tools/reels/build.py` to link the Heart recordings finished so far and ship them; when the recording of all 1,194 reels finishes, ship the last batch. Test: reels flow, every beat has audio.
3. **Architect's lens: Kafka (s05)** (1, 3): 7-row lens and under-the-hood questions (why fast on disk, ISR and acks, rebalancing, exactly-once). Test: lens card renders, questions join @@interview.
4. **Architect's lens: Spark (s03)** (1, 3). Same test.
5. **Architect's lens: Iceberg and table formats (s02, s08)** (1, 3).
6. **Architect's lens: Airflow and orchestration** (1, 3).
7. **Architect's lens: dbt and modelling (m01–m03)** (1, 3).
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

## Needs approval (do not build until the user approves in chat)

- **Rewrite git history** to remove the old Gmail author address and name from past commits (force push to main): only if the user says so.
- **GitHub secret scanning and push protection**: a repo setting the user turns on.
- Anything the morning suggestions routine proposes (`tools/insights/`).

## Done

- 1.31.1: `tools/smoke.js` (16 checks, Chromium and WebKit; 1 real issue found and fixed: start-up stuck on Loading when a download stalls) and a real-Safari reel check in the iOS Simulator.
- 1.31.0: Sign in with Google with 24-hour sessions (user request). Waiting on the user: create the OAuth client ID and set CLIENT_ID and OWNERS in the deployed sync script.
- 1.29.0: security review (secret scan on commit and ship, profile out of the repo, CSP, private commit email, grader sandbox reads) and the approved home page reorganization.
- 1.28.1: the 4 long-failing journeys pass (3 outdated tests, 1 real issue: New this week source links did not say they open a new tab).
- 1.28.0: QA trust release (22 trust tests, 15 confirmed issues fixed) and four-level reels for every section.
