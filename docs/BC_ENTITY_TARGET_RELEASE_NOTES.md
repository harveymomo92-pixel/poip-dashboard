# Business Central Entity & Target Redesign Release Notes

Status: P1.0 blocked until P0.9a gate passes
Related roadmap: `docs/BC_ENTITY_TARGET_REDESIGN_ROADMAP.md`

---

## 1. Release Summary

This document should be filled when P1.0 switches dashboard calculation to resolver v2 and target profiles.

Current P0.9a status:

```text
P1.0 is not active.
Dashboard calculation still uses v1 behavior.
Resolver v2 and target_profiles are not enabled for dashboard lookup.
```

---

## 2. Required Before/After KPI Comparison

P0.9a adds the read-only scaffold:

```bash
pnpm bc:kpi-compare-v1-v2
```

When the high-risk review gate is blocked, the scaffold emits `P1.0_BLOCKED_BY_HIGH_RISK_REVIEW` and does not compare or switch dashboard behavior.

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

Current/default state:

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
P0.9a high-risk review gate PASS
KPI compare reviewed
target_profiles has active approved coverage
rollback tested
dashboard checked
no old data deleted
```

P0.9a blockers must not be resolved with broad/global aliases. Use reviewed canonical entity planning, alias cleanup, target profile draft approval, and source-data investigation before any controlled switch.
