# V1 Master Data Migration Plan

Status: Milestone 11.1 dry-run implementation.

This plan imports real master data and mapping evidence from the local v1 export only. It does not use SSH, copy remote files, or read secrets.

## Local V1 Files

All source files are local runtime artifacts and must stay out of git:

- `.tmp/v1-inspection/ppic-dashboard.db`
- `.tmp/v1-inspection/master-entity-target-produksi.json`
- `.tmp/v1-inspection/master-entity-target-summary.json`
- `.tmp/v1-inspection/master_entity_target_produksi.csv`
- `.tmp/v1-inspection/entity_machines_itemledgerppic.csv`
- `.tmp/v1-inspection/itemledgerppic_output_last3months.csv`
- `.tmp/v1-inspection/schema.sql` generated locally for inspection only

Do not commit `.tmp/`, SQLite sidecars, dumps, backups, `.env`, cookies, tokens, or Authorization headers.

## V1 Tables Discovered

Read-only SQLite inspection found:

- `master_entity_target`: expanded v1 entity/target rows.
- `item_ledger_output`: v1 BC output cache with machine, line, item, UOM, gross weight, reject marker, and `entry_no`.
- `sync_runs`: v1 sync history.
- `app_settings`: present, empty in this export.
- `downtime_events`: present, empty in this export.
- `downtime_import_runs`: present, empty in this export.
- `sqlite_sequence`: SQLite metadata.

Only mapping-related data is used. Auth/session/user data is not exported or imported.

## V1 To V2 Field Mapping

| V1 source | V2 target | Notes |
|---|---|---|
| `master_entity_target.area_kerja_line` | `master_entities.area` | Area/reporting group. |
| `kode_asli_sistem` | `master_entities.line_code` and `master_entity_aliases.alias` for `prod_line_description` | Imported only when one source code maps to one canonical target entity. |
| `display_laporan` | `master_entities.report_group` and display-name seed | Used with product description for readable entity names. |
| `deskripsi_produk` | `master_entities.product_family` | Parenthetical `Alias Nama Sistem` / `Duplikasi Nama Sistem` is normalized into canonical grouping. |
| `active_target_type` | entity disambiguator and audit context | V2 targets are entity/date based, so multi-target source codes stay ambiguous unless split by entity. |
| `active_target` | `production_targets.daily_target_qty` | Imported as approved target version `1`. |
| `target_achievement_rate` | `production_targets.min_achievement_pct` | Decimal v1 values are converted to percent, for example `0.8` -> `80`. |
| `target_reject_rate` | `production_targets.reject_target_pct` | Decimal v1 values are converted to percent, for example `0.03` -> `3`. |
| `entity_machines_itemledgerppic.Machine_Center_No` | `master_entity_aliases.alias` for `machine_center_no` | Imported only when v1 ledger evidence maps that machine to one canonical entity. |
| `itemledgerppic_output_last3months.Item_No` + `Unit_of_Measure_Code` + stable `Gross_Weight` | `item_conversion_mappings` | Imported only when all positive gross-weight evidence for item/UOM is stable. |

## Import Order

1. Parse and canonicalize v1 master target rows.
2. Create/reuse `master_entities`.
3. Create/reuse unambiguous `master_entity_aliases`.
4. Create/reuse approved `production_targets`.
5. Create/reuse stable `item_conversion_mappings`.
6. Dry-run output mapping overlap against current `production_outputs`.
7. In commit mode only, update unmapped matching `production_outputs.entity_id`.
8. Write one system audit entry for the commit summary.

## Ambiguity And Risks

- V1 has multiple target rows for some source codes, for example printing OZ buckets and thermoforming gross-weight buckets. These source codes are reported as conflicts and are not auto-aliased.
- Some machine centers served multiple product targets in v1 evidence, for example `VFINE-BT400`, `LS1-24.5/27.5`, `BORCHE1PF19`, and `NEWDO 1 REG`. These remain unmapped until reviewed.
- V2 stores one `entity_id` per output row. It cannot safely infer a product-specific target from a machine alias alone when v1 had multiple target buckets.
- Existing v2 manual master data is not overwritten unless `V1_IMPORT_ALLOW_UPDATE=true`.
- The import defaults target effective date to `2026-01-01`. Override with `V1_TARGET_EFFECTIVE_FROM=YYYY-MM-DD` if PPIC approves a different date.

## Current Dry-Run Profile

From `pnpm v1:master-profile`:

- Raw v1 master target rows: 61
- Planned canonical entities: 48
- Planned aliases: 61
- Planned production targets: 48
- Planned stable item conversions: 174
- Conflicts/warnings: 25
- Estimated v2 rows that would become mapped: 1,347
- Estimated OK quantity that would become mapped: 210,048,377

## Commands

Read-only profile:

```bash
pnpm v1:master-profile
```

Dry-run import:

```bash
pnpm v1:master-import
```

Read-only reconcile:

```bash
pnpm v1:master-reconcile
```

Commit import after review:

```bash
V1_MASTER_IMPORT_COMMIT=true pnpm v1:master-import
```

Commit with a different target effective date:

```bash
V1_TARGET_EFFECTIVE_FROM=2026-02-13 V1_MASTER_IMPORT_COMMIT=true pnpm v1:master-import
```

Allow updates to existing v2 manual rows only after explicit approval:

```bash
V1_IMPORT_ALLOW_UPDATE=true V1_MASTER_IMPORT_COMMIT=true pnpm v1:master-import
```

## Rollback Plan

Preferred rollback is a PostgreSQL backup restore taken immediately before commit.

If a targeted rollback is approved instead:

1. Stop API/worker writes.
2. Capture the audit row where `action = 'v1.master_import.commit'`.
3. Set `production_outputs.entity_id = null` for rows mapped by aliases imported with `source = 'v1-master-import'`.
4. Delete `item_conversion_mappings` rows where `source = 'v1-master-import'`.
5. Delete `production_targets` tied to the imported entity list.
6. Delete `master_entity_aliases` where `source = 'v1-master-import'`.
7. Delete imported `master_entities` only after confirming no remaining outputs, downtime, or targets reference them.
8. Re-run `pnpm bc:profile`, `pnpm bc:target-coverage`, and `pnpm bc:reconcile`.

Do not use destructive SQL without a fresh backup and reviewed entity list.

## Validation Plan

Before commit:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm v1:master-profile
pnpm v1:master-import
pnpm v1:master-reconcile
pnpm bc:mapping-candidates
pnpm bc:target-coverage
pnpm bc:reconcile
git diff --check
```

After approved commit:

```bash
pnpm bc:profile
pnpm bc:mapping-candidates
pnpm bc:target-coverage
pnpm bc:reconcile
```

Expected after commit:

- Active entities and aliases become greater than zero.
- Some `business-central` rows move from `UNMAPPED_ENTITY` to mapped entities.
- Target coverage improves for rows that match imported aliases and approved effective targets.
- Dashboard achievement remains `N/A / TARGET_MISSING` for rows still unmapped or truly missing targets.
