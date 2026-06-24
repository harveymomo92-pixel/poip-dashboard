# Deployment Guide

This is the pragmatic v2 deployment guide. It intentionally avoids PRD v3 enterprise scope such as release automation platforms, feature flags, SLO programs, advanced observability stacks, and disaster-recovery drills.

## Fresh clone local/prod-like run

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed
ADMIN_EMAIL=admin@example.local ADMIN_NAME="System Admin" ADMIN_PASSWORD="change-this-local" pnpm db:create-admin
pnpm --filter @poip/api dev
pnpm --filter @poip/worker dev
pnpm --filter @poip/web dev
```

In three terminals, the API, worker, and web app should start cleanly.

## Docker Compose services

`docker-compose.yml` provides the v2 data services:

- `postgres` / container `poip-postgres`
  - Image: `postgres:18`
  - Healthcheck: `pg_isready -U ppic_app -d ppic_output_intelligence`
  - Volume: `postgres_data`
- `redis` / container `poip-redis`
  - Image: `redis:8.0.3-alpine`
  - Healthcheck: `redis-cli ping`
  - Volume: `redis_data`

Check service health:

```bash
docker compose up -d postgres redis
docker compose ps
```

When API/worker run on the host, use localhost URLs. When they run inside the same Docker network, use service names:

```text
DATABASE_URL=postgres://ppic_app:<password>@postgres:5432/ppic_output_intelligence
REDIS_URL=redis://redis:6379
```

## Production environment setup

1. Copy `.env.production.example` to a protected server-side `.env.production`.
2. Replace every placeholder secret and URL.
3. Keep `APP_TIMEZONE=Asia/Jakarta`.
4. Set `WEB_ORIGIN` to the public web origin.
5. Set `NEXT_PUBLIC_API_BASE_URL` to the public API base URL before building the web app.
6. Keep `ODATA_SYNC_CONCURRENCY=1` until live sync behavior is verified.
7. Use `ODATA_SYNC_MODE=mock` for dry-run environments; switch to live only after `pnpm odata:check` verifies the Business Central endpoint/auth over Tailscale/LAN.

## Database bootstrap

```bash
pnpm db:migrate
pnpm db:seed
ADMIN_EMAIL=<admin-email> ADMIN_NAME="System Admin" ADMIN_PASSWORD=<temporary-password> pnpm db:create-admin
```

Run `pnpm db:create-admin` only for bootstrap or emergency admin recovery. Rotate the temporary password after first login.

## Build and start commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For an initial internal v2 deployment, run the built API/web/worker under the operator’s chosen process supervisor or container runtime. This repository does not add a full deployment platform in v2.

## Smoke test

Public checks only:

```bash
pnpm smoke:test
```

Admin/readiness checks:

```bash
API_BASE_URL=https://ppic.example.local/api/v1 \
WEB_BASE_URL=https://ppic.example.local \
ADMIN_EMAIL=<admin-email> \
ADMIN_PASSWORD=<admin-password> \
pnpm smoke:test
```

The smoke test verifies API health, anonymous auth rejection, web login availability, protected overview redirect, optional admin login, deep readiness, and protected dashboard API access.

For live Business Central OData verification before enabling sync:

```bash
pnpm odata:check
```

The command reads `BC_ODATA_URL`, `BC_ODATA_AUTH_MODE`, and the matching auth variables from the environment or `.env`. It requests one row with `$top=1` and does not print credentials.

## High-level rollback

For v2, rollback is operational/manual:

1. Stop API/web/worker processes.
2. Keep Postgres and Redis running unless the failure is infrastructure-related.
3. Restore the previous application build/artifact.
4. Restore database from backup only if the deployed migration or data write caused corruption. Take a backup before restoring.
5. Run `pnpm smoke:test` and verify login/dashboard/health before reopening access.

Do not run destructive database commands without a verified backup and explicit approval.
