# Operations Guide

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

This guide covers the v2 operations runbook for an internal deployment.

## Daily checks

1. Open `/settings/health`.
2. Confirm API readiness, PostgreSQL, Redis, migrations, and queue state.
3. Check latest OData sync status and freshness.
4. Open `/overview` and confirm dashboard data is current enough for the meeting.
5. Review `/data-quality` for critical/open issues.
6. Review `/settings/audit` if a write action needs traceability.

## Health endpoints

```bash
curl http://localhost:4000/api/v1/health
```

Deep readiness requires an authenticated Admin/session with `settings.manage`; use the UI System Health page or `pnpm smoke:test` with admin credentials.

## Sync operations

Use `/settings/sync` for manual OData runs and range resyncs. Keep range resyncs small during UAT and first production cutover.

### Live Business Central OData via Tailscale/LAN

Use environment variables only. Do not paste credentials into commands, code, docs, or logs.

Required local/live pattern:

```bash
ODATA_SYNC_MODE=live
BC_ODATA_URL=http://tailscale-or-lan-host.example.local:7048/BC/ODataV4/Company('COMPANY')/ProductionOutput
BC_ODATA_AUTH_MODE=basic
BC_ODATA_USERNAME=replace-with-odata-username
BC_ODATA_PASSWORD=replace-with-odata-password
```

Safe direct curl check using environment variables:

```bash
curl --silent --show-error --fail \
  --user "$BC_ODATA_USERNAME:$BC_ODATA_PASSWORD" \
  --header "Accept: application/json" \
  --get --data-urlencode '$top=1' \
  "$BC_ODATA_URL" >/tmp/poip-odata-check.json
```

Safer scripted check:

```bash
pnpm odata:check
```

`scripts/check-odata.sh` reads `.env` when present, sends `Accept: application/json`, supports `BC_ODATA_AUTH_MODE=basic` and bearer mode, and never prints the password/token.

After changing OData environment values:

1. Restart the worker process.
2. Open `/settings/sync`.
3. Trigger a small manual sync or range resync.
4. Confirm the sync run moves from `QUEUED`/`RUNNING` to `SUCCESS`.
5. Check `/settings/audit`, `/data-quality`, and `/overview` for expected downstream updates.

If sync fails:

1. Check `/settings/health` for Redis/queue status.
2. Check `/settings/sync` run history and error message.
3. Confirm Business Central endpoint/auth variables are valid.
4. Keep `ODATA_SYNC_CONCURRENCY=1` unless a higher value has already been tested.

Troubleshooting live OData:

- `200`: Endpoint and auth worked. If sync still imports nothing, inspect `$filter`, `BC_ODATA_PAGE_SIZE`, and returned field names.
- `401`: Username/password/token rejected. Rotate/update environment variables and restart the worker.
- `403`: Auth succeeded but the account lacks permission to the company/page/query.
- `404`: URL, company name, published web service name, or route is wrong. Confirm exact ODataV4 entity URL.
- Timeout/no response: Tailscale route, LAN firewall, host/port, or Business Central service availability problem.

Normal live sync strategy:

- Canonical live source-system value is `business-central`.
- The worker probes the latest remote `Entry_No` first.
- If remote latest `Entry_No` is newer than local `production_outputs.entry_no`, it fetches only `Entry_No gt <local latest>`.
- If remote latest is not newer, it does not pull full history again. It either skips fetching when `BC_ODATA_BACKFILL_SCAN_DAYS=0`, or scans the recent `BC_ODATA_BACKFILL_SCAN_DAYS` posting-date window for late-arriving/corrected rows.
- Re-running sync/backfill is idempotent through the natural key `source_system + entry_no` and row-hash no-op detection.
- `sync_runs.metadata.syncStrategy` records remote/latest entry numbers, selected mode, and the scan window when used.

### One-time live OData backfill

Use the backfill command for controlled historical imports. It reuses the same normalization, staging, data quality, and idempotent upsert logic as the live worker sync. It does not print the Business Central URL, password, bearer token, cookies, or session tokens.

Required before running:

1. Confirm `ODATA_SYNC_MODE=live`.
2. Confirm `BC_ODATA_URL`, `BC_ODATA_AUTH_MODE`, and matching auth variables are set in `.env` or the secret environment.
3. Create a pre-backfill PostgreSQL backup.
4. Run the safe backfill check.

January-through-now backfill:

```bash
BACKFILL_FROM=2026-01-01 pnpm odata:backfill:check
BACKFILL_FROM=2026-01-01 pnpm odata:backfill
```

Single-month backfill, using an exclusive end date:

```bash
BACKFILL_FROM=2026-01-01 BACKFILL_TO=2026-02-01 pnpm odata:backfill:check
BACKFILL_FROM=2026-01-01 BACKFILL_TO=2026-02-01 pnpm odata:backfill
```

Optional controls:

- `BACKFILL_DATE_FIELD=Posting_Date` by default. Use another simple OData date field only if the Business Central web service exposes it and PPIC has approved it.
- `BACKFILL_AFTER_ENTRY_NO=12345` resumes after a known Business Central entry number by adding `Entry_No gt 12345` to the filter.
- `BACKFILL_PAGE_SIZE=500` adjusts `$top` when the endpoint URL does not already contain `$top`.
- `BACKFILL_MAX_PAGES=5` caps pages for a cautious trial run. Omit it for the full backfill.
- `BACKFILL_CHECK_TOP=25` increases only the dry-run check size. It never writes rows and is useful when verifying Business Central can return more than one row before a full backfill.
- `BACKFILL_CHECK_MAX_PAGES=2` lets the dry-run check prove read-only pagination before any write-mode backfill.
- `BACKFILL_CHUNK_PAGES=20` commits a live backfill in smaller idempotent chunks. Use this for fragile Business Central/Tailscale links where one long request sequence can fail before the final commit.
- `BACKFILL_MAX_CHUNKS=10` caps chunked writes for a controlled trial. Omit it for the full chunked run.
- `BACKFILL_CHUNK_RETRIES=2` retries a failed chunk before aborting. Failed attempts remain visible in `sync_runs` with sanitized errors.
- `BC_ODATA_TIMEOUT_MS=30000` caps each page request.
- `BC_ODATA_RETRY_ATTEMPTS=2` retries transient page/network/non-JSON failures without printing response bodies.

Filter behavior:

- From-only uses `<dateField> ge <BACKFILL_FROM>`.
- From/to uses `<dateField> ge <BACKFILL_FROM> and <dateField> lt <BACKFILL_TO>`.
- Existing endpoint `$filter` is preserved and combined with `and`.
- Existing `$select`, `$orderby`, `$top`, and other query parameters are preserved.
- Pagination follows Business Central `@odata.nextLink` when present.
- If Business Central omits `@odata.nextLink` but returns a full `Entry_No asc` page, the backfill uses `Entry_No gt <last entry>` keyset pagination for the next page.
- `sync_runs.metadata` records backfill settings, page count, pagination mode, and duration for successful or failed runs.
- Chunked backfill writes one successful `sync_runs` record per chunk. Re-running the same command is safe: existing rows are skipped when their row hash is unchanged.

After backfill:

1. Confirm the printed sync run status is `SUCCESS` and rows fetched are greater than zero.
2. Open `/settings/sync` and verify the latest run counts.
3. Open `/settings/audit` and filter for `sync.backfill`.
4. Open `/overview` and confirm dashboard freshness/latest posting date.
5. Open `/settings/health` and confirm readiness remains healthy.

Restore normal live sync by leaving `ODATA_SYNC_MODE=live`, removing temporary `BACKFILL_*` shell overrides, and running the worker normally:

```bash
pnpm --filter @poip/worker dev
```

### Business Central calculation diagnostics

Use these read-only commands after live data lands, before trusting dashboard numbers in UAT:

```bash
pnpm bc:profile
pnpm bc:reconcile
RECONCILE_FROM=2026-06-18 RECONCILE_TO=2026-06-24 pnpm bc:reconcile
pnpm bc:daily-item-resume
pnpm bc:target-coverage
pnpm bc:entity-v2-dry-run
```

For field interpretation, see `docs/BC_ODATA_OUTPUT_COLUMN_MAP.md`. That reference records how the current Business Central `Entry_Type = Output` OData columns should be used for entity resolution, target bucket inference, target profiles, reject attachment, and KPI safety.

Patch priority after review:

1. Fix item-description sourcing so `gItem_Description` wins over `Description`.
2. Add `gItem_Description` to the worker `$select` set for OData output sync.
3. Keep resolver priority as `gProdOrRotLine_Description` -> `gProdOrRotLine_No` -> `Machine_Center_No`.
4. Add tests for the field precedence and the worker select list before any KPI or dashboard work.

`pnpm bc:profile` reports row counts, posting-date range, rows by month, entry type, normalized output type, source-system mix, preferred entity source usage, top unmapped machines/entities, top OK items, target coverage, and reject conversion gaps.

`pnpm bc:reconcile` compares the dashboard KPI contract against raw SQL aggregates for the same date window. It explains why achievement is `N/A` when targets are missing, why reject PCS equivalent is incomplete when the matched OK item has no safe gross-weight conversion or reject attachment is unresolved, and whether OK output exists without mapped entities. Reject rate is `N/A` while any reject PCS conversion remains incomplete.

`pnpm bc:daily-item-resume` validates the v1-style `Resume Harian per Item`: raw `Entry_Type = Output` row count, grouped row count, positive output, negative correction output, net output, parsed `External_Document_No` shift/work-hours/operator details, deterministic reject attachment statuses, reject-only groups, ambiguous reject examples, conversion gap reason breakdown, target gaps, target reason breakdown, and sample grouped rows. The reject conversion breakdown prints reason-coded counts for `MISSING_OK_GROSS_WEIGHT`, `ZERO_OR_INVALID_OK_GROSS_WEIGHT`, `NO_MATCHED_OK_ROW`, `AMBIGUOUS_REJECT_ATTACHMENT`, `REJECT_ONLY`, and `MISSING_CONVERSION_MAPPING`, plus incomplete-row examples with reject item, attachment status, OK item context, OK gross weight, gross-weight source, and reason.

`pnpm bc:target-coverage` groups net OK Output by month and entity/preferred BC source, then labels rows as `COVERED`, `UNMAPPED_ENTITY`, `NO_ACTIVE_TARGET`, `TARGET_NOT_APPROVED`, `OUTSIDE_EFFECTIVE_DATE`, or `TARGET_ZERO`. Load/approve master entities and targets before expecting achievement to become numeric.

### Business Central entity resolver v2 dry run

Use the P0.7 dry run to compare current `production_outputs.entity_id` mapping with the proposed Business Central resolver v2. It is read-only and does not switch dashboard behavior:

```bash
pnpm bc:entity-v2-dry-run
```

Outputs:

- `.tmp/bc-entity-v2-dry-run.csv`: row-level comparison with current entity, v2 entity candidate, source field used, confidence, target bucket candidate, routing evidence, comparison status, and v2 review classification.
- `.tmp/bc-entity-v2-dry-run.json`: summary counts, review summary, canonical catalog gaps, legacy target-variant collapse groups, top source fields, top target buckets, top mismatch source values, examples by family, and safety flags.

Interpret comparison statuses as follows:

- `SAME_ENTITY`: current mapped entity code and resolver v2 entity code are the same.
- `DIFFERENT_ENTITY`: both current and v2 are mapped, but entity codes differ; review before any future migration.
- `CURRENT_UNMAPPED_V2_RESOLVED`: current row is unmapped, but resolver v2 found a canonical entity candidate.
- `CURRENT_MAPPED_V2_UNMAPPED`: current row is mapped, but resolver v2 found no exact canonical match; this usually means canonical entities or safe aliases must be reviewed before P0.8+.
- `BOTH_UNMAPPED`: neither current mapping nor resolver v2 resolved an entity.

Review classifications:

- `OK_SAME_ENTITY`: current and resolver v2 agree.
- `OK_BOTH_UNMAPPED`: both current and resolver v2 are unmapped; keep this visible for source review.
- `CANONICAL_CATALOG_GAP`: current row maps to a legacy/detailed entity for the same source value, but resolver v2 cannot find the canonical entity in the catalog. Example: `THERMO HENGFENG-2-OZ` currently maps to `THERMO HENGFENG-2-OZ - Thermoforming`.
- `LEGACY_TARGET_VARIANT_COLLAPSE_NEEDED`: current rows map to entity names that encode target variants, such as `OMSO 1-OZ - Printing 22 OZ` and `OMSO 1-OZ - Printing OZ < 20`; those should become target profiles later, not separate entities.
- `POSSIBLE_RESOLVER_MISMATCH`: current and resolver v2 both resolve, but to unrelated entities.
- `POSSIBLE_DATA_SOURCE_GAP`: current row is mapped, but resolver v2 has no usable BC source field/value.
- `UNKNOWN_REVIEW_NEEDED`: manual review is needed before categorizing safely.

`CURRENT_MAPPED_V2_UNMAPPED` is not automatically an error. Canonical catalog gaps are expected P0.7 findings when master data still exposes legacy/detailed entities instead of canonical machine entities. Do not fix these by creating broad aliases. Resolve them in P0.8/P0.9 through canonical entity, target profile, and migration dry-run planning.

P0.7b possible resolver mismatch review:

- `POSSIBLE_RESOLVER_MISMATCH` is a review bucket, not automatic proof of a resolver bug.
- The CSV includes `v2_mismatch_review_type`, `v2_mismatch_review_reason`, and `v2_mismatch_recommended_action`.
- The JSON includes `possibleResolverMismatchReview.groups` and `topPossibleResolverMismatches`.
- Use these groups to decide whether P0.8 needs canonical entity normalization, alias cleanup, or Business Central source data investigation.
- Do not fix mismatch rows with broad/global aliases.
- Do not switch dashboard logic based on this report.

### Business Central target profile dry run

Use the P0.8 dry run to simulate the new target profile lookup without changing dashboard target behavior:

```bash
pnpm bc:target-profile-dry-run
```

Outputs:

- `.tmp/bc-target-profile-dry-run.csv`: row-level resolver v2 entity, target bucket candidate, target profile lookup status, matched profile fields, reason, and recommended action.
- `.tmp/bc-target-profile-dry-run.json`: summary counts, top no-active groups, top multiple-match groups, matched profile groups, output paths, and safety flags.

Interpret lookup statuses:

- `TARGET_PROFILE_MATCHED_EXACT`: entity, bucket, exact machine center, and posting date matched an active approved profile.
- `TARGET_PROFILE_MATCHED_ENTITY_BUCKET`: generic entity/bucket profile matched, or DEFAULT/UNKNOWN fallback matched.
- `NO_ACTIVE_TARGET_PROFILE`: no active approved profile matched; expected while `target_profiles` is empty or before P0.9 seed/backfill planning.
- `MULTIPLE_TARGET_PROFILE_MATCH`: more than one active approved profile matched at the same priority; review data, do not guess.
- `INVALID_TARGET_BUCKET`: the P0.7 bucket candidate is blank or outside the P0.8 bucket model.
- `INVALID_ENTITY`: resolver v2 did not produce a canonical entity candidate.

P0.8 safety notes:

- `target_profiles` is additive and does not power the dashboard yet.
- Existing `production_targets` and dashboard target lookup remain the production path until P1.0.
- Do not create broad/global aliases to solve target profile gaps.
- P0.9 will handle seed/backfill dry-run planning; P1.0 will handle any controlled switch.

### Business Central P0.9 backfill dry runs

Use these commands to export migration plans only:

```bash
pnpm bc:entity-v2-backfill-dry-run
pnpm bc:target-profile-backfill-dry-run
```

Outputs:

- `.tmp/bc-entity-v2-backfill-dry-run.csv`
- `.tmp/bc-entity-v2-backfill-dry-run.json`
- `.tmp/bc-target-profile-backfill-dry-run.csv`
- `.tmp/bc-target-profile-backfill-dry-run.json`

Entity backfill actions:

- `NO_CHANGE`: current entity already matches resolver v2.
- `PROPOSE_CANONICAL_ENTITY_COLLAPSE`: existing canonical entity can be reviewed as a collapse target.
- `PROPOSE_CANONICAL_ENTITY_CREATION`: canonical entity appears needed before any row update.
- `REVIEW_ALIAS_CONFLICT`: aliases/catalog/source values conflict and require manual review.
- `REVIEW_DATA_SOURCE_GAP`: source value is blank/unusable.
- `SKIP_HIGH_RISK`: do not migrate automatically.

Risk levels:

- `LOW`: simple legacy target-variant suffix collapse, such as old printing/thermoforming detailed entity names.
- `MEDIUM`: plausible canonical/target profile candidate but not safe enough for automatic migration.
- `HIGH`: conflicting current entities, missing source value, unrelated current/v2 entity, or ambiguous resolver review.

Target profile dry-run notes:

- `approval_status` is always `draft`.
- `source` is `p0.9-dry-run`.
- If `proposed_target_qty` is blank, fill target quantity manually before migration.
- High-risk candidates must not be inserted into `target_profiles` automatically.

Safety:

- These commands do not update `production_outputs.entity_id`.
- These commands do not insert/update/delete `target_profiles`.
- These commands do not create canonical entities.
- These commands do not change aliases, conditional rules, dashboard KPI behavior, or old target lookup.
- P1.0 controlled switch comes later after dry-run approval.

### Business Central P0.9a high-risk review gate

Use the P0.9a planner to turn dry-run findings into an explicit P1.0 gate:

```bash
pnpm bc:high-risk-review-plan
```

Outputs:

- `.tmp/bc-high-risk-review-plan.csv`
- `.tmp/bc-high-risk-review-plan.json`

Review decisions:

- `BLOCK_P1_SWITCH`: do not start P1.0 switch.
- `MANUAL_APPROVAL_REQUIRED`: review and approve manually before migration.
- `CAN_CREATE_CANONICAL_ENTITY_LATER`: canonical entity appears needed, but P0.9a does not create it.
- `CAN_CREATE_TARGET_PROFILE_DRAFT_LATER`: target profile draft may be created later after review.
- `CAN_AUTO_COLLAPSE_IN_FUTURE`: safe-looking collapse candidate for a future approved migration.
- `NEEDS_SOURCE_DATA_FIX`: source value is blank/unusable.
- `NEEDS_ALIAS_CLEANUP`: alias/catalog conflict must be cleaned up manually.
- `IGNORE_FOR_NOW`: informational/non-blocking item.

P1.0 gate rules:

- Any unresolved high-risk entity or target profile group keeps `p10Gate.status = BLOCKED`.
- Zero active approved `target_profiles` keeps the gate blocked.
- `NO_ACTIVE_TARGET_PROFILE` for most resolver-v2 resolved rows keeps the gate blocked.
- KPI comparison must exist and be reviewed before the gate can pass.

Read-only KPI compare scaffold:

```bash
pnpm bc:kpi-compare-v1-v2
```

Outputs:

- `.tmp/bc-kpi-compare-v1-v2.csv`
- `.tmp/bc-kpi-compare-v1-v2.json`

If P0.9a is blocked, the KPI compare scaffold returns `P1.0_BLOCKED_BY_HIGH_RISK_REVIEW`. It does not switch dashboard logic and does not write database rows.

P1.0 feature flags remain planned and default to v1 behavior:

```text
BC_ENTITY_RESOLVER_VERSION=v1
BC_TARGET_LOOKUP_VERSION=v1
```

### Business Central P0.9b resolution package

Use P0.9b to generate human-reviewable planning templates from P0.9/P0.9a findings:

```bash
pnpm bc:resolution-package
```

Output folder:

- `.tmp/bc-resolution-package/summary.json`
- `.tmp/bc-resolution-package/canonical-entity-creation-plan.csv`
- `.tmp/bc-resolution-package/alias-cleanup-review-plan.csv`
- `.tmp/bc-resolution-package/target-profile-seed-draft-plan.csv`
- `.tmp/bc-resolution-package/manual-approval-queue.csv`
- `.tmp/bc-resolution-package/blocked-groups-checklist.csv`
- `.tmp/bc-resolution-package/README.md`

Review order:

1. Review canonical entity creation plan.
2. Review alias cleanup plan.
3. Review target profile seed drafts.
4. Approve or manually fill target_qty where needed.
5. Re-run P0.9/P0.9a dry-run commands.
6. Only then consider P1.0.

Safety:

- The package is export/template only.
- Do not insert/update/delete `target_profiles` from the package.
- Do not update `production_outputs.entity_id` from the package.
- Do not delete/deactivate aliases or conditional rules from the package.
- Do not create broad/global aliases to clear blockers.
- Do not switch dashboard behavior while `summary.json` reports P1.0 readiness as blocked.

Safety notes:

- The command reads `source_system = 'business-central'` rows and active master entity/catalog data only.
- It never updates `production_outputs.entity_id`, aliases, conditional rules, targets, target formulas, reject formulas, or dashboard KPI formulas.
- `Machine_Center_No` is treated as routing evidence and fallback only when `gProdOrRotLine_Description` and `gProdOrRotLine_No` are blank.
- Target bucket output is only a candidate for later P0.8+ work; it is not used for dashboard target lookup yet.

The dashboard contract is documented in `docs/BC_METRIC_CONTRACT.md`. In short: production dashboard scope is `source_system = 'business-central'` and `entry_type = 'Output'`; other entry types remain stored for future panels; negative Output quantity is a correction; main output is net output; missing targets produce `N/A`, not zero; unmapped machines remain visible as data-quality gaps. Aggregate target coverage can reconcile while per-item resume rows still show `N/A` because aggregate achievement uses mapped entity-days and the resume keeps unmapped groups visible for mapping work.

Business Central entity source priority is `machine_description` when a true BC machine-description field exists, then `Machine Center No`, then `Production Line Description`, then `Production Line No`. The current profiled OData endpoint does not expose a true `Machine_Description`; it exposes `gProdOrRotLine_No` and `gProdOrRotLine_Description` as reliable production-line source fields. `gSrcDesc` is item/reject/sparepart description and must not be used as machine, line, or machine description.

If diagnostics show many `source_field=blank` rows because historical Business Central rows have blank `prod_line_no` or `prod_line_description`, run the dry-run source-fields backfill. The legacy command remains available for compatibility:

```bash
pnpm bc:backfill-machine-description
pnpm bc:backfill-source-fields
```

Review `Rows with missing source fields`, `Rows matched in Business Central`, `Rows updateable prod_line_no`, `Rows updateable prod_line_description`, `Rows updateable machine_description: 0`, `Rows without source values`, `Rows not found in BC`, `Pages fetched`, and the sample updates. Commit only after explicit approval and only when the sample updates are safe:

```bash
BC_MACHINE_DESCRIPTION_BACKFILL_COMMIT=true pnpm bc:backfill-machine-description
BC_SOURCE_FIELDS_BACKFILL_COMMIT=true pnpm bc:backfill-source-fields
```

The backfill is non-destructive. It matches by `Entry_No`, fills only null/blank `prod_line_no <= gProdOrRotLine_No` and `prod_line_description <= gProdOrRotLine_Description`, and never writes `machine_description`, `gSrcDesc`, quantities, item/document fields, target fields, classification fields, or reject fields. It does not reload, truncate, delete, reclassify OK/reject rows, or overwrite non-blank production-line values. After commit, re-run `pnpm bc:daily-item-resume`, `pnpm bc:reconcile`, and `pnpm bc:target-coverage`; `source_field=blank` should decrease, production-line source usage should increase, and `UNMAPPED_ENTITY` may decrease if matching aliases already exist. OK output and reject KG should not change from this enrichment alone.

`/overview` daily item resume keeps `machineLabel` as the canonical/entity/source label used for matching, target resolution, diagnostics, and grouping. The table `Mesin` column uses `machineDisplay` as a short UI-only label, for example `Borche 1 - Preform 19.0 / 19.1 gram` displays as `Borch 1`; target matching still uses the canonical label and reviewed aliases.

`External_Document_No` uses the `SHIFT/HOURS/OPERATOR` convention when available. Example: `S1/8/RAHMAT` parses as shift `S1`, work hours `8`, and operator `RAHMAT`. Parsed hours drive per-row prorata target as `dailyTarget * workHours / 24`; malformed or missing values use the current fallback and are exposed as unparsed details.

### Master data mapping operations

Use `/master-data` when live BC rows are loaded but dashboard achievement is still `N/A` because output rows are unmapped. The Mapping Center is the reviewed bridge from raw Business Central values to internal master entities.

Safe review flow:

1. Open `/master-data`.
2. Review overview cards for active entities, aliases, unmapped rows, target gaps, and conversion gaps.
3. In Alias Mapping Center, filter by source field or source value.
4. Select an unmapped group such as a machine description, machine center, or production line.
5. Choose an existing canonical entity, or create the entity first if it truly does not exist.
6. Preview affected rows.
7. Commit only after the affected row count and entity are correct.
8. Re-run `pnpm bc:target-coverage` and `/overview` to verify rows moved from `UNMAPPED_ENTITY` to `COVERED` or a specific target reason.

Mapping priority:

1. Preferred raw source group: `machine_description` only when a true BC field exists, then `machine_center_no`, then `prod_line_description`, then `prod_line_no`.
2. Active exact alias for `business-central` + source field + source value.
3. Active normalized alias after trimming, uppercasing, collapsing whitespace, and removing common separators.
4. Exact `master_entities.entity_code`.
5. Leave unmapped and classify as `UNMAPPED_ENTITY`.

Operational commands:

```bash
pnpm bc:mapping-candidates
pnpm bc:mapping-plan
pnpm bc:mapping-plan-apply

SOURCE_FIELD=machine_description \
SOURCE_VALUE="REPACKING" \
ENTITY_ID="00000000-0000-0000-0000-000000000000" \
pnpm bc:mapping-apply

SOURCE_FIELD=machine_description \
SOURCE_VALUE="REPACKING" \
ENTITY_ID="00000000-0000-0000-0000-000000000000" \
APPLY_MAPPING_COMMIT=true \
pnpm bc:mapping-apply
```

`pnpm bc:mapping-candidates` is read-only and shows current mapped/unmapped counts, coverage percentage, preferred source-field usage, top unmapped groups by machine description, machine center fallback, production line, combined context, item family, month, row count, and OK quantity. Suggestions are scored as HIGH, MEDIUM, or LOW and show whether the suggested entity has an approved/active target.

Mapping Preview should work with empty/non-empty search, source-field filters, and selected source groups. The preview SQL explicitly types/binds nullable parameters; the historical PostgreSQL error `could not determine data type of parameter $3` came from a skipped `$3` placeholder and is covered by regression tests.

`pnpm bc:mapping-plan` writes `.tmp/mapping-plan/business-central-mapping-plan.csv`. Every row defaults to `action=REVIEW`; the command never marks a row `COMMIT`. Review the source value, normalized value, row count, OK quantity, suggested entity, confidence, reason, and target flag before editing the CSV.

`pnpm bc:mapping-plan-apply` is a dry-run unless `MAPPING_PLAN_COMMIT=true` is set. It reads `MAPPING_PLAN_FILE` or the default CSV path, applies only rows with `action=COMMIT`, skips LOW confidence and blank source values, creates missing aliases, updates only unmapped matching `production_outputs` rows, resolves related unmapped-entity data-quality issues, and writes an audit log. It does not overwrite existing mapped rows.

Commit reviewed CSV rows only after backup and review:

```bash
MAPPING_PLAN_FILE=.tmp/mapping-plan/business-central-mapping-plan.csv \
MAPPING_PLAN_COMMIT=true \
pnpm bc:mapping-plan-apply
```

`pnpm bc:mapping-apply` remains available for a single reviewed source value and is also dry-run by default; it mutates only when `APPLY_MAPPING_COMMIT=true` is set.

Do not map low-confidence source values just to make achievement numeric. If a source group is operationally ambiguous, leave it unmapped and ask PPIC/production owners to confirm the canonical entity.

Source-specific reset/remap is available in `/master-data` when a reviewed Business Central source value needs to return to mapping review. Use the Reset / Remap Source panel, select exactly one source field (`prod_line_description`, `prod_line_no`, `machine_center_no`, or `machine_description`) and one source value, then run preview first. Preview is read-only and shows total matching `production_outputs` rows, currently mapped rows, active aliases that would be deactivated, affected master entities, and the KPI warning.

Commit requires the preview, the acknowledgement checkbox, and typing `RESET`. The commit runs in a transaction, sets `production_outputs.entity_id = null` only for matching `source_system = 'business-central'` rows, deactivates matching active aliases for the same source field/value, updates timestamps, and writes an audit log. It does not change output quantity, reject quantity, item/document fields, target rows, sync runs, or raw Business Central source fields. There is intentionally no reset-all Business Central mapping action. After commit, continue mapping review or run:

```bash
pnpm bc:mapping-candidates
pnpm bc:mapping-plan
pnpm bc:daily-item-resume
pnpm bc:reconcile
```

Reviewed conditional mapping is available in `/master-data` for ambiguous Business Central source values that cannot safely become one broad alias, such as `machine_center_no = OMSO1 OZ`. Use the Conditional Mapping Rule panel to quick-fill from an unmapped source row when available, choose the source field/value, enter a narrow item/product condition, search and select the target entity, then run preview before commit. The panel also shows existing active rules for the selected source value.

Conditional mapping resolver order is exact reviewed alias first, exactly one matching conditional rule second, existing fallback only when no reviewed conditional rules exist for that source value, then unmapped. If no condition matches a source that has reviewed conditional rules, the row remains unmapped. If multiple rules match, the row remains unmapped and sync records a `CONDITIONAL_MAPPING_REVIEW` warning. Conditional commits update only currently unmapped rows matching both source and condition; they do not overwrite rows mapped to a different entity unless Reset / Remap Source is used first.

Supported condition types are `item_description_pattern`, `item_no_pattern`, `item_category_code`, `inferred_target_bucket`, and `gross_weight_range`. For OMSO-style review, prefer narrow rules such as:

- `item_description_pattern = 22 OZ` mapped to `OMSO 1-OZ - Printing 22 OZ`
- `item_description_pattern = 12 OZ`, `14 OZ`, `16 OZ`, or `18 OZ`, or `inferred_target_bucket = target_printing_oz_lt_20`, mapped to `OMSO 1-OZ - Printing OZ < 20`
- A non-OZ rule only when item/category evidence explicitly indicates printing with no OZ size, mapped to `OMSO 1-OZ - Printing non-OZ`

Preview first from the UI or API. The UI displays the target entity, `totalMatchingRows`, `conditionMatchingRows`, `currentlyMappedRows`, `alreadyMappedDifferentEntityRows`, `eligibleRows`, `estimatedTargetEligibilityChange`, `conditionMatchingOkQty`, sample `entryNo`/`itemNo`/`itemDescription`/`documentNo`, and warnings. Commit remains disabled until a successful preview exists and the operator types `COMMIT`.

API preview:

```bash
curl -b /tmp/poip.cookies \
  -H "content-type: application/json" \
  -X POST http://localhost:4000/api/v1/master/business-central/conditional-mapping/preview \
  --data '{
    "sourceField": "machine_center_no",
    "sourceValue": "OMSO1 OZ",
    "conditionType": "item_description_pattern",
    "conditionValue": "22 OZ",
    "entityId": "00000000-0000-0000-0000-000000000000"
  }'
```

Commit only after reviewing the preview counts, sample item/document rows, and warnings:

```bash
curl -b /tmp/poip.cookies \
  -H "content-type: application/json" \
  -X POST http://localhost:4000/api/v1/master/business-central/conditional-mapping/commit \
  --data '{
    "sourceField": "machine_center_no",
    "sourceValue": "OMSO1 OZ",
    "conditionType": "item_description_pattern",
    "conditionValue": "22 OZ",
    "entityId": "00000000-0000-0000-0000-000000000000",
    "confirmation": "COMMIT"
  }'
```

Remaining LOW-confidence or ambiguous mapping candidates still require data-owner review before any remap or alias commit.

Conditional rule deletion/deactivation is not exposed in P0.5b. If a rule must be retired, review `audit_logs` and handle it through a targeted admin/database procedure until a dedicated safe UI is added.

Rollback should use a PostgreSQL backup restore whenever possible. A targeted rollback must be reviewed from `audit_logs` and aliases with `source = 'mapping-plan'`; unmap only rows updated by the reviewed plan, deactivate or delete only the inserted aliases, then re-run:

```bash
pnpm bc:profile
pnpm bc:mapping-candidates
pnpm bc:target-coverage
pnpm bc:reconcile
```

### V1 master-data import

Milestone 11.1 can seed real v1 master entities, aliases, approved targets, and stable item gross-weight mappings from the local export in `.tmp/v1-inspection/`. It does not read SSH or secrets.

Dry-run and reconcile first:

```bash
pnpm v1:master-profile
pnpm v1:master-import
pnpm v1:master-reconcile
```

Commit only after the dry-run counts and conflict list are reviewed:

```bash
V1_MASTER_IMPORT_COMMIT=true pnpm v1:master-import
```

The importer is idempotent. It does not overwrite existing manual v2 rows unless `V1_IMPORT_ALLOW_UPDATE=true` is also set. In commit mode it writes a system audit row, imports only stable item/UOM gross-weight mappings, and updates only unmapped matching `production_outputs.entity_id` rows by default. Ambiguous v1 machine aliases remain unmapped.

Rollback should prefer a PostgreSQL backup restore. A targeted rollback must use the audit row and imported alias source `v1-master-import` to unmap outputs, remove imported conversion mappings, remove imported targets/aliases, and delete master entities only after confirming no references remain.

Full details: `docs/V1_MASTER_DATA_MIGRATION_PLAN.md`.

### Conversion gap operations

Use `/master-data` → Conversion Gap View when reject PCS equivalent is incomplete.

1. Review the daily item resume gap breakdown first. If the reason is `REJECT_ONLY` or `AMBIGUOUS_REJECT_ATTACHMENT`, resolve the attachment/data issue before adding conversion data.
2. For attached rows with missing OK-item gross weight, review the OK item/UOM group and enter the reviewed gross weight per PCS for that exact OK item/UOM.
3. Commit only after checking the affected row count.
4. Re-run `pnpm bc:daily-item-resume` and `pnpm bc:reconcile` to verify conversion gaps decreased.

Conversion commits update only rows where `reject_pcs_eq` or `gross_weight_per_pcs` is missing/invalid. They do not overwrite already converted rows.

Reject KG and reject PCS equivalent are different metrics. Reject KG always remains the source weight aggregate. Reject PCS equivalent is calculated as `reject kg / matched OK item gross weight per PCS` and is `N/A` when the OK gross weight or deterministic attachment is not available. Do not use the RJ item gross weight to fill this conversion.

## Data quality operations

Use `/data-quality` to review issues. Status actions:

- Acknowledge: issue is known and under review.
- Resolve: issue has been corrected or accepted with a required note.
- Ignore: issue is intentionally excluded with a required note.

### Business Central Data Quality automation

P0.6 adds a manual generator for actionable Business Central diagnostics:

```bash
curl -b /tmp/poip.cookies \
  -X POST http://localhost:4000/api/v1/data-quality/business-central/generate
```

The same action is available in `/data-quality` for users with `settings.manage`. The generator creates or updates grouped issues for:

- `BC_UNMAPPED_SOURCE`
- `BC_CONDITIONAL_MAPPING_REVIEW`
- `BC_TARGET_MISSING`
- `BC_NO_ACTIVE_TARGET`
- `BC_REJECT_PCS_INCOMPLETE`
- `BC_AMBIGUOUS_REJECT_ATTACHMENT`

Each generated issue uses a stable `sourceRef` dedupe key and includes source field/value, normalized value, row count, OK quantity impact, posting-date range, document/item samples, suggested target entities where available, recommended action, and a UI hint. Re-running the generator updates the existing issue instead of inserting duplicates. Active generated issues are auto-resolved only when the corresponding source gap is no longer present; ignored issues remain visible as ignored history.

Recommended actions are intentionally conservative:

- Ambiguous OMSO/printing groups: use a Conditional Mapping Rule, not a broad alias.
- Unmapped groups without a candidate: review or create master entity/alias.
- Target gaps: create or approve the target for the entity-day/month.
- Reject PCS incomplete: review reject attachment or gross-weight conversion source.
- Ambiguous reject attachment: review candidate OK rows and attach deterministically.

The generator writes only `data_quality_issues` and audit logs. It does not change dashboard KPI formulas, target formulas, reject formulas, production output quantities, aliases, conditional rules, targets, or conversion mappings. It is not hooked into every successful sync yet because the aggregation can scan Business Central history; run it manually after sync/backfill or after mapping/target review when operators need a fresh issue queue.
- Reopen: brings resolved/ignored issues back into the active queue.

All status changes write audit events.

## Audit operations

Use `/settings/audit` to filter by entity/module, action, actor, entity ID, and date. Audit before/after payloads are redacted for credentials, tokens, raw source payloads, source text, and stored file paths.

Audit logs are append-only at the application level. Do not edit or delete audit rows manually.

## Backup notes for v2

At minimum, schedule a PostgreSQL logical backup outside the app:

```bash
docker exec poip-postgres pg_dump -U ppic_app -d ppic_output_intelligence --format=custom > poip-$(date +%Y%m%d-%H%M).dump
```

Basic restore pattern for a non-production rehearsal database:

```bash
createdb ppic_output_intelligence_restore
pg_restore --dbname=ppic_output_intelligence_restore poip-YYYYMMDD-HHMM.dump
```

Before production restore, stop API/web/worker, take a fresh backup, and document who approved the restore.

## Logs

API request logs include request ID, user ID when available, route, status code, and duration. Do not log passwords, tokens, Business Central credentials, or raw uploaded/parser text.

## Incident notes

For v2, record:

- Time detected.
- Affected workflow.
- Latest health/readiness state.
- Latest sync/import/parser run ID if relevant.
- Operator action taken.
- Whether rollback or restore was needed.

Formal SLO/SLA, alert routing, and observability platforms are deferred to PRD v3.

<!-- P0_2_MAPPING_ACCURACY_OPERATIONS -->
## P0.2-P0.8 Business Central Mapping Accuracy Operations

After P0.1, calculation correctness depends on safely reducing unmapped Business Central source groups without weakening target/reject safeguards.

Primary roadmap:

- `docs/P0_2_BC_MAPPING_ACCURACY_ROADMAP.md`
- `docs/OPENCLAW_P0_2_MAPPING_ACCURACY_PROMPTS.md`

Recommended operator loop:

```bash
pnpm bc:mapping-candidates
pnpm bc:mapping-plan
pnpm bc:mapping-plan-apply
pnpm bc:daily-item-resume
pnpm bc:reconcile
pnpm bc:target-coverage
```

Rules:

1. Treat `unmapped_ok_qty` impact as more important than raw unmapped row count.
2. Do not auto-map LOW or ambiguous rows.
3. Review `REPACKING`, `OMSO`, `POLYPRINT`, `HENGFENG`, and `LS1` variants with the data owner.
4. Use source-specific reset/remap when a source value was mapped incorrectly.
5. Keep missing target states as `N/A`; never force zero or fake targets.
6. Keep reject rate as `N/A` while Reject PCS Eq is incomplete.
7. Re-run diagnostics after every mapping commit.
8. Record any UAT mapping decision in an ops note.

<!-- BC_ENTITY_TARGET_REDESIGN_ROADMAP_START -->

## Business Central Entity & Target Redesign Roadmap

This section tracks the safe redesign from complex Business Central entity aliases to canonical entity resolution and target profiles.

Primary docs:

```text
docs/BC_ENTITY_TARGET_REDESIGN_ROADMAP.md
docs/BC_ENTITY_RESOLVER_V2_DESIGN.md
docs/BC_TARGET_PROFILES.md
docs/BC_ENTITY_TARGET_MIGRATION_PLAN.md
docs/BC_ENTITY_TARGET_RELEASE_NOTES.md
```

### Phase order

```text
P0.7 Entity Resolver V2 Dry Run
P0.8 Target Profile Model Design
P0.9 Backfill Plan & Migration Dry Run
P1.0 Controlled Switch to Resolver V2 + Target Profiles
```

### Safety rule

```text
Do not switch dashboard KPI behavior before P0.7, P0.8, and P0.9 dry-run reports are reviewed.
```

### P0.7 planned command

```bash
pnpm bc:entity-v2-dry-run
```

Expected outputs:

```text
.tmp/bc-entity-v2-dry-run.csv
.tmp/bc-entity-v2-dry-run.json
```

### P0.8 target profile model

Target lookup should eventually use:

```text
entity_id
+ target_bucket
+ optional machine_center_no
+ posting_date effective range
```

P0.8 adds the model and dry-run only:

```bash
pnpm bc:target-profile-dry-run
```

It does not migrate old targets into `target_profiles`, does not switch dashboard target lookup, and does not run backfill.

### P0.9 planned dry-run commands

```bash
pnpm bc:entity-v2-backfill-dry-run
pnpm bc:target-profile-backfill-dry-run
```

Expected outputs:

```text
.tmp/bc-entity-v2-backfill-dry-run.csv
.tmp/bc-entity-v2-backfill-dry-run.json
.tmp/bc-target-profile-backfill-dry-run.csv
.tmp/bc-target-profile-backfill-dry-run.json
```

### P1.0 planned comparison command

```bash
pnpm bc:kpi-compare-v1-v2
```

Expected outputs:

```text
.tmp/bc-kpi-compare-v1-v2.csv
.tmp/bc-kpi-compare-v1-v2.json
```

### Feature flags planned for P1.0

```text
BC_ENTITY_RESOLVER_VERSION=v1|v2
BC_TARGET_LOOKUP_VERSION=v1|target_profiles
```

### Do not do during transition

```text
Do not delete old aliases.
Do not delete conditional rules.
Do not delete old detailed entities.
Do not update production_outputs.entity_id without approved dry-run report.
Do not create broad/global aliases to force ambiguous mappings.
```

### Validation baseline

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

<!-- BC_ENTITY_TARGET_REDESIGN_ROADMAP_END -->

<!-- BC_MILESTONE_CONFLICT_RESOLUTION_START -->

## Business Central Milestone Conflict Resolution

Use `docs/BC_MILESTONE_NAMESPACE.md` as the source of truth for Business Central milestone IDs.

Active roadmap:

```text
P0.7 = Entity Resolver V2 Dry Run
P0.8 = Target Profile Model
P0.9 = Backfill / Migration Dry Run
P1.0 = Controlled Switch to Resolver V2 + Target Profiles
```

Legacy roadmap references:

```text
Legacy P0.7 Reject Attachment Review Queue -> BC-RJ-1
Legacy P0.8 V1 parity closeout -> BC-V1-CLOSEOUT
```

Operational rule:

```text
When a prompt says P0.7, implement Entity Resolver V2 Dry Run, not the legacy reject attachment queue.
```

<!-- BC_MILESTONE_CONFLICT_RESOLUTION_END -->
