# BC Source Fields Backfill and Safe Mapping Validation

Date: 2026-06-26
Environment: local/UAT
Commit: 8143b21

## Completed

- Ran Business Central source-fields backfill in commit mode.
- Updated prod_line_no and prod_line_description for 85,880 rows.
- machine_description was not backfilled because BC endpoint does not expose a true machine-description field.
- Ran mapping plan.
- Auto-marked only HIGH confidence exact normalized matches as COMMIT.
- Applied 12 reviewed mapping rows.
- Updated 27,736 rows.
- Conflicts: 0
- Warnings: 0

## Before safe mapping

- Mapping coverage: 41.85%
- Mapped rows: 5,962
- Unmapped rows: 8,283
- Unmapped OK qty: 27,832,688.00

## After safe mapping

- Mapping coverage: 60.21%
- Mapped rows: 8,577
- Unmapped rows: 5,668
- Unmapped OK qty: 14,911,137.00

## KPI validation

- OK output remained 30,512,440.0000
- Raw OK output remained 30,512,440.0000
- Reject KG remained 4,012.2000
- Achievement remained 75.67%
- Reject PCS Eq remained incomplete with 20 gaps

## Remaining review items

Do not auto-map these without business review:

- REPACKING
- THERMO 6 ILLIG
- OMSO 1-OZ
- OMSO 2-OZ
- LS1-25.8/42.3KALE
- THERMO 5 HENGFENG
- THERMO 4 HENGFENG-OZ
- POLYPRINT PRINTING-OZ
- POLYPRINT PRINTING-OZ-2
- THERMO HENGFENG-3
- THERMO HENGFENG-4
- THERMO HENGFENG-1-OZ

## Next step

Proceed with logged-in visual smoke and UAT. Remaining mappings require data owner review.
