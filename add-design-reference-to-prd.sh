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
  echo "ERROR: $DESIGN_PATH tidak ditemukan."
  echo "Pastikan file referensi desain sudah ada:"
  echo "  $DESIGN_PATH"
  exit 1
fi

BACKUP_PATH="${PRD_PATH}.bak-design-reference-$(date +%Y%m%d-%H%M%S)"
cp "$PRD_PATH" "$BACKUP_PATH"

python3 - "$PRD_PATH" "$DESIGN_PATH" <<'PY'
from pathlib import Path
import sys

prd_path = Path(sys.argv[1])
design_path = Path(sys.argv[2])
text = prd_path.read_text()

design_heading = "## 27.10 Milestone 9 — Design System and UI/UX Production Polish"

if design_heading not in text:
    raise SystemExit(
        "ERROR: milestone Design System belum ada di PRD. "
        "Jalankan add-design-system-milestone.sh dulu, lalu jalankan script ini lagi."
    )

reference_block = """### Required Design Reference

This milestone must use `docs/design.md` as the primary visual design reference. The design reference is based on the Notion Beige aesthetic from designdotmd:

- Reference URL: https://designdotmd.directory/d/notion-beige
- Local reference file: `docs/design.md`

The implementation must read and follow `docs/design.md` before changing UI components. The reference should guide color palette, background tone, surface treatment, typography mood, spacing, border radius, subtle shadows, card style, navigation feel, and overall visual direction.

Interpretation for this product:
- Use the Notion Beige aesthetic as inspiration, not as a copy-paste clone.
- Adapt it into a professional PPIC/manufacturing operations dashboard.
- Keep the UI warm, calm, structured, readable, and production-grade.
- Avoid playful, overly decorative, or consumer-app styling.
- Preserve strong operational hierarchy for KPIs, filters, tables, alerts, and action buttons.

"""

if "### Required Design Reference" not in text:
    design_direction_marker = "### Design Direction\n\n"
    insert_at = text.find(design_direction_marker)
    if insert_at == -1:
        raise SystemExit("ERROR: tidak menemukan section '### Design Direction'.")
    insert_pos = insert_at
    text = text[:insert_pos] + reference_block + text[insert_pos:]

prompt_old = """Implement Milestone 9 Design System and UI/UX Production Polish.

Current state:
- The application is functionally working but the UI still looks like a rough MVP/admin scaffold.
- Do not change backend behavior, database schema, API contracts, permissions, sync behavior, parser behavior, import behavior, target behavior, downtime behavior, or business logic.
- Preserve all existing routes and API integrations.
- This milestone is only for frontend visual quality, layout consistency, usability, and reusable components.

Goal:
Transform the app into a clean production-grade manufacturing operations dashboard.
"""

prompt_new = """Implement Milestone 9 Design System and UI/UX Production Polish.

Before changing UI:
- Read `docs/design.md`.
- Use `docs/design.md` as the primary visual reference.
- The local design reference is based on Notion Beige: https://designdotmd.directory/d/notion-beige
- Treat the reference as inspiration for visual direction, not as a requirement to clone every detail exactly.

Current state:
- The application is functionally working but the UI still looks like a rough MVP/admin scaffold.
- Do not change backend behavior, database schema, API contracts, permissions, sync behavior, parser behavior, import behavior, target behavior, downtime behavior, or business logic.
- Preserve all existing routes and API integrations.
- This milestone is only for frontend visual quality, layout consistency, usability, and reusable components.

Goal:
Transform the app into a clean production-grade manufacturing operations dashboard with a warm, calm, structured Notion Beige-inspired visual system adapted for PPIC/manufacturing operations.
"""

if prompt_old in text:
    text = text.replace(prompt_old, prompt_new, 1)
elif "Before changing UI:\n- Read `docs/design.md`." not in text:
    print("Warning: prompt block pattern not found. Main design reference section was still inserted.")

tasks_old = "- Establish a shared design system for the web app."
tasks_new = "- Establish a shared design system for the web app using `docs/design.md` as the mandatory visual reference."
text = text.replace(tasks_old, tasks_new, 1)

design_old = "- Professional internal SaaS dashboard."
design_new = "- Notion Beige-inspired professional internal SaaS dashboard, based on `docs/design.md`."
text = text.replace(design_old, design_new, 1)

acceptance_old = "- UI no longer looks like raw/default admin HTML."
acceptance_new = "- UI follows `docs/design.md` visual direction and no longer looks like raw/default admin HTML."
text = text.replace(acceptance_old, acceptance_new, 1)

prd_path.write_text(text)
print(f"Updated {prd_path}")
PY

echo
echo "Backup dibuat:"
echo "  $BACKUP_PATH"
echo
echo "Cek referensi desain:"
grep -n "Required Design Reference\|docs/design.md\|Notion Beige\|designdotmd" "$PRD_PATH" || true
echo
echo "Diff:"
git diff -- "$PRD_PATH" || true

echo
echo "Jika diff sudah benar, commit dengan:"
echo "  git add $PRD_PATH"
echo "  git commit -m \"docs: add design reference\""
echo
echo "Jika ingin rollback:"
echo "  cp \"$BACKUP_PATH\" \"$PRD_PATH\""
