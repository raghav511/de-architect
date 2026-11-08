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

Existing suites (2026-11-07 and 08, local build with the fixes): `tools/qa_trust.js` 32/32, later 39/39; `tools/flows.js` 136/136 (two Python journeys needed a rerun alone); `tools/smoke.js` all pass on Chromium; on WebKit all pass except "Coding: Run executes Python", which also fails on the live 1.36.4 build without these changes (the editor stays on Loading DuckDB…; reported to the leader).
