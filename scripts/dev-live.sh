#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f ".env" ]; then
  set -a
  source ".env"
  set +a
fi

echo "Starting PPIC API + Web + Worker..."
echo "API_PORT=${API_PORT:-4000}"
echo "NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL:-http://localhost:4000/api/v1}"
echo "ODATA_SYNC_MODE=${ODATA_SYNC_MODE:-mock}"
echo ""

cleanup() {
  echo ""
  echo "Stopping API + Web + Worker..."
  kill "${API_PID:-}" "${WEB_PID:-}" "${WORKER_PID:-}" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

pnpm --filter @poip/api dev &
API_PID=$!

pnpm --filter @poip/worker dev &
WORKER_PID=$!

pnpm --filter @poip/web dev &
WEB_PID=$!

wait -n "$API_PID" "$WEB_PID" "$WORKER_PID"
