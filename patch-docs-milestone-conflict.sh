#!/usr/bin/env bash
set -euo pipefail

# Patch docs to resolve milestone ID conflict:
# - Legacy P0.7 = Reject Attachment Review Queue
# - New/active P0.7 = Entity Resolver V2 Dry Run
#
# This script is docs-only:
# - no TypeScript changes
# - no DB migration
# - no dashboard changes
# - no production_outputs.entity_id updates

cd "${PWD}"

if [ ! -d docs ]; then
  echo "ERROR: docs/ folder not found. Run from repo root."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
from datetime import date

docs = Path("docs")
today = date.today().isoformat()

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""

def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")

def replace_block(text: str, start: str, end: str, block: str) -> str:
    if start in text and end in text:
        before = text.split(start)[0].rstrip()
        after = text.split(end, 1)[1].lstrip()
        return before + "\n\n" + block.rstrip() + "\n\n" + after
    return text.rstrip() + "\n\n" + block.rstrip() + "\n"

# ---------------------------------------------------------------------------
# 1) Create canonical namespace / conflict resolution doc
# ---------------------------------------------------------------------------

namespace_doc = f"""# Business Central Milestone Namespace & Conflict Resolution

Status: active documentation guardrail  
Created: {today}  
Scope: Business Central roadmap IDs and phase ownership

---

## 1. Why This Document Exists

There are two different roadmap threads that used overlapping milestone IDs:

```text
Legacy mapping accuracy roadmap:
P0.7 = Reject Attachment Review Queue
P0.8 = P0.1/P0.2 closeout and V1 parity gate
```

and:

```text
New entity/target redesign roadmap:
P0.7 = Entity Resolver V2 Dry Run
P0.8 = Target Profile Model
P0.9 = Backfill / Migration Dry Run
P1.0 = Controlled Switch to Resolver V2 + Target Profiles
```

To prevent implementation mistakes, this document defines the active namespace and how to reference the legacy milestones.

---

## 2. Active Milestone Namespace

The active roadmap for upcoming implementation is:

| Milestone | Active meaning | Status |
|---|---|---|
| P0.7 | Entity Resolver V2 Dry Run | Active / next implementation |
| P0.8 | Target Profile Model | Planned after P0.7 |
| P0.9 | Backfill Plan & Migration Dry Run | Planned after P0.8 |
| P1.0 | Controlled Switch to Resolver V2 + Target Profiles | Planned after P0.9 |

This sequence is documented in:

```text
docs/BC_ENTITY_TARGET_REDESIGN_ROADMAP.md
docs/BC_ENTITY_RESOLVER_V2_DESIGN.md
docs/BC_TARGET_PROFILES.md
docs/BC_ENTITY_TARGET_MIGRATION_PLAN.md
docs/BC_ENTITY_TARGET_RELEASE_NOTES.md
```

---

## 3. Legacy Milestone Renames

The old mapping accuracy roadmap milestone IDs are no longer the active P0.7/P0.8 IDs.

Use these names instead:

| Legacy ID | Legacy meaning | New reference name | Current disposition |
|---|---|---|---|
| Legacy P0.7 | Reject Attachment Review Queue | BC-RJ-1 | Paused / superseded by entity-target redesign priority |
| Legacy P0.8 | P0.1/P0.2 closeout and V1 parity gate | BC-V1-CLOSEOUT | Paused until after P1.0 |

Important:

```text
Do not implement Legacy P0.7 when a prompt asks for P0.7.
P0.7 now means Entity Resolver V2 Dry Run.
```

---

## 4. Implementation Rule

When implementing the next phase:

```text
P0.7 = Entity Resolver V2 Dry Run
```

Do not interpret P0.7 as:

```text
Reject Attachment Review Queue
```

Reject attachment work may continue later under:

```text
BC-RJ-1
```

V1 parity closeout may continue later under:

```text
BC-V1-CLOSEOUT
```

---

## 5. Current Execution Order

Use this order:

```text
1. P0.7 Entity Resolver V2 Dry Run
2. P0.8 Target Profile Model
3. P0.9 Backfill / Migration Dry Run
4. P1.0 Controlled Switch to Resolver V2 + Target Profiles
5. BC-RJ-1 Reject Attachment Review Queue if still needed
6. BC-V1-CLOSEOUT after new model is stable
```

---

## 6. Safety Rules

During P0.7 to P1.0:

```text
Do not update production_outputs.entity_id without approved dry-run.
Do not switch dashboard KPI behavior before KPI compare is reviewed.
Do not delete old aliases.
Do not delete conditional rules.
Do not delete old detailed entities.
Do not create broad/global aliases to force ambiguous mapping.
```

---

## 7. Prompt Guardrail

Any implementation prompt should include:

```text
Milestone namespace note:
P0.7 means Entity Resolver V2 Dry Run.
Legacy P0.7 Reject Attachment Review Queue is renamed to BC-RJ-1 and is not part of this task.
```

---

## 8. Documentation Maintenance

When a legacy roadmap file mentions old P0.7 or old P0.8, it should include a note that those IDs are legacy and renamed.

Do not delete old roadmap content unless explicitly requested. Keep it for historical traceability.
"""

write(docs / "BC_MILESTONE_NAMESPACE.md", namespace_doc)

# ---------------------------------------------------------------------------
# 2) Patch redesign roadmap with conflict note
# ---------------------------------------------------------------------------

roadmap_path = docs / "BC_ENTITY_TARGET_REDESIGN_ROADMAP.md"
roadmap_text = read(roadmap_path)
if roadmap_text:
    start = "<!-- BC_MILESTONE_NAMESPACE_NOTE_START -->"
    end = "<!-- BC_MILESTONE_NAMESPACE_NOTE_END -->"
    block = f"""{start}

## Milestone Namespace Note

Current active meaning:

```text
P0.7 = Entity Resolver V2 Dry Run
P0.8 = Target Profile Model
P0.9 = Backfill / Migration Dry Run
P1.0 = Controlled Switch
```

Legacy mapping accuracy roadmap conflict:

```text
Legacy P0.7 = Reject Attachment Review Queue
Legacy P0.8 = V1 parity closeout
```

Those legacy meanings are renamed for traceability:

```text
Legacy P0.7 -> BC-RJ-1
Legacy P0.8 -> BC-V1-CLOSEOUT
```

See:

```text
docs/BC_MILESTONE_NAMESPACE.md
```

{end}
"""
    roadmap_text = replace_block(roadmap_text, start, end, block)
    write(roadmap_path, roadmap_text)

# ---------------------------------------------------------------------------
# 3) Patch operations with conflict note
# ---------------------------------------------------------------------------

ops_path = docs / "OPERATIONS.md"
ops_text = read(ops_path)
start = "<!-- BC_MILESTONE_CONFLICT_RESOLUTION_START -->"
end = "<!-- BC_MILESTONE_CONFLICT_RESOLUTION_END -->"
block = f"""{start}

## Business Central Milestone Conflict Resolution

Use `docs/BC_MILESTONE_NAMESPACE.md` as the source of truth for Business Central milestone IDs.

Active roadmap:

```text
P0.7 = Entity Resolver V2 Dry Run
P0.8 = Target Profile Model
P0.9 = Backfill / Migration Dry Run
P1.0 = Controlled Switch to Resolver V2 + Target Profiles
```

Legacy roadmap references:

```text
Legacy P0.7 Reject Attachment Review Queue -> BC-RJ-1
Legacy P0.8 V1 parity closeout -> BC-V1-CLOSEOUT
```

Operational rule:

```text
When a prompt says P0.7, implement Entity Resolver V2 Dry Run, not the legacy reject attachment queue.
```

{end}
"""
ops_text = replace_block(ops_text, start, end, block)
write(ops_path, ops_text)

# ---------------------------------------------------------------------------
# 4) Add legacy warning to old roadmap docs if they mention legacy P0.7/P0.8
# ---------------------------------------------------------------------------

warning_start = "<!-- LEGACY_BC_ROADMAP_ID_WARNING_START -->"
warning_end = "<!-- LEGACY_BC_ROADMAP_ID_WARNING_END -->"
warning = f"""{warning_start}

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

{warning_end}
"""

for path in docs.glob("*.md"):
    if path.name in {
        "BC_MILESTONE_NAMESPACE.md",
        "BC_ENTITY_TARGET_REDESIGN_ROADMAP.md",
        "BC_ENTITY_RESOLVER_V2_DESIGN.md",
        "BC_TARGET_PROFILES.md",
        "BC_ENTITY_TARGET_MIGRATION_PLAN.md",
        "BC_ENTITY_TARGET_RELEASE_NOTES.md",
    }:
        continue

    text = read(path)
    lower = text.lower()

    looks_like_legacy_p07 = ("p0.7" in lower and "reject" in lower and "attachment" in lower)
    looks_like_legacy_p08 = ("p0.8" in lower and ("closeout" in lower or "parity" in lower))

    if not (looks_like_legacy_p07 or looks_like_legacy_p08):
        continue

    if warning_start in text and warning_end in text:
        text = replace_block(text, warning_start, warning_end, warning)
    else:
        # Put warning after first top-level title if possible.
        lines = text.splitlines()
        inserted = False
        for i, line in enumerate(lines):
            if line.startswith("# "):
                lines.insert(i + 1, "")
                lines.insert(i + 2, warning.rstrip())
                inserted = True
                break
        if inserted:
            text = "\n".join(lines) + "\n"
        else:
            text = warning.rstrip() + "\n\n" + text

    write(path, text)

# ---------------------------------------------------------------------------
# 5) If milestone implementation status doc exists in repo, patch it too
# ---------------------------------------------------------------------------

status_path = docs / "MILESTONE_IMPLEMENTATION_STATUS.md"
if status_path.exists():
    status_text = read(status_path)
    start = "<!-- BC_MILESTONE_CONFLICT_STATUS_START -->"
    end = "<!-- BC_MILESTONE_CONFLICT_STATUS_END -->"
    block = f"""{start}

## Resolved Milestone ID Conflict

The roadmap ID conflict is resolved as follows:

| Previous reference | New reference | Meaning |
|---|---|---|
| Legacy P0.7 | BC-RJ-1 | Reject Attachment Review Queue |
| Legacy P0.8 | BC-V1-CLOSEOUT | V1 parity closeout |
| Active P0.7 | P0.7 | Entity Resolver V2 Dry Run |
| Active P0.8 | P0.8 | Target Profile Model |
| Active P0.9 | P0.9 | Backfill / Migration Dry Run |
| Active P1.0 | P1.0 | Controlled Switch |

Use `docs/BC_MILESTONE_NAMESPACE.md` as the source of truth.

{end}
"""
    status_text = replace_block(status_text, start, end, block)
    write(status_path, status_text)

print("Patched milestone conflict docs.")
PY

echo ""
echo "Docs patched:"
echo "- docs/BC_MILESTONE_NAMESPACE.md"
echo "- docs/OPERATIONS.md"
echo "- docs/BC_ENTITY_TARGET_REDESIGN_ROADMAP.md if present"
echo "- legacy docs mentioning old P0.7/P0.8 if detected"
echo ""

echo "Diff check:"
git diff --check -- docs

echo ""
echo "Status:"
git status --short docs

echo ""
echo "Diff stat:"
git diff --stat -- docs
