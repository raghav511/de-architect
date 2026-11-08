# Meridian: the story bible

The program is one series. You are the new staff data architect at Meridian, the ride company the lessons already use. Each module is an arc of a week at work, each day is an episode, and each season ends in the incident the season has been building towards. The story frames the real work and never replaces it: every scene ends in a lesson, a lab, an exercise, an F7 step, a simulator challenge, a design problem or a mock.

This bible is for the user and for every session that writes story text. The data files are `data/story/<mid>.json`, built from `tools/story/arcs.py` by `python3 tools/story/build.py`, which also checks every link (and `tools/validate.py` runs that check). w6's features read the files: the cold open ("Previously on Meridian", feature 1) and the cliffhanger ("Tomorrow on Meridian", feature 3), with a plain fallback when a file is missing.

## Rules of the series

These come from w6's research in `qa/design/ENGAGE.html` and they are not negotiable.

- **Every hook ends in practice.** A scene names the real lesson, lab, exercise, step, challenge or mock it leads into, and links to it. No scene exists only to be read.
- **"Previously on" is a recall question, not a recap.** Retrieval beats rereading; the line asks you to remember yesterday's idea.
- **A cliffhanger is real course content.** It is a question tomorrow's lesson answers, nothing invented to create suspense.
- **Light tone.** Work has pressure and the occasional 3 a.m. page; nobody is humiliated, and nobody glorifies overwork.
- **No guilt and no fake urgency.** No "your streak dies tonight", no countdowns that are not real interview timers, no sad characters when you skip a day.
- **Finales are rematchable.** A weak boss round opens a rematch next weekend, never a loss.
- **Nothing personal about the learner.** The protagonist is fictional. The learner plays them as "you"; the app never uses the protagonist's name, and no scene guesses anything about the learner's real job, company, family or history.
- **Fictional people and companies.** Meridian, Brightcart and every person below are invented. Real technologies (Kafka, Spark, Iceberg, Snowflake, Databricks, AWS) appear as tools, never as characters. Interviewers have styles, not employers.
- **Short.** A scene is at most 60 words, a "Previously on" line about 20, a cliffhanger one line. Plain mode (w6) turns scenes off and keeps the lessons.

## The protagonist: you

**Jordan Vale** (they; in the bible only; in the app, always "you"). A newly hired staff data architect who came from a much larger company, where they were the strongest systems engineer in the room and had never had to persuade anyone. At Meridian there is no platform yet, a sceptical team, a finance partner who reads every bill, and a CTO who hired them to make data something the company can trust. Jordan is good, a little impatient, and learning that the hard part of the job is people, money and time.

What their working life holds, season by season: onboarding and earning trust; a migration that goes wrong; on-call at 3 a.m. (and learning to escalate instead of being a hero); budget fights with finance that turn into a partnership; a rival architect who becomes a co-author; a mentor who asks the question behind the question; hiring loops on both sides of the table; a promotion case built from evidence; and a life outside work that stays in the background and is treated with respect: a running group with Dev, a family wedding during a launch week, a holiday that is actually a holiday because the runbook works.

## The cast

| Character | Pronouns | Role | What they bring | How they change |
|---|---|---|---|---|
| **Asha Menon** | she | CTO | Sets each week's goal and runs every finale as an incident review. Direct and fair; her favourite question is "what would we stop doing?" | Starts by testing you; by Season 5 she asks you to present the blueprint to the board. |
| **Dev Okafor** | he | Senior data engineer, often on call | Brings the incidents and the 3 a.m. pages. Sceptical of architects with slides; trusts people who fix things. | From "bet you a coffee it won't run" to your strongest ally; promoted in Season 3, partly on your evidence. |
| **Mei Tan** | she | Finance partner | Reads every bill and asks what each feature costs per ride. Funny, precise, never the villain. | The budget fights of Season 3 become a joint cost dashboard; she co-signs the platform-as-a-product case. |
| **Tomas Ruiz** | he | Product manager, rides and pricing | Brings the stakeholder problems: the slow script, surge pricing, the assistant. Wants it yesterday. | Learns to ask for outcomes instead of tools; you learn to say no with a better yes. |
| **Viktor Hale** | he | Principal architect who came with Brightcart, the delivery company Meridian acquires | The rival: experienced, attached to his warehouse and his way of doing things, often right. | Opposes the migration in Season 2, argues with you in Season 3, co-writes the migration memo in Season 5. |
| **Grace Adeyemi** | she | Mentor; the voice of the in-app coach | A retired principal architect who advises Meridian. Never gives the answer; asks the question behind it. | Steps back as you grow; in the last season she asks you to mentor someone yourself. |
| **Priya Raman** | she | Runs Meridian's interview loops and the mock panel | Plays the interviewers, each in a style: a consumer-product style that pushes on metrics and users, an infrastructure deep-dive style that keeps asking "and then what fails?", and a values style that wants the story behind the decision. | You first meet her as a candidate (your own loop, in flashbacks); by Season 5 you sit on her panels and design a loop with her. |

Minor: **Leo Park** (they), the junior engineer you hire in Season 2 and mentor through Season 5.

## Seasons

The seasons follow the program. The AI modules (a01 to a06) sit between other modules in the schedule, so Season 4 airs in parallel, like a spin-off that shares the cast and comes back every few weeks.

| Season | Modules | One-line premise | Season-long story line | Finale (the weekend boss) |
|---|---|---|---|---|
| **S1 Foundations** | s00, p01 to p06, m01 to m03 | You join Meridian and earn the right to change things. | From a forty-minute fare script to one trusted number: clean Python, then a model everyone can use. Dev doubts you; Tomas brings you his problems; Mei finds the fare charged twice. | **The season one incident review:** the double-charged fare, three counts of active riders and history that moved, explained to Asha in one story (after m03). |
| **S2 The Platform** | s01 to s06, d01 | You build the platform Meridian runs on. | A walking skeleton, a lake that slows down, Spark under load, a warehouse with one revenue number, real-time surge and change data capture. The Brightcart deal is announced; Viktor arrives. | **New Year's Eve:** demand spikes, the stream lags and the warehouse drifts from the database at midnight (after s06). |
| **S3 Scale and Cloud** | s07, j01, s08, s09, s10 | Meridian grows past one region and one bill. | The move to the cloud, the bill that triples, Brightcart's Scala jobs and its Snowflake, the failures that do not fail, and a launch in twelve new cities. Budget fights with Mei become a partnership. | **The region goes dark:** a cloud region fails during the twelve-city launch (after s10). |
| **S4 AI at Meridian** | a01 to a06 | Agents, retrieval and model features arrive at Meridian. | Tomas wants an agent; it overspends, its grader lies, an on-call agent proposes dropping a table, the ops team asks its data in English, a runbook assistant cites deleted pages, and a support assistant goes to 200,000 conversations a day. | **The assistant that promised refunds:** a model update makes the support assistant offer refunds the policy does not allow (after a06). |
| **S5 Lead** | o01 to o05, r01, s11, s12 | The work becomes people, money and direction. | A central team that became a queue, templates nobody uses, an auditor's letter, the question "is the platform worth it?", the Brightcart migration memo, the blueprint for the board, a customer in a hurry and a hiring push. | **The loop:** a full interview loop, and the promotion committee reads your case (after s12). |

### Story lines that cross seasons

1. **The promotion case (S1 to S5).** Grace asks you on day one to keep a short record of decisions and outcomes. Each finale adds evidence: the incident reviews, the cost savings, the people you brought along. In Season 5 the case goes to the committee, and its outcome depends on the evidence, not on luck. Hooks: each season's boss round and the r01 behavioural round.
2. **Brightcart and the warehouse migration (S2 to S5).** Meridian acquires Brightcart, a delivery company with a Hive warehouse and a Snowflake account, and Viktor Hale. Season 2 brings two revenue numbers (s04), Season 3 brings two platforms (s08), and Season 5 brings the migration memo (r01's design problem, "Migrate the Hive warehouse to Iceberg without downtime") that you and Viktor sign together.
3. **The hiring push (S1 to S5).** In Season 1 the diagnostic is your own interview loop, told in flashbacks with Priya. In Season 2 you hire Leo. In Season 3 you join panels. In Season 5 you design the data architect loop with Priya and run it (s12), seeing every round from the interviewer's side.

## Every module's arc

Seasons 1 and 2 are written in full below (built from `tools/story/arcs.py`, the same text the app reads). Seasons 3 to 5 are outlined here; their data files follow in the next PR.

