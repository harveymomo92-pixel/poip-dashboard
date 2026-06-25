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
pnpm bc:target-coverage
pnpm bc:mapping-candidates
```

Dashboard calculations use canonical `source_system = 'business-central'`. Missing approved targets produce `N/A` achievement rather than a misleading zero target, and unmapped machines/entities remain visible until master entities/aliases are loaded.

To preview the v1 master-data import from the local `.tmp/v1-inspection/` export:

```bash
pnpm v1:master-profile
pnpm v1:master-import
pnpm v1:master-reconcile
```

The import command is a dry-run unless `V1_MASTER_IMPORT_COMMIT=true` is set. It imports real v1 entities, reviewed aliases, approved targets, and stable item gross-weight mappings; ambiguous machine/product mappings stay in the conflict list for manual review. See [V1 migration plan](docs/V1_MASTER_DATA_MIGRATION_PLAN.md).

Map Business Central machine/line values only after review:

```bash
SOURCE_FIELD=machine_center_no SOURCE_VALUE="REPLACE_WITH_BC_VALUE" ENTITY_ID="00000000-0000-0000-0000-000000000000" pnpm bc:mapping-apply
SOURCE_FIELD=machine_center_no SOURCE_VALUE="REPLACE_WITH_BC_VALUE" ENTITY_ID="00000000-0000-0000-0000-000000000000" APPLY_MAPPING_COMMIT=true pnpm bc:mapping-apply
```

The first command is a dry-run preview. Commit mode creates/reuses an alias, updates only unmapped matching output rows, resolves related unmapped-entity issues, and writes an audit event. The same workflow is available in `/master-data`.

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
