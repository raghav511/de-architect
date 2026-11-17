# Redesign 2026-11

The design canvas (private, owner only): https://claude.ai/artifact/NMTgHBea4WJNEaWPQDJ5Fc. It holds clickable iPhone, iPad and web prototypes of every screen below.

Each screen ships on its own, test first: write its cases in `tools/redesign_test.js` (one group per screen), run them and see them fail on the current app, build until they pass, then run the full suites and ship.

| Phase | Screen | Group | Version |
|---|---|---|---|
| 1 | Colour themes, icons, buttons | (flows `settings`, a11y) | 1.37.0 |
| 2 | Today: Focus home (hero Up next, part bars, module card beside it on desktop) | `today` | 1.38.0 |
| 3 | Path | `path` | |
| 4 | Practice | `practice` | |
| 5 | Interview | `interview` | |
| 6 | Module page | `module` | |
| 7 | Quiz | `quiz` | |
| 8 | Live mock | `live` | |
| 9 | Progress | `progress` | |
| 10 | Profile tabs | `profile` | |

Run: `node tools/redesign_test.js http://localhost:8811/ today`.
