# Job: reel review

Folder and branch: the ones `run.py prep reels` printed (`~/.data-architect/runs/reels`, `reels-review/<date>`).

1. Read `tools/reels/REVIEW.md` and the SYSTEM rules in `tools/reels/write.py` completely, and follow them for 15 reels. Prefer reels on the claims `<scratch>/qa/REVIEW.md` lists as wrong or outdated, and skip sections another session has claimed.
2. Research each topic with WebSearch and WebFetch on public pages (YouTube and Instagram titles and descriptions, public articles) only to find missing angles, caveats, misconceptions and better examples. Never copy anyone's words, scripts or visuals.
3. Every concept is taught at four levels, each its own 30 to 60 second reel (New to it, How it works, Inside and caveats, Architect), with animated scenes, a check question and a work list. Reels teach concepts only, never the program itself.
4. Rewrite or add reels, run `python3 tools/reels/build.py` and `python3 tools/reels/voice.py` (Kokoro, Heart voice; only the reels you rewrote, one at a time, if recorders are running), update `tools/reels/reviewed.json`, run `python3 tools/validate.py`, then ship and merge with `tools/refresh/ship.sh`.
5. If no reel needed changes, record the review dates and ship only that.

The `--note`: reels reviewed, reels improved and why.
