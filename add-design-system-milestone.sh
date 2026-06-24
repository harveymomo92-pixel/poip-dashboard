#!/usr/bin/env bash
set -euo pipefail

PRD_PATH="${1:-docs/PRD.md}"

if [[ ! -f "$PRD_PATH" ]]; then
  echo "ERROR: $PRD_PATH tidak ditemukan."
  echo "Jalankan script ini dari root repo, contoh:"
  echo "  cd ~/dev/ppic-output-intelligence"
  echo "  bash add-design-system-milestone.sh"
  exit 1
fi

BACKUP_PATH="${PRD_PATH}.bak-design-system-$(date +%Y%m%d-%H%M%S)"
cp "$PRD_PATH" "$BACKUP_PATH"

python3 - "$PRD_PATH" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()

marker = "## 27.10 Milestone 9 — Data Quality, Audit, Health"

section = """## 27.10 Milestone 9 — Design System and UI/UX Production Polish

### Goal

Transform the frontend from a functional MVP/admin scaffold into a consistent, production-grade manufacturing operations dashboard. This milestone is intentionally UI-focused and must not change backend contracts, database schema, RBAC behavior, sync behavior, parser behavior, import behavior, target behavior, downtime behavior, or business logic.

### Tasks

- Establish a shared design system for the web app.
- Refactor the application shell, sidebar, page headers, toolbar patterns, KPI cards, tables, forms, badges, loading states, empty states, and error states.
- Group navigation into Dashboard, Operations, Tools, and Settings.
- Move logout/session actions into a dedicated user/session area.
- Standardize typography, spacing, color tokens, border radius, shadows, focus states, and responsive layout rules.
- Redesign the overview dashboard to look like an operational command center rather than a raw admin form.
- Improve all existing pages so they look like one product, not separate milestone prototypes.
- Clean up global CSS and reduce page-specific styling hacks.
- Preserve all current API integrations and real data rendering.

### Design Direction

- Professional internal SaaS dashboard.
- Manufacturing and operations oriented.
- Clean, compact, readable, structured, and calm.
- Strong visual hierarchy for operational KPIs, alerts, and actions.
- Avoid playful colors, excessive decoration, and raw/default HTML styling.
- Prefer reusable components over one-off page styling.

### Required Shared Components

- `AppShell`
- `Sidebar`
- `TopBar` or `UserMenu`
- `PageHeader`
- `PageToolbar`
- `FilterBar`
- `MetricCard`
- `InsightCard`
- `StatusBadge`
- `DataTable`
- `EmptyState`
- `LoadingSkeleton`
- `ErrorState`
- `FormPanel`
- `SectionHeader`
- `ConfirmDialog` where feasible

### Page Scope

The following pages must be visually reviewed and polished if they exist:

- `/overview`
- `/downtime`
- `/tools/import-center`
- `/tools/wa-parser`
- `/settings/sync`
- `/settings/targets`
- `/settings/users`
- Any data quality, audit, or health pages if already created before this milestone runs

### Dashboard Requirements

- Replace the raw card/form layout with a polished dashboard layout.
- Use a clear page header with title, short description, and freshness/last updated information.
- Convert filters into a proper toolbar with Apply and Reset actions.
- Redesign KPI cards for OK Output, Target, Achievement, Reject KG, Reject PCS Eq, Reject Rate, Downtime Minutes, and Freshness.
- Use clear badges and status treatment for states such as `STALE`, `NO_TARGET`, warning, and critical.
- Improve Data Quality and Downtime summary panels so they look like real insight cards.
- If trend/breakdown API data already exists, add lightweight visual sections; otherwise show polished empty states without hardcoded data.

### Prompt

```text
Implement Milestone 9 Design System and UI/UX Production Polish.

Current state:
- The application is functionally working but the UI still looks like a rough MVP/admin scaffold.
- Do not change backend behavior, database schema, API contracts, permissions, sync behavior, parser behavior, import behavior, target behavior, downtime behavior, or business logic.
- Preserve all existing routes and API integrations.
- This milestone is only for frontend visual quality, layout consistency, usability, and reusable components.

Goal:
Transform the app into a clean production-grade manufacturing operations dashboard.

Create/refactor shared UI components for AppShell, Sidebar, PageHeader, PageToolbar, FilterBar, MetricCard, InsightCard, StatusBadge, DataTable, EmptyState, LoadingSkeleton, ErrorState, FormPanel, SectionHeader, and ConfirmDialog if feasible.

Redesign navigation into Dashboard, Operations, Tools, and Settings groups. Add a clear active navigation state and move Logout into a user/session area.

Redesign /overview so it no longer looks like raw/default admin HTML. Improve filter toolbar, KPI cards, data quality insight card, downtime insight card, spacing, hierarchy, badges, and empty states.

Visually polish /downtime, /tools/import-center, /tools/wa-parser, /settings/sync, /settings/targets, /settings/users, and any data quality/audit/health pages that already exist.

Clean up globals.css. Standardize body background, typography, card styling, borders, focus states, button styles, table styles, form fields, badges, loading states, empty states, and error states.

Do not hardcode production data. Do not add heavy UI libraries unless already installed or clearly justified. Do not use dependency "latest".

Run pnpm lint, pnpm typecheck, pnpm test, and pnpm build before finishing.

Return changed files, shared components created/refactored, pages improved, before/after visual notes, and remaining UI limitations.
```

### Acceptance Criteria

- UI no longer looks like raw/default admin HTML.
- Sidebar and navigation look intentional and grouped.
- Dashboard has clear visual hierarchy and looks like a production operations dashboard.
- KPI cards have consistent styling, spacing, and status treatment.
- Filters, forms, buttons, badges, tables, loading states, empty states, and error states are consistent across pages.
- Logout/session controls are not placed awkwardly inside dashboard content.
- Existing functionality, permissions, routes, and API contracts remain intact.
- `pnpm lint` passes.
- `pnpm typecheck` passes.
- `pnpm test` passes.
- `pnpm build` passes.

---

"""

if "## 27.10 Milestone 9 — Design System and UI/UX Production Polish" in text:
    print("Design System milestone already exists. Skip insertion.")
else:
    if marker not in text:
        raise SystemExit(f"ERROR: heading target tidak ditemukan: {marker}")
    text = text.replace(marker, section + "## 27.11 Milestone 10 — Data Quality, Audit, Health", 1)

replacements = [
    (
        "Implement Milestone 9 Data Quality, Audit, and Health.",
        "Implement Milestone 10 Data Quality, Audit, and Health.",
    ),
    (
        "## 27.11 Milestone 10 — Production Hardening and UAT",
        "## 27.12 Milestone 11 — Production Hardening and UAT",
    ),
    (
        "Implement Milestone 10 Production Hardening.",
        "Implement Milestone 11 Production Hardening.",
    ),
    (
        "10. Data quality/audit/health.",
        "10. Design system and UI/UX production polish.\n11. Data quality/audit/health.",
    ),
    (
        "11. Production hardening.",
        "12. Production hardening.",
    ),
    (
        "12. UAT/cutover.",
        "13. UAT/cutover.",
    ),
]

for old, new in replacements:
    text = text.replace(old, new)

path.write_text(text)
print(f"Updated {path}")
PY

echo
echo "Backup dibuat:"
echo "  $BACKUP_PATH"
echo
echo "Cek hasil heading:"
grep -n "Milestone .*Design System\|Milestone .*Data Quality\|Milestone .*Production Hardening\|Design system and UI/UX\|Data quality/audit/health" "$PRD_PATH" || true
echo
echo "Diff docs/PRD.md:"
git diff -- "$PRD_PATH" || true

echo
echo "Jika diff sudah benar, commit dengan:"
echo "  git add $PRD_PATH"
echo "  git commit -m \"docs: add design system milestone\""
echo
echo "Jika ingin rollback:"
echo "  cp \"$BACKUP_PATH\" \"$PRD_PATH\""
