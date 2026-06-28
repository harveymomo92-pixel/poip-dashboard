import {
  scopedDecisionAllowedApprovedActions,
  scopedDecisionForbiddenDirectMutationActions,
  type ScopedDecisionApprovalWorkbookRow
} from "./scoped-decision-approval-workspace.js";

export type ScopedDecisionApprovalIntakeStatus =
  | "AWAITING_REVIEWER_INPUT"
  | "BLOCKED"
  | "READY_FOR_APPLY_DRY_RUN_REVIEW";

export type ScopedDecisionReviewerApprovalStatus = "approved" | "rejected" | "deferred" | "pending";

export interface ScopedDecisionReviewerInputRow {
  readonly decision_id?: string;
  readonly stable_decision_key?: string;
  readonly approval_status?: string;
  readonly approved_action?: string;
  readonly reviewer?: string;
  readonly reviewer_notes?: string;
  readonly business_approval_reference?: string;
  readonly decision_date?: string;
  readonly safe_to_auto_apply?: string;
  readonly safe_to_seed_target_profile?: string;
  readonly entity_dependency_status?: string;
  readonly target_bucket?: string;
  readonly target_qty?: string;
  readonly unit?: string;
  readonly source_value?: string;
  readonly decision_family?: string;
  readonly decision_category?: string;
}

export interface ScopedDecisionNormalizedReviewerDecisionRow {
  readonly intake_id: string;
  readonly decision_id: string;
  readonly stable_decision_key: string;
  readonly priority: string;
  readonly decision_family: string;
  readonly decision_category: string;
  readonly source_value: string;
  readonly grouped_rows: number;
  readonly approval_status: ScopedDecisionReviewerApprovalStatus;
  readonly approved_action: string;
  readonly reviewer: string;
  readonly reviewer_notes: string;
  readonly business_approval_reference: string;
  readonly decision_date: string;
  readonly safe_to_auto_apply: "true" | "false";
  readonly safe_to_seed_target_profile: "true" | "false";
  readonly entity_dependency_status: string;
  readonly target_bucket: string;
  readonly target_qty: string;
  readonly unit: string;
  readonly intake_status: "ACCEPTED" | "BLOCKED";
  readonly intake_reason: string;
}

export interface ScopedDecisionBlockedReviewerDecisionRow {
  readonly block_id: string;
  readonly decision_id: string;
  readonly stable_decision_key: string;
  readonly decision_family: string;
  readonly decision_category: string;
  readonly source_value: string;
  readonly approval_status: ScopedDecisionReviewerApprovalStatus | "unsupported";
  readonly approved_action: string;
  readonly blocker_code: string;
  readonly blocker_reason: string;
  readonly required_before_acceptance: string;
}

export interface ScopedDecisionMissingReviewerDecisionRow {
  readonly decision_id: string;
  readonly stable_decision_key: string;
  readonly priority: string;
  readonly decision_family: string;
  readonly decision_category: string;
  readonly source_value: string;
  readonly grouped_rows: number;
  readonly approval_status: "missing";
  readonly required_reviewer_fields: string;
}

export interface ScopedDecisionDuplicateReviewerDecisionRow {
  readonly duplicate_id: string;
  readonly decision_id: string;
  readonly stable_decision_key: string;
  readonly duplicate_count: number;
  readonly blocker_code: "DUPLICATE_REVIEWER_DECISION";
  readonly blocker_reason: string;
}

export interface ScopedDecisionInvalidReviewerDecisionRow {
  readonly invalid_id: string;
  readonly decision_id: string;
  readonly stable_decision_key: string;
  readonly approval_status: string;
  readonly approved_action: string;
  readonly invalid_code: string;
  readonly invalid_reason: string;
}

export interface ScopedDecisionReviewerInputTemplateRow {
  readonly decision_id: string;
  readonly stable_decision_key: string;
  readonly priority: string;
  readonly decision_family: string;
  readonly decision_category: string;
  readonly source_value: string;
  readonly grouped_rows: number;
  readonly recommended_decision: string;
  readonly rationale: string;
  readonly approval_status: "";
  readonly approved_action: "";
  readonly reviewer: "";
  readonly reviewer_notes: "";
  readonly business_approval_reference: "";
  readonly decision_date: "";
  readonly safe_to_auto_apply: "false";
  readonly safe_to_seed_target_profile: "false";
  readonly entity_dependency_status: "";
  readonly target_bucket: string;
  readonly target_qty: "";
  readonly unit: "";
}

export interface ScopedDecisionApprovalReadinessReport {
  readonly readinessStatus: ScopedDecisionApprovalIntakeStatus;
  readonly totalWorkspaceRows: number;
  readonly totalReviewerInputRows: number;
  readonly acceptedReviewerRows: number;
  readonly blockedReviewerRows: number;
  readonly missingReviewerRows: number;
  readonly duplicateReviewerRows: number;
  readonly invalidReviewerRows: number;
  readonly safeForApplyDryRunReview: boolean;
  readonly notes: readonly string[];
}

export interface ScopedDecisionApprovalIntakeSummary {
  readonly generatedAt: string;
  readonly sourceApprovalWorkspace: string;
  readonly sourceValidationFolder: string;
  readonly reviewerInputFolder: string;
  readonly reviewerInputFile: string;
  readonly outputFolder: string;
  readonly totalWorkspaceRows: number;
  readonly totalReviewerInputRows: number;
  readonly matchedReviewerRows: number;
  readonly missingReviewerRows: number;
  readonly duplicateReviewerRows: number;
  readonly unknownReviewerRows: number;
  readonly acceptedReviewerRows: number;
  readonly blockedReviewerRows: number;
  readonly invalidReviewerRows: number;
  readonly approvedReviewerRows: number;
  readonly rejectedReviewerRows: number;
  readonly deferredReviewerRows: number;
  readonly pendingReviewerRows: number;
  readonly missingReviewerNotesRows: number;
  readonly invalidActionRows: number;
  readonly readinessStatus: ScopedDecisionApprovalIntakeStatus;
  readonly p10Gate: {
    readonly status: "BLOCKED";
    readonly reason: string;
  };
  readonly safety: {
    readonly databaseUpdated: false;
    readonly productionOutputsUpdated: false;
    readonly targetProfilesUpdated: false;
    readonly dashboardChanged: false;
    readonly aliasesChanged: false;
    readonly conditionalRulesChanged: false;
    readonly p10Enabled: false;
    readonly approvalWorkspaceMutated: false;
    readonly applyDryRunMutated: false;
    readonly decisionsApplied: false;
  };
}

interface NormalizedReviewerInput {
  readonly source: ScopedDecisionReviewerInputRow;
  readonly inputIndex: number;
  readonly decisionId: string;
  readonly stableKey: string;
  readonly statusValue: string;
  readonly approvalStatus: ScopedDecisionReviewerApprovalStatus | "unsupported";
  readonly approvedAction: string;
  readonly reviewer: string;
  readonly reviewerNotes: string;
  readonly businessApprovalReference: string;
  readonly decisionDate: string;
  readonly safeToAutoApply: boolean;
  readonly safeToSeedTargetProfile: boolean;
  readonly entityDependencyStatus: string;
  readonly targetBucket: string;
  readonly targetQty: string;
  readonly unit: string;
}

interface WorkspaceContext {
  readonly row: ScopedDecisionApprovalWorkbookRow;
  readonly stableKey: string;
}

const extraForbiddenDirectMutationActions = [
  ...scopedDecisionForbiddenDirectMutationActions,
  "APPLY_NOW",
  "ENABLE_P1_NOW"
] as const;

export function buildScopedDecisionApprovalIntake(input: {
  readonly workspaceRows: readonly ScopedDecisionApprovalWorkbookRow[];
  readonly reviewerRows: readonly ScopedDecisionReviewerInputRow[];
  readonly reviewerInputExists: boolean;
  readonly generatedAt?: string;
  readonly sourceApprovalWorkspace: string;
  readonly sourceValidationFolder: string;
  readonly reviewerInputFolder: string;
  readonly reviewerInputFile: string;
  readonly outputFolder: string;
}): {
  readonly normalizedReviewerDecisionRows: readonly ScopedDecisionNormalizedReviewerDecisionRow[];
  readonly acceptedReviewerDecisionRows: readonly ScopedDecisionNormalizedReviewerDecisionRow[];
  readonly blockedReviewerDecisionRows: readonly ScopedDecisionBlockedReviewerDecisionRow[];
  readonly missingReviewerDecisionRows: readonly ScopedDecisionMissingReviewerDecisionRow[];
  readonly duplicateReviewerDecisionRows: readonly ScopedDecisionDuplicateReviewerDecisionRow[];
  readonly invalidReviewerDecisionRows: readonly ScopedDecisionInvalidReviewerDecisionRow[];
  readonly reviewerInputTemplateRows: readonly ScopedDecisionReviewerInputTemplateRow[];
  readonly approvalReadinessReport: ScopedDecisionApprovalReadinessReport;
  readonly p10GatePreview: ScopedDecisionApprovalIntakeSummary["p10Gate"] & {
    readonly readinessStatus: ScopedDecisionApprovalIntakeStatus;
    readonly acceptedReviewerRows: number;
    readonly blockedReviewerRows: number;
    readonly missingReviewerRows: number;
  };
  readonly safetyReport: ScopedDecisionApprovalIntakeSummary["safety"] & {
    readonly mode: "INTAKE_EXPORT_ONLY";
  };
  readonly summary: ScopedDecisionApprovalIntakeSummary;
} {
  const workspace = input.workspaceRows.map((row) => ({ row, stableKey: stableDecisionKey(row) }));
  const workspaceByDecisionId = new Map(workspace.map((item) => [item.row.decision_id, item]));
  const workspaceByStableKey = new Map(workspace.map((item) => [item.stableKey, item]));
  const normalizedInputs = input.reviewerRows.map((row, index) => normalizeReviewerInput(row, index));
  const keyCounts = countBy(normalizedInputs.map((row) => reviewerMatchKey(row)));
  const duplicateKeys = new Set([...keyCounts].filter(([, count]) => count > 1).map(([key]) => key));
  const matchedKeys = new Set<string>();
  const acceptedRows: ScopedDecisionNormalizedReviewerDecisionRow[] = [];
  const blockedRows: ScopedDecisionBlockedReviewerDecisionRow[] = [];
  const invalidRows: ScopedDecisionInvalidReviewerDecisionRow[] = [];
  const normalizedRows: ScopedDecisionNormalizedReviewerDecisionRow[] = [];
  const duplicateRows = buildDuplicateRows(normalizedInputs, duplicateKeys);

  for (const reviewerRow of normalizedInputs) {
    const context = findWorkspaceContext(reviewerRow, workspaceByDecisionId, workspaceByStableKey);
    if (context) matchedKeys.add(context.stableKey);
    const evaluation = evaluateReviewerDecision(reviewerRow, context, duplicateKeys.has(reviewerMatchKey(reviewerRow)));
    if (evaluation.invalid) invalidRows.push(evaluation.invalid);
    if (evaluation.blocked) blockedRows.push(evaluation.blocked);
    if (evaluation.normalized) {
      normalizedRows.push(evaluation.normalized);
      if (evaluation.normalized.intake_status === "ACCEPTED") acceptedRows.push(evaluation.normalized);
    }
  }

  const missingRows = input.reviewerInputExists
    ? workspace.filter((item) => !matchedKeys.has(item.stableKey)).map((item) => missingRow(item))
    : workspace.map((item) => missingRow(item));
  const statusCounts = {
    approved: normalizedInputs.filter((row) => row.approvalStatus === "approved").length,
    rejected: normalizedInputs.filter((row) => row.approvalStatus === "rejected").length,
    deferred: normalizedInputs.filter((row) => row.approvalStatus === "deferred").length,
    pending: normalizedInputs.filter((row) => row.approvalStatus === "pending").length
  };
  const readinessStatus: ScopedDecisionApprovalIntakeStatus = !input.reviewerInputExists
    ? "AWAITING_REVIEWER_INPUT"
    : blockedRows.length > 0 || invalidRows.length > 0 || duplicateRows.length > 0 || missingRows.length > 0
      ? "BLOCKED"
      : "READY_FOR_APPLY_DRY_RUN_REVIEW";
  const safety = {
    databaseUpdated: false,
    productionOutputsUpdated: false,
    targetProfilesUpdated: false,
    dashboardChanged: false,
    aliasesChanged: false,
    conditionalRulesChanged: false,
    p10Enabled: false,
    approvalWorkspaceMutated: false,
    applyDryRunMutated: false,
    decisionsApplied: false
  } as const;
  const summary: ScopedDecisionApprovalIntakeSummary = {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sourceApprovalWorkspace: input.sourceApprovalWorkspace,
    sourceValidationFolder: input.sourceValidationFolder,
    reviewerInputFolder: input.reviewerInputFolder,
    reviewerInputFile: input.reviewerInputFile,
    outputFolder: input.outputFolder,
    totalWorkspaceRows: workspace.length,
    totalReviewerInputRows: normalizedInputs.length,
    matchedReviewerRows: normalizedInputs.filter((row) => findWorkspaceContext(row, workspaceByDecisionId, workspaceByStableKey)).length,
    missingReviewerRows: missingRows.length,
    duplicateReviewerRows: duplicateRows.length,
    unknownReviewerRows: invalidRows.filter((row) => row.invalid_code === "UNKNOWN_DECISION_ID_OR_KEY").length,
    acceptedReviewerRows: acceptedRows.length,
    blockedReviewerRows: blockedRows.length,
    invalidReviewerRows: invalidRows.length,
    approvedReviewerRows: statusCounts.approved,
    rejectedReviewerRows: statusCounts.rejected,
    deferredReviewerRows: statusCounts.deferred,
    pendingReviewerRows: statusCounts.pending,
    missingReviewerNotesRows: blockedRows.filter((row) => row.blocker_code === "APPROVED_REQUIRES_REVIEWER_NOTES").length,
    invalidActionRows: invalidRows.filter((row) => row.invalid_code === "INVALID_DIRECT_MUTATION_ACTION" || row.invalid_code === "APPROVED_ACTION_NOT_ALLOWED").length,
    readinessStatus,
    p10Gate: {
      status: "BLOCKED",
      reason: readinessStatus === "AWAITING_REVIEWER_INPUT"
        ? `P1.0 remains blocked: reviewer input is missing for ${missingRows.length} approval workspace rows.`
        : readinessStatus === "BLOCKED"
          ? `P1.0 remains blocked: approval intake has ${blockedRows.length} blocked, ${invalidRows.length} invalid, ${duplicateRows.length} duplicate, and ${missingRows.length} missing reviewer rows.`
          : "P1.0 remains blocked: approval intake is ready for apply dry-run review, but this command does not enable P1.0."
    },
    safety
  };
  return {
    normalizedReviewerDecisionRows: normalizedRows,
    acceptedReviewerDecisionRows: acceptedRows,
    blockedReviewerDecisionRows: blockedRows,
    missingReviewerDecisionRows: missingRows,
    duplicateReviewerDecisionRows: duplicateRows,
    invalidReviewerDecisionRows: invalidRows,
    reviewerInputTemplateRows: workspace.map((item) => templateRow(item)),
    approvalReadinessReport: {
      readinessStatus,
      totalWorkspaceRows: summary.totalWorkspaceRows,
      totalReviewerInputRows: summary.totalReviewerInputRows,
      acceptedReviewerRows: summary.acceptedReviewerRows,
      blockedReviewerRows: summary.blockedReviewerRows,
      missingReviewerRows: summary.missingReviewerRows,
      duplicateReviewerRows: summary.duplicateReviewerRows,
      invalidReviewerRows: summary.invalidReviewerRows,
      safeForApplyDryRunReview: readinessStatus === "READY_FOR_APPLY_DRY_RUN_REVIEW",
      notes: [
        "Approval intake is export-only and never mutates approval workspace or apply dry-run outputs.",
        "Accepted reviewer rows are normalized for future dry-run review only.",
        "P1.0 remains blocked by design."
      ]
    },
    p10GatePreview: {
      ...summary.p10Gate,
      readinessStatus,
      acceptedReviewerRows: summary.acceptedReviewerRows,
      blockedReviewerRows: summary.blockedReviewerRows,
      missingReviewerRows: summary.missingReviewerRows
    },
    safetyReport: {
      ...safety,
      mode: "INTAKE_EXPORT_ONLY"
    },
    summary
  };
}

function normalizeReviewerInput(row: ScopedDecisionReviewerInputRow, inputIndex: number): NormalizedReviewerInput {
  const statusValue = normalized(row.approval_status);
  const approvalStatus: ScopedDecisionReviewerApprovalStatus | "unsupported" =
    statusValue === "" ? "pending" :
      statusValue === "approved" || statusValue === "rejected" || statusValue === "deferred" || statusValue === "pending" ? statusValue : "unsupported";
  return {
    source: row,
    inputIndex,
    decisionId: trimmed(row.decision_id),
    stableKey: trimmed(row.stable_decision_key),
    statusValue,
    approvalStatus,
    approvedAction: trimmed(row.approved_action),
    reviewer: trimmed(row.reviewer),
    reviewerNotes: trimmed(row.reviewer_notes),
    businessApprovalReference: trimmed(row.business_approval_reference),
    decisionDate: trimmed(row.decision_date),
    safeToAutoApply: booleanValue(row.safe_to_auto_apply),
    safeToSeedTargetProfile: booleanValue(row.safe_to_seed_target_profile),
    entityDependencyStatus: normalized(row.entity_dependency_status),
    targetBucket: trimmed(row.target_bucket),
    targetQty: trimmed(row.target_qty),
    unit: trimmed(row.unit)
  };
}

function evaluateReviewerDecision(
  reviewerRow: NormalizedReviewerInput,
  context: WorkspaceContext | undefined,
  isDuplicate: boolean
): {
  readonly normalized?: ScopedDecisionNormalizedReviewerDecisionRow;
  readonly blocked?: ScopedDecisionBlockedReviewerDecisionRow;
  readonly invalid?: ScopedDecisionInvalidReviewerDecisionRow;
} {
  if (!context) {
    return {
      invalid: invalidRow(reviewerRow, "UNKNOWN_DECISION_ID_OR_KEY", "Reviewer decision does not match any approval workspace row.")
    };
  }
  if (isDuplicate) {
    return {
      blocked: blockedRow(reviewerRow, context, "DUPLICATE_REVIEWER_DECISION", "Duplicate reviewer decisions for the same row are blocked.", "Keep exactly one reviewer decision per approval workspace row."),
      invalid: invalidRow(reviewerRow, "DUPLICATE_REVIEWER_DECISION", "Duplicate reviewer decisions for the same row are not intake-ready.")
    };
  }
  const block = reviewerBlock(reviewerRow, context.row);
  if (block) {
    const blocked = blockedRow(reviewerRow, context, block.code, block.reason, block.required);
    const result: {
      readonly normalized: ScopedDecisionNormalizedReviewerDecisionRow;
      readonly blocked: ScopedDecisionBlockedReviewerDecisionRow;
      readonly invalid?: ScopedDecisionInvalidReviewerDecisionRow;
    } = {
      normalized: normalizedRow(reviewerRow, context, "BLOCKED", block.reason),
      blocked
    };
    if (block.invalid) return { ...result, invalid: invalidRow(reviewerRow, block.code, block.reason) };
    return result;
  }
  return {
    normalized: normalizedRow(reviewerRow, context, "ACCEPTED", "Approved reviewer decision passed intake validation for future dry-run review.")
  };
}

function reviewerBlock(
  reviewerRow: NormalizedReviewerInput,
  workspaceRow: ScopedDecisionApprovalWorkbookRow
): { readonly code: string; readonly reason: string; readonly required: string; readonly invalid?: boolean } | null {
  if (reviewerRow.approvalStatus === "unsupported") {
    return { code: "UNSUPPORTED_APPROVAL_STATUS", reason: "approval_status is not supported.", required: "Use approved, rejected, deferred, or pending.", invalid: true };
  }
  if (reviewerRow.approvalStatus !== "approved") {
    return { code: `${reviewerRow.approvalStatus.toUpperCase()}_NOT_ACCEPTED`, reason: "Only approved reviewer decisions can be accepted by intake.", required: "Approve with required reviewer evidence or leave the row pending/deferred/rejected as non-accepted." };
  }
  if (!reviewerRow.reviewer) {
    return { code: "APPROVED_REQUIRES_REVIEWER", reason: "Approved reviewer decision requires reviewer.", required: "Fill reviewer before intake acceptance.", invalid: true };
  }
  if (!reviewerRow.reviewerNotes) {
    return { code: "APPROVED_REQUIRES_REVIEWER_NOTES", reason: "Approved reviewer decision requires non-empty reviewer_notes.", required: "Fill reviewer_notes with exact evidence before intake acceptance.", invalid: true };
  }
  if (!reviewerRow.approvedAction) {
    return { code: "APPROVED_ACTION_REQUIRED", reason: "Approved reviewer decision requires approved_action.", required: "Use an allowed review-only approved_action.", invalid: true };
  }
  if (isForbiddenDirectMutationAction(reviewerRow.approvedAction)) {
    return { code: "INVALID_DIRECT_MUTATION_ACTION", reason: "Direct mutation actions are invalid in approval intake.", required: "Use a review-only action; never request live alias/entity/target/dashboard mutation.", invalid: true };
  }
  if (!scopedDecisionAllowedApprovedActions.includes(reviewerRow.approvedAction as never)) {
    return { code: "APPROVED_ACTION_NOT_ALLOWED", reason: "approved_action is not in the allowed review-only action set.", required: "Replace approved_action with an allowed review-only value.", invalid: true };
  }
  if (workspaceRow.decision_family === "(blank)/UNMAPPED" && workspaceRow.decision_category === "CANONICAL_ENTITY_NEEDED") {
    return { code: "BLANK_SOURCE_CANNOT_CREATE_CANONICAL", reason: "Blank or unmapped source cannot create a canonical entity automatically.", required: "Use source data backlog or defer.", invalid: true };
  }
  if (reviewerRow.safeToAutoApply) {
    const block = autoApplyBlock(workspaceRow);
    if (block) return block;
  }
  if (workspaceRow.decision_category === "REJECT_ATTACHMENT_REVIEW" && normalized(reviewerRow.reviewerNotes).includes("ok output")) {
    return { code: "REJECT_MUST_NOT_CONVERT_TO_OK_OUTPUT", reason: "Reject rows must not be converted into OK output scope.", required: "Keep RJ/reject evidence reject-related.", invalid: true };
  }
  if (workspaceRow.decision_category === "TARGET_PROFILE_DEPENDS_ON_ENTITY_DECISION") {
    if (reviewerRow.entityDependencyStatus && !["approved", "not_required"].includes(reviewerRow.entityDependencyStatus)) {
      return { code: "TARGET_PROFILE_ENTITY_DEPENDENCY_PENDING", reason: "Target profile approval remains blocked while entity dependency is pending.", required: "Approve entity/canonical dependency or mark it not required first." };
    }
    if (reviewerRow.safeToSeedTargetProfile) {
      if (reviewerRow.entityDependencyStatus !== "approved") return { code: "TARGET_SEED_REQUIRES_ENTITY_APPROVED", reason: "safe_to_seed_target_profile requires approved entity dependency.", required: "Approve entity dependency before target seed dry-run review.", invalid: true };
      if (!reviewerRow.targetBucket) return { code: "TARGET_SEED_REQUIRES_BUCKET", reason: "safe_to_seed_target_profile requires target_bucket.", required: "Fill target_bucket.", invalid: true };
      if (!reviewerRow.targetQty) return { code: "TARGET_SEED_REQUIRES_QTY", reason: "safe_to_seed_target_profile requires target_qty.", required: "Fill target_qty.", invalid: true };
      if (!reviewerRow.unit) return { code: "TARGET_SEED_REQUIRES_UNIT", reason: "safe_to_seed_target_profile requires unit.", required: "Fill unit.", invalid: true };
    }
  }
  return null;
}

function autoApplyBlock(row: ScopedDecisionApprovalWorkbookRow): { readonly code: string; readonly reason: string; readonly required: string; readonly invalid: true } | null {
  const text = normalized(`${row.source_value} ${row.rationale} ${row.recommended_decision}`);
  if (row.decision_family === "OMSO") return { code: "OMSO_CANNOT_AUTO_APPROVE", reason: "OMSO conflicts cannot be auto-approved.", required: "Keep OMSO as manual review without safe_to_auto_apply.", invalid: true };
  if (row.decision_family === "VFINE" || text.includes("vfine botol 600 ml")) return { code: "VFINE_SIZE_VARIANT_REQUIRES_MANUAL_REVIEW", reason: "VFINE wrong size or variant mapping cannot be auto-approved.", required: "Use manual alias/canonical review only.", invalid: true };
  if (row.decision_family === "LONGSUN" || text.includes("longsun 1 botol 1500 ml")) return { code: "LONGSUN_SIZE_VARIANT_REQUIRES_MANUAL_REVIEW", reason: "LONGSUN wrong size or variant mapping cannot be auto-approved.", required: "Use manual alias/canonical review only.", invalid: true };
  if (row.decision_family === "POLYPRINT") return { code: "POLYPRINT_REQUIRES_MANUAL_REVIEW", reason: "POLYPRINT naming normalization cannot be auto-approved.", required: "Use manual alias/canonical review only.", invalid: true };
  if (row.decision_family === "THERMO HENGFENG") return { code: "THERMO_HENGFENG_REQUIRES_MANUAL_REVIEW", reason: "THERMO HENGFENG legacy variant collapse cannot be auto-approved.", required: "Use manual canonical review only.", invalid: true };
  if (row.decision_family === "(blank)/UNMAPPED") return { code: "BLANK_SOURCE_CANNOT_AUTO_APPROVE", reason: "Blank or unmapped source cannot be auto-approved.", required: "Use source data backlog or defer.", invalid: true };
  return null;
}

function normalizedRow(
  reviewerRow: NormalizedReviewerInput,
  context: WorkspaceContext,
  intakeStatus: "ACCEPTED" | "BLOCKED",
  intakeReason: string
): ScopedDecisionNormalizedReviewerDecisionRow {
  return {
    intake_id: intakeId("N", reviewerRow.inputIndex),
    decision_id: context.row.decision_id,
    stable_decision_key: context.stableKey,
    priority: context.row.priority,
    decision_family: context.row.decision_family,
    decision_category: context.row.decision_category,
    source_value: context.row.source_value,
    grouped_rows: context.row.grouped_rows,
    approval_status: reviewerRow.approvalStatus === "unsupported" ? "pending" : reviewerRow.approvalStatus,
    approved_action: reviewerRow.approvedAction,
    reviewer: reviewerRow.reviewer,
    reviewer_notes: reviewerRow.reviewerNotes,
    business_approval_reference: reviewerRow.businessApprovalReference,
    decision_date: reviewerRow.decisionDate,
    safe_to_auto_apply: reviewerRow.safeToAutoApply ? "true" : "false",
    safe_to_seed_target_profile: reviewerRow.safeToSeedTargetProfile ? "true" : "false",
    entity_dependency_status: reviewerRow.entityDependencyStatus,
    target_bucket: reviewerRow.targetBucket || context.row.target_bucket,
    target_qty: reviewerRow.targetQty,
    unit: reviewerRow.unit,
    intake_status: intakeStatus,
    intake_reason: intakeReason
  };
}

function blockedRow(
  reviewerRow: NormalizedReviewerInput,
  context: WorkspaceContext,
  code: string,
  reason: string,
  required: string
): ScopedDecisionBlockedReviewerDecisionRow {
  return {
    block_id: intakeId("B", reviewerRow.inputIndex),
    decision_id: context.row.decision_id,
    stable_decision_key: context.stableKey,
    decision_family: context.row.decision_family,
    decision_category: context.row.decision_category,
    source_value: context.row.source_value,
    approval_status: reviewerRow.approvalStatus,
    approved_action: reviewerRow.approvedAction,
    blocker_code: code,
    blocker_reason: reason,
    required_before_acceptance: required
  };
}

function invalidRow(reviewerRow: NormalizedReviewerInput, code: string, reason: string): ScopedDecisionInvalidReviewerDecisionRow {
  return {
    invalid_id: intakeId("I", reviewerRow.inputIndex),
    decision_id: reviewerRow.decisionId,
    stable_decision_key: reviewerRow.stableKey,
    approval_status: reviewerRow.statusValue,
    approved_action: reviewerRow.approvedAction,
    invalid_code: code,
    invalid_reason: reason
  };
}

function missingRow(context: WorkspaceContext): ScopedDecisionMissingReviewerDecisionRow {
  return {
    decision_id: context.row.decision_id,
    stable_decision_key: context.stableKey,
    priority: context.row.priority,
    decision_family: context.row.decision_family,
    decision_category: context.row.decision_category,
    source_value: context.row.source_value,
    grouped_rows: context.row.grouped_rows,
    approval_status: "missing",
    required_reviewer_fields: "decision_id or stable_decision_key; approval_status; reviewer; reviewer_notes"
  };
}

function templateRow(context: WorkspaceContext): ScopedDecisionReviewerInputTemplateRow {
  return {
    decision_id: context.row.decision_id,
    stable_decision_key: context.stableKey,
    priority: context.row.priority,
    decision_family: context.row.decision_family,
    decision_category: context.row.decision_category,
    source_value: context.row.source_value,
    grouped_rows: context.row.grouped_rows,
    recommended_decision: context.row.recommended_decision,
    rationale: context.row.rationale,
    approval_status: "",
    approved_action: "",
    reviewer: "",
    reviewer_notes: "",
    business_approval_reference: "",
    decision_date: "",
    safe_to_auto_apply: "false",
    safe_to_seed_target_profile: "false",
    entity_dependency_status: "",
    target_bucket: context.row.target_bucket,
    target_qty: "",
    unit: ""
  };
}

function buildDuplicateRows(
  rows: readonly NormalizedReviewerInput[],
  duplicateKeys: ReadonlySet<string>
): readonly ScopedDecisionDuplicateReviewerDecisionRow[] {
  return [...duplicateKeys].map((key, index) => {
    const first = rows.find((row) => reviewerMatchKey(row) === key);
    return {
      duplicate_id: intakeId("D", index),
      decision_id: first?.decisionId ?? "",
      stable_decision_key: first?.stableKey ?? key,
      duplicate_count: rows.filter((row) => reviewerMatchKey(row) === key).length,
      blocker_code: "DUPLICATE_REVIEWER_DECISION",
      blocker_reason: "Reviewer input contains more than one decision for the same approval workspace row."
    };
  });
}

function findWorkspaceContext(
  reviewerRow: NormalizedReviewerInput,
  byDecisionId: ReadonlyMap<string, WorkspaceContext>,
  byStableKey: ReadonlyMap<string, WorkspaceContext>
): WorkspaceContext | undefined {
  if (reviewerRow.decisionId) return byDecisionId.get(reviewerRow.decisionId);
  if (reviewerRow.stableKey) return byStableKey.get(reviewerRow.stableKey);
  return undefined;
}

function stableDecisionKey(row: Pick<ScopedDecisionApprovalWorkbookRow, "decision_id" | "decision_family" | "decision_category" | "source_value" | "grouped_rows">): string {
  return [
    row.decision_id,
    row.decision_family,
    row.decision_category,
    row.source_value,
    String(row.grouped_rows)
  ].map((value) => normalized(value)).join("|");
}

function reviewerMatchKey(row: NormalizedReviewerInput): string {
  return row.decisionId ? `id:${row.decisionId}` : `key:${row.stableKey}`;
}

function countBy(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function isForbiddenDirectMutationAction(value: string): boolean {
  return extraForbiddenDirectMutationActions.some((action) => action === value);
}

function intakeId(prefix: string, index: number): string {
  return `${prefix}${String(index + 1).padStart(5, "0")}`;
}

function booleanValue(value: string | undefined): boolean {
  return normalized(value) === "true";
}

function normalized(value: string | number | undefined): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function trimmed(value: string | undefined): string {
  return String(value ?? "").trim();
}
