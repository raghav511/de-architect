# Weekly design simulator check

Run every Sunday by the scheduled task `data-architect-weekly-sim-check`. It keeps the in-app design simulator (`#/sim`, `js/sim.js`) at least as capable as the reference simulator, and ships what is missing as one PR that it merges itself.

Work in a clean clone (`~/.data-architect/refresh-repo`: `git checkout main && git pull`), on a new branch `sim/YYYY-MM-DD`. Never work in another session's checkout.

## 1. Look at the reference

Open https://syssimulator.com/simulator and its home page (https://syssimulator.com/) in the built-in browser at a desktop size (1400×900; it refuses narrow windows). The simulator is drawn on a canvas, so read it through its accessibility tree: run `document.querySelector('flt-semantics-placeholder')?.click()` and then read the `flt-semantics` labels. Go through every top-bar panel (Components, Simulate, Chaos, Cost, Metrics, Blueprints, Export) and the home page's feature list.

Read only public pages. Never sign in, never send feedback, never use their AI features.

## 2. Compare

Compare what you saw with `tools/sim/features.json`. A feature is **new** when it is a capability (a kind of component, a failure type, a panel, a way to save or share, a metric), not a renamed label or a new blueprint for a web-app pattern. Record each new one in `features.json` with `ref` (their feature, in your own words) and `ours`.

Also note new reference counts (blueprints, chaos scenarios, component types) in `features.json` `note` if they changed.

## 3. Build what is new, as our own work

- Write it in `js/sim.js` in the existing style, styled with the tokens in `css/app.css`. Do not copy their code, text, names, icons, art or layout; the site is a feature reference only.
- Prefer the data engineering version of a feature (for example, a new failure should have a Kafka, CDC, Spark or warehouse variant). Tie new scenarios to modules (`mid`), and make sure each new scenario fails as given and passes when fixed the way its hint says: add the fix to `tools/sim/engine_test.js`.
- Keep the rules: fewest taps, works on iPhone and iPad (touch), autosave, designs in `S.sim` (merged per design in `mergeState`).
- If nothing is new, change nothing and ship nothing; just report "no new features".

## 4. Test and ship

- `node tools/sim/engine_test.js` (every scenario: starts failing, fix passes).
- Start a server (`python3 -m http.server 8841`) and run `node tools/flows.js http://localhost:8841/ sim`; add a journey for each new feature.
- Update `CLAUDE.md` (the design simulator line under Key mechanisms, and Recent changes).
- Ship with `tools/refresh/ship.sh NEWVER "Design simulator: <what>" "<plain note for the learner>"`, bumping the patch version above `version.json`. If it prints `NEEDS YOUR MERGE`, report the PR link.

## 5. Report

Reply with: what changed on the reference since last week, what you built (PR link), and what you chose not to build and why.
