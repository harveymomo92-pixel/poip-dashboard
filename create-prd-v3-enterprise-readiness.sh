#!/usr/bin/env bash
set -euo pipefail

BASE_PRD="${1:-docs/PRD.md}"
OUT_PRD="${2:-docs/PRD_v3.md}"

if [[ "$BASE_PRD" == "$OUT_PRD" ]]; then
  echo "ERROR: output tidak boleh sama dengan base PRD."
  echo "Contoh benar:"
  echo "  bash create-prd-v3-enterprise-readiness.sh docs/PRD.md docs/PRD_v3.md"
  exit 1
fi

if [[ ! -f "$BASE_PRD" ]]; then
  echo "ERROR: $BASE_PRD tidak ditemukan."
  echo "Jalankan dari root repo:"
  echo "  cd ~/dev/ppic-output-intelligence"
  echo "  bash create-prd-v3-enterprise-readiness.sh"
  exit 1
fi

mkdir -p "$(dirname "$OUT_PRD")"

if [[ -f "$OUT_PRD" ]]; then
  BACKUP_PATH="${OUT_PRD}.bak-$(date +%Y%m%d-%H%M%S)"
  cp "$OUT_PRD" "$BACKUP_PATH"
  echo "Backup PRD v3 lama dibuat:"
  echo "  $BACKUP_PATH"
fi

cp "$BASE_PRD" "$OUT_PRD"

cat >> "$OUT_PRD" <<'EOF'

---

# PRD v3 — Enterprise Readiness and Operational Excellence Backlog

## Purpose

PRD v3 captures the enterprise-grade improvements that are intentionally deferred from v2. The v2 scope should stay focused on completing the core PPIC platform, UI/UX polish, data quality, audit, health, production hardening, and UAT readiness.

v3 should start only after the v2 platform is stable, tested, demoable, and accepted by users.

## v3 Product Direction

The v3 goal is to transform the PPIC Output Intelligence Platform from a production-ready internal dashboard into an enterprise-grade operations platform with stronger security, observability, performance, reliability, release discipline, configurability, retention, exception handling, and disaster recovery.

## v3 Scope Boundary

v3 should not be started until:

- core dashboard and KPI flows are stable
- OData/mock sync is stable
- target management is stable
- downtime workflow is stable
- import center is stable
- WhatsApp parser is stable
- data quality, audit, and health features are stable
- UI/UX polish is complete
- UAT/demo data pack exists
- critical E2E flows exist or are planned
- production readiness basics are complete

---

## v3.1 Security Hardening and Compliance

### Goal

Harden authentication, authorization, sessions, sensitive actions, API access, headers, and secrets handling so the platform is safer for real internal production use.

### Scope

- Security headers.
- CSRF review and protection where applicable.
- Rate limiting for login and sensitive endpoints.
- Brute-force protection.
- Password policy.
- Session expiration behavior.
- Refresh behavior if applicable.
- Login, logout, and failed login audit.
- Permission matrix documentation.
- Admin action confirmation.
- Secrets management guide.
- Vulnerability scan command.
- Dependency security audit command.
- Secure error handling so internal details are not exposed to users.

### Suggested Tasks

- Add request rate limiting for authentication endpoints.
- Add failed-login tracking.
- Add temporary lockout or cooldown after repeated failures.
- Add audit events for login, logout, failed login, role change, password change, and user deactivation.
- Add security headers at API/web layer.
- Review cookie/session settings.
- Add permission matrix documentation.
- Add secure production environment checklist.
- Add `pnpm security:audit` or equivalent script if feasible.

### Acceptance Criteria

- Login brute-force attempts are mitigated.
- Sensitive user/admin actions are audited.
- Security headers are configured.
- Permission matrix is documented.
- Secrets handling is documented.
- Security audit commands are documented.
- No production secrets are committed.

---

## v3.2 Observability Metrics, Logs, and Traces

### Goal

Make the platform observable enough to diagnose slow APIs, failed syncs, stuck queues, bad imports, parser failures, database issues, and user-facing errors.

### Scope

- Structured JSON logs.
- Request ID / correlation ID.
- API latency metrics.
- Error rate metrics.
- Queue metrics.
- Sync duration metrics.
- Import duration metrics.
- Parser duration metrics.
- Slow query logging.
- Health and readiness expansion.
- Observability dashboard or admin page.
- OpenTelemetry-ready instrumentation if feasible.
- Prometheus metrics endpoint if feasible.
- Grafana dashboard template if feasible.

### Suggested Tasks

- Add correlation ID middleware.
- Return correlation ID in error responses.
- Add structured logs for API requests and background jobs.
- Add metrics for sync, import, parser, dashboard queries, and queue jobs.
- Add worker heartbeat metric.
- Add `/metrics` endpoint if feasible.
- Add docs for log fields and metric names.
- Add dashboard or docs for observing system health.

### Acceptance Criteria

- Every API request has a correlation ID.
- Errors can be traced through logs.
- Sync/import/parser durations are logged or measured.
- Queue status is visible.
- Slow operations can be diagnosed.
- Observability docs exist.

---

## v3.3 SLO, SLA, and Operational Quality Targets

### Goal

Define measurable operational quality targets so the platform has clear expectations for speed, freshness, reliability, and recovery.

### Scope

- API p95 latency target.
- Dashboard load target.
- Sync success rate target.
- Import preview/commit duration target.
- Parser preview/commit duration target.
- Data freshness thresholds.
- Uptime target.
- Recovery Time Objective.
- Recovery Point Objective.
- Error budget concept if useful.

### Example Targets

- Dashboard overview p95 load time below 1.5 seconds for normal operational data.
- API p95 latency below 500ms for common read endpoints.
- Import preview for 5,000 rows below 10 seconds in local benchmark.
- Parser preview for 1,000 lines below 5 seconds in local benchmark.
- Sync success rate target at least 99% in stable environments.
- Data freshness warning after 30 minutes without successful sync.
- Critical stale warning after 60 minutes.
- RTO target documented.
- RPO target documented.

### Acceptance Criteria

- SLO/SLA document exists.
- Freshness thresholds are documented.
- Performance targets are measurable.
- Recovery targets are documented.
- Dashboard/health page reflects freshness and critical thresholds where relevant.

---

## v3.4 Performance, Load Testing, and Large Dataset Validation

### Goal

Prove the platform remains usable with realistic large operational datasets.

### Scope

- Large dataset seed.
- Dashboard load test.
- Import large file test.
- Parser large text test.
- Sync batch test.
- API response time check.
- Memory usage check where feasible.
- Large table pagination check.
- Performance notes and known limits.

### Suggested Dataset Targets

- 100,000 production output rows.
- 10,000 downtime events.
- 10,000 data quality issues.
- 1,000 target records.
- 5,000-row import preview.
- 1,000-line WhatsApp parser preview.
- 365 days of realistic output history if feasible.

### Suggested Commands

- `pnpm seed:large`
- `pnpm perf:dashboard`
- `pnpm perf:import`
- `pnpm perf:parser`

### Acceptance Criteria

- Large dataset can be seeded locally.
- Dashboard remains responsive with large data.
- Import/parser large inputs are tested.
- Pagination prevents unbounded table rendering.
- Performance limitations are documented.

---

## v3.5 Database Indexing and Query Optimization

### Goal

Keep operational dashboards and tables fast as data grows.

### Scope

- Review dashboard queries.
- Review downtime queries.
- Review target queries.
- Review import/parser run queries.
- Review data quality issue queries.
- Add indexes for common filters.
- Add composite indexes for common access paths.
- Add pagination enforcement.
- Add query timeout handling where feasible.
- Add `EXPLAIN ANALYZE` notes for heavy queries.

### Recommended Index Areas

- `production_outputs(business_date, machine_code, item_code)`
- `production_outputs(source_type, source_run_id)`
- `downtime_events(started_at, machine_code, status)`
- `targets(period_type, period_start, machine_code, item_code, status)`
- `data_quality_issues(status, severity, created_at)`
- `audit_logs(entity_type, entity_id, created_at)`
- `import_runs(status, created_at)`
- `import_rows(run_id, status)`
- `parser_runs(status, created_at)`
- `parser_rows(run_id, status)`

### Acceptance Criteria

- Common dashboard queries have appropriate indexes.
- Heavy queries have documented explain plans.
- Tables use pagination where needed.
- No user-facing page performs unsafe unbounded queries.
- Performance tests pass for expected data volume.

---

## v3.6 Reliability, Queue Resilience, and Idempotency

### Goal

Make sync, import, parser, and background processing safe to retry and resilient to partial failures.

### Scope

- Retry policy.
- Dead-letter queue.
- Job timeout.
- Job deduplication.
- Worker heartbeat.
- Queue dashboard/status.
- Stuck job detection.
- Manual retry failed job.
- Idempotency key for commit actions.
- Safe retry for import/parser commits.
- Partial failure handling.
- Clear job status UX.

### Suggested Tasks

- Add job IDs and idempotency keys.
- Add safe retry for OData sync.
- Add safe retry for import commit.
- Add safe retry for WhatsApp parser commit.
- Add failed job review UI.
- Add manual retry action for admins.
- Add dead-letter handling.
- Add worker health to system health page.

### Acceptance Criteria

- Failed jobs can be reviewed.
- Failed jobs can be retried safely where appropriate.
- Import/parser commit retry does not create duplicates.
- Stuck jobs are detectable.
- Worker health is visible.
- Queue failures are audited and surfaced to users/admins.

---

## v3.7 Release Management and CI/CD

### Goal

Make releases repeatable, validated, and safe.

### Scope

- GitHub Actions CI.
- Lint/typecheck/test/build pipeline.
- Migration check.
- Docker build check.
- Smoke test after deploy.
- Release notes.
- Versioning strategy.
- Changelog.
- Tag convention.
- Branching/release process documentation.

### Suggested Files

- `.github/workflows/ci.yml`
- `.github/workflows/docker-build.yml`
- `docs/RELEASE_PROCESS.md`
- `docs/CHANGELOG.md`
- `docs/VERSIONING.md`
- `docs/CI_CD.md`

### Suggested Pipeline

- Pull request: lint, typecheck, test, build.
- Main branch: lint, typecheck, test, build, Docker build.
- Release tag: production artifact build and release notes.
- Deployment: migration check and smoke test.

### Acceptance Criteria

- CI runs on pull requests.
- Main branch validates build and tests.
- Docker build is validated.
- Release process is documented.
- Versioning and tag convention are documented.
- Smoke test process is documented.

---

## v3.8 Feature Flags and Configurable Business Rules

### Goal

Allow safe rollout and operational configuration without code changes.

### Scope

- Feature flag model/config.
- Admin settings UI.
- Enable/disable WA parser.
- Enable/disable Import Center.
- Enable/disable notification rules.
- Enable/disable demo mode.
- Configurable business thresholds:
  - stale data threshold
  - achievement good/warning/critical threshold
  - reject rate alert threshold
  - downtime long-open threshold
  - import duplicate behavior
  - parser commit behavior
  - working calendar
  - shift definitions

### Suggested Tasks

- Add feature flag config layer.
- Add settings UI for operational thresholds.
- Add audit logs for settings changes.
- Add permission guard for settings management.
- Ensure critical feature flags fail safely.
- Ensure demo mode cannot be enabled in production accidentally.

### Acceptance Criteria

- Key features can be enabled/disabled safely.
- Business thresholds can be configured.
- Settings changes are audited.
- Feature flags respect permissions.
- Dangerous settings cannot be changed without confirmation.

---

## v3.9 Data Retention, Archiving, and Cleanup

### Goal

Control database growth and make long-term operation sustainable.

### Scope

- Retention policy for sync runs.
- Retention policy for import/parser row details.
- Retention policy for failed jobs.
- Audit log retention policy.
- Archive strategy for old production output if needed.
- Cleanup job for expired temporary data.
- Storage growth dashboard or report.
- Documentation for retention settings.

### Example Retention Policy

- Parser row detail retained for 180 days.
- Import row detail retained for 180 days.
- Sync run detail retained for 365 days.
- Failed jobs retained for 90 days.
- Audit logs retained for at least 2 years or per company policy.
- Aggregated dashboard data retained longer than raw temporary rows.

### Acceptance Criteria

- Retention policy is documented.
- Cleanup/archive scripts exist where appropriate.
- Cleanup jobs are safe and auditable.
- Important audit records are not accidentally deleted.
- Storage growth can be reviewed.

---

## v3.10 Error Catalog and Exception UX

### Goal

Make errors consistent, understandable, traceable, and safe for users and developers.

### Scope

- Standard error response format.
- Error code catalog.
- User-facing error copy.
- Technical details hidden by default.
- Correlation ID shown on error pages and toast details.
- Retry guidance.
- Validation error consistency.
- Module-specific error codes.

### Example Error Codes

- `AUTH_PERMISSION_DENIED`
- `AUTH_SESSION_EXPIRED`
- `TARGET_OVERLAP`
- `TARGET_NOT_APPROVED`
- `DOWNTIME_ALREADY_CLOSED`
- `IMPORT_DUPLICATE_ROWS`
- `IMPORT_INVALID_FILE`
- `PARSER_NO_VALID_ROWS`
- `SYNC_ODATA_TIMEOUT`
- `DATA_QUALITY_UNKNOWN_MACHINE`
- `DATA_QUALITY_UNKNOWN_ITEM`
- `DATA_QUALITY_MISSING_GROSS_WEIGHT`

### Suggested Files

- `docs/ERROR_CODES.md`
- `docs/EXCEPTION_HANDLING.md`

### Acceptance Criteria

- API errors follow a consistent format.
- UI shows understandable error messages.
- Correlation ID appears for unexpected errors.
- Error catalog is documented.
- Validation errors are field-specific where applicable.

---

## v3.11 Operational Command Center

### Goal

Add a single operational cockpit for supervisors/admins to monitor the most important system and production states.

### Suggested Route

- `/operations`

### Scope

- Sync status.
- Worker status.
- Queue status.
- Open downtime.
- Critical data quality issues.
- Missing targets.
- Failed imports/parsers.
- Pending approvals.
- Latest alerts.
- Recent audit/activity.
- Stale data status.
- Quick actions based on permission.

### UX Direction

The page should answer:

- What needs attention now?
- What is broken or stale?
- What workflows are waiting?
- What should an operator/admin do next?

### Acceptance Criteria

- Command center summarizes key operational risks.
- Users see prioritized alerts/actions.
- Quick actions respect permissions.
- The page uses existing APIs where possible.
- The page does not duplicate every dashboard detail unnecessarily.

---

## v3.12 Disaster Recovery Drill

### Goal

Ensure backup, restore, rollback, and recovery procedures are tested and documented.

### Scope

- Restore drill guide.
- Backup verification.
- Simulated database restore.
- RTO/RPO checklist.
- Rollback rehearsal.
- Migration rollback notes.
- Production incident checklist.
- Recovery communication template if useful.

### Suggested Files

- `docs/DISASTER_RECOVERY.md`
- `docs/RESTORE_DRILL.md`
- `docs/INCIDENT_RESPONSE.md`
- `docs/RTO_RPO.md`

### Suggested Scripts

- `scripts/backup-db.sh`
- `scripts/restore-db.sh`
- `scripts/verify-backup.sh`
- `scripts/dr-restore-drill.sh`

### Acceptance Criteria

- A backup can be restored in a local drill.
- Restore steps are documented.
- Rollback procedure is documented.
- RTO/RPO targets are documented.
- Disaster recovery checklist exists.
- No production secrets are included in docs or scripts.

---

## v3 Recommended Execution Order

1. Security Hardening and Compliance
2. Observability Metrics, Logs, and Traces
3. SLO, SLA, and Operational Quality Targets
4. Performance, Load Testing, and Large Dataset Validation
5. Database Indexing and Query Optimization
6. Reliability, Queue Resilience, and Idempotency
7. Release Management and CI/CD
8. Feature Flags and Configurable Business Rules
9. Data Retention, Archiving, and Cleanup
10. Error Catalog and Exception UX
11. Operational Command Center
12. Disaster Recovery Drill

## v3 Definition of Excellent

The platform can be considered enterprise-grade excellent when:

- security controls are documented and tested
- observability can explain failures and slowdowns
- performance is validated with large data
- queue jobs are retry-safe and idempotent
- CI/CD validates changes before release
- key business rules are configurable
- old data can be retained, archived, or cleaned safely
- errors are consistent and traceable
- operators have a command center
- backup and restore have been tested through a drill

EOF

echo
echo "PRD v3 dibuat:"
echo "  $OUT_PRD"
echo
echo "Cek marker v3:"
grep -n "PRD v3 — Enterprise Readiness\|v3.1 Security\|v3.12 Disaster Recovery\|v3 Definition of Excellent" "$OUT_PRD" || true
echo
echo "Status git:"
git status --short "$OUT_PRD" || true
echo
echo "Jumlah baris:"
wc -l "$OUT_PRD"
echo
echo "Jika sudah benar, commit dengan:"
echo "  git add $OUT_PRD"
echo "  git commit -m \"docs: add PRD v3 enterprise readiness backlog\""
