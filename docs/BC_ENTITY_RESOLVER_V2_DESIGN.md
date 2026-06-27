# Business Central Entity Resolver V2 Design

Status: P0.7 implementation design  
Related roadmap: `docs/BC_ENTITY_TARGET_REDESIGN_ROADMAP.md`

---

## 1. Purpose

Entity Resolver V2 simplifies Business Central entity resolution by using canonical machine / production line identity.

The resolver must stop treating target variants as separate entities.

Wrong pattern:

```text
OMSO 1-OZ - Printing 22 OZ
OMSO 1-OZ - Printing OZ < 20
OMSO 1-OZ - Printing non-OZ
```

Correct pattern:

```text
Entity:
OMSO 1-OZ

Target bucket:
OZ_22
OZ_LT_20
REG
```

---

## 2. Resolver Priority

Business Central resolver v2 priority:

```text
1. gProdOrRotLine_Description
2. gProdOrRotLine_No
3. Machine_Center_No
4. UNMAPPED
```

`Machine_Center_No` is fallback only. It is not the primary entity key.

---

## 3. Function Contract

Required domain function:

```text
resolveBusinessCentralEntityV2(row, canonicalEntityCatalog)
```

Input:

```text
entryType
postingDate
documentNo
itemNo
itemDescription
itemCategoryCode
locationCode
quantity
grossWeight
gProdOrRotLineNo
gProdOrRotLineDescription
machineCenterNo
```

Output:

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

## 4. Confidence Rules

Recommended confidence values:

```text
HIGH:
Resolved by exact gProdOrRotLine_Description match.

MEDIUM:
Resolved by exact gProdOrRotLine_No match.

LOW:
Resolved by Machine_Center_No fallback.

NONE:
Unable to resolve.
```

Conflict rule:

```text
If gProdOrRotLine_Description and Machine_Center_No imply different known entities,
gProdOrRotLine_Description wins.
```

Reason should explain this clearly.

---

## 5. Target Bucket Candidate Rules

The resolver should infer a bucket candidate without applying final target.

Examples:

```text
OZ_22
OZ_LT_20
REG
BOTOL_SIZE_600_ML
PREFORM_WEIGHT_19_GR
CUP_REG
UNKNOWN
```

Rules must be conservative. If unsafe, return:

```text
UNKNOWN
```

---

## 6. Dry Run CLI

Required command:

```bash
pnpm bc:entity-v2-dry-run
```

Required output files:

```text
.tmp/bc-entity-v2-dry-run.csv
.tmp/bc-entity-v2-dry-run.json
```

Dry run must compare:

```text
current entity
vs
resolver v2 entity candidate
```

It must not update database rows.

Implementation note:

```text
P0.7 derives the canonical catalog from active master_entities plus active, Business Central
source aliases. Duplicate aliases remain ambiguous and do not force a match. The dry run
does not create canonical entities or aliases when a source value has no exact safe match.
```

Review classification note:

```text
CURRENT_MAPPED_V2_UNMAPPED is not always a resolver error. If current rows map to a
legacy/detailed entity such as "THERMO HENGFENG-2-OZ - Thermoforming" but resolver v2
cannot find "THERMO HENGFENG-2-OZ" as a canonical catalog entity, classify the row as
CANONICAL_CATALOG_GAP. If current rows map to target-variant entities such as
"OMSO 1-OZ - Printing 22 OZ" and "OMSO 1-OZ - Printing OZ < 20", classify the row as
LEGACY_TARGET_VARIANT_COLLAPSE_NEEDED.
```

These P0.7 findings are expected input for P0.8/P0.9 planning. Do not reduce the count by
creating broad aliases or by forcing resolver v2 to match legacy target-variant entities.
Resolve them later through canonical entity, target profile, and migration dry-run planning.

Dry-run CSV adds:

```text
v2_review_classification
v2_review_reason
v2_recommended_action
v2_suggested_canonical_entity_code
v2_suggested_canonical_entity_display_name
```

Dry-run JSON adds:

```text
reviewSummary
canonicalCatalogGaps
legacyTargetVariantCollapseNeeded
```

### P0.7b Possible Resolver Mismatch Review

`POSSIBLE_RESOLVER_MISMATCH` is a review bucket, not automatic proof of a resolver bug.
The dry run adds a second-level mismatch review so P0.8 planning can distinguish naming,
alias/catalog, source-field, and true resolver-risk cases without changing entity mapping.

Dry-run CSV adds:

```text
v2_mismatch_review_type
v2_mismatch_review_reason
v2_mismatch_recommended_action
```

Dry-run JSON adds:

```text
possibleResolverMismatchReview
topPossibleResolverMismatches
```

Use `possibleResolverMismatchReview.groups` to decide whether follow-up work belongs in
canonical entity normalization, alias cleanup, source data investigation, or a test-proven
resolver bug fix. Do not fix mismatch rows with broad/global aliases, and do not switch
dashboard logic based on this report.

---

## 7. Required Test Cases

```text
1. gProdOrRotLine_Description wins over Machine_Center_No.
2. Machine_Center_No fallback only when line description and line no are blank.
3. Reject rows with blank Machine_Center_No still resolve through gProdOrRotLine_Description.
4. VFINE-BT400 does not force one entity if description says different VFINE bottle sizes.
5. OMSO 1-OZ resolves as one entity while bucket differs between OZ_22 and OZ_LT_20.
6. Unknown bucket remains UNKNOWN instead of guessing.
```

---

## 8. Safety Rules

P0.7 must not:

```text
update production_outputs.entity_id
change dashboard KPI behavior
delete aliases
delete conditional rules
create broad aliases
migrate targets
```

---

## 9. Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm bc:entity-v2-dry-run
git diff --check
```
