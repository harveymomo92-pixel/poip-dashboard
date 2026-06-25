# PPIC Output Intelligence Platform

Production-grade v2 rebuild of the PPIC operations dashboard described in [docs/PRD.md](docs/PRD.md).

The app currently includes:

- Next.js web dashboard with the Notion Beige-inspired design system.
- NestJS API with auth, RBAC, audit logging, health checks, and API envelopes.
- BullMQ worker foundation for OData sync.
- PostgreSQL schema, migrations, role/permission seed, and local admin bootstrap.
- Dashboard/KPI read model, targets, downtime, WhatsApp Parser, Import Center, Data Quality, Audit Viewer, and System Health.
- Master Data & Mapping Center for reviewed Business Central entity aliases, target coverage, and gross-weight conversion gaps.

## Prerequisites

- Node.js 24 LTS
- pnpm 10.x
- Docker Desktop or Docker Engine

## Fresh local setup

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed
ADMIN_EMAIL=admin@example.local ADMIN_NAME="System Admin" ADMIN_PASSWORD="change-this-local" pnpm db:create-admin
pnpm dev
```

Expected local URLs:

```text
Web: http://localhost:3000
API: http://localhost:4000/api/v1/health
```

Open `http://localhost:3000/login` and sign in with the local admin credentials you supplied to `pnpm db:create-admin`.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Smoke test with only public checks:

```bash
pnpm smoke:test
```

Smoke test with admin/readiness checks:

```bash
ADMIN_EMAIL=admin@example.local ADMIN_PASSWORD=change-this-local pnpm smoke:test
```

## Common local services

```bash
docker compose up -d postgres redis
docker compose ps
pnpm --filter @poip/api dev
pnpm --filter @poip/web dev
pnpm --filter @poip/worker dev
```

Local development defaults to `ODATA_SYNC_MODE=mock`, so the worker will not call Business Central unless the OData URL/endpoint/token are configured and mock mode is disabled.

For live Business Central OData through Tailscale/LAN, configure `BC_ODATA_URL`, `BC_ODATA_AUTH_MODE`, and matching auth variables in `.env`, then run:

```bash
pnpm odata:check
```

For a controlled historical backfill after a DB backup:

```bash
BACKFILL_FROM=2026-01-01 pnpm odata:backfill:check
BACKFILL_FROM=2026-01-01 pnpm odata:backfill
```

For fragile live OData links, use a small page size with chunked commits:

```bash
BACKFILL_FROM=2026-01-01 BACKFILL_PAGE_SIZE=1 BACKFILL_CHUNK_PAGES=10 BACKFILL_CHUNK_RETRIES=2 pnpm odata:backfill
```

After live rows are in PostgreSQL, verify the calculation gate with read-only diagnostics:

```bash
pnpm bc:profile
RECONCILE_FROM=2026-06-18 RECONCILE_TO=2026-06-24 pnpm bc:reconcile
pnpm bc:daily-item-resume
pnpm bc:target-coverage
pnpm bc:mapping-candidates
pnpm bc:mapping-plan
pnpm bc:mapping-plan-apply
```

Dashboard calculations use canonical `source_system = 'business-central'` and production scope `entry_type = 'Output'`. Other Business Central entry types remain stored for future management panels, but `/overview` shows the v1-style `Resume Harian per Item`: grouped by posting date, resolved machine/entity label, and item. The Business Central entity source is `Machine Description` first, then `Machine Center No`, then production-line fields; `Machine Center No` is often blank, so values such as `REPACKING` and `GILINGAN` must come from `machine_description`. Output is net quantity, so negative Output corrections reduce production instead of being hidden. Missing approved targets produce `N/A` with an explicit reason, never a misleading zero target. Aggregate achievement can reconcile while some resume rows remain `N/A` because aggregate target coverage uses mapped entity-days and the resume keeps unmapped groups visible for mapping review.

Per-item resume target matching uses resolved entity, target effective date, approved/active status, and bucket metadata when the target model provides it. V1-compatible bucket inference covers printing `22 OZ`, printing other OZ, printing non-OZ, thermoforming gross-weight threshold `>= 0.012`, regular thermoforming, and bottle/preform family. Ambiguous or unknown bucket cases stay `N/A / TARGET_BUCKET_MISSING` instead of borrowing a target.

When `External_Document_No` follows `SHIFT/HOURS/OPERATOR`, the resume parses shift, work hours, and operator from it. Example: `S1/8/RAHMAT` becomes shift `S1`, work hours `8`, operator `RAHMAT`, and prorata target uses `dailyTarget * 8 / 24`. Malformed values stay visible in details and use the existing fallback work-hours source.

To preview the v1 master-data import from the local `.tmp/v1-inspection/` export:

```bash
pnpm v1:master-profile
pnpm v1:master-import
pnpm v1:master-reconcile
```

The import command is a dry-run unless `V1_MASTER_IMPORT_COMMIT=true` is set. It imports real v1 entities, reviewed aliases, approved targets, and stable item gross-weight mappings; ambiguous machine/product mappings stay in the conflict list for manual review. See [V1 migration plan](docs/V1_MASTER_DATA_MIGRATION_PLAN.md).

After the v1 import, coverage can still be low because many BC source values differ from the reviewed v1 aliases (`NEWDO 1 REG`, `ILLIG1`, `HENGFENG 4 OZ`, `OMSO2 OZ`, `REPACKING`, `GILINGAN`, and blank source groups). Generate a reviewable mapping plan instead of auto-mapping them:

```bash
pnpm bc:mapping-candidates
pnpm bc:mapping-plan
pnpm bc:mapping-plan-apply
```

The plan is written to `.tmp/mapping-plan/business-central-mapping-plan.csv` with every row defaulting to `REVIEW`. After a human changes reviewed rows to `action=COMMIT`, apply it with:

```bash
MAPPING_PLAN_FILE=.tmp/mapping-plan/business-central-mapping-plan.csv MAPPING_PLAN_COMMIT=true pnpm bc:mapping-plan-apply
```

`bc:mapping-plan-apply` is a dry-run unless `MAPPING_PLAN_COMMIT=true`; it skips LOW confidence, blank source values, invalid entities, and non-allowlisted source fields.

Map Business Central machine/line values only after review:

```bash
SOURCE_FIELD=machine_description SOURCE_VALUE="REPACKING" ENTITY_ID="00000000-0000-0000-0000-000000000000" pnpm bc:mapping-apply
SOURCE_FIELD=machine_description SOURCE_VALUE="REPACKING" ENTITY_ID="00000000-0000-0000-0000-000000000000" APPLY_MAPPING_COMMIT=true pnpm bc:mapping-apply
```

The first command is a dry-run preview. Commit mode creates/reuses an alias, updates only unmapped matching output rows, resolves related unmapped-entity issues, and writes an audit event. The same workflow is available in `/master-data`. Mapping Preview regression tests cover the previous PostgreSQL placeholder bug (`could not determine data type of parameter $3`).

See [Operations guide](docs/OPERATIONS.md) for the full live-sync, backfill, and reconciliation checklist.

## Production and UAT docs

- [Environment variables](docs/ENVIRONMENT.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Operations guide](docs/OPERATIONS.md)
- [UAT guide](docs/UAT.md)
- [QA checklist](docs/QA_CHECKLIST.md)
- [Production checklist](docs/PRODUCTION_CHECKLIST.md)
- [API reference](docs/API.md)

## Repository layout

```text
apps/web       Next.js App Router frontend
apps/api       NestJS backend API
apps/worker    BullMQ TypeScript worker
packages/db    Database client, schema, migrations, seed, admin bootstrap
packages/domain Shared KPI, permission, timezone, import, parser, and sync contracts
packages/ui    Shared UI package placeholder
packages/config Shared environment contract
packages/api-client Typed API client surface
scripts         Local verification scripts
docs            Operator, QA, UAT, and API documentation
```
