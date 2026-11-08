### Season 3: Scale and Cloud (outline; data files in the next PR)

| Module | Arc | Monday: the stakeholder's problem | Midweek: the incident | Friday: the fix you ship |
|---|---|---|---|---|
| **s07** The bill that tripled | Meridian's first month on AWS. | Mei: the first cloud bill is three times the estimate (7.7 cost as a skill, `#/learn/s07/chapter`). | A script with a broad role deletes a prefix it should never have seen: the IAM check that ignores a deny (`#/step/s07/fix`). | Right-size on a budget in the simulator (`#/sim/sc/budget`), then lead it: cut the bill 30% in a quarter (`#/step/s07/lead`). |
| **j01** The Scala job nobody owns | Brightcart's Spark jobs, in Scala, on YARN. | Viktor's team hands you forty Scala jobs and leaves for a conference (J1.2 Scala for Python people). | An executor runs out of memory after the move to Kubernetes (J1.4 the JVM under your job, lab exercises). | Design Spark and Flink on Kubernetes for twenty teams (`#/design/j01`). |
| **s08** Two platforms, one truth | Data science on Databricks, Brightcart's analytics on Snowflake. | Viktor: "Snowflake is the platform." Data science: "Databricks is." (8.1 why there are two). | Delete one rider everywhere, then a time-travel query that misses its own version (`#/step/s08/fix`). | Two engines, one set of tables (`#/step/s08/design`), and lead it: one platform for the company (`#/step/s08/lead`). |
| **s09** The failure that did not fail | Green dashboards, missing rows. | Dev: 12% of rows vanished overnight and every check is green (9.1). | Database failover in the simulator (`#/sim/sc/failover`). | Contracts, tests, CI and a health dashboard (the s09 build lab), and the on-call agent, version one. |
| **s10** Finale: ten times the traffic | Meridian launches in twelve new cities. | Asha: twelve cities in six weeks; what breaks first? (10.3 capacity arithmetic). | One million events a second in the simulator (`#/sim/sc/million`). | Lose a region (`#/sim/sc/region`). **Finale:** the region goes dark during launch week; Asha's incident review is the boss round. |

### Season 4: AI at Meridian (outline; airs between other modules)

| Module | Arc | Monday | Midweek | Friday |
|---|---|---|---|---|
| **a01** The agent that spent the budget | Tomas wants an agent. | "Can it just do the pricing analysis?" (A1.1 what an agent really is). | The agent loops overnight and spends a week's credits (Lab 2: budgets, stop conditions and a trace). | An LLM gateway for the company (`#/design/a01`). |
| **a02** The grader that lied | Evals before features. | The agent's demo is perfect; Grace asks how you know (A2.1 evals first). | The grader passes everything, including nonsense (A2.2 graders that do not lie, Lab 5). | An evaluation platform for LLM features (`#/design/a02`). |
| **a03** The 3 a.m. agent | An on-call data agent with MCP tools. | Dev wants fewer pages (A3.5 the on-call data agent). | The agent proposes dropping a table to "free space" (A3.2 planning, budgets and honesty; Lab 10). | A platform for autonomous data agents (`#/design/a03`). |
| **a04** Ask your data | Operations asks questions in plain English. | "How many trips were cancelled in Pune yesterday?" (A4.2 text-to-SQL you can trust). | The model joins the wrong table and doubles the answer (Lab A4.1: guard the SQL, `#/py/ya041`). | Ask-your-data for the operations team (`#/design/a04`). |
| **a05** The runbook assistant | Retrieval over runbooks and incidents. | Dev: "Find me the runbook for the slot that fills a disk." (A5.1 RAG is a data pipeline). | The assistant cites a runbook deleted last month (A5.4 keeping the index fresh), then RAG under a rate limit (`#/sim/sc/rag`). | A runbook assistant that stays fresh (`#/design/a05`). |
| **a06** Finale: the assistant that promised refunds | The support assistant goes to 200,000 conversations a day. | Mei: what does one conversation cost? (A6.4 what a request costs, `#/py/ya061`). | A model update changes answers and nobody notices (A6.8 evals in production, the regression gate `#/py/ya065`). | Guardrails in layers (A6.11, `#/py/ya069`). **Finale:** the refunds incident review is the boss round. |

### Season 5: Lead (outline)

| Module | Arc | Monday | Midweek | Friday |
|---|---|---|---|---|
| **o01** Twelve teams, one queue | The central data team became a bottleneck. | Every team waits on your team's backlog (O1.1 why data mesh exists). | One team's backfill starves everyone: shared platform, noisy neighbour (`#/sim/sc/mesh`). | Move a central team to domain-owned data products (`#/design/o01`). |
| **o02** Nobody uses the templates | Golden paths. | Fifteen percent adoption; leadership wants templates mandatory (O2.1). | Eighty repositories on old template versions need a security fix (O2.4, `#/py/yo022`). | A golden path for new data products (`#/design/o02`). |
| **o03** The auditor's letter | Governance teams accept. | An auditor asks where card numbers live (O3.2 classifying personal data). | A masked column leaks through a derived table (O3.5 lineage and tag propagation, `#/py/yo033`). | Govern a fintech lakehouse for Meridian Pay (`#/design/o03`). |
| **o04** Is the platform worth it? | The platform as a product. | Mei and the CFO ask what the platform team is for (O4.1). | An outage with no service level and no message to users (O4.3, O4.4). | Run the platform team as a product (`#/design/o04`). |
| **r01** The migration memo | Brightcart's Hive warehouse moves to Iceberg. | Viktor and you disagree on the plan in front of Asha (R1.3 migrations without drama). | The first cut-over plan has no way back (R1.2 writing that moves decisions). | Migrate the Hive warehouse to Iceberg without downtime (`#/design/r01`), signed with Viktor. |
| **o05** The blueprint | The data foundation blueprint for the board. | Asha: "Show the board where we will be in a year." (O5.1). | The capacity plan rounds down and the launch would fail (`#/step/o05/fix`). | The whole foundation on launch day (`#/sim/sc/foundation`), and defend the blueprint to the CTO (`#/step/o05/lead`). |
| **s11** In front of the customer | A partner wants Meridian's data, now. | A freight partner's ask is vague and urgent (11.2 discovery). | A launch-day spike and a slow partner API (`#/sim/sc/spike`, `#/sim/sc/partner`). | The one-day customer build (the s11 build lab). |
| **s12** Finale: the loop | The hiring push and the promotion case. | Priya asks you to design the data architect loop (12.2 five loops from your bank). | You run a full loop from the interviewer's side (`#/mock`). | Your capstone, presented. **Finale:** the full mock loop is the boss round, and the committee reads your case. |

## The day template

Each day of a module is an episode with three pieces. The data files hold one `previously` and one `cliff` line per day, in order; a reader uses day `min(day, length - 1)`.

- **Previously on Meridian** (about 20 words): a recall question about yesterday's lesson, set in the story. It opens the day before the plan (w6's feature 1) and is answered from memory, not reread.
  *Example: "Recall: what does a Kafka consumer commit, the last offset read or the next one?"*
- **Tomorrow on Meridian** (one line, ending in a question mark): a question the next day's real content answers. It closes the day when the set is done (w6's feature 3).
  *Example: "One bad event stopped a partition. What keeps the rest of the stream moving?"*
- **A scene** (optional, at most 60 words): on Monday the stakeholder's problem, midweek the incident, on Friday the fix you ship, and on a season's last module the finale. Each scene links to the work it leads into (`to`).

## The data file

`data/story/<mid>.json`:

```json
{
 "season": 2,
 "title": "Surge, in real time",
 "arc": "about 120 words: the module's story",
 "previously": ["one recall question per day"],
 "cliff": ["one open question per day, answered by the next day's content"],
 "scenes": {"monday": "...", "midweek": "...", "friday": "...", "finale": "... (last module of a season only)"},
 "to": {"monday": "#/learn/s05/chapter", "midweek": "#/step/s05/fix", "friday": "#/sim/sc/partitions"}
}
```

Use each character's pronouns from the cast table; the protagonist is "they" in the bible and always "you" in the app. Write and change arcs only in `tools/story/arcs.py`, then run `python3 tools/story/build.py`. It refuses a scene over 60 words, a scene that names the protagonist, a "Previously on" or cliffhanger line out of shape, and any link that does not open real content (the module's own chapter, lab, practice or quiz; an exercise in the banks; an F7 step the module has; a simulator challenge; the module's design problem). `tools/validate.py` runs the same check and fails when a data file is missing or out of date.
