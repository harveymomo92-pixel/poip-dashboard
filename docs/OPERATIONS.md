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

If sync fails:

1. Check `/settings/health` for Redis/queue status.
2. Check `/settings/sync` run history and error message.
3. Confirm Business Central endpoint/token are valid.
4. Keep `ODATA_SYNC_CONCURRENCY=1` unless a higher value has already been tested.

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
