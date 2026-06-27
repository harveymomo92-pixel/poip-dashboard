# Business Central Entity & Target Redesign Roadmap

Status: planning and execution guide  
Scope: P0.7 to P1.0  
Source system: Business Central / OData ItemLedgerPPIC  
Safety rule: do not migrate or switch dashboard until dry-run reports are reviewed.

---

## 1. Why This Redesign Exists

The current Business Central mapping is too complex because target variants are embedded into entity names.

Current problematic pattern:

```text
OMSO 1-OZ - Printing 22 OZ
OMSO 1-OZ - Printing OZ < 20
OMSO 1-OZ - Printing non-OZ
POLYPRINT 2 PRINTING-OZ - 22 OZ
POLYPRINT 2 PRINTING-OZ - OZ < 20
```

This makes entity mapping depend on product bucket, item description, and machine center aliases. It causes too many special cases, conditional rules, and manual corrections.

The new design separates the concepts:

```text
Entity = physical / operational machine or production line
Target profile = target variant for that entity
Machine Center No = routing evidence, not the primary entity
Item bucket = target profile dimension
```

Example:

```text
Entity:
OMSO 1-OZ

Target profiles:
OZ_22
OZ_LT_20
REG
```

---

## 2. Core Business Rule

### 2.1 Entity

Entity should be stable and simple.

```text
Entity = canonical machine description / production line
```

Preferred Business Central source field:

```text
gProdOrRotLine_Description
```

Fallback fields:

```text
gProdOrRotLine_No
Machine_Center_No
```

### 2.2 Machine Center No

Machine Center No is not safe as primary entity because the same value can appear under multiple machine descriptions.

Known examples:

```text
VFINE-BT400 can appear under multiple V-Fine bottle sizes.
ILLIG2 can appear under THERMO ILLIG-2 and REPACKING.
LS1-24.5/27.5 can appear under multiple LONGSUN bottle sizes.
```

Therefore:

```text
Machine_Center_No = target routing evidence
```

### 2.3 Target

Target should be looked up using:

```text
entity_id
+ target_bucket
+ optional machine_center_no
+ posting_date effective range
```

Target should not force entity splitting.

---

## 3. Business Central Fields Used

Important OData fields:

```text
Entry_No
Posting_Date
Entry_Type
Document_No
Item_No
gItem_Description
Description
Item_Category_Code
Location_Code
Quantity
Unit_of_Measure_Code
Gross_Weight
gProdOrRotLine_No
gProdOrRotLine_Description
Machine_Center_No
dimcode
divcode
divname
```

Field interpretation:

| Field | Meaning | New role |
|---|---|---|
| `gProdOrRotLine_Description` | Machine Description | Primary entity source |
| `gProdOrRotLine_No` | Machine No. / production line no. | Entity fallback |
| `Machine_Center_No` | Machine center / routing | Target routing evidence |
| `gItem_Description` | Item description | Bucket inference |
| `Description` | Item description fallback | Bucket inference |
| `Item_Category_Code` | Item category | Output and item classification |
| `Entry_Type` | BC entry type | Output filtering |
| `Location_Code` | Location | Support filtering |
| `Gross_Weight` | Gross weight | Reject conversion and bucket support |

---

# P0.7 — Entity Resolver V2 Dry Run

## 4. P0.7 Goal

Create a non-destructive resolver v2 and comparison report.

P0.7 must answer:

```text
If we simplify entity resolution, what would change?
```

P0.7 must not change production behavior.

---

## 5. P0.7 Scope

Allowed:

```text
Add resolver v2 function.
Add dry-run CLI.
Add tests.
Add docs.
Export comparison CSV/JSON.
```

Not allowed:

```text
Do not update production_outputs.entity_id.
Do not change dashboard KPI behavior.
Do not migrate target data.
Do not delete aliases.
Do not delete conditional rules.
Do not create broad aliases.
```

---

## 6. P0.7 Resolver V2 Rule

Resolver priority:

```text
1. gProdOrRotLine_Description
2. gProdOrRotLine_No
3. Machine_Center_No
4. UNMAPPED
```

Expected resolver output:

```text
resolvedEntityCode
resolvedEntityDisplayName
sourceFieldUsed
sourceValueUsed
confidence
reason
targetBucketCandidate
targetRoutingEvidence
```

---

## 7. P0.7 Target Bucket Candidate

P0.7 only produces candidate bucket. It does not apply target yet.

### Printing

```text
OZ_22:
- item description contains 22 OZ or 22OZ
- or machine center contains 22 OZ or 22OZ

OZ_LT_20:
- item description contains 10 OZ, 12 OZ, 14 OZ, 16 OZ, or 18 OZ

REG:
- machine center contains REG
- or no OZ signal exists
```

### Thermoforming

```text
OZ_22:
- item or machine center contains 22 OZ / 22OZ

OZ_LT_20:
- item contains 10 OZ, 12 OZ, 14 OZ, 16 OZ, or 18 OZ

CUP_REG:
- cup item without safe OZ classification
```

### Blowing

```text
BOTOL_SIZE:
- item description contains BOTOL / BTL and ML
- examples: 250 ML, 400 ML, 580 ML, 600 ML, 1000 ML, 1500 ML
```

### Injection

```text
PREFORM_WEIGHT:
- item description contains PREFORM and GR
- examples: 19 GR, 23 GR, 27.5 GR, 42.3 GR
```

### Unknown

```text
UNKNOWN:
- no safe bucket can be inferred
```

Important rule:

```text
When unsure, return UNKNOWN.
Do not guess.
```

---

## 8. P0.7 Required CLI

Command:

```bash
pnpm bc:entity-v2-dry-run
```

Required output files:

```text
.tmp/bc-entity-v2-dry-run.csv
.tmp/bc-entity-v2-dry-run.json
```

Required summary metrics:

```text
total rows
same entity rows
different entity rows
currently unmapped but v2 resolved
currently mapped but v2 unmapped
top mismatches by source field and source value
top targetBucketCandidate counts
examples for OMSO, VFINE, ILLIG, REPACKING, NEWDO, CAI
```

---

## 9. P0.7 Acceptance Criteria

P0.7 is accepted only if:

```text
Resolver v2 dry-run works.
CSV and JSON reports are generated.
Tests cover priority and fallback behavior.
No dashboard KPI behavior changes.
No entity_id data is updated.
No DB migration is required.
No global alias is created.
```

Required validation:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm bc:entity-v2-dry-run
git diff --check
```

---

# P0.8 — Target Profile Model Design

## 10. P0.8 Goal

Introduce target profiles as a separate concept from entity.

P0.8 answers:

```text
How should targets be represented after entity simplification?
```

---

## 11. P0.8 Scope

Allowed:

```text
Add target profile schema/model.
Add repository methods.
Add dry-run target lookup.
Add import/export support if needed.
Add tests.
Add docs.
```

Not allowed:

```text
Do not switch dashboard target lookup yet.
Do not delete old target logic yet.
Do not update historical KPI calculation yet.
```

---

## 12. P0.8 Proposed Target Profile Shape

Conceptual table:

```text
target_profiles
- id
- entity_id
- machine_center_no nullable
- target_bucket
- effective_from
- effective_to nullable
- target_qty
- unit
- is_active
- approval_status
- source
- created_by
- updated_by
- created_at
- updated_at
```

Recommended uniqueness rule:

```text
entity_id
+ target_bucket
+ machine_center_no normalized
+ effective_from
```

Recommended active lookup:

```text
entity_id = row entity
target_bucket = resolver bucket
posting_date >= effective_from
posting_date <= effective_to if effective_to exists
is_active = true
approval_status = approved
```

---

## 13. P0.8 Target Lookup Priority

Target lookup should prefer most specific rule first:

```text
1. entity_id + target_bucket + exact machine_center_no + date
2. entity_id + target_bucket + null machine_center_no + date
3. entity_id + UNKNOWN/DEFAULT bucket + date
4. NO_ACTIVE_TARGET
```

If multiple active targets match:

```text
Return MULTIPLE_TARGET_MATCH.
Do not guess.
Create DQ issue if needed.
```

If no target matches:

```text
Return NO_ACTIVE_TARGET.
```

---

## 14. P0.8 Acceptance Criteria

P0.8 is accepted only if:

```text
Target profile model exists.
Target profile lookup can run in dry-run mode.
Existing dashboard remains unchanged.
Old target logic still works.
Tests cover exact match, fallback match, no match, and multiple match.
```

Required validation:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

---

# P0.9 — Backfill Plan & Migration Dry Run

## 15. P0.9 Goal

Prepare safe data backfill from old detailed entities to new canonical entities and target profiles.

P0.9 answers:

```text
What data would change if we migrate?
```

---

## 16. P0.9 Scope

Allowed:

```text
Add backfill dry-run CLI.
Map old detailed entities to canonical entities.
Map old detailed target variants to target profiles.
Export migration preview.
Add rollback plan.
Add tests.
```

Not allowed:

```text
Do not execute destructive migration automatically.
Do not delete old entities.
Do not delete aliases.
Do not switch dashboard yet.
```

---

## 17. P0.9 Required CLI

Recommended commands:

```bash
pnpm bc:entity-v2-backfill-dry-run
pnpm bc:target-profile-backfill-dry-run
```

Required output files:

```text
.tmp/bc-entity-v2-backfill-dry-run.csv
.tmp/bc-entity-v2-backfill-dry-run.json
.tmp/bc-target-profile-backfill-dry-run.csv
.tmp/bc-target-profile-backfill-dry-run.json
```

Required report:

```text
rows that would change entity_id
old entity code
new entity code
old target reason
new target profile candidate
affected OK quantity
affected reject quantity
affected dashboard period
top changed machine descriptions
top changed machine centers
high-risk mappings
```

---

## 18. P0.9 Risk Classification

Low risk:

```text
Current entity and v2 entity are equivalent canonical names.
Only target bucket moves out of entity name.
No KPI quantity changes.
```

Medium risk:

```text
Current row mapped to old detailed entity.
V2 maps to canonical parent entity.
Target bucket is inferred safely.
```

High risk:

```text
Current row mapped but v2 unmapped.
Current row unmapped but v2 mapped to ambiguous candidate.
Multiple target profiles match.
Machine description and machine center conflict.
```

High-risk rows must not be migrated automatically.

---

## 19. P0.9 Acceptance Criteria

P0.9 is accepted only if:

```text
Backfill dry-run reports are generated.
High-risk rows are clearly separated.
No data is migrated without explicit approval.
Rollback SQL plan exists.
Dashboard KPI comparison is available.
```

Required validation:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm bc:entity-v2-backfill-dry-run
pnpm bc:target-profile-backfill-dry-run
git diff --check
```

---

# P1.0 — Controlled Switch to Resolver V2 + Target Profiles

## 20. P1.0 Goal

Switch production calculation to canonical entity + target profile lookup after dry-run approval.

P1.0 answers:

```text
Can dashboard safely use the new model?
```

---

## 21. P1.0 Scope

Allowed:

```text
Feature flag resolver v2.
Feature flag target profile lookup.
Switch dashboard only when validation passes.
Keep old logic available for rollback.
Add KPI comparison command.
Add docs and release notes.
```

Not allowed:

```text
Do not remove old logic immediately.
Do not delete old aliases immediately.
Do not delete old detailed entities immediately.
Do not switch without before/after KPI comparison.
```

---

## 22. P1.0 Feature Flags

Recommended flags:

```text
BC_ENTITY_RESOLVER_VERSION=v1|v2
BC_TARGET_LOOKUP_VERSION=v1|target_profiles
```

Default before approval:

```text
BC_ENTITY_RESOLVER_VERSION=v1
BC_TARGET_LOOKUP_VERSION=v1
```

After approval:

```text
BC_ENTITY_RESOLVER_VERSION=v2
BC_TARGET_LOOKUP_VERSION=target_profiles
```

---

## 23. P1.0 Required KPI Comparison

Required command:

```bash
pnpm bc:kpi-compare-v1-v2
```

Required output:

```text
.tmp/bc-kpi-compare-v1-v2.csv
.tmp/bc-kpi-compare-v1-v2.json
```

Compare:

```text
OK output
reject KG
reject PCS equivalent
target
achievement
missing target count
unmapped count
NO_ACTIVE_TARGET count
MULTIPLE_TARGET_MATCH count
entity-days
```

Comparison windows:

```text
last 7 days
current month
previous month
custom date range if supported
```

---

## 24. P1.0 Acceptance Criteria

P1.0 is accepted only if:

```text
Feature flag can switch v1/v2.
Dashboard works under v2.
KPI comparison is reviewed.
Unexpected KPI differences are documented.
Rollback to v1 works.
No old data is deleted.
```

Required validation:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm bc:kpi-compare-v1-v2
git diff --check
```

---

# 25. Traceability Matrix

| Phase | Main artifact | Main command | DB change | Dashboard change | Risk |
|---|---|---|---|---|---|
| P0.7 | Resolver V2 dry-run | `pnpm bc:entity-v2-dry-run` | No | No | Low |
| P0.8 | Target profile model | TBD | Yes, additive | No | Medium |
| P0.9 | Backfill dry-run | `pnpm bc:entity-v2-backfill-dry-run` | No or dry-run only | No | Medium |
| P1.0 | Controlled switch | `pnpm bc:kpi-compare-v1-v2` | Maybe config/feature flag | Yes, gated | High |

---

# 26. Required Documentation Updates Per Phase

## P0.7

Update:

```text
docs/BC_ENTITY_TARGET_REDESIGN_ROADMAP.md
docs/BC_ENTITY_RESOLVER_V2_DESIGN.md
docs/OPERATIONS.md
```

Record:

```text
dry-run summary
known mismatches
open questions
validation commands
```

## P0.8

Update:

```text
docs/BC_TARGET_PROFILES.md
docs/OPERATIONS.md
docs/API.md if endpoints are added
```

Record:

```text
target profile schema
lookup priority
example target profiles
migration notes
```

## P0.9

Update:

```text
docs/BC_ENTITY_TARGET_MIGRATION_PLAN.md
docs/OPERATIONS.md
```

Record:

```text
backfill dry-run summary
rollback SQL
risk rows
approval notes
```

## P1.0

Update:

```text
docs/BC_ENTITY_TARGET_RELEASE_NOTES.md
docs/OPERATIONS.md
```

Record:

```text
feature flag state
KPI before/after
rollback instruction
known residual issues
```

---

# 27. Rollback Principles

Before any migration:

```text
Create DB backup.
Export dry-run reports.
Save feature flag state.
Record current commit hash.
```

Rollback should prefer:

```text
Switch feature flag back to v1.
Do not immediately restore DB unless data migration was already committed.
Keep old aliases and old logic during transition.
```

---

# 28. Current Recommended Next Step

Proceed with:

```text
P0.7 Entity Resolver V2 Dry Run
```

Do not proceed to P0.8 until P0.7 dry-run report is reviewed.
