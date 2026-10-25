#!/usr/bin/env bash
# Data Architect Git labs: each lab builds a small broken repository and checks your fix.
#   bash labs/git/gitlab.sh list
#   bash labs/git/gitlab.sh setup 3     # creates ~/git-labs/03 and prints the task
#   bash labs/git/gitlab.sh check 3     # checks your result
# Works in Codespaces and on macOS/Linux. Needs git 2.30+.
set -euo pipefail
ROOT="${GIT_LABS_DIR:-$HOME/git-labs}"
n="${2:-}"; d="$ROOT/$(printf %02d "${n:-0}")"
g() { git -c user.name="Lab Bot" -c user.email="bot@example.com" -c init.defaultBranch=main "$@"; }
c() { echo "$2" > "$1"; g add "$1"; g commit -qm "$3"; }
# checks never use `| grep -q`: under pipefail it closes the pipe early and git exits 141 (seen on macOS).
# grep -c reads all input; wc output is stripped because BSD wc pads numbers with spaces.
ok() { echo "PASS  $1"; }
no() { echo "FAIL  $1"; FAILED=1; }
FAILED=0
TITLES=(
 ""
 "Commit hygiene: fix the last commit message and add a forgotten file"
 "Your first merge conflict"
 "Rebase a feature branch onto an updated main"
 "Squash five messy commits into one"
 "Undo: revert a bad commit that is already pushed"
 "Recover a deleted branch with reflog"
 "Stash work, fix a hotfix, come back"
 "Cherry-pick a hotfix onto the release branch"
 "Find the commit that broke the pipeline with bisect"
 "Detached HEAD: save the work you did there"
 "A teammate force-pushed: recover safely"
 "Remove a committed secret from history"
 "Resolve a conflict in a generated lock file"
 "Work on two branches at once with worktrees"
 "Block bad commits with a pre-commit hook"
 "Pull request flow: branch, push, open a PR with gh"
)
setup() {
  rm -rf "$d"; mkdir -p "$d"; cd "$d"
  case "$n" in
  1) g init -q; c README.md "etl project" "init"; echo "print('etl')" > pipeline.py; echo "dag" > dag.py
     g add pipeline.py; g commit -qm "wip"
     echo "TASK: the last commit message 'wip' should be 'add pipeline and dag', and dag.py was forgotten. Fix both WITHOUT making a new commit." ;;
  2) g init -q; printf "select city,\n count(*) as trips\nfrom trips\ngroup by city\n" > report.sql; g add .; g commit -qm base
     g switch -qc feature; sed -i.bak 's/count(\*) as trips/count(*) as completed_trips/' report.sql; rm -f report.sql.bak; g commit -qam "rename metric"
     g switch -q main; sed -i.bak 's/count(\*) as trips/count(distinct trip_id) as trips/' report.sql; rm -f report.sql.bak; g commit -qam "count distinct"
     echo "TASK: merge 'feature' into main. Keep BOTH ideas: count(distinct trip_id) AS completed_trips. Commit the merge." ;;
  3) g init -q; c a.txt 1 "a"; g switch -qc feature; c f1.txt f1 "feature 1"; c f2.txt f2 "feature 2"; g switch -q main; c b.txt 2 "main moved on"
     echo "TASK: rebase 'feature' onto main so history is linear: main's commit, then feature 1, then feature 2. No merge commits." ;;
  4) g init -q; c base.txt base "base"; g switch -qc feature; for i in 1 2 3 4 5; do c work.txt "v$i" "wip $i"; done
     echo "TASK: on 'feature', turn the 5 'wip' commits into ONE commit named 'add work file' (content v5). Hint: git reset --soft or rebase -i." ;;
  5) g init -q; c app.cfg "timeout=30" "config"; c app.cfg "timeout=0" "bad: disable timeout"; c notes.md "notes" "add notes"
     g init -q --bare ../05-remote.git 2>/dev/null || true; g remote add origin ../05-remote.git; g push -q origin main
     echo "TASK: the 'bad: disable timeout' commit is already pushed. Undo it WITHOUT rewriting history, keep notes.md, and push." ;;
  6) g init -q; c a.txt a "a"; g switch -qc experiment; c exp.txt "important" "important experiment"; g switch -q main; g branch -qD experiment
     echo "TASK: the branch 'experiment' was deleted. Recover it with its 'important experiment' commit." ;;
  7) g init -q; c app.py "v1" "app"; echo "half-done feature" >> app.py
     echo "TASK: you have uncommitted work in app.py. Without losing it: commit a hotfix file hotfix.txt (content 'fixed') on main, then bring your work back. End with hotfix committed AND app.py still modified (not committed)." ;;
  8) g init -q; c app.py v1 "release base"; g branch release; c app.py v2 "new feature"; c fix.txt "null check" "fix: null check"
     echo "TASK: put ONLY the 'fix: null check' commit onto the 'release' branch (not 'new feature')." ;;
  9) g init -q; c sum.py "def total(xs): return sum(xs)" "c1"; for i in 2 3 4 5 6; do echo "# change $i" >> sum.py; g commit -qam "c$i"; done
     sed -i.bak 's/return sum(xs)/return sum(xs) + 1/' sum.py; rm -f sum.py.bak; g commit -qam "c7 refactor"; for i in 8 9 10; do echo "# change $i" >> sum.py; g commit -qam "c$i"; done
     printf '#!/bin/sh\npython3 -c "exec(open(\\"sum.py\\").read()); assert total([1,2])==3"\n' > ../09-test.sh; chmod +x ../09-test.sh
     echo "TASK: total() is wrong now. Use 'git bisect' with the test script ../09-test.sh to find the first bad commit. Write its message into ../09-answer.txt (e.g. 'c4')." ;;
  10) g init -q; c a.txt a "a"; c b.txt b "b"; g checkout -q HEAD~1; c work.txt "detached work" "work on detached head"
     echo "TASK: you committed while in detached HEAD. Save that commit on a new branch called 'rescue' and switch back to main." ;;
  11) g init -q --bare "$d/remote.git"; g clone -q "$d/remote.git" "$d/me" 2>/dev/null; cd "$d/me"; c a.txt a "a"; c b.txt b "mine: b"; g push -q origin main 2>/dev/null
     g clone -q "$d/remote.git" "$d/other" 2>/dev/null; cd "$d/other"; g reset -q --hard HEAD~1; c c.txt c "their rewrite"; g push -q -f origin main 2>/dev/null; cd "$d/me"
     echo "TASK (in $d/me): someone force-pushed main and your 'mine: b' commit vanished from the remote. Get main to contain BOTH 'their rewrite' and your 'mine: b', and push without --force." ;;
  12) g init -q; c app.py "app" "app"; echo "API_KEY=sk-live-123" > .env; g add .env; g commit -qm "add env"; c app.py "app v2" "more work"
     echo "TASK: .env with a secret was committed two commits ago. Remove it from ALL history (it must not be in any commit), keep app.py v2, and add .env to .gitignore. (In real life: also rotate the key.)" ;;
  13) g init -q; printf '{"deps": {"a": "1.0"}}\n' > lock.json; g add .; g commit -qm base
     g switch -qc feature; printf '{"deps": {"a": "1.0", "b": "2.0"}}\n' > lock.json; g commit -qam "add b"
     g switch -q main; printf '{"deps": {"a": "1.1"}}\n' > lock.json; g commit -qam "bump a"
     echo "TASK: merge 'feature' into main. For lock files, do not hand-merge: take main's version, then re-apply feature's change (a=1.1 AND b=2.0). Commit." ;;
  14) g init -q; c a.txt a "a"; g branch hotfix
     echo "TASK: without switching away from main, create a worktree at ../14-hotfix for branch 'hotfix', commit hotfix.txt there, then remove the worktree." ;;
  15) g init -q; c app.py "ok" "init"
     echo "TASK: add a pre-commit hook (.git/hooks/pre-commit) that blocks any commit containing 'sk-live-'. Prove it: a commit with a file containing sk-live-999 must fail." ;;
  16) g init -q; c README.md "project" "init"
     echo "TASK: practise the pull-request flow on YOUR GitHub repo: branch 'feat/readme', change README.md, push, and open a PR with 'gh pr create --fill'. Write the PR URL into $d/pr.txt." ;;
  *) echo "unknown lab $n"; exit 1 ;;
  esac
  echo; echo "Lab $n · ${TITLES[$n]}"; echo "Repo: $d"; echo "When done: bash labs/git/gitlab.sh check $n"
}
check() {
  cd "$d" 2>/dev/null || { echo "run setup $n first"; exit 1; }
  case "$n" in
  1) [ "$(git log -1 --format=%s)" = "add pipeline and dag" ] && ok "message fixed" || no "last message is '$(git log -1 --format=%s)'"
     git show --name-only --format= HEAD | grep -c >/dev/null dag.py && ok "dag.py in the commit" || no "dag.py not in the last commit"
     [ "$(git rev-list --count HEAD)" = 2 ] && ok "no extra commit" || no "expected 2 commits (use --amend)" ;;
  2) grep -q "count(distinct trip_id) as completed_trips" report.sql && ok "both changes kept" || no "report.sql: $(grep count report.sql)"
     ! grep -q '<<<<<<<' report.sql && ok "no conflict markers" || no "conflict markers left"
     [ "$(git log -1 --format=%p | wc -w | tr -d " ")" = 2 ] && ok "merge committed" || no "no merge commit yet" ;;
  3) [ "$(git log --format=%s feature | head -3 | tr '\n' ',')" = "feature 2,feature 1,main moved on," ] && ok "linear history" || no "history: $(git log --format=%s feature | tr '\n' ',')"
     [ -z "$(git log --merges --format=%h feature)" ] && ok "no merge commits" || no "merge commit found" ;;
  4) [ "$(git log --format=%s main..feature)" = "add work file" ] && ok "one commit" || no "commits: $(git log --format=%s main..feature | tr '\n' ',')"
     [ "$(git show feature:work.txt)" = v5 ] && ok "content v5" || no "content wrong" ;;
  5) [ "$(git show HEAD:app.cfg)" = "timeout=30" ] && ok "timeout restored" || no "app.cfg is $(git show HEAD:app.cfg)"
     git log --format=%s | grep -c >/dev/null "bad: disable timeout" && ok "history kept (revert, not reset)" || no "history rewritten"
     [ "$(git rev-parse HEAD)" = "$(git --git-dir=../05-remote.git rev-parse main)" ] && ok "pushed" || no "not pushed" ;;
  6) git log --format=%s experiment 2>/dev/null | grep -c >/dev/null "important experiment" && ok "branch recovered" || no "no 'experiment' branch with the commit" ;;
  7) git log --format=%s | grep -c >/dev/null . && git show --name-only --format= HEAD | grep -c >/dev/null hotfix.txt && ok "hotfix committed" || no "hotfix.txt not in the last commit"
     git diff --name-only | grep -c >/dev/null app.py && ok "work restored and uncommitted" || no "app.py work not restored"
     [ -z "$(git stash list)" ] && ok "stash cleaned up" || no "stash still has entries (use stash pop)" ;;
  8) git log --format=%s release | grep -c >/dev/null "fix: null check" && ok "fix on release" || no "fix not on release"
     ! git log --format=%s release | grep -c >/dev/null "new feature" && ok "feature not on release" || no "'new feature' leaked onto release" ;;
  9) [ "$(cat ../09-answer.txt 2>/dev/null | tr -d '[:space:]')" = c7refactor ] || [ "$(cat ../09-answer.txt 2>/dev/null | tr -d '[:space:]')" = c7 ] && ok "found c7" || no "answer: $(cat ../09-answer.txt 2>/dev/null)"
     [ ! -f .git/BISECT_LOG ] && ok "bisect reset" || no "run git bisect reset" ;;
  10) git log --format=%s rescue 2>/dev/null | grep -c >/dev/null "work on detached head" && ok "rescued" || no "no 'rescue' branch with the commit"
     [ "$(git rev-parse --abbrev-ref HEAD)" = main ] && ok "back on main" || no "not on main" ;;
  11) cd me; git fetch -q; L=$(git log --format=%s origin/main | tr '\n' ',')
     echo "$L" | grep -c >/dev/null "their rewrite" && echo "$L" | grep -c >/dev/null "mine: b" && ok "both commits on remote main" || no "remote main: $L" ;;
  12) [ -z "$(git log --all --format=%h -- .env)" ] && ok ".env gone from history" || no ".env still in history"
     grep -qx ".env" .gitignore 2>/dev/null && ok ".env ignored" || no ".env not in .gitignore"
     [ "$(git show HEAD:app.py 2>/dev/null)" = "app v2" ] && ok "app.py v2 kept" || no "app.py changed" ;;
  13) grep -q '"a": "1.1"' lock.json && grep -q '"b": "2.0"' lock.json && ok "lock has a=1.1 and b=2.0" || no "lock: $(cat lock.json)"
     ! grep -q '<<<<<<<' lock.json && [ "$(git log -1 --format=%p | wc -w | tr -d " ")" = 2 ] && ok "merge committed cleanly" || no "merge not finished" ;;
  14) git log --format=%s hotfix | grep -c >/dev/null . && git show --name-only --format= hotfix | grep -c >/dev/null hotfix.txt && ok "hotfix committed on its branch" || no "no hotfix.txt commit on 'hotfix'"
     [ "$(git rev-parse --abbrev-ref HEAD)" = main ] && ok "main untouched" || no "you switched branches"
     ! git worktree list | grep -c >/dev/null 14-hotfix && ok "worktree removed" || no "worktree still listed" ;;
  15) [ -x .git/hooks/pre-commit ] && ok "hook installed" || no "no executable .git/hooks/pre-commit"
     echo "sk-live-999" > leak.txt; git add leak.txt; if git -c user.name=t -c user.email=t@t commit -qm leak 2>/dev/null; then no "commit with a secret was allowed"; git reset -q --hard HEAD~1; else ok "secret blocked"; git reset -q leak.txt; fi; rm -f leak.txt ;;
  16) grep -q "github.com/.*/pull/" pr.txt 2>/dev/null && ok "PR URL recorded" || no "write the PR URL into pr.txt" ;;
  esac
  [ $FAILED = 0 ] && echo "Lab $n complete." || exit 1
}
case "${1:-list}" in
  list) for i in $(seq 1 16); do printf "%2d  %s\n" "$i" "${TITLES[$i]}"; done ;;
  setup) setup ;;
  check) check ;;
  *) echo "usage: gitlab.sh list | setup N | check N" ;;
esac
