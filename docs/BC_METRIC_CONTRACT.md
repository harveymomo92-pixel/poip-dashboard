# Business Central Metric Contract

Status: Draft for P0.1 Business Central Calculation Accuracy and v1 Sync Strategy Adaptation.

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
| `Entry_Type` | `entry_type` / `entryType` | Must be profiled before metric rules are finalized. |
| item number field | `item_no` / `itemNo` | Exact BC source field must be confirmed from sample payload. |
| item description field | `item_description` / `itemDescription` | Optional. |
| machine/work center field | `machine_center_no` / `machineCenterNo` | Must map to master entity when possible. |
| quantity field | `quantity` | Main quantity basis. |
| unit of measure field | `uom` | Required for conversion decisions. |
| raw payload | `raw_payload` / `rawPayload` | Preserve original BC row. |

## OK Output Rule

Draft rule:

1. Include only `source_system = 'business-central'`.
2. Include rows inside the selected `posting_date` range.
3. Include only rows whose `normalized_output_type` represents OK output.
4. Include positive quantity unless the business explicitly confirms another rule.
5. Exclude or flag rows with missing critical mapping.

This rule must be validated with `pnpm bc:reconcile`.

## Target Rule

1. Target must be matched by entity and effective date range.
2. Only active/approved targets are eligible.
3. Missing target must produce `N/A`, not numeric zero.
4. Achievement is numeric only when target exists and target is greater than zero.

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

## Machine and Entity Mapping

1. Mapped output should be linked to `master_entities`.
2. Unmapped output must remain visible.
3. Unmapped rows should create data quality issues or be counted in profile output.
4. Target/achievement should not silently assign unmapped rows to a fake target.

## Freshness Rule

Freshness must be based on the latest successful sync run where:

```sql
source_system = 'business-central'
status = 'SUCCESS'
```

Older failed runs should remain in audit/history but must not override a newer successful sync.

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

1. Which exact BC field defines OK vs reject?
2. Are negative quantities returns/corrections or should they offset output?
3. Which field is the canonical machine/work center field?
4. How should multi-line SPK/document rows be grouped?
5. What is the agreed reject rate denominator?
6. Which item master field provides gross weight per PCS?

