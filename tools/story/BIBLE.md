# Meridian: the series bible (w6, 2026-11-08, approved direction: light story, recall first)

## Premise
Marcus Bell, 34, a senior data engineer, joins Meridian as its first staff data architect. Meridian runs rides, food delivery and
payments in 14 cities; Bengaluru is the biggest market (80% of trips). The data platform he inherits is a patchwork: Python scripts
on cron, a Hadoop cluster nobody wants to touch, Airflow DAGs with no owners, two dashboards that disagree. Over five seasons he
rebuilds it, learns to lead without authority, survives a merger, and at the end faces his own staff-level interview loop.
The learner follows Marcus and answers the questions he faces. Every scene points at the lesson of that day; the story frames the
work and never replaces it.

## Cast (all fictional; no real people or companies)
- Marcus Bell: (he) staff data architect, the lead. Careful, curious, a little too willing to fix things himself. Wants to make Principal.
- Nadia Bell: (she) his wife, an ICU nurse on rotating nights. She keeps him honest about on-call and evenings.
- Zoe Bell: (she) their daughter, 7. Asks "what did you build today?" at dinner; Marcus has to explain his work simply.
- Asha Iyer: (she) CTO. Direct, high bar, fair. "Show me the number, then the plan."
- Dev Malhotra: (he) data platform lead and on-call veteran. Sceptical of new tools; becomes Marcus's strongest ally once trust is earned.
- Lena Park: (she) junior data engineer Marcus mentors. Fast learner, afraid to ask questions at first.
- Mei Chen: (she) FinOps lead. Reads every cloud bill line by line. "Who pays for this?"
- Tom Reyes: (he) Head of Product. Wants everything real time, yesterday.
- Kofi Mensah: (he) analytics lead. Owns the executive dashboard; first rival, later partner in the metric war.
- Grace Okafor: (she) retired principal engineer, Marcus's mentor; Friday coffees. Speaks for the app's coach.
- Victor Hale: (he) lead architect at Lumen, the company Meridian acquires in season 4. A Scala and lakehouse person; rival, then ally.
- Interviewers (season 5 only): named per company style (for example "Priya, product sense"; "Sam, system design"). Companies are
  fictional: Hyperion, Northwind Labs, Atlas Cloud, Kestrel.

## Seasons (in program order)
1. Day One (s00, p01, p02, a01, p03, p04, a02, p05, p06, a03): onboarding; the finance scripts that fail at 3 a.m.; Python that
   survives production; the CEO's demand for "AI agents". Finale: month-end close works, but Lena finds a 2% revenue gap nobody
   can explain.
2. The Metric War (m01, m02, m03, s01, s02, s03, s04): two teams, two numbers for "completed trips"; the model, the walking
   skeleton, the lake, Spark under festival load, a warehouse people trust. Finale: the board numbers finally match, and Tom says
   "now make it real time".
3. Real Time (a04, d01, s05, s06, a05, a06, s07): the text-to-SQL bot that embarrasses the CEO; a split-brain incident; surge
   pricing on streams; refunds that do not match (the 2% gap is solved here: CDC and late refunds); RAG over runbooks; an AI
   gateway bill; the move to the cloud while Mei watches. Finale: launch night, a region goes dark.
4. The Merger (j01, s08, s09, s10, o01, o02, o03, o04): Meridian buys Lumen; Victor's Scala and Databricks estate meets Meridian's
   Snowflake; 12% of rows vanish overnight; design at ten times scale; data mesh politics; golden paths; a rider asks to be
   deleted everywhere; running the platform as a product. Finale: Asha must pick one head of data platform, Marcus or Victor.
5. The Loop (r01, o05, s11, s12): Marcus writes the strategy that unites both teams, presents the foundation blueprint, works in
   front of customers, and a recruiter from Hyperion calls. The final episodes are his staff interview loop, round by round,
   mirroring the learner's own. Series finale: two offers and a choice.

## Recurring threads
- The 2% revenue gap (seeded S1 finale, clues in S2, solved in S3 s06).
- Lena's growth: from silent to leading the on-call rotation by S4.
- Dev's trust: earned through one honest postmortem in S1 p05.
- Marcus at home: on-call nights against Nadia's shifts; Zoe's dinner questions are the "explain it simply" moments.
- Victor: rivalry in S4, alliance in S5.
- Grace's Friday advice: one sentence a week that a staff engineer would say.
- The promotion case: Grace asks Marcus to keep a decision log; each season finale adds an entry (the 2% gap, the one number,
  launch night). Asha reads both logs before choosing in S4 (o04), and the Principal offer in S5 (s12) rests on that evidence.
- The Lumen migration: two platforms meet in S4 (s08); in S5 (r01) Lumen's finance tables move onto the shared Iceberg lake, and
  Marcus and Victor co-sign the migration memo (r01's design problem, "Migrate the Hive warehouse to Iceberg without downtime").
- Hiring on both sides of the table: Marcus sits on a staff panel in r01 while Lena shadows her first interview; in s12 he is the
  candidate, round by round.

## Every hook ends in practice

Each arc carries, besides its scenes and teasers:
- `to`: six links, one per scene, to the practice that scene leads into (the module's chapter, lab, practice, quiz, interview
  set or design problem, an exercise, an F7 step, a simulator challenge or the written mock). `build.py` refuses a link that
  opens nothing real.
- `recall`: six questions, one per day, taken from the question each day's scene ends on ("Recall: …?"), for the next morning's
  cold open: a retrieval prompt, not a recap.
- Teasers are one-line questions that the next day's scene and lesson answer, without repeating the card's own heading.
- `rematch` (one line for the whole series): a weak weekend review is never a loss; it opens a rematch on the same arc next Sunday.

## Writing rules
- Plain British-leaning English, present tense, third person about Marcus ("Marcus opens the pager…"). No em dashes.
- A scene is 25 to 45 words and ends with tension or a question the day's lesson answers.
- A teaser ("Tomorrow on Meridian") is 8 to 20 words, a concrete hook, never vague.
- Ground every scene in that module's real content (read its chapter headings, labs and incidents); use real technologies by name
  (Kafka, Spark, Iceberg, dbt, Snowflake) but no real companies or people.
- Realistic work life: standups, Slack threads, 1:1s, design reviews, postmortems, pager alerts, budget meetings, hiring.
- No melodrama, no romance plots, no violence. Stakes are professional: trust, money, customers, careers.
