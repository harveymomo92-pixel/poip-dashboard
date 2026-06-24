#!/usr/bin/env bash
set -euo pipefail

node_args=()
if [[ -f .env ]]; then
  node_args+=(--env-file=.env)
fi

node "${node_args[@]}" --input-type=module <<'NODE'
const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const authMode = (process.env.BC_ODATA_AUTH_MODE ?? "none").trim().toLowerCase();
const endpoint = required("BC_ODATA_URL");
const url = new URL(endpoint);
if (url.username || url.password) {
  throw new Error("BC_ODATA_URL must not contain embedded credentials");
}
url.searchParams.set("$top", "1");

const headers = { Accept: "application/json" };
if (authMode === "basic") {
  const username = required("BC_ODATA_USERNAME");
  const password = required("BC_ODATA_PASSWORD");
  headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
} else if (authMode === "bearer") {
  headers.Authorization = `Bearer ${required("BC_ODATA_BEARER_TOKEN")}`;
} else if (authMode !== "none") {
  throw new Error("BC_ODATA_AUTH_MODE must be basic, bearer, or none");
}

let response;
try {
  response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(Number(process.env.BC_ODATA_CHECK_TIMEOUT_MS ?? "15000"))
  });
} catch {
  throw new Error("OData endpoint could not be reached before the timeout");
}

console.log(`OData check HTTP ${response.status}`);
if (!response.ok) process.exitCode = 1;
else {
  const payload = await response.json();
  const rowCount = Array.isArray(payload?.value) ? payload.value.length : 0;
  console.log(`OData response is JSON with ${rowCount} row(s) in value`);
}
NODE
