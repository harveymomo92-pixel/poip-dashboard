# Business Central Entity & Target Migration Plan

Status: P0.9 planning placeholder  
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

```text
.tmp/bc-entity-v2-backfill-dry-run.csv
.tmp/bc-entity-v2-backfill-dry-run.json
.tmp/bc-target-profile-backfill-dry-run.csv
.tmp/bc-target-profile-backfill-dry-run.json
```

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

---

## 5. Rollback

Preferred rollback:

```text
Switch feature flags back to v1.
Keep old aliases and conditional rules until transition is stable.
```

DB restore should only be used if data migration was committed and cannot be reverted safely.
