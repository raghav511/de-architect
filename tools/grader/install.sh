#!/usr/bin/env bash
# Installs the instant grader as a background service on this Mac (starts at login, restarts if it stops).
# Run: bash tools/grader/install.sh          Remove: bash tools/grader/install.sh --remove
# Needs: Claude Code signed in (run `claude` once), and the sync URL saved by tools/coach/setup_sync.sh.
set -eu
LABEL=io.github.raghav511.data-architect-grader
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.data-architect/app"   # a private copy, so the service does not depend on where this repo lives
if [ "${1:-}" = "--remove" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"; echo "Grader removed."; exit 0
fi
CLAUDE="$(command -v claude || echo "$HOME/.local/bin/claude")"
[ -x "$CLAUDE" ] || { echo "Claude Code is not installed. Install it, run 'claude' once to sign in, then run this again."; exit 1; }
[ -f "$HOME/.data-architect/config.json" ] || { echo "No sync URL yet. Run: bash tools/coach/setup_sync.sh"; exit 1; }
mkdir -p "$DEST/tools/grader" "$DEST/tools/coach" "$HOME/Library/LaunchAgents"
cp "$HERE/grader.py" "$DEST/tools/grader/"; cp "$HERE/../coach/coach.py" "$DEST/tools/coach/"
rm -rf "$DEST/labs/cc/sandbox"; mkdir -p "$DEST/labs/cc"; cp -R "$HERE/../../labs/cc/sandbox" "$DEST/labs/cc/sandbox"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/usr/bin/python3</string><string>$DEST/tools/grader/grader.py</string><string>serve</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$(dirname "$CLAUDE"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string><key>DA_CLAUDE_BIN</key><string>$CLAUDE</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardErrorPath</key><string>$HOME/.data-architect/grader.err</string>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
sleep 2
if curl -s --max-time 5 http://127.0.0.1:8765/health | grep -q '"ok": true'; then
  echo "Grader is running. Answers you submit in the app (on this Mac, iPad or iPhone) are graded while this Mac is awake."
  echo "Log: ~/.data-architect/grader.log   Remove: bash tools/grader/install.sh --remove"
else
  echo "The service did not answer yet. Check ~/.data-architect/grader.err"
fi
