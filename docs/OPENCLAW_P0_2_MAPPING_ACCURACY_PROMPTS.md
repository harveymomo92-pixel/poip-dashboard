# OpenClaw Prompts — P0.2-P0.8 Business Central Mapping Accuracy

<!-- LEGACY_BC_ROADMAP_ID_WARNING_START -->

> **Legacy milestone ID warning**
>
> This document may mention old Business Central roadmap IDs.
>
> Current active meaning:
>
> ```text
> P0.7 = Entity Resolver V2 Dry Run
> P0.8 = Target Profile Model
> P0.9 = Backfill / Migration Dry Run
> P1.0 = Controlled Switch
> ```
>
> Legacy meanings from older mapping/reject roadmap:
>
> ```text
> Legacy P0.7 Reject Attachment Review Queue -> BC-RJ-1
> Legacy P0.8 V1 parity closeout -> BC-V1-CLOSEOUT
> ```
>
> See `docs/BC_MILESTONE_NAMESPACE.md`.

<!-- LEGACY_BC_ROADMAP_ID_WARNING_END -->

Use these prompts one phase at a time. Do not combine all phases into one large patch.

---

## Prompt P0.2 — Mapping Impact Ranking and Source Quality Diagnostics

```text
You are continuing the PPIC Output Intelligence Platform repo.

Read first:
- docs/P0_2_BC_MAPPING_ACCURACY_ROADMAP.md
- docs/BC_METRIC_CONTRACT.md
- docs/OPERATIONS.md

Implement P0.2 only: Mapping Impact Ranking and Source Quality Diagnostics.

Current baseline:
- Source-fields backfill has been applied.
- Safe HIGH exact mapping was applied.
- Mapping coverage improved from 41.85% to 60.21%.
- Remaining unmapped rows include REPACKING, THERMO 6 ILLIG, OMSO, POLYPRINT, HENGFENG, and LS1 variants.
- Do not auto-map LOW or ambiguous values.

Requirements:
1. Add impact fields to Business Central mapping candidates:
   - unmapped_ok_qty
   - impact_severity CRITICAL/HIGH/MEDIUM/LOW
   - zero_qty_only
   - first_posting_date
   - last_posting_date
   - top item_no/item_description/category samples
   - top document samples if available
2. Sort mapping candidates by impact severity and unmapped OK quantity.
3. Add source quality diagnostics:
   - current preferred source field/value
   - alternate source field/value
   - source quality reason
4. Surface this in:
   - pnpm bc:mapping-candidates
   - /master-data unmapped source table if feasible
5. Do not mutate DB.
6. Do not change dashboard KPI calculations.
7. Do not change existing mapping commit behavior.
8. Update docs/OPERATIONS.md and docs/BC_METRIC_CONTRACT.md if needed.

Validation:
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- pnpm bc:mapping-candidates
- pnpm bc:daily-item-resume
- pnpm bc:reconcile
- git diff --check

Return:
- files changed
- before/after mapping-candidates sample
- confirmation no DB mutation
- confirmation OK output and Reject KG remain unchanged
```

---

## Prompt P0.3 — Source-Specific Reset / Remap UI

```text
You are continuing the PPIC Output Intelligence Platform repo.

Read first:
- docs/P0_2_BC_MAPPING_ACCURACY_ROADMAP.md
- docs/OPENCLAW_P0_2_MAPPING_ACCURACY_PROMPTS.md
- docs/BC_METRIC_CONTRACT.md
- docs/OPERATIONS.md

Implement P0.3 only: source-specific reset/remap UI in Master Data.

Requirements:
1. Add preview and commit API endpoints for resetting one BC source value.
2. Supported source fields:
   - prod_line_description
   - prod_line_no
   - machine_center_no
   - machine_description
3. Preview shows matching output rows, mapped rows, aliases that would be deactivated, and warnings.
4. Commit:
   - transaction
   - set production_outputs.entity_id = null for matching rows only
   - deactivate matching master_entity_aliases
   - update timestamps
   - write audit log
5. Add Master Data UI panel/modal.
6. Require explicit confirmation before commit.
7. Do not add reset-all.
8. Use strict whitelist to avoid SQL injection.
9. Add backend and frontend tests.
10. Update docs/API.md and docs/OPERATIONS.md.

Validation:
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- pnpm --filter @poip/api test
- pnpm --filter @poip/web test
- git diff --check
```

---

## Prompt P0.4 — Mapping Review Queue

```text
You are continuing the PPIC Output Intelligence Platform repo.

Read first:
- docs/P0_2_BC_MAPPING_ACCURACY_ROADMAP.md
- docs/OPENCLAW_P0_2_MAPPING_ACCURACY_PROMPTS.md
- docs/BC_METRIC_CONTRACT.md
- docs/OPERATIONS.md

Implement P0.4 only: Mapping Review Queue for LOW and ambiguous BC source groups.

Requirements:
1. Add /master-data review queue UI for LOW/ambiguous groups.
2. Show source field/value, OK qty impact, impact severity, row count, date range, top items, top documents, candidate entities, confidence reasons, and target bucket candidates.
3. Support reviewer actions:
   - create reviewed alias
   - create conditional mapping rule if P0.5 is available
   - keep unmapped
   - mark needs source correction
   - export CSV
4. Preview and audit every write.
5. Do not auto-map LOW/ambiguous groups.
6. Do not change dashboard KPI calculations.

Validation:
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- pnpm bc:mapping-candidates
- git diff --check
```

---

## Prompt P0.5 — Conditional Mapping by Bucket

```text
You are continuing the PPIC Output Intelligence Platform repo.

Read first:
- docs/P0_2_BC_MAPPING_ACCURACY_ROADMAP.md
- docs/OPENCLAW_P0_2_MAPPING_ACCURACY_PROMPTS.md
- docs/BC_METRIC_CONTRACT.md
- docs/OPERATIONS.md

Implement P0.5 only: conditional mapping by bucket for ambiguous BC source values.

Requirements:
1. Add reviewed conditional mapping model.
2. Supported initial condition types:
   - inferred_target_bucket
   - item_category_code
   - item_no_pattern
   - gross_weight_range
3. Resolver order:
   - exact reviewed alias
   - exactly-one matching conditional mapping
   - existing fallback
   - unmapped
4. If multiple rules match, stay unmapped and create/raise DQ issue.
5. Add preview/commit UI in Master Data.
6. Add audit log.
7. Add tests for ambiguous OMSO/POLYPRINT/HENGFENG style cases.
8. Do not change KPI formula.
9. Do not auto-map LOW or ambiguous groups.

Validation:
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- pnpm bc:daily-item-resume
- pnpm bc:reconcile
- pnpm bc:mapping-candidates
- git diff --check
```

---

## Prompt P0.6 — Data Quality Automation for Unmapped Groups

```text
You are continuing the PPIC Output Intelligence Platform repo.

Read first:
- docs/P0_2_BC_MAPPING_ACCURACY_ROADMAP.md
- docs/OPENCLAW_P0_2_MAPPING_ACCURACY_PROMPTS.md
- docs/BC_METRIC_CONTRACT.md
- docs/OPERATIONS.md

Implement P0.6 only: Data Quality automation for unmapped BC source groups.

Requirements:
1. Create/update DQ issues for unmapped BC source groups.
2. Use impact severity from mapping candidates.
3. Auto-resolve issues when mapping commit resolves a group.
4. Keep ignored/skipped decisions auditable.
5. Surface issue links from Master Data mapping candidates if feasible.
6. Do not mutate production quantities or targets.
7. Add tests for open/update/resolve behavior.

Validation:
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- pnpm bc:mapping-candidates
- git diff --check
```

---

## Prompt P0.7 — Reject Attachment Review Queue

```text
You are continuing the PPIC Output Intelligence Platform repo.

Read first:
- docs/P0_2_BC_MAPPING_ACCURACY_ROADMAP.md
- docs/OPENCLAW_P0_2_MAPPING_ACCURACY_PROMPTS.md
- docs/BC_METRIC_CONTRACT.md
- docs/OPERATIONS.md

Implement P0.7 only: Reject Attachment Review Queue.

Requirements:
1. List unresolved reject attachment rows:
   - AMBIGUOUS_REJECT_ATTACHMENT
   - REJECT_ONLY
2. Show candidate OK groups and evidence.
3. Allow reviewed override to one OK group.
4. Store override with audit log.
5. Do not split reject KG automatically.
6. Reject PCS Eq only becomes complete when deterministic or manually reviewed.
7. Reject rate remains N/A until required PCS equivalents are complete.
8. Add tests and docs.
9. Do not change OK Output, Reject KG, target, or achievement formulas.

Validation:
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- pnpm bc:daily-item-resume
- pnpm bc:reconcile
- git diff --check
```

---

## Prompt P0.8 — Closeout

```text
You are continuing the PPIC Output Intelligence Platform repo.

Read first:
- docs/P0_2_BC_MAPPING_ACCURACY_ROADMAP.md
- docs/OPENCLAW_P0_2_MAPPING_ACCURACY_PROMPTS.md
- docs/V1_PARITY_GAP_AUDIT.md
- docs/BC_METRIC_CONTRACT.md
- docs/OPERATIONS.md

Implement P0.8 closeout docs and checks only.

Requirements:
1. Create or update docs/V1_PARITY_GAP_AUDIT.md.
2. Update docs/KNOWN_ISSUES.md.
3. Update docs/OPERATIONS.md with P0.2+ workflows.
4. Record final diagnostics:
   - OK output
   - Reject KG
   - Reject PCS Eq completeness
   - mapping coverage
   - remaining unmapped by impact
5. Do not change code unless needed for docs/tests.
6. Do not commit env, secrets, dumps, or backup files.

Validation:
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- pnpm smoke:test
- git diff --check
```
