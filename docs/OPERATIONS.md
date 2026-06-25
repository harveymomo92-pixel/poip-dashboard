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

Normal live sync strategy:

- Canonical live source-system value is `business-central`.
- The worker probes the latest remote `Entry_No` first.
- If remote latest `Entry_No` is newer than local `production_outputs.entry_no`, it fetches only `Entry_No gt <local latest>`.
- If remote latest is not newer, it does not pull full history again. It either skips fetching when `BC_ODATA_BACKFILL_SCAN_DAYS=0`, or scans the recent `BC_ODATA_BACKFILL_SCAN_DAYS` posting-date window for late-arriving/corrected rows.
- Re-running sync/backfill is idempotent through the natural key `source_system + entry_no` and row-hash no-op detection.
- `sync_runs.metadata.syncStrategy` records remote/latest entry numbers, selected mode, and the scan window when used.

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
- `BACKFILL_AFTER_ENTRY_NO=12345` resumes after a known Business Central entry number by adding `Entry_No gt 12345` to the filter.
- `BACKFILL_PAGE_SIZE=500` adjusts `$top` when the endpoint URL does not already contain `$top`.
- `BACKFILL_MAX_PAGES=5` caps pages for a cautious trial run. Omit it for the full backfill.
- `BACKFILL_CHECK_TOP=25` increases only the dry-run check size. It never writes rows and is useful when verifying Business Central can return more than one row before a full backfill.
- `BACKFILL_CHECK_MAX_PAGES=2` lets the dry-run check prove read-only pagination before any write-mode backfill.
- `BACKFILL_CHUNK_PAGES=20` commits a live backfill in smaller idempotent chunks. Use this for fragile Business Central/Tailscale links where one long request sequence can fail before the final commit.
- `BACKFILL_MAX_CHUNKS=10` caps chunked writes for a controlled trial. Omit it for the full chunked run.
- `BACKFILL_CHUNK_RETRIES=2` retries a failed chunk before aborting. Failed attempts remain visible in `sync_runs` with sanitized errors.
- `BC_ODATA_TIMEOUT_MS=30000` caps each page request.
- `BC_ODATA_RETRY_ATTEMPTS=2` retries transient page/network/non-JSON failures without printing response bodies.

Filter behavior:

- From-only uses `<dateField> ge <BACKFILL_FROM>`.
- From/to uses `<dateField> ge <BACKFILL_FROM> and <dateField> lt <BACKFILL_TO>`.
- Existing endpoint `$filter` is preserved and combined with `and`.
- Existing `$select`, `$orderby`, `$top`, and other query parameters are preserved.
- Pagination follows Business Central `@odata.nextLink` when present.
- If Business Central omits `@odata.nextLink` but returns a full `Entry_No asc` page, the backfill uses `Entry_No gt <last entry>` keyset pagination for the next page.
- `sync_runs.metadata` records backfill settings, page count, pagination mode, and duration for successful or failed runs.
- Chunked backfill writes one successful `sync_runs` record per chunk. Re-running the same command is safe: existing rows are skipped when their row hash is unchanged.

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

### Business Central calculation diagnostics

Use these read-only commands after live data lands, before trusting dashboard numbers in UAT:

```bash
pnpm bc:profile
pnpm bc:reconcile
RECONCILE_FROM=2026-06-18 RECONCILE_TO=2026-06-24 pnpm bc:reconcile
pnpm bc:target-coverage
```

`pnpm bc:profile` reports row counts, posting-date range, rows by month, entry type, normalized output type, source-system mix, top unmapped machines/entities, top OK items, target coverage, and reject conversion gaps.

`pnpm bc:reconcile` compares the dashboard KPI contract against raw SQL aggregates for the same date window. It explains why achievement is `N/A` when targets are missing, why reject PCS equivalent is incomplete when gross-weight conversion is missing, and whether OK output exists without mapped entities.

`pnpm bc:target-coverage` groups positive OK output by month and entity/machine, then labels rows as `COVERED`, `UNMAPPED_ENTITY`, `NO_ACTIVE_TARGET`, `TARGET_NOT_APPROVED`, `OUTSIDE_EFFECTIVE_DATE`, or `TARGET_ZERO`. Load/approve master entities and targets before expecting achievement to become numeric.

The dashboard contract is documented in `docs/BC_METRIC_CONTRACT.md`. In short: OK Output uses positive `normalized_output_type = 'OK'` rows from `source_system = 'business-central'`; targets must be approved/active and effective for the entity/date; missing targets produce `N/A`, not zero; unmapped machines remain visible as data-quality gaps.

### Master data mapping operations

Use `/master-data` when live BC rows are loaded but dashboard achievement is still `N/A` because output rows are unmapped. The Mapping Center is the reviewed bridge from raw Business Central values to internal master entities.

Safe review flow:

1. Open `/master-data`.
2. Review overview cards for active entities, aliases, unmapped rows, target gaps, and conversion gaps.
3. In Alias Mapping Center, filter by source field or source value.
4. Select an unmapped group such as a machine center or production line.
5. Choose an existing canonical entity, or create the entity first if it truly does not exist.
6. Preview affected rows.
7. Commit only after the affected row count and entity are correct.
8. Re-run `pnpm bc:target-coverage` and `/overview` to verify rows moved from `UNMAPPED_ENTITY` to `COVERED` or a specific target reason.

Mapping priority:

1. Active exact alias for `business-central` + source field + source value.
2. Active normalized alias after trimming, uppercasing, collapsing whitespace, and removing common separators.
3. Exact `master_entities.entity_code`.
4. Leave unmapped and classify as `UNMAPPED_ENTITY`.

Operational commands:

```bash
pnpm bc:mapping-candidates

SOURCE_FIELD=machine_center_no \
SOURCE_VALUE="REPLACE_WITH_BC_MACHINE" \
ENTITY_ID="00000000-0000-0000-0000-000000000000" \
pnpm bc:mapping-apply

SOURCE_FIELD=machine_center_no \
SOURCE_VALUE="REPLACE_WITH_BC_MACHINE" \
ENTITY_ID="00000000-0000-0000-0000-000000000000" \
APPLY_MAPPING_COMMIT=true \
pnpm bc:mapping-apply
```

`pnpm bc:mapping-candidates` is read-only. `pnpm bc:mapping-apply` is also dry-run by default; it mutates only when `APPLY_MAPPING_COMMIT=true` is set. Commit mode creates or reuses an alias, updates only unmapped matching `production_outputs` rows, resolves related unmapped-entity data-quality issues, and writes an audit log.

Do not map low-confidence source values just to make achievement numeric. If a source group is operationally ambiguous, leave it unmapped and ask PPIC/production owners to confirm the canonical entity.

### Conversion gap operations

Use `/master-data` → Conversion Gap View when reject PCS equivalent is incomplete.

1. Review item/UOM groups with `reject_kg > 0` and missing gross-weight conversion.
2. Enter the reviewed gross weight per PCS for that exact item/UOM.
3. Commit only after checking the affected reject row count.
4. Re-run `pnpm bc:profile` or `pnpm bc:reconcile` to verify conversion gaps decreased.

Conversion commits update only rows where `reject_pcs_eq` or `gross_weight_per_pcs` is missing/invalid. They do not overwrite already converted rows.

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
