## Workflows on the iPhone (navigation and findability audit, UX polish checklist)

Walked on WebKit as an iPhone 13, first run, from Today, with the sync server and the AI interviewer stubbed. "Taps" counts taps from Today to the job's main action; "below the fold" means the control was under the tab bar until the page was scrolled.

| Job | Taps | Path | Finding |
|---|---|---|---|
| First run → Up next → read a lesson → tick it | 2 | Up next Read → Done, next at the end of the tab | Fine. Done, next is at the end of the text, as expected for reading. |
| Solve a coding problem | 3 | Today's Coding tab → first coding row → Run | The plan tabs (Reading, Coding, Interview) sit at the bottom edge of the first screen, half under the coach button. Reachable, but the Coding tab needs a small scroll. By design (Up next first). |
| Take a quiz | 2 | Learn tab → the module's quiz | Fine. On day 1 there is no quiz row on Today, so the quiz is found through Learn. |
| Live mock, AI off | 3 | Interview tab → Start → mark yourself | **Start is below the first screen** on a weekend (seven questions listed first). Breaks the "main action visible without scrolling" rule; proposal 10 in `UX.md` (needs approval, since it changes the layout). |
| Live mock, AI on (stubbed) | 3 | Interview tab → Start → send the answer | Same as above; the follow-up and scores arrive. |
| Swipe reels and answer a check | 2 | Reels tab → Play → swipe | Fine after the fixes below (the title was hidden under the filter row; a third of written reels crashed their picture). |
| Open and pass a simulator challenge | 3 | More → Design simulator → a challenge | Three taps; Today also has a simulator card below the plan (one tap, but below the fold). |
| Sync with a stub server | 2 | Avatar → Sync now | Fine. |
| Update the app | 2 | Avatar → Update app | Fine: shows installed and latest version. |

Existing suites on this build: `tools/smoke.js` 16/16 on Chromium and 16/16 on WebKit (two WebKit checks needed a rerun because the Python runtime CDN did not answer in time); `tools/qa_trust.js` 32/32.
