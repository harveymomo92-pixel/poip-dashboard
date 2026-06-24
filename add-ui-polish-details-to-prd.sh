#!/usr/bin/env bash
set -euo pipefail

PRD_PATH="${1:-docs/PRD.md}"
DESIGN_PATH="${2:-docs/design.md}"

if [[ ! -f "$PRD_PATH" ]]; then
  echo "ERROR: $PRD_PATH tidak ditemukan."
  echo "Jalankan dari root repo:"
  echo "  cd ~/dev/ppic-output-intelligence"
  exit 1
fi

if [[ ! -f "$DESIGN_PATH" ]]; then
  echo "WARNING: $DESIGN_PATH tidak ditemukan."
  echo "Script tetap lanjut, tapi UI milestone sebaiknya punya docs/design.md sebagai referensi visual."
fi

BACKUP_PATH="${PRD_PATH}.bak-ui-polish-details-$(date +%Y%m%d-%H%M%S)"
cp "$PRD_PATH" "$BACKUP_PATH"

python3 - "$PRD_PATH" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()

milestone_heading = "## 27.10 Milestone 9 — Design System and UI/UX Production Polish"

if milestone_heading not in text:
    raise SystemExit(
        "ERROR: milestone Design System belum ada. "
        "Jalankan add-design-system-milestone.sh dulu."
    )

details = """### Interaction and Motion Requirements

- Implement a collapsible sidebar with expanded and collapsed states.
- Persist the sidebar collapsed state in local storage.
- Keep collapsed sidebar icons readable with tooltips.
- On small screens, use a drawer-style sidebar instead of squeezing the layout.
- Add clear active navigation state for every route.
- Add navigation groups:
  - Dashboard
  - Operations
  - Tools
  - Settings
- Add a compact top bar or session area with current user and logout action.
- Add breadcrumbs or page context where useful.
- Add keyboard and focus-visible states for all interactive controls.
- Add subtle, fast CSS transitions for sidebar, buttons, menus, dialogs, and row hover states.
- Do not add heavy animation libraries unless absolutely necessary.
- Prefer calm transitions that match the Notion Beige-inspired design reference.

### Table and Data Interaction Requirements

- Standardize all operational tables through a shared `DataTable` component.
- Support table loading skeletons.
- Support empty state with contextual action.
- Support row-level status badges.
- Support sticky or visually clear table headers where feasible.
- Support pagination where API supports it.
- Support sorting and column visibility where feasible.
- Support compact density suitable for manufacturing operations data.
- Keep table markup accessible and readable.

### Form and Workflow Interaction Requirements

- Standardize input, select, textarea, checkbox, date input, and file upload styles.
- Use consistent field labels, helper text, validation errors, and action rows.
- Add confirmation dialogs for destructive or irreversible actions.
- Add toast notifications for create, update, approve, reject, close, preview, commit, and resolve actions.
- Add disabled/loading states for async submit buttons.
- Prevent double-submit on create/update/commit actions.
- Keep error messages human-readable and operationally useful.

### Dashboard Visualization Requirements

- Add lightweight charts where existing API data supports it.
- Recommended dashboard visualizations:
  - OK output trend
  - achievement trend
  - reject rate trend
  - downtime minutes trend
  - top downtime reasons/entities
  - data quality issue severity distribution
- Do not hardcode chart data.
- If data is unavailable, show polished empty states instead of fake charts.
- Charts must use the same design tokens as the rest of the UI.

### Recommended UI Package Policy

Prefer the existing stack. Add packages only when they materially improve accessibility, consistency, or dashboard usefulness.

Allowed additions if not already installed:

- `lucide-react` for consistent sidebar, action, status, and empty-state icons.
- `recharts` for lightweight React dashboard charts.
- `@tanstack/react-table` for headless table behavior if the project does not already use it.
- `class-variance-authority`, `clsx`, and `tailwind-merge` for reusable component variants and safe class composition.
- Radix UI primitives only as needed, such as:
  - `@radix-ui/react-collapsible`
  - `@radix-ui/react-dropdown-menu`
  - `@radix-ui/react-dialog`
  - `@radix-ui/react-popover`
  - `@radix-ui/react-tooltip`
  - `@radix-ui/react-tabs`
  - `@radix-ui/react-select`
  - `@radix-ui/react-separator`
  - `@radix-ui/react-scroll-area`
- `sonner` for toast notifications.
- `date-fns` only if date formatting/parsing is not already handled cleanly.

Use shadcn/ui style components where appropriate, but commit generated/customized components into the repo so the app owns its design system.

Dependency rules:

- Do not use dependency version `"latest"` in any `package.json`.
- Do not add large component suites such as MUI, Ant Design, Chakra UI, or Bootstrap unless explicitly approved.
- Do not add visual template packages that override the product identity.
- Keep dependency additions minimal and justified in the final summary.
- After adding packages, run the existing dependency guard, lint, typecheck, test, and build.

### Notion Beige Adaptation Requirements

The UI must follow `docs/design.md` as the primary visual reference and adapt it for a PPIC/manufacturing dashboard.

Emphasize:

- warm beige/off-white app background
- calm neutral surfaces
- subtle borders
- soft cards
- readable dark text
- muted secondary text
- compact but comfortable spacing
- understated shadows
- strong hierarchy through layout and typography, not loud colors
- restrained accent colors for operational status only

Avoid:

- bright saturated dashboard colors everywhere
- heavy gradients
- generic blue admin template styling
- raw HTML-looking inputs and tables
- over-rounded consumer-app components
- excessive animation

### Additional Acceptance Criteria

- Sidebar can collapse and expand smoothly.
- Collapsed sidebar remains usable through icons and tooltips.
- User/session/logout controls are moved out of the dashboard content area.
- All primary pages use the same `PageHeader`, `FilterBar`, `DataTable`, `MetricCard`, `StatusBadge`, `EmptyState`, and `ErrorState` patterns.
- Tables, forms, dialogs, toasts, and buttons look consistent across modules.
- Dashboard includes useful lightweight visualizations if backed by real API data.
- Any new package is justified and does not use `"latest"`.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

---

"""

if "### Interaction and Motion Requirements" in text:
    print("UI polish detail section already exists. Skip insertion.")
else:
    # Insert before Page Scope inside the Design System milestone.
    start = text.find(milestone_heading)
    page_scope = text.find("### Page Scope", start)
    if page_scope == -1:
        raise SystemExit("ERROR: tidak menemukan '### Page Scope' di milestone Design System.")
    text = text[:page_scope] + details + text[page_scope:]

# Strengthen prompt block if present.
old = "Create/refactor shared UI components for AppShell, Sidebar, PageHeader, PageToolbar, FilterBar, MetricCard, InsightCard, StatusBadge, DataTable, EmptyState, LoadingSkeleton, ErrorState, FormPanel, SectionHeader, and ConfirmDialog if feasible."
new = "Create/refactor shared UI components for AppShell, collapsible Sidebar, TopBar/UserMenu, PageHeader, PageToolbar, FilterBar, MetricCard, InsightCard, StatusBadge, DataTable, EmptyState, LoadingSkeleton, ErrorState, FormPanel, SectionHeader, ConfirmDialog, Tooltip, DropdownMenu, and Toast notifications if feasible."
text = text.replace(old, new, 1)

old = "Redesign navigation into Dashboard, Operations, Tools, and Settings groups. Add a clear active navigation state and move Logout into a user/session area."
new = "Redesign navigation into Dashboard, Operations, Tools, and Settings groups. Add a collapsible sidebar, clear active navigation state, icon support, tooltip support in collapsed mode, responsive drawer behavior on small screens, and move Logout into a user/session area."
text = text.replace(old, new, 1)

old = "Do not hardcode production data. Do not add heavy UI libraries unless already installed or clearly justified. Do not use dependency \"latest\"."
new = "Do not hardcode production data. Do not add heavy UI libraries unless already installed or clearly justified. Allowed lightweight additions include lucide-react, Recharts, Radix primitives, TanStack Table, CVA/clsx/tailwind-merge, Sonner, and date-fns when justified. Do not use dependency \"latest\"."
text = text.replace(old, new, 1)

path.write_text(text)
print(f"Updated {path}")
PY

echo
echo "Backup dibuat:"
echo "  $BACKUP_PATH"
echo
echo "Cek section baru:"
grep -n "Interaction and Motion Requirements\|Recommended UI Package Policy\|collapsible sidebar\|lucide-react\|recharts\|sonner\|Notion Beige Adaptation" "$PRD_PATH" || true
echo
echo "Diff:"
git diff -- "$PRD_PATH" || true

echo
echo "Jika diff sudah benar, commit dengan:"
echo "  git add $PRD_PATH"
echo "  git commit -m \"docs: expand ui polish requirements\""
echo
echo "Jika ingin rollback:"
echo "  cp \"$BACKUP_PATH\" \"$PRD_PATH\""
