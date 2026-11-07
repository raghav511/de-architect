# Speed baseline and budget (2026-11-07, main 1.35.1 vs the speed-baseline branch)

How it was measured: `node tools/perf/measure.js BASE` (3 runs, median). A fresh learner each run.
- **Phone, Chromium:** Pixel 5 profile with 4x CPU slowdown.
- **iPhone 13, WebKit:** Playwright cannot slow WebKit's CPU, so this one runs at the Mac's speed.
- **Network for both:** Fast 4G (150 ms round trip, 9 Mbps down, 1.5 Mbps up) from `tools/perf/net.js`. Service worker requests are shaped too.
- **"Usable"** means time from navigation until the Up next button is on screen and can be tapped.
- **Cold** is the first visit. **Warm** is a reload after the service worker has installed.

**The Mac was very busy.** Four voice recorders and other sessions were running, with a load average between 70 and 400. Single runs spread widely (cold Chromium on main went 9.2 to 16.6 s), so treat the numbers as relative. "Before" (origin/main 1.35.1) and "after" (this branch) were run back to back, alternating, on the same local server (`qa/serve.py`: no gzip, no-store; that is why local sizes are larger than live).
**Live** went over a Wi-Fi link that was slower than Fast 4G during the run (a 4.8 MB CDN file took more than 60 s), so live times are upper bounds.

## Numbers

| Item | Phone Chromium, before | after | iPhone WebKit, before | after | Live 1.35.1 (Chromium / WebKit) | Target | Guard (`budget.json`) |
|---|---|---|---|---|---|---|---|
| Today usable, cold | 9,308 ms | **6,139 ms** | 16,995 ms | **11,819 ms** | 40,194 / 25,155 ms ¹ | under 2,000 ms | 7,000 / 13,000 ms |
| Today usable, warm | 8,542 ms | **4,133 ms** | 13,895 ms | **7,293 ms** | 54,775 / 24,564 ms ¹ | under 1,000 ms | 5,000 / 9,000 ms |
| Load event, cold | 3,875 ms | 3,221 ms | 5,519 ms | 6,653 ms | 16,936 / 8,366 ms ¹ | under 1,500 ms | — |
| Switch a Today tab (tap to paint) | 15 ms | 30 ms | 15 ms | 11 ms | 15 / 8 ms | under 100 ms | 100 ms |
| Open Reels, first slide on screen | 210 ms | 307 ms | 379 ms | 339 ms | 253 / 317 ms | under 500 ms | — |
| Open a module chapter (s05) | 215 ms | 371 ms | 227 ms | 226 ms | 244 / 194 ms | under 400 ms | — |
| Open Profile | 149 ms | 205 ms | 71 ms | 65 ms | 183 / 54 ms | under 300 ms | — |
| Open the simulator (module s10) | 91 ms | 130 ms | 45 ms | 39 ms | 109 / 40 ms | under 300 ms | — |
| Open a simulator challenge | 101 ms | 148 ms | 57 ms | 63 ms | 115 / 46 ms | under 300 ms | — |
| Run the simulator to a grade | 35 ms | 47 ms | 42 ms | 30 ms | 39 / 29 ms | under 100 ms | — |
| Back to Today | 63 ms | 94 ms | 40 ms | 39 ms | 66 / 38 ms | under 200 ms | — |

Second pass at 18:16, with the Mac quieter (load average 30) and Google Fonts served from a fetched copy, so the internet link drops out of the number. Medians of 3:

| Today usable | Chromium before | after | WebKit before | after |
|---|---|---|---|---|
| cold | 9,062 ms | **5,429 ms** (−40%) | 14,450 ms | **11,537 ms** (−20%) |
| warm | 8,062 ms | **2,852 ms** (−65%) | 13,249 ms | **7,616 ms** (−43%) |

¹ The real Wi-Fi was slower than Fast 4G during the live run. The after-fix live numbers are in the PR description.

Screen changes and taps are already inside their targets. The before/after spread there (tens of ms either way) is machine noise; the fix does not touch them.

### What a first visit downloads (KB)

| Kind | Live (gzip) | Local (uncompressed) | Target (gzip) |
|---|---|---|---|
| JavaScript (17 files) | 211 | 628 | under 250 |
| CSS | 18 | 75 | under 25 |
| Data before Today (banks, 42 module files, small JSON) | 588 | 1,571 | under 650 |
| Reel scripts `data/reels.json` (after the first screen) | 855 | 2,908 | under 1,000 |
| Web fonts (Google) | 153 | 153 | under 160 |
| Everything on the wire, first visit incl. the service worker's offline copy | 1,916 (Chromium) | 10,687 | — |

### Memory after 5 minutes of reel swiping (Chromium, local)

| | JS heap after load | after swiping | DOM nodes | listeners | swipes |
|---|---|---|---|---|---|
| before (main) | 11.8 MB | 12.0 MB | 1,647 → 2,500 | 75 → 120 | 39 ² |
| after (this branch) | 11.7 MB | 12.1 MB | 1,613 → 3,598 | 75 → 179 | 100 |
| Target | | under 25 MB | under 5,000 | | |

² The Mac stalled during that run, so fewer swipes happened in the 5 minutes. The heap stays flat. DOM nodes grow by about 20 per reel, which is worth a look if feeds get much longer.

## The worst offender, and the fix

**Today usable** was the worst item by far: 5 to 10 times its target. A timeline of a cold load showed why:
1. **The 17 scripts downloaded one after another**, about 400 to 450 ms each, so about 7.5 s in all on Fast 4G. The meta Content-Security-Policy in `index.html` turns off Chromium's look-ahead downloader. Removing the CSP or adding `defer` both made them download together. The fix is `defer` on every script: they still run in the same order, before `DOMContentLoaded`, and the CSP is unchanged.
2. **The start-up data waited in a chain**: banks, then py, then projects, then staff, then udemy, then the module list, then the 42 module files. Now they all download at once (`loadData`, `loadModules`).
3. **`data/reels.json` (855 KB gzip) shared the line with what Today needs.** It now starts right after the first screen is drawn (`reelsGo()`). When the first screen is Reels (`#/reels…`), it starts at once.

Result: cold usable improved 34% (Chromium) and 30% (WebKit), and warm improved 52% and 48%. Nothing looks or works differently. qa_trust, flows `today` and smoke pass.

## Next offenders (not fixed here)

- **Warm loads still wait on the network.** The service worker is network-first for every app file. Cache-first for the versioned files (`?v=`) with a background refresh would bring warm Today close to the 1 s target.
- **The first visit downloads everything twice.** The page fetches the files, then the service worker's install fetches the same list again (`CORE` in `sw.js`).
- **All 42 module files load before Today.** Today needs only this week's modules; the rest could follow the first screen.
- **The "Still loading" guard lives in `app.js`.** If a script fails to arrive, the page stays on "Loading Data Architect…" with no Reload button.
