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
