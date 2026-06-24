#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

node_args=()
if [ -f ".env" ]; then
  node_args+=(--env-file=.env)
fi

exec node "${node_args[@]}" - "$@" <<'NODE'
const { spawnSync } = require("node:child_process");

const result = spawnSync(
  "pnpm",
  [
    "--filter",
    "@poip/worker",
    "exec",
    "tsx",
    "src/jobs/odata-sync/backfill-cli.ts",
    ...process.argv.slice(2)
  ],
  {
    stdio: "inherit",
    env: process.env
  }
);

process.exit(result.status ?? 1);
NODE
