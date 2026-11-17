# Redesign 2026-11

The design canvas (private, owner only): https://claude.ai/artifact/NMTgHBea4WJNEaWPQDJ5Fc. It holds clickable iPhone, iPad and web prototypes of every screen below.

Each screen ships on its own, test first: write its cases in `tools/redesign_test.js` (one group per screen), run them and see them fail on the current app, build until they pass, then run the full suites and ship.

| Phase | Screen | Group | Version |
|---|---|---|---|
| 1 | Colour themes, icons, buttons | (flows `settings`, a11y) | 1.37.0 |
| 2 | Today: Focus home (hero Up next, part bars, module card beside it on desktop) | `today` | 1.38.0 |
| 3 | Path: You are here, track chips, seven stages and the Claude Code track (`stagesOf`, `STAGES`, `PTRACKS`) | `path` | 1.39.0 |
| 4 | Practice hub: next ladder problem, reviews due, four bank tiles, Build and design (`vPracticeHub`, `ladderNext`, `pTabs`) | `practice` | 1.40.0 |
| 5 | Interview hub: today's live mock and the week, the ladder, nine loop rounds with company chips, also today (`vInterviewHub`; the Interview tab opens `#/interview`) | `interview` | 1.41.0 |
| 6 | Module page: header with steps done, one row of tabs Read to Interview, Continue always on screen (in `vLearn`) | `module` | 1.42.0 |
| 7 | Quiz: a segment per question, Revisit later (`st.flag`), the picker as a sheet (`.qpos`, `.qsheet`), results with a score ring, Retake and the misses first (`.qscore`, `.qmiss`) | `quiz` | 1.43.0 |
| 8 | Live mock: a start hero (who asks, how long, Start), How it is scored, step dots (`liveSteps`), a scorecard that leads with the average (`.lsc-hero`) | `live` | 1.44.0 |
| 9 | Progress: the ladder as a hero (tap a level for what it takes; `progHero`) and four weeks of streak (`streakCal`) | `progress` | 1.45.0 |
| 10 | Profile tabs | `profile` | |

Run: `node tools/redesign_test.js http://localhost:8811/ today`.
