# API Endpoints

Implemented backend endpoints for the PPIC Output Intelligence Platform.

Base URL for local development:

```text
http://localhost:4000/api/v1
```

All non-public endpoints require authentication through the local session cookie or bearer token. Responses use the standard API envelope:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "requestId": "request-id",
    "generatedAt": "2026-06-23T00:00:00.000Z"
  }
}
```

Error responses use:

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  },
  "meta": {
    "requestId": "request-id"
  }
}
```

## Health

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | API health check. |
| `GET` | `/health/readiness` | `settings.manage` | Deep readiness for PostgreSQL, migrations, Redis, queue workers, sync freshness, and latest operational runs. |
| `GET` | `/health/deep` | `settings.manage` | Alias for the deep readiness response. |

## Auth

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | Public | Local email/password login. Sets session cookie and returns token/user. |
| `POST` | `/auth/logout` | Authenticated | Clears session cookie and writes logout audit log. |
| `GET` | `/auth/me` | Authenticated | Returns the current authenticated principal. |

## Users

All user endpoints require `users.manage`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/users` | List users and roles. |
| `POST` | `/users` | Create a user with roles. |
| `PATCH` | `/users/:id` | Update user name, active flag, or roles. |
| `POST` | `/users/:id/disable` | Disable a user. |

## Dashboard

All dashboard endpoints require `dashboard.view`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/dashboard/summary` | KPI summary for selected filters/date range. |
| `GET` | `/dashboard/trends` | Output trends grouped by business date. |
| `GET` | `/dashboard/breakdowns` | Output breakdown by `machine`, `entity`, `item`, or `shift`. |

Common query filters: `from`, `to`, `entityId`, `machine`, `item`, `shiftCode`.

## Outputs

All output endpoints require `output.view`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/outputs` | Paginated production output list with filters and sorting. |
| `GET` | `/outputs/:id` | Production output detail. |

Common query filters: `from`, `to`, `entityId`, `machine`, `item`, `shiftCode`, `page`, `pageSize`, `sortBy`, `sortDirection`.

## Sync

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `POST` | `/sync/odata/run` | `sync.run` | Trigger incremental OData sync job. |
| `POST` | `/sync/odata/resync-range` | `sync.run` | Trigger OData resync for a date range. |
| `GET` | `/sync/status` | `sync.view` | Latest sync/checkpoint status. |
| `GET` | `/sync/runs` | `sync.view` | Sync run history. |
| `GET` | `/sync/runs/:id` | `sync.view` | Sync run detail. |

Useful query params: `sourceSystem`, `limit`.

## Targets

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/targets/entities` | `target.view` | List active target entities. |
| `GET` | `/targets` | `target.view` | List production targets with filters. |
| `GET` | `/targets/:id` | `target.view` | Target detail. |
| `POST` | `/targets` | `target.create` | Create draft target. |
| `PATCH` | `/targets/:id` | `target.create` | Update draft target. |
| `POST` | `/targets/:id/submit` | `target.create` | Submit target for approval. |
| `POST` | `/targets/:id/approve` | `target.approve` | Approve target and supersede overlapping active targets. |
| `POST` | `/targets/:id/reject` | `target.approve` | Reject submitted target. |
| `POST` | `/targets/:id/deactivate` | `target.create` | Deactivate target. |

Common query filters: `from`, `to`, `entityId`, `machine`, `itemNo`, `shiftCode`, `status`.

## Downtime

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/downtime/entities` | `downtime.view` | List active downtime entities. |
| `GET` | `/downtime` | `downtime.view` | Paginated downtime event list with filters. |
| `GET` | `/downtime/:id` | `downtime.view` | Downtime event detail. |
| `POST` | `/downtime` | `downtime.create` | Create downtime event. |
| `PATCH` | `/downtime/:id` | `downtime.update` | Update an open downtime event. |
| `POST` | `/downtime/:id/close` | `downtime.close` | Close downtime event with root cause/action. |

Common query filters: `from`, `to`, `entityId`, `machine`, `status`, `category`, `shiftCode`, `page`, `pageSize`.

## WhatsApp Parser

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `POST` | `/parser/wa/preview` | `parser.preview` | Parse pasted WhatsApp operational text and store preview rows. |
| `GET` | `/parser/wa/runs` | `parser.preview` | Parser run history. |
| `GET` | `/parser/wa/runs/:id` | `parser.preview` | Parser run detail and rows. |
| `POST` | `/parser/wa/runs/:id/commit` | `parser.commit` | Commit selected or all valid parser rows. |

Commit body can be `{}` to commit all valid rows, or:

```json
{
  "selectedRowIds": ["row-uuid"]
}
```

## Import Center

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `POST` | `/imports/preview` | `import.preview` | Upload CSV/XLSX file for dry-run downtime import preview. |
| `GET` | `/imports/runs` | `import.preview` | Import run history. |
| `GET` | `/imports/runs/:id` | `import.preview` | Import run detail and rows. |
| `GET` | `/imports/runs/:id/errors` | `import.preview` | Error report content for invalid/duplicate/conflict rows. |
| `POST` | `/imports/runs/:id/commit` | `import.commit` | Commit selected or all valid import rows to downtime events. |

Preview uses multipart form data:

```bash
curl -b /tmp/poip.cookies \
  -X POST http://localhost:4000/api/v1/imports/preview \
  -F importType=downtime \
  -F file=@/path/to/downtime.csv
```

Commit body can be `{}` to commit all valid rows, or:

```json
{
  "selectedRowIds": ["row-uuid"]
}
```

## Data Quality

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/data-quality/summary` | `data_quality.view` | Data quality issue counts and summary. |
| `GET` | `/data-quality/issues` | `data_quality.view` | Paginated issues filtered by status, severity, source, issue code, and date. |
| `GET` | `/data-quality/issues/:id` | `data_quality.view` | Redacted issue detail and source context. |
| `POST` | `/data-quality/issues/:id/acknowledge` | `settings.manage` | Mark an open issue as acknowledged. |
| `POST` | `/data-quality/issues/:id/resolve` | `settings.manage` | Resolve an active issue with a required note. |
| `POST` | `/data-quality/issues/:id/ignore` | `settings.manage` | Ignore an active issue with a required note. |
| `POST` | `/data-quality/issues/:id/reopen` | `settings.manage` | Reopen a resolved or ignored issue. |

## Audit

Audit endpoints require `audit.view`. Returned before/after values redact credentials, tokens, raw payloads, source text, and stored file paths.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/audit` or `/audit-logs` | Paginated audit activity with entity, action, actor, entity ID, and date filters. |
| `GET` | `/audit/:id` or `/audit-logs/:id` | Human-readable audit detail with safe before/after values. |

## Frontend Routes

Primary frontend routes backed by these APIs:

| Path | Description |
| --- | --- |
| `/login` | Local login page. |
| `/overview` | Output dashboard and KPI read model. |
| `/downtime` | Downtime workflow. |
| `/tools/import-center` | CSV/XLSX Import Center. |
| `/tools/wa-parser` | WhatsApp parser workflow. |
| `/settings/sync` | Sync Center. |
| `/settings/targets` | Target Management. |
| `/settings/users` | User Management. |
| `/data-quality` | Data Quality Cockpit. |
| `/settings/audit` | Read-only Audit Viewer. |
| `/settings/health` | System Health and readiness dashboard. |
