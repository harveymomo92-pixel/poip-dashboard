import type { AuthoritativeMasterReviewerDecisionTemplateRow } from "./authoritative-master-review-workspace.js";

export type AuthoritativeReviewDecisionIntakeStatus = "AWAITING_REVIEWER_DECISIONS" | "INVALID" | "VALID_WITH_WARNINGS" | "VALID";
export type AuthoritativeReviewDecisionApprovalStatus = "pending" | "approved" | "rejected" | "deferred" | "needs_correction";
export type AuthoritativeReviewDecisionReviewType = "ENTITY" | "SOURCE_MAPPING" | "TARGET_PROFILE" | "CONFLICT" | "SOURCE_DATA_GAP" | "FUTURE_USE_DOMAIN";
export type AuthoritativeReviewDecisionApprovedAction =
  | "APPROVE_CANONICAL_ENTITY"
  | "APPROVE_SOURCE_MAPPING"
  | "APPROVE_REVIEWED_ALIAS"
  | "APPROVE_TARGET_PROFILE"
  | "REJECT_CANDIDATE"
  | "DEFER_REVIEW"
  | "SOURCE_DATA_BACKLOG"
  | "FUTURE_USE_ONLY"
  | "NEEDS_CORRECTION";

export interface AuthoritativeReviewDecisionInputRow {
  readonly review_id?: string;
  readonly review_type?: string;
  readonly approval_status?: string;
  readonly approved_action?: string;
  readonly approved_canonical_entity_code?: string;
  readonly approved_source_field?: string;
  readonly approved_source_value?: string;
  readonly approved_mapping_type?: string;
  readonly approved_target_bucket?: string;
  readonly approved_machine_center_no?: string;
  readonly approved_target_qty?: string | number;
  readonly approved_unit?: string;
  readonly effective_from?: string;
  readonly effective_to?: string;
  readonly reviewer?: string;
  readonly reviewer_notes?: string;
}

export interface AuthoritativeReviewDecisionNormalizedRow {
  readonly review_id: string;
  readonly review_type: string;
  readonly approval_status: AuthoritativeReviewDecisionApprovalStatus;
  readonly approved_action: string;
  readonly approved_canonical_entity_code: string;
  readonly approved_source_field: string;
  readonly approved_source_value: string;
  readonly approved_mapping_type: string;
  readonly approved_target_bucket: string;
  readonly approved_machine_center_no: string;
  readonly approved_target_qty: string;
  readonly approved_unit: string;
  readonly effective_from: string;
  readonly effective_to: string;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface AuthoritativeReviewDecisionIssueRow extends AuthoritativeReviewDecisionNormalizedRow {
  readonly issue_id: string;
  readonly severity: "ERROR" | "WARNING";
  readonly issue_code: string;
  readonly issue_message: string;
}

export interface AuthoritativeReviewDecisionPreviewCanonicalRow {
  readonly canonical_entity_code: string;
  readonly canonical_entity_display_name: string;
  readonly entity_family: string;
  readonly entity_type: string;
  readonly production_area: string;
  readonly is_active: "true";
  readonly source_of_truth_status: "approved";
  readonly reviewer: string;
  readonly reviewer_notes: string;
  readonly effective_from: string;
  readonly effective_to: string;
  readonly source_review_id: string;
}

export interface AuthoritativeReviewDecisionPreviewSourceMapRow {
  readonly source_system: "business-central";
  readonly source_field: string;
  readonly source_value: string;
  readonly canonical_entity_code: string;
  readonly mapping_type: string;
  readonly confidence: "HIGH" | "MEDIUM";
  readonly is_active: "true";
  readonly reviewer: string;
  readonly reviewer_notes: string;
  readonly effective_from: string;
  readonly effective_to: string;
  readonly source_review_id: string;
}

export interface AuthoritativeReviewDecisionPreviewTargetProfileRow {
  readonly canonical_entity_code: string;
  readonly target_bucket: string;
  readonly machine_center_no: string;
  readonly target_qty: string;
  readonly unit: string;
  readonly effective_from: string;
  readonly effective_to: string;
  readonly is_active: "true";
  readonly approval_status: "approved";
  readonly reviewer: string;
  readonly reviewer_notes: string;
  readonly source_review_id: string;
}

export interface AuthoritativeReviewDecisionBacklogPreviewRow {
  readonly review_id: string;
  readonly review_type: string;
  readonly approved_action: string;
  readonly reviewer: string;
  readonly reviewer_notes: string;
}

export interface AuthoritativeReviewDecisionIntakeSummary {
  readonly generatedAt: string;
  readonly inputFolder: string;
  readonly sourceWorkspaceFolder: string;
  readonly outputFolder: string;
  readonly intakeStatus: AuthoritativeReviewDecisionIntakeStatus;
  readonly totalWorkspaceReviewRows: number;
  readonly totalReviewerInputRows: number;
  readonly acceptedRows: number;
  readonly blockedRows: number;
  readonly invalidRows: number;
  readonly duplicateRows: number;
  readonly unknownRows: number;
  readonly pendingRows: number;
  readonly rejectedRows: number;
  readonly deferredRows: number;
  readonly needsCorrectionRows: number;
  readonly canonicalEntityApprovalRows: number;
  readonly sourceMappingApprovalRows: number;
  readonly reviewedAliasApprovalRows: number;
  readonly targetProfileApprovalRows: number;
  readonly sourceDataBacklogRows: number;
  readonly futureUseOnlyRows: number;
  readonly warningRows: number;
  readonly errorRows: number;
  readonly p10Gate: {
    readonly status: "BLOCKED";
    readonly reason: string;
  };
  readonly safety: {
    readonly databaseUpdated: false;
    readonly productionOutputsUpdated: false;
    readonly targetProfilesUpdated: false;
    readonly aliasesChanged: false;
    readonly authoritativeMasterApproved: false;
    readonly conditionalRulesChanged: false;
    readonly dashboardChanged: false;
    readonly p10Enabled: false;
  };
}

export interface AuthoritativeReviewDecisionIntakeResult {
  readonly summary: AuthoritativeReviewDecisionIntakeSummary;
  readonly templateRows: readonly AuthoritativeMasterReviewerDecisionTemplateRow[];
  readonly acceptedRows: readonly AuthoritativeReviewDecisionNormalizedRow[];
  readonly blockedRows: readonly AuthoritativeReviewDecisionIssueRow[];
  readonly invalidRows: readonly AuthoritativeReviewDecisionIssueRow[];
  readonly duplicateRows: readonly AuthoritativeReviewDecisionIssueRow[];
  readonly unknownRows: readonly AuthoritativeReviewDecisionIssueRow[];
  readonly pendingRows: readonly AuthoritativeReviewDecisionNormalizedRow[];
  readonly rejectedRows: readonly AuthoritativeReviewDecisionNormalizedRow[];
  readonly deferredRows: readonly AuthoritativeReviewDecisionNormalizedRow[];
  readonly canonicalEntityPreviewRows: readonly AuthoritativeReviewDecisionPreviewCanonicalRow[];
  readonly sourceMappingPreviewRows: readonly AuthoritativeReviewDecisionPreviewSourceMapRow[];
  readonly targetProfilePreviewRows: readonly AuthoritativeReviewDecisionPreviewTargetProfileRow[];
  readonly sourceDataBacklogPreviewRows: readonly AuthoritativeReviewDecisionBacklogPreviewRow[];
  readonly futureUseOnlyPreviewRows: readonly AuthoritativeReviewDecisionBacklogPreviewRow[];
  readonly errors: readonly AuthoritativeReviewDecisionIssueRow[];
  readonly warnings: readonly AuthoritativeReviewDecisionIssueRow[];
  readonly importManifest: {
    readonly generatedAt: string;
    readonly inputFolder: string;
    readonly sourceWorkspaceFolder: string;
    readonly allowedActions: readonly AuthoritativeReviewDecisionApprovedAction[];
    readonly safety: AuthoritativeReviewDecisionIntakeSummary["safety"];
  };
}

const allowedActionsByType: Record<AuthoritativeReviewDecisionReviewType, readonly AuthoritativeReviewDecisionApprovedAction[]> = {
  ENTITY: ["APPROVE_CANONICAL_ENTITY", "REJECT_CANDIDATE", "DEFER_REVIEW", "NEEDS_CORRECTION"],
  SOURCE_MAPPING: ["APPROVE_SOURCE_MAPPING", "APPROVE_REVIEWED_ALIAS", "REJECT_CANDIDATE", "DEFER_REVIEW", "NEEDS_CORRECTION"],
  TARGET_PROFILE: ["APPROVE_TARGET_PROFILE", "REJECT_CANDIDATE", "DEFER_REVIEW", "NEEDS_CORRECTION"],
  CONFLICT: ["APPROVE_CANONICAL_ENTITY", "APPROVE_SOURCE_MAPPING", "APPROVE_REVIEWED_ALIAS", "REJECT_CANDIDATE", "DEFER_REVIEW", "NEEDS_CORRECTION", "FUTURE_USE_ONLY"],
  SOURCE_DATA_GAP: ["SOURCE_DATA_BACKLOG", "DEFER_REVIEW", "NEEDS_CORRECTION"],
  FUTURE_USE_DOMAIN: ["FUTURE_USE_ONLY", "DEFER_REVIEW", "NEEDS_CORRECTION"]
};

const allAllowedActions = [...new Set(Object.values(allowedActionsByType).flat())];
const broadFamilyOnlySources = new Set(["OMSO", "VFINE", "LONGSUN", "THERMO", "POLYPRINT"]);

export function buildAuthoritativeMasterReviewDecisionIntake(input: {
  readonly workspaceRows: readonly AuthoritativeMasterReviewerDecisionTemplateRow[];
  readonly reviewerRows: readonly AuthoritativeReviewDecisionInputRow[];
  readonly reviewerInputExists: boolean;
  readonly inputFolder: string;
  readonly sourceWorkspaceFolder: string;
  readonly outputFolder: string;
  readonly generatedAt?: string;
}): AuthoritativeReviewDecisionIntakeResult {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const safety = safetyFlags();
  const templateRows = input.workspaceRows;
  if (!input.reviewerInputExists) {
    return result({
      generatedAt,
      inputFolder: input.inputFolder,
      sourceWorkspaceFolder: input.sourceWorkspaceFolder,
      outputFolder: input.outputFolder,
      workspaceRows: templateRows,
      reviewerRows: [],
      intakeStatus: "AWAITING_REVIEWER_DECISIONS",
      acceptedRows: [],
      blockedRows: [],
      invalidRows: [],
      duplicateRows: [],
      unknownRows: [],
      pendingRows: [],
      rejectedRows: [],
      deferredRows: [],
      canonicalRows: [],
      sourceRows: [],
      targetRows: [],
      sourceBacklogRows: [],
      futureRows: [],
      warnings: [],
      safety,
      p10Reason: "P1.0 remains blocked: reviewer decision input is missing."
    });
  }

  const workspaceById = new Map(templateRows.map((row) => [row.review_id, row]));
  const duplicateIds = duplicatedIds(input.reviewerRows.map((row) => clean(row.review_id)));
  const acceptedRows: AuthoritativeReviewDecisionNormalizedRow[] = [];
  const blockedRows: AuthoritativeReviewDecisionIssueRow[] = [];
  const invalidRows: AuthoritativeReviewDecisionIssueRow[] = [];
  const duplicateRows: AuthoritativeReviewDecisionIssueRow[] = [];
  const unknownRows: AuthoritativeReviewDecisionIssueRow[] = [];
  const pendingRows: AuthoritativeReviewDecisionNormalizedRow[] = [];
  const rejectedRows: AuthoritativeReviewDecisionNormalizedRow[] = [];
  const deferredRows: AuthoritativeReviewDecisionNormalizedRow[] = [];
  const canonicalRows: AuthoritativeReviewDecisionPreviewCanonicalRow[] = [];
  const sourceRows: AuthoritativeReviewDecisionPreviewSourceMapRow[] = [];
  const targetRows: AuthoritativeReviewDecisionPreviewTargetProfileRow[] = [];
  const sourceBacklogRows: AuthoritativeReviewDecisionBacklogPreviewRow[] = [];
  const futureRows: AuthoritativeReviewDecisionBacklogPreviewRow[] = [];
  const warnings: AuthoritativeReviewDecisionIssueRow[] = [];

  input.reviewerRows.forEach((row, index) => {
    const normalized = normalizeReviewerRow(row);
    const workspaceRow = workspaceById.get(normalized.review_id);
    if (duplicateIds.has(normalized.review_id)) {
      duplicateRows.push(issue(index, normalized, "ERROR", "DUPLICATE_REVIEW_ID", "Duplicate reviewer decision for the same review_id."));
      return;
    }
    if (!workspaceRow) {
      unknownRows.push(issue(index, normalized, "ERROR", "UNKNOWN_REVIEW_ID", "review_id is not present in the P0.9p workspace."));
      return;
    }
    if (!isKnownStatus(clean(row.approval_status))) {
      invalidRows.push(issue(index, normalized, "ERROR", "UNSUPPORTED_APPROVAL_STATUS", "approval_status is not supported."));
      return;
    }
    if (normalized.approval_status === "pending") {
      pendingRows.push(normalized);
      return;
    }
    if (normalized.approval_status === "rejected") {
      rejectedRows.push(normalized);
      return;
    }
    if (normalized.approval_status === "deferred") {
      deferredRows.push(normalized);
      return;
    }
    if (normalized.approval_status === "needs_correction") {
      blockedRows.push(issue(index, normalized, "ERROR", "NEEDS_CORRECTION", "needs_correction decisions are blocked from acceptance."));
      return;
    }

    const reviewType = normalizeReviewType(normalized.review_type || workspaceRow.review_type);
    const validationErrors = validateApprovedDecision(normalized, reviewType);
    if (validationErrors.length > 0) {
      for (const error of validationErrors) blockedRows.push(issue(index, normalized, "ERROR", error.code, error.message));
      return;
    }
    const warning = warningForAcceptedDecision(normalized);
    if (warning) warnings.push(issue(index, normalized, "WARNING", warning.code, warning.message));
    acceptedRows.push(normalized);
    if (normalized.approved_action === "APPROVE_CANONICAL_ENTITY") canonicalRows.push(canonicalPreview(normalized));
    if (normalized.approved_action === "APPROVE_SOURCE_MAPPING" || normalized.approved_action === "APPROVE_REVIEWED_ALIAS") sourceRows.push(sourcePreview(normalized));
    if (normalized.approved_action === "APPROVE_TARGET_PROFILE") targetRows.push(targetPreview(normalized));
    if (normalized.approved_action === "SOURCE_DATA_BACKLOG") sourceBacklogRows.push(backlogPreview(normalized));
    if (normalized.approved_action === "FUTURE_USE_ONLY") futureRows.push(backlogPreview(normalized));
  });

  const intakeStatus: AuthoritativeReviewDecisionIntakeStatus = blockedRows.length > 0 || invalidRows.length > 0 || duplicateRows.length > 0 || unknownRows.length > 0
    ? "INVALID"
    : warnings.length > 0 ? "VALID_WITH_WARNINGS" : acceptedRows.length > 0 ? "VALID" : "AWAITING_REVIEWER_DECISIONS";

  return result({
    generatedAt,
    inputFolder: input.inputFolder,
    sourceWorkspaceFolder: input.sourceWorkspaceFolder,
    outputFolder: input.outputFolder,
    workspaceRows: templateRows,
    reviewerRows: input.reviewerRows,
    intakeStatus,
    acceptedRows,
    blockedRows,
    invalidRows,
    duplicateRows,
    unknownRows,
    pendingRows,
    rejectedRows,
    deferredRows,
    canonicalRows,
    sourceRows,
    targetRows,
    sourceBacklogRows,
    futureRows,
    warnings,
    safety,
    p10Reason: "P1.0 remains blocked: authoritative review decisions are intake/export only and require a future dry-run before any application."
  });
}

function validateApprovedDecision(row: AuthoritativeReviewDecisionNormalizedRow, reviewType: AuthoritativeReviewDecisionReviewType): readonly { readonly code: string; readonly message: string }[] {
  const errors: { code: string; message: string }[] = [];
  const action = normalizeAction(row.approved_action);
  if (!action) errors.push({ code: "INVALID_APPROVED_ACTION", message: "Approved decision requires a supported approved_action." });
  else if (!allowedActionsByType[reviewType].includes(action)) errors.push({ code: "INVALID_ACTION_FOR_REVIEW_TYPE", message: `${action} is not allowed for ${reviewType}.` });
  if (!row.reviewer) errors.push({ code: "MISSING_REVIEWER", message: "Approved decision requires reviewer." });
  if (!row.reviewer_notes.trim()) errors.push({ code: "MISSING_REVIEWER_NOTES", message: "Approved decision requires reviewer_notes." });
  if (row.approved_source_field === "current_entity_code") errors.push({ code: "CURRENT_ENTITY_AS_SOURCE_OF_TRUTH", message: "current_entity_code cannot be used as authoritative source of truth." });

  if (action === "APPROVE_CANONICAL_ENTITY" && !row.approved_canonical_entity_code) {
    errors.push({ code: "MISSING_CANONICAL_ENTITY_CODE", message: "APPROVE_CANONICAL_ENTITY requires approved_canonical_entity_code." });
  }
  if (action === "APPROVE_SOURCE_MAPPING" || action === "APPROVE_REVIEWED_ALIAS") {
    if (!row.approved_canonical_entity_code) errors.push({ code: "MISSING_CANONICAL_ENTITY_CODE", message: `${action} requires approved_canonical_entity_code.` });
    if (!row.approved_source_field) errors.push({ code: "MISSING_SOURCE_FIELD", message: `${action} requires approved_source_field.` });
    if (!row.approved_source_value) errors.push({ code: "MISSING_SOURCE_VALUE", message: `${action} requires approved_source_value.` });
    if (!row.approved_mapping_type) errors.push({ code: "MISSING_MAPPING_TYPE", message: `${action} requires approved_mapping_type.` });
    if (isBlankOrUnmapped(row.approved_source_value)) errors.push({ code: "UNMAPPED_SOURCE_MAPPING", message: "Blank/UNMAPPED source value cannot be approved as source mapping." });
    if (isBroadFamilyOnly(row.approved_source_value) && !notesJustifyBroadAlias(row.reviewer_notes)) errors.push({ code: "UNSAFE_BROAD_ALIAS", message: "Broad family-only source value requires explicit reviewer justification." });
  }
  if (action === "APPROVE_TARGET_PROFILE") {
    if (!row.approved_canonical_entity_code) errors.push({ code: "MISSING_CANONICAL_ENTITY_CODE", message: "APPROVE_TARGET_PROFILE requires approved_canonical_entity_code." });
    if (!row.approved_target_bucket) errors.push({ code: "MISSING_TARGET_BUCKET", message: "APPROVE_TARGET_PROFILE requires approved_target_bucket." });
    if (!row.approved_target_qty) errors.push({ code: "MISSING_TARGET_QTY", message: "APPROVE_TARGET_PROFILE requires approved_target_qty." });
    if (!isPositiveNumber(row.approved_target_qty)) errors.push({ code: "INVALID_TARGET_QTY", message: "approved_target_qty must be positive numeric." });
    if (!row.approved_unit) errors.push({ code: "MISSING_UNIT", message: "APPROVE_TARGET_PROFILE requires approved_unit." });
    if (!row.effective_from) errors.push({ code: "MISSING_EFFECTIVE_FROM", message: "APPROVE_TARGET_PROFILE requires effective_from." });
  }
  return errors;
}

function warningForAcceptedDecision(row: AuthoritativeReviewDecisionNormalizedRow): { readonly code: string; readonly message: string } | null {
  if (row.approved_action === "APPROVE_REVIEWED_ALIAS" && row.approved_mapping_type !== "REVIEWED_SOURCE_ALIAS") {
    return { code: "REVIEWED_ALIAS_MAPPING_TYPE_WARNING", message: "APPROVE_REVIEWED_ALIAS should normally use REVIEWED_SOURCE_ALIAS." };
  }
  if ((row.approved_action === "APPROVE_SOURCE_MAPPING" || row.approved_action === "APPROVE_REVIEWED_ALIAS") && isBroadFamilyOnly(row.approved_source_value)) {
    return { code: "BROAD_ALIAS_ACCEPTED_WITH_JUSTIFICATION", message: "Broad family-only source value accepted with reviewer justification; keep manual review evidence." };
  }
  return null;
}

function result(input: {
  readonly generatedAt: string;
  readonly inputFolder: string;
  readonly sourceWorkspaceFolder: string;
  readonly outputFolder: string;
  readonly workspaceRows: readonly AuthoritativeMasterReviewerDecisionTemplateRow[];
  readonly reviewerRows: readonly AuthoritativeReviewDecisionInputRow[];
  readonly intakeStatus: AuthoritativeReviewDecisionIntakeStatus;
  readonly acceptedRows: readonly AuthoritativeReviewDecisionNormalizedRow[];
  readonly blockedRows: readonly AuthoritativeReviewDecisionIssueRow[];
  readonly invalidRows: readonly AuthoritativeReviewDecisionIssueRow[];
  readonly duplicateRows: readonly AuthoritativeReviewDecisionIssueRow[];
  readonly unknownRows: readonly AuthoritativeReviewDecisionIssueRow[];
  readonly pendingRows: readonly AuthoritativeReviewDecisionNormalizedRow[];
  readonly rejectedRows: readonly AuthoritativeReviewDecisionNormalizedRow[];
  readonly deferredRows: readonly AuthoritativeReviewDecisionNormalizedRow[];
  readonly canonicalRows: readonly AuthoritativeReviewDecisionPreviewCanonicalRow[];
  readonly sourceRows: readonly AuthoritativeReviewDecisionPreviewSourceMapRow[];
  readonly targetRows: readonly AuthoritativeReviewDecisionPreviewTargetProfileRow[];
  readonly sourceBacklogRows: readonly AuthoritativeReviewDecisionBacklogPreviewRow[];
  readonly futureRows: readonly AuthoritativeReviewDecisionBacklogPreviewRow[];
  readonly warnings: readonly AuthoritativeReviewDecisionIssueRow[];
  readonly safety: AuthoritativeReviewDecisionIntakeSummary["safety"];
  readonly p10Reason: string;
}): AuthoritativeReviewDecisionIntakeResult {
  const errors = [...input.blockedRows, ...input.invalidRows, ...input.duplicateRows, ...input.unknownRows];
  const needsCorrectionRows = input.blockedRows.filter((row) => row.issue_code === "NEEDS_CORRECTION").length;
  return {
    summary: {
      generatedAt: input.generatedAt,
      inputFolder: input.inputFolder,
      sourceWorkspaceFolder: input.sourceWorkspaceFolder,
      outputFolder: input.outputFolder,
      intakeStatus: input.intakeStatus,
      totalWorkspaceReviewRows: input.workspaceRows.length,
      totalReviewerInputRows: input.reviewerRows.length,
      acceptedRows: input.acceptedRows.length,
      blockedRows: input.blockedRows.length,
      invalidRows: input.invalidRows.length,
      duplicateRows: input.duplicateRows.length,
      unknownRows: input.unknownRows.length,
      pendingRows: input.pendingRows.length,
      rejectedRows: input.rejectedRows.length,
      deferredRows: input.deferredRows.length,
      needsCorrectionRows,
      canonicalEntityApprovalRows: input.canonicalRows.length,
      sourceMappingApprovalRows: input.acceptedRows.filter((row) => row.approved_action === "APPROVE_SOURCE_MAPPING").length,
      reviewedAliasApprovalRows: input.acceptedRows.filter((row) => row.approved_action === "APPROVE_REVIEWED_ALIAS").length,
      targetProfileApprovalRows: input.targetRows.length,
      sourceDataBacklogRows: input.sourceBacklogRows.length,
      futureUseOnlyRows: input.futureRows.length,
      warningRows: input.warnings.length,
      errorRows: errors.length,
      p10Gate: { status: "BLOCKED", reason: input.p10Reason },
      safety: input.safety
    },
    templateRows: input.workspaceRows,
    acceptedRows: input.acceptedRows,
    blockedRows: input.blockedRows,
    invalidRows: input.invalidRows,
    duplicateRows: input.duplicateRows,
    unknownRows: input.unknownRows,
    pendingRows: input.pendingRows,
    rejectedRows: input.rejectedRows,
    deferredRows: input.deferredRows,
    canonicalEntityPreviewRows: input.canonicalRows,
    sourceMappingPreviewRows: input.sourceRows,
    targetProfilePreviewRows: input.targetRows,
    sourceDataBacklogPreviewRows: input.sourceBacklogRows,
    futureUseOnlyPreviewRows: input.futureRows,
    errors,
    warnings: input.warnings,
    importManifest: {
      generatedAt: input.generatedAt,
      inputFolder: input.inputFolder,
      sourceWorkspaceFolder: input.sourceWorkspaceFolder,
      allowedActions: allAllowedActions,
      safety: input.safety
    }
  };
}

function normalizeReviewerRow(row: AuthoritativeReviewDecisionInputRow): AuthoritativeReviewDecisionNormalizedRow {
  return {
    review_id: clean(row.review_id),
    review_type: clean(row.review_type),
    approval_status: normalizeStatus(row.approval_status),
    approved_action: clean(row.approved_action),
    approved_canonical_entity_code: clean(row.approved_canonical_entity_code),
    approved_source_field: clean(row.approved_source_field),
    approved_source_value: clean(row.approved_source_value),
    approved_mapping_type: clean(row.approved_mapping_type),
    approved_target_bucket: clean(row.approved_target_bucket),
    approved_machine_center_no: clean(row.approved_machine_center_no),
    approved_target_qty: clean(row.approved_target_qty),
    approved_unit: clean(row.approved_unit),
    effective_from: clean(row.effective_from),
    effective_to: clean(row.effective_to),
    reviewer: clean(row.reviewer),
    reviewer_notes: clean(row.reviewer_notes)
  };
}

function canonicalPreview(row: AuthoritativeReviewDecisionNormalizedRow): AuthoritativeReviewDecisionPreviewCanonicalRow {
  return {
    canonical_entity_code: row.approved_canonical_entity_code,
    canonical_entity_display_name: row.approved_canonical_entity_code,
    entity_family: inferFamily(row.approved_canonical_entity_code),
    entity_type: "OTHER",
    production_area: "",
    is_active: "true",
    source_of_truth_status: "approved",
    reviewer: row.reviewer,
    reviewer_notes: row.reviewer_notes,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    source_review_id: row.review_id
  };
}

function sourcePreview(row: AuthoritativeReviewDecisionNormalizedRow): AuthoritativeReviewDecisionPreviewSourceMapRow {
  return {
    source_system: "business-central",
    source_field: row.approved_source_field,
    source_value: row.approved_source_value,
    canonical_entity_code: row.approved_canonical_entity_code,
    mapping_type: row.approved_mapping_type,
    confidence: row.approved_action === "APPROVE_SOURCE_MAPPING" ? "HIGH" : "MEDIUM",
    is_active: "true",
    reviewer: row.reviewer,
    reviewer_notes: row.reviewer_notes,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    source_review_id: row.review_id
  };
}

function targetPreview(row: AuthoritativeReviewDecisionNormalizedRow): AuthoritativeReviewDecisionPreviewTargetProfileRow {
  return {
    canonical_entity_code: row.approved_canonical_entity_code,
    target_bucket: row.approved_target_bucket,
    machine_center_no: row.approved_machine_center_no,
    target_qty: row.approved_target_qty,
    unit: row.approved_unit,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    is_active: "true",
    approval_status: "approved",
    reviewer: row.reviewer,
    reviewer_notes: row.reviewer_notes,
    source_review_id: row.review_id
  };
}

function backlogPreview(row: AuthoritativeReviewDecisionNormalizedRow): AuthoritativeReviewDecisionBacklogPreviewRow {
  return {
    review_id: row.review_id,
    review_type: row.review_type,
    approved_action: row.approved_action,
    reviewer: row.reviewer,
    reviewer_notes: row.reviewer_notes
  };
}

function issue(index: number, row: AuthoritativeReviewDecisionNormalizedRow, severity: "ERROR" | "WARNING", code: string, message: string): AuthoritativeReviewDecisionIssueRow {
  return {
    ...row,
    issue_id: `${severity === "ERROR" ? "E" : "W"}${String(index + 1).padStart(5, "0")}`,
    severity,
    issue_code: code,
    issue_message: message
  };
}

function duplicatedIds(ids: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const id of ids) {
    if (!id) continue;
    if (seen.has(id)) duplicated.add(id);
    seen.add(id);
  }
  return duplicated;
}

function normalizeStatus(value: unknown): AuthoritativeReviewDecisionApprovalStatus {
  const status = clean(value);
  if (status === "approved" || status === "rejected" || status === "deferred" || status === "needs_correction") return status;
  return "pending";
}

function isKnownStatus(value: string): boolean {
  return value === "" || value === "pending" || value === "approved" || value === "rejected" || value === "deferred" || value === "needs_correction";
}

function normalizeReviewType(value: string): AuthoritativeReviewDecisionReviewType {
  if (value === "ENTITY" || value === "SOURCE_MAPPING" || value === "TARGET_PROFILE" || value === "CONFLICT" || value === "SOURCE_DATA_GAP" || value === "FUTURE_USE_DOMAIN") return value;
  return "FUTURE_USE_DOMAIN";
}

function normalizeAction(value: string): AuthoritativeReviewDecisionApprovedAction | null {
  return allAllowedActions.includes(value as AuthoritativeReviewDecisionApprovedAction) ? value as AuthoritativeReviewDecisionApprovedAction : null;
}

function isPositiveNumber(value: string): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function isBlankOrUnmapped(value: string): boolean {
  const normalized = value.toUpperCase();
  return normalized === "" || normalized === "(BLANK)" || normalized === "UNMAPPED";
}

function isBroadFamilyOnly(value: string): boolean {
  return broadFamilyOnlySources.has(value.toUpperCase());
}

function notesJustifyBroadAlias(value: string): boolean {
  const notes = value.toLowerCase();
  return notes.includes("explicit") || notes.includes("business") || notes.includes("safe") || notes.includes("reviewed");
}

function inferFamily(value: string): string {
  const text = value.toUpperCase();
  for (const family of ["OMSO", "POLYPRINT", "VFINE", "LONGSUN", "THERMO HENGFENG", "BORCH", "NEWDO", "GILINGAN", "REPACKING"]) {
    if (text.includes(family)) return family;
  }
  return "OTHER";
}

function safetyFlags(): AuthoritativeReviewDecisionIntakeSummary["safety"] {
  return {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    aliasesChanged: false,
    authoritativeMasterApproved: false,
    conditionalRulesChanged: false,
    dashboardChanged: false,
    p10Enabled: false
  };
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}
