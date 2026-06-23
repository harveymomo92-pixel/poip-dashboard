# PPIC Output Intelligence Platform

Production-grade rebuild of the PPIC dashboard described in `docs/PRD.md`.

## Milestone 0 Scope

This repository currently contains the foundation skeleton only:

- pnpm workspace and Turborepo
- Next.js App Router web app
- NestJS API app
- Node.js TypeScript worker app
- Shared packages for database, domain, UI, config, and typed API client
- Docker Compose services for PostgreSQL and Redis
- GitHub Actions CI for lint, typecheck, test, and build

## Prerequisites

- Node.js 24 LTS
- pnpm 10.x
- Docker Desktop or Docker Engine

## Local Setup

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm dev
```

Expected local URLs:

```text
Web: http://localhost:3000
API: http://localhost:4000/api/v1/health
```

After `pnpm db:create-admin`, open `http://localhost:3000/login` and sign in with the
admin credentials from `.env` or the command environment.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Database

Milestone 1 adds the PostgreSQL schema, role/permission seed, and local admin creation script.

```bash
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed
ADMIN_EMAIL=admin@example.local ADMIN_NAME="System Admin" ADMIN_PASSWORD="change-this" pnpm db:create-admin
```

`pnpm db:create-admin` reads `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` from the environment or `.env`. Use a strong password outside local development.

## Auth/RBAC Smoke Test

```bash
curl -i http://localhost:4000/api/v1/health
curl -i http://localhost:4000/api/v1/auth/me
curl -i -c /tmp/poip.cookies \
  -H "content-type: application/json" \
  -d '{"email":"admin@example.local","password":"change-this"}' \
  http://localhost:4000/api/v1/auth/login
curl -i -b /tmp/poip.cookies http://localhost:4000/api/v1/auth/me
curl -i -b /tmp/poip.cookies http://localhost:4000/api/v1/users
```

## OData Sync Pipeline

Milestone 3 adds the BullMQ-based OData sync foundation. Local development defaults to
`ODATA_SYNC_MODE=mock`, so the worker will not call Business Central unless
`BC_ODATA_BASE_URL` and `BC_ODATA_OUTPUT_ENDPOINT` are configured and mock mode is disabled.

Run the API and worker with Redis/Postgres up:

```bash
docker compose up -d postgres redis
pnpm --filter @poip/api dev
pnpm --filter @poip/worker dev
```

Trigger a local mock sync:

```bash
curl -i -c /tmp/poip.cookies \
  -H "content-type: application/json" \
  -d '{"email":"admin@example.local","password":"change-this"}' \
  http://localhost:4000/api/v1/auth/login

curl -i -b /tmp/poip.cookies \
  -H "content-type: application/json" \
  -d '{}' \
  http://localhost:4000/api/v1/sync/odata/run

curl -i -b /tmp/poip.cookies http://localhost:4000/api/v1/sync/status
curl -i -b /tmp/poip.cookies http://localhost:4000/api/v1/sync/runs
```

Inspect database results:

```bash
docker exec -it poip-postgres psql -U ppic_app -d ppic_output_intelligence \
  -c "select id, status, rows_fetched, rows_inserted, rows_updated, rows_skipped, error_message from sync_runs order by started_at desc limit 5;"

docker exec -it poip-postgres psql -U ppic_app -d ppic_output_intelligence \
  -c "select source_system, entry_no, posting_date, item_no, quantity, reject_kg from production_outputs order by created_at desc limit 10;"
```

## Repository Layout

```text
apps/web       Next.js App Router frontend
apps/api       NestJS backend API
apps/worker    BullMQ-ready TypeScript worker skeleton
packages/db    Database client and migration entry points
packages/domain Shared KPI, permission, timezone, and parser contracts
packages/ui    Shared UI components
packages/config Shared TypeScript and runtime config
packages/api-client Typed API client surface
```
