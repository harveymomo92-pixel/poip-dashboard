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
| `BC_ODATA_URL` | Preferred | Full Business Central ODataV4 entity URL, including private Tailscale/LAN host when used. Do not include credentials in the URL. Takes precedence over base URL + endpoint. |
| `BC_ODATA_AUTH_MODE` | Yes for protected endpoints | `basic`, `bearer`, or `none`. Use `basic` for the Tailscale/LAN Business Central pattern. |
| `BC_ODATA_USERNAME` | Yes for `basic` | OData username. Store in `.env`/secret store only. |
| `BC_ODATA_PASSWORD` | Yes for `basic` | OData password/web-service access key. Store in `.env`/secret store only. |
| `BC_ODATA_BASE_URL` | Legacy/alternate | Base Business Central URL. Used only when `BC_ODATA_URL` is not set. |
| `BC_ODATA_OUTPUT_ENDPOINT` | Legacy/alternate | Production output OData path relative to base URL. Used only when `BC_ODATA_URL` is not set. |
| `BC_ODATA_BEARER_TOKEN` | Yes for `bearer` | Existing bearer/token auth remains supported. Store in deployment secrets, not Git. |
| `BC_ODATA_PAGE_SIZE` | No | Defaults to `1000`; reduce if Business Central throttles. |
| `BC_ODATA_TIMEOUT_MS` | No | Defaults to `30000`; applies to each OData HTTP request/page. |
| `BC_ODATA_INCREMENTAL_FIELD` | No | Defaults to `Entry_No`; field used to probe the latest remote BC entry and build incremental filters. |
| `BC_ODATA_INCREMENTAL_PAGE_SIZE` | No | Defaults to `1000`; `$top` used for normal incremental sync pages. |
| `BC_ODATA_BACKFILL_SCAN_DAYS` | No | Defaults to `14`; when remote latest `Entry_No` is unchanged, normal sync scans this recent posting-date window for late-arriving rows instead of pulling full history. Set `0` to skip the scan. |
| `BC_ODATA_REQUEST_TIMEOUT_MS` | No | Defaults to `30000` when unset; preferred per-request timeout for live OData. Production template uses `120000`. |
| `BC_ODATA_RETRY_ATTEMPTS` | No | Defaults to `2`; retries transient page fetch or invalid JSON responses without printing response bodies. |
| `BC_ODATA_RETRY_DELAY_MS` | No | Defaults to `250`; base retry delay for live OData requests. Production template uses `1000`. |
| `ODATA_SYNC_CONCURRENCY` | No | Defaults to `1`; keep `1` for v2 unless operations has tested higher concurrency. |
| `BACKFILL_FROM` | Backfill only | Inclusive start date for one-time OData backfill, `YYYY-MM-DD`. Example: `2026-01-01`. |
| `BACKFILL_TO` | Backfill only, optional | Exclusive end date for one-time OData backfill, `YYYY-MM-DD`. Leave unset to backfill through current endpoint data. |
| `BACKFILL_DATE_FIELD` | Backfill only, optional | OData date field used in the backfill `$filter`. Defaults to `Posting_Date`. |
| `BACKFILL_AFTER_ENTRY_NO` | Backfill only, optional | Resume cursor for advanced recovery. Adds `Entry_No gt <value>` to the backfill filter. |
| `BACKFILL_PAGE_SIZE` | Backfill only, optional | `$top` page size for backfill when the endpoint URL does not already define `$top`. |
| `BACKFILL_MAX_PAGES` | Backfill only, optional | Safety cap for pages fetched; omit for the full backfill. |
| `BACKFILL_CHECK_TOP` | Check only, optional | Overrides the dry-run `$top` used by `pnpm odata:backfill:check`. Defaults to `1`; useful for bounded diagnostics without writing rows. |
| `BACKFILL_CHECK_MAX_PAGES` | Check only, optional | Overrides the dry-run page cap used by `pnpm odata:backfill:check`. Defaults to `1`; useful for proving read-only pagination. |
| `BACKFILL_CHUNK_PAGES` | Backfill only, optional | Commits the backfill in idempotent chunks of this many pages, advancing by `Entry_No`. Useful for fragile live OData links. |
| `BACKFILL_MAX_CHUNKS` | Backfill only, optional | Safety cap for chunked backfill runs. Omit to continue until the range is complete or an upstream error occurs. |
| `BACKFILL_CHUNK_RETRIES` | Backfill only, optional | Retries a failed chunk before aborting. Defaults to `2`; each failed attempt is recorded as a failed sync run with sanitized error text. |
| `RECONCILE_FROM` | Diagnostics only, optional | Inclusive dashboard reconciliation start date. Defaults to the last 7-day Jakarta business window. |
| `RECONCILE_TO` | Diagnostics only, optional | Inclusive dashboard reconciliation end date. Defaults to today in Jakarta. |
| `RECONCILE_ENTITY_ID` | Diagnostics only, optional | Limits `pnpm bc:reconcile` to a master entity UUID. |
| `RECONCILE_ITEM_NO` | Diagnostics only, optional | Limits `pnpm bc:reconcile` to one item number. |

`BC_ODATA_TENANT`, `BC_ODATA_CLIENT_ID`, and `BC_ODATA_CLIENT_SECRET` are reserved placeholders in the environment template. The current v2 worker uses `BC_ODATA_URL` + Basic Auth or the existing bearer-token mode.

For live OData through Tailscale/LAN, the common pattern is:

```bash
ODATA_SYNC_MODE=live
BC_ODATA_URL=http://tailscale-or-lan-host.example.local:7048/BC/ODataV4/Company('COMPANY')/ProductionOutput
BC_ODATA_AUTH_MODE=basic
BC_ODATA_USERNAME=replace-with-odata-username
BC_ODATA_PASSWORD=replace-with-odata-password
```

Restart the worker after changing any `BC_ODATA_*` value. The worker reads these values at startup.

Normal live sync uses the v1-style `Entry_No` strategy: first probe the latest remote `Entry_No`, compare it with the latest local `production_outputs.entry_no` for `source_system = 'business-central'`, fetch only `Entry_No gt <local latest>` when new rows exist, and otherwise run the configured recent backfill scan window for late-arriving rows. It must not silently fall back to mock mode when `ODATA_SYNC_MODE=live`.

Backfill variables can be supplied inline per run instead of being stored permanently in `.env`:

```bash
BACKFILL_FROM=2026-01-01 pnpm odata:backfill
BACKFILL_FROM=2026-01-01 BACKFILL_TO=2026-02-01 pnpm odata:backfill
BACKFILL_FROM=2026-01-01 BACKFILL_CHECK_TOP=25 BACKFILL_CHECK_MAX_PAGES=2 pnpm odata:backfill:check
BACKFILL_FROM=2026-01-01 BACKFILL_PAGE_SIZE=1 BACKFILL_CHUNK_PAGES=10 BACKFILL_CHUNK_RETRIES=2 pnpm odata:backfill
```

Read-only Business Central diagnostics:

```bash
pnpm bc:profile
pnpm bc:reconcile
RECONCILE_FROM=2026-06-18 RECONCILE_TO=2026-06-24 pnpm bc:reconcile
pnpm bc:target-coverage
```

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
