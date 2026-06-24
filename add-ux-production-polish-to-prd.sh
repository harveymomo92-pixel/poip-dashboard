#!/usr/bin/env bash
set -euo pipefail

PRD_PATH="${1:-docs/PRD.md}"

if [[ ! -f "$PRD_PATH" ]]; then
  echo "ERROR: $PRD_PATH tidak ditemukan."
  echo "Jalankan dari root repo:"
  echo "  cd ~/dev/ppic-output-intelligence"
  echo "  bash add-ux-production-polish-to-prd.sh"
  exit 1
fi

BACKUP_PATH="${PRD_PATH}.bak-ux-polish-$(date +%Y%m%d-%H%M%S)"
cp "$PRD_PATH" "$BACKUP_PATH"

python3 - "$PRD_PATH" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()

old_heading = "## 27.10 Milestone 9 — Design System and UI/UX Production Polish"
new_heading = "## 27.10 Milestone 9 — Design System, UX Workflow, and Production Polish"

if old_heading in text:
    text = text.replace(old_heading, new_heading, 1)

if new_heading not in text:
    raise SystemExit(
        "ERROR: Milestone Design System belum ditemukan di PRD.\n"
        "Jalankan add-design-system-milestone.sh dulu, lalu jalankan script ini lagi."
    )

ux_section = """### UX Production Polish Requirements

The Design System milestone must improve user experience, not only visual styling. The application must feel easy, safe, fast, and clear for PPIC, production, supervisor, and admin users.

#### UX Goals

- Make the application easy to understand for PPIC, production, and admin users.
- Reduce user mistakes during target input, downtime closing, import commit, WA parser commit, and data quality issue handling.
- Make every important action explain its result clearly.
- Make data freshness, validation status, and source traceability visible.
- Make operational workflows guided, safe, and recoverable.
- Reduce cognitive load by showing the next action clearly.
- Keep critical actions explicit and reversible where possible.

#### Navigation UX

- Implement collapsible sidebar with persisted collapsed state.
- Add tooltips for collapsed sidebar items.
- Group navigation into Dashboard, Operations, Tools, and Settings.
- Add clear active state for the current page.
- Add responsive drawer sidebar for smaller screens.
- Move logout/session actions into a user menu or top bar.
- Add breadcrumbs or contextual page location where useful.
- Ensure users can answer: where am I, what can I do here, and what should I do next?

#### User Preference Persistence

Persist user preferences in local storage where appropriate:

- sidebar collapsed state
- dashboard filter values
- date range
- table density
- table sorting
- column visibility where implemented
- last selected import/parser type where safe

#### Feedback and Notification UX

- Add toast notifications for create, update, approve, reject, close, preview, commit, resolve, ignore, and sync actions.
- Add loading states for async actions.
- Disable submit buttons while requests are running.
- Prevent double submit on forms and commit actions.
- Show success messages with operationally useful details, such as committed row counts, updated status, skipped rows, or created entity name.
- Show failure messages with a clear retry path.
- Avoid silent refreshes after important actions.

#### Form UX

- Standardize labels, helper text, validation errors, and action buttons.
- Show inline validation near the affected field.
- Use human-readable validation messages.
- Add helper text for complex fields such as date range, shift, machine/entity, item, natural key, import type, parser type, and downtime close time.
- Preserve user input when validation fails.
- Avoid hard resets unless the user explicitly clears the form.
- Use sensible defaults for date ranges and operational filters.
- Make required fields visually clear without cluttering the form.
- Show disabled/loading state on submit buttons.

#### Workflow UX

Use guided multi-step flows for complex workflows.

Import Center flow:

1. Upload or paste
2. Preview
3. Review validation issues
4. Commit
5. Result summary

WhatsApp Parser flow:

1. Paste WhatsApp text
2. Parse preview
3. Review row issues
4. Commit
5. Result summary

Target workflow:

1. Create draft
2. Review details
3. Submit or approve
4. Show active/approved target status

Downtime workflow:

1. Create open downtime
2. Update details if needed
3. Close downtime
4. Show calculated duration and audit trail

Preview actions must not write final operational data. Commit actions must clearly state what will be written, skipped, or marked as issue.

#### Confirmation and Recovery UX

Add confirmation dialogs for sensitive actions:

- approve target
- reject target
- deactivate target
- close downtime
- commit import
- commit WA parser
- resolve data quality issue
- ignore data quality issue
- rerun sync manually where applicable

Confirmation dialogs must explain the impact of the action in plain operational language.

Prefer safe recovery patterns:

- deactivate instead of delete
- allow issue status transitions where permitted
- keep audit trail visible
- keep commit operations idempotent
- avoid irreversible actions in the UI unless explicitly required

#### Data Trust UX

Expose data trust indicators across dashboard and operational pages:

- last sync time
- freshness status
- source system or source workflow
- validation status
- data quality issue count
- audit history where relevant
- approved/unapproved status for target data
- imported/parser/manual/source label where applicable

Dashboard and operational pages must make stale, missing, invalid, duplicate, unresolved, or unapproved data obvious.

#### Data Quality UX

- Show issue severity clearly.
- Show row-level or entity-level issue details.
- Explain why an issue exists.
- Provide recommended fix text when feasible.
- Support acknowledge, resolve, and ignore actions where permissions allow.
- Show issue history or audit context where feasible.
- Avoid exposing only machine-readable error codes without explanation.
- Group related issues where helpful.

#### Table UX

- Use a consistent shared `DataTable` component.
- Support loading skeleton.
- Support empty state with contextual CTA.
- Support row status badges.
- Support pagination where API supports it.
- Support sorting where feasible.
- Support compact density suitable for operational data.
- Support column visibility where feasible.
- Keep table columns readable and avoid horizontal clutter.
- Use sticky or visually clear headers where feasible.
- Keep row actions consistent across modules.

#### Dashboard UX

The overview dashboard must behave like an operations cockpit:

- Show the current operational state first.
- Show freshness and sync status.
- Show KPI cards with clear status treatment.
- Show insight cards for data quality and downtime.
- Use real trend/breakdown data where available.
- If data is unavailable, show polished empty states instead of fake data.
- Explain missing target, stale data, never-synced data, and unresolved data quality states in human language.
- Make the dashboard useful even when some data is missing.
- Show operational next steps where appropriate.

#### Accessibility UX

- All interactive elements must have visible focus states.
- Dialogs must be keyboard accessible.
- Inputs must have labels.
- Status must not rely on color alone.
- Buttons and links must have clear text.
- Tooltips must be supplementary, not required to understand the page.
- Forms must be usable by keyboard.
- Error messages must be associated with their fields where feasible.
- Avoid contrast that is too low in the beige visual system.

#### Performance UX

- Use skeleton loading for dashboards, tables, cards, and forms.
- Use optimistic UI only where safe.
- Disable buttons during async work.
- Debounce search and filters where appropriate.
- Avoid unnecessary full-page reloads.
- Keep table pagination and rendering responsive.
- Keep charts lightweight and backed by real API data.

#### Microcopy UX

Add short, helpful microcopy where users need context:

- Explain what each page is for.
- Explain where data comes from.
- Explain what each status means.
- Explain what preview and commit will do.
- Explain why an empty state is empty.
- Explain what users should do next.

Examples:

- “Preview does not write final operational data. Commit will save valid rows only.”
- “Target belum tersedia untuk periode ini. Achievement tidak dapat dihitung sampai target disetujui.”
- “Data terakhir disinkronkan 18 menit lalu.”
- “7 rows are invalid and will be skipped during commit.”
- “Downtime masih terbuka. Tutup downtime saat mesin kembali berjalan.”

#### Bulk Action UX

For data quality and issue management, support safe bulk actions where feasible:

- select multiple issues
- acknowledge selected
- resolve selected
- ignore selected
- show confirmation before bulk changes
- show result summary after bulk action

Bulk actions must respect permissions and must not hide individual issue details.

#### UX Acceptance Criteria

- Users can navigate without guessing where features are.
- Users understand what happened after every action.
- Users can safely preview before committing import/parser data.
- Users see clear validation messages and how to fix issues.
- Users can identify stale, missing, invalid, duplicate, unresolved, or unapproved data.
- Users can recover from common mistakes without data loss.
- Tables, forms, dialogs, toasts, filters, and empty states are consistent across modules.
- Operational workflows feel guided and safe.
- The application feels like a production operations tool, not a collection of raw admin pages.

---

"""

# Insert UX section before the Prompt section inside the Design System milestone.
if "### UX Production Polish Requirements" not in text:
    start = text.find(new_heading)
    next_milestone = text.find("## 27.11 Milestone 10", start)
    if next_milestone == -1:
        next_milestone = len(text)

    prompt_pos = text.find("### Prompt", start, next_milestone)
    if prompt_pos == -1:
        raise SystemExit("ERROR: tidak menemukan '### Prompt' di Milestone Design System.")

    text = text[:prompt_pos] + ux_section + text[prompt_pos:]
else:
    print("UX Production Polish Requirements already exists. Skip insertion.")

# Rename prompt title if present.
text = text.replace(
    "Implement Milestone 9 Design System and UI/UX Production Polish.",
    "Implement Milestone 9 Design System, UX Workflow, and Production Polish.",
)

# Strengthen prompt goal if present.
text = text.replace(
    "Transform the app into a clean production-grade manufacturing operations dashboard.",
    "Transform the app into a clean production-grade manufacturing operations dashboard with polished UI, guided UX workflows, clear feedback, safe confirmations, and consistent operational interaction patterns.",
    1,
)

# Add UX line in prompt after current frontend-only line if not already present.
frontend_line = "- This milestone is only for frontend visual quality, layout consistency, usability, and reusable components."
ux_prompt_line = "- This milestone must improve UX flows, feedback, validation, empty states, loading states, confirmation dialogs, toasts, data trust indicators, and user preference persistence."
if frontend_line in text and ux_prompt_line not in text:
    text = text.replace(frontend_line, frontend_line + "\n" + ux_prompt_line, 1)

# Rename roadmap sequence wording if present.
text = text.replace(
    "10. Design system and UI/UX production polish.",
    "10. Design system, UX workflow, and production polish.",
)

# Strengthen general acceptance if present.
text = text.replace(
    "- UI follows `docs/design.md` visual direction and no longer looks like raw/default admin HTML.",
    "- UI follows `docs/design.md` visual direction and no longer looks like raw/default admin HTML.\n- UX flows are guided, safe, recoverable, and clear for operational users.",
    1,
)

path.write_text(text)
print(f"Updated {path}")
PY

echo
echo "Backup dibuat:"
echo "  $BACKUP_PATH"
echo
echo "Cek section UX:"
grep -n "Design System, UX Workflow\|UX Production Polish Requirements\|Navigation UX\|Workflow UX\|Data Trust UX\|Microcopy UX\|UX Acceptance Criteria" "$PRD_PATH" || true
echo
echo "Diff:"
git diff -- "$PRD_PATH" || true

echo
echo "Jika diff sudah benar, commit dengan:"
echo "  git add $PRD_PATH"
echo "  git commit -m \"docs: add ux polish requirements\""
echo
echo "Jika ingin rollback:"
echo "  cp \"$BACKUP_PATH\" \"$PRD_PATH\""
