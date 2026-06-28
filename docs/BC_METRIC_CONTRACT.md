# Business Central Metric Contract

Status: P0.1 contract for Business Central Calculation Accuracy and v1 Sync Strategy Adaptation.

This document defines how live Business Central OData rows become PPIC dashboard metrics.

## Canonical Source System

```text
business-central
```

All SQL, dashboard, sync, health, and reconciliation logic should use this canonical source-system value for live Business Central data.

## Source Field Mapping

| Business Central Field | Internal Field | Notes |
|---|---|---|
| `Entry_No` | `entry_no` / `entryNo` | Stable natural key with `source_system`. |
| `Posting_Date` | `posting_date` / `postingDate` | Main operational date filter. |
| `Document_Date` | `document_date` / `documentDate` | Secondary document date. |
| `Document_No` | `document_no` / `documentNo` | Document/SPK reference when available. |
| `External_Document_No` | `external_document_no` / `externalDocumentNo` | Optional operational code. When formatted as `SHIFT/HOURS/OPERATOR`, for example `S1/8/RAHMAT`, it supplies resume shift, work hours, and operator. |
| `Entry_Type` | `entry_type` / `entryType` | Used with quantity/reject KG to normalize OK, reject, or other movement. |
| `Item_No` / equivalent item number field | `item_no` / `itemNo` | Required for committed output rows. |
| `Description` / equivalent description field | `item_description` / `itemDescription` | Optional item label. |
| `Machine_Description` / `Machine Description` | `machine_description` / `machineDescription` | Stored only when Business Central exposes a true machine-description field. The current profiled endpoint does not expose one, so this remains blank for those rows. |
| `Machine_Center_No` / equivalent work center field | `machine_center_no` / `machineCenterNo` | Useful but incomplete machine/work-center source. Existing aliases remain valid fallback aliases. |
| `gProdOrRotLine_No` | `prod_line_no` / `prodLineNo` | Reliable production-line source from the current Business Central OData profile. |
| `gProdOrRotLine_Description` | `prod_line_description` / `prodLineDescription` | Reliable production-line description from the current Business Central OData profile. |
| `gSrcDesc` | item/source description only | Item, reject, or sparepart description. It must not be used as machine, line, or machine description. |
| `Quantity` | `quantity` | Main quantity basis. Positive, zero, and negative quantities are preserved. Negative `Entry_Type = Output` OK rows are corrections/reversals and reduce net output. |
| `Unit_of_Measure_Code` | `uom` | Required for interpretation and conversion review. |
| `Gross_Weight` | `gross_weight_per_pcs` | Used to convert reject KG into reject PCS equivalent. |
| `Reject_KG` | `reject_kg` | Reject weight when exposed by BC. |
| raw payload | `raw_payload` / `rawPayload` | Preserve original BC row. |

## OK Output Rule

1. Include only `source_system = 'business-central'`.
2. Include rows inside the selected `posting_date` range.
3. Include only `entry_type = 'Output'` for production dashboard and resume metrics.
4. Include only rows where `normalized_output_type = 'OK'`.
5. Do not add `quantity > 0` as the output filter.
6. Main output is net quantity: positive OK output plus negative OK corrections.
7. Non-output BC entry types such as Sale, Purchase, Consumption, and Transfer remain stored for future management panels but are excluded from production dashboard/resume metrics.
8. Keep unmapped machine/entity rows in output totals, but do not use them for target/achievement matching until a master entity or alias exists.

This rule must be validated with `pnpm bc:reconcile`.

## Business Central Data Scope

P0.9c adds read-only scope classification to dry-run reports. It does not discard rows.

`bc_current_kpi_scope` separates current dashboard impact from future-use value:

- `OUTPUT_KPI_OK_SCOPE`: current OK production dashboard candidate.
- `OUTPUT_KPI_REJECT_SCOPE`: current reject/reject-attachment candidate.
- `OUT_OF_CURRENT_KPI_SCOPE`: retained row for a future domain; it must not block P1.0 by itself.
- `UNKNOWN_SCOPE_REVIEW`: insufficient evidence; can block P1.0 when material.

`bc_future_use_domain` records where retained rows should be reviewed next, including production dashboard, reject attachment, downtime/sparepart/material, sales, purchase/receiving, transfer/inventory movement, consumption/material usage, scrap/waste/avalan, master-data quality review, or unknown review.

Every P0.9c CSV keeps:

```text
bc_current_kpi_scope
bc_future_use_domain
bc_scope_reason
bc_scope_evidence_fields
bc_entity_source_status
blocks_p10_after_scope
```

P1.0 gating uses `blocks_p10_after_scope` while preserving the original pre-scope blocker signal for traceability. `OUT_OF_CURRENT_KPI_SCOPE` rows remain visible in reports and are counted in `excludedFromP10ButRetainedRows`.

P0.9e classifies only deterministic high-confidence Business Central entry types as out of current KPI scope:

- `TRANSFER` -> `TRANSFER_OR_INVENTORY_MOVEMENT`
- `CONSUMPTION` -> `CONSUMPTION_OR_MATERIAL_USAGE`
- `SALE` -> `SALES_REPORT`
- `PURCHASE` -> `PURCHASE_OR_RECEIVING`

These classifications do not change stored rows or dashboard behavior. `NEGATIVE ADJMT.`, `POSITIVE ADJMT.`, and weak sparepart/material text-pattern candidates remain `UNKNOWN_SCOPE_REVIEW` for later review.

P0.9f adds reviewed material/sparepart rules for non-output `SP*` item numbers, non-output `TINTA-*` item numbers, non-output `KONS*` documents, and non-output `PB*` documents. It still does not add broad `SPK*`, broad `SP*` document, `MOCK*`, output-row, or extra reject rules.

P0.9g consumes `.tmp/bc-scoped-blocker-package/true-p10-blockers.csv` and writes `.tmp/bc-scoped-decision-review/`. The decision review contract is export-only:

- `safe_to_auto_apply` is always `false` by default.
- Blank/unmapped source rows are source-data review, not canonical entity creation.
- Reject scoped rows are reject attachment review.
- Target profile rows depend on approved entity/canonical decisions.
- P1.0 gate remains `BLOCKED` while decision rows remain pending.

P0.9h consumes `.tmp/bc-scoped-decision-review/decision-board.csv` and writes `.tmp/bc-scoped-decision-validation/`. The validation contract is validation-only:

- Empty `approval_status` is treated as `pending`; allowed statuses are `pending`, `approved`, `rejected`, and `deferred`.
- Approved rows require `reviewer`; reviewer notes are expected and are required for blocking unknown-source resolution.
- `safe_to_auto_apply=true` and `safe_to_seed_target_profile=true` are invalid unless strict reviewer, dependency, and deterministic-field requirements pass.
- OMSO, VFINE, LONGSUN, POLYPRINT, THERMO HENGFENG, blank/unmapped, reject, and target-profile dependency safeguards remain manual-review gates.
- Validation status is `INVALID`, `BLOCKED`, `PASS_WITH_WARNINGS`, or `PASS`; this command never enables P1.0.

## Target Rule

1. Target must be matched by entity and effective date range.
2. Only active/approved targets are eligible.
3. Missing target must produce `N/A`, not numeric zero.
4. Achievement is numeric only when target exists and target is greater than zero.
5. A period with OK output but no mapped active entity-days reports reason `TARGET_MISSING`; the operator must load entity mappings and approved targets.

Aggregate dashboard achievement and `Resume Harian per Item` target matching answer different questions. The aggregate KPI prorates approved targets over mapped active entity-days. The per-item resume keeps every grouped Output row visible, including unmapped groups, so it can still show `N/A` rows even when the aggregate target total reconciles.

Daily item resume target resolution returns an explicit reason per row:

- `TARGET_MATCHED`: resolved entity has an approved/active effective target and, when bucket metadata is present, the inferred bucket matches.
- `UNMAPPED_ENTITY`: no `master_entities` mapping is attached to the output group.
- `NO_ACTIVE_TARGET`: the entity has no usable production target.
- `TARGET_NOT_APPROVED`: a target covers the posting date but is not `APPROVED` or `ACTIVE`.
- `OUTSIDE_EFFECTIVE_DATE`: approved/active targets exist, but none cover the posting date.
- `TARGET_BUCKET_MISSING`: bucket-specific targets are available but the row has no reliable or unambiguous bucket match.
- `TARGET_ZERO`: a matching target exists with zero quantity; achievement remains `N/A`.

## Achievement Rule

```text
achievement = OK Output / Target * 100
```

Return `N/A` with reason `TARGET_MISSING` or `TARGET_ZERO` when applicable.

For the daily item resume, transaction target is prorated from the entity daily target:

```text
transactionProrataTarget = dailyTarget * workHours / 24
achievementPct = netOutputQty / transactionProrataTarget * 100
```

When the Business Central `External_Document_No` encodes `SHIFT/HOURS/OPERATOR`, v2 parses that value first for the resume table. Example: `S1/8/RAHMAT` means shift `S1`, work hours `8`, and operator `RAHMAT`. If parsing succeeds, `transactionProrataTarget = dailyTarget * parsedWorkHours / 24`. If parsing fails, v2 uses the existing fallback (`planned_runtime_hours`, then the current 24-hour default) and marks `workHoursSource = FALLBACK`; invalid external-document text is exposed in details and never invents shift/operator/work-hours values.

## Resume Harian per Item

`GET /api/v1/dashboard/daily-item-resume` returns the operational table used by `/overview`. It is a grouped daily resume, not a raw ledger table.

Production scope:

```sql
source_system = 'business-central'
and entry_type = 'Output'
```

Grouping key:

1. `posting_date`
2. resolved machine/entity display label
3. `item_no`

Machine label priority is mapped `master_entities.display_name`, mapped `entity_code`, `machine_description` when a true field exists, `machine_center_no`, `prod_line_description`, `prod_line_no`, then `Unmapped`.

`machineLabel` is the canonical/resolved label used for matching, targets, grouping, and diagnostics. `machineDisplay` is UI-only short display text for `/overview` tables, for example `Borche 1 - Preform 19.0 / 19.1 gram -> Borch 1` and `THERMO HENGFENG-2-OZ -> Hengfeng 2`. `machineDisplay` must not replace canonical labels in target matching or reject attachment.

Each group reports positive output, correction output, net output, UOM consistency, document/operator/shift summaries, reject metrics, gross weight evidence, target status, and calculation drilldown metadata. Missing targets remain `dailyTarget = null`, `transactionProrataTarget = null`, `achievementPct = null`, and `achievementStatus = TARGET_MISSING`; the UI displays `N/A`.

Target matching uses the resolved `entity_id`, posting date, and approved/active target status. If the target model has no bucket-specific metadata, the entity-level target is used safely. If bucket metadata is available, the row must infer exactly one compatible bucket; ambiguous rows stay `N/A / TARGET_BUCKET_MISSING` rather than borrowing a target.

V1-compatible target bucket inference is conservative:

1. Printing rows infer from printing machine/category signals. Item descriptions with `22 OZ` map to `target_printing_22_oz`; other OZ printing items map to `target_printing_oz_lt_20`; printing items without OZ map to `target_printing_non_oz`.
2. Thermoforming rows infer from thermoforming machine/category signals. `gross_weight_per_pcs >= 0.012` maps to `target_thermoforming_gw_gt_12`; lower or missing gross weight uses the v1 default `target_thermoforming` bucket.
3. Bottle/preform rows infer from injection/blowing/preform/bottle family signals and map to `target_botol_preform`.
4. Conflicting family signals are ambiguous. Unknown family signals return `TARGET_BUCKET_MISSING` when a bucket-specific target would be required.

## Reject Rule

Reject calculations must distinguish:

1. Reject KG.
2. Reject PCS equivalent.
3. Conversion gaps when gross weight per PCS is missing.
4. Reject rate denominator.

Reject KG is the recorded reject weight from RJ item rows. Reject PCS equivalent is a derived unit conversion used only for reject rate and PCS-based comparison. Reject PCS equivalent must not silently show zero when conversion data is missing.

For attached reject rows:

```text
reject PCS equivalent = reject kg / matched OK item gross weight per PCS
```

Gross weight must come from the matched OK item/group, never from the RJ reject item. Source priority is:

1. `ROW_GROSS_WEIGHT`: the matched OK production output row has a valid positive `gross_weight_per_pcs`.
2. `ITEM_CONVERSION_MAPPING`: an active reviewed `item_conversion_mappings` row matches the OK `item_no` and OK `uom`.
3. `MASTER_ENTITY_CONVERSION`: reserved for future reviewed entity-level conversion sources.

Reject rate formula:

```text
reject rate = reject PCS equivalent / (OK Output + reject PCS equivalent) * 100
```

If the matched OK gross weight is missing, zero, invalid, or the reject row has no deterministic OK attachment, `reject_pcs_eq` is `null`, the conversion gap is counted with an explicit reason, and the dashboard marks reject conversion as `INCOMPLETE`. When any reject conversion is incomplete, dashboard reject rate is `null`/`N/A`; it must not display `0.00%` from missing PCS equivalent.

Daily item resume reject rows are scoped to the same Business Central Output rows and attach document-first. Reject candidates are non-RJ `PCS` OK rows with the same `document_no`. The resolver attaches only when one OK group is deterministic: same document, then same posting date, then the preferred machine/entity sources (`machine_description`, `machine_center_no`, `prod_line_description`, `prod_line_no`, mapped entity fallback), then parsed `External_Document_No` context. It never splits reject kg across multiple OK rows.

Reject attachment statuses:

1. `ATTACHED_BY_DOCUMENT`
2. `ATTACHED_BY_DOCUMENT_DATE`
3. `ATTACHED_BY_DOCUMENT_DATE_MACHINE`
4. `ATTACHED_BY_DOCUMENT_DATE_MACHINE_SHIFT_OPERATOR`
5. `AMBIGUOUS_REJECT_ATTACHMENT`
6. `REJECT_ONLY`

`AMBIGUOUS_REJECT_ATTACHMENT` means multiple OK candidates remain after deterministic narrowing; reject kg stays on the unresolved reject row and is not double-counted. `REJECT_ONLY` means no same-document OK candidate exists. Reject PCS equivalent uses the matched OK document gross weight where available; missing or non-positive gross weight is `INCOMPLETE`, never a trustworthy zero.

Reject conversion gap reasons:

1. `MISSING_OK_GROSS_WEIGHT`
2. `ZERO_OR_INVALID_OK_GROSS_WEIGHT`
3. `NO_MATCHED_OK_ROW`
4. `AMBIGUOUS_REJECT_ATTACHMENT`
5. `REJECT_ONLY`
6. `MISSING_CONVERSION_MAPPING`

## Machine and Entity Mapping

1. Mapped output should be linked to `master_entities`.
2. Unmapped output must remain visible.
3. Unmapped rows should create data quality issues or be counted in profile output.
4. Target/achievement should not silently assign unmapped rows to a fake target.
5. Legacy v1-style machine aliases must be represented as explicit reviewed aliases. Broad family fallback such as `HF -> HENGFENG` or `TF -> ILLIG` is not safe once multiple product/target buckets exist.

## Master Data Mapping Center Contract

P0.1 found live Business Central output in PostgreSQL but most rows were not eligible for target achievement because `production_outputs.entity_id` was null. Milestone 11 fixes this through reviewed master-data mappings, not silent auto-creation.

Mapping priority:

1. Active exact alias match for `source_system = 'business-central'` and source field/value from `machine_description`, `machine_center_no`, `prod_line_description`, or `prod_line_no`.
2. Active normalized alias match: trim, uppercase, collapse whitespace, and remove common separators for matching only.
3. Exact `master_entities.entity_code` fallback.
4. If no reviewed match exists, keep `entity_id = null`, classify as `UNMAPPED_ENTITY`, and show the source values as mapping candidates.

Preferred source grouping for new mapping candidates is:

1. `machine_description` when BC exposes a true machine-description field
2. `machine_center_no`
3. `prod_line_description`
4. `prod_line_no`

For the current profiled endpoint, `gProdOrRotLine_No` and `gProdOrRotLine_Description` are the reliable production-line fields. If a row has no usable value in any reviewed source field, it is the only case treated as a truly blank source group.

Live OData sync must request and store `gProdOrRotLine_No` into `production_outputs.prod_line_no` and `gProdOrRotLine_Description` into `production_outputs.prod_line_description`. If the configured OData endpoint uses `$select`, the sync client appends those fields so new rows do not silently lose production-line source data. `machine_description` remains blank unless Business Central later exposes a true machine-description field.

Existing rows synced before these fields were populated can be enriched by the non-destructive source-fields backfill. The backfill:

1. Selects only `business-central` rows where `prod_line_no` or `prod_line_description` is null or blank.
2. Fetches Business Central rows by stable `Entry_No`.
3. Matches updates by stable `Entry_No` / `entry_no`.
4. Writes only `prod_line_no <= gProdOrRotLine_No` and `prod_line_description <= gProdOrRotLine_Description`, and only while each local value is still blank.
5. Never writes `machine_description` from `gProdOrRotLine_Description`, `gSrcDesc`, or `Machine_Center_No`.
6. Leaves OK/reject classification, reject attachment, target logic, quantities, and existing non-blank production-line values unchanged.

Concepts:

- Entity: canonical internal machine/line/reporting unit used by targets and dashboard achievement.
- Alias: reviewed Business Central source value mapped to one entity.
- Source field: the raw BC field that produced the alias, for example `machine_center_no`.
- Raw BC value: original operational value from Business Central; it remains in `production_outputs` and is not overwritten by mapping.

Alias commits must preview affected rows, update only unmapped output rows by default, write audit logs, and resolve related `UNMAPPED_ENTITY` data-quality issues where applicable. They must not overwrite existing mapped rows unless a future explicit remap workflow is approved.

Mapping Preview uses bound SQL parameters and must not pass unused nullable parameters. A previous preview count query skipped `$3` and used `$4::boolean`, which let PostgreSQL report `could not determine data type of parameter $3`; selected-source previews now bind the remap flag as `$3::boolean`.

Assisted mapping candidates are advisory only:

1. HIGH confidence means an exact normalized entity/alias match was found.
2. MEDIUM confidence means one clear entity has strong normalized containment or shared machine-family tokens.
3. LOW confidence means weak overlap, multiple possible entities, or missing source value.
4. LOW confidence and blank machine groups must not be batch-committed. Blank machine groups require production-line, item, document, or owner context.
5. `pnpm bc:mapping-plan` creates a review CSV under `.tmp/mapping-plan/` with every row defaulting to `REVIEW`.
6. `pnpm bc:mapping-plan-apply` mutates only with `MAPPING_PLAN_COMMIT=true` and only for rows explicitly changed to `action=COMMIT`.

Target coverage after mapping:

1. Rows still without `entity_id` report `UNMAPPED_ENTITY`.
2. Rows with an entity but no approved active target report `NO_ACTIVE_TARGET`.
3. Draft/rejected target periods report `TARGET_NOT_APPROVED`.
4. Approved targets outside the output date report `OUTSIDE_EFFECTIVE_DATE`.
5. Approved zero targets report `TARGET_ZERO`.
6. Only covered entity/date rows can make achievement numeric.

Conversion mapping:

1. Attached reject rows use the matched OK item gross weight. The RJ item gross weight is not a valid conversion source.
2. Item/UOM conversion mappings store reviewed OK-item `gross_weight_per_pcs` values and are applied by OK `item_no`/`uom`.
3. Applying a conversion recomputes only safe missing conversions and writes audit/data-quality resolution records.
4. Reject-only and ambiguous attachment rows remain `N/A` until the attachment is resolved; a conversion mapping alone must not attach reject kg to an OK row.

## V1 Master Import Contract

Milestone 11.1 imports real v1 master data through dry-run-first scripts:

```bash
pnpm v1:master-profile
pnpm v1:master-import
pnpm v1:master-reconcile
```

`pnpm v1:master-import` mutates only when `V1_MASTER_IMPORT_COMMIT=true`. It imports canonicalized v1 entities, unambiguous source aliases, approved production targets, and stable item gross-weight conversions. It does not create fake entities and does not auto-map source values that v1 evidence shows are ambiguous across product or target buckets.
4. Missing conversion must remain visible; it must not be displayed as trustworthy zero reject PCS equivalent.

## Freshness Rule

Freshness must be based on the latest successful sync run where:

```sql
source_system = 'business-central'
status = 'SUCCESS'
```

Older failed runs should remain in audit/history but must not override a newer successful sync.

## Sync Strategy Contract

Normal live sync must not refetch full history after the initial backfill:

1. Probe latest remote `Entry_No` using `$orderby=Entry_No desc&$top=1`.
2. Read latest local `entry_no` from `production_outputs` where `source_system = 'business-central'`.
3. If remote latest is newer, fetch only `Entry_No gt <local latest>` in ascending order.
4. If remote latest is not newer, run the configured recent posting-date scan window (`BC_ODATA_BACKFILL_SCAN_DAYS`, default `14`) for late-arriving/corrected rows, or skip fetching when the scan window is `0`.
5. Follow Business Central `@odata.nextLink`; when absent and a full `Entry_No asc` page is returned, continue with keyset pagination.
6. Persist idempotently on `source_system + entry_no`; unchanged row hashes are skipped/no-op.

## Required Reconciliation Queries

Total live BC rows:

```sql
select count(*) as total_outputs, min(posting_date), max(posting_date)
from production_outputs
where source_system = 'business-central';
```

Rows by month:

```sql
select date_trunc('month', posting_date)::date as month, count(*) as rows
from production_outputs
where source_system = 'business-central'
group by 1
order by 1;
```

Latest sync runs:

```sql
select status, rows_fetched, rows_inserted, rows_updated, rows_skipped, started_at, finished_at, error_message
from sync_runs
where source_system = 'business-central'
order by started_at desc
limit 10;
```

## Open Questions

1. Whether negative quantities are always corrections/returns or sometimes operational output adjustments.
2. Whether additional BC item/category fields should be included in OK/reject normalization after business sign-off.
3. Whether reject-rate denominator should remain `OK Output + Reject PCS Eq` for every PPIC review.
4. Which master-data load process will populate entities, aliases, approved targets, and gross-weight conversions for all active machines/items.

<!-- P0_2_MAPPING_ACCURACY_EXTENSIONS -->
## P0.2-P0.8 Mapping Accuracy Extensions

P0.2-P0.8 improves mapping quality without changing the core metric formulas.

### Mapping impact ranking

Mapping candidates should be ranked by KPI impact, not only by row count.

Suggested impact fields:

- `unmapped_ok_qty`
- `impact_severity`
- `zero_qty_only`
- `first_posting_date`
- `last_posting_date`
- `top_item_no`
- `top_item_description`
- `top_item_category_code`
- `confidence_reason`
- `source_quality_reason`

Suggested severity:

```text
CRITICAL: unmapped_ok_qty >= 1,000,000
HIGH:     unmapped_ok_qty >= 100,000
MEDIUM:   unmapped_ok_qty > 0
LOW:      unmapped_ok_qty = 0
```

### Source quality diagnostics

When the preferred source is ambiguous, diagnostics should expose an alternate source candidate rather than silently choosing a weak source.

Example:

```text
current preferred source: machine_center_no = LS1-25.8/42.3KALE
alternate source: prod_line_description = LONGSUN 1 BOTOL 1000 ML
reason: machine_center_no ambiguous; prod_line_description available
```

### Conditional mapping

Ambiguous sources such as `OMSO 1-OZ`, `OMSO 2-OZ`, `POLYPRINT`, and `HENGFENG` variants must not be mapped by broad alias alone when product bucket affects target matching.

Reviewed conditional mapping may use:

- inferred target bucket
- item category
- item number pattern
- gross weight range

If zero or multiple conditional rules match, the row remains unmapped.

### Reset/remap source

Source-specific reset/remap is allowed only for one reviewed source value at a time. It may clear `production_outputs.entity_id` and deactivate matching aliases, but it must not modify raw quantities, item fields, document fields, targets, sync runs, or raw Business Central source fields.

### Reject attachment review

Reject attachment overrides must only be used when a reviewer selects one deterministic OK group. The system must not split reject KG automatically. Reject PCS Eq and reject rate remain incomplete or `N/A` until the required equivalent quantity is deterministic.
