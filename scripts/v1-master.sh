#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

command="${1:-}"
case "$command" in
  profile|import|reconcile) ;;
  *)
    echo "Usage: v1-master.sh <profile|import|reconcile>" >&2
    exit 1
    ;;
esac

node_args=()
if [ -f ".env" ]; then
  node_args+=(--env-file=.env)
fi

exec node "${node_args[@]}" - "$command" <<'NODE'
const { spawnSync } = require("node:child_process");

const command = process.argv[2];
const result = spawnSync(
  "pnpm",
  [
    "--filter",
    "@poip/db",
    "exec",
    "tsx",
    `../../scripts/v1-master-${command}.ts`
  ],
  {
    stdio: "inherit",
    env: process.env
  }
);

process.exit(result.status ?? 1);
NODE
