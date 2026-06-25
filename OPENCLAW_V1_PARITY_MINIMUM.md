Implement V1 Parity Minimum for PPIC Output Intelligence Platform v2.

Context:
V2 is a rebuild of the proven v1 project. The goal is not just a prettier or more complex app; v2 must work at least as correctly as v1 before adding more advanced v2 features.

Reference v1 repo:
https://github.com/harveymomo92-pixel/ppic-output-dashboard

Read first:
- docs/V1_PARITY_IMPLEMENTATION_PLAN.md
- docs/BC_METRIC_CONTRACT.md
- docs/OPERATIONS.md
- docs/PRD.md

Also inspect v1 source from GitHub and local artifacts if present:
- app/api/dashboard/route.ts
- app/page.tsx
- lib/dashboard.ts
- lib/types.ts
- db/schema.sql
- scripts/sync-odata.mjs
- scripts/init-db.mjs
- docs/master-entity-target-produksi.json
- docs/master-entity-target-summary.json
- docs/wa-parser-roadmap.md
- docs/wa-parser-backlog.md
- docs/wa-parser-fixtures.md
- RUNBOOK.md
- .tmp/v1-inspection/* if available locally

Rules:
- Do not copy v1 architecture blindly.
- Preserve v2 modular API/worker/domain/frontend architecture.
- Do not commit `.tmp/`, raw DB files, dumps, backups, `.env*`, secrets, cookies, tokens, or Authorization headers.
- Do not delete production data.
- Do not mutate data unless the command is explicitly a reviewed commit path.
- Dry-run by default for import/mapping workflows.
- All write actions must be audited.

Primary goal:
Bring v2 to minimum v1 parity for operational production usage.

PHASE 1 — V1 parity audit
1. Create or update `docs/V1_PARITY_GAP_AUDIT.md`.
2. Compare v1 vs v2 feature-by-feature:
   - Business Central sync
   - dashboard summary
   - Resume Harian per Item
   - target and achievement
   - reject conversion
   - master entity/target mapping
   - downtime import
   - WA parser
   - export/drilldown
   - ops/runbook/scheduler
3. Mark each item:
   - DONE
   - PARTIAL
   - MISSING
   - DEFERRED
4. Include exact files/endpoints/scripts to implement.

PHASE 2 — Production entry type scope
Implement current production dashboard scope:

```text
source_system = business-central
entry_type = Output
```

Rules:
- Non-output entry types remain stored for future management panels.
- They must not appear in current production dashboard/resume/KPI.
- Negative quantity under Output is correction and must reduce net output.
- Do not use `quantity > 0` as the main OK output rule.

Update:
- dashboard API queries
- output/detail queries
- Latest production output table
- mapping diagnostics default scope
- bc scripts default scope
- docs/tests

PHASE 3 — Replace raw Latest Production Outputs with Resume Harian per Item
Implement v1-style daily item resume.

Suggested endpoint:
`GET /api/v1/dashboard/daily-item-resume`

Grouping key:

```text
posting_date + resolved machine/entity/display_laporan + item_no
```

Required row fields:
- postingDate
- entityId
- machineLabel
- itemNo
- itemDescription
- itemCategoryCode
- documentSummary
- documentCount
- documentDetails
- operatorSummary
- operatorDetails
- workHours
- dailyTarget
- transactionProrataTarget
- netOutputQty
- positiveOutputQty
- correctionOutputQty
- uom
- rejectKg
- rejectPcsEq
- rejectConversionStatus
- achievementPct
- achievementStatus
- rejectPct
- grossWeight
- inputCount
- externalDocumentSummary
- notes

UI:
- title: `Resume Harian per Item`
- subtitle: `Entry_Type = Output · grouped by date, machine, and item`
- default 20 rows per page
- local table filters
- document/operator/reject drilldown
- correction quantity visible
- target/reject calculation explanation visible

PHASE 4 — Target and achievement v1 parity
Align target behavior with v1 where applicable:
- transaction prorata target = daily target × work_hours / 24
- missing target remains N/A/TARGET_MISSING
- target bucket/type inference from v1 must be preserved if v2 lacks explicit mapping
- target/achievement must be explainable from grouped daily item resume rows

PHASE 5 — Reject v1 parity
Implement reject attachment:
1. Attach reject rows to OK group by same date + machine/entity + document.
2. Fallback to same date + machine/entity.
3. Create reject-only group only if no OK group exists.
4. Use gross weight from matching OK document when available.
5. Missing gross weight = incomplete conversion gap, not silent zero.

PHASE 6 — Sync parity guard
Verify and protect v1-style incremental sync:
- remote latest Entry_No probe
- local latest Entry_No compare
- skip full pull when no new data
- Entry_No greater-than local latest for new data
- optional entry-type filter `BC_ODATA_ENTRY_TYPE_FILTER=Output`
- backfill unaffected
- tests for OData filter composition

PHASE 7 — Master data/mapping parity
Continue from current v2 mapping work:
- v1 master import path
- mapping candidates
- mapping plan CSV
- dry-run apply
- reviewed commit apply

Improve coverage but do not auto-map ambiguous LOW rows.

PHASE 8 — Downtime import parity
Ensure v2 matches v1 downtime import behavior:
- CSV/XLSX template download
- drag/drop/upload if UI exists
- preview/dry-run
- common header aliases
- idempotent natural key
- commit selected/valid rows only
- audit logs
- useful validation report

PHASE 9 — WA parser parity
Ensure v2 matches v1 parser behavior:
- Preview Parse separate from Save/Commit
- preview diff before save
- machine alias registry
- match_code and warning_code
- conservative typo autocorrect only when confidence high
- auto-suggest/auto-apply alias only when safe
- provider fallback to rules parser
- fixture regression tests
- downloadable CSV from parsed result

PHASE 10 — Drilldown/export parity
Ensure every KPI and resume row can drill down to source rows.
Exports must export grouped resume rows where appropriate, not raw ledger rows mislabeled as production resume.

PHASE 11 — Tests
Add/update tests for:
1. Production excludes non-output entry types.
2. Negative output quantity reduces net output.
3. Resume Harian per Item grouping.
4. Reject attachment logic.
5. Target prorata logic.
6. Missing target N/A.
7. Sync incremental Entry_No behavior.
8. Optional OData Entry_Type filter composition.
9. Downtime import idempotency.
10. WA parser preview/commit separation.
11. Alias registry/match code behavior.
12. No secret leakage.

PHASE 12 — Docs
Update:
- docs/V1_PARITY_IMPLEMENTATION_PLAN.md
- docs/V1_PARITY_GAP_AUDIT.md
- docs/BC_METRIC_CONTRACT.md
- docs/OPERATIONS.md
- docs/PRD.md
- README.md

Validation commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm bc:profile
pnpm bc:reconcile
pnpm bc:target-coverage
pnpm bc:mapping-candidates
pnpm odata:check
git diff --check
```

Smoke:

```bash
API_BASE_URL="http://localhost:4000/api/v1" \
WEB_BASE_URL="http://localhost:3000" \
ADMIN_EMAIL="admin@example.local" \
ADMIN_PASSWORD="change-this" \
pnpm smoke:test
```

Return:
1. V1 behavior studied.
2. Parity gap audit summary.
3. Files changed.
4. API endpoints added/changed.
5. UI pages/components changed.
6. Business rules implemented.
7. Resume Harian per Item sample output.
8. Reconciliation result.
9. Validation results.
10. Git status.
11. Files safe to commit.
12. Files that must not be committed.
