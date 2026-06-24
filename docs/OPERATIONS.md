# Operations Guide

This guide covers the v2 operations runbook for an internal deployment.

## Daily checks

1. Open `/settings/health`.
2. Confirm API readiness, PostgreSQL, Redis, migrations, and queue state.
3. Check latest OData sync status and freshness.
4. Open `/overview` and confirm dashboard data is current enough for the meeting.
5. Review `/data-quality` for critical/open issues.
6. Review `/settings/audit` if a write action needs traceability.

## Health endpoints

```bash
curl http://localhost:4000/api/v1/health
```

Deep readiness requires an authenticated Admin/session with `settings.manage`; use the UI System Health page or `pnpm smoke:test` with admin credentials.

## Sync operations

Use `/settings/sync` for manual OData runs and range resyncs. Keep range resyncs small during UAT and first production cutover.

### Live Business Central OData via Tailscale/LAN

Use environment variables only. Do not paste credentials into commands, code, docs, or logs.

Required local/live pattern:

```bash
ODATA_SYNC_MODE=live
BC_ODATA_URL=http://tailscale-or-lan-host.example.local:7048/BC/ODataV4/Company('COMPANY')/ProductionOutput
BC_ODATA_AUTH_MODE=basic
BC_ODATA_USERNAME=replace-with-odata-username
BC_ODATA_PASSWORD=replace-with-odata-password
```

Safe direct curl check using environment variables:

```bash
curl --silent --show-error --fail \
  --user "$BC_ODATA_USERNAME:$BC_ODATA_PASSWORD" \
  --header "Accept: application/json" \
  --get --data-urlencode '$top=1' \
  "$BC_ODATA_URL" >/tmp/poip-odata-check.json
```

Safer scripted check:

```bash
pnpm odata:check
```

`scripts/check-odata.sh` reads `.env` when present, sends `Accept: application/json`, supports `BC_ODATA_AUTH_MODE=basic` and bearer mode, and never prints the password/token.

After changing OData environment values:

1. Restart the worker process.
2. Open `/settings/sync`.
3. Trigger a small manual sync or range resync.
4. Confirm the sync run moves from `QUEUED`/`RUNNING` to `SUCCESS`.
5. Check `/settings/audit`, `/data-quality`, and `/overview` for expected downstream updates.

If sync fails:

1. Check `/settings/health` for Redis/queue status.
2. Check `/settings/sync` run history and error message.
3. Confirm Business Central endpoint/auth variables are valid.
4. Keep `ODATA_SYNC_CONCURRENCY=1` unless a higher value has already been tested.

Troubleshooting live OData:

- `200`: Endpoint and auth worked. If sync still imports nothing, inspect `$filter`, `BC_ODATA_PAGE_SIZE`, and returned field names.
- `401`: Username/password/token rejected. Rotate/update environment variables and restart the worker.
- `403`: Auth succeeded but the account lacks permission to the company/page/query.
- `404`: URL, company name, published web service name, or route is wrong. Confirm exact ODataV4 entity URL.
- Timeout/no response: Tailscale route, LAN firewall, host/port, or Business Central service availability problem.

### One-time live OData backfill

Use the backfill command for controlled historical imports. It reuses the same normalization, staging, data quality, and idempotent upsert logic as the live worker sync. It does not print the Business Central URL, password, bearer token, cookies, or session tokens.

Required before running:

1. Confirm `ODATA_SYNC_MODE=live`.
2. Confirm `BC_ODATA_URL`, `BC_ODATA_AUTH_MODE`, and matching auth variables are set in `.env` or the secret environment.
3. Create a pre-backfill PostgreSQL backup.
4. Run the safe backfill check.

January-through-now backfill:

```bash
BACKFILL_FROM=2026-01-01 pnpm odata:backfill:check
BACKFILL_FROM=2026-01-01 pnpm odata:backfill
```

Single-month backfill, using an exclusive end date:

```bash
BACKFILL_FROM=2026-01-01 BACKFILL_TO=2026-02-01 pnpm odata:backfill:check
BACKFILL_FROM=2026-01-01 BACKFILL_TO=2026-02-01 pnpm odata:backfill
```

Optional controls:

- `BACKFILL_DATE_FIELD=Posting_Date` by default. Use another simple OData date field only if the Business Central web service exposes it and PPIC has approved it.
- `BACKFILL_PAGE_SIZE=500` adjusts `$top` when the endpoint URL does not already contain `$top`.
- `BACKFILL_MAX_PAGES=5` caps pages for a cautious trial run. Omit it for the full backfill.

Filter behavior:

- From-only uses `<dateField> ge <BACKFILL_FROM>`.
- From/to uses `<dateField> ge <BACKFILL_FROM> and <dateField> lt <BACKFILL_TO>`.
- Existing endpoint `$filter` is preserved and combined with `and`.
- Existing `$select`, `$orderby`, `$top`, and other query parameters are preserved.
- Pagination follows Business Central `@odata.nextLink` when present.
- If Business Central omits `@odata.nextLink` but returns a full `Entry_No asc` page, the backfill uses `Entry_No gt <last entry>` keyset pagination for the next page.

After backfill:

1. Confirm the printed sync run status is `SUCCESS` and rows fetched are greater than zero.
2. Open `/settings/sync` and verify the latest run counts.
3. Open `/settings/audit` and filter for `sync.backfill`.
4. Open `/overview` and confirm dashboard freshness/latest posting date.
5. Open `/settings/health` and confirm readiness remains healthy.

Restore normal live sync by leaving `ODATA_SYNC_MODE=live`, removing temporary `BACKFILL_*` shell overrides, and running the worker normally:

```bash
pnpm --filter @poip/worker dev
```

## Data quality operations

Use `/data-quality` to review issues. Status actions:

- Acknowledge: issue is known and under review.
- Resolve: issue has been corrected or accepted with a required note.
- Ignore: issue is intentionally excluded with a required note.
- Reopen: brings resolved/ignored issues back into the active queue.

All status changes write audit events.

## Audit operations

Use `/settings/audit` to filter by entity/module, action, actor, entity ID, and date. Audit before/after payloads are redacted for credentials, tokens, raw source payloads, source text, and stored file paths.

Audit logs are append-only at the application level. Do not edit or delete audit rows manually.

## Backup notes for v2

At minimum, schedule a PostgreSQL logical backup outside the app:

```bash
docker exec poip-postgres pg_dump -U ppic_app -d ppic_output_intelligence --format=custom > poip-$(date +%Y%m%d-%H%M).dump
```

Basic restore pattern for a non-production rehearsal database:

```bash
createdb ppic_output_intelligence_restore
pg_restore --dbname=ppic_output_intelligence_restore poip-YYYYMMDD-HHMM.dump
```

Before production restore, stop API/web/worker, take a fresh backup, and document who approved the restore.

## Logs

API request logs include request ID, user ID when available, route, status code, and duration. Do not log passwords, tokens, Business Central credentials, or raw uploaded/parser text.

## Incident notes

For v2, record:

- Time detected.
- Affected workflow.
- Latest health/readiness state.
- Latest sync/import/parser run ID if relevant.
- Operator action taken.
- Whether rollback or restore was needed.

Formal SLO/SLA, alert routing, and observability platforms are deferred to PRD v3.
