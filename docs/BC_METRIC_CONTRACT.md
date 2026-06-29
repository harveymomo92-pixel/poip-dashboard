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
| `Entry_Type` | `entry_type` / `entryType` | Used with quantity/reject KG to normalize OK, reject, or other movement. |
| `Item_No` / equivalent item number field | `item_no` / `itemNo` | Required for committed output rows. |
| `Description` / equivalent description field | `item_description` / `itemDescription` | Optional item label. |
| `Machine_Center_No` / equivalent work center field | `machine_center_no` / `machineCenterNo` | Must map to `master_entities` or `master_entity_aliases` for target matching. |
| `Quantity` | `quantity` | Main quantity basis. Positive OK rows count as output. Negative/zero rows are excluded from OK output and flagged. |
| `Unit_of_Measure_Code` | `uom` | Required for interpretation and conversion review. |
| `Gross_Weight` | `gross_weight_per_pcs` | Used to convert reject KG into reject PCS equivalent. |
| `Reject_KG` | `reject_kg` | Reject weight when exposed by BC. |
| raw payload | `raw_payload` / `rawPayload` | Preserve original BC row. |

## OK Output Rule

1. Include only `source_system = 'business-central'`.
2. Include rows inside the selected `posting_date` range.
3. Include only rows where `normalized_output_type = 'OK'`.
4. Include only `quantity > 0`.
5. Exclude `REJECT`, `OTHER`, zero quantity, negative quantity, missing posting date, and missing item rows from OK output.
6. Keep unmapped machine/entity rows in output totals, but do not use them for target/achievement matching until a master entity or alias exists.

This rule must be validated with `pnpm bc:reconcile`.

## Target Rule

1. Target must be matched by entity and effective date range.
2. Only active/approved targets are eligible.
3. Missing target must produce `N/A`, not numeric zero.
4. Achievement is numeric only when target exists and target is greater than zero.
5. A period with OK output but no mapped active entity-days reports reason `TARGET_MISSING`; the operator must load entity mappings and approved targets.

## Achievement Rule

```text
achievement = OK Output / Target * 100
```

Return `N/A` with reason `TARGET_MISSING` or `TARGET_ZERO` when applicable.

## Reject Rule

Reject calculations must distinguish:

1. Reject KG.
2. Reject PCS equivalent.
3. Conversion gaps when gross weight per PCS is missing.
4. Reject rate denominator.

Reject PCS equivalent must not silently show zero when conversion data is missing.

Current formula:

```text
reject rate = reject PCS equivalent / (OK Output + reject PCS equivalent) * 100
```

If `reject_kg > 0` and `gross_weight_per_pcs` is missing/zero, `reject_pcs_eq` is `null`, the conversion gap is counted, and the dashboard marks reject conversion as incomplete.

## Machine and Entity Mapping

1. Mapped output should be linked to `master_entities`.
2. Unmapped output must remain visible.
3. Unmapped rows should create data quality issues or be counted in profile output.
4. Target/achievement should not silently assign unmapped rows to a fake target.
5. Legacy v1-style machine aliases may resolve through exact entity code, entity alias, display name, line/report group, and known family aliases such as LONGSUNG/LONGSUN, HF/HENGFENG, TF/ILLIG, CP/CHUMPOWER, V-FINE/VFINE, POLY/POLYPRINT, NEWDO, and OMSO.

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
2. Read latest local `entry_no` from `bc_ledger_entries` where `source_system = 'business-central'`.
3. If remote latest is newer, fetch only `Entry_No gt <local latest>` in ascending order.
4. If remote latest is not newer, run the configured recent posting-date scan window (`BC_ODATA_BACKFILL_SCAN_DAYS`, default `14`) for late-arriving/corrected rows, or skip fetching when the scan window is `0`.
5. Follow Business Central `@odata.nextLink`; when absent and a full `Entry_No asc` page is returned, continue with keyset pagination.
6. Persist idempotently on `source_system + entry_no`; unchanged row hashes are skipped/no-op.

## Required Reconciliation Queries

Total live BC rows:

```sql
select count(*) as total_outputs, min(posting_date), max(posting_date)
from bc_ledger_entries
where source_system = 'business-central';
```

Rows by month:

```sql
select date_trunc('month', posting_date)::date as month, count(*) as rows
from production_output_kpi_rows
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
