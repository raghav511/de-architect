#!/bin/bash
# ship.sh NEWVER "title" "note1" ["note2"...]: bump version, commit, PR, merge, back to main
set -e
cd "$(dirname "$0")/../.."
NEW=$1; TITLE=$2; shift 2
OLD=$(python3 -c "import json;print(json.load(open('version.json'))['version'])")
sed -i '' "s/$OLD/$NEW/g" js/app.js index.html sw.js
python3 - "$NEW" "$@" <<'PY'
import json,sys,datetime
json.dump({"version":sys.argv[1],"date":datetime.date.today().isoformat(),"notes":sys.argv[2:]},open('version.json','w'),indent=2); open('version.json','a').write('\n')
PY
BR=$(git rev-parse --abbrev-ref HEAD)
git add -A
git commit -q -m "$TITLE" -m "$(printf '%s\n' "$@")" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q -u origin "$BR"
BODY="$(printf -- '- %s\n' "$@")

Tests: added to tools/flows.js or tools/personas/run.js.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
URL=$(gh pr create --base main --head "$BR" --title "$TITLE" --body "$BODY")
if gh pr merge "$URL" --merge --delete-branch >/dev/null 2>&1; then git checkout -q main && git pull -q; echo "merged $URL as $NEW"; else echo "NEEDS YOUR MERGE: $URL ($NEW)"; fi
