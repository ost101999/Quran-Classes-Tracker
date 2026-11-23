#!/bin/bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
exec "$root/desktop-app/build-tools/BuildAndInstallMac.command" "$@"
