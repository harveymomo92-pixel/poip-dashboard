# UAT Guide

Run UAT in a non-production environment with local/mock OData first. Do not use real production credentials in UAT unless the environment is approved for them.

## Test accounts

Minimum:

- Admin: created with `pnpm db:create-admin`.

Recommended role coverage:

- Manager
- PPIC
- ProductionLeader
- Maintenance
- QC
- Viewer

Create additional users from `/settings/users` while signed in as Admin. Use temporary UAT-only passwords. Do not reuse local/demo credentials in production.

## Pre-UAT setup

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed
ADMIN_EMAIL=admin@example.local ADMIN_NAME="System Admin" ADMIN_PASSWORD="change-this-local" pnpm db:create-admin
pnpm dev
```

Run baseline validation:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
ADMIN_EMAIL=admin@example.local ADMIN_PASSWORD=change-this-local pnpm smoke:test
```

## UAT scenarios

### 1. Login and session

- Open `/login`.
- Sign in as Admin.
- Confirm redirect to `/overview`.
- Logout from the user/session menu.
- Confirm protected pages redirect or block anonymous access.

### 2. Dashboard overview

- Open `/overview`.
- Confirm KPI cards render without fake data.
- Apply date/entity/shift filters.
- Reset filters.
- Confirm freshness and data-quality indicators are understandable.

### 3. Sync Center

- Open `/settings/sync`.
- Confirm latest status and run history load.
- Trigger a mock/manual sync if the environment allows it.
- Confirm sync run appears and audit entry is created.

### 4. Target workflow

- Open `/settings/targets`.
- Create a draft target.
- Submit for review if the workflow requires it.
- Approve as Admin or Manager.
- Reject a separate test target.
- Deactivate a test target.
- Confirm status badges and audit events.

### 5. Downtime workflow

- Open `/downtime`.
- Create an open downtime event.
- Update details.
- Close downtime with root cause/action.
- Confirm duration, closed status, and audit event.

### 6. WhatsApp Parser

- Open `/tools/wa-parser`.
- Paste a small UAT text sample.
- Run preview.
- Review validation issues.
- Commit selected/all valid rows.
- Confirm parser result summary and audit event.

### 7. Import Center

- Open `/tools/import-center`.
- Upload a small UAT downtime CSV/XLSX.
- Preview.
- Review invalid/duplicate/conflict rows.
- Commit selected/all valid rows.
- Confirm result summary and audit event.

### 8. Data Quality

- Open `/data-quality`.
- Filter by status, severity, source, issue type, and date.
- Open an issue detail panel.
- Acknowledge an open issue.
- Resolve an issue with a note.
- Ignore an issue with a note.
- Reopen a resolved/ignored issue where safe.
- Confirm audit entries.

### 9. Audit Viewer

- Open `/settings/audit`.
- Filter by module/entity, action, actor, date, and entity ID.
- Open an audit detail panel.
- Confirm before/after values are present where safe.
- Confirm secrets, tokens, raw payloads, source text, and stored file paths are redacted.

### 10. System Health

- Open `/settings/health`.
- Confirm API, PostgreSQL, Redis, queue, migration, sync freshness, import, and parser status are visible.
- Confirm read-only behavior.

### 11. Role and permission checks

- Viewer can open read-only dashboard pages but cannot manage users/import/sync.
- PPIC can access output/targets/import/data-quality according to the permission matrix.
- Manager can approve targets and view audit/data-quality.
- QC can view data quality but cannot manage settings.
- Admin can access all v2 pages.

### 12. Final UAT sign-off

Record:

- Environment and commit/build identifier.
- UAT date and participants.
- Passed scenarios.
- Failed scenarios and defect IDs.
- Known limitations accepted for v2.
- Go/no-go decision.
