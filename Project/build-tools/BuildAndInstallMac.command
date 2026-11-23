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
echo "Checking for latest commits from GitHub..."
git fetch origin main
if [[ -z "$(git status --porcelain)" ]]; then
  git pull --ff-only
elif ! git merge-base --is-ancestor origin/main HEAD; then
  echo "The project has local changes and is behind GitHub. Save or commit those changes and update the project before building."
  exit 1
else
  echo "Building the current project, including its local changes."
fi

npm install --no-audit --no-fund
npm run electron:build

case "$(uname -m)" in
  arm64) source_app="$project_dir/dist_electron/mac-arm64/$app_name" ;;
  x86_64) source_app="$project_dir/dist_electron/mac/$app_name" ;;
  *) echo "Unsupported Mac architecture."; exit 1 ;;
esac
if [[ ! -d "$source_app" ]]; then
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

