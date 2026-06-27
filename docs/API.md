# API Endpoints

Implemented backend endpoints for the PPIC Output Intelligence Platform.

Base URL for local development:

```text
http://localhost:4000/api/v1
```

All non-public endpoints require authentication through the local session cookie or bearer token. Responses use the standard API envelope:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "requestId": "request-id",
    "generatedAt": "2026-06-23T00:00:00.000Z"
  }
}
```

Error responses use:

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  },
  "meta": {
    "requestId": "request-id"
  }
}
```

## Health

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | API health check. |
| `GET` | `/health/readiness` | `settings.manage` | Deep readiness for PostgreSQL, migrations, Redis, queue workers, sync freshness, and latest operational runs. |
| `GET` | `/health/deep` | `settings.manage` | Alias for the deep readiness response. |

## Auth

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | Public | Local email/password login. Sets session cookie and returns token/user. |
| `POST` | `/auth/logout` | Authenticated | Clears session cookie and writes logout audit log. |
| `GET` | `/auth/me` | Authenticated | Returns the current authenticated principal. |

## Users

All user endpoints require `users.manage`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/users` | List users and roles. |
| `POST` | `/users` | Create a user with roles. |
| `PATCH` | `/users/:id` | Update user name, active flag, or roles. |
| `POST` | `/users/:id/disable` | Disable a user. |

## Dashboard

All dashboard endpoints require `dashboard.view`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/dashboard/summary` | KPI summary for selected filters/date range. |
| `GET` | `/dashboard/trends` | Output trends grouped by business date. |
| `GET` | `/dashboard/breakdowns` | Output breakdown by `machine`, `entity`, `item`, or `shift`. |

Common query filters: `from`, `to`, `entityId`, `machine`, `item`, `shiftCode`.

## Outputs

All output endpoints require `output.view`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/outputs` | Paginated production output list with filters and sorting. |
| `GET` | `/outputs/:id` | Production output detail. |

Common query filters: `from`, `to`, `entityId`, `machine`, `item`, `shiftCode`, `page`, `pageSize`, `sortBy`, `sortDirection`.

## Sync

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `POST` | `/sync/odata/run` | `sync.run` | Trigger incremental OData sync job. |
| `POST` | `/sync/odata/resync-range` | `sync.run` | Trigger OData resync for a date range. |
| `GET` | `/sync/status` | `sync.view` | Latest sync/checkpoint status. |
| `GET` | `/sync/runs` | `sync.view` | Sync run history. |
| `GET` | `/sync/runs/:id` | `sync.view` | Sync run detail. |

Useful query params: `sourceSystem`, `limit`.

## Targets

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/targets/entities` | `target.view` | List active target entities. |
| `GET` | `/targets` | `target.view` | List production targets with filters. |
| `GET` | `/targets/:id` | `target.view` | Target detail. |
| `POST` | `/targets` | `target.create` | Create draft target. |
| `PATCH` | `/targets/:id` | `target.create` | Update draft target. |
| `POST` | `/targets/:id/submit` | `target.create` | Submit target for approval. |
| `POST` | `/targets/:id/approve` | `target.approve` | Approve target and supersede overlapping active targets. |
| `POST` | `/targets/:id/reject` | `target.approve` | Reject submitted target. |
| `POST` | `/targets/:id/deactivate` | `target.create` | Deactivate target. |

Common query filters: `from`, `to`, `entityId`, `machine`, `itemNo`, `shiftCode`, `status`.

## Downtime

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/downtime/entities` | `downtime.view` | List active downtime entities. |
| `GET` | `/downtime` | `downtime.view` | Paginated downtime event list with filters. |
| `GET` | `/downtime/:id` | `downtime.view` | Downtime event detail. |
| `POST` | `/downtime` | `downtime.create` | Create downtime event. |
| `PATCH` | `/downtime/:id` | `downtime.update` | Update an open downtime event. |
| `POST` | `/downtime/:id/close` | `downtime.close` | Close downtime event with root cause/action. |

Common query filters: `from`, `to`, `entityId`, `machine`, `status`, `category`, `shiftCode`, `page`, `pageSize`.

## WhatsApp Parser

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `POST` | `/parser/wa/preview` | `parser.preview` | Parse pasted WhatsApp operational text and store preview rows. |
| `GET` | `/parser/wa/runs` | `parser.preview` | Parser run history. |
| `GET` | `/parser/wa/runs/:id` | `parser.preview` | Parser run detail and rows. |
| `POST` | `/parser/wa/runs/:id/commit` | `parser.commit` | Commit selected or all valid parser rows. |

Commit body can be `{}` to commit all valid rows, or:

```json
{
  "selectedRowIds": ["row-uuid"]
}
```

## Import Center

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `POST` | `/imports/preview` | `import.preview` | Upload CSV/XLSX file for dry-run downtime import preview. |
| `GET` | `/imports/runs` | `import.preview` | Import run history. |
| `GET` | `/imports/runs/:id` | `import.preview` | Import run detail and rows. |
| `GET` | `/imports/runs/:id/errors` | `import.preview` | Error report content for invalid/duplicate/conflict rows. |
| `POST` | `/imports/runs/:id/commit` | `import.commit` | Commit selected or all valid import rows to downtime events. |

Preview uses multipart form data:

```bash
curl -b /tmp/poip.cookies \
  -X POST http://localhost:4000/api/v1/imports/preview \
  -F importType=downtime \
  -F file=@/path/to/downtime.csv
```

Commit body can be `{}` to commit all valid rows, or:

```json
{
  "selectedRowIds": ["row-uuid"]
}
```

## Data Quality

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/data-quality/summary` | `data_quality.view` | Data quality issue counts and summary. |
| `GET` | `/data-quality/issues` | `data_quality.view` | Paginated issues filtered by status, severity, source, issue code, and date. |
| `GET` | `/data-quality/issues/:id` | `data_quality.view` | Redacted issue detail and source context. |
| `POST` | `/data-quality/business-central/generate` | `settings.manage` | Generate/update Business Central diagnostic issues for unmapped sources, conditional mapping reviews, target gaps, and reject PCS gaps. |
| `POST` | `/data-quality/issues/:id/acknowledge` | `settings.manage` | Mark an open issue as acknowledged. |
| `POST` | `/data-quality/issues/:id/resolve` | `settings.manage` | Resolve an active issue with a required note. |
| `POST` | `/data-quality/issues/:id/ignore` | `settings.manage` | Ignore an active issue with a required note. |
| `POST` | `/data-quality/issues/:id/reopen` | `settings.manage` | Reopen a resolved or ignored issue. |

Business Central generation is a manual P0.6 operation. It does not change production output quantities, KPI formulas, targets, aliases, conditional rules, or conversion mappings. It creates or updates grouped issues using stable `sourceRef` dedupe keys and resolves active generated issues only when the source gap is no longer present.

Generated issue codes:

- `BC_UNMAPPED_SOURCE`
- `BC_CONDITIONAL_MAPPING_REVIEW`
- `BC_TARGET_MISSING`
- `BC_NO_ACTIVE_TARGET`
- `BC_REJECT_PCS_INCOMPLETE`
- `BC_AMBIGUOUS_REJECT_ATTACHMENT`

Example response:

```json
{
  "created": 6,
  "updated": 2,
  "unchanged": 18,
  "resolved": 1,
  "byType": {
    "BC_UNMAPPED_SOURCE": { "created": 3, "updated": 1, "unchanged": 10, "resolved": 0 }
  },
  "bySeverity": {
    "CRITICAL": { "created": 1, "updated": 0, "unchanged": 2, "resolved": 0 }
  }
}
```

## Master Data and Mapping

Read endpoints require `master_data.view`. Write endpoints require `master_data.manage` and create audit logs.

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/master/overview` | `master_data.view` | Master data summary cards for entities, aliases, unmapped groups, target gaps, and conversion gaps. |
| `GET` | `/master/entities` | `master_data.view` | Paginated master entity list. |
| `POST` | `/master/entities` | `master_data.manage` | Create a canonical master entity. |
| `GET` | `/master/entities/:id` | `master_data.view` | Entity detail with aliases. |
| `PATCH` | `/master/entities/:id` | `master_data.manage` | Update a master entity. |
| `POST` | `/master/entities/:id/aliases` | `master_data.manage` | Create a reviewed Business Central alias for an entity. |
| `PATCH` | `/master/entities/:id/aliases/:aliasId` | `master_data.manage` | Update alias metadata or active state. |
| `DELETE` | `/master/entities/:id/aliases/:aliasId` | `master_data.manage` | Deactivate an alias. |
| `GET` | `/master/mapping/unmapped-sources` | `master_data.view` | Paginated unmapped BC source groups with candidate entities. |
| `GET` | `/master/mapping/suggestions` | `master_data.view` | Candidate entity suggestions for one source value. |
| `POST` | `/master/mapping/apply/preview` | `master_data.view` | Dry-run mapping preview with affected row count and samples. |
| `POST` | `/master/mapping/apply/commit` | `master_data.manage` | Create/reuse alias and map matching unmapped `production_outputs` rows. |
| `POST` | `/master/business-central/mapping-reset/preview` | `master_data.view` | Dry-run source-specific BC mapping reset preview for one whitelisted source field/value. |
| `POST` | `/master/business-central/mapping-reset/commit` | `master_data.manage` | Reset matching BC `production_outputs.entity_id` values to null and deactivate matching aliases after explicit `RESET` confirmation. |
| `POST` | `/master/business-central/conditional-mapping/preview` | `master_data.view` | Dry-run reviewed conditional rule for one whitelisted BC source field/value and item/product condition. |
| `GET` | `/master/business-central/conditional-mapping/rules` | `master_data.view` | List active reviewed conditional rules, filterable by `sourceField` and `sourceValue`, including target entity summary. |
| `POST` | `/master/business-central/conditional-mapping/commit` | `master_data.manage` | Create/update reviewed conditional rule and map only currently unmapped rows matching both source and condition after explicit `COMMIT` confirmation. |
| `GET` | `/master/mapping/target-coverage` | `master_data.view` | Target coverage grouped by month/entity/source group and reason. |
| `GET` | `/master/mapping/conversion-gaps` | `master_data.view` | Reject conversion gaps grouped by item/UOM. |
| `POST` | `/master/mapping/conversions` | `master_data.manage` | Create item/UOM gross-weight mapping. |
| `POST` | `/master/mapping/conversions/apply/preview` | `master_data.view` | Dry-run conversion apply preview. |
| `POST` | `/master/mapping/conversions/apply/commit` | `master_data.manage` | Recompute missing reject PCS equivalent for reviewed item/UOM mapping. |

Conditional mapping is available in `/master-data` through the Conditional Mapping Rule panel. The UI searches target entities, loads active rules for the selected source value, runs preview, shows matching rows/counts/samples/warnings, and enables commit only after the operator types `COMMIT`.

Conditional mapping request bodies use `sourceField` (`machine_description`, `machine_center_no`, `prod_line_description`, or `prod_line_no`), `sourceValue`, `conditionType`, `conditionValue`, and `entityId`. Commit also requires `confirmation: "COMMIT"`. Supported condition types are `item_description_pattern`, `item_no_pattern`, `item_category_code`, `inferred_target_bucket`, and `gross_weight_range`.

Example preview for an ambiguous OMSO bucket:

```json
{
  "sourceField": "machine_center_no",
  "sourceValue": "OMSO1 OZ",
  "conditionType": "item_description_pattern",
  "conditionValue": "22 OZ",
  "entityId": "00000000-0000-0000-0000-000000000000"
}
```

Preview returns `targetEntity`, `totalMatchingRows`, `conditionMatchingRows`, `currentlyMappedRows`, `alreadyMappedDifferentEntityRows`, `eligibleRows`, `estimatedTargetEligibilityChange`, `conditionMatchingOkQty`, `samples`, and warnings. Commit never changes quantities, never creates a broad alias, and does not overwrite rows already mapped to a different entity; use Reset / Remap Source first when those rows need review. Rule deletion/deactivation is intentionally not exposed in this patch.

## Audit

Audit endpoints require `audit.view`. Returned before/after values redact credentials, tokens, raw payloads, source text, and stored file paths.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/audit` or `/audit-logs` | Paginated audit activity with entity, action, actor, entity ID, and date filters. |
| `GET` | `/audit/:id` or `/audit-logs/:id` | Human-readable audit detail with safe before/after values. |

## Frontend Routes

Primary frontend routes backed by these APIs:

| Path | Description |
| --- | --- |
| `/login` | Local login page. |
| `/overview` | Output dashboard and KPI read model. |
| `/downtime` | Downtime workflow. |
| `/tools/import-center` | CSV/XLSX Import Center. |
| `/tools/wa-parser` | WhatsApp parser workflow. |
| `/settings/sync` | Sync Center. |
| `/settings/targets` | Target Management. |
| `/settings/users` | User Management. |
| `/master-data` | Master Data and Mapping Center. |
| `/data-quality` | Data Quality Cockpit. |
| `/settings/audit` | Read-only Audit Viewer. |
| `/settings/health` | System Health and readiness dashboard. |
