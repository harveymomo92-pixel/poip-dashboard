# V1 Parity Implementation Plan — PPIC Output Intelligence Platform v2

Status: Execution Gate
Scope: Make v2 work at least as reliably as proven v1 behavior, while preserving v2 production-grade architecture.

## 1. Why this gate exists

V2 is a rebuild, not a replacement of the proven business logic. The goal is to keep the mature foundation of v2 while restoring every critical operational behavior that already worked in v1.

The current v2 foundation already includes:

- PostgreSQL
- API service
- Worker service
- Auth/RBAC
- Audit log
- Business Central live sync
- Historical backfill
- Incremental sync
- Master Data and Mapping Center
- v1 master-data dry-run import
- assisted mapping workflow

But v2 must now be aligned to v1 in the business layer, especially the daily production resume, target logic, downtime import, WA parser, and operations workflow.

## 2. Source references

Primary v1 repo:

- https://github.com/harveymomo92-pixel/ppic-output-dashboard

Important v1 areas:

- `README.md`
- `app/api/dashboard/route.ts`
- `app/page.tsx`
- `lib/dashboard.ts`
- `lib/types.ts`
- `db/schema.sql`
- `scripts/sync-odata.mjs`
- `scripts/init-db.mjs`
- `scripts/import-downtime*`
- `docs/master-entity-target-produksi.json`
- `docs/master-entity-target-summary.json`
- `docs/wa-parser-roadmap.md`
- `docs/wa-parser-backlog.md`
- `docs/wa-parser-fixtures.md`
- `RUNBOOK.md`

Local v1 artifacts, if present:

- `.tmp/v1-inspection/ppic-dashboard.db`
- `.tmp/v1-inspection/master-entity-target-produksi.json`
- `.tmp/v1-inspection/master-entity-target-summary.json`
- `.tmp/v1-inspection/master_entity_target_produksi.csv`
- `.tmp/v1-inspection/entity_machines_itemledgerppic.csv`
- `.tmp/v1-inspection/itemledgerppic_output_last3months.csv`

Do not commit `.tmp/` or any raw DB/export files.

## 3. V1 behavior that v2 must match first

### 3.1 Business Central data scope

V1 production sample is scoped to:

```text
Entry_Type = Output
```

V2 current production dashboard must also use:

```text
source_system = business-central
entry_type = Output
```

Non-output entry types must remain stored for future management panels, but must not appear in production dashboards or production KPI calculations.

Quantity rules:

- Quantity may be positive.
- Quantity may be zero.
- Quantity may be negative.
- Negative quantity under `Entry_Type = Output` is a correction/reversal and must reduce net output.
- Do not use `quantity > 0` as the main output rule.

### 3.2 Resume Harian per Item

V1's proven operational table is not a raw ledger. V2 must implement the same concept:

```text
Resume Harian per Item
```

Grouping key:

```text
posting_date + resolved machine/entity/display laporan + item_no
```

Required table behavior:

- 20 rows per page by default.
- Newest date first.
- Local table filters should affect only the table, not global dashboard filters.
- Show grouped operational rows, not raw ledger rows.
- Show document/operator/reject details as drilldown/popover/detail drawer.
- Preserve enough drilldown data to explain every number.

Required columns:

- Tanggal
- Mesin
- Item
- Kategori
- No Dokumen
- Operator
- Jam Kerja
- Target Prorata Transaksi
- Output OK / Net Output
- UOM
- Koreksi Qty
- Reject kg
- Reject PCS Eq
- % Ach
- % Reject
- Gross Weight
- Input
- Catatan Operator

### 3.3 Target and achievement

V1 had working master target entity logic. V2 must keep missing targets honest:

- Missing target = `N/A / TARGET_MISSING`
- Missing target is not numeric 0.
- Transaction prorata target should follow the v1-style rule where applicable:

```text
transaction_prorata_target = daily_target × work_hours / 24
```

If v2 has a better explicit target model, use v2's model, but match v1 output where the business rule is the same.

### 3.4 Reject handling

Reject rows should be attached to OK groups if possible:

1. Same posting date.
2. Same resolved machine/entity.
3. Same document number.
4. Fallback to same date + machine/entity.
5. If still unmatched, create reject-only group.

Reject PCS Eq:

```text
reject_pcs_eq = reject_kg / gross_weight_per_pcs
```

If gross weight is missing or invalid:

- Keep reject kg visible.
- Mark conversion incomplete.
- Do not silently show clean zero.

### 3.5 Sync behavior

V1 already used proven incremental sync behavior:

- Check latest remote `Entry_No` first.
- Check latest local `Entry_No`.
- If no new data, skip pulling full history.
- If new data exists, pull only rows above latest local entry.
- Scheduled sync during working hours.

V2 already implemented most of this. This gate must verify it remains intact after all changes.

### 3.6 Master data mapping

V2 must use v1 master target/mapping data as baseline but not create fake entities.

Required:

- v1 import remains dry-run by default.
- Mapping plan remains review-first.
- LOW/ambiguous candidates must not auto-commit.
- Blank source groups must require context review.
- Master entity aliases must remain auditable.

### 3.7 Downtime import parity

V1 supported downtime import/backfill from CSV/XLSX with template and idempotent natural key. V2 must match or improve this.

Required:

- Download template CSV/XLSX.
- Preview/dry-run before commit.
- Idempotent commit.
- Natural key duplicate detection.
- Common header aliases supported.
- Required/optional fields clear.
- Audit log on commit.

### 3.8 WA parser parity

V1 had a practical parser workflow:

- Preview parse and save/commit separated.
- Diff before save.
- Alias registry for machine master.
- Match/warning codes for explainability.
- Auto-suggest/auto-apply alias only for high confidence.
- Download CSV of parser result.
- Rules parser remains fallback if AI providers fail.

V2 must match or improve this behavior without directly committing unreviewed AI output.

### 3.9 UI/UX parity

V2 UI can be better than v1, but must not remove useful v1 operational affordances:

- Production resume table first-class.
- Drilldown from KPI to the grouped rows.
- Local filters for detail table.
- Clear stale/empty/error states.
- Mapping and parser explanations visible.

## 4. Minimal parity acceptance criteria

V2 is considered minimally equivalent to v1 only when:

1. Production dashboard excludes non-output entry types.
2. Negative output quantities are treated as corrections and reduce net output.
3. Resume Harian per Item works and replaces raw latest ledger table.
4. OK/reject/target/achievement can be reconciled to grouped rows.
5. v1 master entity import and mapping plan workflows exist and are safe.
6. Target coverage improves from imported/mapped entities.
7. Downtime import has preview, template, idempotent commit.
8. WA parser has preview, correction, commit, alias/match explanations, and fixtures.
9. Incremental sync does not re-fetch full history after backfill.
10. All validation commands pass.

## 5. Suggested execution order

1. V1 parity audit.
2. Production entry-type output scope patch.
3. Resume Harian per Item API/UI.
4. Target engine alignment.
5. Reject attachment/conversion alignment.
6. Mapping coverage expansion.
7. Downtime import parity.
8. WA parser parity.
9. Drilldown/export parity.
10. Final v1 vs v2 reconciliation report.

## 6. Validation commands

Run after implementation:

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

Smoke test:

```bash
API_BASE_URL="http://localhost:4000/api/v1" \
WEB_BASE_URL="http://localhost:3000" \
ADMIN_EMAIL="admin@example.local" \
ADMIN_PASSWORD="change-this" \
pnpm smoke:test
```

SQL entry type verification:

```sql
select entry_type, normalized_output_type, count(*) as rows, sum(quantity) as qty
from production_outputs
where source_system = 'business-central'
group by entry_type, normalized_output_type
order by rows desc;
```

## 7. Files that must never be committed

- `.env`
- `.env.*` containing real values
- `.tmp/`
- `.tmp/v1-inspection/`
- `.tmp/mapping-plan/`
- `*.db`
- `*.db-shm`
- `*.db-wal`
- `*.sqlite`
- `*.sqlite3`
- `*.dump`
- raw SQL dumps
- backups
- cookies
- tokens
- Authorization headers
- Business Central credentials
