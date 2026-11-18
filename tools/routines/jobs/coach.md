# Job: nightly coach

Folder: the one `run.py prep coach` printed (`~/.data-architect/repo`). This job never commits.

1. If `~/.data-architect/config.json` does not exist, record `failed` with the note "coach not configured: create ~/.data-architect/config.json with the sync URL (README, Sync between devices, and the nightly coach)".
2. Read `tools/coach/ROUTINE.md` completely and follow it: fetch the synced progress, build the digest, write the coach report JSON, validate and post it with `tools/coach/coach.py`. Use `/tmp/da-coach` as the scratch folder.
3. If fetching fails, record `failed` with the error in one line; never invent activity. A posted report is `ok`.

Never commit, push or change files in the repository, and never print the sync URL or its key. Put ROUTINE.md's three-line summary in your final report.
