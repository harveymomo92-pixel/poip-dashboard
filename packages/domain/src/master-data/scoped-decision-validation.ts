import type { ScopedDecisionCategory } from "./scoped-decision-review.js";

export type ScopedDecisionApprovalStatus = "pending" | "approved" | "rejected" | "deferred";
export type ScopedDecisionValidationStatus = "INVALID" | "BLOCKED" | "PASS_WITH_WARNINGS" | "PASS";
export type ScopedDecisionValidationSeverity = "ERROR" | "WARNING";

export interface ScopedDecisionValidationInputRow {
  readonly decision_id: string;
  readonly decision_family: string;
  readonly decision_category: string;
  readonly source_values: string;
  readonly blocker_group_ids: string;
  readonly blocker_categories: string;
  readonly review_group_types: string;
  readonly rows: string | number;
  readonly risk_levels: string;
  readonly reason: string;
  readonly recommended_action: string;
  readonly required_decision: string;
  readonly safe_to_auto_apply: string;
  readonly decision_status: string;
  readonly p10_gate_effect: string;
  readonly sample_documents: string;
  readonly sample_items: string;
  readonly approval_status?: string;
  readonly reviewer?: string;
  readonly reviewer_notes?: string;
  readonly safe_to_seed_target_profile?: string;
  readonly entity_decision_status?: string;
  readonly target_bucket?: string;
  readonly target_qty?: string;
  readonly unit?: string;
}

export interface ScopedDecisionValidationIssueRow {
  readonly validation_id: string;
  readonly severity: ScopedDecisionValidationSeverity;
  readonly decision_id: string;
  readonly decision_family: string;
  readonly decision_category: string;
  readonly source_values: string;
  readonly field: string;
  readonly code: string;
  readonly message: string;
  readonly approval_status: ScopedDecisionApprovalStatus;
  readonly safe_to_auto_apply: string;
  readonly safe_to_seed_target_profile: string;
  readonly p10_gate_effect: string;
  readonly rows: number;
}

export interface ScopedDecisionValidationSummaryRow {
  readonly decision_id: string;
  readonly decision_family: string;
  readonly decision_category: string;
  readonly source_values: string;
  readonly approval_status: ScopedDecisionApprovalStatus;
  readonly reviewer: string;
  readonly reviewer_notes: string;
  readonly rows: number;
  readonly p10_gate_effect: string;
  readonly safe_to_auto_apply: string;
  readonly safe_to_seed_target_profile: string;
}

export interface ScopedDecisionBlockedExecutionPlanRow {
  readonly block_id: string;
  readonly decision_id: string;
  readonly decision_family: string;
  readonly decision_category: string;
  readonly source_values: string;
  readonly approval_status: ScopedDecisionApprovalStatus;
  readonly blocker_reason: string;
  readonly required_before_execution: string;
  readonly p10_gate_effect: string;
  readonly rows: number;
}

export interface ScopedDecisionValidationSummary {
  readonly generatedAt: string;
  readonly sourceFolder: string;
  readonly outputFolder: string;
  readonly totalDecisionRows: number;
  readonly approvedRows: number;
  readonly pendingRows: number;
  readonly rejectedRows: number;
  readonly deferredRows: number;
  readonly invalidRows: number;
  readonly warningRows: number;
  readonly p1BlockingPendingRows: number;
  readonly p2BlockingPendingRows: number;
  readonly unsafeAutoApplyRows: number;
  readonly targetProfileBlockedRows: number;
  readonly unknownSourceBlockedRows: number;
  readonly aliasCanonicalBlockedRows: number;
  readonly rejectAttachmentBlockedRows: number;
  readonly validationStatus: ScopedDecisionValidationStatus;
  readonly p10Gate: {
    readonly status: "BLOCKED" | "PASS";
    readonly reason: string;
  };
  readonly safety: {
    readonly databaseUpdated: false;
    readonly productionOutputsUpdated: false;
    readonly targetProfilesUpdated: false;
    readonly dashboardChanged: false;
    readonly aliasesChanged: false;
    readonly conditionalRulesChanged: false;
  };
}

interface NormalizedDecisionRow extends ScopedDecisionValidationInputRow {
  readonly approval: ScopedDecisionApprovalStatus;
  readonly reviewerValue: string;
  readonly reviewerNotesValue: string;
  readonly autoApply: boolean;
  readonly safeToSeedTargetProfile: boolean;
  readonly entityDecisionStatusValue: string;
  readonly targetBucketValue: string;
  readonly targetQtyValue: string;
  readonly unitValue: string;
  readonly rowCount: number;
}

export function buildScopedDecisionValidation(input: {
  readonly rows: readonly ScopedDecisionValidationInputRow[];
  readonly generatedAt?: string;
  readonly sourceFolder: string;
  readonly outputFolder: string;
}): {
  readonly validationErrors: readonly ScopedDecisionValidationIssueRow[];
  readonly validationWarnings: readonly ScopedDecisionValidationIssueRow[];
  readonly approvedDecisionSummary: readonly ScopedDecisionValidationSummaryRow[];
  readonly pendingDecisionSummary: readonly ScopedDecisionValidationSummaryRow[];
  readonly blockedExecutionPlan: readonly ScopedDecisionBlockedExecutionPlanRow[];
  readonly summary: ScopedDecisionValidationSummary;
} {
  const rows = input.rows.map(normalizeDecisionRow);
  const issues = rows.flatMap(validateDecisionRow);
  const validationErrors = issues.filter((issue) => issue.severity === "ERROR").map(numberIssue("E"));
  const validationWarnings = issues.filter((issue) => issue.severity === "WARNING").map(numberIssue("W"));
  const approvedDecisionSummary = rows.filter((row) => row.approval === "approved").map(summaryRow);
  const pendingDecisionSummary = rows.filter((row) => row.approval === "pending").map(summaryRow);
  const blockedExecutionPlan = rows
    .filter((row) => isBlocking(row) && (row.approval === "pending" || hasError(validationErrors, row.decision_id)))
    .map((row, index) => blockedExecutionRow(row, index));
  const pendingBlockingRows = rows.filter((row) => isBlocking(row) && row.approval === "pending");
  const validationStatus = validationErrors.length > 0
    ? "INVALID"
    : pendingBlockingRows.length > 0
      ? "BLOCKED"
      : validationWarnings.length > 0
        ? "PASS_WITH_WARNINGS"
        : "PASS";
  const summary: ScopedDecisionValidationSummary = {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sourceFolder: input.sourceFolder,
    outputFolder: input.outputFolder,
    totalDecisionRows: rows.length,
    approvedRows: countApproval(rows, "approved"),
    pendingRows: countApproval(rows, "pending"),
    rejectedRows: countApproval(rows, "rejected"),
    deferredRows: countApproval(rows, "deferred"),
    invalidRows: new Set(validationErrors.map((issue) => issue.decision_id)).size,
    warningRows: new Set(validationWarnings.map((issue) => issue.decision_id)).size,
    p1BlockingPendingRows: pendingBlockingRows.filter((row) => priorityRank(row) === "P1").length,
    p2BlockingPendingRows: pendingBlockingRows.filter((row) => priorityRank(row) === "P2").length,
    unsafeAutoApplyRows: rows.filter((row) => row.autoApply && hasError(validationErrors, row.decision_id)).length,
    targetProfileBlockedRows: blockedRows(rows, "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION"),
    unknownSourceBlockedRows: blockedRows(rows, "SOURCE_DATA_REVIEW"),
    aliasCanonicalBlockedRows: rows.filter((row) => isBlocking(row) && row.approval === "pending" && aliasCanonicalCategories.has(row.decision_category as ScopedDecisionCategory)).length,
    rejectAttachmentBlockedRows: blockedRows(rows, "REJECT_ATTACHMENT_REVIEW"),
    validationStatus,
    p10Gate: {
      status: validationStatus === "PASS" || validationStatus === "PASS_WITH_WARNINGS" ? "PASS" : "BLOCKED",
      reason: p10GateReason(validationStatus, validationErrors.length, pendingBlockingRows.length, rows.length)
    },
    safety: {
      databaseUpdated: false,
      productionOutputsUpdated: false,
      targetProfilesUpdated: false,
      dashboardChanged: false,
      aliasesChanged: false,
      conditionalRulesChanged: false
    }
  };
  return {
    validationErrors,
    validationWarnings,
    approvedDecisionSummary,
    pendingDecisionSummary,
    blockedExecutionPlan,
    summary
  };
}

const approvalStatuses = new Set<ScopedDecisionApprovalStatus>(["pending", "approved", "rejected", "deferred"]);
const aliasCanonicalCategories = new Set<ScopedDecisionCategory>(["ALIAS_CANONICAL_REVIEW", "CANONICAL_ENTITY_NEEDED", "MANUAL_REVIEW_REQUIRED"]);

function validateDecisionRow(row: NormalizedDecisionRow): readonly ScopedDecisionValidationIssueRow[] {
  const issues: ScopedDecisionValidationIssueRow[] = [];
  const add = issueAdder(row, issues);
  if (!approvalStatuses.has(effectiveApprovalStatus(row) as ScopedDecisionApprovalStatus)) {
    add("ERROR", "approval_status", "INVALID_APPROVAL_STATUS", "approval_status must be pending, approved, rejected, or deferred.");
  }
  if (!hasColumnValue(row.approval_status)) {
    add("WARNING", "approval_status", "MISSING_APPROVAL_STATUS", "approval_status is empty or missing; validation treats it as pending.");
  }
  if (row.approval === "approved" && !row.reviewerValue) {
    add("ERROR", "reviewer", "APPROVED_REQUIRES_REVIEWER", "Approved decision rows must have a reviewer.");
  }
  if (row.approval === "approved" && !row.reviewerNotesValue) {
    add("WARNING", "reviewer_notes", "APPROVED_SHOULD_HAVE_NOTES", "Approved decision rows should include reviewer_notes.");
  }
  validateAutoApply(row, add);
  validateAliasCanonical(row, add);
  validateUnknownSource(row, add);
  validateRejectAttachment(row, add);
  validateTargetProfile(row, add);
  return issues;
}

function validateAutoApply(
  row: NormalizedDecisionRow,
  add: ReturnType<typeof issueAdder>
) {
  if (!row.autoApply) return;
  if (row.approval !== "approved") add("ERROR", "safe_to_auto_apply", "AUTO_APPLY_REQUIRES_APPROVAL", "safe_to_auto_apply=true requires approval_status=approved.");
  if (!row.reviewerValue) add("ERROR", "reviewer", "AUTO_APPLY_REQUIRES_REVIEWER", "safe_to_auto_apply=true requires reviewer.");
  if (!row.reviewerNotesValue) add("ERROR", "reviewer_notes", "AUTO_APPLY_REQUIRES_NOTES", "safe_to_auto_apply=true requires reviewer_notes.");
  if (row.decision_category !== "DEFER_NOT_P1_BLOCKING") {
    add("ERROR", "decision_category", "AUTO_APPLY_NOT_DETERMINISTIC", "safe_to_auto_apply=true is only valid for deterministic non-P1 blocking decisions.");
  }
}

function validateAliasCanonical(
  row: NormalizedDecisionRow,
  add: ReturnType<typeof issueAdder>
) {
  const sourceText = normalized(`${row.source_values} ${row.reason} ${row.recommended_action} ${row.required_decision}`);
  if (row.autoApply && row.decision_family === "OMSO") {
    add("ERROR", "safe_to_auto_apply", "OMSO_CANNOT_AUTO_APPLY", "OMSO alias/canonical conflicts must not be auto-approved.");
  }
  if (row.autoApply && sourceText.includes("omso 2-oz") && sourceText.includes("omso 1-oz")) {
    add("ERROR", "safe_to_auto_apply", "OMSO_2OZ_CONFLICT_REQUIRES_MANUAL_REVIEW", "OMSO 2-OZ conflicts involving OMSO 1-OZ current entities require manual review.");
  }
  if (row.autoApply && (row.decision_family === "VFINE" || sourceText.includes("vfine botol 600 ml"))) {
    add("ERROR", "safe_to_auto_apply", "VFINE_SIZE_VARIANT_REQUIRES_MANUAL_REVIEW", "VFINE size/variant mappings require manual review.");
  }
  if (row.autoApply && (row.decision_family === "LONGSUN" || sourceText.includes("longsun 1 botol 1500 ml"))) {
    add("ERROR", "safe_to_auto_apply", "LONGSUN_SIZE_VARIANT_REQUIRES_MANUAL_REVIEW", "LONGSUN size/variant mappings require manual review.");
  }
  if (row.autoApply && row.decision_family === "POLYPRINT") {
    add("ERROR", "safe_to_auto_apply", "POLYPRINT_REQUIRES_MANUAL_REVIEW", "POLYPRINT naming normalization requires manual review.");
  }
  if (row.autoApply && row.decision_family === "THERMO HENGFENG") {
    add("ERROR", "safe_to_auto_apply", "THERMO_HENGFENG_REQUIRES_MANUAL_REVIEW", "THERMO HENGFENG legacy target-variant collapse requires manual review.");
  }
  if (row.autoApply && (sourceText.includes("global alias") || sourceText.includes("broad alias") || sourceText.includes("wildcard"))) {
    add("ERROR", "safe_to_auto_apply", "BROAD_GLOBAL_ALIAS_INVALID", "Broad/global aliases are invalid.");
  }
  if (row.decision_family === "(blank)/UNMAPPED" && row.approval === "approved" && row.decision_category === "CANONICAL_ENTITY_NEEDED") {
    add("ERROR", "decision_category", "BLANK_SOURCE_CANNOT_CREATE_CANONICAL", "(blank)/UNMAPPED must not be approved as canonical entity creation.");
  }
  if (row.decision_family === "(blank)/UNMAPPED" && row.autoApply) {
    add("ERROR", "safe_to_auto_apply", "BLANK_SOURCE_CANNOT_AUTO_APPLY", "Blank source cannot become a canonical entity automatically.");
  }
}

function validateUnknownSource(
  row: NormalizedDecisionRow,
  add: ReturnType<typeof issueAdder>
) {
  if (row.decision_category !== "SOURCE_DATA_REVIEW") return;
  if (isBlocking(row) && row.approval === "approved" && !row.reviewerNotesValue) {
    add("ERROR", "reviewer_notes", "UNKNOWN_SOURCE_REQUIRES_NOTES", "Unknown source rows that still block P1.0 must not be marked resolved without reviewer_notes.");
  }
  if (row.approval === "approved" && normalized(row.reviewerNotesValue).includes("canonical entity")) {
    add("ERROR", "reviewer_notes", "UNKNOWN_SOURCE_NOT_CANONICAL_CREATION", "Unknown source rows must not be approved as canonical entity creation.");
  }
}

function validateRejectAttachment(
  row: NormalizedDecisionRow,
  add: ReturnType<typeof issueAdder>
) {
  if (row.decision_category !== "REJECT_ATTACHMENT_REVIEW") return;
  if (row.approval === "approved" && !["approved", "not_required"].includes(row.entityDecisionStatusValue)) {
    add("ERROR", "entity_decision_status", "REJECT_ATTACHMENT_REQUIRES_ENTITY_DECISION", "Reject attachment review can be approved only when canonical entity decision is approved or marked not required.");
  }
  if (normalized(row.reviewerNotesValue).includes("ok output")) {
    add("ERROR", "reviewer_notes", "REJECT_MUST_NOT_CONVERT_TO_OK_OUTPUT", "Reject rows must not be converted into OK output scope.");
  }
}

function validateTargetProfile(
  row: NormalizedDecisionRow,
  add: ReturnType<typeof issueAdder>
) {
  if (row.decision_category !== "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION") return;
  if (row.approval === "approved" && !["approved", "not_required"].includes(row.entityDecisionStatusValue)) {
    add("ERROR", "entity_decision_status", "TARGET_PROFILE_ENTITY_DEPENDENCY_PENDING", "Target profile rows must not be approved while entity/canonical dependency is pending.");
  }
  if (!row.safeToSeedTargetProfile) return;
  if (row.entityDecisionStatusValue !== "approved") add("ERROR", "entity_decision_status", "TARGET_SEED_REQUIRES_ENTITY_APPROVED", "safe_to_seed_target_profile=true requires approved entity decision.");
  if (!row.targetBucketValue) add("ERROR", "target_bucket", "TARGET_SEED_REQUIRES_BUCKET", "safe_to_seed_target_profile=true requires target_bucket.");
  if (!row.targetQtyValue) add("ERROR", "target_qty", "TARGET_SEED_REQUIRES_QTY", "safe_to_seed_target_profile=true requires target_qty.");
  if (!row.unitValue) add("ERROR", "unit", "TARGET_SEED_REQUIRES_UNIT", "safe_to_seed_target_profile=true requires unit.");
  if (!row.reviewerValue) add("ERROR", "reviewer", "TARGET_SEED_REQUIRES_REVIEWER", "safe_to_seed_target_profile=true requires reviewer.");
  if (!row.reviewerNotesValue) add("ERROR", "reviewer_notes", "TARGET_SEED_REQUIRES_NOTES", "safe_to_seed_target_profile=true requires reviewer_notes.");
}

function normalizeDecisionRow(row: ScopedDecisionValidationInputRow): NormalizedDecisionRow {
  const approval = effectiveApprovalStatus(row);
  return {
    ...row,
    approval: approvalStatuses.has(approval as ScopedDecisionApprovalStatus) ? approval as ScopedDecisionApprovalStatus : "pending",
    reviewerValue: trimmed(row.reviewer),
    reviewerNotesValue: trimmed(row.reviewer_notes),
    autoApply: booleanValue(row.safe_to_auto_apply),
    safeToSeedTargetProfile: booleanValue(row.safe_to_seed_target_profile),
    entityDecisionStatusValue: normalized(row.entity_decision_status),
    targetBucketValue: trimmed(row.target_bucket),
    targetQtyValue: trimmed(row.target_qty),
    unitValue: trimmed(row.unit),
    rowCount: numberValue(row.rows)
  };
}

function effectiveApprovalStatus(row: ScopedDecisionValidationInputRow): string {
  return normalized(row.approval_status?.trim() ? row.approval_status : row.decision_status);
}

function issueAdder(row: NormalizedDecisionRow, issues: ScopedDecisionValidationIssueRow[]) {
  return (
    severity: ScopedDecisionValidationSeverity,
    field: string,
    code: string,
    message: string
  ) => {
    issues.push({
      validation_id: "",
      severity,
      decision_id: row.decision_id,
      decision_family: row.decision_family,
      decision_category: row.decision_category,
      source_values: row.source_values,
      field,
      code,
      message,
      approval_status: row.approval,
      safe_to_auto_apply: row.safe_to_auto_apply || "false",
      safe_to_seed_target_profile: row.safe_to_seed_target_profile || "false",
      p10_gate_effect: row.p10_gate_effect,
      rows: row.rowCount
    });
  };
}

function numberIssue(prefix: "E" | "W") {
  return (issue: ScopedDecisionValidationIssueRow, index: number): ScopedDecisionValidationIssueRow => ({
    ...issue,
    validation_id: `${prefix}${String(index + 1).padStart(5, "0")}`
  });
}

function blockedExecutionRow(row: NormalizedDecisionRow, index: number): ScopedDecisionBlockedExecutionPlanRow {
  return {
    block_id: `B${String(index + 1).padStart(5, "0")}`,
    decision_id: row.decision_id,
    decision_family: row.decision_family,
    decision_category: row.decision_category,
    source_values: row.source_values,
    approval_status: row.approval,
    blocker_reason: row.approval === "pending" ? "Decision is still pending." : "Decision has validation errors.",
    required_before_execution: requiredBeforeExecution(row),
    p10_gate_effect: row.p10_gate_effect,
    rows: row.rowCount
  };
}

function summaryRow(row: NormalizedDecisionRow): ScopedDecisionValidationSummaryRow {
  return {
    decision_id: row.decision_id,
    decision_family: row.decision_family,
    decision_category: row.decision_category,
    source_values: row.source_values,
    approval_status: row.approval,
    reviewer: row.reviewerValue,
    reviewer_notes: row.reviewerNotesValue,
    rows: row.rowCount,
    p10_gate_effect: row.p10_gate_effect,
    safe_to_auto_apply: row.safe_to_auto_apply || "false",
    safe_to_seed_target_profile: row.safe_to_seed_target_profile || "false"
  };
}

function requiredBeforeExecution(row: NormalizedDecisionRow): string {
  if (row.decision_category === "SOURCE_DATA_REVIEW") return "Resolve source-data backlog or explicitly defer with reviewer notes.";
  if (row.decision_category === "REJECT_ATTACHMENT_REVIEW") return "Approve entity dependency or mark it not required before reject attachment execution.";
  if (row.decision_category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION") return "Approve entity/canonical decision before any target profile seed.";
  return "Manual reviewer approval is required; no broad/global aliases or automatic application.";
}

function p10GateReason(
  validationStatus: ScopedDecisionValidationStatus,
  errorCount: number,
  pendingBlockingCount: number,
  totalRows: number
): string {
  if (validationStatus === "INVALID") return `P1.0 remains blocked: ${errorCount} validation errors must be fixed before decisions are executable.`;
  if (validationStatus === "BLOCKED") return `P1.0 remains blocked: ${pendingBlockingCount} blocking decision rows are still pending out of ${totalRows}.`;
  if (validationStatus === "PASS_WITH_WARNINGS") return "P1.0 is not enabled by this command; reviewed decisions pass validation with warnings.";
  return "P1.0 is not enabled by this command; reviewed decisions pass validation.";
}

function hasError(errors: readonly ScopedDecisionValidationIssueRow[], decisionId: string): boolean {
  return errors.some((issue) => issue.decision_id === decisionId);
}

function blockedRows(rows: readonly NormalizedDecisionRow[], category: ScopedDecisionCategory): number {
  return rows.filter((row) => isBlocking(row) && row.approval === "pending" && row.decision_category === category).length;
}

function countApproval(rows: readonly NormalizedDecisionRow[], approval: ScopedDecisionApprovalStatus): number {
  return rows.filter((row) => row.approval === approval).length;
}

function priorityRank(row: NormalizedDecisionRow): "P1" | "P2" | "P3" {
  const number = Number(row.decision_id.replace(/\D/g, ""));
  if (Number.isFinite(number) && number > 0) {
    if (number <= 10) return "P1";
    if (number <= 30) return "P2";
  }
  return "P3";
}

function isBlocking(row: NormalizedDecisionRow): boolean {
  return row.p10_gate_effect === "BLOCKS_P1_0";
}

function hasColumnValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function booleanValue(value: string | undefined): boolean {
  return normalized(value) === "true";
}

function numberValue(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalized(value: string | undefined): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function trimmed(value: string | undefined): string {
  return String(value ?? "").trim();
}
