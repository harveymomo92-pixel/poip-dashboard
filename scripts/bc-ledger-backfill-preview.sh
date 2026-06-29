#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export BC_LEDGER_BACKFILL_PREVIEW_DIR="${BC_LEDGER_BACKFILL_PREVIEW_DIR:-$ROOT_DIR/.tmp/bc-ledger-backfill-preview}"

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
    "@poip/db",
    "exec",
    "tsx",
    "../../scripts/bc-ledger-backfill-preview.ts",
    ...process.argv.slice(2)
  ],
  {
    stdio: "inherit",
    env: process.env
  }
);

process.exit(result.status ?? 1);
NODE
