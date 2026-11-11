#!/bin/bash

# Pull the latest code, build Quran Classes Tracker and replace the installed
# macOS app only after a successful build.  The previous app goes to the Trash.
set -euo pipefail

tools_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$tools_dir/.." && pwd)"
app_name="Quran Classes Tracker.app"
installed_app="/Applications/$app_name"
stage_app="/Applications/.$app_name.new"
old_app="/Applications/.$app_name.old"

# Leftovers from an interrupted earlier run.
[[ -e "$stage_app" ]] && rm -rf "$stage_app"
if [[ -e "$old_app" ]]; then
  if [[ ! -e "$installed_app" ]]; then
    mv "$old_app" "$installed_app"
  else
    rm -rf "$old_app"
  fi
fi

echo "Closing Quran Classes Tracker if running..."
osascript -e 'tell application id "com.quran.tracker" to quit' >/dev/null 2>&1 || true
sleep 1

cd "$project_dir"
if [[ -z "$(git status --porcelain 2>/dev/null)" ]]; then
  echo "Checking for latest commits from GitHub..."
  git pull --ff-only || true
fi

npm install --no-audit --no-fund
npm run electron:build

source_app="$(find "$project_dir/dist_electron" -maxdepth 2 -name "$app_name" -type d -print -quit)"
if [[ -z "$source_app" ]]; then
  echo "The macOS application was not created."
  exit 1
fi

# Copy first, so a build/copy failure never removes the installed application.
ditto "$source_app" "$stage_app"
[[ -e "$installed_app" ]] && mv "$installed_app" "$old_app"
if ! mv "$stage_app" "$installed_app"; then
  [[ -e "$old_app" && ! -e "$installed_app" ]] && mv "$old_app" "$installed_app"
  exit 1
fi

if [[ -e "$old_app" ]]; then
  osascript -e 'tell application "Finder" to delete POSIX file "'"$old_app"'"' >/dev/null 2>&1 || rm -rf "$old_app"
fi

env -u ELECTRON_RUN_AS_NODE open "$installed_app"
echo "Installed and opened: $installed_app"
