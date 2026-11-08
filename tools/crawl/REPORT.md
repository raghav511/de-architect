# Button crawl report

Written by `node tools/crawl.js BASE --report` (see the header of `tools/crawl.js`). Chromium = Mac 1440x900; WebKit = iPhone 13. Fresh = first run; mid = five weeks in with progress and a stub sync server.

| Run | When | Screens | Controls found | Clicked | Skipped (destructive) | Issues |
|---|---|---|---|---|---|---|
| chromium / fresh | 2026-11-08 00:41 | 212 | 3629 | 1642 | 19 | 2 |
| chromium / mid (rerun of 9 screens) | 2026-11-08 05:12 | 23 | 780 | 1023 | 16 | 0 |
| chromium / mid | 2026-11-08 01:22 | 48 | 1300 | 1414 | 19 | 8 |
| webkit / fresh | 2026-11-08 00:43 | 212 | 3202 | 1606 | 19 | 2 |
| webkit / mid (rerun of 9 screens) | 2026-11-08 05:07 | 23 | 765 | 989 | 16 | 0 |
| webkit / mid | 2026-11-08 01:29 | 48 | 1270 | 1365 | 19 | 6 |

## Issues

| Kind | Control | What | Screens |
|---|---|---|---|
| dead | Fit to screen | nothing visible happened | #/sim, #/sim/sc/skeleton, #/sim/sc/skeleton/exam |
| click | Mark done: Read how the program works | cannot click: elementHandle.click: Timeout 3000ms exceeded. | #/path/s00 |
| crawler |  | stopped after 8 minutes; 14 controls not clicked | #/practice, #/reels |
| csp | Sync progress | after click: csp: Connecting to 'https://sync.test/exec?k=test&action=load' violates the following Content Security Policy directive: "connect-src 'self' https://script.google.com https://script.googleusercontent.com h | #/profile |
| csp | Sync progress | after click: csp: Fetch API cannot load https://sync.test/exec?k=test&action=load. Refused to connect because it violates the document's Content Security Policy. | #/profile |
| csp | Ask | after click: csp: Connecting to 'https://sync.test/exec?k=test' violates the following Content Security Policy directive: "connect-src 'self' https://script.google.com https://script.googleusercontent.com https://accou | #/dsa/d011, #/sql/q011 |
| csp | Ask | after click: csp: Fetch API cannot load https://sync.test/exec?k=test. Refused to connect because it violates the document's Content Security Policy. | #/dsa/d011, #/sql/q011 |
| csp | Review my code | after click: csp: Connecting to 'https://sync.test/exec?k=test' violates the following Content Security Policy directive: "connect-src 'self' https://script.google.com https://script.googleusercontent.com https://accou | #/dsa/d011, #/sql/q011 |
| csp | Review my code | after click: csp: Fetch API cannot load https://sync.test/exec?k=test. Refused to connect because it violates the document's Content Security Policy. | #/dsa/d011, #/sql/q011 |
| error | Download JSON | after click: console: Failed to preconnect to https://fonts.googleapis.com/. Error: Preconnection timed out | #/sim/sc/skeleton/exam |
| error | GW API gateway Auth, routing and an optional rate limit | after click: console: Failed to preconnect to https://fonts.googleapis.com/. Error: Preconnection timed out | #/sim/teach/stream |
| error | Close | after click: console: Failed to preconnect to https://fonts.googleapis.com/. Error: Preconnection timed out | #/today |
| error | ▶ Play Swipe up for the next reel · tap the sides to step | after click: console: Failed to preconnect to https://fonts.googleapis.com/. Error: Preconnection timed out | #/reels |
| error |  | on load: console: Failed to preconnect to https://fonts.googleapis.com/. Error: The Internet connection appears to be offline. | #/playbook, #/path |
| crawler |  | stopped after 8 minutes; 11 controls not clicked | #/practice |
| csp | Sync progress | after click: csp: Refused to connect to https://sync.test/exec?k=test&action=load because it does not appear in the connect-src directive of the Content Security Policy. | #/profile |

## Tap-target exceptions

The simulator canvas (`.simnode`, `.simedge`: boxes and wires scale with zoom, and the toolbar zooms in) and the 84-square DSA heat-map on Progress (`.dsa-grid`: an overview; every problem is also a full-size row in Practice) are not held to 44 px.

## Skipped on purpose (destructive)

| Control | Screens |
|---|---|
| Reset | #/design, #/sim, #/sim/sc/skeleton, #/sim/sc/skeleton/exam, #/sim/teach/stream |
| Import JSON | #/sim, #/sim/sc/skeleton, #/sim/sc/skeleton/exam, #/sim/teach/stream |
| Clear the screen | #/terminal |
| Reset and exit | #/quiz/s00 |
| Start over | #/sim/sc/skeleton, #/sim/sc/skeleton/exam |
| Clear | #/dsa/d011, #/sql/q011 |

## What clicks did

| Effect | Clicks |
|---|---|
| route | 3989 |
| scrolled | 2041 |
| state | 431 |
| external | 427 |
| not | 402 |
| content | 322 |
| toast | 126 |
| already | 70 |
| dialog | 70 |
| download | 52 |
| sound | 40 |
| focus | 35 |
| changed | 11 |
| redrawn | 9 |
| none | 6 |
| disabled | 4 |
| no | 3 |
| error | 1 |

## Screens: chromium / fresh

| Screen | Controls | Clicked | Seconds |
|---|---|---|---|
| #/today | 51 | 93 | 190 |
| #/reels | 18 | 18 | 84 |
| #/playbook | 0 | 0 | 1 |
| #/path | 44 | 44 | 53 |
| #/learn/s00 | 15 | 10 | 13 |
| #/practice | 38 | 238 | 385 |
| #/projects | 15 | 15 | 19 |
| #/design | 13 | 12 | 15 |
| #/sim | 61 | 91 | 136 |
| #/loop | 11 | 20 | 26 |
| #/git | 18 | 18 | 23 |
| #/terminal | 9 | 8 | 13 |
| #/news | 1 | 1 | 2 |
| #/recent | 148 | 44 | 58 |
| #/quiz/s00 | 30 | 8 | 12 |
| #/mock | 2 | 2 | 3 |
| #/coach | 1 | 0 | 2 |
| #/progress | 122 | 122 | 151 |
| #/live | 4 | 4 | 6 |
| #/profile | 11 | 17 | 22 |
| #/path/s00 | 35 | 34 | 258 |
| #/today/1 | 17 | 32 | 42 |
| #/warm | 4 | 1 | 3 |
| #/live/2026-11-08 | 4 | 4 | 5 |
| #/interview/s00 | 2 | 2 | 3 |
| #/practice/all | 38 | 21 | 26 |
| #/practice/review | 9 | 0 | 1 |
| #/practice/py | 51 | 42 | 50 |
| #/practice/model | 34 | 25 | 30 |
| #/practice/dsa | 28 | 0 | 1 |
| #/practice/sql | 26 | 0 | 1 |
| #/practice/spark | 26 | 0 | 1 |
| #/practice/opt | 45 | 0 | 1 |
| #/practice/tests | 60 | 51 | 71 |
| #/learn/s00/chapter | 15 | 4 | 5 |
| #/learn/s00/readings | 7 | 3 | 4 |
| #/learn/s00/lab | 11 | 1 | 2 |
| #/learn/s00/practice | 7 | 0 | 1 |
| #/learn/p01/chapter | 31 | 11 | 15 |
| #/learn/p01/readings | 10 | 0 | 1 |
| #/learn/p01/lab | 11 | 0 | 1 |
| #/learn/p01/practice | 13 | 0 | 1 |
| #/learn/p02/chapter | 23 | 0 | 1 |
| #/learn/p02/readings | 10 | 0 | 1 |
| #/learn/p02/lab | 11 | 0 | 1 |
| #/learn/p02/practice | 13 | 0 | 1 |
| #/learn/a01/chapter | 22 | 3 | 4 |
| #/learn/a01/readings | 11 | 0 | 1 |
| #/learn/a01/lab | 13 | 0 | 1 |
| #/learn/a01/practice | 7 | 0 | 1 |
| #/learn/p03/chapter | 24 | 0 | 1 |
| #/learn/p03/readings | 9 | 0 | 1 |
| #/learn/p03/lab | 11 | 0 | 1 |
| #/learn/p03/practice | 13 | 0 | 1 |
| #/learn/p04/chapter | 25 | 0 | 1 |
| #/learn/p04/readings | 10 | 0 | 1 |
| #/learn/p04/lab | 11 | 0 | 1 |
| #/learn/p04/practice | 13 | 0 | 1 |
| #/learn/a02/chapter | 22 | 0 | 1 |
| #/learn/a02/readings | 11 | 0 | 1 |
| #/learn/a02/lab | 12 | 0 | 1 |
| #/learn/a02/practice | 7 | 0 | 1 |
| #/learn/p05/chapter | 21 | 0 | 1 |
| #/learn/p05/readings | 12 | 0 | 1 |
| #/learn/p05/lab | 11 | 0 | 1 |
| #/learn/p05/practice | 13 | 0 | 1 |
| #/learn/p06/chapter | 22 | 0 | 1 |
| #/learn/p06/readings | 11 | 0 | 1 |
| #/learn/p06/lab | 11 | 0 | 1 |
| #/learn/p06/practice | 13 | 0 | 1 |
| #/learn/a03/chapter | 21 | 0 | 1 |
| #/learn/a03/readings | 11 | 0 | 1 |
| #/learn/a03/lab | 11 | 0 | 1 |
| #/learn/a03/practice | 7 | 0 | 1 |
| #/learn/m01/chapter | 29 | 3 | 4 |
| #/learn/m01/readings | 10 | 0 | 1 |
| #/learn/m01/lab | 11 | 0 | 1 |
| #/learn/m01/practice | 11 | 0 | 1 |
| #/learn/m02/chapter | 23 | 0 | 1 |
| #/learn/m02/readings | 10 | 0 | 1 |
| #/learn/m02/lab | 11 | 0 | 1 |
| #/learn/m02/practice | 11 | 0 | 1 |
| #/learn/m03/chapter | 22 | 0 | 1 |
| #/learn/m03/readings | 11 | 0 | 1 |
| #/learn/m03/lab | 11 | 0 | 1 |
| #/learn/m03/practice | 8 | 0 | 1 |
| #/learn/s01/chapter | 40 | 7 | 9 |
| #/learn/s01/readings | 15 | 0 | 1 |
| #/learn/s01/lab | 13 | 1 | 2 |
| #/learn/s01/practice | 11 | 0 | 1 |
| #/learn/s02/chapter | 32 | 0 | 1 |
| #/learn/s02/readings | 10 | 0 | 1 |
| #/learn/s02/lab | 11 | 0 | 1 |
| #/learn/s02/practice | 11 | 0 | 1 |
| #/learn/s03/chapter | 38 | 1 | 2 |
| #/learn/s03/readings | 10 | 0 | 1 |
| #/learn/s03/lab | 12 | 1 | 2 |
| #/learn/s03/practice | 11 | 0 | 1 |
| #/learn/s04/chapter | 37 | 0 | 1 |
| #/learn/s04/readings | 11 | 0 | 1 |
| #/learn/s04/lab | 11 | 0 | 1 |
| #/learn/s04/practice | 11 | 0 | 1 |
| #/learn/a04/chapter | 21 | 0 | 1 |
| #/learn/a04/readings | 7 | 0 | 1 |
| #/learn/a04/lab | 11 | 0 | 1 |
| #/learn/a04/practice | 7 | 0 | 1 |
| #/learn/d01/chapter | 52 | 3 | 4 |
| #/learn/d01/readings | 12 | 0 | 1 |
| #/learn/d01/lab | 11 | 0 | 1 |
| #/learn/d01/practice | 12 | 0 | 1 |
| #/learn/s05/chapter | 44 | 6 | 8 |
| #/learn/s05/readings | 14 | 0 | 1 |
| #/learn/s05/lab | 15 | 3 | 4 |
| #/learn/s05/practice | 11 | 0 | 1 |
| #/learn/s06/chapter | 28 | 2 | 3 |
| #/learn/s06/readings | 13 | 0 | 1 |
| #/learn/s06/lab | 14 | 2 | 3 |
| #/learn/s06/practice | 11 | 0 | 1 |
| #/learn/a05/chapter | 21 | 1 | 2 |
| #/learn/a05/readings | 7 | 0 | 1 |
| #/learn/a05/lab | 12 | 1 | 2 |
| #/learn/a05/practice | 7 | 0 | 1 |
| #/learn/s07/chapter | 27 | 1 | 2 |
| #/learn/s07/readings | 11 | 0 | 1 |
| #/learn/s07/lab | 12 | 1 | 2 |
| #/learn/s07/practice | 11 | 0 | 1 |
| #/learn/j01/chapter | 22 | 3 | 4 |
| #/learn/j01/readings | 12 | 0 | 1 |
| #/learn/j01/lab | 10 | 0 | 1 |
| #/learn/j01/practice | 11 | 0 | 1 |
| #/learn/s08/chapter | 24 | 1 | 2 |
| #/learn/s08/readings | 12 | 0 | 1 |
| #/learn/s08/lab | 11 | 0 | 1 |
| #/learn/s08/practice | 11 | 0 | 1 |
| #/learn/s09/chapter | 29 | 3 | 4 |
| #/learn/s09/readings | 11 | 0 | 1 |
| #/learn/s09/lab | 14 | 3 | 4 |
| #/learn/s09/practice | 11 | 0 | 1 |
| #/learn/s10/chapter | 33 | 10 | 12 |
| #/learn/s10/readings | 11 | 0 | 1 |
| #/learn/s10/lab | 18 | 6 | 8 |
| #/learn/s10/practice | 10 | 0 | 1 |
| #/learn/r01/chapter | 24 | 3 | 4 |
| #/learn/r01/readings | 12 | 0 | 1 |
| #/learn/r01/lab | 10 | 0 | 1 |
| #/learn/r01/practice | 8 | 0 | 1 |
| #/learn/s11/chapter | 24 | 2 | 3 |
| #/learn/s11/readings | 12 | 0 | 1 |
| #/learn/s11/lab | 13 | 2 | 3 |
| #/learn/s11/practice | 10 | 0 | 1 |
| #/learn/s12/chapter | 21 | 0 | 1 |
| #/learn/s12/readings | 8 | 0 | 1 |
| #/learn/s12/lab | 10 | 0 | 1 |
| #/learn/s12/practice | 7 | 0 | 1 |
| #/learn/c01/chapter | 19 | 3 | 4 |
| #/learn/c01/readings | 11 | 0 | 1 |
| #/learn/c01/lab | 14 | 1 | 2 |
| #/learn/c01/practice | 7 | 0 | 1 |
| #/learn/c02/chapter | 19 | 0 | 1 |
| #/learn/c02/readings | 10 | 0 | 1 |
| #/learn/c02/lab | 11 | 1 | 2 |
| #/learn/c02/practice | 7 | 0 | 1 |
| #/learn/c03/chapter | 19 | 0 | 1 |
| #/learn/c03/readings | 10 | 0 | 1 |
| #/learn/c03/lab | 11 | 1 | 2 |
| #/learn/c03/practice | 7 | 0 | 1 |
| #/learn/c04/chapter | 19 | 0 | 1 |
| #/learn/c04/readings | 10 | 0 | 1 |
| #/learn/c04/lab | 11 | 0 | 1 |
| #/learn/c04/practice | 7 | 0 | 1 |
| #/learn/c05/chapter | 19 | 0 | 1 |
| #/learn/c05/readings | 11 | 0 | 1 |
| #/learn/c05/lab | 11 | 0 | 1 |
| #/learn/c05/practice | 7 | 0 | 1 |
| #/learn/c06/chapter | 19 | 0 | 1 |
| #/learn/c06/readings | 10 | 0 | 1 |
| #/learn/c06/lab | 11 | 0 | 1 |
| #/learn/c06/practice | 7 | 0 | 1 |
| #/learn/c07/chapter | 19 | 0 | 1 |
| #/learn/c07/readings | 10 | 0 | 1 |
| #/learn/c07/lab | 11 | 0 | 1 |
| #/learn/c07/practice | 7 | 0 | 1 |
| #/learn/c08/chapter | 19 | 0 | 1 |
| #/learn/c08/readings | 9 | 0 | 1 |
| #/learn/c08/lab | 11 | 0 | 1 |
| #/learn/c08/practice | 7 | 0 | 1 |
| #/learn/c09/chapter | 19 | 0 | 1 |
| #/learn/c09/readings | 10 | 0 | 1 |
| #/learn/c09/lab | 11 | 0 | 1 |
| #/learn/c09/practice | 7 | 0 | 1 |
| #/learn/c10/chapter | 19 | 0 | 1 |
| #/learn/c10/readings | 10 | 0 | 1 |
| #/learn/c10/lab | 11 | 0 | 1 |
| #/learn/c10/practice | 7 | 0 | 1 |
| #/learn/c11/chapter | 19 | 0 | 1 |
| #/learn/c11/readings | 10 | 0 | 1 |
| #/learn/c11/lab | 11 | 0 | 1 |
| #/learn/c11/practice | 7 | 0 | 1 |
| #/learn/c12/chapter | 19 | 0 | 1 |
| #/learn/c12/readings | 10 | 0 | 1 |
| #/learn/c12/lab | 11 | 0 | 1 |
| #/learn/c12/practice | 7 | 0 | 1 |
| #/mock/s00 | 2 | 2 | 3 |
| #/sim/sc/skeleton | 63 | 85 | 124 |
| #/sim/sc/skeleton/exam | 62 | 75 | 104 |
| #/sim/teach/stream | 61 | 91 | 129 |
| #/dsa/d011 | 15 | 15 | 18 |
| #/sql/q011 | 17 | 16 | 19 |
| #/spark/p011 | 17 | 3 | 4 |
| #/project/ai-1 | 8 | 5 | 6 |
| #/git/1 | 18 | 18 | 22 |
| #/reels/s05-51-w0 | 8 | 8 | 40 |

## Screens: chromium / mid

| Screen | Controls | Clicked | Seconds |
|---|---|---|---|
| #/today | 51 | 96 | 129 |
| #/reels | 18 | 18 | 84 |
| #/playbook | 0 | 0 | 1 |
| #/practice | 39 | 238 | 349 |
| #/sim | 61 | 91 | 142 |
| #/profile | 11 | 17 | 22 |
| #/path/s00 | 35 | 34 | 43 |
| #/today/1 | 17 | 32 | 44 |
| #/practice/all | 39 | 21 | 28 |
| #/practice/review | 12 | 3 | 5 |
| #/practice/py | 51 | 42 | 52 |
| #/practice/model | 34 | 25 | 30 |
| #/practice/dsa | 29 | 0 | 1 |
| #/practice/sql | 26 | 0 | 1 |
| #/practice/spark | 26 | 0 | 1 |
| #/practice/opt | 45 | 0 | 1 |
| #/practice/tests | 60 | 51 | 61 |
| #/sim/sc/skeleton | 63 | 85 | 127 |
| #/sim/sc/skeleton/exam | 62 | 75 | 107 |
| #/sim/teach/stream | 61 | 91 | 157 |
| #/dsa/d011 | 15 | 15 | 19 |
| #/sql/q011 | 17 | 16 | 20 |
| #/reels/s05-51-w0 | 8 | 8 | 40 |

## Screens: chromium / mid

| Screen | Controls | Clicked | Seconds |
|---|---|---|---|
| #/today | 51 | 96 | 126 |
| #/reels | 18 | 18 | 83 |
| #/playbook | 0 | 0 | 1 |
| #/path | 44 | 44 | 53 |
| #/learn/s00 | 7 | 7 | 9 |
| #/practice | 39 | 224 | 10657 |
| #/projects | 15 | 15 | 21 |
| #/design | 13 | 12 | 79 |
| #/sim | 61 | 91 | 177 |
| #/loop | 11 | 20 | 29 |
| #/git | 18 | 18 | 27 |
| #/terminal | 9 | 8 | 15 |
| #/news | 1 | 1 | 2 |
| #/recent | 148 | 44 | 69 |
| #/quiz/s00 | 30 | 7 | 13 |
| #/mock | 2 | 2 | 3 |
| #/coach | 1 | 0 | 1 |
| #/progress | 122 | 122 | 152 |
| #/live | 4 | 4 | 7 |
| #/profile | 11 | 17 | 25 |
| #/path/s00 | 35 | 34 | 98 |
| #/today/1 | 17 | 32 | 43 |
| #/warm | 4 | 0 | 3 |
| #/live/2026-11-08 | 4 | 4 | 5 |
| #/interview/s00 | 2 | 2 | 3 |
| #/practice/all | 39 | 35 | 47 |
| #/practice/review | 12 | 3 | 6 |
| #/practice/py | 51 | 42 | 74 |
| #/practice/model | 34 | 25 | 40 |
| #/practice/dsa | 29 | 0 | 1 |
| #/practice/sql | 26 | 0 | 1 |
| #/practice/spark | 26 | 0 | 1 |
| #/practice/opt | 45 | 0 | 1 |
| #/practice/tests | 60 | 51 | 188 |
| #/learn/s00/chapter | 15 | 8 | 10 |
| #/learn/s00/readings | 7 | 4 | 6 |
| #/learn/s00/lab | 11 | 2 | 3 |
| #/learn/s00/practice | 7 | 0 | 1 |
| #/mock/s00 | 2 | 2 | 4 |
| #/sim/sc/skeleton | 63 | 85 | 132 |
| #/sim/sc/skeleton/exam | 62 | 75 | 124 |
| #/sim/teach/stream | 61 | 91 | 172 |
| #/dsa/d011 | 15 | 15 | 23 |
| #/sql/q011 | 17 | 16 | 25 |
| #/spark/p011 | 17 | 3 | 5 |
| #/project/ai-1 | 8 | 5 | 7 |
| #/git/1 | 18 | 18 | 27 |
| #/reels/s05-51-w0 | 8 | 8 | 41 |

## Screens: webkit / fresh

| Screen | Controls | Clicked | Seconds |
|---|---|---|---|
| #/today | 46 | 71 | 130 |
| #/reels | 18 | 18 | 86 |
| #/playbook | 0 | 0 | 1 |
| #/path | 44 | 44 | 64 |
| #/learn/s00 | 8 | 10 | 16 |
| #/practice | 38 | 238 | 385 |
| #/projects | 15 | 15 | 21 |
| #/design | 13 | 12 | 15 |
| #/sim | 61 | 91 | 139 |
| #/loop | 11 | 20 | 28 |
| #/git | 18 | 18 | 28 |
| #/terminal | 9 | 8 | 17 |
| #/news | 1 | 1 | 2 |
| #/recent | 148 | 44 | 63 |
| #/quiz/s00 | 30 | 8 | 17 |
| #/mock | 2 | 2 | 5 |
| #/coach | 1 | 0 | 1 |
| #/progress | 122 | 122 | 187 |
| #/live | 4 | 4 | 6 |
| #/profile | 11 | 17 | 23 |
| #/path/s00 | 35 | 34 | 53 |
| #/today/1 | 17 | 32 | 64 |
| #/warm | 4 | 0 | 5 |
| #/live/2026-11-08 | 4 | 4 | 5 |
| #/interview/s00 | 2 | 2 | 7 |
| #/practice/all | 38 | 21 | 37 |
| #/practice/review | 9 | 0 | 1 |
| #/practice/py | 51 | 42 | 89 |
| #/practice/model | 34 | 25 | 45 |
| #/practice/dsa | 28 | 0 | 1 |
| #/practice/sql | 26 | 0 | 1 |
| #/practice/spark | 26 | 0 | 1 |
| #/practice/opt | 45 | 0 | 1 |
| #/practice/tests | 60 | 51 | 83 |
| #/learn/s00/chapter | 8 | 4 | 8 |
| #/learn/s00/readings | 7 | 3 | 6 |
| #/learn/s00/lab | 8 | 1 | 3 |
| #/learn/s00/practice | 7 | 0 | 1 |
| #/learn/p01/chapter | 23 | 11 | 28 |
| #/learn/p01/readings | 10 | 0 | 1 |
| #/learn/p01/lab | 8 | 0 | 2 |
| #/learn/p01/practice | 13 | 0 | 1 |
| #/learn/p02/chapter | 16 | 0 | 2 |
| #/learn/p02/readings | 10 | 0 | 1 |
| #/learn/p02/lab | 8 | 0 | 1 |
| #/learn/p02/practice | 13 | 0 | 1 |
| #/learn/a01/chapter | 15 | 3 | 4 |
| #/learn/a01/readings | 11 | 0 | 1 |
| #/learn/a01/lab | 8 | 0 | 2 |
| #/learn/a01/practice | 7 | 0 | 1 |
| #/learn/p03/chapter | 18 | 0 | 1 |
| #/learn/p03/readings | 9 | 0 | 1 |
| #/learn/p03/lab | 8 | 0 | 1 |
| #/learn/p03/practice | 13 | 0 | 4 |
| #/learn/p04/chapter | 17 | 0 | 3 |
| #/learn/p04/readings | 10 | 0 | 1 |
| #/learn/p04/lab | 8 | 0 | 1 |
| #/learn/p04/practice | 13 | 0 | 2 |
| #/learn/a02/chapter | 15 | 0 | 1 |
| #/learn/a02/readings | 11 | 0 | 1 |
| #/learn/a02/lab | 8 | 0 | 2 |
| #/learn/a02/practice | 7 | 0 | 2 |
| #/learn/p05/chapter | 15 | 0 | 1 |
| #/learn/p05/readings | 12 | 0 | 2 |
| #/learn/p05/lab | 8 | 0 | 1 |
| #/learn/p05/practice | 13 | 0 | 2 |
| #/learn/p06/chapter | 15 | 0 | 2 |
| #/learn/p06/readings | 11 | 0 | 1 |
| #/learn/p06/lab | 8 | 0 | 1 |
| #/learn/p06/practice | 13 | 0 | 1 |
| #/learn/a03/chapter | 14 | 0 | 2 |
| #/learn/a03/readings | 11 | 0 | 1 |
| #/learn/a03/lab | 8 | 0 | 1 |
| #/learn/a03/practice | 7 | 0 | 1 |
| #/learn/m01/chapter | 21 | 3 | 7 |
| #/learn/m01/readings | 10 | 0 | 1 |
| #/learn/m01/lab | 8 | 0 | 1 |
| #/learn/m01/practice | 11 | 0 | 1 |
| #/learn/m02/chapter | 16 | 0 | 1 |
| #/learn/m02/readings | 10 | 0 | 1 |
| #/learn/m02/lab | 8 | 0 | 3 |
| #/learn/m02/practice | 11 | 0 | 1 |
| #/learn/m03/chapter | 15 | 0 | 1 |
| #/learn/m03/readings | 11 | 0 | 2 |
| #/learn/m03/lab | 8 | 0 | 1 |
| #/learn/m03/practice | 8 | 0 | 1 |
| #/learn/s01/chapter | 31 | 7 | 12 |
| #/learn/s01/readings | 15 | 0 | 1 |
| #/learn/s01/lab | 9 | 1 | 2 |
| #/learn/s01/practice | 8 | 0 | 1 |
| #/learn/s02/chapter | 23 | 0 | 1 |
| #/learn/s02/readings | 10 | 0 | 1 |
| #/learn/s02/lab | 8 | 0 | 1 |
| #/learn/s02/practice | 8 | 0 | 1 |
| #/learn/s03/chapter | 28 | 1 | 2 |
| #/learn/s03/readings | 10 | 0 | 1 |
| #/learn/s03/lab | 9 | 1 | 2 |
| #/learn/s03/practice | 8 | 0 | 1 |
| #/learn/s04/chapter | 27 | 0 | 1 |
| #/learn/s04/readings | 11 | 0 | 1 |
| #/learn/s04/lab | 8 | 0 | 1 |
| #/learn/s04/practice | 8 | 0 | 1 |
| #/learn/a04/chapter | 15 | 0 | 1 |
| #/learn/a04/readings | 7 | 0 | 1 |
| #/learn/a04/lab | 8 | 0 | 1 |
| #/learn/a04/practice | 7 | 0 | 1 |
| #/learn/d01/chapter | 44 | 3 | 5 |
| #/learn/d01/readings | 12 | 0 | 1 |
| #/learn/d01/lab | 8 | 0 | 1 |
| #/learn/d01/practice | 12 | 0 | 1 |
| #/learn/s05/chapter | 34 | 6 | 11 |
| #/learn/s05/readings | 14 | 0 | 1 |
| #/learn/s05/lab | 11 | 3 | 6 |
| #/learn/s05/practice | 8 | 0 | 1 |
| #/learn/s06/chapter | 20 | 2 | 5 |
| #/learn/s06/readings | 13 | 0 | 1 |
| #/learn/s06/lab | 10 | 2 | 4 |
| #/learn/s06/practice | 8 | 0 | 1 |
| #/learn/a05/chapter | 15 | 1 | 4 |
| #/learn/a05/readings | 7 | 0 | 1 |
| #/learn/a05/lab | 9 | 1 | 3 |
| #/learn/a05/practice | 7 | 0 | 1 |
| #/learn/s07/chapter | 18 | 1 | 2 |
| #/learn/s07/readings | 11 | 0 | 1 |
| #/learn/s07/lab | 9 | 1 | 3 |
| #/learn/s07/practice | 8 | 0 | 1 |
| #/learn/j01/chapter | 15 | 3 | 4 |
| #/learn/j01/readings | 12 | 0 | 1 |
| #/learn/j01/lab | 8 | 0 | 1 |
| #/learn/j01/practice | 11 | 0 | 1 |
| #/learn/s08/chapter | 17 | 1 | 2 |
| #/learn/s08/readings | 12 | 0 | 1 |
| #/learn/s08/lab | 8 | 0 | 1 |
| #/learn/s08/practice | 8 | 0 | 1 |
| #/learn/s09/chapter | 21 | 3 | 5 |
| #/learn/s09/readings | 11 | 0 | 1 |
| #/learn/s09/lab | 11 | 3 | 4 |
| #/learn/s09/practice | 8 | 0 | 1 |
| #/learn/s10/chapter | 26 | 10 | 18 |
| #/learn/s10/readings | 11 | 0 | 1 |
| #/learn/s10/lab | 15 | 6 | 14 |
| #/learn/s10/practice | 8 | 0 | 1 |
| #/learn/r01/chapter | 18 | 3 | 11 |
| #/learn/r01/readings | 12 | 0 | 5 |
| #/learn/r01/lab | 8 | 0 | 1 |
| #/learn/r01/practice | 8 | 0 | 4 |
| #/learn/s11/chapter | 17 | 2 | 8 |
| #/learn/s11/readings | 12 | 0 | 1 |
| #/learn/s11/lab | 10 | 2 | 7 |
| #/learn/s11/practice | 8 | 0 | 1 |
| #/learn/s12/chapter | 14 | 0 | 1 |
| #/learn/s12/readings | 8 | 0 | 1 |
| #/learn/s12/lab | 8 | 0 | 1 |
| #/learn/s12/practice | 7 | 0 | 6 |
| #/learn/c01/chapter | 15 | 3 | 4 |
| #/learn/c01/readings | 11 | 0 | 1 |
| #/learn/c01/lab | 12 | 1 | 7 |
| #/learn/c01/practice | 7 | 0 | 1 |
| #/learn/c02/chapter | 15 | 0 | 1 |
| #/learn/c02/readings | 10 | 0 | 1 |
| #/learn/c02/lab | 11 | 1 | 2 |
| #/learn/c02/practice | 7 | 0 | 6 |
| #/learn/c03/chapter | 15 | 0 | 1 |
| #/learn/c03/readings | 10 | 0 | 1 |
| #/learn/c03/lab | 11 | 1 | 2 |
| #/learn/c03/practice | 7 | 0 | 1 |
| #/learn/c04/chapter | 15 | 0 | 6 |
| #/learn/c04/readings | 10 | 0 | 1 |
| #/learn/c04/lab | 11 | 0 | 1 |
| #/learn/c04/practice | 7 | 0 | 1 |
| #/learn/c05/chapter | 15 | 0 | 1 |
| #/learn/c05/readings | 11 | 0 | 1 |
| #/learn/c05/lab | 11 | 0 | 1 |
| #/learn/c05/practice | 7 | 0 | 11 |
| #/learn/c06/chapter | 15 | 0 | 1 |
| #/learn/c06/readings | 10 | 0 | 1 |
| #/learn/c06/lab | 11 | 0 | 1 |
| #/learn/c06/practice | 7 | 0 | 1 |
| #/learn/c07/chapter | 15 | 0 | 1 |
| #/learn/c07/readings | 10 | 0 | 1 |
| #/learn/c07/lab | 11 | 0 | 1 |
| #/learn/c07/practice | 7 | 0 | 1 |
| #/learn/c08/chapter | 15 | 0 | 1 |
| #/learn/c08/readings | 9 | 0 | 1 |
| #/learn/c08/lab | 11 | 0 | 1 |
| #/learn/c08/practice | 7 | 0 | 1 |
| #/learn/c09/chapter | 15 | 0 | 10 |
| #/learn/c09/readings | 10 | 0 | 1 |
| #/learn/c09/lab | 11 | 0 | 1 |
| #/learn/c09/practice | 7 | 0 | 1 |
| #/learn/c10/chapter | 15 | 0 | 1 |
| #/learn/c10/readings | 10 | 0 | 1 |
| #/learn/c10/lab | 11 | 0 | 1 |
| #/learn/c10/practice | 7 | 0 | 1 |
| #/learn/c11/chapter | 15 | 0 | 1 |
| #/learn/c11/readings | 10 | 0 | 4 |
| #/learn/c11/lab | 11 | 0 | 1 |
| #/learn/c11/practice | 7 | 0 | 1 |
| #/learn/c12/chapter | 15 | 0 | 1 |
| #/learn/c12/readings | 10 | 0 | 1 |
| #/learn/c12/lab | 11 | 0 | 1 |
| #/learn/c12/practice | 7 | 0 | 8 |
| #/mock/s00 | 2 | 2 | 3 |
| #/sim/sc/skeleton | 63 | 85 | 171 |
| #/sim/sc/skeleton/exam | 62 | 75 | 150 |
| #/sim/teach/stream | 61 | 91 | 202 |
| #/dsa/d011 | 10 | 10 | 19 |
| #/sql/q011 | 12 | 12 | 22 |
| #/spark/p011 | 12 | 2 | 14 |
| #/project/ai-1 | 8 | 5 | 15 |
| #/git/1 | 18 | 18 | 37 |
| #/reels/s05-51-w0 | 8 | 8 | 56 |

## Screens: webkit / mid

| Screen | Controls | Clicked | Seconds |
|---|---|---|---|
| #/today | 46 | 75 | 125 |
| #/reels | 18 | 18 | 90 |
| #/playbook | 0 | 0 | 1 |
| #/practice | 39 | 238 | 436 |
| #/sim | 61 | 91 | 198 |
| #/profile | 11 | 17 | 27 |
| #/path/s00 | 35 | 34 | 60 |
| #/today/1 | 17 | 32 | 65 |
| #/practice/all | 39 | 21 | 28 |
| #/practice/review | 12 | 3 | 5 |
| #/practice/py | 51 | 42 | 63 |
| #/practice/model | 34 | 25 | 34 |
| #/practice/dsa | 29 | 0 | 1 |
| #/practice/sql | 26 | 0 | 1 |
| #/practice/spark | 26 | 0 | 1 |
| #/practice/opt | 45 | 0 | 1 |
| #/practice/tests | 60 | 51 | 81 |
| #/sim/sc/skeleton | 63 | 85 | 184 |
| #/sim/sc/skeleton/exam | 62 | 75 | 143 |
| #/sim/teach/stream | 61 | 91 | 164 |
| #/dsa/d011 | 10 | 10 | 20 |
| #/sql/q011 | 12 | 12 | 21 |
| #/reels/s05-51-w0 | 8 | 8 | 41 |

## Screens: webkit / mid

| Screen | Controls | Clicked | Seconds |
|---|---|---|---|
| #/today | 46 | 75 | 136 |
| #/reels | 18 | 4 | 10373 |
| #/playbook | 0 | 0 | 2 |
| #/path | 44 | 44 | 110 |
| #/learn/s00 | 7 | 7 | 13 |
| #/practice | 39 | 227 | 486 |
| #/projects | 15 | 15 | 34 |
| #/design | 13 | 12 | 17 |
| #/sim | 61 | 91 | 147 |
| #/loop | 11 | 20 | 31 |
| #/git | 18 | 18 | 51 |
| #/terminal | 9 | 8 | 24 |
| #/news | 1 | 1 | 3 |
| #/recent | 148 | 44 | 92 |
| #/quiz/s00 | 30 | 7 | 23 |
| #/mock | 2 | 2 | 5 |
| #/coach | 1 | 0 | 3 |
| #/progress | 122 | 122 | 185 |
| #/live | 4 | 4 | 7 |
| #/profile | 11 | 17 | 25 |
| #/path/s00 | 35 | 34 | 85 |
| #/today/1 | 17 | 32 | 55 |
| #/warm | 4 | 0 | 3 |
| #/live/2026-11-08 | 4 | 4 | 6 |
| #/interview/s00 | 2 | 2 | 3 |
| #/practice/all | 39 | 32 | 58 |
| #/practice/review | 12 | 3 | 11 |
| #/practice/py | 51 | 42 | 68 |
| #/practice/model | 34 | 25 | 41 |
| #/practice/dsa | 29 | 0 | 1 |
| #/practice/sql | 26 | 0 | 1 |
| #/practice/spark | 26 | 0 | 1 |
| #/practice/opt | 45 | 0 | 1 |
| #/practice/tests | 60 | 51 | 88 |
| #/learn/s00/chapter | 8 | 8 | 17 |
| #/learn/s00/readings | 7 | 4 | 8 |
| #/learn/s00/lab | 8 | 2 | 4 |
| #/learn/s00/practice | 7 | 0 | 1 |
| #/mock/s00 | 2 | 2 | 5 |
| #/sim/sc/skeleton | 63 | 85 | 190 |
| #/sim/sc/skeleton/exam | 62 | 75 | 126 |
| #/sim/teach/stream | 61 | 91 | 158 |
| #/dsa/d011 | 10 | 10 | 15 |
| #/sql/q011 | 12 | 12 | 18 |
| #/spark/p011 | 12 | 2 | 8 |
| #/project/ai-1 | 8 | 5 | 11 |
| #/git/1 | 18 | 18 | 43 |
| #/reels/s05-51-w0 | 8 | 8 | 44 |

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
