# Business Central Target Profiles

Status: P0.8 additive model implemented
Related roadmap: `docs/BC_ENTITY_TARGET_REDESIGN_ROADMAP.md`

---

## 1. Purpose

Target profiles separate target calculation from entity identity.

Entity should answer:

```text
Which machine / production line produced this output?
```

Target profile should answer:

```text
Which target applies to this entity, item bucket, routing, and date?
```

---

## 2. Conceptual Model

Implemented additive table:

```text
target_profiles
- id
- entity_id
- machine_center_no nullable
- machine_center_no_normalized nullable
- target_bucket
- target_bucket_normalized
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

This table does not replace `production_targets` in P0.8. It is infrastructure for dry-run review only.

---

## 3. Lookup Priority

```text
1. entity_id + target_bucket + exact machine_center_no + posting_date
2. entity_id + target_bucket + null machine_center_no + posting_date
3. entity_id + DEFAULT/UNKNOWN bucket + posting_date
4. NO_ACTIVE_TARGET_PROFILE
```

If multiple rows match:

```text
MULTIPLE_TARGET_PROFILE_MATCH
```

Do not guess.

Only rows with `is_active = true`, `approval_status = approved`, and a posting date inside the effective range are eligible.

---

## 4. Example

```text
Entity:
OMSO 1-OZ

Target profiles:
- OZ_22, machine_center_no = OMSO1 22 OZ
- OZ_LT_20, machine_center_no = OMSO1 OZ
- REG, machine_center_no = OMSO1 REG
```

---

## 5. P0.8 Safety

P0.8 is additive only.

Do not switch dashboard target lookup until P1.0.

Do not create broad aliases to solve target gaps. Target profile gaps should be handled through P0.9 seed/backfill dry-run planning.

---

## 6. P0.8 Dry Run

Command:

```bash
pnpm bc:target-profile-dry-run
```

Outputs:

```text
.tmp/bc-target-profile-dry-run.csv
.tmp/bc-target-profile-dry-run.json
```

The dry run reads Business Central `production_outputs`, resolves a P0.7 resolver v2 entity candidate, uses the P0.7 target bucket candidate, and simulates target profile lookup. It does not update database rows and does not switch dashboard target behavior.

Expected empty-state behavior:

```text
NO_ACTIVE_TARGET_PROFILE is expected when target_profiles is empty.
INVALID_ENTITY is expected when resolver v2 cannot resolve a canonical entity.
```

If the migration has not been applied to a local database yet, the dry run treats the target profile catalog as empty and reports this in the JSON. Apply the P0.8 migration before P0.9 seed/backfill planning.
