#!/usr/bin/env bash
set -euo pipefail
export CHOKIDAR_USEPOLLING=true
exec npx tsx watch --clear-screen=false src/server.ts
