# OpenClaw Prompt — P0.1 Business Central Calculation Accuracy and Sync Strategy v1 Adaptation

Implement P0.1 — Business Central Calculation Accuracy and Sync Strategy v1 Adaptation.

Context:
Business Central live ingestion is now working and data is entering PostgreSQL. However, dashboard calculations are still not trustworthy. The current dashboard shows symptoms such as:
- Target = 0
- Achievement = N/A
- OK Output very large
- Many critical data quality issues
- Large “Unmapped” machine/entity output
- Reject PCS equivalent may show 0 while conversion gaps exist

This means the project has passed the ingestion gate, but has not yet passed the calculation correctness gate.

Reference project:
Use the older v1 project as a reference:
`https://github.com/harveymomo92-pixel/ppic-output-dashboard`

Important v1 behavior to preserve/adapt:
- Live sync checks latest remote `Entry_No` first.
- If remote latest `Entry_No` is not newer than local latest `Entry_No`, do not pull full history again.
- If new data exists, fetch only `Entry_No` greater than local latest.
- Use an active sync range/backfill scan window for late-arriving rows.
- Keep sync idempotent.
- Keep runtime secrets outside source.
- Use Business Central data as the source of truth, not mock data.

Do not print or commit secrets.
Do not print or commit `.env`, BC password, cookies, session tokens, Authorization headers, backup SQL files, `.bak-*`, or `backups/`.
Do not hardcode the real BC endpoint, company name, username, or password.
Use placeholders only in docs.

Primary goal:
Make dashboard calculations correct and make sync strategy optimal after live BC data has entered the database.

Phase 1 — Audit current calculation path:
1. Inspect:
   - `apps/api/src/modules/dashboard/dashboard.repository.ts`
   - `apps/api/src/modules/dashboard/dashboard.types.ts`
   - `apps/api/src/modules/dashboard/dashboard.query.ts`
   - `packages/domain/src/dashboard/*`
   - `packages/domain/src/odata/*`
   - `apps/worker/src/jobs/odata-sync/*`
   - `packages/db/src/schema.ts`
2. Identify exactly how these are calculated:
   - OK Output
   - Target
   - Achievement
   - Reject KG
   - Reject PCS equivalent
   - Reject Rate
   - Downtime
   - Freshness
   - Machine output
   - Data quality issue count
3. Confirm every calculation consistently applies:
   - date range filter
   - machine/entity filter
   - item filter
   - shift filter
   - source system filter
   - normalized output type filter
4. Confirm dashboard uses `source_system = 'business-central'`, not an incorrect hardcoded value such as `BUSINESS_CENTRAL`.

Phase 2 — Establish Business Central metric contract:
Create or update `docs/BC_METRIC_CONTRACT.md`.

The metric contract must explain:
1. Which BC fields map to internal fields.
2. Which rows count as OK Output.
3. Which rows count as reject.
4. Which rows must be excluded from output KPI.
5. How negative quantities are handled.
6. How unmapped machine/entity rows are treated.
7. How target matching works.
8. How missing targets are represented.
9. How reject PCS equivalent is calculated.
10. How conversion gaps are counted.
11. How freshness is calculated.

Important calculation principles:
- Do not convert missing target into numeric 0 unless the business rule explicitly says target is 0.
- If target is missing, achievement must be `N/A` with reason `TARGET_MISSING`.
- OK Output must be calculated only from valid output rows, not from all item ledger rows.
- Reject rate must use the agreed domain formula only.
- Reject PCS equivalent must not silently show 0 when gross weight conversion is missing.
- Unmapped machine/entity rows must be visible as a separate data quality issue and must not make target/achievement misleading.
- Freshness must use latest successful `business-central` sync run, not failed historical sync runs.

Phase 3 — Add BC profile and reconciliation scripts:
Add scripts and package commands:

1. `pnpm bc:profile`
   - Prints sanitized profile of current BC data in PostgreSQL:
     - total rows
     - min/max posting date
     - rows by month
     - rows by entry type
     - rows by normalized output type
     - rows by source system
     - top unmapped machines/entities
     - top items by quantity
     - target coverage by entity/date
     - conversion gap count

2. `pnpm bc:reconcile`
   - Compares dashboard KPI summary against raw SQL aggregates for the same filter window.
   - Default window: last 7 days.
   - Accept env:
     - `RECONCILE_FROM`
     - `RECONCILE_TO`
     - `RECONCILE_ENTITY_ID`
     - `RECONCILE_ITEM_NO`

3. `pnpm bc:target-coverage`
   - Reports how many output rows have matching active/approved target.
   - Groups by entity/machine and month.
   - Highlights target missing reasons.

All scripts must be safe:
- Load `.env` if present.
- Do not print secrets.
- Do not mutate data unless explicitly named as a mutation script.
- Work with `source_system = 'business-central'`.

Phase 4 — Fix calculation correctness:
1. Fix dashboard repository/domain calculations based on the metric contract.
2. Ensure OK Output uses only correct output rows.
3. Ensure target calculation uses active/approved target rows and returns null/N/A if missing.
4. Ensure achievement is calculated only when target exists and target > 0.
5. Ensure machine output separates mapped and unmapped entities.
6. Ensure data quality classification is consistent.
7. Ensure freshness uses latest successful `sync_runs` where `source_system = 'business-central'`.

Phase 5 — Improve sync strategy using v1:
1. Confirm or implement live incremental sync:
   - probes latest remote `Entry_No`
   - reads latest local `entry_no`
   - if remote <= local, avoids full pull
   - optionally runs a small backfill scan window
   - if remote > local, pulls only `Entry_No gt latestLocalEntryNo`
2. Add env if missing:
   - `BC_ODATA_INCREMENTAL_FIELD=Entry_No`
   - `BC_ODATA_BACKFILL_SCAN_DAYS=14`
   - `BC_ODATA_INCREMENTAL_PAGE_SIZE=1000`
   - `BC_ODATA_REQUEST_TIMEOUT_MS=120000`
   - `BC_ODATA_RETRY_ATTEMPTS=3`
   - `BC_ODATA_RETRY_DELAY_MS=1000`
3. Ensure normal worker sync after full backfill does not re-fetch all historical rows.
4. Ensure sync checkpoints record latest local/remote entry number and last successful sync time.

Phase 6 — Tests:
Add or update tests for:
1. Dashboard calculation with valid target.
2. Dashboard calculation with missing target must show N/A, not target 0.
3. OK Output includes only valid OK output rows.
4. Reject KG and Reject PCS Eq do not silently hide conversion gaps.
5. Freshness uses latest successful sync, not older failed sync.
6. Machine output separates mapped vs unmapped.
7. Source system is `business-central`.
8. Sync strategy skips full pull when remote latest `Entry_No` <= local latest `Entry_No`.
9. Sync strategy fetches `Entry_No gt latestLocalEntryNo` when new data exists.
10. Backfill scan window is used for late-arriving rows.
11. Re-running sync/backfill remains idempotent.
12. No credential leakage in errors/logs.

Phase 7 — Docs:
Update:
- `docs/PRD.md`
- `docs/OPERATIONS.md`
- `docs/ENVIRONMENT.md`
- `README.md`

Validation commands:
Run:
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm odata:check`
- `pnpm bc:profile`
- `pnpm bc:reconcile`
- `pnpm bc:target-coverage`
- `git diff --check`
- smoke test:
  `API_BASE_URL="http://localhost:4000/api/v1" WEB_BASE_URL="http://localhost:3000" ADMIN_EMAIL="admin@example.local" ADMIN_PASSWORD="change-this" pnpm smoke:test`

Do not run destructive cleanup.
Do not delete production outputs.
Do not delete sync history.
Do not commit automatically unless all validation passes.

Return:
1. Root cause of wrong calculations.
2. Files changed.
3. Metric contract summary.
4. Sync strategy changes adapted from v1.
5. New scripts and commands.
6. Before/after dashboard calculation sample for the current 18/06/2026–24/06/2026 window.
7. Target coverage result.
8. Unmapped entity summary.
9. Validation results.
10. Git status.
11. Files safe to commit.
12. Files that must not be committed.
