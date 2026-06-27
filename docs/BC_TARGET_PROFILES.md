# Business Central Target Profiles

Status: P0.8 design placeholder  
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

Recommended shape:

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

---

## 3. Lookup Priority

```text
1. entity_id + target_bucket + exact machine_center_no + date
2. entity_id + target_bucket + null machine_center_no + date
3. entity_id + DEFAULT/UNKNOWN bucket + date
4. NO_ACTIVE_TARGET
```

If multiple rows match:

```text
MULTIPLE_TARGET_MATCH
```

Do not guess.

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
