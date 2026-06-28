<!-- P0.9M_AUTHORITATIVE_MASTER_START -->

# P0.9m Strategic Pivot — Authoritative Entity & Target Master

## Decision

Starting from P0.9m, the project will no longer treat the old/current entity mapping and old target naming as the source of truth.

The new source of truth will be:

1. Authoritative canonical entity master.
2. Authoritative source-to-entity mapping based on reviewed Business Central OData fields.
3. Authoritative target profile master.

The old/current entity and old target-like entity names will remain available only as legacy evidence for audit, comparison, and conflict detection.

## Why This Change Is Needed

During P0.9f–P0.9l, the review pipeline showed that legacy entity and target data mixed several concepts into one layer:

- production entity,
- target variant,
- reject attachment,
- sparepart/material movement,
- non-production movement,
- wrong size or product variant mapping,
- source data gaps.

Because of this, continuing to repair the old mapping directly would be inefficient and risky. The better approach is to keep the existing safety/reporting pipeline, but pivot the source of truth to a reviewed authoritative master.

## New Rule

Current/legacy entity values are not deleted, but they are demoted to evidence only.

| Data Source | New Role |
|---|---|
| current_entity_code | Legacy evidence / comparison only |
| old target variant in entity name | Legacy evidence / target-profile clue only |
| old aliases | Legacy evidence / conflict clue only |
| old target naming | Legacy evidence only |
| authoritative canonical entity master | Source of truth |
| authoritative source-to-entity map | Source of truth |
| authoritative target profile master | Source of truth |

## Migration Direction

The new migration direction is:

```text
Business Central OData row
-> scope classifier
-> reviewed OData source field
-> authoritative source-to-entity map
-> authoritative canonical entity
-> authoritative target profile
-> KPI / future module calculation
```

The preferred identity source remains:

1. `gProdOrRotLine_Description`
2. fallback: `gProdOrRotLine_No`
3. fallback only: `Machine_Center_No`

`Machine_Center_No` must not become the primary identity source unless explicitly approved as fallback mapping.

## P1.0 Gate

P1.0 remains blocked until:

1. authoritative entity master is provided and validated,
2. authoritative source-to-entity mapping is provided and validated,
3. authoritative target profile master is provided and validated,
4. coverage dry-run proves which rows are safely mapped,
5. KPI comparison is reviewed,
6. no unsafe alias/target/profile mutation is required.

## Safety

P0.9m is intake/validation/export only.

It must not:

- update database rows,
- update `production_outputs.entity_id`,
- insert/update/delete `target_profiles`,
- create/update/delete aliases,
- change conditional rules,
- switch dashboard logic,
- enable P1.0.

## Next Milestone

P0.9m implements:

```bash
pnpm bc:authoritative-master-intake
```

This command prepares and validates authoritative master input templates without applying anything. If the input files are absent or empty, it creates `.tmp/bc-authoritative-master-input/` templates and working CSVs, writes `.tmp/bc-authoritative-master-intake/`, returns `AWAITING_MASTER_INPUT`, and keeps P1.0 blocked.

P0.9m output includes normalized master CSVs, validation errors/warnings, source coverage preview, target profile coverage preview, unmapped source values, legacy conflict evidence, and a template manifest. Coverage uses only the authoritative source-to-entity map as success mapping; current/legacy entity values appear only as evidence.

<!-- P0.9M_AUTHORITATIVE_MASTER_END -->

# Business Central Entity & Target Migration Plan

Status: P0.9 dry-run and P0.9a review gate implemented
Related roadmap: `docs/BC_ENTITY_TARGET_REDESIGN_ROADMAP.md`

---

## 1. Purpose

This document tracks the safe migration plan from old detailed entities to canonical entities and target profiles.

No destructive migration should happen without dry-run approval.

---

## 2. Required Pre-Migration Artifacts

Before migration:

```text
DB backup path
current git commit hash
P0.7 dry-run report
P0.8 target profile dry-run report
P0.9 backfill dry-run report
rollback plan
approval note
```

---

## 3. Required Dry Run Outputs

Commands:

```bash
pnpm bc:entity-v2-backfill-dry-run
pnpm bc:target-profile-backfill-dry-run
```

Output files:

```text
.tmp/bc-entity-v2-backfill-dry-run.csv
.tmp/bc-entity-v2-backfill-dry-run.json
.tmp/bc-target-profile-backfill-dry-run.csv
.tmp/bc-target-profile-backfill-dry-run.json
```

These reports are export-only. They must not update `production_outputs.entity_id`, insert into `target_profiles`, create canonical entities, change aliases, change conditional rules, or switch dashboard lookup.

---

## 4. Risk Classification

Low risk:

```text
Only detailed entity name collapses into canonical parent.
Quantity and KPI classification remain unchanged.
```

Medium risk:

```text
Entity changes but target bucket is safely inferred.
```

High risk:

```text
Multiple possible entities.
Multiple target profiles.
Currently mapped but v2 unmapped.
Machine description conflicts with machine center.
```

High-risk rows must not be automatically migrated.

Backfill actions in the entity dry-run:

```text
NO_CHANGE
PROPOSE_CANONICAL_ENTITY_COLLAPSE
PROPOSE_CANONICAL_ENTITY_CREATION
REVIEW_ALIAS_CONFLICT
REVIEW_DATA_SOURCE_GAP
SKIP_HIGH_RISK
```

Target profile candidates always use:

```text
approval_status = draft
source = p0.9-dry-run
```

If an old target quantity is missing or not safely available, the target profile dry-run leaves `proposed_target_qty` blank and recommends manual fill before migration.

---

## 5. Report Interpretation

The entity backfill report separates:

```text
safeCollapseCandidates
canonicalEntityCreationCandidates
aliasConflictCandidates
topHighRiskGroups
```

The target profile report separates:

```text
topProposedTargetProfiles
topMissingTargetQtyGroups
topHighRiskGroups
```

Both reports include family summaries for OMSO, POLYPRINT, VFINE, LONGSUN, BORCH, THERMO, NEWDO, CAI, and REPACKING.

---

## 6. P0.9a High-Risk Review Gate

P0.9a turns the dry-run findings into a P1.0 gate:

```bash
pnpm bc:high-risk-review-plan
pnpm bc:kpi-compare-v1-v2
```

Outputs:

```text
.tmp/bc-high-risk-review-plan.csv
.tmp/bc-high-risk-review-plan.json
.tmp/bc-kpi-compare-v1-v2.csv
.tmp/bc-kpi-compare-v1-v2.json
```

The gate must remain `BLOCKED` while any high-risk entity or target profile groups remain unresolved, while `target_profiles` has zero active approved profiles, while most resolver-v2 rows have no active target profile, or while KPI comparison is not ready and reviewed.

P0.9c adds Business Central data scope to every dry-run and review report. P1.0 blockers use `blocks_p10_after_scope`, while the original blocker is retained as `p10Blocker`/pre-scope counts for traceability. Rows classified as `OUT_OF_CURRENT_KPI_SCOPE` remain exported for future-use review but do not block the dashboard switch by themselves. Rows classified as `UNKNOWN_SCOPE_REVIEW`, `OUTPUT_KPI_OK_SCOPE`, or `OUTPUT_KPI_REJECT_SCOPE` can still block P1.0 when their risk is material.

P0.9a is still export-only. It does not update rows, insert target profiles, create canonical entities, alter aliases, alter conditional rules, or switch dashboard lookup.

Do not fix P0.9a blockers by creating broad/global aliases. Resolve them through reviewed canonical entity planning, alias cleanup, source-data fixes, target profile draft creation, and later manual approval.

---

## 7. P0.9b Resolution Package

P0.9b packages the P0.9/P0.9a findings for human review only:

```bash
pnpm bc:resolution-package
```

Output folder:

```text
.tmp/bc-resolution-package/
```

Files:

```text
summary.json
canonical-entity-creation-plan.csv
alias-cleanup-review-plan.csv
target-profile-seed-draft-plan.csv
manual-approval-queue.csv
blocked-groups-checklist.csv
README.md
```

The package is not SQL and must not be applied directly to production. It is a review template for canonical entity planning, alias cleanup review, target profile draft preparation, manual approval, and blocker tracking.

The package includes scope columns in the manual review queue and summarizes retained future-use rows with `futureUseDomainCounts`, `p10BlockingRowsBeforeScope`, `p10BlockingRowsAfterScope`, and `excludedFromP10ButRetainedRows`.

P1.0 remains blocked until the checklist is resolved, target profiles have reviewed active approved coverage, P0.9/P0.9a are rerun, and KPI comparison is reviewed.

---

## 8. P0.9d Unknown Scope Evidence Profiler

P0.9d explains remaining `UNKNOWN_SCOPE_REVIEW` rows before any classifier, alias, or target-profile changes:

```bash
pnpm bc:unknown-scope-profile
```

Outputs:

```text
.tmp/bc-unknown-scope-profile.csv
.tmp/bc-unknown-scope-profile.json
```

The profiler groups unknown rows by entry type, location, item category, unit, document prefix, item prefix, source value, current entity, target bucket, machine center, and entity-source status. It may suggest future classifier rule candidates with confidence levels, but it does not reclassify source rows.

P0.9d is reporting-only. Unknown rows that block P1.0 remain blocking until a later reviewed classifier change is implemented and the dry-run gates are rerun.

---

## 9. P0.9e High-Confidence Scope Rules

P0.9e implements only deterministic high-confidence rules discovered by P0.9d:

```text
TRANSFER    -> OUT_OF_CURRENT_KPI_SCOPE / TRANSFER_OR_INVENTORY_MOVEMENT
CONSUMPTION -> OUT_OF_CURRENT_KPI_SCOPE / CONSUMPTION_OR_MATERIAL_USAGE
SALE        -> OUT_OF_CURRENT_KPI_SCOPE / SALES_REPORT
PURCHASE    -> OUT_OF_CURRENT_KPI_SCOPE / PURCHASE_OR_RECEIVING
```

These rows remain exported in every report and are excluded only from P1.0 blocker calculation via `blocks_p10_after_scope=false`. P0.9e does not implement medium/low candidates, including `NEGATIVE ADJMT.`, `POSITIVE ADJMT.`, or sparepart/material text-pattern rules.

---

## 10. P0.9f/P0.9g/P0.9h/P0.9i/P0.9j Scoped Review and Apply Dry-Run

P0.9f narrows material/sparepart scope and packages remaining true P1.0 blockers:

```bash
pnpm bc:scoped-blocker-package
```

P0.9g groups those true blockers into reviewed decision families:

```bash
pnpm bc:scoped-decision-review
```

Output folder:

```text
.tmp/bc-scoped-decision-review/
```

P0.9g writes `decision-board.csv`, family-specific review CSVs, `entity-family-rollup.csv`, `next-action-checklist.csv`, `summary.json`, and `README.md`.

P0.9h validates reviewed decision CSVs before any later execution planning:

```bash
pnpm bc:scoped-decision-validate
```

Output folder:

```text
.tmp/bc-scoped-decision-validation/
```

P0.9h writes `validation-errors.csv`, `validation-warnings.csv`, `approved-decision-summary.csv`, `pending-decision-summary.csv`, `blocked-execution-plan.csv`, `summary.json`, and `README.md`.

P0.9i prepares editable reviewer approval workbooks from the decision review and validation outputs:

```bash
pnpm bc:scoped-decision-approval-workspace
```

Output folder:

```text
.tmp/bc-scoped-decision-approval-workspace/
```

P0.9i writes the full approval workbook, P1/P2 slices, source-data, alias/canonical, reject attachment, and target-profile templates, a reviewer checklist, an import manifest, `summary.json`, and `README.md`. It keeps `approval_status=pending`, `safe_to_auto_apply=false`, and `safe_to_seed_target_profile=false`; no decision is approved automatically.

P0.9j turns the approval workspace into an apply dry-run plan:

```bash
pnpm bc:scoped-decision-apply-dry-run
```

Output folder:

```text
.tmp/bc-scoped-decision-apply-dry-run/
```

P0.9j writes executable and blocked decision plans, category-specific dry-run CSVs, a P1.0 impact estimate, `summary.json`, `safety-report.json`, and `README.md`. Only `approval_status=approved` rows with reviewer evidence and review-only actions can become executable dry-run rows. Pending, empty, rejected, or deferred rows remain blocked.

P0.9k intakes optional human reviewer decisions without mutating the approval workspace:

```bash
pnpm bc:scoped-decision-approval-intake
```

Input folder:

```text
.tmp/bc-scoped-decision-manual-approval-input/
```

Output folder:

```text
.tmp/bc-scoped-decision-approval-intake/
```

P0.9k writes normalized, accepted, blocked, missing, duplicate, and invalid reviewer decision reports plus readiness, P1.0 gate preview, safety, `summary.json`, and `README.md`. If `reviewer-decisions.csv` is absent, it creates `reviewer-decisions.template.csv` and reports all workspace rows as missing reviewer input.

P0.9l makes the apply dry-run reviewer-input-aware: `bc:scoped-decision-apply-dry-run` now reads `.tmp/bc-scoped-decision-approval-intake/` when available and merges only accepted reviewer decisions into its dry-run input. Missing, blocked, invalid, duplicate, unknown, pending, rejected, and deferred reviewer decisions remain non-executable. The apply dry-run also writes `intake-source-summary.csv` so the reviewer input source can be audited.

P0.9m adds authoritative master intake:

```bash
pnpm bc:authoritative-master-intake
```

Input folder:

```text
.tmp/bc-authoritative-master-input/
```

Output folder:

```text
.tmp/bc-authoritative-master-intake/
```

The command validates `canonical-entities.csv`, `source-to-entity-map.csv`, and `target-profiles.csv`, creates blank templates when needed, previews coverage from existing BC reports, and keeps legacy current entity/old target names as conflict evidence only.

These packages are decision review, validation, approval-template preparation, dry-run planning, and approval intake only. They do not create aliases, canonical entities, target profiles, conditional rules, or dashboard switches. `safe_to_auto_apply` and `safe_to_seed_target_profile` default to `false`, and even accepted reviewer decisions are never applied by P0.9k/P0.9l. P1.0 remains blocked while scoped blockers, pending blocking decisions, invalid reviewed decisions, unapproved workspace rows, blocked dry-run rows, or missing/invalid reviewer input remain.

---

## 11. Rollback

Preferred rollback:

```text
Switch feature flags back to v1.
Keep old aliases and conditional rules until transition is stable.
```

DB restore should only be used if data migration was committed and cannot be reverted safely.
