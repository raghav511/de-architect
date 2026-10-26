#!/usr/bin/env bash
# Builds your sync URL from the Web app URL and your key, tests it, and saves it for the nightly coach.
# Run: bash tools/coach/setup_sync.sh   (it asks for the two values; nothing is sent anywhere except the test request)
set -u
echo "Step 1 of 2: paste the Web app URL from Apps Script (ends in /exec), then press Enter."
read -r -p "Web app URL: " W
echo "Step 2 of 2: paste your key (the same 48 characters you put in const KEY = '...'), then press Enter."
read -r -s -p "Key (hidden while you paste): " K; echo
W="${W%%\?*}"; W="${W// /}"; K="${K// /}"
case "$W" in https://script.google.com/*/exec) ;; *) echo; echo "That does not look like a Web app URL. It should start with https://script.google.com/ and end with /exec. Run the script again."; exit 1 ;; esac
[ ${#K} -ge 16 ] || { echo; echo "That key is too short. Paste the full key and run the script again."; exit 1; }
U="$W?k=$K"
echo; echo "Testing the link..."
R=$(curl -sL --max-time 60 "$U")
case "$R" in
  *'"ok":true'*) echo "It works: $R" ;;
  *'wrong or missing key'*) echo "The script refused the key. Make sure the key here matches const KEY in the script exactly, that you saved the script, and that you deployed a new version after changing it (Deploy > Manage deployments > Edit > New version)."; exit 1 ;;
  *) echo "Unexpected answer from Google (first 200 characters below). Check that Who has access is set to Anyone, then run again."; echo "${R:0:200}"; exit 1 ;;
esac
mkdir -p ~/.data-architect && printf '{"sync_url": "%s"}\n' "$U" > ~/.data-architect/config.json && chmod 600 ~/.data-architect/config.json
echo; echo "Saved for the nightly coach."
echo; echo "Your sync URL for the app (copy this whole line into Settings > Sync URL on each device):"
echo; echo "$U"
printf %s "$U" | pbcopy 2>/dev/null && echo && echo "(It is also on your clipboard now.)"
