# Morning suggestions routine

Run every morning by the scheduled task `data-architect-morning-insights`. It learns from how the learner used the app
yesterday and proposes improvements. **It never builds a suggestion that the learner has not approved.**

## 1. Act on approvals from earlier days

Read the comments and approval state on the suggestions artifact (its link is in `tools/insights/artifact.txt`; use
ArtifactComments to list comments, and its database collection `decisions`: one row per suggestion, `<date>-s<n>`, with `status` approve or change and a `note`). For each suggestion the learner
approved, in their own words ("approve 2", a thumbs up on suggestion 2, or the Approve button), build exactly what was
approved, plus any change they asked for, with its tests, and ship it with `../qa/ship.sh` style steps (or
`tools/refresh/ship.sh` in the refresh clone). A suggestion with change requests but no approval is redesigned, not built.
Reply on each comment saying what was built and in which version, or what changed in the redesign.

## 2. Read yesterday's usage

`python3 tools/coach/coach.py fetch /tmp/da_state.json && python3 tools/insights/digest.py /tmp/da_state.json`.
Never print, quote or commit learner data or the sync URL. Look for: screens that take long or are opened and left
quickly, slow draw times (over 150 ms), reels left while playing, checks often missed, steps that stall, errors, and
features never used.

## 3. Propose at most three improvements

Each one must name the evidence (a number from the digest), what changes, and how it helps the learner learn better or
faster. Prefer small, testable changes. Then publish or update the artifact "Data Architect suggestions" (one artifact,
updated each day; keep its link in `tools/insights/artifact.txt`). For each suggestion show, side by side:

- **Now:** an interactive copy of the current screen (real layout and data shapes, built in the artifact).
- **Suggested:** an interactive prototype of the change, same data, so the learner can tap through both.
- The evidence, the expected effect, and an **Approve** button plus a comment box for changes (store approvals and
  requests with the artifact's database, or ask for a comment such as "approve 1" or "change 2: …").

Also show what was built from earlier approvals. If there is nothing worth suggesting, say so in one line on the page.

## Rules

- Never change the app without the learner's approval, except fixing a clear bug that breaks a screen.
- Never put learner data, sync URLs or keys into the repository (it is public) or into the artifact beyond totals.
