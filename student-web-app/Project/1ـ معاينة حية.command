#!/bin/bash
cd "$(dirname "$0")"
if ! lsof -i :5174 >/dev/null 2>&1; then
  nohup node tools/dev-server.mjs >/tmp/student-portal-preview.log 2>&1 &
  sleep 1
fi
open "http://localhost:5174/"
