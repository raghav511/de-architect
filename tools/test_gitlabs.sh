#!/usr/bin/env bash
# Applies a reference solution to every git lab and checks it. Usage: bash tools/test_gitlabs.sh
set -u
export GIT_LABS_DIR=$(mktemp -d)
L=labs/git/gitlab.sh; R=$(pwd)
G="git -c user.name=T -c user.email=t@t"
sol() { case $1 in
 1) echo dag > dag.py; $G add dag.py; $G commit -q --amend -m "add pipeline and dag" ;;
 2) $G merge -q feature 2>/dev/null; printf "select city,\n count(distinct trip_id) as completed_trips\nfrom trips\ngroup by city\n" > report.sql; $G add report.sql; $G commit -qm merge ;;
 3) $G switch -q feature; $G rebase -q main; $G switch -q main ;;
 4) $G switch -q feature; $G reset -q --soft main; $G commit -qm "add work file" ;;
 5) $G revert --no-edit HEAD~1 >/dev/null; $G push -q origin main ;;
 6) h=$(git reflog | grep "important experiment" | head -1 | cut -d' ' -f1); $G branch experiment $h ;;
 7) $G stash -q; echo fixed > hotfix.txt; $G add hotfix.txt; $G commit -qm hotfix; $G stash pop -q ;;
 8) h=$(git log --format="%h %s" | grep "fix: null check" | cut -d' ' -f1); $G switch -q release; $G cherry-pick $h >/dev/null; $G switch -q main ;;
 9) $G bisect start HEAD $(git rev-list --max-parents=0 HEAD) >/dev/null; $G bisect run ../09-test.sh > /tmp/bis.txt 2>&1; m=$(grep -A6 "is the first bad commit" /tmp/bis.txt | grep -E '^ +c[0-9]' | head -1 | xargs); echo "$m" > ../09-answer.txt; $G bisect reset >/dev/null 2>&1 ;;
 10) $G branch rescue; $G switch -q main ;;
 11) cd me; $G pull -q --no-rebase --no-edit origin main 2>/dev/null || $G pull -q --rebase origin main; $G push -q origin main; cd .. ;;
 12) FILTER_BRANCH_SQUELCH_WARNING=1 $G filter-branch -f --index-filter 'git rm -q --cached --ignore-unmatch .env' -- --all >/dev/null 2>&1; rm -rf .git/refs/original; $G reflog expire --expire=now --all; $G gc -q --prune=now; echo .env > .gitignore; $G add .gitignore; $G commit -qm "ignore .env" ;;
 13) $G merge -q feature 2>/dev/null; $G checkout -q --ours lock.json; printf '{"deps": {"a": "1.1", "b": "2.0"}}\n' > lock.json; $G add lock.json; $G commit -qm merge ;;
 14) $G worktree add -q ../14-hotfix hotfix; (cd ../14-hotfix && echo hot > hotfix.txt && git add hotfix.txt && $G commit -qm hotfix); $G worktree remove ../14-hotfix ;;
 15) printf '#!/bin/sh\nif git diff --cached | grep -q "sk-live-"; then echo "secret found"; exit 1; fi\n' > .git/hooks/pre-commit; chmod +x .git/hooks/pre-commit ;;
 16) echo "https://github.com/x/y/pull/1" > pr.txt ;;
esac; }
pass=0
for n in $(seq 1 16); do
  bash $L setup $n >/dev/null 2>&1 || { echo "setup $n failed"; continue; }
  (cd "$GIT_LABS_DIR/$(printf %02d $n)" && sol $n) >/dev/null 2>&1
  if out=$(bash $L check $n 2>&1); then pass=$((pass+1)); else echo "--- lab $n"; echo "$out"; fi
done
echo "$pass/16 labs pass with the reference solution"
[[ $pass == 16 ]]
