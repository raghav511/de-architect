# Daily reel review

Run every evening by the scheduled task `data-architect-daily-reel-review`, before the daily refresh.

1. Pick the 15 reels reviewed longest ago (dates in `tools/reels/reviewed.json`; never reviewed first, then current and next
   modules on the learner's plan first).
2. For each reel's topic, see how it is taught elsewhere: search YouTube and Instagram titles and descriptions, and public
   articles, for the concept (for example "why is Kafka fast"). Use them only to find missing angles, caveats, misconceptions
   and better examples. Never copy their words, scripts or visuals.
3. Check the reel against the rules in `tools/reels/write.py` (SYSTEM): one idea, 30 to 60 seconds, cause and effect, four
   levels per concept (New to it, How it works, Inside and caveats, Architect), an animated scene per beat, a check
   question and a work list. Teaching only: no reels about the program, modules or scoring.
   The check's right option must not stand out by length: reword the wrong options to similar length (each still
   clearly wrong) when it is the longest. Fix up to 15 such checks a day while reviewing; the app shuffles option order.
4. Improve what needs it: rewrite the script in `tools/reels/r_<mid>.py` (hand-written) or `tools/reels/auto/<mid>.json`,
   add missing levels or a part 2 when a point did not fit, fix anything wrong. Then `python3 tools/reels/build.py` and
   `python3 tools/reels/voice.py`.
5. Record the date in `tools/reels/reviewed.json`, validate (`python3 tools/validate.py`), and ship the PR with a note
   listing the reels improved and why.
