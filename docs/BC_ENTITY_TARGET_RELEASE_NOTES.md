# Business Central Entity & Target Redesign Release Notes

Status: P1.0 placeholder  
Related roadmap: `docs/BC_ENTITY_TARGET_REDESIGN_ROADMAP.md`

---

## 1. Release Summary

This document should be filled when P1.0 switches dashboard calculation to resolver v2 and target profiles.

---

## 2. Required Before/After KPI Comparison

Record:

```text
date range
OK output v1
OK output v2
reject KG v1
reject KG v2
reject PCS equivalent v1
reject PCS equivalent v2
target v1
target v2
achievement v1
achievement v2
unmapped count v1
unmapped count v2
NO_ACTIVE_TARGET count
MULTIPLE_TARGET_MATCH count
```

---

## 3. Feature Flag State

Before release:

```text
BC_ENTITY_RESOLVER_VERSION=v1
BC_TARGET_LOOKUP_VERSION=v1
```

After release:

```text
BC_ENTITY_RESOLVER_VERSION=v2
BC_TARGET_LOOKUP_VERSION=target_profiles
```

Rollback:

```text
BC_ENTITY_RESOLVER_VERSION=v1
BC_TARGET_LOOKUP_VERSION=v1
```

---

## 4. Release Checklist

```text
P0.7 accepted
P0.8 accepted
P0.9 accepted
KPI compare reviewed
rollback tested
dashboard checked
no old data deleted
```
