# QA Checklist

## Automated checks

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm smoke:test`
- [ ] `ADMIN_EMAIL=<email> ADMIN_PASSWORD=<password> pnpm smoke:test`

## Environment checks

- [ ] `.env` exists locally and is not committed.
- [ ] `DATABASE_URL` points to the intended database.
- [ ] `REDIS_URL` points to the intended Redis instance.
- [ ] `AUTH_SECRET` and `SESSION_SECRET` are not placeholder values.
- [ ] `WEB_ORIGIN` matches the browser origin.
- [ ] `NEXT_PUBLIC_API_BASE_URL` matches the API URL reachable from browsers.
- [ ] `ODATA_SYNC_MODE=mock` in local/UAT unless live Business Central credentials are approved.

## Core workflow checks

- [ ] Login succeeds with a valid local admin.
- [ ] Logout clears the session.
- [ ] Anonymous `/auth/me` returns unauthorized.
- [ ] `/overview` anonymous browser access redirects to login.
- [ ] Dashboard loads with loading, empty, and error states.
- [ ] Sync status and run history load.
- [ ] Target create/update/approve/reject/deactivate workflow works.
- [ ] Downtime create/update/close workflow works.
- [ ] WhatsApp Parser preview/commit workflow works.
- [ ] Import Center preview/commit workflow works.
- [ ] Data Quality filters, detail, acknowledge, resolve, ignore, and reopen work.
- [ ] Audit Viewer filters and detail view work.
- [ ] System Health is read-only and shows PostgreSQL/Redis/queue/migration/freshness.

## RBAC checks

- [ ] Admin has full access.
- [ ] Manager can view audit/data-quality and approve targets.
- [ ] PPIC can access assigned operations/tools but not users.
- [ ] ProductionLeader can use downtime/parser permissions but not admin settings.
- [ ] Maintenance can manage downtime but not import/sync/admin.
- [ ] QC can view data-quality and output but cannot manage settings.
- [ ] Viewer is read-only and blocked from restricted pages.

## Security/data-safety checks

- [ ] No production secrets are present in Git.
- [ ] Audit detail redacts tokens, passwords, raw payloads, source text, and stored file paths.
- [ ] Import and parser flows require preview before commit.
- [ ] Data Quality resolve/ignore requires a note.
- [ ] Write actions create audit entries.
- [ ] Uploaded/imported test data does not contain sensitive real production content unless approved.

## Visual and accessibility checks

- [ ] Pages use the warm Notion Beige design system.
- [ ] Forms have labels and helper/error text.
- [ ] Buttons show loading/disabled states during writes.
- [ ] Dialogs are keyboard accessible.
- [ ] Status does not rely on color alone.
- [ ] Sidebar works expanded, collapsed, and on mobile.
