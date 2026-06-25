# Production Readiness Checklist

Use this before first v2 production cutover.

## Environment and secrets

- [ ] `.env.production` exists only on the server/secret store and is not committed.
- [ ] `DATABASE_URL` is production PostgreSQL.
- [ ] `REDIS_URL` is production Redis.
- [ ] `AUTH_SECRET` and `SESSION_SECRET` are high-entropy and unique.
- [ ] `WEB_ORIGIN` is the public web origin.
- [ ] `NEXT_PUBLIC_API_BASE_URL` is the public API base URL.
- [ ] Business Central OData URL/endpoint/token are configured.
- [ ] `BC_ODATA_AUTH_MODE` matches the credential type (`basic`, `bearer`, or `none`).
- [ ] Normal sync strategy is set: `BC_ODATA_INCREMENTAL_FIELD=Entry_No`, conservative `BC_ODATA_INCREMENTAL_PAGE_SIZE`, and approved `BC_ODATA_BACKFILL_SCAN_DAYS`.
- [ ] `pnpm odata:check` passes from the same host/network where the worker runs.
- [ ] `ODATA_SYNC_MODE` is intentionally set (`mock` for dry run, live value for production).
- [ ] `BC_ODATA_PAGE_SIZE` and `ODATA_SYNC_CONCURRENCY` are conservative and documented.
- [ ] If historical Business Central data is needed, a pre-backfill DB backup exists and `BACKFILL_FROM`/`BACKFILL_TO` are approved.
- [ ] `pnpm odata:backfill:check` passes before any live backfill.

## Build and database

- [ ] `pnpm install --frozen-lockfile` completed.
- [ ] `pnpm lint` passed.
- [ ] `pnpm typecheck` passed.
- [ ] `pnpm test` passed.
- [ ] `pnpm build` passed.
- [ ] `pnpm db:migrate` completed.
- [ ] `pnpm db:seed` completed.
- [ ] Bootstrap admin created only if needed.
- [ ] Bootstrap admin password rotated or disabled after handover.

## Services

- [ ] PostgreSQL service is healthy.
- [ ] Redis service is healthy.
- [ ] API process is running.
- [ ] Web process is running.
- [ ] Worker process is running.
- [ ] API `/health` passes.
- [ ] System Health/readiness page is reachable by Admin.
- [ ] `pnpm smoke:test` passes against the deployment.

## Functional verification

- [ ] Admin login verified.
- [ ] RBAC spot checks completed for Admin, Manager, PPIC, QC, and Viewer.
- [ ] Dashboard loads.
- [ ] `pnpm bc:profile` explains live BC row counts, date range, source-system mix, unmapped machines, and conversion gaps.
- [ ] `pnpm bc:reconcile` matches dashboard OK output against raw SQL for the UAT window.
- [ ] `pnpm bc:target-coverage` shows expected `COVERED`, `UNMAPPED_ENTITY`, `NO_ACTIVE_TARGET`, `TARGET_NOT_APPROVED`, `OUTSIDE_EFFECTIVE_DATE`, and `TARGET_ZERO` groups.
- [ ] `pnpm bc:mapping-candidates` shows top unmapped Business Central source groups and candidate entities.
- [ ] `/master-data` Mapping Center loads for Admin/PPIC and is read-only for view-only roles.
- [ ] A reviewed alias mapping preview shows the expected affected row count before any commit.
- [ ] A reviewed alias mapping commit writes an audit event and moves rows out of `UNMAPPED_ENTITY`.
- [ ] Conversion Gap View shows missing gross-weight item/UOM groups, and reviewed conversion commits reduce the gap count.
- [ ] Missing approved targets show `N/A` achievement, not a misleading zero target.
- [ ] Latest dashboard freshness is based on latest successful `business-central` sync.
- [ ] Manual/mock sync verified before live sync.
- [ ] Target workflow verified.
- [ ] Downtime workflow verified.
- [ ] WhatsApp Parser preview/commit verified with UAT data.
- [ ] Import Center preview/commit verified with UAT data.
- [ ] Data Quality issue action verified.
- [ ] Audit Viewer shows write actions.

## Backup and rollback

- [ ] Initial database backup taken before cutover.
- [ ] Backup location and retention owner documented.
- [ ] Restore command rehearsed in a non-production database.
- [ ] Previous application build/artifact is available.
- [ ] Rollback approver and communication path are known.
- [ ] Destructive database actions require explicit approval and verified backup.

## Deferred to PRD v3

- [ ] Advanced observability platform.
- [ ] Full CI/CD release automation.
- [ ] Feature flags.
- [ ] Load testing framework.
- [ ] Disaster recovery drill.
- [ ] Formal SLO/SLA framework.
- [ ] Operational command center.
