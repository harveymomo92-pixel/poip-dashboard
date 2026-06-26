# Known Issues

## Output reject classification UI smoke test

Status: pending fix

Context:
The OK/Reject classification patch has been implemented and backend diagnostics are working, but the full `pnpm test` still fails on the web smoke test:

- `overview resume renders reject attachment details under OK row`

Current behavior:
- `pnpm --filter @poip/api test` passes.
- `pnpm build` passes.
- `pnpm bc:daily-item-resume` runs and reports OK/reject classification.
- `pnpm bc:reconcile` runs and reports reject KG.

Pending fix:
- Clean up `RejectDetail` rendering in `apps/web/src/app/overview/DashboardPageClient.tsx`.
- Ensure reject detail rendering uses `rows={row.rejectDetails}` in the intended table cell.
- Remove accidental placeholder/string artifact if present:
  - `$<RejectDetail row={row} />`
- Re-run:
  - `pnpm --filter @poip/web test`
  - `pnpm test`
  - `pnpm build`
  - `git diff --check`

Do not tag this patch as a completed milestone until the web smoke test passes.

<!-- P0_2_KNOWN_ISSUES_UPDATE -->
## P0.2-P0.8 Business Central Mapping Accuracy Improvements

Status: planned.

P0.1 calculation core is mostly correct, but remaining unmapped source groups still require safer review workflows.

Tracked in:

- `docs/P0_2_BC_MAPPING_ACCURACY_ROADMAP.md`
- `docs/OPENCLAW_P0_2_MAPPING_ACCURACY_PROMPTS.md`

Key remaining themes:

- mapping impact ranking
- source quality diagnostics
- source-specific reset/remap UI
- mapping review queue
- conditional mapping by bucket
- Data Quality automation for unmapped groups
- reject attachment review queue

Important safety rule:

Do not hide N/A target states by forcing fake target values, and do not compute reject rate when Reject PCS Eq is incomplete.
