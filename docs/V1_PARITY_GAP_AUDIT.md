
<!-- P0_8_V1_PARITY_GAP_AUDIT -->
# V1 Parity Gap Audit — P0.2-P0.8 Mapping Accuracy Addendum

Status: planning/addendum.

## Business Central calculation gate

Current known baseline:

- OK Output reconciles with raw OK Output.
- Target/achievement no longer forces missing target states to zero.
- Reject PCS Eq is visible but incomplete when attachment/conversion evidence is incomplete.
- Remaining unmapped groups are visible and require review.
- Safe HIGH exact mapping has been applied.
- LOW and ambiguous groups must not be auto-mapped.

## P0.2-P0.8 gap list

| Phase | Area | Status | Notes |
|---|---|---:|---|
| P0.2 | Mapping impact ranking | Planned | Rank unmapped by OK quantity impact, not raw row count. |
| P0.3 | Source-specific reset/remap UI | Planned | Official Master Data UI recovery flow. |
| P0.4 | Mapping review queue | Planned | Data-owner queue for LOW/ambiguous groups. |
| P0.5 | Conditional mapping by bucket | Planned | Needed for OMSO/POLYPRINT/HENGFENG-style ambiguity. |
| P0.6 | Data Quality automation | Planned | Persistent DQ issues for unmapped groups. |
| P0.7 | Reject attachment review queue | Planned | Needed to reduce Reject PCS Eq incomplete gaps. |
| P0.8 | Closeout and sign-off | Planned | Final diagnostics, known issues, UAT notes. |

## Closeout evidence to capture

Before closing the gate, record:

- `pnpm bc:daily-item-resume`
- `pnpm bc:reconcile`
- `pnpm bc:target-coverage`
- `pnpm bc:mapping-candidates`
- `pnpm smoke:test`
- Manual UAT notes for `/overview`, `/master-data`, `/data-quality`, `/settings/health`, `/settings/audit`, `/settings/sync`, and `/settings/targets`

## Non-negotiable rules

- Do not auto-map LOW/ambiguous rows.
- Do not hide `N/A` target states.
- Do not compute reject rate while Reject PCS Eq is incomplete.
- Do not change raw Business Central quantities.
- Do not commit secrets, local backups, dumps, or `.tmp` outputs.
