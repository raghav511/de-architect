# Improvement loop: one feature per iteration until nothing is left

You are improving Data Architect, a single-learner PWA (this repo, live at https://raghav511.github.io/de-architect/).
Read this file and `CLAUDE.md` at the start of every iteration; they are the whole brief.

## What the learner is trying to achieve

A senior data engineer preparing for **staff and architect interviews at companies like Uber, Meta, Google and Salesforce**,
and for **building a production-grade data foundation for an organization** at work. Every feature should move one of these:

1. **Understand deeply**: every technology in and out (what, why, when not, who owns it, internals, failure modes, cost),
   at four levels (new to it, how it works, inside and caveats, architect).
2. **Remember**: spaced review, reels, quick checks, playbook, recall in mocks.
3. **Perform under interview conditions**: live mocks, staff-level questions, system design, coding (DSA, SQL, PySpark, Python).
4. **Apply at work**: labs that run in the browser, work lists, the design simulator, capstone foundation blueprint.
5. **Keep coming back**: fun, fast, fewest taps, never lose progress, works on Mac Chrome, iPad and iPhone, offline.

## One iteration

1. **Sync**: `git checkout main && git pull`. Read `tools/improve/BACKLOG.md` and the last 10 lines of `tools/improve/LOG.md`.
2. **Pick** the top unblocked item. If the backlog has no unblocked item, run the **audit** below to refill it; if the
   audit finds nothing worth doing, write "Nothing left to improve" in LOG.md and stop the loop.
3. **Branch** `improve/<slug>`. **Build** it the way CLAUDE.md says (self-contained, fewest taps, phone first screen keeps
   Up next, new state keys merged in `mergeState`, no secrets or learner data in the repo).
4. **Test**: add a journey test in `tools/flows.js` (or `tools/qa_trust.js` for trust issues) that fails without the
   change and passes with it. Then run, against the local server on 8811 (`python3 ../qa/serve.py 8811 "$PWD"` if not
   running): `node tools/qa_trust.js`, the flows matching the area, `node tools/sched_test.js`, `python3 tools/validate.py`.
   Use `NODE_PATH=../qa/node_modules`. Fix anything you broke. Never let a test reach 127.0.0.1:8765 or a real sync URL.
5. **Ship**: update `CLAUDE.md` (layout, mechanism, Recent changes, Next; prune stale lines), then
   `../qa/ship.sh <next minor or patch> "<title>" "<plain-words note>"...` and merge the PR. If GitHub reports a conflict,
   merge `origin/main`, resolve keeping both sides, retest, and merge. Never push to main directly or bypass review rules.
6. **Verify live**: fetch `https://raghav511.github.io/de-architect/version.json` until it shows the new version
   (re-request a Pages build if it is stuck over 10 minutes).
7. **Record**: move the item to Done in BACKLOG.md with the version, append one line to LOG.md
   (`date · version · item · tests added · result`), and add any follow-ups you found to the backlog.
8. Show progress as a checklist, then schedule the next iteration.

## Audit (when the backlog runs dry)

Walk the app as the learner on a phone and a Mac (Playwright, `../qa/` scripts), module by module and screen by screen,
and score each against the five goals above. Look for: content gaps (a technology without a lens, internals questions,
four-level reels, a lab, a simulator scenario), stale or wrong content, broken or slow screens (`../qa/checks.js`),
accessibility (`tools/a11y.js`), failing or missing tests, confusing copy, extra taps, data-safety risks. Add each finding
as a backlog item with the goal it serves and how you will test it. Only an audit that finds nothing ends the loop.

## Rules

- One feature per iteration, shipped before the next starts. Small and finished beats large and half-done.
- Never wait on the user. Skip items marked **needs approval** until the user approves them in chat; note them in the log.
- The user's messages always come first: if they ask for something, do it next.
- Never copy paid or copyrighted course material; write lessons for the app. Outside sources only as small ⓘ links.
- Reel writing and recording use `tools/reels/write.py` and `voice.py` (Claude Code login and Kokoro on this Mac).
