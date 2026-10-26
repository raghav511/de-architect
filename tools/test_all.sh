#!/usr/bin/env bash
# Data Architect full test loop: content, banks, scheduler, editor (Pyodide), UI crawl, git labs.
#   bash tools/test_all.sh [baseUrl]      (default http://localhost:8811/, started here if needed)
# Needs python3 + duckdb, node + playwright (set PW=/path/to/node_modules/playwright, CHROME=/path/to/chromium if not global).
set -uo pipefail
cd "$(dirname "$0")/.."
BASE="${1:-http://localhost:8811/}"
if [[ "$BASE" == http://localhost:8811/ ]] && ! curl -s -o /dev/null localhost:8811; then python3 -m http.server 8811 >/dev/null 2>&1 & sleep 1; fi
fail=0
step() { echo; echo "=== $1"; shift; "$@" || { echo "!!! FAILED: $*"; fail=1; }; }
step "content and coding-test references" python3 tools/validate.py
step "question banks against the runtime" bash -c 'python3 tools/build_bank.py | tail -2 | grep -q "problems: 0" && git diff --quiet data/bank'
step "scheduler" node tools/sched_test.js "$BASE"
step "editor: every reference solution passes" node tools/editor_test.js "$BASE"
step "editor: wrong answers fail" env NEG=1 node tools/editor_test.js "$BASE"
step "git labs" bash tools/test_gitlabs.sh
step "user journeys" node tools/flows.js "$BASE"
step "accessibility (axe, light and dark)" node tools/a11y.js "$BASE"
step "nightly coach loop (fake sync, stub coach)" bash -c '
  D=$(mktemp -d); python3 tools/coach/fake_sync.py 8813 e2ekey "$D" & SRV=$!; sleep 1; rm -rf /tmp/da-e2e-profile
  export DA_SYNC_URL="http://127.0.0.1:8813/exec?k=e2ekey"
  node tools/coach/e2e_test.js user "'"$BASE"'" "$DA_SYNC_URL" | tee "$D/u.txt" && python3 tools/coach/coach.py fetch "$D/state.json" >/dev/null &&
  python3 tools/coach/coach.py digest "$D/state.json" > "$D/digest.md" && python3 tools/coach/stub_coach.py "$D/state.json" "$D/coach.json" &&
  python3 tools/coach/coach.py post "$D/coach.json" --state "$D/state.json" && node tools/coach/e2e_test.js check "'"$BASE"'" "$DA_SYNC_URL" | tee "$D/c.txt"
  r=$?; kill $SRV; ! grep -q FAIL "$D/u.txt" "$D/c.txt" && [ $r = 0 ]'
step "UI crawl" node tools/crawl.js "$BASE" ${QUICK:+--quick}
echo; [[ $fail == 0 ]] && echo "ALL GREEN" || echo "SOME CHECKS FAILED"
exit $fail
