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

P1.0 remains blocked until the checklist is resolved, target profiles have reviewed active approved coverage, P0.9/P0.9a are rerun, and KPI comparison is reviewed.

---

## 8. Rollback

Preferred rollback:

```text
Switch feature flags back to v1.
Keep old aliases and conditional rules until transition is stable.
```

DB restore should only be used if data migration was committed and cannot be reverted safely.
