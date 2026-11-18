# One nightly routine

One scheduled task, `data-architect-nightly` (every night at 00:07), runs every Data Architect job in turn. It replaced five tasks on 2026-11-18 (nightly coach, daily refresh, daily reel review, weekly simulator check, weekly review), because all of them end in the same place: this repository and the app. The runner (`tools/routines/run.py`) does the parts that must not depend on judgement: waiting out a network drop, picking the jobs due tonight (a job missed on its night runs on the next one), a clean clone and branch per job, a record of every result, and one health check that tells the learner only when something needs them.

Jobs and their order are in `jobs.json`; each job's own instructions are in `jobs/<id>.md`. To add a job, add a line and a brief there: never add another scheduled task for this app.

Show progress as a checklist ([x] done, [~] in progress, [ ] not started), one line per due job.

## Steps

`R` below is `python3 ~/.data-architect/runs/ops/tools/routines/run.py`.

1. `R plan`. It waits up to about half an hour for the network, then lists the jobs due tonight with their time budget and brief, and the shared folder (`<scratch>`, from `~/.data-architect/routines.json`). If it says the network is down, run `R done JOB --result failed --note "network down"` for each due job, go to step 3, and stop.
2. For each due job, in the order listed, one at a time:
   1. `R prep JOB`: a clean copy of main in the job's own folder and tonight's branch (left-over changes go to `git stash`, never deleted). Work only in that folder. If prep fails, record the job as failed with its message and go on to the next job.
   2. Read the job's brief completely and do it. Stay within its budget: when time is up, ship nothing half-done.
   3. Before shipping, check `git branch --show-current` prints the branch prep gave you; if not, ship nothing.
   4. `R done JOB --result ok|nothing|failed --note "<one plain line>" [--pr <PR link>]`. `nothing` means it ran and there was nothing to ship. A failed job never stops the jobs after it; it runs again tomorrow.
3. `R health`. If it prints `NEEDS YOU` lines, send them to the learner in one push notification (PushNotification), word for word, with nothing else. If it prints `all good`, send nothing: the learner should not have to look.
4. Finish with the checklist and the health result.

## Owner rules (all jobs)

- Never ship anything that weakens security, adds a vulnerability, exposes a key or private data, raises Google billing (no new paid APIs, no polling of Google services), or breaks the app or the repo. If a change might, ship nothing and say why.
- The repository is public: never print or commit `~/.data-architect/config.json`, the sync URL or its key, API keys, learner data or anything from `~/.data-architect/profile.txt`. `tools/secret_scan.py` runs in `tools/refresh/ship.sh`.
- No API key in the browser. Reels use the Kokoro Heart voice. Read only public pages: never sign in, never get around paywalls, CAPTCHAs or bot checks, never copy anyone's words.
- Never mark anything done for the learner.
- If `<scratch>` exists: read `<scratch>/qa/CLAIMS.md` before editing and leave alone anything another session has claimed; add your own line. `R done` writes the job's line in `<scratch>/qa/LEADER-INBOX.md` for you.
- Do not run `tools/reels/voice.py` while recorders are running (`pgrep -f "voice.py --shard"`); ship the text and the build links recordings later.
- Merge conflicts: keep both sides, bump the version past main, rebuild `data/reels.json` with `tools/reels/build.py` rather than hand-merging it, retest, merge. If GitHub blocks a merge, leave the PR open: health reports it.
