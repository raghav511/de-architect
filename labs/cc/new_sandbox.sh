#!/usr/bin/env bash
# Makes a fresh copy of the Claude Code practice project at ~/cc-sandbox (or the folder you name) as its own git repo.
set -eu
DEST="${1:-$HOME/cc-sandbox}"
SRC="$(cd "$(dirname "$0")" && pwd)/sandbox"
if [ -e "$DEST" ]; then
  mv "$DEST" "$DEST.old.$(date +%Y%m%d%H%M%S)"; echo "Moved your previous copy aside."
fi
cp -R "$SRC" "$DEST"
cd "$DEST" && git init -q && git add -A && git commit -qm "practice project: starting point" && echo "Ready: cd $DEST && claude"
