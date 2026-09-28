#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
(mvn -q -f backend/pom.xml spring-boot:run) &
backend_pid=$!
(npm --prefix frontend run dev) &
frontend_pid=$!
trap 'kill "$backend_pid" "$frontend_pid" 2>/dev/null || true' EXIT INT TERM
wait
