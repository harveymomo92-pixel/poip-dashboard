# Business Central OData Output Column Map

Status: reference guide  
Source: Business Central OData `Entry_Type eq 'Output'` sample  
Last sampled: 2026-06-27  
Sample files:

```text
.tmp/odata-output-field-map/summary.json
.tmp/odata-output-field-map/field-profile.csv
.tmp/odata-output-field-map/source-combos.csv
.tmp/odata-output-field-map/rows-output-sample.csv
```

## Purpose

This document records how Business Central OData output fields should be interpreted so future entity, target, reject, and data-quality work does not guess from column names.

Safety rules:

```text
Do not mutate source quantity fields.
Do not use Machine_Center_No as primary entity identity.
Do not create broad/global aliases to hide ambiguity.
Do not switch dashboard behavior based only on this reference.
```

## Sample Notes

The sample was fetched read-only with:

```text
Entry_Type eq 'Output'
```

Observed in the 50-row sample:

```text
Entry_Type = Output does not mean every row is OK finished output.
Rows include JADI output and reject/avalan/gumpalan-style rows.
Machine_Center_No was populated only in part of the sample.
gProdOrRotLine_Description and gProdOrRotLine_No were populated in the sample.
dimcode, divcode, and divname were blank in the sample.
Quantity unit depends on Unit_of_Measure_Code.
```

## Column Map

| OData column | Use as | Notes |
|---|---|---|
| `Entry_No` | Natural key, idempotency key, incremental sync cursor | Do not use as a KPI dimension. It identifies a Business Central ledger row. |
| `Posting_Date` | Main operational date | Use for dashboard date filtering, daily grouping, target effective-date lookup, and dry-run comparison windows. |
| `Document_Date` | Supporting document date | Keep for traceability. Do not replace `Posting_Date` for KPI logic unless PPIC explicitly approves a rule change. |
| `Entry_Type` | Ledger movement filter | `Output` is the main dashboard scope, but rows still need OK/reject classification using item/category/location evidence. |
| `Document_No` | SPK/document grouping and reject attachment evidence | Use to connect OK rows and reject rows deterministically when possible. |
| `Item_No` | Item identity | Use for OK/reject signals, item grouping, gross-weight conversion lookup, and sample review. Prefixes such as `RJ` are useful reject evidence. |
| `gItem_Description` | Primary item description | Use for target bucket inference such as OZ size, BOTOL ML size, PREFORM GR weight, and CUP regular classification. |
| `Description` | Item description fallback | In the sample it matched `gItem_Description`; keep as fallback when the primary item description is blank. |
| `Item_Category_Code` | Product/output family signal | Use to help separate finished goods, reject, avalan, sapuan, gumpalan, and family-level grouping. |
| `Location_Code` | Location/classification signal | Sample includes values such as `JADI` and `REJECT`; useful as supporting evidence, not sole classification. |
| `Quantity` | Source quantity | Preserve exactly. Interpret only with `Unit_of_Measure_Code`, item category, location, and output classification. Negative output quantities are corrections/reversals. |
| `Unit_of_Measure_Code` | Quantity unit | Required to distinguish PCS output from KG reject/scrap-style quantities. |
| `Gross_Weight` | Gross-weight/conversion evidence | Use conservatively for reject PCS equivalent and item conversion only when nonzero and context is safe. Do not invent missing gross-weight values. |
| `gProdOrRotLine_No` | Production line code / entity fallback | Use as resolver fallback when `gProdOrRotLine_Description` is blank. |
| `gProdOrRotLine_Description` | Primary canonical entity source | Preferred Business Central source for Entity Resolver V2 canonical machine/production-line identity. |
| `Machine_Center_No` | Routing evidence and target profile dimension | Use for target profile exact matching and resolver fallback only when line description and line no are blank. Do not use as primary entity identity. |
| `dimcode` | Currently unused | Blank in the sample. Do not rely on it until nonblank Business Central evidence is reviewed. |
| `divcode` | Currently unused | Blank in the sample. Do not rely on it until nonblank Business Central evidence is reviewed. |
| `divname` | Currently unused | Blank in the sample. Do not rely on it until nonblank Business Central evidence is reviewed. |

## Patch Priority

Before any broader entity or target work, apply source-alignment fixes in this order:

1. Make `gItem_Description` the primary item description source and keep `Description` only as fallback.
2. Ensure the worker OData `$select` always requests `gItem_Description` for `Entry_Type = Output`.
3. Keep `gProdOrRotLine_Description` as the primary entity source, followed by `gProdOrRotLine_No`, then `Machine_Center_No` only as fallback evidence.
4. Add regression tests for item-description precedence and the OData select set.
5. Re-run dry-run comparison commands after the patch to confirm no KPI behavior changed.

## Recommended Interpretation

BC data scope classification must keep two separate labels:

```text
bc_current_kpi_scope:
- OUTPUT_KPI_OK_SCOPE
- OUTPUT_KPI_REJECT_SCOPE
- OUT_OF_CURRENT_KPI_SCOPE
- UNKNOWN_SCOPE_REVIEW

bc_future_use_domain:
- PRODUCTION_OUTPUT_DASHBOARD
- REJECT_ATTACHMENT
- DOWNTIME_SPAREPART_OR_MATERIAL
- SALES_REPORT
- PURCHASE_OR_RECEIVING
- TRANSFER_OR_INVENTORY_MOVEMENT
- CONSUMPTION_OR_MATERIAL_USAGE
- SCRAP_WASTE_OR_AVALAN
- MASTER_DATA_QUALITY_REVIEW
- UNKNOWN_REVIEW
```

`OUT_OF_CURRENT_KPI_SCOPE` does not mean the row is useless. It means the row is retained and exported for future domains, but it should not block the P1.0 dashboard switch by itself. `UNKNOWN_SCOPE_REVIEW` remains a manual review bucket and can still block P1.0 when material.

Entity resolution priority:

```text
1. gProdOrRotLine_Description
2. gProdOrRotLine_No
3. Machine_Center_No only as fallback
4. UNMAPPED when no safe match exists
```

Target bucket inference priority:

```text
1. gItem_Description
2. Description
3. Item_No / Item_Category_Code when safe
4. Machine_Center_No only as supporting evidence
5. UNKNOWN when ambiguous
```

Target profile lookup inputs:

```text
canonical entity
target bucket
optional Machine_Center_No
Posting_Date effective range
```

Reject attachment inputs:

```text
Document_No
Posting_Date
Item_No
gItem_Description / Description
Item_Category_Code
Location_Code
Quantity
Unit_of_Measure_Code
Gross_Weight
gProdOrRotLine_Description
gProdOrRotLine_No
Machine_Center_No
```

Blank entity source handling:

```text
HAS_PRIMARY_ENTITY_SOURCE: gProdOrRotLine_Description is present.
HAS_FALLBACK_ENTITY_SOURCE: gProdOrRotLine_No or Machine_Center_No is present.
ENTITY_SOURCE_BLANK_BUT_CLASSIFIED: entity source is blank, but other OData evidence safely classifies the future-use domain.
ENTITY_SOURCE_BLANK_UNKNOWN: entity source is blank and remaining evidence is insufficient.
```

Rows with blank entity source must not collapse into a generic `(blank)` decision only. Classify with `Entry_Type`, `Location_Code`, `Item_No`, `gItem_Description`, `Description`, `Item_Category_Code`, `Document_No`, `Quantity`, `Unit_of_Measure_Code`, and `Gross_Weight` before deciding whether they are future-use rows or true unknown review rows.

P0.9d profiles remaining `UNKNOWN_SCOPE_REVIEW` rows without reclassifying them:

```bash
pnpm bc:unknown-scope-profile
```

Outputs:

```text
.tmp/bc-unknown-scope-profile.csv
.tmp/bc-unknown-scope-profile.json
```

The profile groups unknown rows by document prefix, item prefix, location, item category, unit, entity-source status, source value, current entity, and target bucket. Suggested rules are advisory only. They do not change `bc_current_kpi_scope`, `bc_future_use_domain`, aliases, conditional rules, target profiles, or dashboard behavior.

## Practical Warnings

`Entry_Type = Output` rows still need classification. Finished output and reject/scrap rows can both appear in this scope.

`Quantity` cannot be interpreted without `Unit_of_Measure_Code`. PCS and KG quantities must not be mixed.

`Machine_Center_No` may be blank and may be shared across different production-line descriptions. It is routing evidence, not primary identity.

`Gross_Weight` may be zero for reject/scrap rows. Missing conversion evidence should become a data-quality issue or review item, not an automatic formula guess.

`dimcode`, `divcode`, and `divname` are not currently useful based on the sample. Re-evaluate only if future OData samples show nonblank values.
