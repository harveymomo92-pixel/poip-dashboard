# PPIC Output Intelligence Platform

Production-grade v2 rebuild of the PPIC operations dashboard described in [docs/PRD.md](docs/PRD.md).

The app currently includes:

- Next.js web dashboard with the Notion Beige-inspired design system.
- NestJS API with auth, RBAC, audit logging, health checks, and API envelopes.
- BullMQ worker foundation for OData sync.
- PostgreSQL schema, migrations, role/permission seed, and local admin bootstrap.
- Dashboard/KPI read model, targets, downtime, WhatsApp Parser, Import Center, Data Quality, Audit Viewer, and System Health.

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
