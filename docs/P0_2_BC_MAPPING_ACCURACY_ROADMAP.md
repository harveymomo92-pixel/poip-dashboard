# P0.2-P0.8 Business Central Mapping Accuracy Roadmap

<!-- LEGACY_BC_ROADMAP_ID_WARNING_START -->

> **Legacy milestone ID warning**
>
> This document may mention old Business Central roadmap IDs.
>
> Current active meaning:
>
> ```text
> P0.7 = Entity Resolver V2 Dry Run
> P0.8 = Target Profile Model
> P0.9 = Backfill / Migration Dry Run
> P1.0 = Controlled Switch
> ```
>
> Legacy meanings from older mapping/reject roadmap:
>
> ```text
> Legacy P0.7 Reject Attachment Review Queue -> BC-RJ-1
> Legacy P0.8 V1 parity closeout -> BC-V1-CLOSEOUT
> ```
>
> See `docs/BC_MILESTONE_NAMESPACE.md`.

<!-- LEGACY_BC_ROADMAP_ID_WARNING_END -->

Status: planning and execution document for Business Central calculation-accuracy improvements after P0.1.

## Current baseline

- Commit baseline: `b973d96`.
- Previous implementation commit: `8143b21`.
- Business Central source-fields backfill completed in local/UAT.
- Safe HIGH exact mapping completed.
- Backfill updated `prod_line_no` and `prod_line_description` for `85,880` rows.
- Safe mapping applied `12` reviewed HIGH exact mapping rows.
- Safe mapping updated `27,736` production output rows.
- Mapping coverage improved from `41.85%` to `60.21%`.
- Mapped rows improved from `5,962` to `8,577`.
- Unmapped rows decreased from `8,283` to `5,668`.
- Unmapped OK quantity decreased from `27,832,688.00` to `14,911,137.00`.
- OK Output remained `30,512,440.0000`.
- Raw OK Output remained `30,512,440.0000`.
- Reject KG remained `4,012.2000`.
- Achievement remained `75.67%`.
- Reject PCS Eq remained incomplete with `20` gaps.

## Remaining review items

Do not auto-map these without business/data-owner review:

- `REPACKING`
- `THERMO 6 ILLIG`
- `OMSO 1-OZ`
- `OMSO 2-OZ`
- `LS1-25.8/42.3KALE`
- `THERMO 5 HENGFENG`
- `THERMO 4 HENGFENG-OZ`
- `POLYPRINT PRINTING-OZ`
- `POLYPRINT PRINTING-OZ-2`
- `THERMO HENGFENG-3`
- `THERMO HENGFENG-4`
- `THERMO HENGFENG-1-OZ`

## Safety principles

P0.1 made the calculation core safe. P0.2-P0.8 must improve mapping accuracy without weakening those safety rules.

The following must remain true:

1. Do not change raw Business Central quantities.
2. Do not hide unmapped output.
3. Do not force missing targets to zero.
4. Do not auto-map LOW or ambiguous candidates.
5. Do not borrow a target across incompatible product buckets.
6. Do not compute Reject PCS equivalent when the OK attachment is not deterministic.
7. Do not display reject rate when Reject PCS equivalent is incomplete.
8. Every write must be previewable, auditable, and reversible by source-specific reset/remap.
9. Do not commit `.env`, `.tmp`, SQL dumps, backup files, cookies, tokens, passwords, or Business Central credentials.
10. Do not create broad destructive reset-all functionality.

---

# P0.2 — Mapping Impact Ranking and Source Quality Diagnostics

## Goal

Make unmapped Business Central rows actionable by ranking them by KPI impact and explaining why each source is still unmapped.

## Problem

After safe mapping, many rows remain unmapped. The raw unmapped row count is not enough because some groups have high OK quantity impact while others have zero OK quantity or only historical/noisy rows.

## Scope

Add impact diagnostics to:

- `pnpm bc:mapping-candidates`
- Master Data unmapped source table
- Mapping plan CSV if practical
- Any API response that already powers Master Data mapping candidates

## Required diagnostic fields

For each unmapped source group:

- `source_field`
- `source_value`
- `normalized_source_value`
- `rows`
- `mapped_rows`
- `unmapped_rows`
- `unmapped_ok_qty`
- `first_posting_date`
- `last_posting_date`
- `top_item_no`
- `top_item_description`
- `top_item_category_code`
- `top_document_no_samples`
- `confidence`
- `confidence_reason`
- `impact_severity`
- `zero_qty_only`
- `current_preferred_source_field`
- `current_preferred_source_value`
- `alternate_source_field`
- `alternate_source_value`
- `source_quality_reason`

## Impact severity

Suggested thresholds:

```text
CRITICAL: unmapped_ok_qty >= 1,000,000
HIGH:     unmapped_ok_qty >= 100,000
MEDIUM:   unmapped_ok_qty > 0
LOW:      unmapped_ok_qty = 0
```

## Source quality diagnostics

Current source priority may choose `machine_center_no` even when it is ambiguous and `prod_line_description` is more useful.

The system should report:

```text
current preferred source: machine_center_no = LS1-25.8/42.3KALE
alternate source: prod_line_description = LONGSUN 1 BOTOL 1000 ML
reason: machine_center_no ambiguous; prod_line_description available
```

P0.2 must not change mapping behavior yet. It only adds visibility.

## Acceptance criteria

- `pnpm bc:mapping-candidates` sorts by `impact_severity`, then `unmapped_ok_qty`.
- Zero-quantity groups are clearly separated.
- LOW/ambiguous rows remain REVIEW by default.
- Dashboard OK Output and Reject KG do not change.
- No database mutation occurs.
- Existing mapping plan commit behavior is unchanged.
- Docs are updated with the new diagnostics.

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm bc:mapping-candidates
pnpm bc:daily-item-resume
pnpm bc:reconcile
git diff --check
```

---

# P0.3 — Source-Specific Reset / Remap UI

## Goal

Allow a user to safely reset mapping for one Business Central source value from the Master Data UI.

## Problem

If a source value was mapped incorrectly, the current recovery path is manual SQL or a temporary terminal helper. This should become an official UI workflow.

## Scope

Add a Master Data UI panel or modal:

```text
Reset / Remap Source
```

Inputs:

- `source_field`
  - `prod_line_description`
  - `prod_line_no`
  - `machine_center_no`
  - `machine_description`
- `source_value`

## Suggested API shape

```text
POST /api/v1/master/business-central/mapping-reset/preview
POST /api/v1/master/business-central/mapping-reset/commit
```

Request:

```json
{
  "sourceField": "prod_line_description",
  "sourceValue": "THERMO 2 ILLIG"
}
```

Preview response:

```json
{
  "sourceSystem": "business-central",
  "sourceField": "prod_line_description",
  "sourceValue": "THERMO 2 ILLIG",
  "mode": "preview",
  "totalOutputRows": 123,
  "mappedOutputRowsBefore": 123,
  "aliasesMatched": 1,
  "warnings": []
}
```

Commit response:

```json
{
  "sourceSystem": "business-central",
  "sourceField": "prod_line_description",
  "sourceValue": "THERMO 2 ILLIG",
  "mode": "commit",
  "totalOutputRows": 123,
  "mappedOutputRowsBefore": 123,
  "mappedOutputRowsAfter": 0,
  "aliasesMatched": 1,
  "aliasesDeactivated": 1,
  "warnings": []
}
```

## Commit behavior

Inside a DB transaction:

1. Set `production_outputs.entity_id = null` only for matching Business Central rows.
2. Deactivate matching `master_entity_aliases` rows.
3. Update timestamps.
4. Write audit log.
5. Return before/after counts.

## Safety

- Default must be preview.
- Commit must require explicit confirmation.
- Do not add reset-all mapping.
- Use a strict source-field whitelist.
- Do not mutate quantities, documents, item fields, targets, sync runs, or raw BC source fields.

## Acceptance criteria

- Preview does not mutate DB.
- Commit resets only matching rows.
- Matching alias rows become inactive.
- Unrelated rows and aliases are untouched.
- Unsupported source fields are rejected.
- UI requires explicit confirmation.
- Audit log records the reset/remap operation.

---

# P0.4 — Mapping Review Queue for LOW and Ambiguous Sources

## Goal

Give data owners a review workflow for remaining ambiguous mappings.

## Problem

Remaining unmapped values such as `OMSO 1-OZ`, `OMSO 2-OZ`, `POLYPRINT`, and `HENGFENG` are not safe for broad alias mapping because they can map to different target buckets.

## Scope

Add a queue in Master Data:

```text
Mapping Review Queue
```

Display columns:

- source field
- source value
- row count
- mapped row count
- unmapped row count
- OK quantity impact
- impact severity
- date range
- top item numbers
- item descriptions
- item categories
- candidate entities
- confidence reason
- target bucket candidates
- sample document numbers
- recommended action

Supported reviewer actions:

- create alias mapping
- create conditional mapping rule
- skip / keep unmapped
- mark as needs source correction
- export review CSV

## Acceptance criteria

- LOW/ambiguous rows remain REVIEW by default.
- Data owner can decide with enough context.
- All commits are previewed and audited.
- No automatic broad family fallback is introduced.
- UI clearly distinguishes CRITICAL/HIGH impact from zero-quantity noise.

---

# P0.5 — Conditional Mapping by Bucket

## Goal

Resolve ambiguous source values by using item/product bucket conditions instead of one broad alias.

## Problem

A source value such as `OMSO 1-OZ` may map to different target entities depending on item description, item category, OZ size, or inferred target bucket.

## Suggested model

Add reviewed conditional mapping rules.

Example:

```text
source_system = business-central
source_field = prod_line_description
source_value = OMSO 1-OZ
condition_type = inferred_target_bucket
condition_value = target_printing_22_oz
target_entity = OMSO 1 - Printing Cup OZ - Printing 22 OZ
```

Another example:

```text
source_system = business-central
source_field = prod_line_description
source_value = OMSO 1-OZ
condition_type = inferred_target_bucket
condition_value = target_printing_oz_lt_20
target_entity = OMSO 1 - Printing OZ < 20
```

## Supported condition types

Start small:

- `inferred_target_bucket`
- `item_category_code`
- `item_no_pattern`
- `gross_weight_range`

## Resolver order

Suggested order:

1. Existing exact reviewed alias.
2. Exactly-one matching conditional mapping rule.
3. Existing source candidate fallback.
4. Unmapped.

## Safety

- If multiple conditional rules match, stay unmapped and raise a data quality issue.
- If no rule matches, stay unmapped.
- Do not infer target by broad family token alone.
- All conditional mappings must be previewed, committed, and audited.

## Acceptance criteria

- Ambiguous `OMSO`, `POLYPRINT`, and `HENGFENG` can be resolved safely with reviewed conditions.
- Bucket mismatch still returns `TARGET_BUCKET_MISSING` or `UNMAPPED_ENTITY`.
- Dashboard KPI remains stable.
- All commits are previewed and audited.
- Tests cover ambiguous and multiple-match cases.

---

# P0.6 — Data Quality Automation for Unmapped Source Groups

## Goal

Make unmapped Business Central source groups visible in `/data-quality`.

## Problem

Diagnostics currently expose unmapped groups, but operators need a persistent workflow for ownership and resolution.

## Scope

Automatically create or update Data Quality issues for unmapped source groups.

Suggested issue:

```text
issue_code = UNMAPPED_BC_ENTITY_SOURCE
source_system = business-central
source_field = prod_line_description
source_value = REPACKING
impact_ok_qty = 5,688,849
severity = CRITICAL
status = OPEN
```

When a mapping commit resolves the group:

```text
status = RESOLVED
resolution_note = mapped via alias or conditional mapping
```

## Severity

Use `impact_severity` from P0.2.

## Acceptance criteria

- High-impact unmapped source groups appear in Data Quality.
- Mapping commit can auto-resolve matching issues.
- Ignored/skipped groups remain explainable.
- Issue history is audited.
- No production quantities or targets are changed.

---

# P0.7 — Reject Attachment Review Queue

## Goal

Reduce Reject PCS Eq incomplete gaps caused by ambiguous or reject-only attachment.

## Current known gap

Reject PCS Eq remains incomplete with 20 gaps, including:

- `AMBIGUOUS_REJECT_ATTACHMENT`
- `REJECT_ONLY`

## Scope

Add a review queue for unresolved reject rows.

Display:

- document number
- reject item
- reject KG
- attachment status
- candidate OK groups
- candidate posting dates
- candidate machines
- item numbers/descriptions
- operator/shift/work hours
- gross weight evidence

Reviewer actions:

- attach to selected OK group
- mark as reject-only/no OK row
- keep unresolved
- add note

Suggested table:

```text
reject_attachment_overrides
```

Minimal fields:

- id
- source_system
- reject_output_id
- document_no
- reject_item_no
- selected_ok_output_id or selected_ok_group_key
- reason_note
- created_by
- created_at
- is_active

## Safety

- Do not split reject KG across multiple OK rows automatically.
- Do not compute Reject PCS Eq without one selected OK group.
- All overrides require audit log.
- Overrides must be reversible.
- Reject rate remains `N/A` until required PCS equivalents are complete.

## Acceptance criteria

- Ambiguous reject rows can be manually resolved.
- Reject PCS Eq incomplete count decreases only after deterministic or reviewed overrides.
- Manual overrides are visible in audit logs and source traceability.

---

# P0.8 — P0.1/P0.2 Closeout and V1 Parity Gate

## Goal

Close the Business Central calculation accuracy gate and prepare V1 parity sign-off.

## Required checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm bc:profile
pnpm bc:daily-item-resume
pnpm bc:reconcile
pnpm bc:target-coverage
pnpm bc:mapping-candidates
pnpm smoke:test
git diff --check
```

## Manual checks

- `/overview`
- `/master-data`
- `/data-quality`
- `/settings/health`
- `/settings/audit`
- `/settings/sync`
- `/settings/targets`

## Closeout criteria

- OK Output reconciles with raw SQL.
- Target/achievement does not use fake target values.
- Remaining unmapped groups are documented and assigned.
- Reject PCS gaps are either resolved or explicitly accepted.
- Mapping coverage is tracked by OK quantity impact.
- Known issues are updated.
- UAT notes are written.
- V1 parity gap audit is current.
