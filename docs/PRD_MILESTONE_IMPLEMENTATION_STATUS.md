# PRD Milestone Implementation Status

Status: P0-clean-0 documentation baseline  
Source of truth: `docs/PRD.md`  
OData mapping reference: `docs/BC_ODATA_OUTPUT_COLUMN_MAP.md`  
Prepared after rollback cleanup: 2026-06-29

## Current Baseline

- `main` was reset to `bc200b2` for the clean rebuild baseline.
- Old target data was cleaned from the database:
  - `production_targets = 0`
  - `target_profiles = 0`
- Target-related code and schema may still exist. This is expected because the PRD still requires target management, target achievement, target import, and target auditability.
- The OData output column map exists at `docs/BC_ODATA_OUTPUT_COLUMN_MAP.md`.
- Current repository evidence also shows OData operation documentation and commands such as `pnpm odata:check`, `pnpm odata:backfill`, `pnpm bc:profile`, `pnpm bc:reconcile`, and `pnpm bc:target-coverage`.
- This status document does not prove live Business Central connectivity, calculation parity, or production readiness by itself.

## Status Legend

- `DONE`: Current repository clearly contains the expected implementation and supporting docs/tests for the milestone.
- `PARTIAL`: Current repository contains meaningful implementation, but scope or acceptance evidence is incomplete.
- `NEEDS_VERIFICATION`: Current repository contains implementation or documentation, but the milestone needs a fresh post-rollback run, live-data check, UAT check, or production evidence.
- `NOT_STARTED`: No current repository evidence was found for the milestone.

## Priority Gates

### P0 Business Central Live Data Ingestion Production Gate

- PRD purpose: prove the application can ingest live Business Central OData safely, with configured endpoint/auth, sync history, validation, dashboard freshness, and operational commands.
- Current status: `NEEDS_VERIFICATION`
- Evidence from current repo:
  - `docs/PRD.md` includes the P0 gate.
  - `docs/OPERATIONS.md` documents live OData setup, `pnpm odata:check`, and `pnpm odata:backfill`.
  - `scripts/check-odata.sh`, `scripts/backfill-odata.sh`, and worker OData sync code exist.
- What remains:
  - Re-run live OData check after rollback.
  - Confirm current environment variables and network path.
  - Confirm latest successful `sync_runs` record and dashboard freshness.
  - Confirm no secrets are logged.

### P0.1 Business Central Calculation Accuracy and v1 Sync Strategy Adaptation

- PRD purpose: verify Business Central metric contracts, dashboard calculation accuracy, target coverage, and v1 sync strategy adaptation before trusting operational numbers.
- Current status: `NEEDS_VERIFICATION`
- Evidence from current repo:
  - `docs/PRD.md` includes the P0.1 gate.
  - `docs/BC_METRIC_CONTRACT.md` exists.
  - `scripts/bc-metrics.ts` supports profile, reconcile, and target coverage commands.
  - `package.json` exposes `pnpm bc:profile`, `pnpm bc:reconcile`, and `pnpm bc:target-coverage`.
- What remains:
  - Re-run profiling and reconciliation after rollback.
  - Rebuild or import correct target data first, because target tables were intentionally cleaned.
  - Re-run target coverage and dashboard calculation verification.

## PRD Milestone List

### Milestone 0 — Repository Foundation

- PRD purpose: create monorepo foundation with pnpm, Turborepo, web/API/worker apps, shared packages, CI, Docker Compose, `.env.example`, and README.
- Current status: `DONE`
- Evidence from current repo:
  - `apps/web`, `apps/api`, `apps/worker`, `packages/db`, `packages/domain`, `packages/ui`, `packages/config`, and `packages/api-client` exist.
  - `pnpm-workspace.yaml`, `turbo.json`, `docker-compose.yml`, `.github/workflows/ci.yml`, `.env.example`, and `README.md` exist.
  - Root scripts include `lint`, `typecheck`, `test`, `build`, and `check:deps`.
- What remains:
  - Keep validation commands passing after every milestone.

### Milestone 1 — Database and Domain Foundation

- PRD purpose: implement PostgreSQL schema, migrations, seed roles/permissions/admin, domain constants, KPI formulas, parser contracts, and unit tests.
- Current status: `PARTIAL`
- Evidence from current repo:
  - `packages/db/src/schema.ts` defines core tables including users, roles, permissions, master entities, production targets, sync, outputs, downtime, parser, imports, data quality, audit, and notifications.
  - `packages/db/migrations/` contains migrations.
  - `packages/domain/src/kpi`, `packages/domain/src/downtime`, `packages/domain/src/permissions`, `packages/domain/src/parser-contract`, and related tests exist.
- What remains:
  - Verify migrations and seed run cleanly on an empty PostgreSQL database after rollback.
  - Confirm seed output against PRD roles and permissions.

### Milestone 2 — Auth and RBAC

- PRD purpose: implement login/logout/me, session handling, RBAC guards, user/role management, frontend permission gates, and audit for user management.
- Current status: `PARTIAL`
- Evidence from current repo:
  - API modules exist under `apps/api/src/modules/auth` and `apps/api/src/modules/users`.
  - Web pages exist for `/login` and `/settings/users`.
  - Auth guard and token tests exist.
- What remains:
  - Verify full RBAC behavior in a running app.
  - Confirm user-management write actions create expected audit logs.

### Milestone 3 — OData Sync Pipeline

- PRD purpose: implement sync runs/checkpoints, OData client, staging validation, Business Central ledger upsert, data quality generation, sync center UI, manual sync, and worker job.
- Current status: `NEEDS_VERIFICATION`
- Evidence from current repo:
  - Worker OData sync code exists under `apps/worker/src/jobs/odata-sync`.
  - API sync module exists under `apps/api/src/modules/sync`.
  - Sync Center page exists at `apps/web/src/app/settings/sync`.
  - OData check/backfill scripts and operations docs exist.
- What remains:
  - Re-run mock and live sync checks after rollback.
  - Confirm current OData selected columns align with `docs/BC_ODATA_OUTPUT_COLUMN_MAP.md`.
  - Confirm new sync rows are classified into `bc_ledger_entries` without treating every ledger movement as production output KPI.
  - Confirm data quality issue generation with current sample/live data.

### Milestone 4 — Output Dashboard and Detail Explorer

- PRD purpose: implement dashboard summary, trends, grouped views, paginated detail APIs, overview/output/detail pages, and filtered export.
- Current status: `PARTIAL`
- Evidence from current repo:
  - Dashboard API module exists under `apps/api/src/modules/dashboard`.
  - Output API module exists under `apps/api/src/modules/outputs`.
  - Overview page exists at `apps/web/src/app/overview`.
- What remains:
  - Verify dashboard numbers against detail rows.
  - Confirm Data Detail Explorer route and all drilldowns/export behavior required by PRD.

### Milestone 5 — Target Management

- PRD purpose: implement target CRUD, versioning, approval, target achievement API/page, target import preview/commit, and audit log.
- Current status: `NEEDS_VERIFICATION`
- Evidence from current repo:
  - `production_targets` schema and target API/UI modules exist.
  - Target page exists at `apps/web/src/app/settings/targets`.
  - Target data was intentionally cleaned from DB after rollback.
- What remains:
  - Do not restore old target profile dry-run chain.
  - Rebuild/import correct target data through the approved clean path.
  - Verify target versioning, approval, import preview/commit, and audit behavior.

### Milestone 6 — Downtime Command Center

- PRD purpose: implement downtime CRUD, natural key duplicate detection, duration calculation, close validation, summary, page, and audit.
- Current status: `PARTIAL`
- Evidence from current repo:
  - API module exists under `apps/api/src/modules/downtime`.
  - Web page exists at `apps/web/src/app/downtime`.
  - Domain tests exist for downtime duration, natural key, and status.
- What remains:
  - Verify UI workflow and audit behavior in a running app.
  - Confirm duplicate and close-validation acceptance criteria.

### Milestone 7 — Import Center

- PRD purpose: implement CSV/XLSX import with upload, header normalization, dry-run preview, validation, idempotent commit job, history, and error download.
- Current status: `PARTIAL`
- Evidence from current repo:
  - API import module exists under `apps/api/src/modules/imports`.
  - Web page exists at `apps/web/src/app/tools/import-center`.
  - Domain downtime import code and tests exist.
- What remains:
  - Verify preview performs no writes.
  - Verify commit idempotency, import history, and error download.

### Milestone 8 — WhatsApp Parser

- PRD purpose: implement rules parser, optional AI abstraction, preview, confidence/warnings, manual correction, selected-row commit, and parser regression tests.
- Current status: `PARTIAL`
- Evidence from current repo:
  - API parser module exists under `apps/api/src/modules/parser`.
  - Web page exists at `apps/web/src/app/tools/wa-parser`.
  - Domain WA rules parser and tests exist.
- What remains:
  - Verify preview creates no downtime events.
  - Verify selected commit, manual correction, warnings, and regression fixture coverage.

### Milestone 9 — Design System, UX Workflow, and Production Polish

- PRD purpose: polish the frontend into a consistent production-grade manufacturing operations dashboard using the local design reference, without changing backend contracts or business logic.
- Current status: `PARTIAL`
- Evidence from current repo:
  - `docs/design.md` exists.
  - Shared UI package exists under `packages/ui`.
  - Web pages and global CSS exist for overview, downtime, import, parser, sync, targets, users, data quality, audit, and health.
- What remains:
  - Verify all PRD-listed shared components and UX patterns are actually implemented.
  - Visually review desktop/mobile states.
  - Confirm no behavior or API contracts changed during UI polish.

### Milestone 10 — Data Quality, Audit, Health

- PRD purpose: implement data quality cockpit, resolve/ignore, audit UI, basic/deep health endpoints, health dashboard, metrics/logging, and request IDs.
- Current status: `PARTIAL`
- Evidence from current repo:
  - API modules exist under `apps/api/src/modules/data-quality`, `apps/api/src/modules/audit`, and `apps/api/src/modules/health`.
  - Web pages exist at `/data-quality`, `/settings/audit`, and `/settings/health`.
  - Related tests exist for data quality, audit, and health modules.
- What remains:
  - Verify deep health checks with DB and Redis running.
  - Confirm request IDs and audit filters in runtime.

### Milestone 11 — Master Data and Mapping Center

- PRD purpose: create reliable master data and alias mapping for machines/entities, items, lines, shifts, unit conversion, source aliases, validation, audit, and data quality resolution.
- Current status: `NOT_STARTED`
- Evidence from current repo:
  - `master_entities` and alias schema exist as foundational tables.
  - No current repo evidence was found for dedicated master data or mapping center UI/API endpoints under `/api/v1/master`.
- What remains:
  - Rebuild master/mapping capability through the clean OData-approved path.
  - Do not restore the old v1 master-data mapping center flow.
  - Start with P0-clean side milestones before broader mapping center work.

### Milestone 12 — Data Lineage and Source Traceability

- PRD purpose: make KPI values and operational rows traceable to their source rows, runs, natural keys, hashes, actors, timestamps, and audit context.
- Current status: `NOT_STARTED`
- Evidence from current repo:
  - Some source/run fields exist in sync/import/parser/audit tables.
  - No current repo evidence was found for dedicated lineage APIs such as `/api/v1/lineage/*`.
- What remains:
  - Design lineage read models and UI panels after clean mapping and calculation verification.

### Milestone 13 — Notification and Alert Center

- PRD purpose: create in-app alerts for sync failures, stale data, missing targets, open downtime, reject spikes, invalid previews, and critical data quality issues.
- Current status: `PARTIAL`
- Evidence from current repo:
  - `notifications` schema exists in `packages/db/src/schema.ts`.
  - No current repo evidence was found for notification center API/UI endpoints.
- What remains:
  - Implement alert rules, notification APIs, UI, dedupe, read state, and role-aware visibility.

### Milestone 14 — Human-Readable Audit Timeline and Activity Feed

- PRD purpose: convert technical audit logs into readable global activity and entity-level timelines with redaction and filters.
- Current status: `PARTIAL`
- Evidence from current repo:
  - Audit API and UI exist.
  - Audit service includes human-readable entity labels.
  - Audit page includes activity summary UI.
- What remains:
  - Verify global activity feed and entity-level timelines for target, downtime, import, parser, data quality, and user actions.
  - Confirm sensitive fields are redacted.

### Milestone 15 — UAT Mode, Demo Data, and Guided Testing Pack

- PRD purpose: add realistic demo/UAT data, sample files, docs, reset/check commands, and stakeholder test guides.
- Current status: `PARTIAL`
- Evidence from current repo:
  - `docs/UAT.md` and `docs/QA_CHECKLIST.md` exist.
  - `packages/db/src/seed.ts` exists.
- What remains:
  - Confirm dedicated demo/UAT seed mode, sample files, reset safety, and demo/check commands.

### Milestone 16 — Critical Flow E2E Automation

- PRD purpose: add deterministic browser-level Playwright tests for critical flows and CI smoke coverage.
- Current status: `NOT_STARTED`
- Evidence from current repo:
  - A web smoke test exists at `apps/web/test/smoke.test.mjs`.
  - No current repo evidence was found for Playwright config or `pnpm e2e` scripts.
- What remains:
  - Add Playwright setup and critical-flow E2E tests after clean target/mapping data is stable.

### Milestone 17 — Production Readiness Pack, Hardening, and UAT

- PRD purpose: add production compose, reverse proxy, backup/restore, smoke/healthcheck scripts, deployment/rollback/migration/operations docs, checklist, and hardening.
- Current status: `PARTIAL`
- Evidence from current repo:
  - `docs/DEPLOYMENT.md`, `docs/OPERATIONS.md`, `docs/ENVIRONMENT.md`, `docs/PRODUCTION_CHECKLIST.md`, and `scripts/smoke-test.sh` exist.
  - `docker-compose.yml` exists for local PostgreSQL and Redis.
- What remains:
  - Add or verify `docker-compose.prod.yml`, reverse proxy config, backup/restore scripts, healthcheck script, rollback/backup docs, and production smoke coverage.

## Clean Side Milestones

### P0-clean-1: BC OData DB Mapping Alignment Audit

- Command: `pnpm bc:odata-db-mapping-audit`
- Purpose: inspect current database data and compare existing entity/mapping usage against Business Central OData identity evidence.
- Output folder: `.tmp/bc-odata-db-mapping-audit/`
- User role: review exported evidence before any remap dry-run.
- DB apply: none.
- Current status: `PARTIAL`
- Notes:
  - This is an audit alignment step, not a new mapping chain.
  - It uses `docs/BC_ODATA_OUTPUT_COLUMN_MAP.md` identity precedence:
    `gProdOrRotLine_Description`, then `gProdOrRotLine_No`, then `Machine_Center_No` as fallback evidence only.
  - It does not apply DB changes, update aliases, update targets, or switch dashboard behavior.
  - Smart mapping candidate generation should come only after understanding existing DB mismatch.

### P0-clean-2-big: BC Ledger Entries Rename + Future-Use Semantic Structure

- Commands:
  - `pnpm bc:ledger-backfill-preview`
  - `ALLOW_BC_LEDGER_BACKFILL_APPLY=true pnpm bc:ledger-backfill-apply --confirm`
- Purpose: rename the broad Business Central movement table from `production_outputs` to `bc_ledger_entries`, retain future-use ledger domains, classify rows, enrich safe exact mappings, and keep the production dashboard limited to ready production output rows.
- DB apply: schema migration plus guarded semantic enrichment only.
- Current status: `NEEDS_VERIFICATION`
- Evidence from current repo:
  - Migration `packages/db/migrations/0007_bc_ledger_entries.sql` renames `production_outputs` to `bc_ledger_entries` and `production_output_staging` to `bc_ledger_entry_staging`.
  - The migration adds ledger semantic columns, indexes, compatibility views, and safe read views: `production_output_kpi_rows`, `reject_attachment_rows`, `future_use_movement_rows`, and `bc_ledger_review_rows`.
  - Drizzle schema exports use `bcLedgerEntries` and `bcLedgerEntryStaging`.
  - Worker sync writes to `bc_ledger_entries`/`bc_ledger_entry_staging`, classifies domains, records OData identity source, and maps only exact approved/current entity evidence.
  - Dashboard reads use `production_output_kpi_rows` or equivalent ready filters.
  - Preview/apply commands exist for ledger backfill classification and mapping enrichment.
- Notes:
  - `Machine_Center_No` remains fallback evidence only and must not become primary identity unless explicitly reviewed later.
  - Future-use domains are retained instead of forced into production output KPI.
  - Target tables remain separate and must remain empty/untouched until rebuilt or imported through the approved target path.
  - User review remains required before trusting or applying semantic enrichment output.

### P0-clean-3: Reviewed Ledger Remap Apply Plan

- Command planned: review output from `pnpm bc:ledger-backfill-preview`.
- Purpose: review the ledger preview output, confirm safe remap/apply scope, and generate/approve a rollback-aware apply plan before any production apply.
- DB apply: none.
- Current status: `NOT_STARTED`

### P0-clean-4: Controlled Target Rebuild and Calculation Recheck

- Purpose: rebuild/import target data correctly after ledger mapping is approved, then rerun P0.1 calculation verification.
- DB apply: target import only through the approved clean path.
- Current status: `NOT_STARTED`
- Notes: Do not restore the old target profile dry-run chain.

### P1-clean: Dashboard Usable With Approved Mapping

- Purpose: dashboard uses approved mapping and verified target data.
- Current status: `NOT_STARTED`
- Notes: This should happen only after approved mapping exists, target data is rebuilt/imported correctly, and P0.1 calculation verification has been re-run.

## Explicitly Not Restoring

The clean rebuild must not restore these older flows or chains:

- old v1 master-data mapping center flow
- old entity resolver v2 chain
- old target profile dry-run chain
- old scoped decision chain
- old authoritative master chain

Target code/schema may remain because target management is still required by the PRD. The restriction is against restoring the old implementation chains listed above.

## Recommended Next Work

1. Finish and commit P0-clean-0.
2. Finish and commit P0-clean-1.
3. Finish and verify P0-clean-2-big.
4. Review `pnpm bc:ledger-backfill-preview` output.
5. Approve and run guarded ledger backfill apply only when the preview is accepted.
6. Rebuild/import target data correctly through the approved clean path.
7. Re-run P0.1 calculation verification.

Recommended next milestone: `P0-clean-3: Reviewed Ledger Remap Apply Plan`.
