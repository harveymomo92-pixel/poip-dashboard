# P0.5 Conditional Mapping by Bucket API

Date: 2026-06-26
Environment: local/UAT

## Summary

Implemented the smallest safe P0.5 patch for Business Central conditional mapping by bucket.

## Completed

- Added reviewed conditional mapping rule support.
- Added database schema/migration for `master_entity_conditional_rules`.
- Added domain conditional matcher and tests.
- Added API preview/commit path.
- Added resolver order:
  1. exact reviewed alias
  2. exactly-one matching conditional rule
  3. existing fallback behavior
  4. unmapped
- Added conflict handling:
  - zero matching rules remain unmapped
  - multiple matching rules remain unmapped with conflict/review reason
- Added `CONDITIONAL_MAPPING_REVIEW` data-quality reason/type.
- Updated docs/API.md and docs/OPERATIONS.md.

## Safety

- No global alias was created for `OMSO1 OZ`.
- Legacy broad alias `OMSO1 OZ -> Printing 22 OZ` was identified as unsafe and deactivated.
- A previously mapped `OMSO1 OZ` 16 OZ row was reset to unmapped so it can later be handled by reviewed conditional rule.
- Conditional mapping does not mutate quantities.
- Conditional mapping commit only updates currently unmapped rows that match the reviewed condition.
- Existing mapped rows are not overwritten unless explicit reset/remap was used.
- KPI formulas were not changed.

## Current known gap

`OMSO1 OZ` remains unmapped/ambiguous until reviewed conditional rules are created and committed.

Current gap:

- source_field: machine_center_no
- source_value: OMSO1 OZ
- rows: approximately 306 after resetting the 16 OZ row
- unmapped OK qty: approximately 29,740,500 after resetting the 16 OZ row

Do not map `OMSO1 OZ` globally. It must be mapped using reviewed conditional rules.
