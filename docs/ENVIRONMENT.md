# Environment Configuration

Use `.env.example` for local development and `.env.production.example` as a production template. Do not commit `.env`, `.env.local`, `.env.production`, real passwords, tokens, cookies, or Business Central credentials.

## Required runtime variables

| Variable | Required for | Local default | Production guidance |
| --- | --- | --- | --- |
| `DATABASE_URL` | API, worker, db scripts | `postgres://ppic_app:change-me-local@localhost:5432/ppic_output_intelligence` | Required. Use the PostgreSQL service hostname reachable by API/worker, often `postgres` inside Docker. |
| `REDIS_URL` | API sync queue, worker, health | `redis://localhost:6379` | Required. Use `redis://redis:6379` when services share the Compose network. |
| `SESSION_SECRET` | Auth token signing fallback | placeholder | Required. Generate a high-entropy value; never reuse the local example. |
| `AUTH_SECRET` | Auth token signing preferred secret | placeholder | Required. Use a separate high-entropy value from `SESSION_SECRET`. |
| `WEB_ORIGIN` | API CORS | `http://localhost:3000` | Required. Set to the exact public web origin. |
| `NEXT_PUBLIC_API_BASE_URL` | Web API calls | `http://localhost:4000/api/v1` | Required at web build/runtime. Set to the public API base URL. |
| `API_PORT` | API listener | `4000` | Optional if a supervisor/proxy injects the port. |
| `APP_TIMEZONE` | Operator convention | `Asia/Jakarta` | Keep `Asia/Jakarta` for PRD v2. |

## OData and sync variables

| Variable | Required for live sync | Notes |
| --- | ---: | --- |
| `ODATA_SYNC_MODE` | Yes | Keep `mock` for local/dev. Use a non-`mock` value such as `live` only after endpoint/token verification. |
| `BC_ODATA_BASE_URL` | Yes | Base Business Central URL. Do not include credentials in the URL. |
| `BC_ODATA_OUTPUT_ENDPOINT` | Yes | Production output OData path relative to the base URL. |
| `BC_ODATA_BEARER_TOKEN` | Yes for bearer-token auth | Store in deployment secrets, not Git. |
| `BC_ODATA_PAGE_SIZE` | No | Defaults to `1000`; reduce if Business Central throttles. |
| `ODATA_SYNC_CONCURRENCY` | No | Defaults to `1`; keep `1` for v2 unless operations has tested higher concurrency. |

`BC_ODATA_TENANT`, `BC_ODATA_CLIENT_ID`, and `BC_ODATA_CLIENT_SECRET` are reserved placeholders in the environment template. The current v2 worker uses bearer token auth.

## Bootstrap admin variables

| Variable | Purpose |
| --- | --- |
| `ADMIN_EMAIL` | Email for `pnpm db:create-admin`. |
| `ADMIN_NAME` | Display name for the bootstrap admin. |
| `ADMIN_PASSWORD` | Temporary bootstrap password. Must be changed/rotated for real production use. |

The bootstrap admin command upserts a local-auth Admin user. Do not reuse demo or local credentials in production.

## Safe local defaults

The committed defaults are safe only for local development:

- Postgres and Redis point at localhost.
- `ODATA_SYNC_MODE=mock`.
- Auth secrets and admin password are placeholders.

Before staging or production, replace every placeholder secret and run the production checklist.
