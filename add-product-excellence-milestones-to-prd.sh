#!/usr/bin/env bash
set -euo pipefail

PRD_PATH="${1:-docs/PRD.md}"

if [[ ! -f "$PRD_PATH" ]]; then
  echo "ERROR: $PRD_PATH tidak ditemukan."
  echo "Jalankan dari root repo:"
  echo "  cd ~/dev/ppic-output-intelligence"
  echo "  bash add-product-excellence-milestones-to-prd.sh"
  exit 1
fi

BACKUP_PATH="${PRD_PATH}.bak-product-excellence-$(date +%Y%m%d-%H%M%S)"
cp "$PRD_PATH" "$BACKUP_PATH"

python3 - "$PRD_PATH" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text()

# This patch is designed to run after the Design System/UX milestone patch.
if not (
    "Design System, UX Workflow, and Production Polish" in text
    or "Design System and UI/UX Production Polish" in text
):
    raise SystemExit(
        "ERROR: Milestone Design System/UX belum ditemukan.\n"
        "Jalankan patch add-design-system-milestone.sh dan add-ux-production-polish-to-prd.sh dulu, lalu jalankan script ini lagi."
    )

# Avoid duplicate insertion.
if "Milestone 11 — Master Data and Mapping Center" in text:
    print("Product excellence milestones already exist. Skip insertion.")
else:
    # Find the Production Hardening heading as insertion anchor.
    prod_heading_match = re.search(
        r"^## 27\.\d+ Milestone \d+ — Production Hardening and UAT\s*$",
        text,
        flags=re.MULTILINE,
    )
    if not prod_heading_match:
        prod_heading_match = re.search(
            r"^## 27\.\d+ Milestone \d+ — Production Readiness Pack, Hardening, and UAT\s*$",
            text,
            flags=re.MULTILINE,
        )

    if not prod_heading_match:
        raise SystemExit("ERROR: heading Production Hardening/UAT tidak ditemukan.")

    product_excellence_sections = r"""## 27.12 Milestone 11 — Master Data and Mapping Center

### Goal

Create a reliable master data and alias mapping foundation so OData sync, WhatsApp parser, Import Center, dashboard KPI, downtime, targets, and data quality features use consistent operational entities.

### Why This Matters

Production data usually arrives with inconsistent machine, item, line, shift, and unit names. Without a mapping center, the dashboard may show duplicated machines, missing targets, incorrect reject conversion, or unresolved data quality issues.

### Tasks

- Add master data model and UI for:
  - machines/entities
  - production lines
  - items/SKUs
  - shifts and shift calendar
  - item gross weight mapping
  - unit conversion mapping
  - source aliases from OData, Import Center, WhatsApp Parser, and manual input
- Add alias resolution logic for machine/entity, item, line, shift, unit, and source-specific codes.
- Add validation so duplicated aliases cannot point to conflicting master records.
- Add active/inactive status for master records.
- Add audit logs for create, update, deactivate, and alias changes.
- Add data quality integration so unknown machine, unknown item, missing gross weight, and unknown unit issues can be resolved by mapping them to master data.
- Add UI pages under Settings or Master Data.
- Preserve existing raw source values for traceability.

### Suggested API Endpoints

- `GET /api/v1/master/machines`
- `POST /api/v1/master/machines`
- `PATCH /api/v1/master/machines/:id`
- `GET /api/v1/master/items`
- `POST /api/v1/master/items`
- `PATCH /api/v1/master/items/:id`
- `GET /api/v1/master/shifts`
- `POST /api/v1/master/shifts`
- `PATCH /api/v1/master/shifts/:id`
- `GET /api/v1/master/aliases`
- `POST /api/v1/master/aliases`
- `PATCH /api/v1/master/aliases/:id`
- `POST /api/v1/master/aliases/resolve-issue`

### Prompt

```text
Implement Milestone 11 Master Data and Mapping Center.

Current status:
- Auth/RBAC, sync, dashboard, targets, downtime, WhatsApp Parser, Import Center, Data Quality, and UI/UX polish may already exist.
- Do not break existing API contracts or dashboard behavior.
- Add master data and alias mapping as a foundation for consistent operational data.

Build master data for machines/entities, items/SKUs, production lines, shifts, item gross weight mapping, unit conversion, and source aliases. Add alias resolution for OData, Import Center, WhatsApp Parser, and manual input.

Add API endpoints, UI pages, validation, audit logs, and data quality integration. Unknown machine/item/unit/gross weight issues should be easier to resolve through mapping.

Use Drizzle or parameterized SQL only. Do not hardcode production data. Do not use dependency "latest".

Run pnpm lint, pnpm typecheck, pnpm test, and pnpm build before finishing.
```

### Acceptance Criteria

- Users can manage machines/entities, items, shifts, units, gross weights, and aliases.
- Alias mapping resolves inconsistent source names into canonical master records.
- Duplicate/conflicting aliases are prevented.
- Unknown data quality issues can be resolved through master data mapping.
- Existing sync, import, parser, target, downtime, and dashboard behavior still works.
- Audit logs capture master data changes.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

---

## 27.13 Milestone 12 — Data Lineage and Source Traceability

### Goal

Make dashboard and operational data trustworthy by allowing users to trace every important KPI, row, and issue back to its source.

### Tasks

- Add lineage fields or read models where needed:
  - source type: OData, Import, WhatsApp Parser, Manual
  - source run ID
  - source row ID
  - natural key
  - row hash
  - created/committed by
  - committed at
  - latest audit event
- Add drill-down APIs for KPI source rows.
- Add source traceability panels in dashboard, output list, downtime detail, target detail, import run detail, parser run detail, and data quality issue detail.
- Add "View source rows" actions from dashboard KPI cards and insight cards.
- Add source badges consistently across tables and details.
- Preserve raw source payload/reference where safe, without exposing secrets.
- Add audit context for corrections and status changes.

### Suggested API Endpoints

- `GET /api/v1/lineage/outputs`
- `GET /api/v1/lineage/downtime`
- `GET /api/v1/lineage/kpi/:metric`
- `GET /api/v1/lineage/issues/:id`
- `GET /api/v1/lineage/entities/:type/:id`

### Prompt

```text
Implement Milestone 12 Data Lineage and Source Traceability.

Goal:
Every important number and operational row should be traceable to its source. Users should be able to click KPI cards, output rows, downtime events, import/parser rows, and data quality issues to understand where the data came from, when it entered the system, and who/what committed it.

Add source type, source run, source row, natural key, hash, actor, timestamp, and audit context where needed. Add drill-down APIs and UI panels.

Do not expose secrets or raw credentials. Do not break existing API contracts. Use real source data only, no fake lineage.

Run pnpm lint, pnpm typecheck, pnpm test, and pnpm build.
```

### Acceptance Criteria

- KPI values can be traced to source rows.
- Source badges are visible in operational tables.
- Import/parser/sync/manual origins are distinguishable.
- Data quality issues show source context and recommended next action.
- Audit trail is connected to entity detail where feasible.
- No secrets or sensitive tokens are exposed.
- All validation commands pass.

---

## 27.14 Milestone 13 — Notification and Alert Center

### Goal

Create in-app operational alerts so users know when sync fails, data is stale, target is missing, downtime remains open, reject rate is high, or critical data quality issues appear.

### Tasks

- Add notification/alert data model if needed.
- Add alert rules for:
  - sync failure
  - stale data
  - never-synced data
  - missing approved target
  - open downtime over threshold
  - reject rate over threshold
  - high invalid row count after import/parser preview
  - critical data quality issues
- Add in-app Notification Center.
- Add badge counts in sidebar/topbar.
- Add dashboard alert cards for critical operational states.
- Add mark as read/unread and resolve/dismiss where appropriate.
- Add user-specific and role-based notification visibility.
- Add audit log for notification rule changes if rules are configurable.
- Keep external notifications optional for future extension.

### Suggested API Endpoints

- `GET /api/v1/notifications`
- `GET /api/v1/notifications/summary`
- `POST /api/v1/notifications/:id/read`
- `POST /api/v1/notifications/read-all`
- `POST /api/v1/alerts/evaluate`
- `GET /api/v1/alert-rules`
- `PATCH /api/v1/alert-rules/:id`

### Prompt

```text
Implement Milestone 13 Notification and Alert Center.

Build in-app alerts for sync failure, stale data, missing target, long-open downtime, high reject rate, invalid import/parser rows, and critical data quality issues.

Add Notification Center UI, sidebar/topbar badge counts, dashboard alert cards, read/unread state, and role-aware visibility. Keep external email/WhatsApp/Slack notifications out of scope unless trivial and explicitly optional.

Do not spam users. Alerts should be deduplicated and operationally useful.

Run pnpm lint, pnpm typecheck, pnpm test, and pnpm build.
```

### Acceptance Criteria

- Critical operational states create visible alerts.
- Users can see and mark notifications as read.
- Dashboard shows important alert cards.
- Alerts are deduplicated and not noisy.
- Permissions and roles are respected.
- All validation commands pass.

---

## 27.15 Milestone 14 — Human-Readable Audit Timeline and Activity Feed

### Goal

Turn technical audit logs into understandable activity history for operational users and administrators.

### Tasks

- Build human-readable audit log messages.
- Add global Activity Feed page.
- Add entity-level Activity Timeline on detail pages:
  - target detail
  - downtime detail
  - import run detail
  - parser run detail
  - data quality issue detail
  - user/admin actions
- Add filters for actor, module, action, entity type, entity ID, and date range.
- Show before/after values in readable format.
- Hide or redact sensitive fields.
- Add friendly activity summaries, for example:
  - "Admin approved target for Machine A on 2026-06-23."
  - "Sari closed downtime MC-02 after 47 minutes."
  - "Import Center committed 82 valid rows and skipped 5 invalid rows."
  - "OData sync completed with 2 data quality warnings."
- Add audit detail drawer/panel.
- Keep raw audit data available for admin users where appropriate.

### Suggested API Endpoints

- `GET /api/v1/activity`
- `GET /api/v1/activity/entities/:type/:id`
- `GET /api/v1/audit-logs`
- `GET /api/v1/audit-logs/:id`

### Prompt

```text
Implement Milestone 14 Human-Readable Audit Timeline and Activity Feed.

Convert existing audit logs into a user-friendly Activity Feed and entity-level timelines. Add readable messages, filters, before/after value display, redaction for sensitive fields, and detail panels.

Do not remove raw audit logs. Do not expose secrets. Keep audit logs append-only.

Run pnpm lint, pnpm typecheck, pnpm test, and pnpm build.
```

### Acceptance Criteria

- Audit logs are readable by non-developer users.
- Entity details show relevant activity history.
- Sensitive fields are hidden/redacted.
- Filters work.
- Existing audit data remains intact.
- All validation commands pass.

---

## 27.16 Milestone 15 — UAT Mode, Demo Data, and Guided Testing Pack

### Goal

Make the project easy to test, demo, and validate with stakeholders using realistic sample data and guided scripts.

### Tasks

- Add demo/UAT seed mode.
- Add realistic sample data:
  - users and roles
  - machines/entities
  - items/SKUs
  - approved targets
  - production outputs
  - open and closed downtime events
  - import runs
  - WhatsApp parser runs
  - data quality issues
  - audit/activity events
  - notifications/alerts
- Add sample files:
  - downtime CSV
  - downtime XLSX if feasible
  - production output CSV if supported
  - WhatsApp sample text
- Add documentation:
  - `docs/UAT.md`
  - `docs/DEMO_SCRIPT.md`
  - `docs/SAMPLE_DATA.md`
  - `docs/QA_CHECKLIST.md`
- Add reset script for demo data in local development only.
- Add guided manual test checklist for stakeholders.
- Ensure demo mode cannot run accidentally in production.

### Suggested Commands

- `pnpm db:seed:demo`
- `pnpm demo:reset`
- `pnpm demo:check`

### Prompt

```text
Implement Milestone 15 UAT Mode, Demo Data, and Guided Testing Pack.

Create realistic demo/UAT data and documentation so the system can be tested and presented easily. Add seed scripts, sample import/parser files, demo reset command, UAT guide, demo script, sample data guide, and QA checklist.

Demo/reset scripts must be safe and must not run accidentally in production.

Run pnpm lint, pnpm typecheck, pnpm test, and pnpm build.
```

### Acceptance Criteria

- Demo data can be seeded locally.
- Stakeholders can follow a documented UAT script.
- Sample import/parser files are available.
- Demo reset is safe and clearly limited to non-production.
- Dashboard and core workflows look populated and realistic in demo mode.
- All validation commands pass.

---

## 27.17 Milestone 16 — Critical Flow E2E Automation

### Goal

Add browser-level regression protection for critical workflows so UI/UX polish and future refactors do not break core usage.

### Tasks

- Add Playwright E2E setup.
- Add E2E environment configuration.
- Add stable test data setup/teardown.
- Add critical flow tests:
  - login
  - view dashboard
  - trigger mock sync
  - create target
  - approve target
  - create downtime
  - close downtime
  - preview WhatsApp parser
  - commit WhatsApp parser
  - preview import
  - commit import
  - view data quality issues
  - view audit/activity logs
  - view notifications if implemented
- Add smoke test subset for CI.
- Add documentation for running E2E tests locally and in CI.
- Keep tests deterministic and not dependent on external services.

### Suggested Commands

- `pnpm e2e`
- `pnpm e2e:ui`
- `pnpm e2e:smoke`

### Prompt

```text
Implement Milestone 16 Critical Flow E2E Automation.

Add Playwright-based E2E tests for login, dashboard, mock sync, target create/approve, downtime create/close, WA parser preview/commit, import preview/commit, data quality, audit/activity, and notifications where available.

Tests must be deterministic, local-friendly, and CI-friendly. Use demo/UAT data setup where appropriate.

Do not use dependency "latest". Run pnpm lint, pnpm typecheck, pnpm test, pnpm build, and pnpm e2e.
```

### Acceptance Criteria

- Playwright is configured.
- Critical flows are covered.
- E2E tests can run locally.
- CI can run smoke E2E tests.
- Test data setup is deterministic.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm e2e` pass.

---

"""

    insert_pos = prod_heading_match.start()
    text = text[:insert_pos] + product_excellence_sections + text[insert_pos:]

# Rename/renumber Production Hardening section after inserting new sections.
text = re.sub(
    r"^## 27\.\d+ Milestone \d+ — Production Hardening and UAT\s*$",
    "## 27.18 Milestone 17 — Production Readiness Pack, Hardening, and UAT",
    text,
    count=1,
    flags=re.MULTILINE,
)

text = text.replace(
    "Implement Milestone 11 Production Hardening.",
    "Implement Milestone 17 Production Readiness Pack, Hardening, and UAT.",
)
text = text.replace(
    "Implement Milestone 10 Production Hardening.",
    "Implement Milestone 17 Production Readiness Pack, Hardening, and UAT.",
)

# Expand the existing production hardening section once.
if "### Production Readiness Pack Requirements" not in text:
    prod_start = text.find("## 27.18 Milestone 17 — Production Readiness Pack, Hardening, and UAT")
    if prod_start != -1:
        prompt_pos = text.find("### Prompt", prod_start)
        if prompt_pos != -1:
            readiness = r"""### Production Readiness Pack Requirements

Production readiness must include operational runbooks and scripts, not only Docker configuration.

Required additions:

- `docker-compose.prod.yml`
- reverse proxy example configuration
- `.env.production.example`
- environment variable checklist
- database backup script
- database restore script
- smoke test script
- healthcheck script
- deployment guide
- rollback guide
- migration guide
- operations guide
- backup and restore guide
- performance seed script if feasible
- production readiness checklist

Recommended files:

- `docs/DEPLOYMENT.md`
- `docs/OPERATIONS.md`
- `docs/BACKUP_RESTORE.md`
- `docs/ENVIRONMENT.md`
- `docs/ROLLBACK.md`
- `docs/PRODUCTION_CHECKLIST.md`
- `scripts/smoke-test.sh`
- `scripts/backup-db.sh`
- `scripts/restore-db.sh`
- `scripts/healthcheck.sh`

Acceptance additions:

- A fresh operator can deploy the system using documentation.
- Backup and restore commands are documented and locally testable.
- Smoke tests verify API, web, database, Redis, auth, and core pages.
- Rollback path is documented.
- No production secrets are committed.

---

"""
            text = text[:prompt_pos] + readiness + text[prompt_pos:]

# Update roadmap sequence if the compact list exists.
roadmap_old = """10. Design system, UX workflow, and production polish.
11. Data quality/audit/health.
12. Production hardening.
13. UAT/cutover."""

roadmap_new = """10. Design system, UX workflow, and production polish.
11. Data quality/audit/health.
12. Master data and mapping center.
13. Data lineage and source traceability.
14. Notification and alert center.
15. Human-readable audit timeline and activity feed.
16. UAT mode, demo data, and guided testing pack.
17. Critical flow E2E automation.
18. Production readiness pack, hardening, and UAT.
19. UAT/cutover."""

if roadmap_old in text:
    text = text.replace(roadmap_old, roadmap_new, 1)
else:
    # Fallback for the non-UX wording.
    roadmap_old_alt = """10. Design system and UI/UX production polish.
11. Data quality/audit/health.
12. Production hardening.
13. UAT/cutover."""
    if roadmap_old_alt in text:
        text = text.replace(roadmap_old_alt, roadmap_new, 1)
    elif "Master data and mapping center." not in text:
        print("Warning: compact roadmap list not found. Main milestone sections were still updated.")

# Add an overall excellence note before the "Do not build AI..." line.
note_marker = "Do not build AI Insight Assistant before core sync, dashboard, downtime, audit, and data quality are stable."
note = """The platform should not be considered exceptional until the following product excellence foundations are implemented: master data mapping, source lineage, notification center, human-readable activity timeline, demo/UAT pack, E2E automation, and production readiness pack.

"""
if note_marker in text and note.strip() not in text:
    text = text.replace(note_marker, note + note_marker, 1)

path.write_text(text)
print(f"Updated {path}")
PY

echo
echo "Backup dibuat:"
echo "  $BACKUP_PATH"
echo
echo "Cek milestone baru:"
grep -n "Milestone .*Master Data\|Milestone .*Data Lineage\|Milestone .*Notification\|Milestone .*Human-Readable\|Milestone .*UAT Mode\|Milestone .*Critical Flow\|Milestone .*Production Readiness" "$PRD_PATH" || true
echo
echo "Cek roadmap:"
grep -n "Master data and mapping\|Data lineage and source\|Notification and alert\|Human-readable audit\|Critical flow E2E\|Production readiness pack" "$PRD_PATH" || true
echo
echo "Diff:"
git diff -- "$PRD_PATH" || true

echo
echo "Jika diff sudah benar, commit dengan:"
echo "  git add $PRD_PATH"
echo "  git commit -m \"docs: add product excellence milestones\""
echo
echo "Jika ingin rollback:"
echo "  cp \"$BACKUP_PATH\" \"$PRD_PATH\""
