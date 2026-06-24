#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-${NEXT_PUBLIC_API_BASE_URL:-http://localhost:4000/api/v1}}"
WEB_BASE_URL="${WEB_BASE_URL:-${WEB_ORIGIN:-http://localhost:3000}}"
TIMEOUT="${SMOKE_TIMEOUT_SECONDS:-10}"
COOKIE_JAR="${SMOKE_COOKIE_JAR:-/tmp/poip-smoke.cookies}"

pass() { printf 'PASS %s\n' "$1"; }
skip() { printf 'SKIP %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1" >&2; exit 1; }

status_code() {
  local url="$1"
  curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time "$TIMEOUT" "$url"
}

status_code_no_redirect() {
  local url="$1"
  curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time "$TIMEOUT" "$url"
}

expect_2xx() {
  local label="$1"
  local url="$2"
  local status
  status="$(status_code "$url")"
  case "$status" in
    2*) pass "$label ($status)" ;;
    *) fail "$label returned HTTP $status" ;;
  esac
}

expect_status() {
  local label="$1"
  local url="$2"
  local expected="$3"
  local status
  status="$(status_code_no_redirect "$url")"
  if [ "$status" = "$expected" ]; then
    pass "$label ($status)"
  else
    fail "$label returned HTTP $status, expected $expected"
  fi
}

rm -f "$COOKIE_JAR"

expect_2xx "API health" "$API_BASE_URL/health"
expect_status "API auth/me rejects anonymous sessions" "$API_BASE_URL/auth/me" "401"
expect_2xx "Web login route" "$WEB_BASE_URL/login"

overview_status="$(status_code_no_redirect "$WEB_BASE_URL/overview")"
case "$overview_status" in
  30*) pass "Web protected overview redirects anonymous sessions ($overview_status)" ;;
  *) fail "Web protected overview returned HTTP $overview_status, expected redirect" ;;
esac

if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  login_body="$(node -e 'process.stdout.write(JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }))')"
  login_status="$(
    curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
      --max-time "$TIMEOUT" \
      --cookie-jar "$COOKIE_JAR" \
      --header 'content-type: application/json' \
      --data "$login_body" \
      "$API_BASE_URL/auth/login"
  )"
  case "$login_status" in
    2*) pass "API login with supplied admin credentials ($login_status)" ;;
    *) fail "API login returned HTTP $login_status" ;;
  esac

  me_status="$(
    curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
      --max-time "$TIMEOUT" \
      --cookie "$COOKIE_JAR" \
      "$API_BASE_URL/auth/me"
  )"
  case "$me_status" in
    2*) pass "API authenticated session check ($me_status)" ;;
    *) fail "API authenticated session check returned HTTP $me_status" ;;
  esac

  readiness_status="$(
    curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
      --max-time "$TIMEOUT" \
      --cookie "$COOKIE_JAR" \
      "$API_BASE_URL/health/readiness"
  )"
  case "$readiness_status" in
    2*) pass "API readiness/deep health is reachable with admin session ($readiness_status)" ;;
    *) fail "API readiness/deep health returned HTTP $readiness_status" ;;
  esac

  dashboard_status="$(
    curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
      --max-time "$TIMEOUT" \
      --cookie "$COOKIE_JAR" \
      "$API_BASE_URL/dashboard/summary"
  )"
  case "$dashboard_status" in
    2*) pass "Protected dashboard API is reachable with admin session ($dashboard_status)" ;;
    *) fail "Protected dashboard API returned HTTP $dashboard_status" ;;
  esac
else
  skip "Admin login/readiness/dashboard checks (set ADMIN_EMAIL and ADMIN_PASSWORD)"
fi

pass "Smoke test completed"
