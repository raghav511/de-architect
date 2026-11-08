## Triage

**Remaining issues in the full runs above, and why they are not app bugs.** The rerun rows (9 screens, mid-program, both engines, crawler fixes applied) show 0 issues.

- *Fit to screen did nothing*: the design already fits; the crawler now records this as an intended no-op.
- *Mark done on Path could not be clicked* (Chromium, once): a timing flake of the crawler's restore; by hand and in the rerun it ticks and turns into Mark not done.
- *CSP blocked https://sync.test* (mid-program): the crawler's stub sync address is outside the app's connect-src, so the app refused it, as it should. The seed now uses an Apps Script–shaped address that the crawler answers itself; nothing leaves the machine. Rerun: sync, Ask and Review my code clean.
- *Failed to preconnect to fonts.googleapis.com* (WebKit): the crawler aborts Google Fonts; now ignored.
- *Stopped after 8 minutes* on Practice and Reels: the per-screen limit; raised to 15 minutes, and the rerun clicked every control there.

**Fixed from the crawl and the workflow walk** (with checks in `REGRESS` in `tools/crawl.js`, the crawler's own tap, overflow and dead-control checks, or `tools/flows.js`):

| Release | Fix |
|---|---|
| 1.36.1 (#67) | Sign in label squeezed into a 44 px icon box on phones; reel title hidden under the Shuffle filter row; 257 written reel pictures (flow with `steps`/`nodes`) crashed the player; reel filters, My week/Shuffle, Mode buttons, checkbox rows, level chip and Today's › links under 44 px; filters had no pressed state for screen readers |
| 1.36.6 (#72) | Lesson pages panned sideways on iPhone (module picker as wide as the longest title; WebKit counting wide code blocks); Today's "This week" and the design round timer overlapped other text; 44 px on phones for folded answers, reel buttons under headings, Progress quests and links, loop and simulator chips, simulator tools, editor pane tabs, day arrows; empty Send and empty Run line did nothing; quiz palette had no current marker; the coach mic did not say it was listening |
| batch 3 (this PR) | ⓘ source chips and Udemy lecture chips 44 px on phones (the invisible enlarged area only worked on two sides in WebKit); simulator "All" chip 44 px wide |
