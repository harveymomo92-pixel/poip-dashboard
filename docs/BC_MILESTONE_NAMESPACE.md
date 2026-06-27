# Business Central Milestone Namespace & Conflict Resolution

Status: active documentation guardrail  
Created: 2026-06-27  
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
