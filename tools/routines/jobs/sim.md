# Job: weekly simulator check (Sundays)

Folder and branch: the ones `run.py prep sim` printed (`~/.data-architect/runs/sim`, `sim/<date>`).

Follow `tools/sim/ROUTINE.md` from its section 1 (ignore its own clone and branch lines: prep did that). In short: open https://syssimulator.com/simulator and https://syssimulator.com/ in the built-in browser at 1400x900, read every panel through the accessibility tree, compare with `tools/sim/features.json`, and build any new capability as an original implementation in `js/sim.js` (our own code, text, names and design using the tokens in `css/app.css`; never copy their code, text, art or branding; prefer the data engineering version and tie scenarios to modules). Then run `node tools/sim/engine_test.js` and the `sim` journeys in `tools/flows.js` (never reach a real grader on 127.0.0.1:8765), update CLAUDE.md (design simulator line and Recent changes), and ship with `tools/refresh/ship.sh NEWVER "Design simulator: <what>" "<plain note>"`, a patch version above `version.json`. If nothing is new, ship nothing (`--result nothing`).

Read only public pages; never sign in, send feedback forms or use their AI features.

The `--note`: what was new, what was built, and what you chose not to build and why.
